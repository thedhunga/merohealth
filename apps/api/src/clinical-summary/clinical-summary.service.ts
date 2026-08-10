import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { recordClinicianAuthoredItem, recordPatientReportedItem, resolveItem } from '@swasthya/clinical-summary';
import type {
  ClinicalModuleHealth,
  ClinicalSummaryItem,
  ClinicalSummaryKind,
  RecordClinicianSummaryItemInput,
  RecordPatientReportedSummaryItemInput,
} from '@swasthya/shared-types';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { ClinicalSummaryRepository } from './clinical-summary.repository.js';

/**
 * clinical-suite.md capability map row 4: "Extends digital-twin with
 * clinician-authored provenance." `charting` is injected as
 * `ClinicalChartingService` — its public port, per §2 rule 3 ("a module may
 * import another's types; never its repository, its client, or its
 * tables") — not `ClinicalChartingRepository`. Only recording a
 * clinician-authored item calls into it, to resolve the authoring
 * encounter; recording a patient-reported item, reading, listing and
 * resolving never touch clinical-charting at all, so the problem
 * list/allergy/medication list keeps working even if clinical-charting
 * never resolves.
 */
@Injectable()
export class ClinicalSummaryService {
  constructor(
    private readonly repository: ClinicalSummaryRepository,
    private readonly charting: ClinicalChartingService,
  ) {}

  recordPatientReported(input: RecordPatientReportedSummaryItemInput): ClinicalSummaryItem {
    return this.repository.save(recordPatientReportedItem(randomUUID(), input, new Date().toISOString()));
  }

  /**
   * The one action gated on clinical-charting. §2's `HIDE` mode ("remove
   * the surface entirely; nothing else notices") has no literal surface to
   * hide yet — no apps/web/apps/mobile page renders this action — so the
   * honest API-boundary equivalent is refusing the call outright rather
   * than accepting an authorship claim this module cannot verify.
   */
  async recordClinicianAuthored(
    encounterId: string,
    input: RecordClinicianSummaryItemInput,
  ): Promise<ClinicalSummaryItem> {
    await this.assertClinicalChartingAvailable();
    // encounterId resolved through clinical-charting's own port (§2 rule 1)
    // — throws NotFoundException for an id that was never opened there, the
    // same 404 shape every other lookup in this API already uses. Also
    // supplies patientId, so a caller cannot claim a patient that disagrees
    // with the encounter it is authoring against.
    const encounter = this.charting.getEncounter(encounterId);
    return this.repository.save(
      recordClinicianAuthoredItem(randomUUID(), encounter.patientId, encounterId, input, new Date().toISOString()),
    );
  }

  private async assertClinicalChartingAvailable(): Promise<void> {
    const health = await this.charting.health();
    if (health.status === 'DOWN') {
      throw new ServiceUnavailableException(
        'Clinician-authored items unavailable: clinical-charting is down (clinical-suite.md capability map row 4)',
      );
    }
  }

  getItem(id: string): ClinicalSummaryItem {
    const item = this.repository.find(id);
    if (!item) throw new NotFoundException(`No clinical summary item ${id}`);
    return item;
  }

  listItems(patientId?: string, kind?: ClinicalSummaryKind): ClinicalSummaryItem[] {
    return this.repository.list(patientId, kind);
  }

  resolveItem(id: string): ClinicalSummaryItem {
    return this.repository.save(resolveItem(this.getItem(id), new Date().toISOString()));
  }

  /**
   * clinical-suite.md §2's `ModuleDescriptor.health()`. Reports this
   * module's own condition only — whether CLINICAL_SUMMARY is degraded by
   * clinical-charting being down is computed separately, by
   * `resolveAvailability` cross-referencing both modules' health, not by
   * this module reporting itself unhealthy on a dependency's behalf.
   */
  health(): Promise<ClinicalModuleHealth> {
    return Promise.resolve({ status: 'UP' });
  }
}
