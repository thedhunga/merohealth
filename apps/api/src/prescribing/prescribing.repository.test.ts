import { describe, expect, it } from 'vitest';
import { PrescribingRepository } from './prescribing.repository.js';

describe('PrescribingRepository', () => {
  it('starts empty', () => {
    expect(new PrescribingRepository().list()).toEqual([]);
  });

  it('finds a saved prescription by id and returns null for an unknown one', () => {
    const repository = new PrescribingRepository();
    const prescription = {
      id: 'rx-1',
      patientId: 'patient-1',
      clinicianId: 'clinician-1',
      encounterId: 'enc-1',
      status: 'DRAFT' as const,
      lines: [],
      safetyCheckStatus: null,
      safetyFindings: [],
      signedAttestation: null,
      signedAt: null,
      voidedAt: null,
      voidReason: null,
      createdAt: '2026-08-10T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z',
      version: 1,
    };

    repository.save(prescription);

    expect(repository.find('rx-1')).toEqual(prescription);
    expect(repository.find('missing')).toBeNull();
  });

  it('lists only the requested patient when patientId is given', () => {
    const repository = new PrescribingRepository();
    const base = {
      status: 'DRAFT' as const,
      lines: [],
      safetyCheckStatus: null,
      safetyFindings: [],
      signedAttestation: null,
      signedAt: null,
      voidedAt: null,
      voidReason: null,
      createdAt: '2026-08-10T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z',
      version: 1,
    };
    repository.save({ ...base, id: 'rx-1', patientId: 'patient-1', clinicianId: 'clinician-1', encounterId: 'enc-1' });
    repository.save({ ...base, id: 'rx-2', patientId: 'patient-2', clinicianId: 'clinician-1', encounterId: 'enc-2' });

    expect(repository.list('patient-1').map((prescription) => prescription.id)).toEqual(['rx-1']);
  });
});
