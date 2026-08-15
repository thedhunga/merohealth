import { BadRequestException } from '@nestjs/common';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { RecordsRepository } from '../records/records.repository.js';
import { RecordsService } from '../records/records.service.js';
import { DiagnosticsOrdersController } from './diagnostics-orders.controller.js';
import { DiagnosticsOrdersRepository } from './diagnostics-orders.repository.js';
import { DiagnosticsOrdersService } from './diagnostics-orders.service.js';

function buildController() {
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  const diagnosticsOrders = new DiagnosticsOrdersService(new DiagnosticsOrdersRepository(), charting);
  const controller = new DiagnosticsOrdersController(diagnosticsOrders);
  return { controller, charting };
}

describe('DiagnosticsOrdersController.order', () => {
  it('places an order against an encounter', async () => {
    const { controller, charting } = buildController();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });

    const order = await controller.order(encounter.id, { clinicianId: 'clinician-1', kind: 'LAB', testName: 'CBC' });

    expect(order.status).toBe('ORDERED');
  });

  it('rejects a request with an invalid kind', () => {
    const { controller } = buildController();
    expect(() =>
      controller.order('enc-1', { clinicianId: 'clinician-1', kind: 'SCAN', testName: 'CBC' }),
    ).toThrow(BadRequestException);
  });
});

describe('DiagnosticsOrdersController result, release and cancel endpoints', () => {
  it('records, releases a result and reads it back', async () => {
    const { controller, charting } = buildController();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const order = await controller.order(encounter.id, { clinicianId: 'clinician-1', kind: 'LAB', testName: 'CBC' });

    const resulted = controller.recordResult(order.id, {
      resultSource: 'MANUAL',
      value: 'Within normal limits',
      recordedBy: 'clinician-1',
    });
    expect(resulted.result?.releaseStatus).toBe('HELD');

    const released = controller.release(order.id, { releasedBy: 'clinician-2' });
    expect(released.result?.releaseStatus).toBe('RELEASED');
    expect(controller.getOrder(order.id).result?.releaseStatus).toBe('RELEASED');
  });

  it('rejects a result body missing recordedBy', async () => {
    const { controller, charting } = buildController();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const order = await controller.order(encounter.id, { clinicianId: 'clinician-1', kind: 'LAB', testName: 'CBC' });

    expect(() => controller.recordResult(order.id, { resultSource: 'MANUAL', value: 'x' })).toThrow(
      BadRequestException,
    );
  });

  it('cancels an ORDERED order', async () => {
    const { controller, charting } = buildController();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const order = await controller.order(encounter.id, { clinicianId: 'clinician-1', kind: 'IMAGING', testName: 'Chest X-ray' });

    const cancelled = controller.cancel(order.id, { reason: 'Ordered in error' });

    expect(cancelled.status).toBe('CANCELLED');
  });
});

describe('DiagnosticsOrdersController.listOrders and getOrder', () => {
  it('lists orders filtered by patientId and reads one by id', async () => {
    const { controller, charting } = buildController();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const order = await controller.order(encounter.id, { clinicianId: 'clinician-1', kind: 'LAB', testName: 'CBC' });

    const listed = controller.listOrders('patient-1');
    expect(listed).toEqual({ orders: [order], total: 1 });
    expect(controller.getOrder(order.id)).toEqual(order);
  });
});

describe('DiagnosticsOrdersController.health', () => {
  it('reports UP', async () => {
    const { controller } = buildController();
    await expect(controller.health()).resolves.toEqual({ status: 'UP' });
  });
});
