import { describe, expect, it } from 'vitest';
import type { PatientRecord } from '@swasthya/shared-types';
import { PatientRegistryRepository } from './patient-registry.repository.js';

function makeRecord(overrides: Partial<PatientRecord> = {}): PatientRecord {
  return {
    id: 'patient-1',
    demographics: {
      displayName: 'Sita Rai',
      dateOfBirth: '1990-04-12',
      sex: 'FEMALE',
      phone: '9800000000',
      preferredLocale: 'ne',
    },
    createdAt: '2026-08-09T00:00:00.000Z',
    updatedAt: '2026-08-09T00:00:00.000Z',
    version: 1,
    ...overrides,
  };
}

describe('PatientRegistryRepository', () => {
  it('round-trips a saved patient by id', () => {
    const repository = new PatientRegistryRepository();
    repository.save(makeRecord());

    expect(repository.find('patient-1')?.demographics.displayName).toBe('Sita Rai');
    expect(repository.find('missing')).toBeNull();
  });

  it('overwrites rather than duplicates on a second save with the same id', () => {
    const repository = new PatientRegistryRepository();
    repository.save(makeRecord({ version: 1 }));
    repository.save(makeRecord({ version: 2, demographics: { ...makeRecord().demographics, phone: '9811111111' } }));

    expect(repository.list()).toHaveLength(1);
    expect(repository.find('patient-1')?.demographics.phone).toBe('9811111111');
  });

  it('lists every registered patient', () => {
    const repository = new PatientRegistryRepository();
    repository.save(makeRecord({ id: 'patient-1' }));
    repository.save(makeRecord({ id: 'patient-2' }));

    expect(repository.list().map((record) => record.id).toSorted()).toEqual(['patient-1', 'patient-2']);
  });
});
