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

export interface ConfirmPatientReportedFactInput {
  kind: TwinFactKind;
  label: string;
  value: string;
  sensitivity: TwinFact['sensitivity'];
}

/**
 * Round four F2 — a self-reported fact becomes a `TwinFact` only at the
 * moment the person explicitly confirms it, never earlier: an anonymous
 * chip tap on the homepage is a hint stored raw
 * (`HistoryMigration.profileSnapshot` in `apps/api`), not this. Codifies the
 * pattern `apps/mobile`'s prompt-card flow already applies inline —
 * `provenance`/`verification` set together as `PATIENT_REPORTED`/
 * `PATIENT_CONFIRMED`, with no separate unverified state to pass through,
 * because the person typing or tapping an answer *is* the confirmation —
 * so the web confirmation flow and any future caller share one definition
 * instead of re-deriving it.
 */
export function confirmPatientReportedFact(id: string, input: ConfirmPatientReportedFactInput, now: string): TwinFact {
  return {
    id,
    kind: input.kind,
    label: input.label,
    value: input.value,
    provenance: 'PATIENT_REPORTED',
    verification: 'PATIENT_CONFIRMED',
    sensitivity: input.sensitivity,
    recordedAt: now,
    version: 1,
  };
}
