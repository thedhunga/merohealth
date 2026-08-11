import { Injectable } from '@nestjs/common';
import type { Referral } from '@swasthya/shared-types';

/**
 * Process-local stand-in for a real store, same convention
 * `BillingRepository`/`TeleconsultationRepository` already set: the
 * service/controller code above this does not change once the in-memory map
 * is swapped for real persistence, only this file does.
 */
@Injectable()
export class ReferralsRepository {
  readonly #referrals = new Map<string, Referral>();

  save(referral: Referral): Referral {
    this.#referrals.set(referral.id, referral);
    return referral;
  }

  find(id: string): Referral | null {
    return this.#referrals.get(id) ?? null;
  }

  list(patientId?: string): Referral[] {
    return [...this.#referrals.values()].filter((referral) => patientId === undefined || referral.patientId === patientId);
  }
}
