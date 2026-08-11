import type { Appointment, ClinicalSummaryItem } from '@swasthya/shared-types';
import { describe, expect, it } from 'vitest';
import { buildConditionRegistry, buildRecallList } from './index.js';

const now = '2026-08-11T09:00:00.000Z';

function item(
  overrides: Partial<ClinicalSummaryItem> & Pick<ClinicalSummaryItem, 'id' | 'patientId' | 'kind' | 'label'>,
): ClinicalSummaryItem {
  return {
    value: '',
    status: 'ACTIVE',
    provenance: 'PATIENT_REPORTED',
    verification: 'UNVERIFIED',
    authoredByEncounterId: null,
    authoredByClinicianId: null,
    recordedAt: now,
    updatedAt: now,
    version: 1,
    ...overrides,
  };
}

function appointment(overrides: Partial<Appointment> & Pick<Appointment, 'id' | 'patientId'>): Appointment {
  return {
    clinicianId: 'clinician-1',
    scheduledStart: '2026-09-01T09:00:00.000Z',
    scheduledEnd: '2026-09-01T09:30:00.000Z',
    status: 'SCHEDULED',
    createdAt: now,
    updatedAt: now,
    version: 1,
    ...overrides,
  };
}

describe('buildConditionRegistry', () => {
  it('includes a patient with an ACTIVE item of the matching kind and label', () => {
    const condition = item({ id: 'item-1', patientId: 'patient-1', kind: 'CONDITION', label: 'Type 2 Diabetes' });

    const registry = buildConditionRegistry([condition], 'CONDITION', 'Type 2 Diabetes');

    expect(registry).toEqual([{ patientId: 'patient-1', matchedItemId: 'item-1', label: 'Type 2 Diabetes' }]);
  });

  it('matches case-insensitively and after trimming', () => {
    const condition = item({ id: 'item-1', patientId: 'patient-1', kind: 'CONDITION', label: '  type 2 diabetes  ' });

    expect(buildConditionRegistry([condition], 'CONDITION', 'TYPE 2 DIABETES')).toHaveLength(1);
  });

  it('excludes a RESOLVED item, unlike medication-safety it does its own status filtering — there is no API-boundary caller to trust for this list', () => {
    const condition = item({
      id: 'item-1',
      patientId: 'patient-1',
      kind: 'CONDITION',
      label: 'Type 2 Diabetes',
      status: 'RESOLVED',
    });

    expect(buildConditionRegistry([condition], 'CONDITION', 'Type 2 Diabetes')).toEqual([]);
  });

  it('excludes an item of a different kind or a different label', () => {
    const wrongKind = item({ id: 'item-1', patientId: 'patient-1', kind: 'ALLERGY', label: 'Type 2 Diabetes' });
    const wrongLabel = item({ id: 'item-2', patientId: 'patient-2', kind: 'CONDITION', label: 'Hypertension' });

    expect(buildConditionRegistry([wrongKind, wrongLabel], 'CONDITION', 'Type 2 Diabetes')).toEqual([]);
  });

  it('keeps a patient once even with two matching items, at the first match', () => {
    const first = item({ id: 'item-1', patientId: 'patient-1', kind: 'CONDITION', label: 'Type 2 Diabetes' });
    const second = item({ id: 'item-2', patientId: 'patient-1', kind: 'CONDITION', label: 'Type 2 Diabetes' });

    const registry = buildConditionRegistry([first, second], 'CONDITION', 'Type 2 Diabetes');

    expect(registry).toEqual([{ patientId: 'patient-1', matchedItemId: 'item-1', label: 'Type 2 Diabetes' }]);
  });
});

describe('buildRecallList', () => {
  const registry = [{ patientId: 'patient-1', matchedItemId: 'item-1', label: 'Type 2 Diabetes' }];

  it('reports dueForRecall: false with the soonest upcoming SCHEDULED appointment', () => {
    const later = appointment({ id: 'appt-2', patientId: 'patient-1', scheduledStart: '2026-10-01T09:00:00.000Z' });
    const sooner = appointment({ id: 'appt-1', patientId: 'patient-1', scheduledStart: '2026-09-01T09:00:00.000Z' });

    const recall = buildRecallList(registry, [later, sooner], '2026-08-11T00:00:00.000Z');

    expect(recall).toEqual([
      {
        patientId: 'patient-1',
        matchedItemId: 'item-1',
        label: 'Type 2 Diabetes',
        nextScheduledAppointmentAt: '2026-09-01T09:00:00.000Z',
        dueForRecall: false,
      },
    ]);
  });

  it('reports dueForRecall: true when no SCHEDULED appointment exists at or after asOf', () => {
    const recall = buildRecallList(registry, [], '2026-08-11T00:00:00.000Z');

    expect(recall).toEqual([
      {
        patientId: 'patient-1',
        matchedItemId: 'item-1',
        label: 'Type 2 Diabetes',
        nextScheduledAppointmentAt: null,
        dueForRecall: true,
      },
    ]);
  });

  it('ignores a CANCELLED appointment and one before asOf', () => {
    const cancelled = appointment({
      id: 'appt-1',
      patientId: 'patient-1',
      status: 'CANCELLED',
      scheduledStart: '2026-09-01T09:00:00.000Z',
    });
    const past = appointment({ id: 'appt-2', patientId: 'patient-1', scheduledStart: '2026-01-01T09:00:00.000Z' });

    const recall = buildRecallList(registry, [cancelled, past], '2026-08-11T00:00:00.000Z');

    expect(recall[0]).toMatchObject({ nextScheduledAppointmentAt: null, dueForRecall: true });
  });

  it('ignores an appointment belonging to a different patient', () => {
    const other = appointment({ id: 'appt-1', patientId: 'patient-9', scheduledStart: '2026-09-01T09:00:00.000Z' });

    const recall = buildRecallList(registry, [other], '2026-08-11T00:00:00.000Z');

    expect(recall[0]).toMatchObject({ nextScheduledAppointmentAt: null, dueForRecall: true });
  });
});
