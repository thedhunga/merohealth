import { describe, expect, it, vi } from 'vitest';

import { researchWithGemini } from './gemini-health';
import { selectProvider } from './research-provider';

/** Shaped like the documented `interactions` response, citations as annotations. */
const groundedResponse = {
  steps: [
    { type: 'google_search_call', queries: ['fever three days'] },
    {
      type: 'model_output',
      content: [
        {
          type: 'text',
          text: 'तीन दिनभन्दा बढी ज्वरो रहे स्वास्थ्यकर्मीलाई देखाउनुहोस्।',
          annotations: [
            { type: 'url_citation', url: 'https://www.who.int/x', title: 'WHO', start_index: 0, end_index: 10 },
            { type: 'url_citation', url: 'https://www.who.int/x', title: 'WHO again', start_index: 5, end_index: 12 },
            { type: 'url_citation', url: 'https://www.cdc.gov/y', start_index: 0, end_index: 3 },
            { type: 'url_citation', url: 'javascript:alert(1)', title: 'bad', start_index: 0, end_index: 1 },
          ],
        },
      ],
    },
  ],
};

const fetchReturning = (status: number, body: unknown): typeof fetch =>
  (() => Promise.resolve(new Response(JSON.stringify(body), { status }))) as unknown as typeof fetch;

