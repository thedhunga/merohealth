import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  TeleconsultationSessionAlreadyBookedError,
  TeleconsultationSessionAlreadyCancelledError,
  TeleconsultationSessionNotActiveError,
  TeleconsultationSessionNotScheduledError,
  cancelTeleconsultation,
  completeTeleconsultation,
  markTeleconsultationNoShow,
  scheduleTeleconsultation,
  startTeleconsultation,
} from '@swasthya/teleconsultation';
import type { ClinicalModuleHealth, TeleconsultationSession } from '@swasthya/shared-types';
import { SchedulingService } from '../scheduling/scheduling.service.js';
import { TeleconsultationRepository } from './teleconsultation.repository.js';

/**
 * clinical-suite.md capability map row 9: "Telehealth ... WebRTC. Already
 * stubbed in apps/mobile." `SchedulingService` is injected as its public
 * port, per §2 rule 3 (never a module's repository) — the same pattern
 * `DiagnosticsOrdersService` already established to resolve the appointment
 * a session is booked against.
 */
@Injectable()
export class TeleconsultationService {
  constructor(
    private readonly repository: TeleconsultationRepository,
    private readonly scheduling: SchedulingService,
  ) {}

  /**
   * The one action gated on scheduling, the same `HIDE` shape
   * `DiagnosticsOrdersService.orderDiagnostic` already uses: refuses the
   * call outright rather than booking a session this module cannot
   * attribute to a real appointment.
   */
  async scheduleSession(appointmentId: string): Promise<TeleconsultationSession> {
    await this.assertSchedulingAvailable();
    // appointmentId resolved through scheduling's own port (§2 rule 1) —
    // throws NotFoundException for an id that was never booked there, and
    // supplies patientId/clinicianId so a caller cannot claim participants
    // that disagree with the appointment the session is nested under.
    const appointment = this.scheduling.get(appointmentId);
    return this.repository.save(
      this.runTransition(() =>
        scheduleTeleconsultation(
          randomUUID(),
          appointment.patientId,
          appointment.clinicianId,
          appointmentId,
          new Date().toISOString(),
          this.repository.list(),
        ),
      ),
    );
  }

  private async assertSchedulingAvailable(): Promise<void> {
    const health = await this.scheduling.health();
    if (health.status === 'DOWN') {
      throw new ServiceUnavailableException(
        'Teleconsultation booking unavailable: scheduling is down (clinical-suite.md capability map row 9)',
      );
    }
  }

  /**
   * `ownerId` is not just a filter here — until a clinician-side identity
   * exists in this app, it is the only access control this route has, so a
   * session that exists but belongs to someone else must 404 exactly like
   * one that does not exist at all, the same rule
   * `RecordsService.listDocumentObservations` already applies to a document
   * id. Internal callers that need every session regardless of owner (see
   * `scheduleSession`'s conflict check below) go through
   * `this.repository.list()` directly instead of this method.
   */
  getSession(id: string, ownerId: string): TeleconsultationSession {
    const session = this.repository.find(id);
    if (!session || session.patientId !== ownerId) {
      throw new NotFoundException(`No teleconsultation session ${id}`);
    }
    return session;
  }

  listSessions(ownerId: string): TeleconsultationSession[] {
    return this.repository.list(ownerId);
  }

  /**
   * Never touches scheduling — starting, completing, cancelling and marking
   * no-show all stay available for every session already booked, even if
   * scheduling goes down after the fact.
   *
   * Each wraps its `@swasthya/teleconsultation` call through `runTransition`:
   * a wrong-state transition (starting/completing/cancelling/no-showing a
   * session no longer or not yet in the state that requires, or booking a
   * second session for an appointment that already has one) previously
   * reached the client as a bare, codeless 500, the same gap
   * `BillingService`/`PrescribingService`/`ClinicalChartingService`/
   * `DiagnosticsOrdersService`/`ImmunizationService`/`ReferralsService` were
   * each already fixed for. Each also resolves the session through
   * `getSession`, so a caller acting on someone else's session id 404s
   * before the transition is even attempted.
   */
  startSession(id: string, ownerId: string): TeleconsultationSession {
    return this.repository.save(
      this.runTransition(() => startTeleconsultation(this.getSession(id, ownerId), new Date().toISOString())),
    );
  }

  completeSession(id: string, ownerId: string): TeleconsultationSession {
    return this.repository.save(
      this.runTransition(() => completeTeleconsultation(this.getSession(id, ownerId), new Date().toISOString())),
    );
  }

  cancelSession(id: string, ownerId: string, reason: string): TeleconsultationSession {
    return this.repository.save(
      this.runTransition(() =>
        cancelTeleconsultation(this.getSession(id, ownerId), reason, new Date().toISOString()),
      ),
    );
  }

  markNoShow(id: string, ownerId: string): TeleconsultationSession {
    return this.repository.save(
      this.runTransition(() => markTeleconsultationNoShow(this.getSession(id, ownerId), new Date().toISOString())),
    );
  }

  private runTransition(transition: () => TeleconsultationSession): TeleconsultationSession {
    try {
      return transition();
    } catch (error) {
      if (
        error instanceof TeleconsultationSessionNotScheduledError ||
        error instanceof TeleconsultationSessionNotActiveError ||
        error instanceof TeleconsultationSessionAlreadyCancelledError ||
        error instanceof TeleconsultationSessionAlreadyBookedError
      ) {
        throw new BadRequestException({ code: error.name, message: error.message });
      }
      throw error;
    }
  }

  /**
   * clinical-suite.md §2's `ModuleDescriptor.health()`. Reports this
   * module's own condition only — its degradation against scheduling is
   * computed separately, by `resolveAvailability`.
   */
  health(): Promise<ClinicalModuleHealth> {
    return Promise.resolve({ status: 'UP' });
  }
}
