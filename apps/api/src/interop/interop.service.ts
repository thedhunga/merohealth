import { randomUUID } from 'node:crypto';
import { BadRequestException, GoneException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import {
  issueShareLink,
  resolveSharedBundle,
  revokeShareLink,
  ShareLinkError,
  ShareLinkNotActiveError,
  type FhirBundle,
  type ShareLink,
} from '@swasthya/interop';
import type { ClinicalModuleHealth } from '@swasthya/shared-types';
import { RecordsService } from '../records/records.service.js';
import { InteropRepository } from './interop.repository.js';

export interface IssueShareLinkInput {
  documentIds: readonly string[];
  ttlSeconds: number;
}

/**
 * clinical-suite.md capability map row 17: "Interoperability, CCDA, HL7,
 * FHIR ... Already queued in the platform vision." `RecordsService` is
 * injected as its public port, per §2 rule 3 (never a module's repository)
 * — the same pattern `ReferralsService`/`EngagementService` already
 * established for resolving against a foundation module. `@swasthya/interop`
 * supplies every real rule (FHIR mapping, the trusted-only filter, the
 * expiry/revocation state machine); this service's own job is ownership
 * checks, id/token generation and persistence — the same split
 * `RecordsService` itself draws against `@swasthya/health-records`.
 */
@Injectable()
export class InteropService {
  constructor(
    private readonly repository: InteropRepository,
    private readonly records: RecordsService,
  ) {}

  /**
   * The one action gated on health-records, the same `HIDE` shape
   * `ReferralsService.requestReferral` uses for clinical-charting: refuses
   * outright rather than issuing a link this module cannot verify actually
   * scopes to the caller's own documents.
   */
  async issueShareLink(ownerId: string, input: IssueShareLinkInput): Promise<ShareLink> {
    await this.#assertHealthRecordsAvailable();
    // Every documentId must resolve through health-records' own port and
    // belong to the caller — the same "belongs to someone else 404s like it
    // doesn't exist" rule `RecordsService.#requireObservation` uses, so a
    // guessed or leaked id from another owner's record can never be scoped
    // into a share link.
    for (const documentId of input.documentIds) {
      const document = this.records.getDocument(documentId);
      if (document.ownerId !== ownerId) {
        throw new NotFoundException(`No document ${documentId}`);
      }
    }

    try {
      const link = issueShareLink({
        id: randomUUID(),
        token: randomUUID(),
        ownerId,
        documentIds: input.documentIds,
        createdAt: new Date().toISOString(),
        ttlSeconds: input.ttlSeconds,
      });
      return this.repository.save(link);
    } catch (error) {
      if (error instanceof ShareLinkError) {
        throw new BadRequestException({ code: error.name, message: error.message });
      }
      throw error;
    }
  }

  listShareLinks(ownerId: string): readonly ShareLink[] {
    return this.repository.listForOwner(ownerId);
  }

  /**
   * Never touches health-records — the scope was fixed at issue time and
   * revoking only changes this module's own record of the link, the same
   * "terminal transitions don't re-depend on the foundation that opened the
   * record" property `ReferralsService.cancelReferral` already established.
   */
  revokeShareLink(id: string, ownerId: string): ShareLink {
    const link = this.#requireOwnedLink(id, ownerId);
    return this.repository.save(revokeShareLink(link, new Date().toISOString()));
  }

  /**
   * Resolves a bearer token to the FHIR bundle it grants — deliberately no
   * ownership check against a caller identity, because a share link's whole
   * purpose is letting someone with no Mero Health account (a clinician in a
   * consultation room) read it. The token itself is the credential.
   * Re-derives the bundle from health-records on every call, per
   * `resolveSharedBundle`'s own doc comment, so this is gated the same as
   * issuing: a link cannot be read while the record it points at cannot be
   * verified fresh.
   */
  async resolveSharedBundle(token: string): Promise<FhirBundle> {
    await this.#assertHealthRecordsAvailable();
    const link = this.repository.findByToken(token);
    if (!link) throw new NotFoundException('No share link for this token');

    try {
      const documents = this.records.listDocuments(link.ownerId);
      const observations = this.records.listObservationsForOwner(link.ownerId);
      return resolveSharedBundle(link, new Date().toISOString(), documents, observations);
    } catch (error) {
      if (error instanceof ShareLinkNotActiveError) {
        throw new GoneException(error.message);
      }
      throw error;
    }
  }

  #requireOwnedLink(id: string, ownerId: string): ShareLink {
    const link = this.repository.find(id);
    if (!link || link.ownerId !== ownerId) {
      throw new NotFoundException(`No share link ${id}`);
    }
    return link;
  }

  async #assertHealthRecordsAvailable(): Promise<void> {
    const health = await this.records.health();
    if (health.status === 'DOWN') {
      throw new ServiceUnavailableException(
        'Interop unavailable: health-records is down (clinical-suite.md capability map row 17)',
      );
    }
  }

  /**
   * clinical-suite.md §2's `ModuleDescriptor.health()`. Reports this
   * module's own condition only — its degradation against health-records is
   * computed separately, by `resolveAvailability`.
   */
  health(): Promise<ClinicalModuleHealth> {
    return Promise.resolve({ status: 'UP' });
  }
}
