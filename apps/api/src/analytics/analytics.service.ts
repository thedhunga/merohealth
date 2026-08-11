import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { buildPatientRegistrySummary, buildSchedulingSummary } from '@swasthya/analytics';
import type { ClinicalModuleHealth, PatientRegistrySummary, SchedulingSummary } from '@swasthya/shared-types';
import { PatientRegistryService } from '../patient-registry/patient-registry.service.js';
import { SchedulingService } from '../scheduling/scheduling.service.js';

/**
 * clinical-suite.md capability map row 14: "Read-only replica. Must never
 * slow the clinical path." This service owns no repository — both
 * dependencies are injected as their public ports, per §2 rule 3 — and every
 * method here is a read followed by a pure computation in
 * `@swasthya/analytics`, never a write to either. Unlike population-health
 * (row 13), each summary depends on exactly one source module, so one
 * source being down only withholds the summary derived from it, never a
 * summary that has nothing to do with it.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly patients: PatientRegistryService,
    private readonly scheduling: SchedulingService,
  ) {}

  async patientRegistrySummary(): Promise<PatientRegistrySummary> {
    await this.assertPatientRegistryAvailable();
    return buildPatientRegistrySummary(this.patients.list());
  }

  async schedulingSummary(): Promise<SchedulingSummary> {
    await this.assertSchedulingAvailable();
    return buildSchedulingSummary(this.scheduling.list());
  }

  private async assertPatientRegistryAvailable(): Promise<void> {
    const health = await this.patients.health();
    if (health.status === 'DOWN') {
      throw new ServiceUnavailableException(
        'Analytics unavailable: patient-registry is down (clinical-suite.md capability map row 14)',
      );
    }
  }

  private async assertSchedulingAvailable(): Promise<void> {
    const health = await this.scheduling.health();
    if (health.status === 'DOWN') {
      throw new ServiceUnavailableException(
        'Analytics unavailable: scheduling is down (clinical-suite.md capability map row 14)',
      );
    }
  }

  /**
   * clinical-suite.md §2's `ModuleDescriptor.health()`. This module has no
   * storage of its own to report on, so it always reports UP — its
   * degradation against patient-registry/scheduling is computed separately,
   * by `resolveAvailability`.
   */
  health(): Promise<ClinicalModuleHealth> {
    return Promise.resolve({ status: 'UP' });
  }
}
