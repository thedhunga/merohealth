import type { ClinicalModuleDescriptor } from '@swasthya/shared-types';
import type { AnalyticsService } from './analytics.service.js';

/**
 * clinical-suite.md §2's fault-isolation contract for this module.
 * `requires` stays empty — neither dependency ever throws outright, both
 * degrade — and `degradesWith` names the two sources each summary reads
 * from: `PATIENT_REGISTRY` (row 1) and `SCHEDULING` (row 2). Both `HIDE`,
 * the same population-health (row 13) reasoning: a summary computed from an
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
    ],
    health: () => service.health(),
  };
}
