import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PatientRegistryRepository } from '../patient-registry/patient-registry.repository.js';
import { PatientRegistryService } from '../patient-registry/patient-registry.service.js';
import type { EngagementDeliveryProvider } from './delivery-provider.js';
import { EngagementMessageRateLimiter } from './engagement-message-rate-limiter.js';
import { EngagementController } from './engagement.controller.js';
import { EngagementRepository } from './engagement.repository.js';
import { EngagementService } from './engagement.service.js';

const CALLER = { ip: '1.2.3.4' };

const demographics = {
  displayName: 'Sunita Thapa',
  dateOfBirth: '1990-01-01',
  sex: 'FEMALE' as const,
  phone: '+977-9800000000',
  preferredLocale: 'ne' as const,
};

function buildController() {
  const patients = new PatientRegistryService(new PatientRegistryRepository());
  const provider: EngagementDeliveryProvider = { send: vi.fn().mockResolvedValue(undefined) };
  const engagement = new EngagementService(new EngagementRepository(), patients, provider);
  const controller = new EngagementController(engagement);
  return { controller, patients };
}

const requestBody = { channel: 'SMS', kind: 'REMINDER', body: 'Your appointment is tomorrow at 10am.' };

describe('EngagementController.queueMessage', () => {
  it('queues and delivers a message against a registered patient', async () => {
    const { controller, patients } = buildController();
    const patient = patients.register(demographics);

    const message = await controller.queueMessage(patient.id, requestBody, CALLER);

    expect(message.status).toBe('SENT');
    expect(message.patientId).toBe(patient.id);
  });

  it('rejects a request with an unknown channel', async () => {
    const { controller } = buildController();

    await expect(
      controller.queueMessage('patient-1', { ...requestBody, channel: 'CARRIER_PIGEON' }, CALLER),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a request with an empty body', async () => {
    const { controller } = buildController();

    await expect(controller.queueMessage('patient-1', { ...requestBody, body: '' }, CALLER)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('refuses the 31st call in ten minutes from the same connection', async () => {
    const { controller, patients } = buildController();
    const patient = patients.register(demographics);

    for (let i = 0; i < 30; i++) {
      await controller.queueMessage(patient.id, requestBody, CALLER);
    }

    await expect(controller.queueMessage(patient.id, requestBody, CALLER)).rejects.toMatchObject({
      status: 429,
      response: { code: 'RATE_LIMITED' },
    });
  });

  it('leaves a different caller their own rate-limit allowance', async () => {
    const { controller, patients } = buildController();
    const patient = patients.register(demographics);

    for (let i = 0; i < 30; i++) {
      await controller.queueMessage(patient.id, requestBody, CALLER);
    }

    await expect(
      controller.queueMessage(patient.id, requestBody, { ip: '9.9.9.9' }),
    ).resolves.toMatchObject({ status: 'SENT' });
  });
});

describe('EngagementController.listMessages, getMessage and retryMessage', () => {
  it('lists messages filtered by patientId, reads one by id, and retries a failed one', async () => {
    const patients = new PatientRegistryService(new PatientRegistryRepository());
    const provider: EngagementDeliveryProvider = { send: vi.fn().mockRejectedValue(new Error('gateway timeout')) };
    const engagement = new EngagementService(new EngagementRepository(), patients, provider);
    const controller = new EngagementController(engagement);
    const patient = patients.register(demographics);

    const failed = await controller.queueMessage(patient.id, requestBody, CALLER);
    expect(failed.status).toBe('FAILED');

    const listed = controller.listMessages(patient.id);
    expect(listed).toEqual({ messages: [failed], total: 1 });
    expect(controller.getMessage(failed.id)).toEqual(failed);

    provider.send = vi.fn().mockResolvedValue(undefined);
    const retried = await controller.retryMessage(failed.id, CALLER);
    expect(retried.status).toBe('SENT');
  });
});

describe('EngagementController.retryMessage rate limit', () => {
  it('shares its allowance with queueMessage, since both reach the same delivery attempt', async () => {
    const patients = new PatientRegistryService(new PatientRegistryRepository());
    const provider: EngagementDeliveryProvider = { send: vi.fn().mockRejectedValue(new Error('gateway timeout')) };
    const engagement = new EngagementService(new EngagementRepository(), patients, provider);
    const controller = new EngagementController(engagement, new EngagementMessageRateLimiter());
    const patient = patients.register(demographics);
    const failed = await controller.queueMessage(patient.id, requestBody, CALLER);
    expect(failed.status).toBe('FAILED');

    for (let i = 0; i < 29; i++) {
      const retried = await controller.retryMessage(failed.id, CALLER);
      expect(retried.status).toBe('FAILED');
    }

    await expect(controller.retryMessage(failed.id, CALLER)).rejects.toMatchObject({
      status: 429,
      response: { code: 'RATE_LIMITED' },
    });
  });
});

describe('EngagementController.health', () => {
  it('reports UP', async () => {
    const { controller } = buildController();

    await expect(controller.health()).resolves.toEqual({ status: 'UP' });
  });
});
