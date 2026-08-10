import { Injectable } from '@nestjs/common';
import type { ClinicalSummaryItem, ClinicalSummaryKind } from '@swasthya/shared-types';

/**
 * Process-local stand-in for a real store, same convention
 * `ClinicalChartingRepository`/`SchedulingRepository` already set: the
 * service/controller code above this does not change once the in-memory map
 * is swapped for real persistence, only this file does.
 */
@Injectable()
export class ClinicalSummaryRepository {
  readonly #items = new Map<string, ClinicalSummaryItem>();

  save(item: ClinicalSummaryItem): ClinicalSummaryItem {
    this.#items.set(item.id, item);
    return item;
  }

  find(id: string): ClinicalSummaryItem | null {
    return this.#items.get(id) ?? null;
  }

  list(patientId?: string, kind?: ClinicalSummaryKind): ClinicalSummaryItem[] {
    return [...this.#items.values()]
      .filter((item) => patientId === undefined || item.patientId === patientId)
      .filter((item) => kind === undefined || item.kind === kind);
  }
}
