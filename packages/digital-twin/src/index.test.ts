import { describe, expect, it } from 'vitest';
import type { TwinFact } from '@swasthya/shared-types';
import { calculateContextualProgress, getNextPrompt } from './index';
const allergy: TwinFact = { id: '1', kind: 'ALLERGY', label: 'Allergy', value: 'None known', provenance: 'PATIENT_REPORTED', verification: 'PATIENT_CONFIRMED', sensitivity: 'SENSITIVE', recordedAt: '2026-08-06T00:00:00Z', version: 1 };
describe('progressive health twin', () => {
  it('asks one question at a time', () => expect(getNextPrompt([allergy], [])?.id).toBe('medication'));
  it('respects skip', () => expect(getNextPrompt([], ['allergy'])?.id).toBe('medication'));
  it('uses contextual progress', () => expect(calculateContextualProgress([allergy])).toBe(25));
});
