import { Injectable } from '@nestjs/common';
import type { VerificationRequest } from '@swasthya/shared-types';

/**
 * Who touched a verification request and when — identity-and-credentialing.md
 * §4: "access to the review queue is a distinct role... and every read of an
 * evidence image is logged." Kept local to `apps/api`, not
 * `packages/identity`, mirroring `CredentialingAuditEntry`'s own reasoning:
 * auditing who acted is a side effect of the API layer, not the evidence
 * lifecycle itself.
 */
export interface IdentityAuditEntry {
  id: string;
  verificationId: string;
  actorId: string;
  actorRole: 'IDENTITY_REVIEWER';
  action: 'EVIDENCE_READ' | 'REVIEW_STARTED' | 'VERIFICATION_APPROVED' | 'VERIFICATION_REJECTED';
  occurredAt: string;
}

/**
 * Process-local stand-in for a real store, the same convention
 * `CredentialingRepository` already set: the service/controller code above
 * this does not change once the in-memory maps are swapped for real
 * persistence, only this file does.
 */
@Injectable()
export class IdentityRepository {
  readonly #requests = new Map<string, VerificationRequest>();
  readonly #auditEntries: IdentityAuditEntry[] = [];

  save(request: VerificationRequest): VerificationRequest {
    this.#requests.set(request.id, request);
    return request;
  }

  find(id: string): VerificationRequest | null {
    return this.#requests.get(id) ?? null;
  }

  /** One person has at most one verification request in flight — a resubmission after rejection reuses it rather than forking a duplicate. */
  findByOwner(ownerId: string): VerificationRequest | null {
    return [...this.#requests.values()].find((request) => request.ownerId === ownerId) ?? null;
  }

  list(): VerificationRequest[] {
    return [...this.#requests.values()];
  }

  appendAuditEntry(entry: IdentityAuditEntry): void {
    this.#auditEntries.push(entry);
  }

  listAuditEntries(verificationId: string): IdentityAuditEntry[] {
    return this.#auditEntries
      .filter((entry) => entry.verificationId === verificationId)
      .toSorted((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  }
}
