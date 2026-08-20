import { BadRequestException } from '@nestjs/common';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { ClinicalSummaryRepository } from '../clinical-summary/clinical-summary.repository.js';
import { ClinicalSummaryService } from '../clinical-summary/clinical-summary.service.js';
import { RecordsRepository } from '../records/records.repository.js';
import { RecordsService } from '../records/records.service.js';
import { MedicationSafetyController } from './medication-safety.controller.js';
import { MedicationSafetyRepository } from './medication-safety.repository.js';
import { MedicationSafetyService } from './medication-safety.service.js';

function buildController() {
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  const summary = new ClinicalSummaryService(new ClinicalSummaryRepository(), charting);
  const controller = new MedicationSafetyController(
    new MedicationSafetyService(new MedicationSafetyRepository(), summary),
  );
  return { controller, summary };
}

// Same pattern as `records.controller.test.ts`: Nest's own `@UseGuards`
// metadata key, since a plain method call (every other test in this file)
// bypasses Nest's guard pipeline entirely.
const GUARDS_METADATA = '__guards__';
const controllerProto = MedicationSafetyController.prototype as unknown as Record<string, () => unknown>;
function guardsFor(method: string): unknown {
  return Reflect.getMetadata(GUARDS_METADATA, controllerProto[method]!);
}

describe('MedicationSafetyController auth wiring', () => {
  it('gates check behind SessionAuthGuard', () => {
    expect(guardsFor('check')).toEqual([SessionAuthGuard]);
  });

  it('leaves only the health check ungated', () => {
    expect(guardsFor('health')).toBeUndefined();
  });
});

const currentUser: CurrentUserResult = {
  subjectId: 'patient-1',
  user: { id: 'patient-1', phone: '9812345678', role: 'PATIENT', locale: 'ne', assuranceLevel: 'REGISTERED' },
  patientProfileId: null,
  assuranceLevel: 'REGISTERED',
};

describe('MedicationSafetyController.check', () => {
  it("checks a valid body against the caller's own record and returns the result", async () => {
    const { controller, summary } = buildController();
    summary.recordPatientReported({ patientId: 'patient-1', kind: 'ALLERGY', label: 'Penicillin', value: 'Rash' });

    const result = await controller.check(currentUser, { proposedLabel: 'Penicillin' });

    expect(result.checked).toBe(true);
    expect(result.findings).toHaveLength(1);
  });

  it("never checks against another caller's record, even if the body once carried a different patientId", async () => {
    const { controller, summary } = buildController();
    summary.recordPatientReported({ patientId: 'someone-else', kind: 'ALLERGY', label: 'Penicillin', value: 'Rash' });

    // `patientId` is no longer a field `checkSchema` accepts — this proves
    // the controller derives the subject from the session, not the body,
    // even when a caller tries to smuggle one back in.
    const result = await controller.check(currentUser, {
      patientId: 'someone-else',
      proposedLabel: 'Penicillin',
    });

    expect(result.checked).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it('rejects a request missing a required field', () => {
    const { controller } = buildController();
    expect(() => controller.check(currentUser, {})).toThrow(BadRequestException);
  });

  it('rejects an empty proposedLabel', () => {
    const { controller } = buildController();
    expect(() => controller.check(currentUser, { proposedLabel: '   ' })).toThrow(BadRequestException);
  });
});

describe('MedicationSafetyController.health', () => {
  it('reports UP', async () => {
    const { controller } = buildController();
    await expect(controller.health()).resolves.toEqual({ status: 'UP' });
  });
});
