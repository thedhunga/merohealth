import type { ImmunizationRecord } from '@swasthya/shared-types';
import { describe, expect, it } from 'vitest';
import { ImmunizationRepository } from './immunization.repository.js';

function makeRecord(overrides: Partial<ImmunizationRecord> = {}): ImmunizationRecord {
  return {
    id: 'record-1',
    patientId: 'patient-1',
    vaccineName: 'Tetanus toxoid',
    doseNumber: 1,
    administeredOn: '2020-01-15',
    status: 'ACTIVE',
    provenance: 'PATIENT_REPORTED',
    verification: 'UNVERIFIED',
    administeredByEncounterId: null,
    administeredByClinicianId: null,
    voidReason: null,
    recordedAt: '2026-08-11T00:00:00.000Z',
    updatedAt: '2026-08-11T00:00:00.000Z',
    version: 1,
    ...overrides,
  };
}

describe('ImmunizationRepository', () => {
  it('round-trips a saved record by id', () => {
    const repository = new ImmunizationRepository();
    repository.save(makeRecord());

    expect(repository.find('record-1')?.vaccineName).toBe('Tetanus toxoid');
    expect(repository.find('missing')).toBeNull();
  });

  it('overwrites rather than duplicates on a second save with the same id', () => {
    const repository = new ImmunizationRepository();
    repository.save(makeRecord({ version: 1 }));
    repository.save(makeRecord({ version: 2, status: 'VOIDED' }));

    expect(repository.list()).toHaveLength(1);
    expect(repository.find('record-1')?.status).toBe('VOIDED');
  });

  it('filters by patientId', () => {
    const repository = new ImmunizationRepository();
    repository.save(makeRecord({ id: 'record-1', patientId: 'patient-1' }));
    repository.save(makeRecord({ id: 'record-2', patientId: 'patient-1' }));
    repository.save(makeRecord({ id: 'record-3', patientId: 'patient-2' }));

    expect(repository.list('patient-1').map((r) => r.id).toSorted()).toEqual(['record-1', 'record-2']);
    expect(repository.list('patient-2').map((r) => r.id)).toEqual(['record-3']);
    expect(repository.list().map((r) => r.id).toSorted()).toEqual(['record-1', 'record-2', 'record-3']);
  });
});
