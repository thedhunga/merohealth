import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  buildBillingSummary,
  buildEngagementSummary,
  buildImmunizationSummary,
  buildPatientRegistrySummary,
  buildReferralsSummary,
  buildSchedulingSummary,
} from '@swasthya/analytics';
import type {
  BillingSummary,
  ClinicalModuleHealth,
  EngagementSummary,
  ImmunizationSummary,
  PatientRegistrySummary,
  ReferralsSummary,
  SchedulingSummary,
} from '@swasthya/shared-types';
import { BillingService } from '../billing/billing.service.js';
import { EngagementService } from '../engagement/engagement.service.js';
import { ImmunizationService } from '../immunization/immunization.service.js';
import { PatientRegistryService } from '../patient-registry/patient-registry.service.js';
import { ReferralsService } from '../referrals/referrals.service.js';
import { SchedulingService } from '../scheduling/scheduling.service.js';

/**
 * clinical-suite.md capability map row 14: "Read-only replica. Must never
 * slow the clinical path." This service owns no repository — every
 * dependency is injected as its public port, per §2 rule 3 — and every
 * method here is a read followed by a pure computation in
 * `@swasthya/analytics`, never a write to any of them. Unlike population-health
 * (row 13), each summary depends on exactly one source module, so one
 * source being down only withholds the summary derived from it, never a
 * summary that has nothing to do with it.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly patients: PatientRegistryService,
    private readonly scheduling: SchedulingService,
    private readonly billing: BillingService,
    private readonly referrals: ReferralsService,
    private readonly engagement: EngagementService,
    private readonly immunization: ImmunizationService,
  ) {}

  async patientRegistrySummary(): Promise<PatientRegistrySummary> {
    await this.assertPatientRegistryAvailable();
    return buildPatientRegistrySummary(this.patients.list());
  }

  async schedulingSummary(): Promise<SchedulingSummary> {
    await this.assertSchedulingAvailable();
    return buildSchedulingSummary(this.scheduling.list());
  }

  async billingSummary(): Promise<BillingSummary> {
    await this.assertBillingAvailable();
    return buildBillingSummary(this.billing.listInvoices());
  }

  async referralsSummary(): Promise<ReferralsSummary> {
    await this.assertReferralsAvailable();
    return buildReferralsSummary(this.referrals.listReferrals());
  }

  async engagementSummary(): Promise<EngagementSummary> {
    await this.assertEngagementAvailable();
    return buildEngagementSummary(this.engagement.listMessages());
  }

  async immunizationSummary(): Promise<ImmunizationSummary> {
    await this.assertImmunizationAvailable();
    return buildImmunizationSummary(this.immunization.listRecords());
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

  private async assertBillingAvailable(): Promise<void> {
    const health = await this.billing.health();
    if (health.status === 'DOWN') {
      throw new ServiceUnavailableException(
        'Analytics unavailable: billing is down (clinical-suite.md capability map row 14)',
      );
    }
  }

  private async assertReferralsAvailable(): Promise<void> {
    const health = await this.referrals.health();
    if (health.status === 'DOWN') {
      throw new ServiceUnavailableException(
        'Analytics unavailable: referrals is down (clinical-suite.md capability map row 14)',
      );
    }
  }

  private async assertEngagementAvailable(): Promise<void> {
    const health = await this.engagement.health();
    if (health.status === 'DOWN') {
      throw new ServiceUnavailableException(
        'Analytics unavailable: engagement is down (clinical-suite.md capability map row 14)',
      );
    }
  }

  private async assertImmunizationAvailable(): Promise<void> {
    const health = await this.immunization.health();
    if (health.status === 'DOWN') {
      throw new ServiceUnavailableException(
        'Analytics unavailable: immunization is down (clinical-suite.md capability map row 14)',
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
