import { buildModuleRegistry, collectHealthStates, resolveAvailability } from '@swasthya/module-registry';
import { describe, expect, it, vi } from 'vitest';
import { PatientRegistryRepository } from '../patient-registry/patient-registry.repository.js';
import { createPatientRegistryModuleDescriptor } from '../patient-registry/patient-registry.module-descriptor.js';
import { PatientRegistryService } from '../patient-registry/patient-registry.service.js';
import type { EngagementDeliveryProvider } from './delivery-provider.js';
import { createEngagementModuleDescriptor } from './engagement.module-descriptor.js';
import { EngagementRepository } from './engagement.repository.js';
import { EngagementService } from './engagement.service.js';

const demographics = {
  displayName: 'Sunita Thapa',
  dateOfBirth: '1990-01-01',
  sex: 'FEMALE' as const,
  phone: '+977-9800000000',
  preferredLocale: 'ne' as const,
};

const messageInput = { channel: 'SMS' as const, kind: 'REMINDER' as const, body: 'Your appointment is tomorrow at 10am.' };

function buildStack() {
  const patients = new PatientRegistryService(new PatientRegistryRepository());
  const provider: EngagementDeliveryProvider = { send: vi.fn().mockResolvedValue(undefined) };
  return { patients, provider };
}

/**
 * §2 rule 5, "the shell renders around holes," demonstrated against a real
 * thrown error, the same shape `ReferralsRepository`'s own
 * `BrokenReferralsRepository` already uses.
 */
class BrokenEngagementRepository extends EngagementRepository {
  override save(): never {
    throw new Error('simulated store outage');
  }
}

describe('engagement fault isolation', () => {
  it('a broken engagement repository does not take patient-registry down with it', async () => {
    const { patients, provider } = buildStack();
    const patient = patients.register(demographics);

    const broken = new EngagementService(new BrokenEngagementRepository(), patients, provider);
    await expect(broken.queueMessage(patient.id, messageInput)).rejects.toThrow('simulated store outage');

    // patient-registry keeps working — the outage is confined to
    // engagement's own storage.
    expect(patients.get(patient.id).id).toBe(patient.id);
  });

  it('resolveAvailability marks ENGAGEMENT available but HIDE-degraded when PATIENT_REGISTRY is DOWN', async () => {
    const { patients, provider } = buildStack();
    const engagement = new EngagementService(new EngagementRepository(), patients, provider);

    const forcedDownPatientRegistryDescriptor = {
      ...createPatientRegistryModuleDescriptor(patients),
      health: () => Promise.resolve({ status: 'DOWN' as const, detail: 'simulated outage' }),
    };
    const engagementDescriptor = createEngagementModuleDescriptor(engagement);

    const registry = buildModuleRegistry([forcedDownPatientRegistryDescriptor, engagementDescriptor]);
    const states = await collectHealthStates(registry);
    const resolved = resolveAvailability(registry, states);

    expect(resolved.get('PATIENT_REGISTRY')).toMatchObject({ available: false, health: 'DOWN' });
    expect(resolved.get('ENGAGEMENT')).toMatchObject({
      available: true,
      health: 'UP',
      degradations: [{ dependency: 'PATIENT_REGISTRY', mode: 'HIDE' }],
    });
  });

  it('behaviourally: refuses to queue a message while patient-registry is down, and resumes once it recovers', async () => {
    const { patients, provider } = buildStack();
    const engagement = new EngagementService(new EngagementRepository(), patients, provider);
    const patient = patients.register(demographics);

    patients.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });
    await expect(engagement.queueMessage(patient.id, messageInput)).rejects.toThrow('patient-registry is down');

    patients.health = () => Promise.resolve({ status: 'UP' });
    const message = await engagement.queueMessage(patient.id, messageInput);
    expect(message.status).toBe('SENT');
  });

  it('behaviourally: retrying a failed message stays available while patient-registry is down', async () => {
    const { patients } = buildStack();
    const failingProvider: EngagementDeliveryProvider = { send: vi.fn().mockRejectedValue(new Error('gateway timeout')) };
    const engagement = new EngagementService(new EngagementRepository(), patients, failingProvider);
    const patient = patients.register(demographics);
    const failed = await engagement.queueMessage(patient.id, messageInput);

    patients.health = () => Promise.resolve({ status: 'DOWN', detail: 'simulated outage' });
    failingProvider.send = vi.fn().mockResolvedValue(undefined);

    const retried = await engagement.retryMessage(failed.id);
    expect(retried.status).toBe('SENT');
  });
});
