import { Injectable } from '@nestjs/common';
import type { DiagnosticOrder } from '@swasthya/shared-types';

/**
 * Process-local stand-in for a real store, same convention
 * `PrescribingRepository`/`SchedulingRepository` already set: the
 * service/controller code above this does not change once the in-memory map
 * is swapped for real persistence, only this file does.
 */
@Injectable()
export class DiagnosticsOrdersRepository {
  readonly #orders = new Map<string, DiagnosticOrder>();

  save(order: DiagnosticOrder): DiagnosticOrder {
    this.#orders.set(order.id, order);
    return order;
  }

  find(id: string): DiagnosticOrder | null {
    return this.#orders.get(id) ?? null;
  }

  list(patientId?: string): DiagnosticOrder[] {
    return [...this.#orders.values()].filter((order) => patientId === undefined || order.patientId === patientId);
  }
}
