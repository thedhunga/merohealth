import { describe, expect, it } from 'vitest';
import { assessSafety, getSafetyTemplate } from './index';
describe('clinical safety routing', () => {
  it.each([
    ['I cannot breathe', 'EMERGENCY_NOW'], ['मलाई सास फेर्न गाह्रो छ', 'EMERGENCY_NOW'],
    ['ma saas ferna sakdina', 'EMERGENCY_NOW'], ['I want to kill myself', 'MENTAL_HEALTH_CONCERN'],
    ['मलाई आत्महत्या गर्न मन लाग्छ', 'MENTAL_HEALTH_CONCERN'],
    ['I am pregnant and have heavy bleeding', 'MATERNAL_CONCERN'],
    ['My baby is blue and not breathing', 'PEDIATRIC_CONCERN'],
  ])('interrupts for %s', (message, expected) => {
    const result = assessSafety(message);
    expect(result.riskLevel).toBe(expected);
    expect(result.interruptConversation).toBe(true);
    expect(result.templateId).toBeTruthy();
  });
  it('never fabricates a template', () => expect(getSafetyTemplate('made-up', 'en')).toBeNull());
});
