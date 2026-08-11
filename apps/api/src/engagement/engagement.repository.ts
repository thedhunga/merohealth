import { Injectable } from '@nestjs/common';
import type { EngagementMessage } from '@swasthya/shared-types';

/**
 * Process-local stand-in for a real store, the same convention
 * `ReferralsRepository`/`BillingRepository` already set: the
 * service/controller code above this does not change once the in-memory map
 * is swapped for real persistence, only this file does.
 */
@Injectable()
export class EngagementRepository {
  readonly #messages = new Map<string, EngagementMessage>();

  save(message: EngagementMessage): EngagementMessage {
    this.#messages.set(message.id, message);
    return message;
  }

  find(id: string): EngagementMessage | null {
    return this.#messages.get(id) ?? null;
  }

  list(patientId?: string): EngagementMessage[] {
    return [...this.#messages.values()].filter((message) => patientId === undefined || message.patientId === patientId);
  }
}
