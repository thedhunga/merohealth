import type { ChartingTemplate, Encounter, SoapNote } from '@swasthya/shared-types';
import { describe, expect, it } from 'vitest';
import { ClinicalChartingRepository } from './clinical-charting.repository.js';

function makeEncounter(overrides: Partial<Encounter> = {}): Encounter {
  return {
    id: 'enc-1',
    patientId: 'patient-1',
    clinicianId: 'clinician-1',
    status: 'OPEN',
    startedAt: '2026-08-09T00:00:00.000Z',
    closedAt: null,
    attachedDocumentIds: [],
    createdAt: '2026-08-09T00:00:00.000Z',
    updatedAt: '2026-08-09T00:00:00.000Z',
    version: 1,
    ...overrides,
  };
}

function makeNote(overrides: Partial<SoapNote> = {}): SoapNote {
  return {
    id: 'note-1',
    encounterId: 'enc-1',
    authorId: 'clinician-1',
    subjective: 's',
    objective: 'o',
    assessment: 'a',
    plan: 'p',
    createdAt: '2026-08-09T00:00:00.000Z',
    updatedAt: '2026-08-09T00:00:00.000Z',
    version: 1,
    ...overrides,
  };
}

function makeTemplate(overrides: Partial<ChartingTemplate> = {}): ChartingTemplate {
  return {
    id: 'tmpl-1',
    name: 'Follow-up',
    subjectivePrompt: 's',
    objectivePrompt: 'o',
    assessmentPrompt: 'a',
    planPrompt: 'p',
    createdAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('ClinicalChartingRepository encounters', () => {
  it('round-trips a saved encounter by id', () => {
    const repository = new ClinicalChartingRepository();
    repository.saveEncounter(makeEncounter());

    expect(repository.findEncounter('enc-1')?.patientId).toBe('patient-1');
    expect(repository.findEncounter('missing')).toBeNull();
  });

  it('overwrites rather than duplicates on a second save with the same id', () => {
    const repository = new ClinicalChartingRepository();
    repository.saveEncounter(makeEncounter({ version: 1 }));
    repository.saveEncounter(makeEncounter({ version: 2, status: 'CLOSED' }));

    expect(repository.listEncounters()).toHaveLength(1);
    expect(repository.findEncounter('enc-1')?.status).toBe('CLOSED');
  });

  it('filters by patientId when given, lists all otherwise', () => {
    const repository = new ClinicalChartingRepository();
    repository.saveEncounter(makeEncounter({ id: 'enc-1', patientId: 'patient-1' }));
    repository.saveEncounter(makeEncounter({ id: 'enc-2', patientId: 'patient-2' }));

    expect(repository.listEncounters('patient-1').map((e) => e.id)).toEqual(['enc-1']);
    expect(repository.listEncounters().map((e) => e.id).toSorted()).toEqual(['enc-1', 'enc-2']);
  });
});

describe('ClinicalChartingRepository notes', () => {
  it('round-trips a saved note by id and lists by encounter', () => {
    const repository = new ClinicalChartingRepository();
    repository.saveNote(makeNote({ id: 'note-1', encounterId: 'enc-1' }));
    repository.saveNote(makeNote({ id: 'note-2', encounterId: 'enc-2' }));

    expect(repository.findNote('note-1')?.encounterId).toBe('enc-1');
    expect(repository.findNote('missing')).toBeNull();
    expect(repository.listNotesForEncounter('enc-1').map((n) => n.id)).toEqual(['note-1']);
  });
});

describe('ClinicalChartingRepository templates', () => {
  it('saves and lists templates', () => {
    const repository = new ClinicalChartingRepository();
    repository.saveTemplate(makeTemplate({ id: 'tmpl-1' }));
    repository.saveTemplate(makeTemplate({ id: 'tmpl-2' }));

    expect(repository.listTemplates().map((t) => t.id).toSorted()).toEqual(['tmpl-1', 'tmpl-2']);
  });
});
