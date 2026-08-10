import type { ClinicalSummaryItem } from '@swasthya/shared-types';
import { describe, expect, it } from 'vitest';
import { ClinicalSummaryRepository } from './clinical-summary.repository.js';

function makeItem(overrides: Partial<ClinicalSummaryItem> = {}): ClinicalSummaryItem {
  return {
    id: 'item-1',
    patientId: 'patient-1',
    kind: 'ALLERGY',
    label: 'Penicillin',
    value: 'Rash',
    status: 'ACTIVE',
    provenance: 'PATIENT_REPORTED',
    verification: 'UNVERIFIED',
    authoredByEncounterId: null,
    authoredByClinicianId: null,
    recordedAt: '2026-08-09T00:00:00.000Z',
    updatedAt: '2026-08-09T00:00:00.000Z',
    version: 1,
    ...overrides,
  };
}

describe('ClinicalSummaryRepository', () => {
  it('round-trips a saved item by id', () => {
    const repository = new ClinicalSummaryRepository();
    repository.save(makeItem());

    expect(repository.find('item-1')?.label).toBe('Penicillin');
    expect(repository.find('missing')).toBeNull();
  });

  it('overwrites rather than duplicates on a second save with the same id', () => {
    const repository = new ClinicalSummaryRepository();
    repository.save(makeItem({ version: 1 }));
    repository.save(makeItem({ version: 2, status: 'RESOLVED' }));

    expect(repository.list()).toHaveLength(1);
    expect(repository.find('item-1')?.status).toBe('RESOLVED');
  });

  it('filters by patientId and kind independently', () => {
    const repository = new ClinicalSummaryRepository();
    repository.save(makeItem({ id: 'item-1', patientId: 'patient-1', kind: 'ALLERGY' }));
    repository.save(makeItem({ id: 'item-2', patientId: 'patient-1', kind: 'MEDICATION' }));
    repository.save(makeItem({ id: 'item-3', patientId: 'patient-2', kind: 'ALLERGY' }));

    expect(repository.list('patient-1').map((i) => i.id).toSorted()).toEqual(['item-1', 'item-2']);
    expect(repository.list(undefined, 'ALLERGY').map((i) => i.id).toSorted()).toEqual(['item-1', 'item-3']);
    expect(repository.list('patient-1', 'MEDICATION').map((i) => i.id)).toEqual(['item-2']);
    expect(repository.list().map((i) => i.id).toSorted()).toEqual(['item-1', 'item-2', 'item-3']);
  });
});
