import { Injectable } from '@nestjs/common';
import { buildModuleRegistry, collectHealthStates, resolveAvailability, type ModuleRegistry, type ResolvedModule } from '@swasthya/module-registry';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { createClinicalChartingModuleDescriptor } from '../clinical-charting/clinical-charting.module-descriptor.js';
import { ClinicalSummaryService } from '../clinical-summary/clinical-summary.service.js';
import { createClinicalSummaryModuleDescriptor } from '../clinical-summary/clinical-summary.module-descriptor.js';
import { createDiagnosticsOrdersModuleDescriptor } from '../diagnostics-orders/diagnostics-orders.module-descriptor.js';
import { DiagnosticsOrdersService } from '../diagnostics-orders/diagnostics-orders.service.js';
import { MedicationSafetyService } from '../medication-safety/medication-safety.service.js';
import { createMedicationSafetyModuleDescriptor } from '../medication-safety/medication-safety.module-descriptor.js';
import { PatientRegistryService } from '../patient-registry/patient-registry.service.js';
import { createPatientRegistryModuleDescriptor } from '../patient-registry/patient-registry.module-descriptor.js';
import { PrescribingService } from '../prescribing/prescribing.service.js';
import { createPrescribingModuleDescriptor } from '../prescribing/prescribing.module-descriptor.js';
import { RecordsService } from '../records/records.service.js';
import { createHealthRecordsModuleDescriptor } from '../records/records.module-descriptor.js';
import { SchedulingService } from '../scheduling/scheduling.service.js';
import { createSchedulingModuleDescriptor } from '../scheduling/scheduling.module-descriptor.js';
import { TeleconsultationService } from '../teleconsultation/teleconsultation.service.js';
import { createTeleconsultationModuleDescriptor } from '../teleconsultation/teleconsultation.module-descriptor.js';

/**
 * clinical-suite.md §2 rule 5: "the shell renders around holes." Every
 * module up to `teleconsultation` (capability map rows 1–7 and 9, plus
 * `HEALTH_RECORDS` from row 16, which `clinical-charting` already degrades
 * against) ships its own `ModuleDescriptor` and its own fault-isolation test
 * proving *its* `requires`/`degradesWith` edges resolve correctly in a
 * registry built just for that test. None of those ad hoc registries is the
 * one a future shell would actually query — each covers only the two or
 * three modules the test at hand needs. This service builds the one real
 * registry, from the same DI-wired service instances the rest of the app
 * runs on, so there is a single place that answers "what is available right
 * now, and in what mode" across the whole suite. It has no domain logic of
 * its own — every fact it reports is computed by `@swasthya/module-registry`,
 * already proven correct by each module's own fault-isolation test.
 */
@Injectable()
export class ClinicalSuiteService {
  private readonly registry: ModuleRegistry;

  constructor(
    records: RecordsService,
    patients: PatientRegistryService,
    scheduling: SchedulingService,
    charting: ClinicalChartingService,
    summary: ClinicalSummaryService,
    medicationSafety: MedicationSafetyService,
    prescribing: PrescribingService,
    diagnosticsOrders: DiagnosticsOrdersService,
    teleconsultation: TeleconsultationService,
  ) {
    // Built once, at DI wiring time, per `buildModuleRegistry`'s own
    // contract: a typo'd or missing dependency key fails app bootstrap
    // loudly here rather than resolving to "unavailable" forever at
    // request time.
    this.registry = buildModuleRegistry([
      createHealthRecordsModuleDescriptor(records),
      createPatientRegistryModuleDescriptor(patients),
      createSchedulingModuleDescriptor(scheduling),
      createClinicalChartingModuleDescriptor(charting),
      createClinicalSummaryModuleDescriptor(summary),
      createMedicationSafetyModuleDescriptor(medicationSafety),
      createPrescribingModuleDescriptor(prescribing),
      createDiagnosticsOrdersModuleDescriptor(diagnosticsOrders),
      createTeleconsultationModuleDescriptor(teleconsultation),
    ]);
  }

  async resolve(): Promise<ResolvedModule[]> {
    const states = await collectHealthStates(this.registry);
    return [...resolveAvailability(this.registry, states).values()];
  }
}
