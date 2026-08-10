import { buildModuleRegistry, collectHealthStates, resolveAvailability } from '@swasthya/module-registry';
import { describe, expect, it } from 'vitest';
import { CredentialingController } from '../credentialing/credentialing.controller.js';
import { CredentialingRepository } from '../credentialing/credentialing.repository.js';
import { CredentialingService } from '../credentialing/credentialing.service.js';
import { createPatientRegistryModuleDescriptor } from './patient-registry.module-descriptor.js';
import { PatientRegistryRepository } from './patient-registry.repository.js';
import { PatientRegistryService } from './patient-registry.service.js';

/**
 * clinical-suite.md §2's own deliverable for every module in this section:
 * "a test that forces the module DOWN and asserts the rest of the system
 * still works." Patient-registry has no `requires`/`degradesWith` edges
 * pointing *at* it yet — it is the first module in the section, so no other
 * clinical-suite module exists to register against it (that starts with
 * `scheduling`, the next queue item). "The rest of the system" here is
 * therefore the sibling `apps/api` modules that already exist: credentialing
 * shares nothing with patient-registry — no singleton store, no
 * process-wide state — so an outage in one must not reach the other. This
 * is §2 rule 5, "the shell renders around holes," demonstrated against a
 * real failure rather than asserted in prose.
 */
class BrokenPatientRegistryRepository extends PatientRegistryRepository {
  override save(): never {
    throw new Error('simulated store outage');
  }

  override find(): never {
    throw new Error('simulated store outage');
  }

  override list(): never {
    throw new Error('simulated store outage');
  }
}

const validDemographics = {
  displayName: 'Sita Rai',
  dateOfBirth: '1990-04-12',
  sex: 'FEMALE' as const,
  phone: '9800000000',
  preferredLocale: 'ne' as const,
};

const validCredentialingSubmission = {
  applicantId: 'applicant-1',
  council: 'NMC' as const,
  registrationNumber: 'NMC-12345',
  certificateImageRef: 'ref:certificate',
  identityImageRef: 'ref:identity',
};

describe('patient-registry fault isolation', () => {
  it('a broken patient-registry store does not take an unrelated clinical-suite module down with it', () => {
    const brokenPatients = new PatientRegistryService(new BrokenPatientRegistryRepository());
    expect(() => brokenPatients.register(validDemographics)).toThrow('simulated store outage');

    const credentialing = new CredentialingController(new CredentialingService(new CredentialingRepository()));
    const application = credentialing.submit(validCredentialingSubmission);

    expect(application.status).toBe('EVIDENCE_SUBMITTED');
  });

  it('resolveAvailability marks PATIENT_REGISTRY unavailable when its health probe reports DOWN', async () => {
    const healthyDescriptor = createPatientRegistryModuleDescriptor(
      new PatientRegistryService(new PatientRegistryRepository()),
    );
    const forcedDown = {
      ...healthyDescriptor,
      health: () => Promise.resolve({ status: 'DOWN' as const, detail: 'simulated outage' }),
    };

    const registry = buildModuleRegistry([forcedDown]);
    const states = await collectHealthStates(registry);
    const resolved = resolveAvailability(registry, states);

    expect(resolved.get('PATIENT_REGISTRY')).toMatchObject({ available: false, health: 'DOWN' });
  });
});
