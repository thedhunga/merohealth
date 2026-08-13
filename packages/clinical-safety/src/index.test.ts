import { describe, expect, it } from 'vitest';
import { approvedSafetyTemplates, assessSafety, getSafetyTemplate } from './index';
describe('clinical safety routing', () => {
  it.each([
    ['I cannot breathe', 'EMERGENCY_NOW'], ['मलाई सास फेर्न गाह्रो छ', 'EMERGENCY_NOW'],
    ['ma saas ferna sakdina', 'EMERGENCY_NOW'], ['I have severe chest pain and I am sweating', 'EMERGENCY_NOW'],
    ['I have severe chest pain', 'EMERGENCY_NOW'],
    ['छाती दुखाइ र पसिना आइरहेको छ', 'EMERGENCY_NOW'], ['I want to kill myself', 'MENTAL_HEALTH_CONCERN'],
    ['मलाई आत्महत्या गर्न मन लाग्छ', 'MENTAL_HEALTH_CONCERN'],
    ['I am pregnant and have heavy bleeding', 'MATERNAL_CONCERN'],
    ['I have a severe headache, I am pregnant', 'MATERNAL_CONCERN'],
    ['धेरै रगत बगिरहेको छ, गर्भवती छु', 'MATERNAL_CONCERN'],
    ['My baby is blue and not breathing', 'PEDIATRIC_CONCERN'],
    ['not breathing, my baby is', 'PEDIATRIC_CONCERN'],
    ['दौरा आयो, बच्चालाई', 'PEDIATRIC_CONCERN'],
  ])('interrupts for %s', (message, expected) => {
    const result = assessSafety(message);
    expect(result.riskLevel).toBe(expected);
    expect(result.interruptConversation).toBe(true);
    expect(result.templateId).toBeTruthy();
  });
  it('does not interrupt for a benign message', () => {
    expect(assessSafety('What is a normal blood pressure range?')).toEqual({
      riskLevel: 'CLINICIAN_RECOMMENDED', matchedRuleIds: [], interruptConversation: false,
    });
  });
  it('never fabricates a template', () => expect(getSafetyTemplate('made-up', 'en')).toBeNull());
  it('returns the approved template text for every known id and language', () => {
    for (const templateId of Object.keys(approvedSafetyTemplates) as (keyof typeof approvedSafetyTemplates)[]) {
      for (const language of ['ne', 'en', 'ne-Latn'] as const) {
        expect(getSafetyTemplate(templateId, language)).toBe(approvedSafetyTemplates[templateId][language]);
      }
    }
  });
  it('never leaves a template with identical wording across ne, en and ne-Latn', () => {
    for (const template of Object.values(approvedSafetyTemplates)) {
      expect(template.ne).not.toBe(template.en);
      expect(template['ne-Latn']).not.toBe(template.ne);
      expect(template['ne-Latn']).not.toBe(template.en);
    }
  });
});
