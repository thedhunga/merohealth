import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { RecordsRepository } from '../records/records.repository.js';
import { RecordsService } from '../records/records.service.js';
import { ClinicalSummaryController } from './clinical-summary.controller.js';
import { ClinicalSummaryRepository } from './clinical-summary.repository.js';
import { ClinicalSummaryService } from './clinical-summary.service.js';

function buildController() {
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  const controller = new ClinicalSummaryController(new ClinicalSummaryService(new ClinicalSummaryRepository(), charting));
  return { controller, charting };
}

const validPatientReportedBody = { patientId: 'patient-1', kind: 'ALLERGY', label: 'Penicillin', value: 'Rash' };
const validClinicianBody = { clinicianId: 'clinician-1', kind: 'CONDITION', label: 'Type 2 diabetes', value: 'Diagnosed 2026' };

describe('ClinicalSummaryController.recordPatientReported', () => {
  it('records an item from a valid body', () => {
    const { controller } = buildController();
    const item = controller.recordPatientReported(validPatientReportedBody);

    expect(item.status).toBe('ACTIVE');
    expect(item.provenance).toBe('PATIENT_REPORTED');
  });

  it('rejects a request missing a required field', () => {
    const { controller } = buildController();
    expect(() => controller.recordPatientReported({ ...validPatientReportedBody, kind: undefined })).toThrow(
      BadRequestException,
    );
  });

  it('rejects an unknown kind', () => {
    const { controller } = buildController();
    expect(() => controller.recordPatientReported({ ...validPatientReportedBody, kind: 'BLOOD_GROUP' })).toThrow(
      BadRequestException,
    );
  });
});

describe('ClinicalSummaryController.recordClinicianAuthored', () => {
  it('records an item against an open encounter', async () => {
    const { controller, charting } = buildController();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });

    const item = await controller.recordClinicianAuthored(encounter.id, validClinicianBody);
    expect(item).toMatchObject({ patientId: 'patient-1', provenance: 'CLINICIAN_AUTHORED' });
  });

  it('404s against an unknown encounter', async () => {
    const { controller } = buildController();
    await expect(controller.recordClinicianAuthored('missing', validClinicianBody)).rejects.toThrow(NotFoundException);
  });
});

describe('ClinicalSummaryController reads and resolve', () => {
  it('reads back a recorded item, lists it, and resolves it', () => {
    const { controller } = buildController();
    const item = controller.recordPatientReported(validPatientReportedBody);

    expect(controller.getItem(item.id).id).toBe(item.id);
    expect(controller.listItems('patient-1').total).toBe(1);
    expect(controller.resolveItem(item.id).status).toBe('RESOLVED');
  });

  it('404s a read for an unknown item', () => {
    const { controller } = buildController();
    expect(() => controller.getItem('missing')).toThrow(NotFoundException);
  });

  it('rejects an unknown kind filter', () => {
    const { controller } = buildController();
    expect(() => controller.listItems(undefined, 'NOT_A_KIND')).toThrow(BadRequestException);
  });
});

describe('ClinicalSummaryController.health', () => {
  it('reports UP', async () => {
    const { controller } = buildController();
    await expect(controller.health()).resolves.toEqual({ status: 'UP' });
  });
});

describe('ClinicalSummaryController degraded mode', () => {
  it('refuses clinician-authored recording while clinical-charting is unavailable, but the list keeps working', async () => {
    const { controller, charting } = buildController();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    charting.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(controller.recordClinicianAuthored(encounter.id, validClinicianBody)).rejects.toThrow(
      ServiceUnavailableException,
    );

    const item = controller.recordPatientReported(validPatientReportedBody);
    expect(item.status).toBe('ACTIVE');
    expect(controller.listItems('patient-1').total).toBe(1);
  });
});
