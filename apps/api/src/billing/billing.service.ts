import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { addLineItem, issueInvoice, openInvoice, recordPayment, voidInvoice } from '@swasthya/billing';
import type {
  BillingLineItemInput,
  ClinicalModuleHealth,
  Invoice,
  OpenInvoiceInput,
  RecordPaymentInput,
} from '@swasthya/shared-types';
import { ClinicalChartingService } from '../clinical-charting/clinical-charting.service.js';
import { BillingRepository } from './billing.repository.js';

/**
 * clinical-suite.md capability map row 10: "Billing, claims, revenue
 * cycle." `ClinicalChartingService` is injected as its public port, per §2
 * rule 3 (never a module's repository) — the same pattern
 * `DiagnosticsOrdersService`/`PrescribingService` already established to
 * resolve the encounter an invoice is opened against.
 */
@Injectable()
export class BillingService {
  constructor(
    private readonly repository: BillingRepository,
    private readonly charting: ClinicalChartingService,
  ) {}

  /**
   * The one action gated on clinical-charting, the same `HIDE` shape
   * `DiagnosticsOrdersService.orderDiagnostic` already uses: refuses the
   * call outright rather than opening an invoice this module cannot
   * attribute to a real encounter.
   */
  async openInvoice(encounterId: string, input: OpenInvoiceInput): Promise<Invoice> {
    await this.assertClinicalChartingAvailable();
    // encounterId resolved through clinical-charting's own port (§2 rule 1)
    // — throws NotFoundException for an id that was never opened there, and
    // supplies patientId so a caller cannot claim a patient that disagrees
    // with the encounter the invoice is nested under.
    const encounter = this.charting.getEncounter(encounterId);
    return this.repository.save(
      openInvoice(randomUUID(), encounter.patientId, encounterId, input, new Date().toISOString()),
    );
  }

  private async assertClinicalChartingAvailable(): Promise<void> {
    const health = await this.charting.health();
    if (health.status === 'DOWN') {
      throw new ServiceUnavailableException(
        'Billing unavailable: clinical-charting is down (clinical-suite.md capability map row 10)',
      );
    }
  }

  getInvoice(id: string): Invoice {
    const invoice = this.repository.find(id);
    if (!invoice) throw new NotFoundException(`No invoice ${id}`);
    return invoice;
  }

  listInvoices(patientId?: string): Invoice[] {
    return this.repository.list(patientId);
  }

  /**
   * Never touches clinical-charting — adding a line item, issuing, paying
   * and voiding all stay available for every invoice already opened, even
   * if clinical-charting goes down after the fact.
   */
  addLineItem(id: string, input: BillingLineItemInput): Invoice {
    return this.repository.save(addLineItem(this.getInvoice(id), randomUUID(), input, new Date().toISOString()));
  }

  issueInvoice(id: string): Invoice {
    return this.repository.save(issueInvoice(this.getInvoice(id), new Date().toISOString()));
  }

  recordPayment(id: string, input: RecordPaymentInput): Invoice {
    return this.repository.save(recordPayment(this.getInvoice(id), input, new Date().toISOString()));
  }

  voidInvoice(id: string, reason: string): Invoice {
    return this.repository.save(voidInvoice(this.getInvoice(id), reason, new Date().toISOString()));
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
