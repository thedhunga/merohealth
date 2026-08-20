import { buildModuleRegistry, collectHealthStates, resolveAvailability } from '@swasthya/module-registry';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { createClinicalChartingModuleDescriptor } from '../clinical-charting/clinical-charting.module-descriptor.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { RecordsRepository } from '../records/records.repository.js';
import { createHealthRecordsModuleDescriptor } from '../records/records.module-descriptor.js';
import { RecordsService } from '../records/records.service.js';
import { ImmunizationController } from './immunization.controller.js';
import { createImmunizationModuleDescriptor } from './immunization.module-descriptor.js';
import { ImmunizationRepository } from './immunization.repository.js';
import { ImmunizationService } from './immunization.service.js';

const currentUser: CurrentUserResult = {
  subjectId: 'patient-1',
  user: { id: 'patient-1', phone: '9812345678', role: 'PATIENT', locale: 'ne', assuranceLevel: 'REGISTERED' },
  patientProfileId: null,
  assuranceLevel: 'REGISTERED',
};

const patientReportedBody = { vaccineName: 'Tetanus toxoid', doseNumber: 1, administeredOn: '2020-01-15' };
const clinicianBody = { clinicianId: 'clinician-1', vaccineName: 'Hepatitis B', doseNumber: 2, administeredOn: '2026-08-11' };

function buildCharting(): { charting: ClinicalChartingService; documents: RecordsService } {
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  return { charting, documents };
}

/** §2 rule 5, "the shell renders around holes," same shape `clinical-summary`'s own `BrokenClinicalSummaryRepository` already uses. */
class BrokenImmunizationRepository extends ImmunizationRepository {
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

describe('immunization fault isolation', () => {
  it('a broken immunization store does not take clinical-charting down with it', () => {
    const { charting } = buildCharting();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });

    const brokenImmunization = new ImmunizationController(
      new ImmunizationService(new BrokenImmunizationRepository(), charting),
    );
    expect(() => brokenImmunization.recordPatientReported(currentUser, patientReportedBody)).toThrow(
      'simulated store outage',
    );

    expect(charting.getEncounter(encounter.id).id).toBe(encounter.id);
  });

  it('resolveAvailability marks IMMUNIZATION available but HIDE-degraded when CLINICAL_CHARTING is DOWN', async () => {
    const { charting, documents } = buildCharting();
    const immunization = new ImmunizationService(new ImmunizationRepository(), charting);

    // clinical-charting's own descriptor declares a degradesWith on
    // HEALTH_RECORDS, so buildModuleRegistry needs that descriptor
    // registered too — the same three-descriptor shape
    // clinical-summary.fault-isolation.test.ts already needs.
    const recordsDescriptor = createHealthRecordsModuleDescriptor(documents);
    const chartingDescriptor = createClinicalChartingModuleDescriptor(charting);
    const forcedDownChartingDescriptor = {
      ...chartingDescriptor,
      health: () => Promise.resolve({ status: 'DOWN' as const, detail: 'simulated outage' }),
    };
    const immunizationDescriptor = createImmunizationModuleDescriptor(immunization);

    const registry = buildModuleRegistry([recordsDescriptor, forcedDownChartingDescriptor, immunizationDescriptor]);
    const states = await collectHealthStates(registry);
    const resolved = resolveAvailability(registry, states);

    expect(resolved.get('CLINICAL_CHARTING')).toMatchObject({ available: false, health: 'DOWN' });
    expect(resolved.get('IMMUNIZATION')).toMatchObject({
      available: true,
      health: 'UP',
      degradations: [{ dependency: 'CLINICAL_CHARTING', mode: 'HIDE' }],
    });
  });

  it('behaviourally: patient-reported records and reads keep working but clinician-administered recording is refused while clinical-charting is down', async () => {
    const { charting } = buildCharting();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const controller = new ImmunizationController(new ImmunizationService(new ImmunizationRepository(), charting));

    charting.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(controller.recordClinicianAdministered(encounter.id, clinicianBody)).rejects.toThrow();

    const record = controller.recordPatientReported(currentUser, patientReportedBody);
    expect(record.status).toBe('ACTIVE');
    expect(controller.listRecords(currentUser).total).toBe(1);
    expect(controller.voidRecord(record.id, { reason: 'Test correction' }).status).toBe('VOIDED');
  });
});
