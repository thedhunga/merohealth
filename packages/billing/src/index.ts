import type {
  BillingLineItem,
  BillingLineItemInput,
  Invoice,
  OpenInvoiceInput,
  PaymentRecord,
  RecordPaymentInput,
} from '@swasthya/shared-types';

/* ------------------------------------------------------------------ *
 * Billing
 *
 * clinical-suite.md capability map row 10: "Billing, claims, revenue cycle
 * ... Nepal: cash, insurance boards, NHIF. Not X12." Pure domain layer
 * only, matching every sibling clinical-suite module's own split:
 * `patientId`/`clinicianId`/`encounterId` are accepted as already-resolved
 * opaque ids (see `apps/api/src/billing/billing.service.ts` for how
 * `encounterId` is actually resolved through `clinical-charting`'s port).
 *
 * The state machine is DRAFT -> ISSUED -> PAID, the same three-state shape
 * `packages/prescribing`'s DRAFT -> SIGNED -> VOIDED already established
 * for "line items accumulate, then a single transition locks them." DRAFT
 * and ISSUED are both also reachable to VOID; PAID is not — see
 * shared-types' own comment on why reversing a paid invoice is a refund
 * this repository has no honest path to model yet.
 * ------------------------------------------------------------------ */

/**
 * Reused by `addLineItem` and `issueInvoice`, the same way
 * `packages/prescribing`'s `PrescriptionNotDraftError` covers multiple
 * functions rather than each inventing its own "wrong state" error.
 */
export class InvoiceNotDraftError extends Error {
  constructor(id: string) {
    super(`Invoice ${id} is not a draft`);
    this.name = 'InvoiceNotDraftError';
  }
}

/** Issuing an empty invoice would bill for nothing — reject rather than allow a no-op issuance. */
export class EmptyInvoiceError extends Error {
  constructor(id: string) {
    super(`Invoice ${id} has no line items to issue`);
    this.name = 'EmptyInvoiceError';
  }
}

/** A payment can only settle an issued invoice — a draft has no locked total to pay against. */
export class InvoiceNotIssuedError extends Error {
  constructor(id: string) {
    super(`Invoice ${id} is not issued`);
    this.name = 'InvoiceNotIssuedError';
  }
}

/**
 * Rejected rather than silently idempotent, matching
 * `PrescriptionAlreadyVoidedError`/`DiagnosticOrderAlreadyCancelledError`'s
 * own precedent: a caller relying on this throwing to detect "did my void
 * actually do anything" would otherwise get a false positive.
 */
export class InvoiceAlreadyVoidedError extends Error {
  constructor(id: string) {
    super(`Invoice ${id} is already voided`);
    this.name = 'InvoiceAlreadyVoidedError';
  }
}

/** See shared-types' own comment: reversing a paid invoice is a refund this repository has no path for yet. */
export class InvoicePaidCannotBeVoidedError extends Error {
  constructor(id: string) {
    super(`Invoice ${id} is already paid and cannot be voided — a paid invoice has no refund path in this system yet`);
    this.name = 'InvoicePaidCannotBeVoidedError';
  }
}

export function openInvoice(
  id: string,
  patientId: string,
  encounterId: string,
  input: OpenInvoiceInput,
  now: string,
): Invoice {
  return {
    id,
    patientId,
    clinicianId: input.clinicianId,
    encounterId,
    status: 'DRAFT',
    lineItems: [],
    issuedAt: null,
    payment: null,
    voidedAt: null,
    voidReason: null,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

function assertDraft(invoice: Invoice): void {
  if (invoice.status !== 'DRAFT') throw new InvoiceNotDraftError(invoice.id);
}

export function addLineItem(invoice: Invoice, id: string, input: BillingLineItemInput, now: string): Invoice {
  assertDraft(invoice);

  const lineItem: BillingLineItem = {
    id,
    description: input.description,
    amountPaisa: input.amountPaisa,
    payerType: input.payerType,
  };
  return { ...invoice, lineItems: [...invoice.lineItems, lineItem], updatedAt: now, version: invoice.version + 1 };
}

/**
 * The "sign and lock" transition itself: once this returns, the invoice is
 * locked (`assertDraft` above refuses any further line item). Requires at
 * least one line item — the same reasoning `packages/prescribing`'s
 * `EmptyPrescriptionError` already established for signing nothing.
 */
export function issueInvoice(invoice: Invoice, now: string): Invoice {
  assertDraft(invoice);
  if (invoice.lineItems.length === 0) throw new EmptyInvoiceError(invoice.id);

  return { ...invoice, status: 'ISSUED', issuedAt: now, updatedAt: now, version: invoice.version + 1 };
}

/**
 * The compliance register's "mock provider" interim control, enforced
 * unconditionally: `provider` is always `'MOCK'` — see shared-types' own
 * comment on why no second, "real" value is declared. No money moves when
 * this runs; it only records that a payment was taken through some
 * offline or as-yet-unbuilt channel.
 */
export function recordPayment(invoice: Invoice, input: RecordPaymentInput, now: string): Invoice {
  if (invoice.status !== 'ISSUED') throw new InvoiceNotIssuedError(invoice.id);

  const payment: PaymentRecord = { provider: 'MOCK', reference: input.reference, paidAt: now, recordedBy: input.recordedBy };
  return { ...invoice, status: 'PAID', payment, updatedAt: now, version: invoice.version + 1 };
}

/**
 * Reaches a DRAFT or ISSUED invoice — a PAID one gets its own more specific
 * error (see `InvoicePaidCannotBeVoidedError`'s own comment), and an
 * already-VOID one gets its own, checked first so the two wrong-state cases
 * are distinguishable.
 */
export function voidInvoice(invoice: Invoice, reason: string, now: string): Invoice {
  if (invoice.status === 'VOID') throw new InvoiceAlreadyVoidedError(invoice.id);
  if (invoice.status === 'PAID') throw new InvoicePaidCannotBeVoidedError(invoice.id);

  return { ...invoice, status: 'VOID', voidedAt: now, voidReason: reason, updatedAt: now, version: invoice.version + 1 };
}

/** Derived, never stored — the same reasoning that keeps every other clinical-suite total off its own entity. */
export function invoiceTotalPaisa(invoice: Invoice): number {
  return invoice.lineItems.reduce((sum, item) => sum + item.amountPaisa, 0);
}
