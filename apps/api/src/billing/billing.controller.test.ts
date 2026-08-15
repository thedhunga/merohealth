import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { describe, expect, it } from 'vitest';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
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

function currentUserFor(subjectId: string): CurrentUserResult {
  return {
    subjectId,
    user: { id: subjectId, phone: '9800000000', role: 'PATIENT', locale: 'ne', assuranceLevel: 'REGISTERED' },
    patientProfileId: null,
    assuranceLevel: 'REGISTERED',
  };
}

// Nest's own `@UseGuards` metadata key — see TeleconsultationController's
// own test suite for why this mirrors the Nest-internal constant directly.
const GUARDS_METADATA = '__guards__';
const controllerProto = BillingController.prototype as unknown as Record<string, () => unknown>;

function guardsFor(method: string): unknown {
  return Reflect.getMetadata(GUARDS_METADATA, controllerProto[method]!);
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
    expect(controller.getInvoice(currentUserFor('patient-1'), invoice.id).status).toBe('PAID');
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

describe('BillingController entitlement wiring', () => {
  // A prior version of this file left `listInvoices`/`getInvoice` fully
  // unauthenticated: `GET /billing/invoices` with no `patientId` query param
  // returned every patient's invoices system-wide, and `GET
  // /billing/invoices/:invoiceId` read any invoice by a guessed or leaked
  // id — the same gap `TeleconsultationController` had for all six of its
  // non-`schedule` routes, fixed one run earlier.
  it('gates listInvoices and getInvoice behind SessionAuthGuard', () => {
    expect(guardsFor('listInvoices')).toEqual([SessionAuthGuard]);
    expect(guardsFor('getInvoice')).toEqual([SessionAuthGuard]);
  });

  // These stay ungated deliberately — see the controller's own doc comment
  // for why gating clinic/billing-staff actions behind a *patient* session
  // guard would make them unusable, not correct.
  it('leaves the staff-side mutation routes and health check ungated', () => {
    const ungated = ['openInvoice', 'addLineItem', 'issueInvoice', 'recordPayment', 'voidInvoice', 'health'];
    for (const method of ungated) {
      expect(guardsFor(method)).toBeUndefined();
    }
  });
});

describe('BillingController.listInvoices and getInvoice', () => {
  it("lists only the signed-in caller's own invoices and reads one by id", async () => {
    const { controller, charting } = buildController();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const invoice = await controller.openInvoice(encounter.id, { clinicianId: 'clinician-1' });
    const user = currentUserFor('patient-1');

    const listed = controller.listInvoices(user);
    expect(listed).toEqual({ invoices: [invoice], total: 1 });
    expect(controller.getInvoice(user, invoice.id)).toEqual(invoice);
  });

  it('404s a real invoice id that belongs to a different caller', async () => {
    const { controller, charting } = buildController();
    const encounter = charting.openEncounter({ patientId: 'patient-1', clinicianId: 'clinician-1' });
    const invoice = await controller.openInvoice(encounter.id, { clinicianId: 'clinician-1' });
    const stranger = currentUserFor('someone-else');

    expect(controller.listInvoices(stranger)).toEqual({ invoices: [], total: 0 });
    expect(() => controller.getInvoice(stranger, invoice.id)).toThrow(NotFoundException);
  });
});

describe('BillingController.health', () => {
  it('reports UP', async () => {
    const { controller } = buildController();
    await expect(controller.health()).resolves.toEqual({ status: 'UP' });
  });
});
