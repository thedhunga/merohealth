import { BadRequestException, NotFoundException } from '@nestjs/common';
import { grantDelegation, grantGuardianshipForMinor } from '@swasthya/family';
import { describe, expect, it } from 'vitest';
import { InMemoryAuthStore } from '../auth/in-memory-auth.store.js';
import { FamilyGrantsService } from './family-grants.service.js';
import { InMemoryFamilyGrantsStore } from './in-memory-family-grants.store.js';

describe('FamilyGrantsService.grantsFor', () => {
  it('returns both grant directions for the requested subject, unfiltered by liveness', async () => {
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
    const delegation = grantDelegation('d-1', 'janaki', 'sunita', ['VIEW_RECORD'], '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z');
    const service = new FamilyGrantsService(new InMemoryFamilyGrantsStore([expiredGuardianship], [delegation]), new InMemoryAuthStore());

    expect(await service.grantsFor('sunita')).toEqual({ guardianships: [expiredGuardianship], delegations: [delegation] });
  });

  it('returns empty arrays for a subject with no grants either direction', async () => {
    const service = new FamilyGrantsService(new InMemoryFamilyGrantsStore(), new InMemoryAuthStore());
    expect(await service.grantsFor('nobody')).toEqual({ guardianships: [], delegations: [] });
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