describe('researchWithGemini', () => {
  it('reports setup-required without a key and never calls the network', async () => {
    let called = false;
    const spy: typeof fetch = (() => {
      called = true;
      return Promise.resolve(new Response('{}'));
    }) as unknown as typeof fetch;

    const result = await researchWithGemini('ज्वरो छ', 'ne', { apiKey: undefined, fetchImpl: spy });
    expect(result.status).toBe('setup-required');
    expect(result.provider).toBe('gemini-grounded');
    expect(called).toBe(false);
  });

  it('sends the key in the x-goog-api-key header and enables google_search', async () => {
    let seenHeaders: Headers | undefined;
    let seenBody: Record<string, unknown> | undefined;
    const spy: typeof fetch = ((_url: unknown, init?: RequestInit) => {
      seenHeaders = new Headers(init?.headers);
      seenBody = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as Record<string, unknown>;
      return Promise.resolve(new Response(JSON.stringify(groundedResponse), { status: 200 }));
    }) as unknown as typeof fetch;

    await researchWithGemini('ज्वरो छ', 'ne', { apiKey: 'k', fetchImpl: spy });
    expect(seenHeaders?.get('x-goog-api-key')).toBe('k');
    expect(seenBody?.tools).toEqual([{ type: 'google_search' }]);
    expect(String(seenBody?.input)).toContain('ज्वरो छ');
  });

  it('extracts the answer from the model_output text block', async () => {
    const result = await researchWithGemini('ज्वरो छ', 'ne', {
      apiKey: 'k',
      fetchImpl: fetchReturning(200, groundedResponse),
    });
    expect(result.status).toBe('complete');
    expect(result.answer).toContain('स्वास्थ्यकर्मी');
  });

  it('dedupes citations by URL, keeps the first title, and drops non-http URLs', async () => {
    const result = await researchWithGemini('ज्वरो छ', 'ne', {
      apiKey: 'k',
      fetchImpl: fetchReturning(200, groundedResponse),
    });
    expect(result.citations).toEqual([
      { title: 'WHO', url: 'https://www.who.int/x' },
      { title: 'cdc.gov', url: 'https://www.cdc.gov/y' },
    ]);
  });

  it('never links off-site', async () => {
    const result = await researchWithGemini('ज्वरो छ', 'ne', {
      apiKey: 'k',
      fetchImpl: fetchReturning(200, groundedResponse),
    });
    expect(result.externalHealthHubUrl).toBeNull();
  });

  it('is unavailable, not a crash, on a non-2xx or empty answer', async () => {
    const bad = await researchWithGemini('x', 'en', { apiKey: 'k', fetchImpl: fetchReturning(429, {}) });
    expect(bad.status).toBe('unavailable');
    expect(bad.diagnostic).toContain('HTTP 429');

    const empty = await researchWithGemini('x', 'en', {
      apiKey: 'k',
      fetchImpl: fetchReturning(200, { steps: [{ type: 'model_output', content: [] }] }),
    });
    expect(empty.status).toBe('unavailable');
    expect(empty.diagnostic).toContain('empty answer');
    expect(empty.diagnostic).toContain('steps=[model_output]');
  });

  it('surfaces Google\'s error status and reason without leaking anything else', async () => {
    const googleError = {
      error: {
        code: 400,
        message: 'API key not valid. Please pass a valid API key. secret-looking-text-that-must-be-cut-' + 'x'.repeat(300),
        status: 'INVALID_ARGUMENT',
        details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID' }],
      },
    };
    const result = await researchWithGemini('x', 'en', { apiKey: 'k', fetchImpl: fetchReturning(400, googleError) });
    expect(result.status).toBe('unavailable');
    expect(result.diagnostic).toContain('HTTP 400');
    expect(result.diagnostic).toContain('INVALID_ARGUMENT');
    expect(result.diagnostic).toContain('API_KEY_INVALID');
    expect(result.diagnostic?.length).toBeLessThan(260);
    expect(result.diagnostic).not.toContain('k'.repeat(2));

    // The endpoint sometimes wraps the error in an array (batch shape).
    const wrapped = await researchWithGemini('x', 'en', { apiKey: 'k', fetchImpl: fetchReturning(403, [googleError]) });
    expect(wrapped.diagnostic).toContain('API_KEY_INVALID');
  });

  it('walks to the next model when Google says the ID is no longer available', async () => {
    const goneBody = {
      error: { code: 404, status: 'NOT_FOUND', message: 'This model models/gemini-3.7-flash is no longer available to new users.' },
    };
    const modelsTried: string[] = [];
    const fetchImpl: typeof fetch = ((_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as { model: string };
      modelsTried.push(body.model);
      const ok = modelsTried.length >= 2;
      return Promise.resolve(new Response(JSON.stringify(ok ? groundedResponse : goneBody), { status: ok ? 200 : 404 }));
    }) as unknown as typeof fetch;

    const result = await researchWithGemini('x', 'ne', { apiKey: 'k', fetchImpl });
    expect(result.status).toBe('complete');
    expect(modelsTried).toEqual(['gemini-3.7-flash', 'gemini-3.5-flash']);
  });

  it('puts an explicit GEMINI_MODEL first, then the built-in list', async () => {
    const modelsTried: string[] = [];
    const fetchImpl: typeof fetch = ((_url: unknown, init?: RequestInit) => {
      modelsTried.push((JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as { model: string }).model);
      return Promise.resolve(new Response(JSON.stringify(groundedResponse), { status: 200 }));
    }) as unknown as typeof fetch;
    await researchWithGemini('x', 'ne', { apiKey: 'k', model: 'gemini-2.5-pro', fetchImpl });
    expect(modelsTried).toEqual(['gemini-2.5-pro']);
  });

  it('does NOT retry other models when a real (non-zero) quota is used up', async () => {
    let calls = 0;
    const exhausted = {
      error: {
        status: 'RESOURCE_EXHAUSTED',
        message: 'You exceeded your current quota',
        details: [
          { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier', quotaValue: '250' }] },
          { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '31s' },
        ],
      },
    };
    const fetchImpl: typeof fetch = (() => {
      calls += 1;
      return Promise.resolve(new Response(JSON.stringify(exhausted), { status: 429 }));
    }) as unknown as typeof fetch;
    const result = await researchWithGemini('x', 'ne', { apiKey: 'k', fetchImpl });
    expect(result.status).toBe('unavailable');
    expect(calls).toBe(1);
    expect(result.diagnostic).toContain('quota[GenerateRequestsPerDayPerProjectPerModel-FreeTier=250]');
    expect(result.diagnostic).toContain('retry 31s');
  });

  it('DOES move on when a model has a zero quota on this key (not in the free tier)', async () => {
    const zero = {
      error: {
        status: 'RESOURCE_EXHAUSTED',
        details: [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'FreeTier', quotaValue: '0' }] }],
      },
    };
    const modelsTried: string[] = [];
    const fetchImpl: typeof fetch = ((_url: unknown, init?: RequestInit) => {
      modelsTried.push((JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as { model: string }).model);
      const ok = modelsTried.length >= 3;
      return Promise.resolve(new Response(JSON.stringify(ok ? groundedResponse : zero), { status: ok ? 200 : 429 }));
    }) as unknown as typeof fetch;
    const result = await researchWithGemini('x', 'ne', { apiKey: 'k', fetchImpl });
    expect(result.status).toBe('complete');
    expect(modelsTried).toEqual(['gemini-3.7-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite']);
  });

  it('reports every model it tried when all are gone', async () => {
    const fetchImpl: typeof fetch = (() =>
      Promise.resolve(new Response(JSON.stringify({ error: { message: 'model not found' } }), { status: 404 }))) as unknown as typeof fetch;
    const result = await researchWithGemini('x', 'ne', { apiKey: 'k', fetchImpl });
    expect(result.status).toBe('unavailable');
    expect(result.diagnostic).toContain('tried=[gemini-3.7-flash,gemini-3.5-flash,gemini-3.5-flash-lite]');
  });

  it('on a detail-less 429 walks every model, then probes what exactly is refused', async () => {
    const urls: string[] = [];
    const fetchImpl: typeof fetch = ((url: unknown, init?: RequestInit) => {
      const body = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as { tools?: unknown[] };
      urls.push(`${String(url).includes(':generateContent') ? 'legacy' : 'interactions'}${body.tools ? '+tools' : ''}`);
      return Promise.resolve(new Response(JSON.stringify({ error: { message: 'You exceeded your current quota' } }), { status: 429 }));
    }) as unknown as typeof fetch;
    const result = await researchWithGemini('x', 'ne', { apiKey: 'k', fetchImpl });
    expect(result.status).toBe('unavailable');
    // three grounded attempts, then one ungrounded interactions probe and one legacy grounded probe
    expect(urls).toEqual(['interactions+tools', 'interactions+tools', 'interactions+tools', 'interactions', 'legacy+tools']);
    expect(result.diagnostic).toContain('tried=[gemini-3.7-flash,gemini-3.5-flash,gemini-3.5-flash-lite]');
    expect(result.diagnostic).toContain('probe[interactions-ungrounded=429 generateContent-grounded=429]');
  });

  it('names a successful call\'s absence of diagnostic', async () => {
    const ok = await researchWithGemini('x', 'en', { apiKey: 'k', fetchImpl: fetchReturning(200, groundedResponse) });
    expect(ok.diagnostic).toBeUndefined();
  });

  it('fails closed when the network is unreachable, not just on a bad response', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new Error('offline'));

    const result = await researchWithGemini('x', 'en', { apiKey: 'k', fetchImpl });

    expect(result.status).toBe('unavailable');
    expect(result.answer).toBeNull();
    expect(result.provider).toBe('gemini-grounded');
  });

  it('carries the Nepali disclaimer for ne and English for en', async () => {
    const ne = await researchWithGemini('x', 'ne', { apiKey: undefined });
    const en = await researchWithGemini('x', 'en', { apiKey: undefined });
    expect(ne.disclaimer).toMatch(/निदान/);
    expect(en.disclaimer).toMatch(/not a diagnosis/);
  });
});

describe('selectProvider', () => {
  it('prefers gemini when its key is present', () => {
    expect(selectProvider({ GEMINI_API_KEY: 'g', PERPLEXITY_API_KEY: 'p' })).toBe('gemini');
  });
  it('falls back to perplexity when only that key exists', () => {
    expect(selectProvider({ PERPLEXITY_API_KEY: 'p' })).toBe('perplexity');
  });
  it('honours an explicit override', () => {
    expect(selectProvider({ GEMINI_API_KEY: 'g', PERPLEXITY_API_KEY: 'p', RESEARCH_PROVIDER: 'perplexity' })).toBe('perplexity');
  });
  it('is null with no keys at all', () => {
    expect(selectProvider({})).toBeNull();
  });
});
