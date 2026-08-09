import { randomUUID } from 'node:crypto';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  buildTimeline,
  confirmObservation,
  correctObservation,
  rejectObservation,
  type TimelineEntry,
} from '@swasthya/health-records';
import { assertPlacementAllowed, type DocumentBlob, type HealthDocumentStore } from '@swasthya/storage-adapters';
import type {
  ClinicalModuleHealth,
  HealthDocument,
  HealthDocumentKind,
  HealthObservation,
} from '@swasthya/shared-types';
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

  listDocuments(ownerId: string): HealthDocument[] {
    return this.repository.listDocuments(ownerId);
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

  listDocumentObservations(documentId: string): HealthObservation[] {
    if (!this.repository.findDocument(documentId)) {
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

  confirm(observationId: string): HealthObservation {
    return this.repository.saveObservation(confirmObservation(this.#requireObservation(observationId)));
  }

  correct(observationId: string, value: string, unit: string | null | undefined): HealthObservation {
    const observation = this.#requireObservation(observationId);
    return this.repository.saveObservation(
      correctObservation(observation, value, unit === undefined ? observation.unit : unit),
    );
  }

  reject(observationId: string): HealthObservation {
    return this.repository.saveObservation(rejectObservation(this.#requireObservation(observationId)));
  }

  #requireObservation(observationId: string): HealthObservation {
    const observation = this.repository.findObservation(observationId);
    if (!observation) throw new NotFoundException(`No observation ${observationId}`);
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
