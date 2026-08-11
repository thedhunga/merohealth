import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { findDirectoryEntity } from '@swasthya/care-directory';
import { acceptReferral, cancelReferral, completeReferral, declineReferral, requestReferral } from '@swasthya/referrals';
import type { ClinicalModuleHealth, Referral, RequestReferralInput } from '@swasthya/shared-types';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { ReferralsRepository } from './referrals.repository.js';

/**
 * clinical-suite.md capability map row 12: "Referral management ... Pairs
 * with care-directory." `ClinicalChartingService` is injected as its public
 * port, per §2 rule 3 (never a module's repository) — the same pattern
 * `BillingService`/`DiagnosticsOrdersService` already established to resolve
 * the encounter a referral is requested against. `findDirectoryEntity` is a
 * plain function import, not a DI service — `care-directory` is a static,
 * in-memory package with no health state of its own (see
 * `apps/api/src/directory.controller.ts` for the same direct-import
 * convention), so it is not a `degradesWith` edge either.
 */
@Injectable()
export class ReferralsService {
  constructor(
    private readonly repository: ReferralsRepository,
    private readonly charting: ClinicalChartingService,
  ) {}

  /**
   * The one action gated on clinical-charting, the same `HIDE` shape
   * `BillingService.openInvoice` already uses: refuses the call outright
   * rather than requesting a referral this module cannot attribute to a
   * real encounter.
   */
  async requestReferral(encounterId: string, input: RequestReferralInput): Promise<Referral> {
    await this.assertClinicalChartingAvailable();
    // encounterId resolved through clinical-charting's own port (§2 rule 1)
    // — throws NotFoundException for an id that was never opened there, and
    // supplies patientId so a caller cannot claim a patient that disagrees
    // with the encounter the referral is nested under.
    const encounter = this.charting.getEncounter(encounterId);
    // referredToEntityId resolved through care-directory's own port — 404s
    // for an id no fictional demonstration entity holds, the same
    // "existence checked before it is trusted" reasoning encounterId above
    // gets.
    if (!findDirectoryEntity(input.referredToEntityId)) {
      throw new NotFoundException(`No directory entity ${input.referredToEntityId}`);
    }
    return this.repository.save(
      requestReferral(randomUUID(), encounter.patientId, encounterId, input, new Date().toISOString()),
    );
  }

  private async assertClinicalChartingAvailable(): Promise<void> {
    const health = await this.charting.health();
    if (health.status === 'DOWN') {
      throw new ServiceUnavailableException(
        'Referrals unavailable: clinical-charting is down (clinical-suite.md capability map row 12)',
      );
    }
  }

  getReferral(id: string): Referral {
    const referral = this.repository.find(id);
    if (!referral) throw new NotFoundException(`No referral ${id}`);
    return referral;
  }

  listReferrals(patientId?: string): Referral[] {
    return this.repository.list(patientId);
  }

  /**
   * Never touches clinical-charting — accepting, declining, completing and
   * cancelling all stay available for every referral already requested,
   * even if clinical-charting goes down after the fact.
   */
  acceptReferral(id: string): Referral {
    return this.repository.save(acceptReferral(this.getReferral(id), new Date().toISOString()));
  }

  declineReferral(id: string, reason: string): Referral {
    return this.repository.save(declineReferral(this.getReferral(id), reason, new Date().toISOString()));
  }

  completeReferral(id: string): Referral {
    return this.repository.save(completeReferral(this.getReferral(id), new Date().toISOString()));
  }

  cancelReferral(id: string, reason: string): Referral {
    return this.repository.save(cancelReferral(this.getReferral(id), reason, new Date().toISOString()));
  }

  /**
   * clinical-suite.md §2's `ModuleDescriptor.health()`. Reports this
   * module's own condition only — its degradation against clinical-charting
   * is computed separately, by `resolveAvailability`.
   */
  health(): Promise<ClinicalModuleHealth> {
    return Promise.resolve({ status: 'UP' });
  }
}
