import type {
  Appointment,
  AppointmentStatus,
  BillingSummary,
  Invoice,
  InvoiceStatus,
  PatientRecord,
  PatientRegistrySummary,
  PatientSex,
  SchedulingSummary,
} from '@swasthya/shared-types';

/* ------------------------------------------------------------------ *
 * Analytics
 *
 * clinical-suite.md capability map row 14: "Analytics and dashboards ...
 * Read-only replica. Must never slow the clinical path." Pure domain layer
 * only, the same split population-health (row 13) already established: no
 * fetching, no filtering beyond what each function's own parameters
 * describe, no repository — this package has nothing of its own to persist.
 * Every summary is a count of a list already resolved by the caller (see
 * apps/api/src/analytics/analytics.service.ts).
 *
 * Each summary counts exactly what its source module already recorded.
 * Nothing here defines a target, a benchmark or a "normal" range for any
 * count — that would be an operational claim this repository has no source
 * for, the same class of invention "invent no facts" already forbids for a
 * statistic or a partner name.
 * ------------------------------------------------------------------ */

const PATIENT_SEXES: readonly PatientSex[] = ['FEMALE', 'MALE', 'OTHER', 'UNDISCLOSED'];
const APPOINTMENT_STATUSES: readonly AppointmentStatus[] = ['SCHEDULED', 'CANCELLED'];
const INVOICE_STATUSES: readonly InvoiceStatus[] = ['DRAFT', 'ISSUED', 'PAID', 'VOID'];

/** Every key starts at zero so a status with no rows yet still appears in the summary. */
function zeroCounts<T extends string>(keys: readonly T[]): Record<T, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>;
}

export function buildPatientRegistrySummary(patients: readonly PatientRecord[]): PatientRegistrySummary {
  const bySex = zeroCounts(PATIENT_SEXES);
  for (const patient of patients) bySex[patient.demographics.sex] += 1;
  return { totalPatients: patients.length, bySex };
}

export function buildSchedulingSummary(appointments: readonly Appointment[]): SchedulingSummary {
  const byStatus = zeroCounts(APPOINTMENT_STATUSES);
  for (const appointment of appointments) byStatus[appointment.status] += 1;
  return { totalAppointments: appointments.length, byStatus };
}

export function buildBillingSummary(invoices: readonly Invoice[]): BillingSummary {
  const byStatus = zeroCounts(INVOICE_STATUSES);
  for (const invoice of invoices) byStatus[invoice.status] += 1;
  return { totalInvoices: invoices.length, byStatus };
}
