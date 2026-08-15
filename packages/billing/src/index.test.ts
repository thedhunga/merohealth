import type { Invoice } from '@swasthya/shared-types';
import { describe, expect, it } from 'vitest';
import {
  addLineItem,
  EmptyInvoiceError,
  InvoiceAlreadyVoidedError,
  InvoiceNotDraftError,
  InvoiceNotIssuedError,
  InvoicePaidCannotBeVoidedError,
  invoiceTotalPaisa,
  issueInvoice,
  openInvoice,
  recordPayment,
  voidInvoice,
} from './index.js';

const lineInput = { description: 'Outpatient consultation', amountPaisa: 150000, payerType: 'CASH' as const };

function makeDraft(): Invoice {
  return openInvoice('inv-1', 'patient-1', 'enc-1', { clinicianId: 'clinician-1' }, '2026-08-11T00:00:00.000Z');
}

describe('openInvoice', () => {
  it('builds a DRAFT invoice at version 1 with no line items and no payment yet', () => {
    const invoice = makeDraft();

    expect(invoice).toEqual({
      id: 'inv-1',
      patientId: 'patient-1',
      clinicianId: 'clinician-1',
      encounterId: 'enc-1',
      status: 'DRAFT',
      lineItems: [],
      issuedAt: null,
      payment: null,
      voidedAt: null,
      voidReason: null,
      createdAt: '2026-08-11T00:00:00.000Z',
      updatedAt: '2026-08-11T00:00:00.000Z',
      version: 1,
    });
  });
});

describe('addLineItem', () => {
  it('appends a line item and bumps version', () => {
    const withItem = addLineItem(makeDraft(), 'item-1', lineInput, '2026-08-11T00:05:00.000Z');

    expect(withItem.lineItems).toEqual([{ id: 'item-1', ...lineInput }]);
    expect(withItem.version).toBe(2);
  });

  it('accepts independently payer-typed line items on the same invoice', () => {
    const withCash = addLineItem(makeDraft(), 'item-1', lineInput, '2026-08-11T00:05:00.000Z');
    const withBoth = addLineItem(
      withCash,
      'item-2',
      { description: 'Lab panel co-pay', amountPaisa: 50000, payerType: 'INSURANCE' },
      '2026-08-11T00:06:00.000Z',
    );

    expect(withBoth.lineItems.map((item) => item.payerType)).toEqual(['CASH', 'INSURANCE']);
  });

  it('refuses to add a line item once the invoice is issued', () => {
    const withItem = addLineItem(makeDraft(), 'item-1', lineInput, '2026-08-11T00:05:00.000Z');
    const issued = issueInvoice(withItem, '2026-08-11T00:10:00.000Z');

    expect(() => addLineItem(issued, 'item-2', lineInput, '2026-08-11T00:15:00.000Z')).toThrow(InvoiceNotDraftError);
  });
});

describe('issueInvoice', () => {
  it('locks the invoice and records when', () => {
    const withItem = addLineItem(makeDraft(), 'item-1', lineInput, '2026-08-11T00:05:00.000Z');

    const issued = issueInvoice(withItem, '2026-08-11T00:10:00.000Z');

    expect(issued.status).toBe('ISSUED');
    expect(issued.issuedAt).toBe('2026-08-11T00:10:00.000Z');
    expect(issued.version).toBe(3);
  });

  it('refuses to issue an invoice with no line items', () => {
    expect(() => issueInvoice(makeDraft(), '2026-08-11T00:10:00.000Z')).toThrow(EmptyInvoiceError);
  });

  it('refuses to issue an already-issued invoice', () => {
    const withItem = addLineItem(makeDraft(), 'item-1', lineInput, '2026-08-11T00:05:00.000Z');
    const issued = issueInvoice(withItem, '2026-08-11T00:10:00.000Z');

    expect(() => issueInvoice(issued, '2026-08-11T00:15:00.000Z')).toThrow(InvoiceNotDraftError);
  });
});

