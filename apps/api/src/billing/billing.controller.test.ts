import { BadRequestException } from '@nestjs/common';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { RecordsRepository } from '../records/records.repository.js';
import { RecordsService } from '../records/records.service.js';
import { BillingController } from './billing.controller.js';
import { BillingRepository } from './billing.repository.js';
import { BillingService } from './billing.service.js';

function buildController() {
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  const billing = new BillingService(new BillingRepository(), charting);
  const controller = new BillingController(billing);
  return { controller, charting };
}

describe('BillingController.openInvoice', () => {
  it('opens a DRAFT invoice against an encounter', async () => {
    const { controller, charting } = buildController();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });

    const invoice = await controller.openInvoice(encounter.id, { clinicianId: 'clinician-1' });

    expect(invoice.status).toBe('DRAFT');
  });

  it('rejects a request with no clinicianId', () => {
    const { controller } = buildController();
    expect(() => controller.openInvoice('enc-1', {})).toThrow(BadRequestException);
  });
});

describe('BillingController.addLineItem, issueInvoice and recordPayment', () => {
  it('adds a line item, issues, records a payment and reads it back', async () => {
    const { controller, charting } = buildController();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const invoice = await controller.openInvoice(encounter.id, { clinicianId: 'clinician-1' });

    const withItem = controller.addLineItem(invoice.id, {
      description: 'Outpatient consultation',
      amountPaisa: 150000,
      payerType: 'CASH',
    });
    expect(withItem.lineItems).toHaveLength(1);

    const issued = controller.issueInvoice(invoice.id);
    expect(issued.status).toBe('ISSUED');

    const paid = controller.recordPayment(invoice.id, { reference: 'receipt-001', recordedBy: 'clinician-1' });
    expect(paid.status).toBe('PAID');
    expect(controller.getInvoice(invoice.id).status).toBe('PAID');
  });

  it('rejects a line item with a non-positive amount', async () => {
    const { controller, charting } = buildController();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const invoice = await controller.openInvoice(encounter.id, { clinicianId: 'clinician-1' });

    expect(() =>
      controller.addLineItem(invoice.id, { description: 'Free item', amountPaisa: 0, payerType: 'CASH' }),
    ).toThrow(BadRequestException);
  });

  it('rejects a line item with an unrecognised payer type', async () => {
    const { controller, charting } = buildController();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const invoice = await controller.openInvoice(encounter.id, { clinicianId: 'clinician-1' });

    expect(() =>
      controller.addLineItem(invoice.id, { description: 'X12 claim', amountPaisa: 100, payerType: 'X12' }),
    ).toThrow(BadRequestException);
  });
});

describe('BillingController.voidInvoice', () => {
  it('voids a draft invoice', async () => {
    const { controller, charting } = buildController();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const invoice = await controller.openInvoice(encounter.id, { clinicianId: 'clinician-1' });

    const voided = controller.voidInvoice(invoice.id, { reason: 'Opened in error' });

    expect(voided.status).toBe('VOID');
  });

  it('rejects a void request missing a reason', async () => {
    const { controller, charting } = buildController();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const invoice = await controller.openInvoice(encounter.id, { clinicianId: 'clinician-1' });

    expect(() => controller.voidInvoice(invoice.id, {})).toThrow(BadRequestException);
  });
});

describe('BillingController.listInvoices and getInvoice', () => {
  it('lists invoices filtered by patientId and reads one by id', async () => {
    const { controller, charting } = buildController();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const invoice = await controller.openInvoice(encounter.id, { clinicianId: 'clinician-1' });

    const listed = controller.listInvoices('patient-1');
    expect(listed).toEqual({ invoices: [invoice], total: 1 });
    expect(controller.getInvoice(invoice.id)).toEqual(invoice);
  });
});

describe('BillingController.health', () => {
  it('reports UP', async () => {
    const { controller } = buildController();
    await expect(controller.health()).resolves.toEqual({ status: 'UP' });
  });
});
