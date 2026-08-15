import { describe, expect, it } from 'vitest';
import { EngagementRepository } from './engagement.repository.js';

const base = {
  phone: '+977-9800000000',
  channel: 'SMS' as const,
  kind: 'REMINDER' as const,
  body: 'Your appointment is tomorrow at 10am.',
  status: 'QUEUED' as const,
  attemptCount: 0,
  sentAt: null,
  failedAt: null,
  failureReason: null,
  createdAt: '2026-08-11T00:00:00.000Z',
  updatedAt: '2026-08-11T00:00:00.000Z',
  version: 1,
};

describe('EngagementRepository', () => {
  it('starts empty', () => {
    expect(new EngagementRepository().list()).toEqual([]);
  });

  it('finds a saved message by id and returns null for an unknown one', () => {
    const repository = new EngagementRepository();
    const message = { ...base, id: 'msg-1', patientId: 'patient-1' };

    repository.save(message);

    expect(repository.find('msg-1')).toEqual(message);
    expect(repository.find('missing')).toBeNull();
  });

  it('lists only the requested patient when patientId is given', () => {
    const repository = new EngagementRepository();
    repository.save({ ...base, id: 'msg-1', patientId: 'patient-1' });
    repository.save({ ...base, id: 'msg-2', patientId: 'patient-2' });

    expect(repository.list('patient-1').map((message) => message.id)).toEqual(['msg-1']);
  });
});
