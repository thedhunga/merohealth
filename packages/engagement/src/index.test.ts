import type { EngagementMessage } from '@swasthya/shared-types';
import { describe, expect, it } from 'vitest';
import {
  EngagementMessageNotFailedError,
  EngagementMessageNotQueuedError,
  markFailed,
  markSent,
  queueMessage,
  retryMessage,
} from './index.js';

const input = { channel: 'SMS' as const, kind: 'REMINDER' as const, body: 'Your appointment is tomorrow at 10am.' };

function makeQueued(): EngagementMessage {
  return queueMessage('msg-1', 'patient-1', '+977-9800000000', input, '2026-08-11T00:00:00.000Z');
}

describe('queueMessage', () => {
  it('builds a QUEUED message at version 1 with no attempt recorded yet', () => {
    const message = makeQueued();

    expect(message).toEqual({
      id: 'msg-1',
      patientId: 'patient-1',
      phone: '+977-9800000000',
      channel: 'SMS',
      kind: 'REMINDER',
      body: 'Your appointment is tomorrow at 10am.',
      status: 'QUEUED',
      attemptCount: 0,
      sentAt: null,
      failedAt: null,
      failureReason: null,
      createdAt: '2026-08-11T00:00:00.000Z',
      updatedAt: '2026-08-11T00:00:00.000Z',
      version: 1,
    });
  });
});

describe('markSent', () => {
  it('records a successful delivery attempt', () => {
    const sent = markSent(makeQueued(), '2026-08-11T00:00:05.000Z');

    expect(sent.status).toBe('SENT');
    expect(sent.sentAt).toBe('2026-08-11T00:00:05.000Z');
    expect(sent.attemptCount).toBe(1);
    expect(sent.version).toBe(2);
  });

  it('refuses to mark an already-sent message sent again', () => {
    const sent = markSent(makeQueued(), '2026-08-11T00:00:05.000Z');

    expect(() => markSent(sent, '2026-08-11T00:00:10.000Z')).toThrow(EngagementMessageNotQueuedError);
  });

  it('refuses to mark a failed message sent', () => {
    const failed = markFailed(makeQueued(), 'gateway timeout', '2026-08-11T00:00:05.000Z');

    expect(() => markSent(failed, '2026-08-11T00:00:10.000Z')).toThrow(EngagementMessageNotQueuedError);
  });
});

describe('markFailed', () => {
  it('records a failed delivery attempt and the reason', () => {
    const failed = markFailed(makeQueued(), 'gateway timeout', '2026-08-11T00:00:05.000Z');

    expect(failed.status).toBe('FAILED');
    expect(failed.failedAt).toBe('2026-08-11T00:00:05.000Z');
    expect(failed.failureReason).toBe('gateway timeout');
    expect(failed.attemptCount).toBe(1);
    expect(failed.version).toBe(2);
  });

  it('refuses to mark an already-sent message failed', () => {
    const sent = markSent(makeQueued(), '2026-08-11T00:00:05.000Z');

    expect(() => markFailed(sent, 'gateway timeout', '2026-08-11T00:00:10.000Z')).toThrow(EngagementMessageNotQueuedError);
  });
});

describe('retryMessage', () => {
  it('requeues a failed message, clearing the failure and keeping the attempt count', () => {
    const failed = markFailed(makeQueued(), 'gateway timeout', '2026-08-11T00:00:05.000Z');

    const requeued = retryMessage(failed, '2026-08-11T00:05:00.000Z');

    expect(requeued.status).toBe('QUEUED');
    expect(requeued.failedAt).toBeNull();
    expect(requeued.failureReason).toBeNull();
    expect(requeued.attemptCount).toBe(1);
    expect(requeued.version).toBe(3);
  });

  it('a requeued message can be sent or fail again, advancing attemptCount further', () => {
    const failed = markFailed(makeQueued(), 'gateway timeout', '2026-08-11T00:00:05.000Z');
    const requeued = retryMessage(failed, '2026-08-11T00:05:00.000Z');

    const sent = markSent(requeued, '2026-08-11T00:05:02.000Z');

    expect(sent.status).toBe('SENT');
    expect(sent.attemptCount).toBe(2);
  });

  it('refuses to retry a message that was never queued to begin with', () => {
    expect(() => retryMessage(makeQueued(), '2026-08-11T00:05:00.000Z')).toThrow(EngagementMessageNotFailedError);
  });

  it('refuses to retry an already-sent message', () => {
    const sent = markSent(makeQueued(), '2026-08-11T00:00:05.000Z');

    expect(() => retryMessage(sent, '2026-08-11T00:05:00.000Z')).toThrow(EngagementMessageNotFailedError);
  });
});
