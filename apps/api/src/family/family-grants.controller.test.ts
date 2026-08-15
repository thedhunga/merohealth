import { BadRequestException, NotFoundException } from '@nestjs/common';
import { grantDelegation } from '@swasthya/family';
import { describe, expect, it } from 'vitest';
import { InMemoryAuthStore } from '../auth/in-memory-auth.store.js';
import type { CurrentUserResult } from '../auth/auth.service.js';
import { FamilyGrantsController } from './family-grants.controller.js';
import { FamilyGrantsService } from './family-grants.service.js';
import { InMemoryFamilyGrantsStore } from './in-memory-family-grants.store.js';

function currentUser(subjectId: string): CurrentUserResult {
  return {
    subjectId,
    user: { id: subjectId, phone: null, role: 'PATIENT', locale: 'ne', assuranceLevel: 'REGISTERED' },
    patientProfileId: null,
    assuranceLevel: 'REGISTERED',
  };
}

describe('FamilyGrantsController.grantsForCurrentUser', () => {
  it('reads the subject id from @CurrentUser(), never from a request parameter', async () => {
    const delegation = grantDelegation('d-1', 'janaki', 'sunita', ['VIEW_RECORD'], '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z');
    const controller = new FamilyGrantsController(
      new FamilyGrantsService(new InMemoryFamilyGrantsStore([], [delegation]), new InMemoryAuthStore()),
    );

    // The same account id asked as someone else must never see `janaki`'s
    // grant to `sunita` — this is the cross-owner failure the records
    // module's own guard exists to rule out, exercised here for the first
    // caller of this endpoint.
    expect(await controller.grantsForCurrentUser(currentUser('sunita'))).toEqual({
      guardianships: [],
      delegations: [delegation],
      delegationsGranted: [],
    });
    expect(await controller.grantsForCurrentUser(currentUser('janaki'))).toEqual({
      guardianships: [],
      delegations: [],
      delegationsGranted: [delegation],
    });
    expect(await controller.grantsForCurrentUser(currentUser('someone-else'))).toEqual({
      guardianships: [],
      delegations: [],
      delegationsGranted: [],
    });
  });
});

describe('FamilyGrantsController.revokeDelegation', () => {
  it('takes the granter id from @CurrentUser() and the delegation id from the path, and returns the revoked grant', async () => {
    const delegation = grantDelegation('d-1', 'janaki', 'sunita', ['VIEW_RECORD'], '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z');
    const controller = new FamilyGrantsController(
      new FamilyGrantsService(new InMemoryFamilyGrantsStore([], [delegation]), new InMemoryAuthStore()),
    );

    const revoked = await controller.revokeDelegation(currentUser('janaki'), 'd-1');

    expect(revoked.revokedAt).not.toBeNull();
    // A second read through the read endpoint sees the revoked grant, not the original.
    expect(await controller.grantsForCurrentUser(currentUser('janaki'))).toEqual({
      guardianships: [],
      delegations: [],
      delegationsGranted: [revoked],
    });
  });

  it('404s rather than revoking when the caller is not the grant’s granter', async () => {
    const delegation = grantDelegation('d-1', 'janaki', 'sunita', ['VIEW_RECORD'], '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z');
    const controller = new FamilyGrantsController(
      new FamilyGrantsService(new InMemoryFamilyGrantsStore([], [delegation]), new InMemoryAuthStore()),
    );

    // `sunita` is the delegate, not the granter — asking as `sunita` must not revoke `janaki`'s grant.
    await expect(controller.revokeDelegation(currentUser('sunita'), 'd-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('FamilyGrantsController.createDelegation', () => {
  const DELEGATE_PHONE = '9812345678';

  async function buildController() {
    const authStore = new InMemoryAuthStore();
    const delegate = await authStore.createPatientUser({ phone: DELEGATE_PHONE, locale: 'ne' });
    const controller = new FamilyGrantsController(new FamilyGrantsService(new InMemoryFamilyGrantsStore(), authStore));
    return { controller, delegate };
  }

  it('takes the granter id from @CurrentUser(), validates the body, and returns the created grant', async () => {
    const { controller, delegate } = await buildController();

    const grant = await controller.createDelegation(currentUser('janaki'), {
      delegatePhone: DELEGATE_PHONE,
      scopes: ['VIEW_RECORD'],
      expiresAt: '2027-01-01T00:00:00.000Z',
    });

    expect(grant.granterId).toBe('janaki');
    expect(grant.delegateId).toBe(delegate.id);
    // A second read through the read endpoint sees the same grant it just wrote.
    expect(await controller.grantsForCurrentUser(currentUser(delegate.id))).toEqual({
      guardianships: [],
      delegations: [grant],
      delegationsGranted: [],
    });
  });

  // `parseOrThrow` throws synchronously — `createDelegation` never even
  // reaches the `async` service call, so the rejection surfaces as a thrown
  // error at the call site itself rather than a rejected promise; `toThrow`,
  // not `rejects`, is the correct matcher for that.
  it('rejects a body with no scopes before it ever reaches the service', async () => {
    const { controller } = await buildController();
    expect(() =>
      controller.createDelegation(currentUser('janaki'), { delegatePhone: DELEGATE_PHONE, scopes: [], expiresAt: '2027-01-01T00:00:00.000Z' }),
    ).toThrow(BadRequestException);
  });

  it('rejects an out-of-range scope value before it ever reaches the service', async () => {
    const { controller } = await buildController();
    expect(() =>
      controller.createDelegation(currentUser('janaki'), {
        delegatePhone: DELEGATE_PHONE,
        scopes: ['DELETE_EVERYTHING'],
        expiresAt: '2027-01-01T00:00:00.000Z',
      }),
    ).toThrow(BadRequestException);
  });

  // Before this test existed, a non-ISO `expiresAt` like this sailed past
  // both the old `.min(1)` check here and `grantDelegation`'s own
  // `expiresAt <= grantedAt` string comparison ('f' sorts after every digit),
  // producing a delegation that `isDelegationActive` would have read as live
  // forever. The 400 must happen here, before the service is ever called.
  it('rejects an expiresAt that is not an ISO 8601 UTC instant', async () => {
    const { controller } = await buildController();
    expect(() =>
      controller.createDelegation(currentUser('janaki'), {
        delegatePhone: DELEGATE_PHONE,
        scopes: ['VIEW_RECORD'],
        expiresAt: 'forever',
      }),
    ).toThrow(BadRequestException);
  });
});
