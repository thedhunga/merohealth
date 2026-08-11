import type { ClinicalModuleDescriptor } from '@swasthya/shared-types';
import type { ImmunizationService } from './immunization.service.js';

/**
 * clinical-suite.md §2's fault-isolation contract for this module.
 * `requires` stays empty — the immunization list still reads and accepts
 * patient-reported records with clinical-charting down, just with
 * clinician-administered recording unavailable — while `degradesWith` names
 * exactly what capability map row 18 needs: the one action here that
 * touches clinical-charting at all, the same shape row 4's
 * `createClinicalSummaryModuleDescriptor` already established.
 */
export function createImmunizationModuleDescriptor(service: ImmunizationService): ClinicalModuleDescriptor {
  return {
    key: 'IMMUNIZATION',
    requires: [],
    degradesWith: [{ key: 'CLINICAL_CHARTING', mode: 'HIDE' }],
    health: () => service.health(),
  };
}
