import { describe, expect, it } from 'vitest';
import { CompanionController } from './companion.controller.js';

describe('CompanionController', () => {
  it('does not generate after emergency routing', () => {
    const result = new CompanionController().assess({ message: 'I cannot breathe', language: 'en' });
    expect(result.assessment.interruptConversation).toBe(true);
    expect(result.generatedAnswer).toBeNull();
  });
});
