import type { EngagementMessage, EngagementMessageStatus, QueueEngagementMessageInput } from '@swasthya/shared-types';

/* ------------------------------------------------------------------ *
 * Engagement
 *
 * clinical-suite.md capability map row 15: "Patient messaging, reminders
 * ... SMS/WhatsApp. QUEUE_AND_RETRY by nature." Pure domain layer only,
 * matching every sibling clinical-suite module's own split — see
 * `apps/api/src/engagement/engagement.service.ts` for how `patientId` is
 * resolved through `patient-registry`'s port and how delivery is actually
 * attempted through `EngagementDeliveryProvider`. Nothing in this file
 * calls a provider or a clock; every function is a pure transition on
 * already-known data.
 *
 * The lifecycle is QUEUED -> SENT (terminal) or QUEUED -> FAILED, with
 * FAILED reachable back to QUEUED through `retryMessage`. See
 * `shared-types`' own header comment on this section for why there is no
 * DELIVERED status.
 * ------------------------------------------------------------------ */

/** Reused by `markSent`/`markFailed`: both are only valid from QUEUED. */
export class EngagementMessageNotQueuedError extends Error {
  constructor(id: string, status: EngagementMessageStatus) {
    super(`Engagement message ${id} is ${status}, not QUEUED — a delivery attempt can only be recorded once`);
    this.name = 'EngagementMessageNotQueuedError';
  }
}

export class EngagementMessageNotFailedError extends Error {
  constructor(id: string, status: EngagementMessageStatus) {
    super(`Engagement message ${id} is ${status}, not FAILED — only a failed message can be retried`);
    this.name = 'EngagementMessageNotFailedError';
  }
}

export function queueMessage(
  id: string,
  patientId: string,
  phone: string,
  input: QueueEngagementMessageInput,
  now: string,
): EngagementMessage {
  return {
    id,
    patientId,
    phone,
    channel: input.channel,
    kind: input.kind,
    body: input.body,
    status: 'QUEUED',
    attemptCount: 0,
    sentAt: null,
    failedAt: null,
    failureReason: null,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

function assertQueued(message: EngagementMessage): void {
  if (message.status !== 'QUEUED') throw new EngagementMessageNotQueuedError(message.id, message.status);
}

/** Records a successful delivery attempt. Terminal — a SENT message has no further transition. */
export function markSent(message: EngagementMessage, now: string): EngagementMessage {
  assertQueued(message);
  return {
    ...message,
    status: 'SENT',
    sentAt: now,
    attemptCount: message.attemptCount + 1,
    updatedAt: now,
    version: message.version + 1,
  };
}

export function markFailed(message: EngagementMessage, reason: string, now: string): EngagementMessage {
  assertQueued(message);
  return {
    ...message,
    status: 'FAILED',
    failedAt: now,
    failureReason: reason,
    attemptCount: message.attemptCount + 1,
    updatedAt: now,
    version: message.version + 1,
  };
}

/**
 * Requeues a FAILED message so a new delivery attempt can be made — see
 * `apps/api/src/engagement/engagement.service.ts`'s `retryMessage`, which
 * calls this and then immediately attempts delivery again, exactly like
 * `queueMessage` does the first time. `attemptCount` is not incremented
 * here; it only advances when `markSent`/`markFailed` records the attempt
 * itself.
 */
export function retryMessage(message: EngagementMessage, now: string): EngagementMessage {
  if (message.status !== 'FAILED') throw new EngagementMessageNotFailedError(message.id, message.status);
  return {
    ...message,
    status: 'QUEUED',
    failedAt: null,
    failureReason: null,
    updatedAt: now,
    version: message.version + 1,
  };
}
