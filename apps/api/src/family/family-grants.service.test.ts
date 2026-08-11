import { BadRequestException, NotFoundException } from '@nestjs/common';
import { grantDelegation, grantGuardianshipForMinor, isDelegationActive } from '@swasthya/family';
import { describe, expect, it } from 'vitest';
import { InMemoryAuthStore } from '../auth/in-memory-auth.store.js';
import { FamilyGrantsService } from './family-grants.service.js';
import { InMemoryFamilyGrantsStore } from './in-memory-family-grants.store.js';

describe('FamilyGrantsService.grantsFor', () => {
  it('returns all three grant directions for the requested subject, unfiltered by liveness', async () => {
    // Deliberately includes an expired grant — this service must not
    // re-apply the active-at-`now` filter `listActiveGuardianshipsFor`
    // already owns; see the service's own doc comment on why.
    const expiredGuardianship = grantGuardianshipForMinor(
      'g-1',
      'roshani',
      'sunita',
      '2005-03-10T00:00:00.000Z',
      '2020-01-01T00:00:00.000Z',
    );
    const receivedDelegation = grantDelegation('d-1', 'janaki', 'sunita', ['VIEW_RECORD'], '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z');
    const grantedDelegation = grantDelegation('d-2', 'sunita', 'arjun', ['ASK_ASSISTANT'], '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z');
    const service = new FamilyGrantsService(
      new InMemoryFamilyGrantsStore([expiredGuardianship], [receivedDelegation, grantedDelegation]),
      new InMemoryAuthStore(),
    );

    expect(await service.grantsFor('sunita')).toEqual({
      guardianships: [expiredGuardianship],
      delegations: [receivedDelegation],
      delegationsGranted: [grantedDelegation],
    });
  });

  it('returns empty arrays for a subject with no grants in any direction', async () => {
    const service = new FamilyGrantsService(new InMemoryFamilyGrantsStore(), new InMemoryAuthStore());
    expect(await service.grantsFor('nobody')).toEqual({ guardianships: [], delegations: [], delegationsGranted: [] });
  });
});

describe('FamilyGrantsService.createDelegation', () => {
  const DELEGATE_PHONE = '9812345678';

  async function buildService() {
    const authStore = new InMemoryAuthStore();
    const delegate = await authStore.createPatientUser({ phone: DELEGATE_PHONE, locale: 'ne' });
    const familyStore = new InMemoryFamilyGrantsStore();
    return { service: new FamilyGrantsService(familyStore, authStore), familyStore, delegate };
  }

  it('resolves the delegate by phone, persists the grant, and returns it self-service (enrolment null)', async () => {
    const { service, familyStore, delegate } = await buildService();

    const grant = await service.createDelegation('janaki', DELEGATE_PHONE, ['VIEW_RECORD', 'ASK_ASSISTANT'], '2027-01-01T00:00:00.000Z');

    expect(grant.granterId).toBe('janaki');
    expect(grant.delegateId).toBe(delegate.id);
    expect(grant.scopes).toEqual(['VIEW_RECORD', 'ASK_ASSISTANT']);
    expect(grant.enrolment).toBeNull();
    expect(await familyStore.delegationsFor(delegate.id)).toEqual([grant]);
  });

  it('accepts a phone number typed with a +977 country code, the same as AuthService.requestOtp does', async () => {
    const { service, delegate } = await buildService();

    const grant = await service.createDelegation('janaki', `+977${DELEGATE_PHONE}`, ['VIEW_RECORD'], '2027-01-01T00:00:00.000Z');

    expect(grant.delegateId).toBe(delegate.id);
  });

  it('rejects a malformed phone number as a 400, mirroring AuthService.parsePhone', async () => {
    const { service } = await buildService();
    await expect(service.createDelegation('janaki', 'not-a-phone', ['VIEW_RECORD'], '2027-01-01T00:00:00.000Z')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('404s when no registered person holds that phone number', async () => {
    const { service } = await buildService();
    await expect(service.createDelegation('janaki', '9800000000', ['VIEW_RECORD'], '2027-01-01T00:00:00.000Z')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('maps packages/family domain errors to BadRequestException rather than letting them escape as plain Errors', async () => {
    const { service, delegate } = await buildService();

    // Self-delegation: the delegate phone resolves back to the granter themself.
    await expect(service.createDelegation(delegate.id, DELEGATE_PHONE, ['VIEW_RECORD'], '2027-01-01T00:00:00.000Z')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    // Empty scopes.
    await expect(service.createDelegation('janaki', DELEGATE_PHONE, [], '2027-01-01T00:00:00.000Z')).rejects.toBeInstanceOf(BadRequestException);
    // expiresAt not after grantedAt (grantedAt is `now`, so a past date always fails).
    await expect(service.createDelegation('janaki', DELEGATE_PHONE, ['VIEW_RECORD'], '2020-01-01T00:00:00.000Z')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('FamilyGrantsService.revokeDelegation', () => {
  it('revokes a grant the caller made as granter, and the store reflects it as no longer active', async () => {
    const grant = grantDelegation('d-1', 'janaki', 'arjun', ['VIEW_RECORD'], '2026-01-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z');
    const store = new InMemoryFamilyGrantsStore([], [grant]);
    const service = new FamilyGrantsService(store, new InMemoryAuthStore());

    const revoked = await service.revokeDelegation('janaki', 'd-1');

    expect(revoked.revokedAt).not.toBeNull();
    expect(isDelegationActive(revoked, new Date().toISOString())).toBe(false);
    // The store, not just the returned value, was updated.
    expect((await store.delegationsFor('arjun'))[0]?.revokedAt).toBe(revoked.revokedAt);
  });

  it('is idempotent — revoking an already-revoked grant keeps the original revokedAt', async () => {
    const grant = grantDelegation('d-1', 'janaki', 'arjun', ['VIEW_RECORD'], '2026-01-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z');
    const store = new InMemoryFamilyGrantsStore([], [grant]);
    const service = new FamilyGrantsService(store, new InMemoryAuthStore());

    const first = await service.revokeDelegation('janaki', 'd-1');
    const second = await service.revokeDelegation('janaki', 'd-1');

    expect(second.revokedAt).toBe(first.revokedAt);
  });

  it('404s as DELEGATION_NOT_FOUND rather than revoking, when the caller is not the grant’s granter', async () => {
    const grant = grantDelegation('d-1', 'janaki', 'arjun', ['VIEW_RECORD'], '2026-01-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z');
    const store = new InMemoryFamilyGrantsStore([], [grant]);
    const service = new FamilyGrantsService(store, new InMemoryAuthStore());

    // `arjun` is the delegate, not the granter — the delegate must not be
    // able to revoke access to a record they don't own.
    await expect(service.revokeDelegation('arjun', 'd-1')).rejects.toBeInstanceOf(NotFoundException);
    expect((await store.delegationsFor('arjun'))[0]?.revokedAt).toBeNull();
  });

  it('404s as DELEGATION_NOT_FOUND for an id that does not exist at all', async () => {
    const service = new FamilyGrantsService(new InMemoryFamilyGrantsStore(), new InMemoryAuthStore());
    await expect(service.revokeDelegation('janaki', 'no-such-id')).rejects.toBeInstanceOf(NotFoundException);
  });
});
