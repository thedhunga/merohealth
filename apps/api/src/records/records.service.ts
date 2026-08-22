import { randomUUID } from 'node:crypto';
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { checkQuota } from '@swasthya/entitlements';
import {
  buildTimeline,
  confirmObservation,
  correctObservation,
  rejectObservation,
  transitionDocument,
  type TimelineEntry,
} from '@swasthya/health-records';
import { assertPlacementAllowed, type DocumentBlob, type HealthDocumentStore } from '@swasthya/storage-adapters';
import type {
  ClinicalModuleHealth,
  HealthDocument,
  HealthDocumentKind,
  HealthObservation,
} from '@swasthya/shared-types';
import { FreeTierSubscriptionResolver, SUBSCRIPTION_RESOLVER, type SubscriptionResolver } from '../entitlements/subscription-resolver.js';
import { RECORD_EXTRACTION_SERVICE, type RecordExtractionService } from './record-extraction.service.js';
import { RecordsRepository } from './records.repository.js';

/** DI token for the storage port — bound to a concrete adapter in RecordsModule. */
export const HEALTH_DOCUMENT_STORE = 'HEALTH_DOCUMENT_STORE';

export interface CaptureDocumentInput {
  ownerId: string;
  filename: string;
  kind: HealthDocumentKind;
  title: string;
  documentDate: string | null;
  sensitivity: HealthDocument['sensitivity'];
  clientEncrypted: boolean;
  contentType: string | null;
  bytes: Uint8Array;
  pageCount: number;
}

@Injectable()
export class RecordsService {
  constructor(
    private readonly repository: RecordsRepository,
    @Inject(HEALTH_DOCUMENT_STORE) private readonly store: HealthDocumentStore,
    // Optional so every existing `new RecordsService(repository, store)` call
    // across the other clinical modules' own test suites keeps working
    // unchanged — extraction simply never runs for them, the same as it
    // never ran before this feature existed. `RecordsModule` always binds a
    // real implementation in production.
    @Optional()
    @Inject(RECORD_EXTRACTION_SERVICE)
    private readonly extraction?: RecordExtractionService,
    // Same "@Optional() with a default" shape as `retryLimiter` in
    // `RecordsController` — Nest injects the real bound resolver in
    // production, and every existing `new RecordsService(repository, store)`
    // call across this file's own test suite keeps working unchanged,
    // getting the same FREE-everyone stand-in `RecordsModule` binds.
    @Optional()
    @Inject(SUBSCRIPTION_RESOLVER)
    private readonly subscriptions: SubscriptionResolver = new FreeTierSubscriptionResolver(),
  ) {}

  /**
   * Uploads the bytes through the injected storage port, then records the
   * document only once a ref exists. `assertPlacementAllowed` is called here
   * rather than trusted to the adapter, because every adapter behind this
   * port — hosted or bring-your-own — must honour the same invariant: a
   * backend we do not control never receives readable health data.
   */
  async captureDocument(input: CaptureDocumentInput): Promise<HealthDocument> {
    const blob: DocumentBlob = {
      bytes: input.bytes,
      contentType: input.clientEncrypted ? null : input.contentType,
      clientEncrypted: input.clientEncrypted,
    };
    assertPlacementAllowed(this.store.capabilities().backend, blob);

    const ref = await this.store.put({ ownerId: input.ownerId, filename: input.filename, blob });

    let stored: HealthDocument;
    try {
      stored = this.#saveWithinQuota(input, ref);
    } catch (error) {
      // The upload above already landed on the backend; a rejected save must
      // not leave it there paying for storage nobody can ever list or reach.
      // The quota error is what the caller needs to see, so a delete failure
      // is swallowed rather than replacing it — cleanup is best-effort, the
      // rejection itself is not.
      await this.store.delete(ref).catch(() => undefined);
      throw error;
    }

    return this.#extractIfEligible(stored, input);
  }

  /**
   * `EntitlementsGuard.canActivate` already checked `DOCUMENTS_STORED`
   * before this request reached the controller — but that check runs before
   * `captureDocument`'s own `await this.store.put(...)`, and several
   * concurrent captures from the same owner can all read the same
   * under-the-limit count in that gap and all pass it, oversold by roughly
   * however many are in flight at once. This recheck runs synchronously, no
   * `await` between reading `listDocuments().length` and calling
   * `saveDocument` — one uninterruptible tick of the event loop — so
   * whichever request's continuation the scheduler happens to run first
   * always sees every prior one's save, and the limit holds regardless of
   * how many captures raced to get here.
   */
  #saveWithinQuota(input: CaptureDocumentInput, ref: HealthDocument['ref']): HealthDocument {
    const tier = this.subscriptions.resolveTier(input.ownerId);
    const used = this.repository.listDocuments(input.ownerId).length;
    const verdict = checkQuota(tier, 'DOCUMENTS_STORED', used);
    if (!verdict.allowed) {
      throw new ForbiddenException({ code: 'QUOTA_EXCEEDED', ...verdict });
    }

