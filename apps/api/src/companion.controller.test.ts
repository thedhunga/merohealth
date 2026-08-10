import { describe, expect, it, vi } from 'vitest';
import { CompanionController } from './companion.controller.js';

describe('CompanionController', () => {
  it('does not generate after emergency routing', () => {
    const result = new CompanionController().assess({
      message: 'I cannot breathe',
      language: 'en',
    });
    expect(result.assessment.interruptConversation).toBe(true);
    expect(result.generatedAnswer).toBeNull();
  });

  it('never sends an emergency question to external research', async () => {
    const research = vi.fn();
    const controller = new CompanionController({ research } as never);
    const result = await controller.research({ message: 'I cannot breathe', language: 'en' });
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
    const result = await new CompanionController({ research } as never).research({
      message: 'What can cause headaches?',
      language: 'en',
    });
    expect(result.research?.status).toBe('complete');
    expect(research).toHaveBeenCalledOnce();
  });
});
