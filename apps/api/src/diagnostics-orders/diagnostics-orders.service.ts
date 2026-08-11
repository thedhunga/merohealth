import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  cancelDiagnosticOrder,
  orderDiagnostic,
  recordDiagnosticResult,
  releaseDiagnosticResult,
} from '@swasthya/diagnostics-orders';
import type {
  ClinicalModuleHealth,
  DiagnosticOrder,
  OrderDiagnosticInput,
  RecordDiagnosticResultInput,
} from '@swasthya/shared-types';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { DiagnosticsOrdersRepository } from './diagnostics-orders.repository.js';

/**
 * clinical-suite.md capability map row 7: "Lab and imaging orders +
 * results." `ClinicalChartingService` is injected as its public port, per
 * §2 rule 3 (never a module's repository) — the same pattern
 * `PrescribingService` already established to resolve the encounter an
 * order is placed against.
 */
@Injectable()
export class DiagnosticsOrdersService {
  constructor(
    private readonly repository: DiagnosticsOrdersRepository,
    private readonly charting: ClinicalChartingService,
  ) {}

  /**
   * The one action gated on clinical-charting, the same `HIDE` shape
   * `PrescribingService.openPrescription` already uses: refuses the call
   * outright rather than placing an order this module cannot attribute to a
   * real encounter.
   */
  async orderDiagnostic(encounterId: string, input: OrderDiagnosticInput): Promise<DiagnosticOrder> {
    await this.assertClinicalChartingAvailable();
    // encounterId resolved through clinical-charting's own port (§2 rule 1)
    // — throws NotFoundException for an id that was never opened there, and
    // supplies patientId so a caller cannot claim a patient that disagrees
    // with the encounter the order is nested under.
    const encounter = this.charting.getEncounter(encounterId);
    return this.repository.save(
      orderDiagnostic(randomUUID(), encounter.patientId, encounterId, input, new Date().toISOString()),
    );
  }

  private async assertClinicalChartingAvailable(): Promise<void> {
    const health = await this.charting.health();
    if (health.status === 'DOWN') {
      throw new ServiceUnavailableException(
        'Diagnostics ordering unavailable: clinical-charting is down (clinical-suite.md capability map row 7)',
      );
    }
  }

  getOrder(id: string): DiagnosticOrder {
    const order = this.repository.find(id);
    if (!order) throw new NotFoundException(`No diagnostic order ${id}`);
    return order;
  }

  listOrders(patientId?: string): DiagnosticOrder[] {
    return this.repository.list(patientId);
  }

  /**
   * Never touches clinical-charting — recording and releasing a result stay
   * available for every order already placed, even if clinical-charting
   * goes down after the fact.
   */
  recordResult(id: string, input: RecordDiagnosticResultInput): DiagnosticOrder {
    return this.repository.save(recordDiagnosticResult(this.getOrder(id), input, new Date().toISOString()));
  }

  releaseResult(id: string, releasedBy: string): DiagnosticOrder {
    return this.repository.save(releaseDiagnosticResult(this.getOrder(id), releasedBy, new Date().toISOString()));
  }

  cancelOrder(id: string, reason: string): DiagnosticOrder {
    return this.repository.save(cancelDiagnosticOrder(this.getOrder(id), reason, new Date().toISOString()));
  }

  /**
   * clinical-suite.md §2's `ModuleDescriptor.health()`. Reports this
   * module's own condition only — its degradation against clinical-charting
   * is computed separately, by `resolveAvailability`.
   */
  health(): Promise<ClinicalModuleHealth> {
    return Promise.resolve({ status: 'UP' });
  }
}
