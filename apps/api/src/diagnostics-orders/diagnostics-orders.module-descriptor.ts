import type { ClinicalModuleDescriptor } from '@swasthya/shared-types';
import type { DiagnosticsOrdersService } from './diagnostics-orders.service.js';

/**
 * clinical-suite.md §2's fault-isolation contract for this module.
 * `requires` stays empty — recording and releasing results still work with
 * clinical-charting down, only placing a new order is refused — while
 * `degradesWith` names the one real dependency: `HIDE` against
 * `CLINICAL_CHARTING`, the same mode row 6's own descriptor uses for the
 * identical "opening a clinical action against an encounter" shape.
 */
export function createDiagnosticsOrdersModuleDescriptor(service: DiagnosticsOrdersService): ClinicalModuleDescriptor {
  return {
    key: 'DIAGNOSTICS_ORDERS',
    requires: [],
    degradesWith: [{ key: 'CLINICAL_CHARTING', mode: 'HIDE' }],
    health: () => service.health(),
  };
}
