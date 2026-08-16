import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { InMemoryTwinProfileStore } from './in-memory-twin-profile.store.js';
import { TwinProfileController } from './twin-profile.controller.js';
import { TwinProfileService } from './twin-profile.service.js';

function currentUser(subjectId: string): CurrentUserResult {
  return {
    subjectId,
    user: { id: subjectId, phone: null, role: 'PATIENT', locale: 'ne', assuranceLevel: 'REGISTERED' },
    patientProfileId: null,
    assuranceLevel: 'REGISTERED',
  };
}

function buildController(store = new InMemoryTwinProfileStore()) {
  return { controller: new TwinProfileController(new TwinProfileService(store)), store };
}

describe('TwinProfileController.confirmProfile', () => {
  it('takes the owning user from @CurrentUser(), never from the request body', async () => {
    const { controller, store } = buildController();

    const result = await controller.confirmProfile(currentUser('sunita'), { ageBand: '40to60' });

    expect(result).toEqual({ ok: true, created: 1 });
    expect(store.factsByUserId.get('sunita')).toHaveLength(1);
  });

  it('accepts askingFor and multiple conditions together', async () => {
    const { controller, store } = buildController();

    const result = await controller.confirmProfile(currentUser('sunita'), {
      askingFor: 'parent',
      conditions: ['diabetes', 'thyroid'],
    });

    expect(result).toEqual({ ok: true, created: 3 });
    expect(store.factsByUserId.get('sunita')).toHaveLength(3);
  });

  it('rejects an empty body — nothing to confirm', async () => {
    const { controller } = buildController();
    await expect(controller.confirmProfile(currentUser('sunita'), {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an age band outside the known chip options', async () => {
    const { controller } = buildController();
    await expect(controller.confirmProfile(currentUser('sunita'), { ageBand: '25' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a condition outside the known chip options — never invents a clinical fact from free text', async () => {
    const { controller } = buildController();
    await expect(
      controller.confirmProfile(currentUser('sunita'), { conditions: ['made-up-condition'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects the literal "none" as a condition — the client already turns that chip into an empty array before this route is ever called', async () => {
    const { controller } = buildController();
    await expect(controller.confirmProfile(currentUser('sunita'), { conditions: ['none'] })).rejects.toBeInstanceOf(BadRequestException);
  });
});
