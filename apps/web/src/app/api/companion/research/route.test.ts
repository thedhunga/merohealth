import { afterEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';

function request(body: unknown) {
  return new Request('http://localhost/api/companion/research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('POST /api/companion/research', () => {
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
});
