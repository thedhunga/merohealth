import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { markFailed, markSent, queueMessage, retryMessage } from '@swasthya/engagement';
import type { ClinicalModuleHealth, EngagementMessage, QueueEngagementMessageInput } from '@swasthya/shared-types';
import { PatientRegistryService } from '../patient-registry/patient-registry.service.js';
import { ENGAGEMENT_DELIVERY_PROVIDER, type EngagementDeliveryProvider } from './delivery-provider.js';
import { EngagementRepository } from './engagement.repository.js';

/**
 * clinical-suite.md capability map row 15: "Patient messaging, reminders
 * ... SMS/WhatsApp. QUEUE_AND_RETRY by nature." `PatientRegistryService` is
 * injected as its public port, per §2 rule 3 (never a module's repository)
 * — the same pattern `ReferralsService` already established for resolving
 * against a foundation module.
 */
@Injectable()
export class EngagementService {
  constructor(
    private readonly repository: EngagementRepository,
    private readonly patients: PatientRegistryService,
    @Inject(ENGAGEMENT_DELIVERY_PROVIDER) private readonly provider: EngagementDeliveryProvider,
  ) {}

  /**
   * The one action gated on patient-registry, the same `HIDE` shape
   * `ReferralsService.requestReferral` already uses: refuses the call
   * outright rather than queuing a message this module cannot attribute to
   * a real patient with a real phone number. Delivery is then attempted
   * immediately — see `attemptDelivery` — so `queueMessage` never leaves a
   * message stuck QUEUED with nothing having tried to send it.
   */
  async queueMessage(patientId: string, input: QueueEngagementMessageInput): Promise<EngagementMessage> {
    await this.assertPatientRegistryAvailable();
    const patient = this.patients.get(patientId);
    const message = this.repository.save(
      queueMessage(randomUUID(), patient.id, patient.demographics.phone, input, new Date().toISOString()),
    );
    return this.attemptDelivery(message);
  }

  private async assertPatientRegistryAvailable(): Promise<void> {
    const health = await this.patients.health();
    if (health.status === 'DOWN') {
      throw new ServiceUnavailableException(
        'Engagement unavailable: patient-registry is down (clinical-suite.md capability map row 15)',
      );
    }
  }

  /**
   * A delivery attempt is never allowed to throw out of this service — a
   * provider outage is recorded as a FAILED message, per §2 rule 4 ("every
   * dependency declares its degradation, and the answer is never 'throw'"),
   * not surfaced as a failed HTTP call.
   */
  private async attemptDelivery(message: EngagementMessage): Promise<EngagementMessage> {
    const now = () => new Date().toISOString();
    try {
      await this.provider.send(message.channel, message.phone, message.body);
      return this.repository.save(markSent(message, now()));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return this.repository.save(markFailed(message, reason, now()));
    }
  }

  getMessage(id: string): EngagementMessage {
    const message = this.repository.find(id);
    if (!message) throw new NotFoundException(`No engagement message ${id}`);
    return message;
  }

  listMessages(patientId?: string): EngagementMessage[] {
    return this.repository.list(patientId);
  }

  /**
   * Never touches patient-registry — the destination phone was captured on
   * the message at queue time (see `packages/engagement`'s header comment
   * on why), so a retry stays available even if patient-registry has gone
   * down since.
   */
  async retryMessage(id: string): Promise<EngagementMessage> {
    const requeued = this.repository.save(retryMessage(this.getMessage(id), new Date().toISOString()));
    return this.attemptDelivery(requeued);
  }

  /**
   * clinical-suite.md §2's `ModuleDescriptor.health()`. Reports this
   * module's own condition only — its degradation against patient-registry
   * is computed separately, by `resolveAvailability`.
   */
  health(): Promise<ClinicalModuleHealth> {
    return Promise.resolve({ status: 'UP' });
  }
}
