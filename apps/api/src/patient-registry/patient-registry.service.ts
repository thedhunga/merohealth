import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { FutureDateOfBirthError, registerPatient, updateDemographics } from '@swasthya/patient-registry';
import type {
  ClinicalModuleHealth,
  PatientDemographics,
  PatientDemographicsPatch,
  PatientRecord,
} from '@swasthya/shared-types';
import { PatientRegistryRepository } from './patient-registry.repository.js';

@Injectable()
export class PatientRegistryService {
  constructor(private readonly repository: PatientRegistryRepository) {}

  register(demographics: PatientDemographics): PatientRecord {
    return this.repository.save(
      this.#runTransition(() => registerPatient(randomUUID(), demographics, new Date().toISOString())),
    );
  }

  get(id: string): PatientRecord {
    const record = this.repository.find(id);
    if (!record) throw new NotFoundException(`No patient ${id}`);
    return record;
  }

  updateDemographics(id: string, updates: PatientDemographicsPatch): PatientRecord {
    return this.repository.save(
      this.#runTransition(() => updateDemographics(this.get(id), updates, new Date().toISOString())),
    );
  }

  list(): PatientRecord[] {
    return this.repository.list();
  }

  /**
   * clinical-suite.md §2's `ModuleDescriptor.health()`. The in-memory
   * repository has no failure mode of its own, so this always reports UP —
   * kept as a real method rather than a constant so a future Prisma-backed
   * repository's own connectivity check replaces only this one line, not
   * every caller of it (the module descriptor, the health endpoint below).
   */
  health(): Promise<ClinicalModuleHealth> {
    return Promise.resolve({ status: 'UP' });
  }

  /**
   * `registerPatient`/`updateDemographics` both throw `FutureDateOfBirthError`
   * on an impossible birth date — previously uncaught, so it reached the
   * client as a bare, codeless 500 instead of an explainable 400. The same
   * wrong-state-domain-error-reaches-the-client-as-a-bare-500 gap the rest of
   * `apps/api` has already been fixed for module by module; this service was
   * missed because its one domain error is an input-plausibility rejection,
   * not a state-machine transition, but the uncaught shape — and the fix —
   * are identical.
   */
  #runTransition(transition: () => PatientRecord): PatientRecord {
    try {
      return transition();
    } catch (error) {
      if (error instanceof FutureDateOfBirthError) {
        throw new BadRequestException({ code: error.name, message: error.message });
      }
      throw error;
    }
  }
}
