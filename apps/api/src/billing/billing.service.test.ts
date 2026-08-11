import { ServiceUnavailableException } from '@nestjs/common';
import { InvoiceNotDraftError } from '@swasthya/billing';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import { ClinicalChartingRepository } from '../clinical-charting/clinical-charting.repository.js';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { RecordsRepository } from '../records/records.repository.js';
import { RecordsService } from '../records/records.service.js';
import { BillingRepository } from './billing.repository.js';
import { BillingService } from './billing.service.js';

function buildStack() {
  const documents = new RecordsService(new RecordsRepository(), new InMemoryDocumentStore('HOSTED'));
  const charting = new ClinicalChartingService(new ClinicalChartingRepository(), documents);
  const billing = new BillingService(new BillingRepository(), charting);
  return { charting, billing };
}

const lineItemInput = { description: 'Outpatient consultation', amountPaisa: 150000, payerType: 'CASH' as const };

describe('BillingService.openInvoice', () => {
  it('opens a DRAFT invoice against an encounter, deriving patientId from it', async () => {
    const { charting, billing } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });

    const invoice = await billing.openInvoice(encounter.id, { clinicianId: 'clinician-1' });

    expect(invoice.status).toBe('DRAFT');
    expect(invoice.patientId).toBe('patient-1');
    expect(invoice.encounterId).toBe(encounter.id);
  });

  it('refuses to open an invoice while clinical-charting is down', async () => {
    const { charting, billing } = buildStack();
    charting.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(billing.openInvoice('enc-1', { clinicianId: 'clinician-1' })).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});

describe('BillingService.addLineItem, issueInvoice, recordPayment and getInvoice', () => {
  it('adds a line item, issues, records a payment, then reads the invoice back', async () => {
    const { charting, billing } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const invoice = await billing.openInvoice(encounter.id, { clinicianId: 'clinician-1' });

    const withItem = billing.addLineItem(invoice.id, lineItemInput);
    expect(withItem.lineItems).toHaveLength(1);

    const issued = billing.issueInvoice(invoice.id);
    expect(issued.status).toBe('ISSUED');

    const paid = billing.recordPayment(invoice.id, { reference: 'receipt-001', recordedBy: 'clinician-1' });
    expect(paid.status).toBe('PAID');
    expect(paid.payment).toMatchObject({ provider: 'MOCK', reference: 'receipt-001' });
    expect(billing.getInvoice(invoice.id).status).toBe('PAID');
  });

  it('adding a line item never touches clinical-charting — still works while it is down', async () => {
    const { charting, billing } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const invoice = await billing.openInvoice(encounter.id, { clinicianId: 'clinician-1' });
    charting.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    const withItem = billing.addLineItem(invoice.id, lineItemInput);
    expect(withItem.lineItems).toHaveLength(1);
  });

  it('propagates the domain error refusing a line item on an already-issued invoice', async () => {
    const { charting, billing } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const invoice = await billing.openInvoice(encounter.id, { clinicianId: 'clinician-1' });
    billing.addLineItem(invoice.id, lineItemInput);
    billing.issueInvoice(invoice.id);

    expect(() => billing.addLineItem(invoice.id, lineItemInput)).toThrow(InvoiceNotDraftError);
  });
});

describe('BillingService.voidInvoice', () => {
  it('voids a draft invoice', async () => {
    const { charting, billing } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const invoice = await billing.openInvoice(encounter.id, { clinicianId: 'clinician-1' });

    const voided = billing.voidInvoice(invoice.id, 'Opened in error');

    expect(voided.status).toBe('VOID');
    expect(voided.voidReason).toBe('Opened in error');
  });
});

describe('BillingService.listInvoices', () => {
  it('lists invoices filtered by patientId', async () => {
    const { charting, billing } = buildStack();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const invoice = await billing.openInvoice(encounter.id, { clinicianId: 'clinician-1' });

    expect(billing.listInvoices('patient-1')).toEqual([invoice]);
    expect(billing.listInvoices('patient-2')).toEqual([]);
  });
});

describe('BillingService.health', () => {
  it('reports UP with no failure mode of its own', async () => {
    const { billing } = buildStack();
    await expect(billing.health()).resolves.toEqual({ status: 'UP' });
  });
});
