import type { TwinFact, TwinFactKind } from '@swasthya/shared-types';
export interface TwinPrompt {
  id: string; kind: TwinFactKind; questionNe: string; questionEn: string;
  whyNe: string; whyEn: string; optional: boolean;
}
export const twinPrompts: readonly TwinPrompt[] = [
  { id: 'allergy', kind: 'ALLERGY', questionNe: 'तपाईंलाई कुनै औषधि वा खानेकुराको एलर्जी छ?', questionEn: 'Do you have any medicine or food allergies?', whyNe: 'उपचार र औषधि सुरक्षित बनाउन मद्दत गर्छ।', whyEn: 'This helps make care and medicines safer.', optional: true },
  { id: 'medication', kind: 'MEDICATION', questionNe: 'अहिले नियमित लिइरहनुभएको औषधि छ?', questionEn: 'Do you currently take any regular medicines?', whyNe: 'औषधि दोहोरिन वा असर जुध्न नदिन मद्दत गर्छ।', whyEn: 'This helps avoid duplicate or conflicting medicines.', optional: true },
  { id: 'emergency-contact', kind: 'EMERGENCY_CONTACT', questionNe: 'आपतकालमा सम्पर्क गर्ने व्यक्ति को हुनुहुन्छ?', questionEn: 'Who may we contact in an emergency?', whyNe: 'तपाईंले अनुमति दिएपछि मात्र प्रयोग हुन्छ।', whyEn: 'Used only after you give permission.', optional: true },
  { id: 'goal', kind: 'HEALTH_GOAL', questionNe: 'अहिले तपाईंको मुख्य स्वास्थ्य लक्ष्य के हो?', questionEn: 'What is your main health goal right now?', whyNe: 'साथीले उपयोगी अर्को कदम सुझाउन मद्दत गर्छ।', whyEn: 'This helps the companion suggest a useful next step.', optional: true },
];
export function getNextPrompt(facts: readonly TwinFact[], skipped: readonly string[]): TwinPrompt | null {
  const answered = new Set(facts.map((fact) => fact.kind));
  return twinPrompts.find((prompt) => !answered.has(prompt.kind) && !skipped.includes(prompt.id)) ?? null;
}
export function calculateContextualProgress(facts: readonly TwinFact[]): number {
  const kinds = new Set(twinPrompts.map((prompt) => prompt.kind));
  return Math.round((new Set(facts.filter((fact) => kinds.has(fact.kind)).map((fact) => fact.kind)).size / kinds.size) * 100);
}
