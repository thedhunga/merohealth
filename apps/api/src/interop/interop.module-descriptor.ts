import type { ClinicalModuleDescriptor } from '@swasthya/shared-types';
import type { InteropService } from './interop.service.js';

/**
 * clinical-suite.md §2's fault-isolation contract for this module.
 * `requires` stays empty — listing and revoking share links this module has
 * already issued both still work with health-records down, only issuing a
 * new link or resolving one to a bundle is refused — while `degradesWith`
 * names the one real dependency: `HIDE` against `HEALTH_RECORDS`, the same
 * mode `REFERRALS`'/`ENGAGEMENT`'s own descriptors use for the identical
 * "opening a clinical action against a foundation module" shape.
 */
export function createInteropModuleDescriptor(service: InteropService): ClinicalModuleDescriptor {
  return {
    key: 'INTEROP',
    requires: [],
    degradesWith: [{ key: 'HEALTH_RECORDS', mode: 'HIDE' }],
    health: () => service.health(),
  };
}
