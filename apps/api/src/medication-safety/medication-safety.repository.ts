import { Injectable } from '@nestjs/common';
import type { DrugInteractionRule } from '@swasthya/shared-types';

/**
 * Process-local stand-in for a real store, same convention
 * `ClinicalSummaryRepository`/`ClinicalChartingRepository` already set: the
 * service code above this does not change once the in-memory array is
 * swapped for real persistence, only this file does.
 *
 * Empty by design, not by omission. `packages/shared-types`' own comment on
 * `DrugInteractionRule` explains why: populating even one real interaction
 * pair without a licensed source would violate agent-progress.md's "invent
 * no facts" constraint just as surely as a fake statistic would. No
 * `addInteractionRule` method exists yet either — nothing in this codebase
 * has a real dataset to load through it, and building ingestion for data
 * that does not exist would be speculative scope, not this task.
 */
@Injectable()
export class MedicationSafetyRepository {
  readonly #interactionRules: DrugInteractionRule[] = [];

  listInteractionRules(): readonly DrugInteractionRule[] {
    return this.#interactionRules;
  }
}
