import { ServiceUnavailableException } from '@nestjs/common';
import { DiagnosticOrderNotOpenError } from '@swasthya/diagnostics-orders';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { RecordsRepository } from '../records/records.repository.js';
import { RecordsService } from '../records/records.service.js';
import { DiagnosticsOrdersRepository } from './diagnostics-orders.repository.js';
import { DiagnosticsOrdersService } from './diagnostics-orders.service.js';

function buildStack() {
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  const diagnosticsOrders = new DiagnosticsOrdersService(new DiagnosticsOrdersRepository(), charting);
  return { charting, diagnosticsOrders };
}

const orderInput = { clinicianId: 'clinician-1', kind: 'LAB' as const, testName: 'Fasting blood glucose' };
const resultInput = { resultSource: 'MANUAL' as const, value: '5.4 mmol/L', recordedBy: 'clinician-1' };

describe('DiagnosticsOrdersService.orderDiagnostic', () => {
  it('places an ORDERED order against an encounter, deriving patientId from it', async () => {
    const { charting, diagnosticsOrders } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });

    const order = await diagnosticsOrders.orderDiagnostic(encounter.id, orderInput);

    expect(order.status).toBe('ORDERED');
    expect(order.patientId).toBe('patient-1');
    expect(order.encounterId).toBe(encounter.id);
  });

  it('refuses to place an order while clinical-charting is down', async () => {
    const { charting, diagnosticsOrders } = buildStack();
    charting.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(diagnosticsOrders.orderDiagnostic('enc-1', orderInput)).rejects.toThrow(ServiceUnavailableException);
  });
});

describe('DiagnosticsOrdersService.recordResult, releaseResult and getOrder', () => {
  it('records a HELD result, releases it, then reads the order back', async () => {
    const { charting, diagnosticsOrders } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const order = await diagnosticsOrders.orderDiagnostic(encounter.id, orderInput);

    const resulted = diagnosticsOrders.recordResult(order.id, resultInput);
    expect(resulted.result?.releaseStatus).toBe('HELD');

    const released = diagnosticsOrders.releaseResult(order.id, 'clinician-2');
    expect(released.result?.releaseStatus).toBe('RELEASED');
    expect(diagnosticsOrders.getOrder(order.id).result?.releaseStatus).toBe('RELEASED');
  });

  it('recording a result never touches clinical-charting — still works while it is down', async () => {
    const { charting, diagnosticsOrders } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const order = await diagnosticsOrders.orderDiagnostic(encounter.id, orderInput);
    charting.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    const resulted = diagnosticsOrders.recordResult(order.id, resultInput);
    expect(resulted.status).toBe('RESULTED');
  });

  it('propagates the domain error refusing a second result on an already-RESULTED order', async () => {
    const { charting, diagnosticsOrders } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const order = await diagnosticsOrders.orderDiagnostic(encounter.id, orderInput);
    diagnosticsOrders.recordResult(order.id, resultInput);

    expect(() => diagnosticsOrders.recordResult(order.id, resultInput)).toThrow(DiagnosticOrderNotOpenError);
  });
});

describe('DiagnosticsOrdersService.cancelOrder', () => {
  it('cancels an ORDERED order', async () => {
    const { charting, diagnosticsOrders } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const order = await diagnosticsOrders.orderDiagnostic(encounter.id, orderInput);

    const cancelled = diagnosticsOrders.cancelOrder(order.id, 'Ordered in error');

    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancelReason).toBe('Ordered in error');
  });
});

describe('DiagnosticsOrdersService.listOrders', () => {
  it('lists orders filtered by patientId', async () => {
    const { charting, diagnosticsOrders } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const order = await diagnosticsOrders.orderDiagnostic(encounter.id, orderInput);

    expect(diagnosticsOrders.listOrders('patient-1')).toEqual([order]);
    expect(diagnosticsOrders.listOrders('patient-2')).toEqual([]);
  });
});

describe('DiagnosticsOrdersService.health', () => {
  it('reports UP with no failure mode of its own', async () => {
    const { diagnosticsOrders } = buildStack();
    await expect(diagnosticsOrders.health()).resolves.toEqual({ status: 'UP' });
  });
});
