import { Injectable } from '@nestjs/common';
import type { CredentialingApplication } from '@swasthya/shared-types';

/**
 * Who touched a credentialing application and when — identity-and-credentialing.md
 * §3 ("reviewer actions are audited") and §4 ("every read of an evidence image
 * is logged"). Kept local to `apps/api` rather than added to
 * `packages/credentialing`: §5's module boundary names that package's scope as
 * "council registry, application state machine, review queue, badge rules"
 * only — auditing who acted is a side effect of the API layer, the same
 * "domain records the decision, a repository layer executes side effects"
 * split `health-records`/`devices` already established.
 */
export interface CredentialingAuditEntry {
  id: string;
  applicationId: string;
  actorId: string;
  actorRole: 'CLINICAL_REVIEWER';
  action: 'EVIDENCE_READ' | 'REVIEW_STARTED' | 'APPLICATION_APPROVED' | 'APPLICATION_REJECTED';
  occurredAt: string;
}

/**
 * Process-local stand-in for a real store, same convention `RecordsRepository`
 * already set: the service/controller code above this does not change once
 * the in-memory maps are swapped for real persistence, only this file does.
 */
@Injectable()
export class CredentialingRepository {
  readonly #applications = new Map<string, CredentialingApplication>();
  readonly #auditEntries: CredentialingAuditEntry[] = [];

  save(application: CredentialingApplication): CredentialingApplication {
    this.#applications.set(application.id, application);
    return application;
  }

  find(id: string): CredentialingApplication | null {
    return this.#applications.get(id) ?? null;
  }

  /** One applicant has at most one application in flight — a resubmission reuses it rather than forking a duplicate. */
  findByApplicant(applicantId: string): CredentialingApplication | null {
    return [...this.#applications.values()].find((application) => application.applicantId === applicantId) ?? null;
  }

  list(): CredentialingApplication[] {
    return [...this.#applications.values()];
  }

  appendAuditEntry(entry: CredentialingAuditEntry): void {
    this.#auditEntries.push(entry);
  }

  listAuditEntries(applicationId: string): CredentialingAuditEntry[] {
    return this.#auditEntries
      .filter((entry) => entry.applicationId === applicationId)
      .toSorted((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  }
}
