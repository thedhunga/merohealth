import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ControlledSubstanceDisabledError,
  EmptyPrescriptionError,
  PrescriptionAlreadyVoidedError,
  PrescriptionNotDraftError,
  PrescriptionNotSignedError,
  addPrescriptionLine,
  openPrescription,
  signPrescription,
  voidPrescription,
} from '@swasthya/prescribing';
import type {
  ClinicalModuleHealth,
  MedicationSafetyFinding,
  OpenPrescriptionInput,
  Prescription,
  PrescriptionLineInput,
  PrescriptionSafetyCheckStatus,
} from '@swasthya/shared-types';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { MedicationSafetyService } from '../medication-safety/medication-safety.service.js';
import { PrescribingRepository } from './prescribing.repository.js';

/**
 * clinical-suite.md capability map row 6: "Nepali formulary, not US EPCS.
 * Safety-critical." Two module ports are injected, per §2 rule 3 (a
 * module's public port, never its repository): `ClinicalChartingService`
 * to resolve the encounter a prescription is opened against — the same
 * pattern `ClinicalSummaryService.recordClinicianAuthored` already
 * established — and `MedicationSafetyService` to run row 5's interaction
 * and allergy checking at sign time, §2's own worked example.
 */
@Injectable()
export class PrescribingService {
  constructor(
    private readonly repository: PrescribingRepository,
    private readonly charting: ClinicalChartingService,
    private readonly medicationSafety: MedicationSafetyService,
  ) {}

  /**
   * The one action gated on clinical-charting. §2's `HIDE` mode has no
   * literal surface to hide yet — this stays API-only, like every
   * clinical-suite module before a clinician-facing shell exists — so the
   * honest equivalent is refusing the call outright rather than opening a
   * prescription this module cannot attribute to a real encounter.
   */
  async openPrescription(encounterId: string, input: OpenPrescriptionInput): Promise<Prescription> {
    await this.assertClinicalChartingAvailable();
    // encounterId resolved through clinical-charting's own port (§2 rule 1)
    // — throws NotFoundException for an id that was never opened there.
    // Also supplies patientId, so a caller cannot claim a patient that
    // disagrees with the encounter it is nested under.
    const encounter = this.charting.getEncounter(encounterId);
    return this.repository.save(
      openPrescription(randomUUID(), encounter.patientId, encounterId, input, new Date().toISOString()),
    );
  }

  private async assertClinicalChartingAvailable(): Promise<void> {
    const health = await this.charting.health();
    if (health.status === 'DOWN') {
      throw new ServiceUnavailableException(
        'Prescribing unavailable: clinical-charting is down (clinical-suite.md capability map row 6)',
      );
    }
  }

  getPrescription(id: string): Prescription {
    const prescription = this.repository.find(id);
    if (!prescription) throw new NotFoundException(`No prescription ${id}`);
    return prescription;
  }

  /**
   * The patient-facing read: `ownerId` is the only access-control here, the
   * same "belongs to someone else 404s like it doesn't exist" rule
   * `referrals.service.ts`'s `getOwnReferral` uses — a prescriptionId leaked
   * or guessed by a caller who isn't its patient must not be readable by
   * them (drug names, dosages and controlled-substance flags). `getPrescription`
   * above stays ownerId-free: `addLine`/`signPrescription`/`voidPrescription`
   * all call it with no patient session identity to check against.
   */
  getOwnPrescription(id: string, ownerId: string): Prescription {
    const prescription = this.getPrescription(id);
    if (prescription.patientId !== ownerId) throw new NotFoundException(`No prescription ${id}`);
    return prescription;
  }

  listPrescriptions(patientId?: string): Prescription[] {
    return this.repository.list(patientId);
  }

  /**
   * Adding a line never touches clinical-charting or medication-safety —
   * only signing does — so composing a draft keeps working even if either
   * dependency is unavailable.
   *
   * Wraps its `@swasthya/prescribing` call through `runTransition`: a
   * wrong-state transition (adding to a signed prescription, a controlled
   * substance) previously reached the client as a bare, codeless 500 —
   * the same gap `BillingService.runTransition` fixed for
   * `@swasthya/billing`'s domain errors, applied here to this module's own.
   */
  addLine(id: string, input: PrescriptionLineInput): Prescription {
    return this.repository.save(
      this.runTransition(() =>
        addPrescriptionLine(this.getPrescription(id), randomUUID(), input, new Date().toISOString()),
      ),
    );
  }

  /**
   * §2's own worked example, applied here rather than at
   * `medication-safety` itself: "prescribing does not stop [when the drug
   * database is down] — it switches to MANUAL ... the prescription records
   * that it was written without automated checking." `checkMedication`
   * never throws (row 5's own MANUAL degradation), so signing never blocks
   * on it — a finding is recorded, never enforced, because the clinician
   * remains the one accountable for the prescription either way.
   */
  async signPrescription(id: string, attestation: string): Promise<Prescription> {
    const prescription = this.getPrescription(id);
    const { status, findings } = await this.runSafetyChecks(prescription);
    return this.repository.save(
      this.runTransition(() =>
        signPrescription(prescription, attestation, status, findings, new Date().toISOString()),
      ),
    );
  }

  private async runSafetyChecks(
    prescription: Prescription,
  ): Promise<{ status: PrescriptionSafetyCheckStatus; findings: readonly MedicationSafetyFinding[] }> {
    const findings: MedicationSafetyFinding[] = [];
    for (const line of prescription.lines) {
      const result = await this.medicationSafety.checkMedication(prescription.patientId, line.label);
      // Same shape medication-safety's own `checked: false` documents:
      // any line that could not be checked makes the whole signature
      // UNAVAILABLE, with findings cleared rather than left partial —
      // a partial findings list would silently read as a complete check.
      if (!result.checked) return { status: 'UNAVAILABLE', findings: [] };
      findings.push(...result.findings);
    }
    return { status: 'CHECKED', findings };
  }

  voidPrescription(id: string, reason: string): Prescription {
    return this.repository.save(
      this.runTransition(() => voidPrescription(this.getPrescription(id), reason, new Date().toISOString())),
    );
  }

  private runTransition(transition: () => Prescription): Prescription {
    try {
      return transition();
    } catch (error) {
      if (
        error instanceof PrescriptionNotDraftError ||
        error instanceof EmptyPrescriptionError ||
        error instanceof ControlledSubstanceDisabledError ||
        error instanceof PrescriptionAlreadyVoidedError ||
        error instanceof PrescriptionNotSignedError
      ) {
        throw new BadRequestException({ code: error.name, message: error.message });
      }
      throw error;
    }
  }

  /**
   * clinical-suite.md §2's `ModuleDescriptor.health()`. Reports this
   * module's own condition only — its degradation against clinical-charting
   * and medication-safety is computed separately, by `resolveAvailability`.
   */
  health(): Promise<ClinicalModuleHealth> {
    return Promise.resolve({ status: 'UP' });
  }
}
