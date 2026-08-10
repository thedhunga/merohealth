import { ServiceUnavailableException } from '@nestjs/common';
import { EmptyPrescriptionError } from '@swasthya/prescribing';
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
import { PrescribingRepository } from './prescribing.repository.js';
import { PrescribingService } from './prescribing.service.js';

function buildStack() {
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  const summary = new ClinicalSummaryService(new ClinicalSummaryRepository(), charting);
  const medicationSafety = new MedicationSafetyService(new MedicationSafetyRepository(), summary);
  const prescribing = new PrescribingService(new PrescribingRepository(), charting, medicationSafety);
  return { charting, summary, medicationSafety, prescribing };
}

const lineInput = {
  label: 'Amoxicillin 500mg capsule',
  dosageInstructions: 'One capsule three times daily for seven days',
  quantity: '21 capsules',
  isControlledSubstance: false,
};

describe('PrescribingService.openPrescription', () => {
  it('opens a DRAFT prescription against an encounter, deriving patientId from it', async () => {
    const { charting, prescribing } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });

    const prescription = await prescribing.openPrescription(encounter.id, { clinicianId: 'clinician-2' });

    expect(prescription.status).toBe('DRAFT');
    expect(prescription.patientId).toBe('patient-1');
    expect(prescription.clinicianId).toBe('clinician-2');
    expect(prescription.encounterId).toBe(encounter.id);
  });

  it('refuses to open a prescription while clinical-charting is down', async () => {
    const { charting, prescribing } = buildStack();
    charting.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(prescribing.openPrescription('enc-1', { clinicianId: 'clinician-1' })).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});

describe('PrescribingService.addLine and getPrescription', () => {
  it('adds a line to a draft prescription', async () => {
    const { charting, prescribing } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const prescription = await prescribing.openPrescription(encounter.id, { clinicianId: 'clinician-1' });

    const withLine = prescribing.addLine(prescription.id, lineInput);

    expect(withLine.lines).toHaveLength(1);
    expect(prescribing.getPrescription(prescription.id).lines).toHaveLength(1);
  });
});

describe('PrescribingService.signPrescription', () => {
  it('records CHECKED with the allergy conflict found against the same patient', async () => {
    const { charting, summary, prescribing } = buildStack();
    const allergy = summary.recordPatientReported({
      patientId: 'patient-1',
      kind: 'ALLERGY',
      label: 'Amoxicillin 500mg capsule',
      value: 'Rash',
    });
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const prescription = await prescribing.openPrescription(encounter.id, { clinicianId: 'clinician-1' });
    prescribing.addLine(prescription.id, lineInput);

    const signed = await prescribing.signPrescription(prescription.id, 'Dr. Shrestha');

    expect(signed.status).toBe('SIGNED');
    expect(signed.safetyCheckStatus).toBe('CHECKED');
    expect(signed.safetyFindings).toEqual([
      {
        kind: 'ALLERGY_CONFLICT',
        conflictsWithItemId: allergy.id,
        detail: 'Patient has an active recorded allergy to "Amoxicillin 500mg capsule"',
      },
    ]);
    expect(signed.signedAttestation).toBe('Dr. Shrestha');
  });

  it('records UNAVAILABLE, per clinical-suite.md §2, when clinical-summary cannot be reached at sign time', async () => {
    const { charting, summary, prescribing } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const prescription = await prescribing.openPrescription(encounter.id, { clinicianId: 'clinician-1' });
    prescribing.addLine(prescription.id, lineInput);
    summary.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    const signed = await prescribing.signPrescription(prescription.id, 'Dr. Shrestha');

    expect(signed.status).toBe('SIGNED');
    expect(signed.safetyCheckStatus).toBe('UNAVAILABLE');
    expect(signed.safetyFindings).toEqual([]);
  });

  it('propagates the domain error refusing to sign an empty prescription', async () => {
    const { charting, prescribing } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const prescription = await prescribing.openPrescription(encounter.id, { clinicianId: 'clinician-1' });

    await expect(prescribing.signPrescription(prescription.id, 'Dr. Shrestha')).rejects.toThrow(EmptyPrescriptionError);
  });
});

describe('PrescribingService.voidPrescription', () => {
  it('voids a signed prescription', async () => {
    const { charting, prescribing } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const prescription = await prescribing.openPrescription(encounter.id, { clinicianId: 'clinician-1' });
    prescribing.addLine(prescription.id, lineInput);
    await prescribing.signPrescription(prescription.id, 'Dr. Shrestha');

    const voided = prescribing.voidPrescription(prescription.id, 'Wrong dosage entered');

    expect(voided.status).toBe('VOIDED');
    expect(voided.voidReason).toBe('Wrong dosage entered');
  });
});

describe('PrescribingService.health', () => {
  it('reports UP with no failure mode of its own', async () => {
    const { prescribing } = buildStack();
    await expect(prescribing.health()).resolves.toEqual({ status: 'UP' });
  });
});
