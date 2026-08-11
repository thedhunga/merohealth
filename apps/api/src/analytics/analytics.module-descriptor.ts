import type { ClinicalModuleDescriptor } from '@swasthya/shared-types';
import type { AnalyticsService } from './analytics.service.js';

/**
 * clinical-suite.md §2's fault-isolation contract for this module.
 * `requires` stays empty — no dependency ever throws outright, all five
 * degrade — and `degradesWith` names the five sources each summary reads
 * from: `PATIENT_REGISTRY` (row 1), `SCHEDULING` (row 2), `BILLING`
 * (row 10), `REFERRALS` (row 12) and `ENGAGEMENT` (row 15). All `HIDE`, the
 * same population-health (row 13) reasoning: a summary computed from an
 * incomplete read would misreport a count, and there is no honest partial
 * number to show in its place — so the affected section refuses rather than
 * silently reporting a total that is actually a subset.
 */
export function createAnalyticsModuleDescriptor(service: AnalyticsService): ClinicalModuleDescriptor {
  return {
    key: 'ANALYTICS',
    requires: [],
    degradesWith: [
      { key: 'PATIENT_REGISTRY', mode: 'HIDE' },
      { key: 'SCHEDULING', mode: 'HIDE' },
      { key: 'BILLING', mode: 'HIDE' },
      { key: 'REFERRALS', mode: 'HIDE' },
      { key: 'ENGAGEMENT', mode: 'HIDE' },
    ],
    health: () => service.health(),
  };
}
