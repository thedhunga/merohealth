import type {
  ChartingTemplate,
  CreateChartingTemplateInput,
  Encounter,
  EncounterStatus,
  OpenEncounterInput,
  SoapNote,
  SoapNoteInput,
} from '@swasthya/shared-types';

/* ------------------------------------------------------------------ *
 * Clinical charting
 *
 * clinical-suite.md capability map row 3: "Charting, SOAP notes, templates
 * ... Core EHR surface. Consumes health-records." This package is the pure
 * domain layer only — `patientId`/`clinicianId`/attached document ids are
 * accepted as already-resolved opaque ids; verifying a document actually
 * exists in health-records, and refusing that one action when that module is
 * unavailable, are both API-boundary concerns (see
 * `apps/api/src/clinical-charting/clinical-charting.service.ts`), not this
 * package's job — the same split `scheduling` already established for
 * `patientId` against patient-registry.
 * ------------------------------------------------------------------ */

export class EncounterAlreadyClosedError extends Error {
  constructor(id: string) {
    super(`Encounter ${id} is already closed`);
    this.name = 'EncounterAlreadyClosedError';
  }
}

/**
 * Real EHR "sign and lock" behaviour: once an encounter is closed, its notes
 * are part of the medical record and no longer editable, and no further note
 * or document can be added against it. A closed encounter can never be
 * reopened by this package — there is no `reopenEncounter`, so this error is
 * permanent for that encounter, not a transient guard.
 */
export class EncounterNotOpenError extends Error {
  constructor(id: string) {
    super(`Encounter ${id} is not open`);
    this.name = 'EncounterNotOpenError';
  }
}

export function openEncounter(id: string, input: OpenEncounterInput, now: string): Encounter {
  const status: EncounterStatus = 'OPEN';
  return {
    id,
    patientId: input.patientId,
    clinicianId: input.clinicianId,
    status,
    startedAt: now,
    closedAt: null,
    attachedDocumentIds: [],
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

/**
 * Closing an already-closed encounter is rejected rather than silently
 * idempotent, matching `scheduling`'s own `AppointmentAlreadyCancelledError`
 * precedent: a caller relying on this throwing to detect "did my close
 * actually do anything" would otherwise get a false positive.
 */
export function closeEncounter(encounter: Encounter, now: string): Encounter {
  if (encounter.status === 'CLOSED') throw new EncounterAlreadyClosedError(encounter.id);
  return { ...encounter, status: 'CLOSED', closedAt: now, updatedAt: now, version: encounter.version + 1 };
}

function assertOpen(encounter: Encounter): void {
  if (encounter.status !== 'OPEN') throw new EncounterNotOpenError(encounter.id);
}

export function recordSoapNote(encounter: Encounter, id: string, input: SoapNoteInput, now: string): SoapNote {
  assertOpen(encounter);
  return {
    id,
    encounterId: encounter.id,
    authorId: input.authorId,
    subjective: input.subjective,
    objective: input.objective,
    assessment: input.assessment,
    plan: input.plan,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

/**
 * A full replacement of the note's four sections, not a partial patch —
 * `health-records`' own `correctObservation` sets the same precedent (replace
 * the whole value, don't merge). The author of record does not change on a
 * revision; only the content and the encounter that authored it can.
 */
export function reviseSoapNote(
  encounter: Encounter,
  note: SoapNote,
  content: Omit<SoapNoteInput, 'authorId'>,
  now: string,
): SoapNote {
  assertOpen(encounter);
  return {
    ...note,
    subjective: content.subjective,
    objective: content.objective,
    assessment: content.assessment,
    plan: content.plan,
    updatedAt: now,
    version: note.version + 1,
  };
}

/**
 * Attaching the same document twice is a no-op, not an error — unlike
 * cancelling an already-cancelled appointment, there is no "did this actually
 * do anything" ambiguity a caller needs surfaced here; the set of attached
 * documents is simply idempotent under repeated attachment of the same id.
 */
export function attachDocument(encounter: Encounter, documentId: string, now: string): Encounter {
  assertOpen(encounter);
  if (encounter.attachedDocumentIds.includes(documentId)) return encounter;
  return {
    ...encounter,
    attachedDocumentIds: [...encounter.attachedDocumentIds, documentId],
    updatedAt: now,
    version: encounter.version + 1,
  };
}

export function createChartingTemplate(id: string, input: CreateChartingTemplateInput, now: string): ChartingTemplate {
  return {
    id,
    name: input.name,
    subjectivePrompt: input.subjectivePrompt,
    objectivePrompt: input.objectivePrompt,
    assessmentPrompt: input.assessmentPrompt,
    planPrompt: input.planPrompt,
    createdAt: now,
  };
}

/**
 * The section content a new note starts from when a clinician picks a
 * template — still just the clinician's own structural prompts, not
 * clinical content, so this stays a pure reshuffle with no invented facts.
 */
export function draftNoteFromTemplate(template: ChartingTemplate): Omit<SoapNoteInput, 'authorId'> {
  return {
    subjective: template.subjectivePrompt,
    objective: template.objectivePrompt,
    assessment: template.assessmentPrompt,
    plan: template.planPrompt,
  };
}
