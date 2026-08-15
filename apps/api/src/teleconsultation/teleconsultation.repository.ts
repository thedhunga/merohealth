import { Injectable } from '@nestjs/common';
import type { TeleconsultationSession } from '@swasthya/shared-types';

/**
 * Process-local stand-in for a real store, same convention
 * `DiagnosticsOrdersRepository`/`SchedulingRepository` already set: the
 * service/controller code above this does not change once the in-memory map
 * is swapped for real persistence, only this file does.
 */
@Injectable()
export class TeleconsultationRepository {
  readonly #sessions = new Map<string, TeleconsultationSession>();

  save(session: TeleconsultationSession): TeleconsultationSession {
    this.#sessions.set(session.id, session);
    return session;
  }

  find(id: string): TeleconsultationSession | null {
    return this.#sessions.get(id) ?? null;
  }

  list(patientId?: string): TeleconsultationSession[] {
    return [...this.#sessions.values()].filter(
      (session) => patientId === undefined || session.patientId === patientId,
    );
  }
}
