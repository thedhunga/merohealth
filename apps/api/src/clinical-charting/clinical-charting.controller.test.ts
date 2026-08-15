import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { RecordsRepository } from '../records/records.repository.js';
import { RecordsService } from '../records/records.service.js';
import { ClinicalChartingController } from './clinical-charting.controller.js';
import { ClinicalChartingRepository } from './clinical-charting.repository.js';
import { ClinicalChartingService } from './clinical-charting.service.js';

function buildController() {
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const controller = new ClinicalChartingController(new ClinicalChartingService(new ClinicalChartingRepository(), documents));
  return { controller, documents };
}

function currentUserFor(subjectId: string): CurrentUserResult {
  return {
    subjectId,
    user: { id: subjectId, phone: '9800000000', role: 'PATIENT', locale: 'ne', assuranceLevel: 'REGISTERED' },
    patientProfileId: null,
    assuranceLevel: 'REGISTERED',
  };
}

// Nest's own `@UseGuards` metadata key — see BillingController's own test
// suite for why this mirrors the Nest-internal constant directly.
const GUARDS_METADATA = '__guards__';
const controllerProto = ClinicalChartingController.prototype as unknown as Record<string, () => unknown>;

function guardsFor(method: string): unknown {
  return Reflect.getMetadata(GUARDS_METADATA, controllerProto[method]!);
}

const validEncounterBody = { patientId: 'patient-1', clinicianId: 'clinician-1' };
const validNoteBody = {
  authorId: 'clinician-1',
  subjective: 'Headache for two days.',
  objective: 'BP 120/80.',
  assessment: 'Tension headache.',
  plan: 'Rest.',
};

describe('ClinicalChartingController.openEncounter', () => {
  it('opens an encounter from a valid body', () => {
    const { controller } = buildController();
    const encounter = controller.openEncounter(validEncounterBody);

    expect(encounter.status).toBe('OPEN');
  });

  it('rejects a request missing a required field', () => {
    const { controller } = buildController();
    expect(() => controller.openEncounter({ ...validEncounterBody, clinicianId: undefined })).toThrow(
      BadRequestException,
    );
  });
});

describe('ClinicalChartingController encounter reads and close', () => {
  it('reads back an opened encounter and lists it, scoped to the signed-in caller', () => {
    const { controller } = buildController();
    const encounter = controller.openEncounter(validEncounterBody);
    const owner = currentUserFor('patient-1');

    expect(controller.getEncounter(owner, encounter.id).id).toBe(encounter.id);
    expect(controller.listEncounters(owner).total).toBe(1);
  });

  it('404s a read for an unknown encounter', () => {
    const { controller } = buildController();
    expect(() => controller.getEncounter(currentUserFor('patient-1'), 'missing')).toThrow(NotFoundException);
  });

  it("404s a real encounter id that belongs to a different caller, and excludes it from that caller's list", () => {
    const { controller } = buildController();
    const encounter = controller.openEncounter(validEncounterBody);
    const stranger = currentUserFor('someone-else');

    expect(() => controller.getEncounter(stranger, encounter.id)).toThrow(NotFoundException);
    expect(controller.listEncounters(stranger)).toEqual({ items: [], total: 0 });
  });

  it('closes an encounter', () => {
    const { controller } = buildController();
    const encounter = controller.openEncounter(validEncounterBody);

    expect(controller.closeEncounter(encounter.id).status).toBe('CLOSED');
  });
});

describe('ClinicalChartingController notes', () => {
  it('records and lists a SOAP note, scoped to the signed-in caller', () => {
    const { controller } = buildController();
    const encounter = controller.openEncounter(validEncounterBody);

    const note = controller.recordNote(encounter.id, validNoteBody);
    expect(note.encounterId).toBe(encounter.id);
    expect(controller.listNotes(currentUserFor('patient-1'), encounter.id).total).toBe(1);
  });

  it("404s listing another caller's notes", () => {
    const { controller } = buildController();
    const encounter = controller.openEncounter(validEncounterBody);
    controller.recordNote(encounter.id, validNoteBody);

    expect(() => controller.listNotes(currentUserFor('someone-else'), encounter.id)).toThrow(NotFoundException);
  });

  it('rejects a note body missing a required section', () => {
    const { controller } = buildController();
    const encounter = controller.openEncounter(validEncounterBody);

    expect(() => controller.recordNote(encounter.id, { ...validNoteBody, plan: undefined })).toThrow(
      BadRequestException,
    );
  });

  it('revises a note', () => {
    const { controller } = buildController();
    const encounter = controller.openEncounter(validEncounterBody);
    const note = controller.recordNote(encounter.id, validNoteBody);

    const revised = controller.reviseNote(note.id, { ...validNoteBody, subjective: 'Resolved.' });
    expect(revised.subjective).toBe('Resolved.');
  });
});

