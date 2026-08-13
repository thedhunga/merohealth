import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { RecordsRepository } from '../records/records.repository.js';
import { RecordsService } from '../records/records.service.js';
import { ImmunizationController } from './immunization.controller.js';
import { ImmunizationRepository } from './immunization.repository.js';
import { ImmunizationService } from './immunization.service.js';

function buildController() {
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  const controller = new ImmunizationController(new ImmunizationService(new ImmunizationRepository(), charting));
  return { controller, charting };
}

const validPatientReportedBody = { patientId: 'patient-1', vaccineName: 'Tetanus toxoid', doseNumber: 1, administeredOn: '2020-01-15' };
const validClinicianBody = { clinicianId: 'clinician-1', vaccineName: 'Hepatitis B', doseNumber: 2, administeredOn: '2026-08-11' };

describe('ImmunizationController.recordPatientReported', () => {
  it('records a record from a valid body', () => {
    const { controller } = buildController();
    const record = controller.recordPatientReported(validPatientReportedBody);

    expect(record.status).toBe('ACTIVE');
    expect(record.provenance).toBe('PATIENT_REPORTED');
  });

  it('rejects a request missing a required field', () => {
    const { controller } = buildController();
    expect(() => controller.recordPatientReported({ ...validPatientReportedBody, vaccineName: undefined })).toThrow(
      BadRequestException,
    );
  });

  it('rejects a non-positive dose number', () => {
    const { controller } = buildController();
    expect(() => controller.recordPatientReported({ ...validPatientReportedBody, doseNumber: 0 })).toThrow(
      BadRequestException,
    );
  });

  it('rejects an administeredOn that is not YYYY-MM-DD', () => {
    const { controller } = buildController();
    expect(() =>
      controller.recordPatientReported({ ...validPatientReportedBody, administeredOn: '15-01-2020' }),
    ).toThrow(BadRequestException);
  });
});

describe('ImmunizationController.recordClinicianAdministered', () => {
  it('records a record against an open encounter', async () => {
    const { controller, charting } = buildController();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });

    const record = await controller.recordClinicianAdministered(encounter.id, validClinicianBody);
    expect(record).toMatchObject({ patientId: 'patient-1', provenance: 'CLINICIAN_ADMINISTERED' });
  });

  it('404s against an unknown encounter', async () => {
    const { controller } = buildController();
    await expect(controller.recordClinicianAdministered('missing', validClinicianBody)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects an administeredOn that is not YYYY-MM-DD', () => {
    const { controller, charting } = buildController();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    // parseOrThrow runs as an argument to the async service call, so a validation failure throws
    // synchronously rather than rejecting the returned promise — same shape as recordPatientReported.
    expect(() =>
      controller.recordClinicianAdministered(encounter.id, { ...validClinicianBody, administeredOn: '2026/08/11' }),
    ).toThrow(BadRequestException);
  });
});

describe('ImmunizationController reads and void', () => {
  it('reads back a recorded record, lists it, and voids it', () => {
    const { controller } = buildController();
    const record = controller.recordPatientReported(validPatientReportedBody);

    expect(controller.getRecord(record.id).id).toBe(record.id);
    expect(controller.listRecords('patient-1').total).toBe(1);
    expect(controller.voidRecord(record.id, { reason: 'Wrong patient' }).status).toBe('VOIDED');
  });

  it('404s a read for an unknown record', () => {
    const { controller } = buildController();
    expect(() => controller.getRecord('missing')).toThrow(NotFoundException);
  });

  it('rejects a void request missing a reason', () => {
    const { controller } = buildController();
    const record = controller.recordPatientReported(validPatientReportedBody);
    expect(() => controller.voidRecord(record.id, {})).toThrow(BadRequestException);
  });
});

describe('ImmunizationController.health', () => {
  it('reports UP', async () => {
    const { controller } = buildController();
    await expect(controller.health()).resolves.toEqual({ status: 'UP' });
  });
});

describe('ImmunizationController degraded mode', () => {
  it('refuses clinician-administered recording while clinical-charting is unavailable, but the list keeps working', async () => {
    const { controller, charting } = buildController();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    charting.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(controller.recordClinicianAdministered(encounter.id, validClinicianBody)).rejects.toThrow(
      ServiceUnavailableException,
    );

    const record = controller.recordPatientReported(validPatientReportedBody);
    expect(record.status).toBe('ACTIVE');
    expect(controller.listRecords('patient-1').total).toBe(1);
  });
});
