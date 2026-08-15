import { describe, expect, it } from 'vitest';
import { DiagnosticsOrdersRepository } from './diagnostics-orders.repository.js';

const base = {
  status: 'ORDERED' as const,
  kind: 'LAB' as const,
  testName: 'Fasting blood glucose',
  result: null,
  cancelledAt: null,
  cancelReason: null,
  createdAt: '2026-08-10T00:00:00.000Z',
  updatedAt: '2026-08-10T00:00:00.000Z',
  version: 1,
};

describe('DiagnosticsOrdersRepository', () => {
  it('starts empty', () => {
    expect(new DiagnosticsOrdersRepository().list()).toEqual([]);
  });

  it('finds a saved order by id and returns null for an unknown one', () => {
    const repository = new DiagnosticsOrdersRepository();
    const order = { ...base, id: 'order-1', patientId: 'patient-1', clinicianId: 'clinician-1', encounterId: 'enc-1' };

    repository.save(order);

    expect(repository.find('order-1')).toEqual(order);
    expect(repository.find('missing')).toBeNull();
  });

  it('lists only the requested patient when patientId is given', () => {
    const repository = new DiagnosticsOrdersRepository();
    repository.save({ ...base, id: 'order-1', patientId: 'patient-1', clinicianId: 'clinician-1', encounterId: 'enc-1' });
    repository.save({ ...base, id: 'order-2', patientId: 'patient-2', clinicianId: 'clinician-1', encounterId: 'enc-2' });

    expect(repository.list('patient-1').map((order) => order.id)).toEqual(['order-1']);
  });
});
