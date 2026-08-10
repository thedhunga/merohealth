import type { ClinicalSummaryItem, DrugInteractionRule } from '@swasthya/shared-types';
import { describe, expect, it } from 'vitest';
import { checkMedicationSafety } from './index.js';

const now = '2026-08-10T09:00:00.000Z';

function item(
  overrides: Partial<ClinicalSummaryItem> & Pick<ClinicalSummaryItem, 'id' | 'kind' | 'label'>,
): ClinicalSummaryItem {
  return {
    patientId: 'patient-1',
    value: '',
    status: 'ACTIVE',
    provenance: 'PATIENT_REPORTED',
    verification: 'UNVERIFIED',
    authoredByEncounterId: null,
    authoredByClinicianId: null,
    recordedAt: now,
    updatedAt: now,
    version: 1,
    ...overrides,
  };
}

describe('checkMedicationSafety', () => {
  it('flags an allergy conflict when the proposed label matches an active allergy', () => {
    const allergy = item({ id: 'allergy-1', kind: 'ALLERGY', label: 'Penicillin' });

    const result = checkMedicationSafety('Penicillin', [allergy], [], []);

    expect(result.findings).toEqual([
      {
        kind: 'ALLERGY_CONFLICT',
        conflictsWithItemId: 'allergy-1',
        detail: 'Patient has an active recorded allergy to "Penicillin"',
      },
    ]);
    expect(result.checked).toBe(true);
    expect(result.interactionRulesConsulted).toBe(0);
  });

  it('matches case-insensitively and after trimming', () => {
    const allergy = item({ id: 'allergy-1', kind: 'ALLERGY', label: '  penicillin  ' });

    expect(checkMedicationSafety('PENICILLIN', [allergy], [], []).findings).toHaveLength(1);
  });

  it('trusts its inputs as already filtered to ACTIVE — status filtering is the API-boundary caller\'s job, per MedicationSafetyService', () => {
    const allergy = item({ id: 'allergy-1', kind: 'ALLERGY', label: 'Penicillin', status: 'RESOLVED' });

    expect(checkMedicationSafety('Penicillin', [allergy], [], []).findings).toEqual([
      {
        kind: 'ALLERGY_CONFLICT',
        conflictsWithItemId: 'allergy-1',
        detail: 'Patient has an active recorded allergy to "Penicillin"',
      },
    ]);
  });

  it('flags duplicate therapy when the proposed label matches an active medication', () => {
    const medication = item({ id: 'med-1', kind: 'MEDICATION', label: 'Metformin' });

    const result = checkMedicationSafety('Metformin', [], [medication], []);

    expect(result.findings).toEqual([
      {
        kind: 'DUPLICATE_THERAPY',
        conflictsWithItemId: 'med-1',
        detail: 'Patient already has an active recorded medication "Metformin"',
      },
    ]);
  });

  it('flags a drug interaction against an active medication, matching either rule direction', () => {
    const medication = item({ id: 'med-1', kind: 'MEDICATION', label: 'Warfarin' });
    const rule: DrugInteractionRule = {
      id: 'rule-1',
      medicationA: 'Warfarin',
      medicationB: 'Ibuprofen',
      detail: 'fixture interaction detail',
    };

    const result = checkMedicationSafety('Ibuprofen', [], [medication], [rule]);

    expect(result.findings).toEqual([
      { kind: 'DRUG_INTERACTION', conflictsWithItemId: 'med-1', detail: 'fixture interaction detail' },
    ]);
    expect(result.interactionRulesConsulted).toBe(1);
  });

  it('reports no findings for an unrelated label against an empty ruleset, and says so honestly via interactionRulesConsulted', () => {
    const result = checkMedicationSafety('Paracetamol', [], [], []);

    expect(result).toEqual({ proposedLabel: 'Paracetamol', findings: [], interactionRulesConsulted: 0, checked: true });
  });

  it('can report more than one finding at once', () => {
    const allergy = item({ id: 'allergy-1', kind: 'ALLERGY', label: 'Penicillin' });
    const medication = item({ id: 'med-1', kind: 'MEDICATION', label: 'Penicillin' });

    const result = checkMedicationSafety('Penicillin', [allergy], [medication], []);

    expect(result.findings.map((finding) => finding.kind)).toEqual(['ALLERGY_CONFLICT', 'DUPLICATE_THERAPY']);
  });
});
