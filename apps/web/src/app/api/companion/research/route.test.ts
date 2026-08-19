import { afterEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';

function request(body: unknown) {
  return new Request('http://localhost/api/companion/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** `RequestInit.body` is typed as `BodyInit | null | undefined`; every provider fetch in this route sends a JSON string. */
function sentBodyOf(fetchSpy: { mock: { calls: unknown[][] } }): unknown {
  const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined;
  return JSON.parse(typeof init?.body === 'string' ? init.body : '{}');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function requestFrom(ip: string, body: unknown) {
  return new Request('http://localhost/api/companion/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });
}

describe('POST /api/companion/research', () => {
  it('rate-limits a caller past the per-IP ceiling, without ever reaching the provider on the blocked call', async () => {
    vi.stubEnv('PERPLEXITY_API_KEY', 'test-key');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: 'Answer.' } }] }), { status: 200 }),
    );
    const ip = '203.0.113.99';
    const question = { message: 'What can cause a mild headache?', language: 'en' };

    for (let i = 0; i < 30; i++) {
      const response = await POST(requestFrom(ip, question));
      expect(response.status).toBe(200);
    }
    expect(fetchSpy).toHaveBeenCalledTimes(30);

    const blocked = await POST(requestFrom(ip, question));
    const body = (await blocked.json()) as { code: string };

    expect(blocked.status).toBe(429);
    expect(body.code).toBe('RATE_LIMITED');
    expect(blocked.headers.get('Cache-Control')).toBe('no-store');
    expect(fetchSpy).toHaveBeenCalledTimes(30);
  });

  it('gives a caller behind a different IP its own, unaffected allowance', async () => {
    vi.stubEnv('PERPLEXITY_API_KEY', 'test-key');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: 'Answer.' } }] }), { status: 200 }),
    );
    const question = { message: 'What can cause a mild headache?', language: 'en' };

    for (let i = 0; i < 30; i++) await POST(requestFrom('203.0.113.100', question));

    const response = await POST(requestFrom('203.0.113.101', question));
    expect(response.status).toBe(200);
  });

  it('rejects invalid input', async () => {
    const response = await POST(request({ message: 'x' }));

    expect(response.status).toBe(400);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('interrupts emergencies before Perplexity is called', async () => {
    vi.stubEnv('PERPLEXITY_API_KEY', 'test-key');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const response = await POST(request({ message: 'I cannot breathe', language: 'en' }));
    const body = (await response.json()) as {
      assessment: { interruptConversation: boolean };
      research: unknown;
      advisory: unknown;
    };

    expect(body.assessment.interruptConversation).toBe(true);
    expect(body.research).toBeNull();
    expect(body.advisory).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns a safe setup state when the Perplexity key is absent', async () => {
    vi.stubEnv('PERPLEXITY_API_KEY', '');

    const response = await POST(
      request({ message: 'What can cause a mild headache?', language: 'en' }),
    );
    const body = (await response.json()) as {
      assessment: { interruptConversation: boolean };
      research: { status: string };
      advisory: unknown;
    };

    expect(response.status).toBe(200);
    expect(body.assessment.interruptConversation).toBe(false);
    expect(body.research.status).toBe('setup-required');
    expect(body.advisory).toBeNull();
  });

  it('attaches a medicine advisory when the completed answer names one', async () => {
    vi.stubEnv('PERPLEXITY_API_KEY', 'test-key');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: 'Take paracetamol for the fever.' } }] }),
        { status: 200 },
      ),
    );

    const response = await POST(request({ message: 'What helps with a mild fever?', language: 'en' }));
    const body = (await response.json()) as {
      research: { status: string; answer: string | null };
      advisory: { kind: string; medicines: string[] } | null;
    };

    expect(body.research.status).toBe('complete');
    expect(body.advisory).toEqual({ kind: 'medicine', medicines: ['paracetamol'] });
  });

  it('attaches no advisory when the completed answer names no medicine and gives no instruction', async () => {
    vi.stubEnv('PERPLEXITY_API_KEY', 'test-key');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'A mild headache can have many everyday causes.' } }],
        }),
        { status: 200 },
      ),
    );

    const response = await POST(request({ message: 'What can cause a mild headache?', language: 'en' }));
    const body = (await response.json()) as { advisory: unknown };

    expect(body.advisory).toBeNull();
  });

  it('reports domain HEALTH and does not affect a normal answer', async () => {
    vi.stubEnv('PERPLEXITY_API_KEY', 'test-key');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: 'A mild headache can have many everyday causes.' } }] }),
        { status: 200 },
      ),
    );

    const response = await POST(request({ message: 'What can cause a mild headache?', language: 'en' }));
    const body = (await response.json()) as { domain: string; research: { status: string } };

    expect(body.domain).toBe('HEALTH');
    expect(body.research.status).toBe('complete');
  });

  it('skips the provider entirely for a clearly off-topic question and returns the fixed containment domain', async () => {
    vi.stubEnv('PERPLEXITY_API_KEY', 'test-key');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const response = await POST(request({ message: 'who won the match yesterday', language: 'en' }));
    const body = (await response.json()) as { domain: string; research: unknown; advisory: unknown };

    expect(body.domain).toBe('OFF_TOPIC');
    expect(body.research).toBeNull();
    expect(body.advisory).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('forwards prior turns as conversation context to the provider — round five task H', async () => {
    vi.stubEnv('PERPLEXITY_API_KEY', 'test-key');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: 'Keep resting and drink fluids.' } }] }),
        { status: 200 },
      ),
    );

    await POST(
      request({
        message: 'Is it still safe today?',
        language: 'en',
        turns: [
          { role: 'user', text: 'I have had a mild fever for two days' },
          { role: 'assistant', text: 'Rest and monitor your temperature.' },
        ],
      }),
    );

    const sentBody = sentBodyOf(fetchSpy) as { messages: { role: string; content: string }[] };
    expect(sentBody.messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
    expect(sentBody.messages[1]?.content).toContain('mild fever');
  });

  it('caps prior turns to the last 6 and drops malformed entries', async () => {
    vi.stubEnv('PERPLEXITY_API_KEY', 'test-key');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: 'Answer.' } }] }), { status: 200 }),
    );
    const manyTurns = Array.from({ length: 9 }, (_, i) => ({ role: 'user', text: `turn ${i}` }));

    await POST(
      request({
        message: 'ok?',
        language: 'en',
        turns: [...manyTurns, { role: 'nope', text: 'bad role' }, { role: 'user' }],
      }),
    );

    const sentBody = sentBodyOf(fetchSpy) as { messages: unknown[] };
    // system + last 6 valid turns + the new question = 8
    expect(sentBody.messages).toHaveLength(8);
  });

  it('discards an answer that drifted off-topic despite the containment instruction', async () => {
    vi.stubEnv('PERPLEXITY_API_KEY', 'test-key');
    // The question itself is UNSURE (nothing recognisably health or
    // off-topic in it), so it reaches the provider — but the provider's own
    // answer talks about the weather, which the same deterministic
    // classifier recognises as off-topic on the post-check.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: 'Tomorrow the weather forecast shows heavy rain.' } }] }),
        { status: 200 },
      ),
    );

    const response = await POST(request({ message: 'tell me something interesting', language: 'en' }));
    const body = (await response.json()) as { domain: string; research: unknown; advisory: unknown };

    expect(body.domain).toBe('OFF_TOPIC');
    expect(body.research).toBeNull();
    expect(body.advisory).toBeNull();
  });
});
