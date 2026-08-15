import type {
  ClinicalSummaryItem,
  DrugInteractionRule,
  MedicationSafetyCheckResult,
  MedicationSafetyFinding,
} from '@swasthya/shared-types';
import { normalizeLabel } from '@swasthya/text-normalization';

/* ------------------------------------------------------------------ *
 * Medication safety
 *
 * clinical-suite.md capability map row 5: "Drug interaction / allergy
 * checking ... Built before prescribing, so prescribing can degrade
 * against it." Pure domain layer only, matching clinical-summary's own
 * split: `patientId` is never touched here, only the already-resolved
 * `ClinicalSummaryItem` lists an API-boundary caller fetched for one
 * patient (see apps/api/src/medication-safety/medication-safety.service.ts).
 * ------------------------------------------------------------------ */

/**
 * Checks a proposed medication label against a patient's currently active
 * allergies and medications, plus whatever interaction ruleset the caller
 * supplies. All three list inputs are trusted as already scoped to one
 * patient and already filtered to `status: 'ACTIVE'` — this function does
 * no patient- or status-filtering of its own, the same trust
 * `recordPatientReportedItem` et al. place in their own already-resolved
 * inputs.
 */
export function checkMedicationSafety(
  proposedLabel: string,
  activeAllergies: readonly ClinicalSummaryItem[],
  activeMedications: readonly ClinicalSummaryItem[],
  interactionRules: readonly DrugInteractionRule[],
): MedicationSafetyCheckResult {
  const proposed = normalizeLabel(proposedLabel);
  const findings: MedicationSafetyFinding[] = [];

  for (const allergy of activeAllergies) {
    if (normalizeLabel(allergy.label) === proposed) {
      findings.push({
        kind: 'ALLERGY_CONFLICT',
        conflictsWithItemId: allergy.id,
        detail: `Patient has an active recorded allergy to "${allergy.label}"`,
      });
    }
  }

  for (const medication of activeMedications) {
    if (normalizeLabel(medication.label) === proposed) {
      findings.push({
        kind: 'DUPLICATE_THERAPY',
        conflictsWithItemId: medication.id,
        detail: `Patient already has an active recorded medication "${medication.label}"`,
      });
    }
  }

  for (const medication of activeMedications) {
    const existing = normalizeLabel(medication.label);
    const rule = interactionRules.find((candidate) => {
      const a = normalizeLabel(candidate.medicationA);
      const b = normalizeLabel(candidate.medicationB);
      return (a === proposed && b === existing) || (a === existing && b === proposed);
    });
    if (rule) findings.push({ kind: 'DRUG_INTERACTION', conflictsWithItemId: medication.id, detail: rule.detail });
  }

  return { proposedLabel, findings, interactionRulesConsulted: interactionRules.length, checked: true };
}
