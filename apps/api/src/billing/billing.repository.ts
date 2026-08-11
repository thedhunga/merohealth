import { Injectable } from '@nestjs/common';
import type { Invoice } from '@swasthya/shared-types';

/**
 * Process-local stand-in for a real store, same convention
 * `DiagnosticsOrdersRepository`/`TeleconsultationRepository` already set:
 * the service/controller code above this does not change once the
 * in-memory map is swapped for real persistence, only this file does.
 */
@Injectable()
export class BillingRepository {
  readonly #invoices = new Map<string, Invoice>();

  save(invoice: Invoice): Invoice {
    this.#invoices.set(invoice.id, invoice);
    return invoice;
  }

  find(id: string): Invoice | null {
    return this.#invoices.get(id) ?? null;
  }

  list(patientId?: string): Invoice[] {
    return [...this.#invoices.values()].filter((invoice) => patientId === undefined || invoice.patientId === patientId);
  }
}
