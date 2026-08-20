import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { ClinicalSummaryRepository } from '../clinical-summary/clinical-summary.repository.js';
import { ClinicalSummaryService } from '../clinical-summary/clinical-summary.service.js';
import { MedicationSafetyRepository } from '../medication-safety/medication-safety.repository.js';
import { MedicationSafetyService } from '../medication-safety/medication-safety.service.js';
import { RecordsRepository } from '../records/records.repository.js';
import { RecordsService } from '../records/records.service.js';
import { PrescribingController } from './prescribing.controller.js';
import { PrescribingRepository } from './prescribing.repository.js';
import { PrescribingService } from './prescribing.service.js';

function buildController() {
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  const summary = new ClinicalSummaryService(new ClinicalSummaryRepository(), charting);
  const medicationSafety = new MedicationSafetyService(new MedicationSafetyRepository(), summary);
  const prescribing = new PrescribingService(new PrescribingRepository(), charting, medicationSafety);
  const controller = new PrescribingController(prescribing);
  return { controller, charting };
}

// Same pattern `referrals.controller.test.ts` uses: Nest's own `@UseGuards`
// metadata key, since a plain method call (every other test in this file)
// bypasses Nest's guard pipeline entirely.
const GUARDS_METADATA = '__guards__';
const controllerProto = PrescribingController.prototype as unknown as Record<string, () => unknown>;
function guardsFor(method: string): unknown {
  return Reflect.getMetadata(GUARDS_METADATA, controllerProto[method]!);
}

const currentUser: CurrentUserResult = {
  subjectId: 'patient-1',
  user: { id: 'patient-1', phone: '9812345678', role: 'PATIENT', locale: 'ne', assuranceLevel: 'REGISTERED' },
  patientProfileId: null,
  assuranceLevel: 'REGISTERED',
};
const otherUser: CurrentUserResult = { ...currentUser, subjectId: 'patient-2' };

describe('PrescribingController auth wiring', () => {
  it('gates the patient-facing routes behind SessionAuthGuard', () => {
    expect(guardsFor('listPrescriptions')).toEqual([SessionAuthGuard]);
    expect(guardsFor('getPrescription')).toEqual([SessionAuthGuard]);
  });

  it('leaves health and the clinician-workflow routes ungated', () => {
    // health: no auth concept at all. openPrescription/addLine/sign/void: no
    // clinician-side session exists yet — same documented exception
    // `referrals.controller.ts`/`immunization.controller.ts` carry.
    expect(guardsFor('health')).toBeUndefined();
    expect(guardsFor('openPrescription')).toBeUndefined();
    expect(guardsFor('addLine')).toBeUndefined();
    expect(guardsFor('sign')).toBeUndefined();
    expect(guardsFor('void')).toBeUndefined();
  });
});

const lineInput = {
  label: 'Amoxicillin 500mg capsule',
  dosageInstructions: 'One capsule three times daily for seven days',
  quantity: '21 capsules',
  isControlledSubstance: false,
};

describe('PrescribingController.openPrescription', () => {
  it('opens a prescription against an encounter', async () => {
    const { controller, charting } = buildController();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });

    const prescription = await controller.openPrescription(encounter.id, { clinicianId: 'clinician-1' });

    expect(prescription.status).toBe('DRAFT');
  });

  it('rejects a request missing clinicianId', () => {
    const { controller } = buildController();
    expect(() => controller.openPrescription('enc-1', {})).toThrow(BadRequestException);
  });
});

describe('PrescribingController line, sign and void endpoints', () => {
  it('adds a line, signs and voids a prescription end to end', async () => {
    const { controller, charting } = buildController();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const prescription = await controller.openPrescription(encounter.id, { clinicianId: 'clinician-1' });

    const withLine = controller.addLine(prescription.id, lineInput);
    expect(withLine.lines).toHaveLength(1);

    const signed = await controller.sign(prescription.id, { attestation: 'Dr. Shrestha' });
    expect(signed.status).toBe('SIGNED');

    const voided = controller.void(prescription.id, { reason: 'Wrong dosage entered' });
    expect(voided.status).toBe('VOIDED');
  });

  it('rejects an addLine body missing isControlledSubstance', async () => {
    const { controller, charting } = buildController();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const prescription = await controller.openPrescription(encounter.id, { clinicianId: 'clinician-1' });

    expect(() =>
      controller.addLine(prescription.id, { label: 'x', dosageInstructions: 'x', quantity: 'x' }),
    ).toThrow(BadRequestException);
  });

  it('rejects a sign body with a blank attestation', async () => {
    const { controller, charting } = buildController();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const prescription = await controller.openPrescription(encounter.id, { clinicianId: 'clinician-1' });

    expect(() => controller.sign(prescription.id, { attestation: '   ' })).toThrow(BadRequestException);
  });
});

describe('PrescribingController.listPrescriptions and getPrescription', () => {
  it("lists the signed-in caller's own prescriptions and reads one by id", async () => {
    const { controller, charting } = buildController();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const prescription = await controller.openPrescription(encounter.id, { clinicianId: 'clinician-1' });

    const listed = controller.listPrescriptions(currentUser);
    expect(listed).toEqual({ prescriptions: [prescription], total: 1 });
    expect(controller.getPrescription(currentUser, prescription.id)).toEqual(prescription);
  });

  it("404s a read for another caller's prescription instead of returning it", async () => {
    const { controller, charting } = buildController();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const prescription = await controller.openPrescription(encounter.id, { clinicianId: 'clinician-1' });

    expect(() => controller.getPrescription(otherUser, prescription.id)).toThrow(NotFoundException);
    expect(controller.listPrescriptions(otherUser).total).toBe(0);
  });
});

describe('PrescribingController.health', () => {
  it('reports UP', async () => {
    const { controller } = buildController();
    await expect(controller.health()).resolves.toEqual({ status: 'UP' });
  });
});
