import type { DiagnosticOrder } from '@swasthya/shared-types';
import { describe, expect, it } from 'vitest';
import {
  cancelDiagnosticOrder,
  DiagnosticOrderAlreadyCancelledError,
  DiagnosticOrderNotOpenError,
  DiagnosticResultNotHeldError,
  orderDiagnostic,
  recordDiagnosticResult,
  releaseDiagnosticResult,
} from './index.js';

const orderInput = { clinicianId: 'clinician-1', kind: 'LAB' as const, testName: 'Fasting blood glucose' };
const resultInput = { resultSource: 'MANUAL' as const, value: '5.4 mmol/L', recordedBy: 'clinician-1' };

function makeOrder(): DiagnosticOrder {
  return orderDiagnostic('order-1', 'patient-1', 'enc-1', orderInput, '2026-08-10T00:00:00.000Z');
}

describe('orderDiagnostic', () => {
  it('builds an ORDERED order at version 1 with no result yet', () => {
    const order = makeOrder();

    expect(order).toEqual({
      id: 'order-1',
      patientId: 'patient-1',
      clinicianId: 'clinician-1',
      encounterId: 'enc-1',
      kind: 'LAB',
      testName: 'Fasting blood glucose',
      status: 'ORDERED',
      result: null,
      cancelledAt: null,
      cancelReason: null,
      createdAt: '2026-08-10T00:00:00.000Z',
      updatedAt: '2026-08-10T00:00:00.000Z',
      version: 1,
    });
  });
});

describe('recordDiagnosticResult', () => {
  it('moves the order to RESULTED with a HELD, non-diagnostic result', () => {
    const resulted = recordDiagnosticResult(makeOrder(), resultInput, '2026-08-11T00:00:00.000Z');

    expect(resulted.status).toBe('RESULTED');
    expect(resulted.version).toBe(2);
    expect(resulted.result).toEqual({
      resultSource: 'MANUAL',
      value: '5.4 mmol/L',
      nonDiagnostic: true,
      releaseStatus: 'HELD',
      recordedAt: '2026-08-11T00:00:00.000Z',
      recordedBy: 'clinician-1',
      releasedAt: null,
      releasedBy: null,
    });
  });

  it('never accepts HL7 or MANUAL as anything but the caller-supplied value — both pass through unchanged', () => {
    const hl7Result = recordDiagnosticResult(
      makeOrder(),
      { ...resultInput, resultSource: 'HL7' },
      '2026-08-11T00:00:00.000Z',
    );

    expect(hl7Result.result?.resultSource).toBe('HL7');
  });

  it('refuses to record a result against an already-RESULTED order', () => {
    const resulted = recordDiagnosticResult(makeOrder(), resultInput, '2026-08-11T00:00:00.000Z');

    expect(() => recordDiagnosticResult(resulted, resultInput, '2026-08-12T00:00:00.000Z')).toThrow(
      DiagnosticOrderNotOpenError,
    );
  });

  it('refuses to record a result against a cancelled order', () => {
    const cancelled = cancelDiagnosticOrder(makeOrder(), 'Ordered in error', '2026-08-11T00:00:00.000Z');

    expect(() => recordDiagnosticResult(cancelled, resultInput, '2026-08-12T00:00:00.000Z')).toThrow(
      DiagnosticOrderNotOpenError,
    );
  });
});

describe('releaseDiagnosticResult', () => {
  it('moves a HELD result to RELEASED, recording who and when', () => {
    const resulted = recordDiagnosticResult(makeOrder(), resultInput, '2026-08-11T00:00:00.000Z');

    const released = releaseDiagnosticResult(resulted, 'clinician-2', '2026-08-12T00:00:00.000Z');

    expect(released.result).toMatchObject({
      releaseStatus: 'RELEASED',
      releasedAt: '2026-08-12T00:00:00.000Z',
      releasedBy: 'clinician-2',
    });
    expect(released.version).toBe(3);
  });

  it('refuses to release an order with no result yet', () => {
    expect(() => releaseDiagnosticResult(makeOrder(), 'clinician-2', '2026-08-12T00:00:00.000Z')).toThrow(
      DiagnosticResultNotHeldError,
    );
  });

  it('refuses to release an already-released result', () => {
    const resulted = recordDiagnosticResult(makeOrder(), resultInput, '2026-08-11T00:00:00.000Z');
    const released = releaseDiagnosticResult(resulted, 'clinician-2', '2026-08-12T00:00:00.000Z');

    expect(() => releaseDiagnosticResult(released, 'clinician-2', '2026-08-13T00:00:00.000Z')).toThrow(
      DiagnosticResultNotHeldError,
    );
  });
});

describe('cancelDiagnosticOrder', () => {
  it('moves an ORDERED order to CANCELLED with a reason', () => {
    const cancelled = cancelDiagnosticOrder(makeOrder(), 'Ordered in error', '2026-08-11T00:00:00.000Z');

    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancelledAt).toBe('2026-08-11T00:00:00.000Z');
    expect(cancelled.cancelReason).toBe('Ordered in error');
    expect(cancelled.version).toBe(2);
  });

  it('refuses to cancel an already-cancelled order', () => {
    const cancelled = cancelDiagnosticOrder(makeOrder(), 'Ordered in error', '2026-08-11T00:00:00.000Z');

    expect(() => cancelDiagnosticOrder(cancelled, 'Second attempt', '2026-08-12T00:00:00.000Z')).toThrow(
      DiagnosticOrderAlreadyCancelledError,
    );
  });

  it('refuses to cancel a RESULTED order — a result is superseded by a new order, never discarded', () => {
    const resulted = recordDiagnosticResult(makeOrder(), resultInput, '2026-08-11T00:00:00.000Z');

    expect(() => cancelDiagnosticOrder(resulted, 'Too late', '2026-08-12T00:00:00.000Z')).toThrow(
      DiagnosticOrderNotOpenError,
    );
  });
});
