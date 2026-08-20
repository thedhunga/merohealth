import { describe, expect, it, vi } from 'vitest';
import { CompanionResearchRateLimiter } from './companion-research-rate-limiter.js';
import { CompanionController } from './companion.controller.js';

const CALLER = { ip: '1.2.3.4' };

describe('CompanionController', () => {
  it('does not generate after emergency routing', () => {
    const result = new CompanionController().assess({
      message: 'I cannot breathe',
      language: 'en',
    });
    expect(result.assessment.interruptConversation).toBe(true);
    expect(result.generatedAnswer).toBeNull();
  });

  it('returns a Romanized-Nepali template for a ne-Latn emergency, not a Devanagari fallback', () => {
    const result = new CompanionController().assess({
      message: 'ma saas ferna sakdina',
      language: 'ne-Latn',
    });
    expect(result.assessment.interruptConversation).toBe(true);
    expect(result.template).toBe(
      'Yo aapatkalin awastha huna sakchha. Yo app le aapatkalin upachar dina sakdaina. Ahile nai najikko upayukta aapatkalin sewama sampark garnuhos wa najikko aspatal januhos.',
    );
  });

  it('never sends an emergency question to external research', async () => {
    const research = vi.fn();
    const controller = new CompanionController({ research } as never);
    const result = await controller.research({ message: 'I cannot breathe', language: 'en' }, CALLER);
    expect(result.research).toBeNull();
    expect(research).not.toHaveBeenCalled();
  });

  it('returns cited research only after the safety gate', async () => {
    const research = vi.fn().mockResolvedValue({
      provider: 'perplexity-sonar',
      status: 'complete',
      answer: 'General information',
      citations: [{ title: 'WHO', url: 'https://www.who.int/' }],
    });
    const result = await new CompanionController({ research } as never).research(
      { message: 'What can cause headaches?', language: 'en' },
      CALLER,
    );
    expect(result.research?.status).toBe('complete');
    expect(research).toHaveBeenCalledOnce();
  });

  // The abuse nothing else in this route stops: every accepted call reaches
  // Perplexity's priciest search tier, so a caller looping the same question
  // must be cut off before it ever reaches the safety gate or the model.
  it('cuts off a caller who exceeds the research rate limit, before spending on Perplexity', async () => {
    const research = vi.fn().mockResolvedValue({
      provider: 'perplexity-sonar',
      status: 'complete',
      answer: 'General information',
      citations: [],
    });
    const controller = new CompanionController({ research } as never, new CompanionResearchRateLimiter());

    for (let i = 0; i < 30; i++) {
      await controller.research({ message: 'What can cause headaches?', language: 'en' }, CALLER);
    }
    expect(research).toHaveBeenCalledTimes(30);

    await expect(
      controller.research({ message: 'What can cause headaches?', language: 'en' }, CALLER),
    ).rejects.toMatchObject({ status: 429, response: { code: 'RATE_LIMITED' } });
    expect(research).toHaveBeenCalledTimes(30);
  });

  it('leaves a different caller their own research-rate-limit allowance', async () => {
    const research = vi.fn().mockResolvedValue({
      provider: 'perplexity-sonar',
      status: 'complete',
      answer: 'General information',
      citations: [],
    });
    const controller = new CompanionController({ research } as never, new CompanionResearchRateLimiter());

    for (let i = 0; i < 30; i++) {
      await controller.research({ message: 'What can cause headaches?', language: 'en' }, CALLER);
    }
    const result = await controller.research(
      { message: 'What can cause headaches?', language: 'en' },
      { ip: '5.6.7.8' },
    );
    expect(result.research?.status).toBe('complete');
  });
});
