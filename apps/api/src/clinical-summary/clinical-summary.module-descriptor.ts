import type { ClinicalModuleDescriptor } from '@swasthya/shared-types';
import type { ClinicalSummaryService } from './clinical-summary.service.js';

/**
 * clinical-suite.md §2's fault-isolation contract for this module.
 * `requires` stays empty — the problem/allergy/medication list still reads
 * and accepts patient-reported items with clinical-charting down, just
 * with clinician authorship unavailable — while `degradesWith` names
 * exactly what capability map row 4 says: this module "extends
 * digital-twin with clinician-authored provenance," and that authoring
 * step is the one thing here that touches clinical-charting at all.
 */
export function createClinicalSummaryModuleDescriptor(service: ClinicalSummaryService): ClinicalModuleDescriptor {
  return {
    key: 'CLINICAL_SUMMARY',
    requires: [],
    degradesWith: [{ key: 'CLINICAL_CHARTING', mode: 'HIDE' }],
    health: () => service.health(),
  };
}
