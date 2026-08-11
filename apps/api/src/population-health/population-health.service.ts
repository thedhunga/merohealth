import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { buildConditionRegistry, buildRecallList } from '@swasthya/population-health';
import type {
  ClinicalModuleHealth,
  ClinicalSummaryKind,
  PopulationHealthRecallEntry,
  PopulationHealthRegistryEntry,
} from '@swasthya/shared-types';
import { ClinicalSummaryService } from '../clinical-summary/clinical-summary.service.js';
import { SchedulingService } from '../scheduling/scheduling.service.js';

/**
 * clinical-suite.md capability map row 13: "Reads from other modules; never
 * writes to them." This service owns no repository — both dependencies are
 * injected as their public ports, per §2 rule 3, and every method here is a
 * read followed by a pure computation in `@swasthya/population-health`,
 * never a write to either.
 */
@Injectable()
export class PopulationHealthService {
  constructor(
    private readonly clinicalSummary: ClinicalSummaryService,
    private readonly scheduling: SchedulingService,
  ) {}

  /**
   * `HIDE`-shaped: refuses outright rather than computing a registry from a
   * list this module cannot currently trust as complete, the same
   * `requestReferral`/`openInvoice` reasoning applied to a read instead of
   * a write.
   */
  async buildRegistry(kind: ClinicalSummaryKind, label: string): Promise<PopulationHealthRegistryEntry[]> {
    await this.assertClinicalSummaryAvailable();
    return buildConditionRegistry(this.clinicalSummary.listItems(undefined, kind), kind, label);
  }

  /** Depends on both clinical-summary (via buildRegistry) and scheduling. */
  async buildRecall(kind: ClinicalSummaryKind, label: string, asOf: string): Promise<PopulationHealthRecallEntry[]> {
    const registry = await this.buildRegistry(kind, label);
    await this.assertSchedulingAvailable();
    return buildRecallList(registry, this.scheduling.list(), asOf);
  }

  private async assertClinicalSummaryAvailable(): Promise<void> {
    const health = await this.clinicalSummary.health();
    if (health.status === 'DOWN') {
      throw new ServiceUnavailableException(
        'Population health unavailable: clinical-summary is down (clinical-suite.md capability map row 13)',
      );
    }
  }

  private async assertSchedulingAvailable(): Promise<void> {
    const health = await this.scheduling.health();
    if (health.status === 'DOWN') {
      throw new ServiceUnavailableException(
        'Recall lists unavailable: scheduling is down (clinical-suite.md capability map row 13)',
      );
    }
  }

  /**
   * clinical-suite.md §2's `ModuleDescriptor.health()`. This module has no
   * storage of its own to report on, so it always reports UP — its
   * degradation against clinical-summary/scheduling is computed separately,
   * by `resolveAvailability`.
   */
  health(): Promise<ClinicalModuleHealth> {
    return Promise.resolve({ status: 'UP' });
  }
}