describe('ClinicalChartingController.attachDocument', () => {
  it('attaches a document that exists in health-records', async () => {
    const { controller, documents } = buildController();
    const encounter = controller.openEncounter(validEncounterBody);
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

    const attached = await controller.attachDocument(encounter.id, document.id);
    expect(attached.attachedDocumentIds).toEqual([document.id]);
  });

  it('404s attaching an unknown document', async () => {
    const { controller } = buildController();
    const encounter = controller.openEncounter(validEncounterBody);

    await expect(controller.attachDocument(encounter.id, 'missing')).rejects.toThrow(NotFoundException);
  });
});

describe('ClinicalChartingController templates', () => {
  it('creates and lists templates', () => {
    const { controller } = buildController();
    controller.createTemplate({
      name: 'Follow-up',
      subjectivePrompt: 's',
      objectivePrompt: 'o',
      assessmentPrompt: 'a',
      planPrompt: 'p',
    });

    expect(controller.listTemplates().total).toBe(1);
  });

  it('rejects a template body missing a required field', () => {
    const { controller } = buildController();
    expect(() =>
      controller.createTemplate({ name: 'Follow-up', subjectivePrompt: 's', objectivePrompt: 'o', assessmentPrompt: 'a' }),
    ).toThrow(BadRequestException);
  });
});

describe('ClinicalChartingController.health', () => {
  it('reports UP', async () => {
    const { controller } = buildController();
    await expect(controller.health()).resolves.toEqual({ status: 'UP' });
  });
});

describe('ClinicalChartingController entitlement wiring', () => {
  // A prior version of this file left every route on this controller fully
  // unauthenticated: `GET /clinical-charting/encounters` with no session
  // returned every patient's encounters system-wide, `GET .../:id` read any
  // encounter by a guessed or leaked id, and `GET .../:id/notes` did the same
  // for the free-text SOAP narrative — the same shape `BillingController`/
  // `TeleconsultationController` were each fixed for.
  it('gates listEncounters, getEncounter and listNotes behind SessionAuthGuard', () => {
    expect(guardsFor('listEncounters')).toEqual([SessionAuthGuard]);
    expect(guardsFor('getEncounter')).toEqual([SessionAuthGuard]);
    expect(guardsFor('listNotes')).toEqual([SessionAuthGuard]);
  });

  // These stay ungated deliberately — see the controller's own doc comment
  // for why gating clinician actions behind a *patient* session guard would
  // make them unusable, not correct, and why templates carry no owner check.
  it('leaves the clinician-action and template routes ungated', () => {
    const ungated = [
      'openEncounter',
      'closeEncounter',
      'recordNote',
      'reviseNote',
      'attachDocument',
      'createTemplate',
      'listTemplates',
      'health',
    ];
    for (const method of ungated) {
      expect(guardsFor(method)).toBeUndefined();
    }
  });
});

describe('ClinicalChartingController degraded mode', () => {
  it('refuses to attach documents while health-records is unavailable, but core charting keeps working', async () => {
    const { controller, documents } = buildController();
    const encounter = controller.openEncounter(validEncounterBody);
    documents.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(controller.attachDocument(encounter.id, 'doc-1')).rejects.toThrow(ServiceUnavailableException);

    const note = controller.recordNote(encounter.id, validNoteBody);
    expect(note.encounterId).toBe(encounter.id);
    expect(controller.closeEncounter(encounter.id).status).toBe('CLOSED');
  });
});
