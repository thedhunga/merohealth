import { Injectable } from '@nestjs/common';
import type { HealthDocument, HealthObservation } from '@swasthya/shared-types';

/**
 * Process-local stand-in for the Prisma-backed store the next queue item
 * builds. Keeping the repository behind this same shape now means the records
 * module's service/controller code does not change when the in-memory maps
 * are swapped for real persistence — only this file does.
 */
@Injectable()
export class RecordsRepository {
  readonly #documents = new Map<string, HealthDocument>();
  readonly #observations = new Map<string, HealthObservation>();

  saveDocument(document: HealthDocument): HealthDocument {
    this.#documents.set(document.id, document);
    return document;
  }

  findDocument(id: string): HealthDocument | null {
    return this.#documents.get(id) ?? null;
  }

  listDocuments(ownerId: string): HealthDocument[] {
    return [...this.#documents.values()].filter((document) => document.ownerId === ownerId);
  }

  saveObservation(observation: HealthObservation): HealthObservation {
    this.#observations.set(observation.id, observation);
    return observation;
  }

  findObservation(id: string): HealthObservation | null {
    return this.#observations.get(id) ?? null;
  }

  listObservationsForOwner(ownerId: string): HealthObservation[] {
    return [...this.#observations.values()].filter((observation) => observation.ownerId === ownerId);
  }

  listObservationsForDocument(documentId: string): HealthObservation[] {
    return [...this.#observations.values()].filter(
      (observation) => observation.documentId === documentId,
    );
  }
}
