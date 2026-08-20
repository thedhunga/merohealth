import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
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

// Same pattern `medication-safety.controller.test.ts` uses: Nest's own
// `@UseGuards` metadata key, since a plain method call (every other test in
// this file) bypasses Nest's guard pipeline entirely.
const GUARDS_METADATA = '__guards__';
const controllerProto = ClinicalSummaryController.prototype as unknown as Record<string, () => unknown>;
function guardsFor(method: string): unknown {
  return Reflect.getMetadata(GUARDS_METADATA, controllerProto[method]!);
}

describe('ClinicalSummaryController auth wiring', () => {
  it('gates the patient-facing item routes behind SessionAuthGuard', () => {
    expect(guardsFor('recordPatientReported')).toEqual([SessionAuthGuard]);
    expect(guardsFor('listItems')).toEqual([SessionAuthGuard]);
    expect(guardsFor('getItem')).toEqual([SessionAuthGuard]);
    expect(guardsFor('resolveItem')).toEqual([SessionAuthGuard]);
  });

  it('leaves health and the clinician-authored route ungated', () => {
    // health: no auth concept at all. recordClinicianAuthored: no
    // clinician-side session exists yet — same documented exception
    // `clinical-charting.controller.ts` and `prescribing.controller.ts`
    // carry, and it derives patientId from the encounter, never a
    // client-supplied field, so there is no patient-impersonation gap here
    // to gate against.
    expect(guardsFor('health')).toBeUndefined();
    expect(guardsFor('recordClinicianAuthored')).toBeUndefined();
  });
});

const currentUser: CurrentUserResult = {
  subjectId: 'patient-1',
  user: { id: 'patient-1', phone: '9812345678', role: 'PATIENT', locale: 'ne', assuranceLevel: 'REGISTERED' },
  patientProfileId: null,
  assuranceLevel: 'REGISTERED',
};
const otherUser: CurrentUserResult = { ...currentUser, subjectId: 'patient-2' };

const validPatientReportedBody = { kind: 'ALLERGY', label: 'Penicillin', value: 'Rash' };
const validClinicianBody = { clinicianId: 'clinician-1', kind: 'CONDITION', label: 'Type 2 diabetes', value: 'Diagnosed 2026' };

describe('ClinicalSummaryController.recordPatientReported', () => {
  it("records an item under the signed-in caller's own id from a valid body", () => {
    const { controller } = buildController();
    const item = controller.recordPatientReported(currentUser, validPatientReportedBody);

    expect(item.status).toBe('ACTIVE');
    expect(item.provenance).toBe('PATIENT_REPORTED');
    expect(item.patientId).toBe('patient-1');
  });

  it("ignores a smuggled patientId in the body and uses the session's instead", () => {
    const { controller } = buildController();
    const item = controller.recordPatientReported(currentUser, { ...validPatientReportedBody, patientId: 'someone-else' });

    expect(item.patientId).toBe('patient-1');
  });

  it('rejects a request missing a required field', () => {
    const { controller } = buildController();
    expect(() =>
      controller.recordPatientReported(currentUser, { ...validPatientReportedBody, kind: undefined }),
    ).toThrow(BadRequestException);
  });

  it('rejects an unknown kind', () => {
    const { controller } = buildController();
    expect(() =>
      controller.recordPatientReported(currentUser, { ...validPatientReportedBody, kind: 'BLOOD_GROUP' }),
    ).toThrow(BadRequestException);
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
    const item = controller.recordPatientReported(currentUser, validPatientReportedBody);

    expect(controller.getItem(currentUser, item.id).id).toBe(item.id);
    expect(controller.listItems(currentUser).total).toBe(1);
    expect(controller.resolveItem(currentUser, item.id).status).toBe('RESOLVED');
  });

  it('404s a read for an unknown item', () => {
    const { controller } = buildController();
    expect(() => controller.getItem(currentUser, 'missing')).toThrow(NotFoundException);
  });

  it("404s a read for another caller's item instead of returning it", () => {
    const { controller } = buildController();
    const item = controller.recordPatientReported(currentUser, validPatientReportedBody);

    expect(() => controller.getItem(otherUser, item.id)).toThrow(NotFoundException);
    expect(controller.listItems(otherUser).total).toBe(0);
    expect(() => controller.resolveItem(otherUser, item.id)).toThrow(NotFoundException);
  });

  it('rejects an unknown kind filter', () => {
    const { controller } = buildController();
    expect(() => controller.listItems(currentUser, 'NOT_A_KIND')).toThrow(BadRequestException);
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

    const item = controller.recordPatientReported(currentUser, validPatientReportedBody);
    expect(item.status).toBe('ACTIVE');
    expect(controller.listItems(currentUser).total).toBe(1);
  });
});