    return this.repository.saveDocument({
      id: randomUUID(),
      ownerId: input.ownerId,
      kind: input.kind,
      status: 'STORED',
      ref,
      title: input.title,
      documentDate: input.documentDate,
      capturedAt: new Date().toISOString(),
      sensitivity: input.sensitivity,
      clientEncrypted: input.clientEncrypted,
      pageCount: input.pageCount,
    });
  }

  /**
   * A client-encrypted document (bring-your-own storage) is unreadable here
   * by design — "extraction for those runs on-device" — and a non-image
   * document has nothing this extractor can read either, so both stay
   * `STORED` exactly as capture always left them before this method existed.
   * Everything else attempts extraction — see `#runExtraction`, shared with
   * `retryExtraction` below since a retry is the identical operation against
   * bytes fetched back from the store instead of bytes already in hand.
   */
  async #extractIfEligible(document: HealthDocument, input: CaptureDocumentInput): Promise<HealthDocument> {
    if (!this.extraction || input.clientEncrypted || !input.contentType?.startsWith('image/')) {
      return document;
    }
    return this.#runExtraction(document, input.contentType, input.bytes);
  }

  /**
   * Manual retry for a document stuck on `EXTRACTION_FAILED` — the edge the
   * transition table has always allowed (`EXTRACTION_FAILED → EXTRACTING`)
   * but nothing called until now. Only `EXTRACTION_FAILED` is accepted: the
   * table also permits `STORED`/`AWAITING_CONFIRMATION`/`CONFIRMED` →
   * `EXTRACTING`, but re-running extraction on a document that never failed
   * is a different feature this endpoint does not claim to offer. Bytes are
   * never re-uploaded — `document.ref` is the durable pointer `store.get`
   * resolves back to the same blob `captureDocument` originally stored.
   */
  async retryExtraction(documentId: string, ownerId: string): Promise<HealthDocument> {
    const document = this.repository.findDocument(documentId);
    if (!document || document.ownerId !== ownerId) {
      throw new NotFoundException(`No document ${documentId}`);
    }
    if (document.status !== 'EXTRACTION_FAILED') {
      throw new BadRequestException({
        code: 'DOCUMENT_NOT_EXTRACTION_FAILED',
        message: `Document ${documentId} is not in EXTRACTION_FAILED (currently ${document.status})`,
      });
    }
    if (!this.extraction) {
      throw new BadRequestException({
        code: 'EXTRACTION_NOT_CONFIGURED',
        message: 'No extraction provider is configured',
      });
    }

    const blob = await this.store.get(document.ref);
    const contentType = document.ref.contentType ?? blob.contentType;
    if (!contentType) {
      // Can only happen if a document reached EXTRACTION_FAILED without ever
      // being image content — not reachable through #extractIfEligible's own
      // gate, but checked explicitly rather than trusted, since this method
      // is a second, independent entry point into the same state.
      throw new BadRequestException({
        code: 'DOCUMENT_NOT_EXTRACTABLE',
        message: `Document ${documentId} has no readable content type`,
      });
    }

    return this.#runExtraction(document, contentType, blob.bytes);
  }

  /**
   * Transitions `document` into `EXTRACTING` and attempts the provider call,
   * landing on `AWAITING_CONFIRMATION`/`CONFIRMED`/`EXTRACTION_FAILED` per
   * the outcome. Synchronous and inline because there is no job queue in
   * this deployment yet: the caller's next paint already carries the
   * outcome rather than a polling round-trip.
   *
   * `setup-required` (no provider configured) and `unavailable` (the
   * provider was reached and failed) both land on `EXTRACTION_FAILED` here —
   * from the person's chair both mean "no draft yet, try again later", and
   * `EXTRACTION_FAILED → EXTRACTING` is exactly the edge `retryExtraction`
   * uses to try again. Nothing here can lose the document itself: every
   * branch below returns a document that is already durably saved.
   */
  async #runExtraction(document: HealthDocument, contentType: string, bytes: Uint8Array): Promise<HealthDocument> {
    const extracting = this.repository.saveDocument(transitionDocument(document, 'EXTRACTING'));

    let result: Awaited<ReturnType<RecordExtractionService['extract']>>;
    try {
      result = await this.extraction!.extract({ contentType, bytes });
    } catch {
      return this.repository.saveDocument(transitionDocument(extracting, 'EXTRACTION_FAILED'));
    }

    if (result.status !== 'complete') {
      return this.repository.saveDocument(transitionDocument(extracting, 'EXTRACTION_FAILED'));
    }
    if (result.observations.length === 0) {
      // `EXTRACTING` can only lead to `AWAITING_CONFIRMATION`/`EXTRACTION_FAILED`/`DELETED` —
      // there is no direct `EXTRACTING → CONFIRMED` edge in the transition
      // table — so an empty result passes through `AWAITING_CONFIRMATION`
      // for an instant before landing on `CONFIRMED`: correct, since there
      // is nothing left to confirm, and consistent with the table rather
      // than a special-cased shortcut around it.
      return this.repository.saveDocument(
        transitionDocument(transitionDocument(extracting, 'AWAITING_CONFIRMATION'), 'CONFIRMED'),
      );
    }

    const extractionRunId = randomUUID();
    const effectiveAt = extracting.documentDate ?? extracting.capturedAt;
    for (const draft of result.observations) {
      this.repository.saveObservation({
        id: randomUUID(),
        documentId: extracting.id,
        ownerId: extracting.ownerId,
        code: draft.code,
        codeSystem: draft.codeSystem,
        labelNe: draft.labelNe,
        labelEn: draft.labelEn,
        value: draft.value,
        unit: draft.unit,
        referenceRange: null,
        abnormalFlag: null,
        effectiveAt,
        status: 'DRAFT',
        provenance: 'DOCUMENT_EXTRACTED',
        confidence: draft.confidence,
        extractionRunId,
      });
    }

    return this.repository.saveDocument(transitionDocument(extracting, 'AWAITING_CONFIRMATION'));
  }

  listDocuments(ownerId: string): HealthDocument[] {
    return this.repository.listDocuments(ownerId);
  }

  /**
   * The port `interop` calls to assemble a FHIR export bundle — see
   * `InteropService.issueShareLink`/`resolveSharedBundle`. Returns every
   * status, DRAFT included: `buildFhirExportBundle` in `@swasthya/interop`
   * is the one that filters to CONFIRMED/CORRECTED, the same
   * "the owning module hands over raw data, the consuming module enforces
   * the trust boundary" split `timeline()` already draws for its own caller.
   */
  listObservationsForOwner(ownerId: string): HealthObservation[] {
    return this.repository.listObservationsForOwner(ownerId);
  }

  /**
   * Resolves a document reference by opaque id — the port
   * `clinical-charting` calls to validate a document it wants to attach to
   * an encounter actually exists, the same "resolve the opaque id through
   * the owning module's port" shape `PatientRegistryService.get` already
   * gives `scheduling`.
   */
  getDocument(documentId: string): HealthDocument {
    const document = this.repository.findDocument(documentId);
    if (!document) throw new NotFoundException(`No document ${documentId}`);
    return document;
  }

  /**
   * `ownerId` is not just a filter here — it is the only access-control this
   * app has until real auth lands, so a document that exists but belongs to
   * someone else must 404 exactly like one that does not exist at all, never
   * reveal its observations to the wrong caller.
   */
  listDocumentObservations(documentId: string, ownerId: string): HealthObservation[] {
    const document = this.repository.findDocument(documentId);
    if (!document || document.ownerId !== ownerId) {
      throw new NotFoundException(`No document ${documentId}`);
    }
    return this.repository.listObservationsForDocument(documentId);
  }

  timeline(ownerId: string): readonly TimelineEntry[] {
    return buildTimeline(
      this.repository.listDocuments(ownerId),
      this.repository.listObservationsForOwner(ownerId),
    );
  }

  confirm(observationId: string, ownerId: string): HealthObservation {
    return this.repository.saveObservation(
      confirmObservation(this.#requireObservation(observationId, ownerId)),
    );
  }

  correct(
    observationId: string,
    ownerId: string,
    value: string,
    unit: string | null | undefined,
  ): HealthObservation {
    const observation = this.#requireObservation(observationId, ownerId);
    return this.repository.saveObservation(
      correctObservation(observation, value, unit === undefined ? observation.unit : unit),
    );
  }

  reject(observationId: string, ownerId: string): HealthObservation {
    return this.repository.saveObservation(
      rejectObservation(this.#requireObservation(observationId, ownerId)),
    );
  }

  /**
   * Same "belongs to someone else 404s like it doesn't exist" rule as
   * `listDocumentObservations` — an observation id leaked or guessed by a
   * caller who isn't its owner must not be confirmable, correctable or
   * rejectable by them.
   */
  #requireObservation(observationId: string, ownerId: string): HealthObservation {
    const observation = this.repository.findObservation(observationId);
    if (!observation || observation.ownerId !== ownerId) {
      throw new NotFoundException(`No observation ${observationId}`);
    }
    return observation;
  }

  /**
   * clinical-suite.md §2's `ModuleDescriptor.health()`, giving `HEALTH_RECORDS`
   * a real descriptor to plug into `@swasthya/module-registry` — the gap the
   * previous ledger entry named ("has never been wired into module-registry
   * with its own descriptor the way patient-registry/scheduling now are").
   * The in-memory/MinIO-backed repository has no failure mode of its own
   * modelled yet, so this always reports UP, same as every other module's
   * health() today.
   */
  health(): Promise<ClinicalModuleHealth> {
    return Promise.resolve({ status: 'UP' });
  }
}
