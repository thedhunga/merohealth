import { describe, expect, it } from 'vitest';
import { BillingRepository } from './billing.repository.js';

const base = {
  status: 'DRAFT' as const,
  lineItems: [],
  issuedAt: null,
  payment: null,
  voidedAt: null,
  voidReason: null,
  createdAt: '2026-08-11T00:00:00.000Z',
  updatedAt: '2026-08-11T00:00:00.000Z',
  version: 1,
};

describe('BillingRepository', () => {
  it('starts empty', () => {
    expect(new BillingRepository().list()).toEqual([]);
  });

  it('finds a saved invoice by id and returns null for an unknown one', () => {
    const repository = new BillingRepository();
    const invoice = { ...base, id: 'inv-1', patientId: 'patient-1', clinicianId: 'clinician-1', encounterId: 'enc-1' };

    repository.save(invoice);

    expect(repository.find('inv-1')).toEqual(invoice);
    expect(repository.find('missing')).toBeNull();
  });

  it('lists only the requested patient when patientId is given', () => {
    const repository = new BillingRepository();
    repository.save({ ...base, id: 'inv-1', patientId: 'patient-1', clinicianId: 'clinician-1', encounterId: 'enc-1' });
    repository.save({ ...base, id: 'inv-2', patientId: 'patient-2', clinicianId: 'clinician-1', encounterId: 'enc-2' });

    expect(repository.list('patient-1').map((invoice) => invoice.id)).toEqual(['inv-1']);
  });
});