describe('recordPayment', () => {
  it('settles an issued invoice, always through the MOCK provider', () => {
    const withItem = addLineItem(makeDraft(), 'item-1', lineInput, '2026-08-11T00:05:00.000Z');
    const issued = issueInvoice(withItem, '2026-08-11T00:10:00.000Z');

    const paid = recordPayment(issued, { reference: 'receipt-001', recordedBy: 'clinician-1' }, '2026-08-11T00:20:00.000Z');

    expect(paid.status).toBe('PAID');
    expect(paid.payment).toEqual({
      provider: 'MOCK',
      reference: 'receipt-001',
      paidAt: '2026-08-11T00:20:00.000Z',
      recordedBy: 'clinician-1',
    });
    expect(paid.version).toBe(4);
  });

  it('refuses to record a payment against a draft', () => {
    expect(() =>
      recordPayment(makeDraft(), { reference: 'receipt-001', recordedBy: 'clinician-1' }, '2026-08-11T00:20:00.000Z'),
    ).toThrow(InvoiceNotIssuedError);
  });

  it('refuses to record a second payment against an already-paid invoice', () => {
    const withItem = addLineItem(makeDraft(), 'item-1', lineInput, '2026-08-11T00:05:00.000Z');
    const issued = issueInvoice(withItem, '2026-08-11T00:10:00.000Z');
    const paid = recordPayment(issued, { reference: 'receipt-001', recordedBy: 'clinician-1' }, '2026-08-11T00:20:00.000Z');

    expect(() =>
      recordPayment(paid, { reference: 'receipt-002', recordedBy: 'clinician-1' }, '2026-08-11T00:25:00.000Z'),
    ).toThrow(InvoiceNotIssuedError);
  });
});

describe('voidInvoice', () => {
  it('voids a draft invoice and records the reason', () => {
    const voided = voidInvoice(makeDraft(), 'Opened in error', '2026-08-11T00:05:00.000Z');

    expect(voided.status).toBe('VOID');
    expect(voided.voidedAt).toBe('2026-08-11T00:05:00.000Z');
    expect(voided.voidReason).toBe('Opened in error');
    expect(voided.version).toBe(2);
  });

  it('voids an issued (but unpaid) invoice', () => {
    const withItem = addLineItem(makeDraft(), 'item-1', lineInput, '2026-08-11T00:05:00.000Z');
    const issued = issueInvoice(withItem, '2026-08-11T00:10:00.000Z');

    const voided = voidInvoice(issued, 'Patient billed twice', '2026-08-11T00:15:00.000Z');

    expect(voided.status).toBe('VOID');
    expect(voided.version).toBe(4);
  });

  it('refuses to void an already-voided invoice', () => {
    const voided = voidInvoice(makeDraft(), 'Opened in error', '2026-08-11T00:05:00.000Z');

    expect(() => voidInvoice(voided, 'Again', '2026-08-11T00:10:00.000Z')).toThrow(InvoiceAlreadyVoidedError);
  });

  it('refuses to void a paid invoice — there is no refund path to reverse it honestly', () => {
    const withItem = addLineItem(makeDraft(), 'item-1', lineInput, '2026-08-11T00:05:00.000Z');
    const issued = issueInvoice(withItem, '2026-08-11T00:10:00.000Z');
    const paid = recordPayment(issued, { reference: 'receipt-001', recordedBy: 'clinician-1' }, '2026-08-11T00:20:00.000Z');

    expect(() => voidInvoice(paid, 'Changed my mind', '2026-08-11T00:25:00.000Z')).toThrow(
      InvoicePaidCannotBeVoidedError,
    );
  });
});

describe('invoiceTotalPaisa', () => {
  it('sums every line item, never stored on the invoice itself', () => {
    const withCash = addLineItem(makeDraft(), 'item-1', lineInput, '2026-08-11T00:05:00.000Z');
    const withBoth = addLineItem(
      withCash,
      'item-2',
      { description: 'Lab panel co-pay', amountPaisa: 50000, payerType: 'INSURANCE' },
      '2026-08-11T00:06:00.000Z',
    );

    expect(invoiceTotalPaisa(withBoth)).toBe(200000);
  });

  it('is zero for a draft with no line items', () => {
    expect(invoiceTotalPaisa(makeDraft())).toBe(0);
  });
});
