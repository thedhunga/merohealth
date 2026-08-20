import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ClinicalSummaryItemAlreadyResolvedError } from '@swasthya/clinical-summary';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { RecordsRepository } from '../records/records.repository.js';
import { RecordsService } from '../records/records.service.js';
import { ClinicalSummaryRepository } from './clinical-summary.repository.js';
import { ClinicalSummaryService } from './clinical-summary.service.js';

function buildSummary() {
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  const summary = new ClinicalSummaryService(new ClinicalSummaryRepository(), charting);
  return { summary, charting };
}

const patientReportedInput = { patientId: 'patient-1', kind: 'ALLERGY' as const, label: 'Penicillin', value: 'Rash' };
const clinicianInput = { clinicianId: 'clinician-1', kind: 'CONDITION' as const, label: 'Type 2 diabetes', value: 'Diagnosed 2026' };

describe('ClinicalSummaryService.recordPatientReported', () => {
  it('records an active, unverified item with no encounter dependency', () => {
    const { summary } = buildSummary();
    const item = summary.recordPatientReported(patientReportedInput);

    expect(item).toMatchObject({ patientId: 'patient-1', provenance: 'PATIENT_REPORTED', status: 'ACTIVE' });
  });
});

describe('ClinicalSummaryService.recordClinicianAuthored', () => {
  it('resolves the patient from the encounter, not a client-supplied field', async () => {
    const { summary, charting } = buildSummary();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });

    const item = await summary.recordClinicianAuthored(encounter.id, clinicianInput);
    expect(item).toMatchObject({
      patientId: 'patient-1',
      authoredByEncounterId: encounter.id,
      authoredByClinicianId: 'clinician-1',
      provenance: 'CLINICIAN_AUTHORED',
      verification: 'CLINICIAN_VERIFIED',
    });
  });

  it('404s against an unknown encounter', async () => {
    const { summary } = buildSummary();
    await expect(summary.recordClinicianAuthored('missing', clinicianInput)).rejects.toThrow(NotFoundException);
  });

  it('refuses while clinical-charting is unavailable', async () => {
    const { summary, charting } = buildSummary();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    charting.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(summary.recordClinicianAuthored(encounter.id, clinicianInput)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});

describe('ClinicalSummaryService reads', () => {
  it('404s reading an unknown item', () => {
    const { summary } = buildSummary();
    expect(() => summary.getItem('missing', 'patient-1')).toThrow(NotFoundException);
  });

  it("404s reading another patient's item, the same as an unknown id", () => {
    const { summary } = buildSummary();
    const item = summary.recordPatientReported(patientReportedInput);

    expect(() => summary.getItem(item.id, 'patient-2')).toThrow(NotFoundException);
  });

  it('lists items filtered by patientId and kind', () => {
    const { summary } = buildSummary();
    summary.recordPatientReported(patientReportedInput);
    summary.recordPatientReported({ ...patientReportedInput, patientId: 'patient-2' });

    expect(summary.listItems('patient-1')).toHaveLength(1);
    expect(summary.listItems('patient-1', 'MEDICATION')).toHaveLength(0);
    expect(summary.listItems()).toHaveLength(2);
  });
});

describe('ClinicalSummaryService.resolveItem', () => {
  it('marks an item resolved', () => {
    const { summary } = buildSummary();
    const item = summary.recordPatientReported(patientReportedInput);

    expect(summary.resolveItem(item.id, 'patient-1').status).toBe('RESOLVED');
  });

  it('rejects resolving an already-resolved item', () => {
    const { summary } = buildSummary();
    const item = summary.recordPatientReported(patientReportedInput);
    summary.resolveItem(item.id, 'patient-1');

    expect(() => summary.resolveItem(item.id, 'patient-1')).toThrow(ClinicalSummaryItemAlreadyResolvedError);
  });

  it("404s resolving another patient's item instead of resolving it", () => {
    const { summary } = buildSummary();
    const item = summary.recordPatientReported(patientReportedInput);

    expect(() => summary.resolveItem(item.id, 'patient-2')).toThrow(NotFoundException);
  });
});

describe('ClinicalSummaryService.health', () => {
  it('reports UP with no failure mode of its own', async () => {
    const { summary } = buildSummary();
    await expect(summary.health()).resolves.toEqual({ status: 'UP' });
  });
});
