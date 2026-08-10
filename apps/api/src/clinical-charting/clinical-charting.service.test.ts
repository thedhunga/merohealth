import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { EncounterAlreadyClosedError, EncounterNotOpenError } from '@swasthya/clinical-charting';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { RecordsRepository } from '../records/records.repository.js';
import { RecordsService } from '../records/records.service.js';
import { ClinicalChartingRepository } from './clinical-charting.repository.js';
import { ClinicalChartingService } from './clinical-charting.service.js';

function buildCharting() {
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  return { charting, documents };
}

const encounterInput = { patientId: 'patient-1', clinicianId: 'clinician-1' };
const noteInput = {
  authorId: 'clinician-1',
  subjective: 'Headache for two days.',
  objective: 'BP 120/80.',
  assessment: 'Tension headache.',
  plan: 'Rest.',
};

describe('ClinicalChartingService encounters', () => {
  it('opens an OPEN encounter', () => {
    const { charting } = buildCharting();
    const encounter = charting.openEncounter(encounterInput);

    expect(encounter.status).toBe('OPEN');
    expect(encounter.patientId).toBe('patient-1');
  });

  it('404s reading an unknown encounter', () => {
    const { charting } = buildCharting();
    expect(() => charting.getEncounter('missing')).toThrow(NotFoundException);
  });

  it('lists encounters filtered by patientId', () => {
    const { charting } = buildCharting();
    charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    charting.openEncounter({ patientId: 'patient-2', clinicianId: 'clinician-1' });

    expect(charting.listEncounters('patient-1')).toHaveLength(1);
    expect(charting.listEncounters()).toHaveLength(2);
  });

  it('closes an open encounter', () => {
    const { charting } = buildCharting();
    const encounter = charting.openEncounter(encounterInput);

    expect(charting.closeEncounter(encounter.id).status).toBe('CLOSED');
  });

  it('rejects closing an already-closed encounter', () => {
    const { charting } = buildCharting();
    const encounter = charting.openEncounter(encounterInput);
    charting.closeEncounter(encounter.id);

    expect(() => charting.closeEncounter(encounter.id)).toThrow(EncounterAlreadyClosedError);
  });
});

describe('ClinicalChartingService notes', () => {
  it('records a note against an open encounter', () => {
    const { charting } = buildCharting();
    const encounter = charting.openEncounter(encounterInput);

    const note = charting.recordNote(encounter.id, noteInput);
    expect(note.encounterId).toBe(encounter.id);
    expect(charting.listNotes(encounter.id).map((n) => n.id)).toEqual([note.id]);
  });

  it('404s recording a note against an unknown encounter', () => {
    const { charting } = buildCharting();
    expect(() => charting.recordNote('missing', noteInput)).toThrow(NotFoundException);
  });

  it('refuses to record a note once its encounter is closed', () => {
    const { charting } = buildCharting();
    const encounter = charting.openEncounter(encounterInput);
    charting.closeEncounter(encounter.id);

    expect(() => charting.recordNote(encounter.id, noteInput)).toThrow(EncounterNotOpenError);
  });

  it('revises a note while its encounter is still open', () => {
    const { charting } = buildCharting();
    const encounter = charting.openEncounter(encounterInput);
    const note = charting.recordNote(encounter.id, noteInput);

    const revised = charting.reviseNote(note.id, { ...noteInput, subjective: 'Resolved.' });
    expect(revised.subjective).toBe('Resolved.');
    expect(revised.version).toBe(2);
  });

  it('refuses to revise a note once its encounter is closed', () => {
    const { charting } = buildCharting();
    const encounter = charting.openEncounter(encounterInput);
    const note = charting.recordNote(encounter.id, noteInput);
    charting.closeEncounter(encounter.id);

    expect(() => charting.reviseNote(note.id, noteInput)).toThrow(EncounterNotOpenError);
  });

  it('404s revising an unknown note', () => {
    const { charting } = buildCharting();
    expect(() => charting.reviseNote('missing', noteInput)).toThrow(NotFoundException);
  });
});

describe('ClinicalChartingService.attachDocument', () => {
  it('attaches a document that exists in health-records', async () => {
    const { charting, documents } = buildCharting();
    const encounter = charting.openEncounter(encounterInput);
    const document = await documents.captureDocument({
      ownerId: 'owner-1',
      filename: 'report.jpg',
      kind: 'LAB_REPORT',
      title: 'Blood panel',
      documentDate: null,
      sensitivity: 'STANDARD',
      clientEncrypted: false,
      contentType: 'image/jpeg',
      bytes: new Uint8Array([1, 2, 3]),
      pageCount: 1,
    });

    const attached = await charting.attachDocument(encounter.id, document.id);
    expect(attached.attachedDocumentIds).toEqual([document.id]);
  });

  it('404s attaching a document id health-records has never seen', async () => {
    const { charting } = buildCharting();
    const encounter = charting.openEncounter(encounterInput);

    await expect(charting.attachDocument(encounter.id, 'missing')).rejects.toThrow(NotFoundException);
  });

  it('404s attaching to an unknown encounter, without touching health-records', async () => {
    const { charting } = buildCharting();
    await expect(charting.attachDocument('missing', 'doc-1')).rejects.toThrow(NotFoundException);
  });

  it('refuses to attach while health-records is unavailable', async () => {
    const { charting, documents } = buildCharting();
    const encounter = charting.openEncounter(encounterInput);
    documents.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(charting.attachDocument(encounter.id, 'doc-1')).rejects.toThrow(ServiceUnavailableException);
  });
});

describe('ClinicalChartingService templates', () => {
  it('creates and lists templates', () => {
    const { charting } = buildCharting();
    charting.createTemplate({
      name: 'Follow-up',
      subjectivePrompt: 's',
      objectivePrompt: 'o',
      assessmentPrompt: 'a',
      planPrompt: 'p',
    });

    expect(charting.listTemplates()).toHaveLength(1);
  });
});

describe('ClinicalChartingService.health', () => {
  it('reports UP with no failure mode of its own', async () => {
    const { charting } = buildCharting();
    await expect(charting.health()).resolves.toEqual({ status: 'UP' });
  });
});
