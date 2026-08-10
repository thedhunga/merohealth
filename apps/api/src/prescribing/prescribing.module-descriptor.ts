import type { ClinicalModuleDescriptor } from '@swasthya/shared-types';
import type { PrescribingService } from './prescribing.service.js';

/**
 * clinical-suite.md §2's fault-isolation contract for this module,
 * `requires` stays empty — nothing here throws outright, every dependency
 * degrades — and `degradesWith` names both real dependencies row 6's own
 * notes describe: `CLINICAL_CHARTING` (`HIDE`, the same mode row 4's own
 * descriptor uses for the one action gated on it — opening a prescription
 * against an encounter) and `MEDICATION_SAFETY` (`MANUAL`, §2's own worked
 * example verbatim: signing still succeeds, recording that it happened
 * without an automated check rather than refusing or silently skipping
 * one).
 */
export function createPrescribingModuleDescriptor(service: PrescribingService): ClinicalModuleDescriptor {
  return {
    key: 'PRESCRIBING',
    requires: [],
    degradesWith: [
      { key: 'CLINICAL_CHARTING', mode: 'HIDE' },
      { key: 'MEDICATION_SAFETY', mode: 'MANUAL' },
    ],
    health: () => service.health(),
  };
}
