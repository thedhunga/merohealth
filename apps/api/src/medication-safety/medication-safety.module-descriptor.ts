import type { ClinicalModuleDescriptor } from '@swasthya/shared-types';
import type { MedicationSafetyService } from './medication-safety.service.js';

/**
 * clinical-suite.md §2's fault-isolation contract for this module.
 * `requires` stays empty — checking never throws outright, it degrades —
 * and `degradesWith` names the one dependency `checkMedication` actually
 * has: clinical-summary, the owner of the allergy/medication data this
 * module reads. `MANUAL`, not `HIDE` or `READ_ONLY`, because there is no
 * surface to hide (API-only, like clinical-summary itself) and no stale
 * data to serve read-only — the honest behaviour, per §2's own worked
 * example, is telling the caller checks were not run.
 */
export function createMedicationSafetyModuleDescriptor(service: MedicationSafetyService): ClinicalModuleDescriptor {
  return {
    key: 'MEDICATION_SAFETY',
    requires: [],
    degradesWith: [{ key: 'CLINICAL_SUMMARY', mode: 'MANUAL' }],
    health: () => service.health(),
  };
}
