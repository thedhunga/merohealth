import type { ClinicalModuleDescriptor } from '@swasthya/shared-types';
import type { TeleconsultationService } from './teleconsultation.service.js';

/**
 * clinical-suite.md §2's fault-isolation contract for this module.
 * `requires` stays empty — starting, completing, cancelling and marking a
 * session no-show all still work with scheduling down, only booking a new
 * session is refused — while `degradesWith` names the one real dependency:
 * `HIDE` against `SCHEDULING`, the same mode row 7's own descriptor uses for
 * the identical "placing a clinical action against a resource booked
 * elsewhere" shape.
 */
export function createTeleconsultationModuleDescriptor(service: TeleconsultationService): ClinicalModuleDescriptor {
  return {
    key: 'TELECONSULTATION',
    requires: [],
    degradesWith: [{ key: 'SCHEDULING', mode: 'HIDE' }],
    health: () => service.health(),
  };
}
