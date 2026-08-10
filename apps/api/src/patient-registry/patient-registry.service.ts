import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { registerPatient, updateDemographics } from '@swasthya/patient-registry';
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
    return this.repository.save(registerPatient(randomUUID(), demographics, new Date().toISOString()));
  }

  get(id: string): PatientRecord {
    const record = this.repository.find(id);
    if (!record) throw new NotFoundException(`No patient ${id}`);
    return record;
  }

  updateDemographics(id: string, updates: PatientDemographicsPatch): PatientRecord {
    return this.repository.save(updateDemographics(this.get(id), updates, new Date().toISOString()));
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
}
