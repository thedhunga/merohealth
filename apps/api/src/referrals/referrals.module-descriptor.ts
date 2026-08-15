import type { ClinicalModuleDescriptor } from '@swasthya/shared-types';
import type { ReferralsService } from './referrals.service.js';

/**
 * clinical-suite.md §2's fault-isolation contract for this module.
 * `requires` stays empty — accepting, declining, completing and cancelling
 * a referral all still work with clinical-charting down, only requesting a
 * new one is refused — while `degradesWith` names the one real dependency:
 * `HIDE` against `CLINICAL_CHARTING`, the same mode rows 6/7/10's own
 * descriptors use for the identical "opening a clinical action against an
 * encounter" shape. `care-directory` is not a dependency here — it is a
 * static, in-memory package with no health state of its own (see
 * `referrals.service.ts`), not a `ClinicalModuleKey`.
 */
export function createReferralsModuleDescriptor(service: ReferralsService): ClinicalModuleDescriptor {
  return {
    key: 'REFERRALS',
    requires: [],
    degradesWith: [{ key: 'CLINICAL_CHARTING', mode: 'HIDE' }],
    health: () => service.health(),
  };
}
