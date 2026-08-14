import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PatientRegistryRepository } from '../patient-registry/patient-registry.repository.js';
import { PatientRegistryService } from '../patient-registry/patient-registry.service.js';
import type { EngagementDeliveryProvider } from './delivery-provider.js';
import { EngagementRepository } from './engagement.repository.js';
import { EngagementService } from './engagement.service.js';

const demographics = {
  displayName: 'Sunita Thapa',
  dateOfBirth: '1990-01-01',
  sex: 'FEMALE' as const,
  phone: '+977-9800000000',
  preferredLocale: 'ne' as const,
};

// Kept as this loose shape rather than `EngagementDeliveryProvider` — asserting
// on `provider.send` against that interface type trips
// `@typescript-eslint/unbound-method` (it reads as a detached interface
// method, not a vitest mock). The cast to `EngagementDeliveryProvider`
// happens only where `EngagementService` needs the shape, matching
// `auth.service.test.ts`'s own precedent for `SmsProvider`.
type MockProvider = { send: ReturnType<typeof vi.fn> };

function buildStack(provider: MockProvider) {
  const patients = new PatientRegistryService(new PatientRegistryRepository());
  const engagement = new EngagementService(new EngagementRepository(), patients, provider as unknown as EngagementDeliveryProvider);
  return { patients, engagement };
}

function alwaysDelivers(): MockProvider {
  return { send: vi.fn().mockResolvedValue(undefined) };
}

function alwaysFails(reason: string): MockProvider {
  return { send: vi.fn().mockRejectedValue(new Error(reason)) };
}

const messageInput = { channel: 'SMS' as const, kind: 'REMINDER' as const, body: 'Your appointment is tomorrow at 10am.' };

describe('EngagementService.queueMessage', () => {
  it('queues a message against a registered patient and records a successful delivery', async () => {
    const provider = alwaysDelivers();
    const { patients, engagement } = buildStack(provider);
    const patient = patients.register(demographics);

    const message = await engagement.queueMessage(patient.id, messageInput);

    expect(message.status).toBe('SENT');
    expect(message.patientId).toBe(patient.id);
    expect(message.phone).toBe(demographics.phone);
    expect(provider.send).toHaveBeenCalledWith('SMS', demographics.phone, messageInput.body);
  });

  it('records a FAILED message rather than throwing when the provider rejects', async () => {
    const { patients, engagement } = buildStack(alwaysFails('gateway timeout'));
    const patient = patients.register(demographics);

    const message = await engagement.queueMessage(patient.id, messageInput);

    expect(message.status).toBe('FAILED');
    expect(message.failureReason).toBe('gateway timeout');
  });

  it('refuses to queue a message while patient-registry is down', async () => {
    const { patients, engagement } = buildStack(alwaysDelivers());
    const patient = patients.register(demographics);
    patients.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });

    await expect(engagement.queueMessage(patient.id, messageInput)).rejects.toThrow(ServiceUnavailableException);
  });

  it('404s for a patient that does not exist', async () => {
    const { engagement } = buildStack(alwaysDelivers());

    await expect(engagement.queueMessage('not-a-real-patient', messageInput)).rejects.toThrow(NotFoundException);
  });
});

describe('EngagementService.retryMessage', () => {
  it('re-attempts delivery to the phone captured at queue time and can turn FAILED into SENT', async () => {
    const provider = alwaysFails('gateway timeout');
    const { patients, engagement } = buildStack(provider);
    const patient = patients.register(demographics);
    const failed = await engagement.queueMessage(patient.id, messageInput);
    expect(failed.status).toBe('FAILED');

    provider.send = vi.fn().mockResolvedValue(undefined);
    const retried = await engagement.retryMessage(failed.id);

    expect(retried.status).toBe('SENT');
    expect(retried.attemptCount).toBe(2);
  });

  it('stays available to retry even while patient-registry is down', async () => {
    const provider = alwaysFails('gateway timeout');
    const { patients, engagement } = buildStack(provider);
    const patient = patients.register(demographics);
    const failed = await engagement.queueMessage(patient.id, messageInput);

    patients.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });
    provider.send = vi.fn().mockResolvedValue(undefined);
    const retried = await engagement.retryMessage(failed.id);

    expect(retried.status).toBe('SENT');
  });

  it('rejects retrying a message that never failed, as a 400 with a code', async () => {
    const { patients, engagement } = buildStack(alwaysDelivers());
    const patient = patients.register(demographics);
    const sent = await engagement.queueMessage(patient.id, messageInput);

    try {
      await engagement.retryMessage(sent.id);
      expect.unreachable('expected retryMessage to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({ code: 'EngagementMessageNotFailedError' });
    }
  });
});

describe('EngagementService.listMessages and getMessage', () => {
  it('lists messages filtered by patientId and reads one by id', async () => {
    const { patients, engagement } = buildStack(alwaysDelivers());
    const patient = patients.register(demographics);
    const message = await engagement.queueMessage(patient.id, messageInput);

    expect(engagement.listMessages(patient.id)).toEqual([message]);
    expect(engagement.listMessages('someone-else')).toEqual([]);
    expect(engagement.getMessage(message.id)).toEqual(message);
  });

  it('404s for an unknown message id', () => {
    const { engagement } = buildStack(alwaysDelivers());

    expect(() => engagement.getMessage('missing')).toThrow(NotFoundException);
  });
});

describe('EngagementService.health', () => {
  it('reports UP with no failure mode of its own', async () => {
    const { engagement } = buildStack(alwaysDelivers());

    await expect(engagement.health()).resolves.toEqual({ status: 'UP' });
  });
});
