import type {
  Appointment,
  ClinicalSummaryItem,
  ClinicalSummaryKind,
  PopulationHealthRecallEntry,
  PopulationHealthRegistryEntry,
} from '@swasthya/shared-types';

/* ------------------------------------------------------------------ *
 * Population health
 *
 * clinical-suite.md capability map row 13: "Population health, registries,
 * recall ... Reads from other modules; never writes to them." Pure domain
 * layer only, matching medication-safety's own split: every list here is
 * already resolved and already scoped by an API-boundary caller (see
 * apps/api/src/population-health/population-health.service.ts) — this
 * package does no fetching, no patient- or status-filtering beyond what its
 * own parameters describe, and owns no repository because it has nothing to
 * persist.
 * ------------------------------------------------------------------ */

/**
 * NFKC + case-fold, the same normalisation `medication-safety`'s own
 * `normalizeLabel` uses — two labels for the same condition should match
 * regardless of capitalisation or Unicode composition, without this package
 * asserting which distinct labels mean the same thing clinically.
 */
function normalizeLabel(label: string): string {
  return label.normalize('NFKC').trim().toLowerCase();
}

/**
 * A registry of every patient with an ACTIVE `ClinicalSummaryItem` of the
 * given kind matching `label`. One entry per patient — a patient with more
 * than one matching item is kept once, at the first match found, rather
 * than once per item, since the registry answers "is this patient in it",
 * not "how many qualifying items does this patient have".
 */
export function buildConditionRegistry(
  summaryItems: readonly ClinicalSummaryItem[],
  kind: ClinicalSummaryKind,
  label: string,
): PopulationHealthRegistryEntry[] {
  const target = normalizeLabel(label);
  const byPatient = new Map<string, PopulationHealthRegistryEntry>();
  for (const item of summaryItems) {
    if (item.kind !== kind || item.status !== 'ACTIVE') continue;
    if (normalizeLabel(item.label) !== target) continue;
    if (byPatient.has(item.patientId)) continue;
    byPatient.set(item.patientId, { patientId: item.patientId, matchedItemId: item.id, label: item.label });
  }
  return [...byPatient.values()];
}

/**
 * For each registry patient, finds their soonest `SCHEDULED` appointment at
 * or after `asOf` and marks them due for recall when none exists. `asOf` is
 * a caller-supplied instant, never `Date.now()` computed in here — this
 * package stays a pure function of its inputs, the same reason every other
 * domain package in this repo takes `now` as a parameter rather than
 * reading the clock itself.
 */
export function buildRecallList(
  registry: readonly PopulationHealthRegistryEntry[],
  appointments: readonly Appointment[],
  asOf: string,
): PopulationHealthRecallEntry[] {
  return registry.map((entry) => {
    const upcoming = appointments
      .filter((appointment) => appointment.patientId === entry.patientId)
      .filter((appointment) => appointment.status === 'SCHEDULED')
      .filter((appointment) => appointment.scheduledStart >= asOf)
      .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));
    const nextScheduledAppointmentAt = upcoming[0]?.scheduledStart ?? null;
    return { ...entry, nextScheduledAppointmentAt, dueForRecall: nextScheduledAppointmentAt === null };
  });
}
