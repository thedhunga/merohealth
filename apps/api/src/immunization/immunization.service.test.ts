import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { RecordsRepository } from '../records/records.repository.js';
import { RecordsService } from '../records/records.service.js';
import { ImmunizationRepository } from './immunization.repository.js';
import { ImmunizationService } from './immunization.service.js';

function buildImmunization() {
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  const immunization = new ImmunizationService(new ImmunizationRepository(), charting);
  return { immunization, charting };
}

const patientReportedInput = { patientId: 'patient-1', vaccineName: 'Tetanus toxoid', doseNumber: 1, administeredOn: '2020-01-15' };
const clinicianInput = { clinicianId: 'clinician-1', vaccineName: 'Hepatitis B', doseNumber: 2, administeredOn: '2026-08-11' };

describe('ImmunizationService.recordPatientReported', () => {
  it('records an active, unverified record with no encounter dependency', () => {
    const { immunization } = buildImmunization();
    const record = immunization.recordPatientReported(patientReportedInput);

    expect(record).toMatchObject({ patientId: 'patient-1', provenance: 'PATIENT_REPORTED', status: 'ACTIVE' });
  });
});

describe('ImmunizationService.recordClinicianAdministered', () => {
  it('resolves the patient from the encounter, not a client-supplied field', async () => {
    const { immunization, charting } = buildImmunization();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });

    const record = await immunization.recordClinicianAdministered(encounter.id, clinicianInput);
    expect(record).toMatchObject({
      patientId: 'patient-1',
      administeredByEncounterId: encounter.id,
      administeredByClinicianId: 'clinician-1',
      provenance: 'CLINICIAN_ADMINISTERED',
      verification: 'CLINICIAN_VERIFIED',
    });
  });

  it('404s against an unknown encounter', async () => {
    const { immunization } = buildImmunization();
    await expect(immunization.recordClinicianAdministered('missing', clinicianInput)).rejects.toThrow(NotFoundException);
  });

  it('refuses while clinical-charting is unavailable', async () => {
    const { immunization, charting } = buildImmunization();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    charting.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(immunization.recordClinicianAdministered(encounter.id, clinicianInput)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});

describe('ImmunizationService reads', () => {
  it('404s reading an unknown record', () => {
    const { immunization } = buildImmunization();
    expect(() => immunization.getRecord('missing')).toThrow(NotFoundException);
  });

  it('lists records filtered by patientId', () => {
    const { immunization } = buildImmunization();
    immunization.recordPatientReported(patientReportedInput);
    immunization.recordPatientReported({ ...patientReportedInput, patientId: 'patient-2' });

    expect(immunization.listRecords('patient-1')).toHaveLength(1);
    expect(immunization.listRecords()).toHaveLength(2);
  });
});

describe('ImmunizationService.getOwnRecord', () => {
  it("reads back the owner's own record", () => {
    const { immunization } = buildImmunization();
    const record = immunization.recordPatientReported(patientReportedInput);

    expect(immunization.getOwnRecord(record.id, 'patient-1')).toEqual(record);
  });

  it("404s instead of returning a record that belongs to someone else", () => {
    const { immunization } = buildImmunization();
    const record = immunization.recordPatientReported(patientReportedInput);

    expect(() => immunization.getOwnRecord(record.id, 'patient-2')).toThrow(NotFoundException);
  });

  it('404s for an unknown record id', () => {
    const { immunization } = buildImmunization();
    expect(() => immunization.getOwnRecord('missing', 'patient-1')).toThrow(NotFoundException);
  });
});

describe('ImmunizationService.voidRecord', () => {
  it('voids a record with a reason', () => {
    const { immunization } = buildImmunization();
    const record = immunization.recordPatientReported(patientReportedInput);

    const voided = immunization.voidRecord(record.id, 'Entered against the wrong patient');
    expect(voided.status).toBe('VOIDED');
    expect(voided.voidReason).toBe('Entered against the wrong patient');
  });

  it('rejects voiding an already-voided record, as a 400 with a code', () => {
    const { immunization } = buildImmunization();
    const record = immunization.recordPatientReported(patientReportedInput);
    immunization.voidRecord(record.id, 'Duplicate entry');

    try {
      immunization.voidRecord(record.id, 'Second attempt');
      expect.unreachable('expected voidRecord to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({ code: 'ImmunizationRecordAlreadyVoidedError' });
    }
  });
});

describe('ImmunizationService.health', () => {
  it('reports UP with no failure mode of its own', async () => {
    const { immunization } = buildImmunization();
    await expect(immunization.health()).resolves.toEqual({ status: 'UP' });
  });
});
