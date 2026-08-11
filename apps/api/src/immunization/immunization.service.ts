import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  recordClinicianAdministeredImmunization,
  recordPatientReportedImmunization,
  voidImmunizationRecord,
} from '@swasthya/immunization';
import type {
  ClinicalModuleHealth,
  ImmunizationRecord,
  RecordClinicianAdministeredImmunizationInput,
  RecordPatientReportedImmunizationInput,
} from '@swasthya/shared-types';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { ImmunizationRepository } from './immunization.repository.js';

/**
 * clinical-suite.md capability map row 18: "Immunization records ... Nepal
 * EPI schedule, not US registries." `ClinicalChartingService` is injected as
 * its public port, per §2 rule 3 ("a module may import another's types;
 * never its repository, its client, or its tables") — the same pattern
 * `ClinicalSummaryService` already established for row 4. Only recording a
 * clinician-administered dose calls into it, to resolve the administering
 * encounter; recording a patient-reported dose, reading, listing and voiding
 * never touch clinical-charting at all, so the immunization list keeps
 * working even if clinical-charting never resolves.
 */
@Injectable()
export class ImmunizationService {
  constructor(
    private readonly repository: ImmunizationRepository,
    private readonly charting: ClinicalChartingService,
  ) {}

  recordPatientReported(input: RecordPatientReportedImmunizationInput): ImmunizationRecord {
    return this.repository.save(recordPatientReportedImmunization(randomUUID(), input, new Date().toISOString()));
  }

  /**
   * The one action gated on clinical-charting, the same `HIDE` shape
   * `ClinicalSummaryService.recordClinicianAuthored` already uses: refuses
   * the call outright rather than accepting an administration claim this
   * module cannot attribute to a real encounter.
   */
  async recordClinicianAdministered(
    encounterId: string,
    input: RecordClinicianAdministeredImmunizationInput,
  ): Promise<ImmunizationRecord> {
    await this.assertClinicalChartingAvailable();
    // encounterId resolved through clinical-charting's own port (§2 rule 1)
    // — throws NotFoundException for an id that was never opened there, and
    // supplies patientId so a caller cannot claim a patient that disagrees
    // with the encounter the record is nested under.
    const encounter = this.charting.getEncounter(encounterId);
    return this.repository.save(
      recordClinicianAdministeredImmunization(
        randomUUID(),
        encounter.patientId,
        encounterId,
        input,
        new Date().toISOString(),
      ),
    );
  }

  private async assertClinicalChartingAvailable(): Promise<void> {
    const health = await this.charting.health();
    if (health.status === 'DOWN') {
      throw new ServiceUnavailableException(
        'Clinician-administered recording unavailable: clinical-charting is down (clinical-suite.md capability map row 18)',
      );
    }
  }

  getRecord(id: string): ImmunizationRecord {
    const record = this.repository.find(id);
    if (!record) throw new NotFoundException(`No immunization record ${id}`);
    return record;
  }

  listRecords(patientId?: string): ImmunizationRecord[] {
    return this.repository.list(patientId);
  }

  voidRecord(id: string, reason: string): ImmunizationRecord {
    return this.repository.save(voidImmunizationRecord(this.getRecord(id), reason, new Date().toISOString()));
  }

  /**
   * clinical-suite.md §2's `ModuleDescriptor.health()`. Reports this
   * module's own condition only — whether IMMUNIZATION is degraded by
   * clinical-charting being down is computed separately, by
   * `resolveAvailability` cross-referencing both modules' health.
   */
  health(): Promise<ClinicalModuleHealth> {
    return Promise.resolve({ status: 'UP' });
  }
}
