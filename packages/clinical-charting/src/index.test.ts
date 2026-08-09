import type { ChartingTemplate, Encounter } from '@swasthya/shared-types';
import { describe, expect, it } from 'vitest';
import {
  attachDocument,
  closeEncounter,
  createChartingTemplate,
  draftNoteFromTemplate,
  EncounterAlreadyClosedError,
  EncounterNotOpenError,
  openEncounter,
  recordSoapNote,
  reviseSoapNote,
} from './index.js';

const openInput = { patientId: 'patient-1', clinicianId: 'clinician-1' };
const noteInput = {
  authorId: 'clinician-1',
  subjective: 'Reports headache for two days.',
  objective: 'BP 120/80, afebrile.',
  assessment: 'Tension headache, likely.',
  plan: 'Rest, follow up if it persists.',
};

function makeOpenEncounter(): Encounter {
  return openEncounter('enc-1', openInput, '2026-08-09T00:00:00.000Z');
}

describe('openEncounter', () => {
  it('builds an OPEN encounter at version 1 with no attached documents', () => {
    const encounter = makeOpenEncounter();

    expect(encounter).toEqual({
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
    });
  });
});

describe('closeEncounter', () => {
  it('marks an open encounter CLOSED, sets closedAt and bumps version', () => {
    const closed = closeEncounter(makeOpenEncounter(), '2026-08-09T01:00:00.000Z');

    expect(closed.status).toBe('CLOSED');
    expect(closed.closedAt).toBe('2026-08-09T01:00:00.000Z');
    expect(closed.version).toBe(2);
  });

  it('rejects closing an already-closed encounter', () => {
    const closed = closeEncounter(makeOpenEncounter(), '2026-08-09T01:00:00.000Z');
    expect(() => closeEncounter(closed, '2026-08-09T02:00:00.000Z')).toThrow(EncounterAlreadyClosedError);
  });
});

describe('recordSoapNote', () => {
  it('records a note against an open encounter at version 1', () => {
    const note = recordSoapNote(makeOpenEncounter(), 'note-1', noteInput, '2026-08-09T00:30:00.000Z');

    expect(note).toEqual({
      id: 'note-1',
      encounterId: 'enc-1',
      authorId: 'clinician-1',
      subjective: noteInput.subjective,
      objective: noteInput.objective,
      assessment: noteInput.assessment,
      plan: noteInput.plan,
      createdAt: '2026-08-09T00:30:00.000Z',
      updatedAt: '2026-08-09T00:30:00.000Z',
      version: 1,
    });
  });

  it('refuses to record a note against a closed encounter', () => {
    const closed = closeEncounter(makeOpenEncounter(), '2026-08-09T01:00:00.000Z');
    expect(() => recordSoapNote(closed, 'note-1', noteInput, '2026-08-09T01:30:00.000Z')).toThrow(
      EncounterNotOpenError,
    );
  });
});

describe('reviseSoapNote', () => {
  it('replaces all four sections, keeps the original author and bumps version', () => {
    const encounter = makeOpenEncounter();
    const note = recordSoapNote(encounter, 'note-1', noteInput, '2026-08-09T00:30:00.000Z');

    const revised = reviseSoapNote(
      encounter,
      note,
      { subjective: 'Headache resolved.', objective: 'BP 118/76.', assessment: 'Resolved.', plan: 'No follow-up.' },
      '2026-08-09T02:00:00.000Z',
    );

    expect(revised.authorId).toBe('clinician-1');
    expect(revised.subjective).toBe('Headache resolved.');
    expect(revised.version).toBe(2);
    expect(revised.updatedAt).toBe('2026-08-09T02:00:00.000Z');
  });

  it('refuses to revise a note once its encounter is closed', () => {
    const encounter = makeOpenEncounter();
    const note = recordSoapNote(encounter, 'note-1', noteInput, '2026-08-09T00:30:00.000Z');
    const closed = closeEncounter(encounter, '2026-08-09T01:00:00.000Z');

    expect(() =>
      reviseSoapNote(closed, note, { ...noteInput, subjective: 'x' }, '2026-08-09T01:30:00.000Z'),
    ).toThrow(EncounterNotOpenError);
  });
});

describe('attachDocument', () => {
  it('appends a document id and bumps version', () => {
    const encounter = makeOpenEncounter();
    const attached = attachDocument(encounter, 'doc-1', '2026-08-09T00:15:00.000Z');

    expect(attached.attachedDocumentIds).toEqual(['doc-1']);
    expect(attached.version).toBe(2);
  });

  it('is idempotent when the same document is attached twice', () => {
    const encounter = makeOpenEncounter();
    const once = attachDocument(encounter, 'doc-1', '2026-08-09T00:15:00.000Z');
    const twice = attachDocument(once, 'doc-1', '2026-08-09T00:20:00.000Z');

    expect(twice).toBe(once);
  });

  it('refuses to attach a document to a closed encounter', () => {
    const closed = closeEncounter(makeOpenEncounter(), '2026-08-09T01:00:00.000Z');
    expect(() => attachDocument(closed, 'doc-1', '2026-08-09T01:30:00.000Z')).toThrow(EncounterNotOpenError);
  });
});

describe('createChartingTemplate and draftNoteFromTemplate', () => {
  it('builds a template and drafts a note from its prompts', () => {
    const template: ChartingTemplate = createChartingTemplate(
      'tmpl-1',
      {
        name: 'Follow-up visit',
        subjectivePrompt: 'Chief complaint and interval history',
        objectivePrompt: 'Vitals and exam findings',
        assessmentPrompt: 'Clinical impression',
        planPrompt: 'Next steps',
      },
      '2026-08-01T00:00:00.000Z',
    );

    expect(template.createdAt).toBe('2026-08-01T00:00:00.000Z');
    expect(draftNoteFromTemplate(template)).toEqual({
      subjective: 'Chief complaint and interval history',
      objective: 'Vitals and exam findings',
      assessment: 'Clinical impression',
      plan: 'Next steps',
    });
  });
});
