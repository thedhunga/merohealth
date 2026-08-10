import { Injectable } from '@nestjs/common';
import { checkMedicationSafety } from '@swasthya/medication-safety';
import type { ClinicalModuleHealth, MedicationSafetyCheckResult } from '@swasthya/shared-types';
import { ClinicalSummaryService } from '../clinical-summary/clinical-summary.service.js';
import { MedicationSafetyRepository } from './medication-safety.repository.js';

/**
 * clinical-suite.md capability map row 5, "built before prescribing, so
 * prescribing can degrade against it": this service is itself the "drug
 * database" §2's own worked example describes. Its one dependency is
 * clinical-summary — row 4, the owner of the patient's allergy and
 * medication list — injected as `ClinicalSummaryService`, its public port,
 * never its repository (§2 rule 3).
 */
@Injectable()
export class MedicationSafetyService {
  constructor(
    private readonly repository: MedicationSafetyRepository,
    private readonly clinicalSummary: ClinicalSummaryService,
  ) {}

  /**
   * MANUAL degradation, applied one hop earlier than §2's own
   * prescribing-vs-medication-safety framing: if clinical-summary cannot be
   * read, this returns `checked: false` rather than throwing or silently
   * reporting "no conflicts" — a caller must be able to tell "verified
   * clean" apart from "never verified."
   */
  async checkMedication(patientId: string, proposedLabel: string): Promise<MedicationSafetyCheckResult> {
    const summaryHealth = await this.clinicalSummary.health();
    if (summaryHealth.status === 'DOWN') {
      return { proposedLabel, findings: [], interactionRulesConsulted: 0, checked: false };
    }

    const items = this.clinicalSummary.listItems(patientId);
    const activeAllergies = items.filter((item) => item.kind === 'ALLERGY' && item.status === 'ACTIVE');
    const activeMedications = items.filter((item) => item.kind === 'MEDICATION' && item.status === 'ACTIVE');

    return checkMedicationSafety(proposedLabel, activeAllergies, activeMedications, this.repository.listInteractionRules());
  }

  /**
   * clinical-suite.md §2's `ModuleDescriptor.health()`. Reports this
   * module's own condition only — its degradation against clinical-summary
   * is computed separately by `resolveAvailability`, the same split
   * `ClinicalSummaryService.health()` already draws against clinical-charting.
   */
  health(): Promise<ClinicalModuleHealth> {
    return Promise.resolve({ status: 'UP' });
  }
}
