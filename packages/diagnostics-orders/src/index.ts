import type {
  DiagnosticOrder,
  DiagnosticResult,
  OrderDiagnosticInput,
  RecordDiagnosticResultInput,
} from '@swasthya/shared-types';

/* ------------------------------------------------------------------ *
 * Diagnostics orders
 *
 * clinical-suite.md capability map row 7: "Lab and imaging orders +
 * results ... HL7 v2 where partners speak it; manual entry where they do
 * not." Pure domain layer only, matching every sibling clinical-suite
 * module's own split: `patientId`/`clinicianId`/`encounterId` are accepted
 * as already-resolved opaque ids (see
 * `apps/api/src/diagnostics-orders/diagnostics-orders.service.ts` for how
 * `encounterId` is actually resolved through `clinical-charting`'s port).
 *
 * The state machine is ORDERED -> RESULTED | CANCELLED, the same three-way
 * shape `packages/prescribing`'s DRAFT -> SIGNED | VOIDED already
 * established for "a clinical action moves through exactly one of two
 * end states, never back." A RESULTED order cannot be cancelled — see
 * `cancelDiagnosticOrder` below — a result can only be superseded by a new
 * order, never silently discarded.
 * ------------------------------------------------------------------ */

/**
 * Reused by every mutation that requires an order still awaiting a result
 * (`recordDiagnosticResult`, `cancelDiagnosticOrder`), the same way
 * `packages/prescribing`'s `PrescriptionNotDraftError` covers multiple
 * functions rather than each inventing its own "wrong state" error.
 */
export class DiagnosticOrderNotOpenError extends Error {
  constructor(id: string) {
    super(`Diagnostic order ${id} is not open — it already has a result or was cancelled`);
    this.name = 'DiagnosticOrderNotOpenError';
  }
}

/**
 * Rejected rather than silently idempotent, matching
 * `AppointmentAlreadyCancelledError`/`PrescriptionAlreadyVoidedError`'s own
 * precedent: a caller relying on this throwing to detect "did my cancel
 * actually do anything" would otherwise get a false positive.
 */
export class DiagnosticOrderAlreadyCancelledError extends Error {
  constructor(id: string) {
    super(`Diagnostic order ${id} is already cancelled`);
    this.name = 'DiagnosticOrderAlreadyCancelledError';
  }
}

export class DiagnosticResultNotHeldError extends Error {
  constructor(id: string) {
    super(`Diagnostic order ${id} has no held result to release`);
    this.name = 'DiagnosticResultNotHeldError';
  }
}

export function orderDiagnostic(
  id: string,
  patientId: string,
  encounterId: string,
  input: OrderDiagnosticInput,
  now: string,
): DiagnosticOrder {
  return {
    id,
    patientId,
    clinicianId: input.clinicianId,
    encounterId,
    kind: input.kind,
    testName: input.testName,
    status: 'ORDERED',
    result: null,
    cancelledAt: null,
    cancelReason: null,
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

function assertOpen(order: DiagnosticOrder): void {
  if (order.status !== 'ORDERED') throw new DiagnosticOrderNotOpenError(order.id);
}

/**
 * compliance-gap-register.md's "Lab results" row, interim control
 * "non-diagnostic flags; configurable hold" — enforced unconditionally
 * here: `nonDiagnostic` is always `true` and `releaseStatus` always starts
 * `HELD`. There is no parameter that lets a caller construct a released
 * result directly; `releaseDiagnosticResult` below is the only transition
 * that can move it to `RELEASED`. Same "refuse until the launch gate
 * passes" shape `packages/prescribing`'s `ControlledSubstanceDisabledError`
 * already established for row 6.
 */
export function recordDiagnosticResult(
  order: DiagnosticOrder,
  input: RecordDiagnosticResultInput,
  now: string,
): DiagnosticOrder {
  assertOpen(order);
  const result: DiagnosticResult = {
    resultSource: input.resultSource,
    value: input.value,
    nonDiagnostic: true,
    releaseStatus: 'HELD',
    recordedAt: now,
    recordedBy: input.recordedBy,
    releasedAt: null,
    releasedBy: null,
  };
  return { ...order, status: 'RESULTED', result, updatedAt: now, version: order.version + 1 };
}

/** The one transition that moves a held result to RELEASED — see this file's header for why nothing else may. */
export function releaseDiagnosticResult(order: DiagnosticOrder, releasedBy: string, now: string): DiagnosticOrder {
  if (order.result === null || order.result.releaseStatus !== 'HELD') {
    throw new DiagnosticResultNotHeldError(order.id);
  }
  return {
    ...order,
    result: { ...order.result, releaseStatus: 'RELEASED', releasedAt: now, releasedBy },
    updatedAt: now,
    version: order.version + 1,
  };
}

/**
 * Only reaches an ORDERED order — `assertOpen` rejects a RESULTED one with
 * `DiagnosticOrderNotOpenError` (a result is superseded by a new order,
 * never discarded), and an already-CANCELLED one gets its own more specific
 * error, checked first so the two wrong-state cases are distinguishable.
 */
export function cancelDiagnosticOrder(order: DiagnosticOrder, reason: string, now: string): DiagnosticOrder {
  if (order.status === 'CANCELLED') throw new DiagnosticOrderAlreadyCancelledError(order.id);
  assertOpen(order);
  return { ...order, status: 'CANCELLED', cancelledAt: now, cancelReason: reason, updatedAt: now, version: order.version + 1 };
}
