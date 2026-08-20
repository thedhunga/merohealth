import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
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

  it('rejects a second result on an already-RESULTED order with a BadRequestException', async () => {
    const { charting, diagnosticsOrders } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const order = await diagnosticsOrders.orderDiagnostic(encounter.id, orderInput);
    diagnosticsOrders.recordResult(order.id, resultInput);

    try {
      diagnosticsOrders.recordResult(order.id, resultInput);
      expect.unreachable('expected recordResult to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({ code: 'DiagnosticOrderNotOpenError' });
    }
  });

  it('rejects releasing a result that has already been released with a BadRequestException', async () => {
    const { charting, diagnosticsOrders } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const order = await diagnosticsOrders.orderDiagnostic(encounter.id, orderInput);
    diagnosticsOrders.recordResult(order.id, resultInput);
    diagnosticsOrders.releaseResult(order.id, 'clinician-2');

    try {
      diagnosticsOrders.releaseResult(order.id, 'clinician-2');
      expect.unreachable('expected releaseResult to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({ code: 'DiagnosticResultNotHeldError' });
    }
  });

  it('rejects releasing a result that was never recorded with a BadRequestException', async () => {
    const { charting, diagnosticsOrders } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const order = await diagnosticsOrders.orderDiagnostic(encounter.id, orderInput);

    try {
      diagnosticsOrders.releaseResult(order.id, 'clinician-2');
      expect.unreachable('expected releaseResult to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({ code: 'DiagnosticResultNotHeldError' });
    }
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

  it('rejects cancelling an order that already has a result with a BadRequestException', async () => {
    const { charting, diagnosticsOrders } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const order = await diagnosticsOrders.orderDiagnostic(encounter.id, orderInput);
    diagnosticsOrders.recordResult(order.id, resultInput);

    try {
      diagnosticsOrders.cancelOrder(order.id, 'Ordered in error');
      expect.unreachable('expected cancelOrder to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({ code: 'DiagnosticOrderNotOpenError' });
    }
  });

  it('rejects cancelling an already-cancelled order with a BadRequestException', async () => {
    const { charting, diagnosticsOrders } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const order = await diagnosticsOrders.orderDiagnostic(encounter.id, orderInput);
    diagnosticsOrders.cancelOrder(order.id, 'Ordered in error');

    try {
      diagnosticsOrders.cancelOrder(order.id, 'Ordered in error');
      expect.unreachable('expected cancelOrder to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({ code: 'DiagnosticOrderAlreadyCancelledError' });
    }
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

describe('DiagnosticsOrdersService.getOwnOrder', () => {
  it("reads back the owner's own order", async () => {
    const { charting, diagnosticsOrders } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const order = await diagnosticsOrders.orderDiagnostic(encounter.id, orderInput);

    expect(diagnosticsOrders.getOwnOrder(order.id, 'patient-1')).toEqual(order);
  });

  it("404s for a caller who isn't the order's patient, instead of returning it", async () => {
    const { charting, diagnosticsOrders } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const order = await diagnosticsOrders.orderDiagnostic(encounter.id, orderInput);

    expect(() => diagnosticsOrders.getOwnOrder(order.id, 'patient-2')).toThrow(NotFoundException);
  });

  it('404s for an unknown id', () => {
    const { diagnosticsOrders } = buildStack();
    expect(() => diagnosticsOrders.getOwnOrder('missing', 'patient-1')).toThrow(NotFoundException);
  });
});

describe('DiagnosticsOrdersService.health', () => {
  it('reports UP with no failure mode of its own', async () => {
    const { diagnosticsOrders } = buildStack();
    await expect(diagnosticsOrders.health()).resolves.toEqual({ status: 'UP' });
  });
});
