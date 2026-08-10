import { BadRequestException } from '@nestjs/common';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
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
  it('lists prescriptions filtered by patientId and reads one by id', async () => {
    const { controller, charting } = buildController();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const prescription = await controller.openPrescription(encounter.id, { clinicianId: 'clinician-1' });

    const listed = controller.listPrescriptions('patient-1');
    expect(listed).toEqual({ prescriptions: [prescription], total: 1 });
    expect(controller.getPrescription(prescription.id)).toEqual(prescription);
  });
});

describe('PrescribingController.health', () => {
  it('reports UP', async () => {
    const { controller } = buildController();
    await expect(controller.health()).resolves.toEqual({ status: 'UP' });
  });
});
