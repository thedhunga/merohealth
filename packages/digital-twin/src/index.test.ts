import { describe, expect, it } from 'vitest';
import type { TwinFact } from '@swasthya/shared-types';
import { calculateContextualProgress, confirmPatientReportedFact, getNextPrompt } from './index';
const allergy: TwinFact = { id: '1', kind: 'ALLERGY', label: 'Allergy', value: 'None known', provenance: 'PATIENT_REPORTED', verification: 'PATIENT_CONFIRMED', sensitivity: 'SENSITIVE', recordedAt: '2026-08-06T00:00:00Z', version: 1 };
describe('progressive health twin', () => {
  it('asks one question at a time', () => expect(getNextPrompt([allergy], [])?.id).toBe('medication'));
  it('respects skip', () => expect(getNextPrompt([], ['allergy'])?.id).toBe('medication'));
  it('uses contextual progress', () => expect(calculateContextualProgress([allergy])).toBe(25));
});
describe('confirmPatientReportedFact', () => {
  it('lands as PATIENT_REPORTED/PATIENT_CONFIRMED together — an explicit confirm, not a draft', () => {
    const fact = confirmPatientReportedFact('2', { kind: 'AGE_BAND', label: 'Age range', value: '40to60', sensitivity: 'STANDARD' }, '2026-08-16T00:00:00Z');
    expect(fact).toEqual({
      id: '2',
      kind: 'AGE_BAND',
      label: 'Age range',
      value: '40to60',
      provenance: 'PATIENT_REPORTED',
      verification: 'PATIENT_CONFIRMED',
      sensitivity: 'STANDARD',
      recordedAt: '2026-08-16T00:00:00Z',
      version: 1,
    });
  });
});
