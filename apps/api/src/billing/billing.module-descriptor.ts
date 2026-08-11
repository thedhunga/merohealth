import type { ClinicalModuleDescriptor } from '@swasthya/shared-types';
import type { BillingService } from './billing.service.js';

/**
 * clinical-suite.md §2's fault-isolation contract for this module.
 * `requires` stays empty — adding a line item, issuing, recording a
 * payment and voiding all still work with clinical-charting down, only
 * opening a new invoice is refused — while `degradesWith` names the one
 * real dependency: `HIDE` against `CLINICAL_CHARTING`, the same mode rows
 * 6/7's own descriptors use for the identical "opening a clinical action
 * against an encounter" shape.
 */
export function createBillingModuleDescriptor(service: BillingService): ClinicalModuleDescriptor {
  return {
    key: 'BILLING',
    requires: [],
    degradesWith: [{ key: 'CLINICAL_CHARTING', mode: 'HIDE' }],
    health: () => service.health(),
  };
}
