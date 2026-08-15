import { describe, expect, it, vi } from 'vitest';

import { researchHealthQuestion } from './perplexity-health';

describe('researchHealthQuestion', () => {
  it('returns setup-required without sending a network request when the key is absent', async () => {
    const fetchImpl = vi.fn<typeof fetch>();

    const result = await researchHealthQuestion('What can cause a mild headache?', 'en', {
      apiKey: '',
      fetchImpl,
    });

    expect(result.status).toBe('setup-required');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('normalizes cited Sonar research', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'Headaches have several possible causes.' } }],
          citations: ['https://who.int/headache', 'javascript:alert(1)', 'not-a-url'],
          search_results: [
            {
              title: 'Headache overview',
              url: 'https://who.int/headache',
              snippet: 'General information',
            },
          ],
          related_questions: ['When should I see a clinician?'],
        }),
        { status: 200 },
      ),
    );

    const result = await researchHealthQuestion('What can cause a mild headache?', 'en', {
      apiKey: 'test-key',
      fetchImpl,
    });

    expect(result.status).toBe('complete');
    expect(result.answer).toContain('possible causes');
    expect(result.citations).toEqual([
      expect.objectContaining({ title: 'Headache overview', url: 'https://who.int/headache' }),
    ]);
    expect(result.relatedQuestions).toEqual(['When should I see a clinician?']);
    expect(result.citations).toHaveLength(1);
  });

  it('fails closed when the upstream provider is unavailable', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new Error('offline'));

    const result = await researchHealthQuestion('What can cause a mild headache?', 'en', {
      apiKey: 'test-key',
      fetchImpl,
    });

    expect(result.status).toBe('unavailable');
    expect(result.answer).toBeNull();
  });
});
