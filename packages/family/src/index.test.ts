import { describe, expect, it } from 'vitest';

import {
  InvalidDelegationExpiryError,
  InvalidGuardianshipExpiryError,
  SelfDelegationError,
  WardAlreadyOfAgeError,
  grantDelegation,
  grantGuardianshipForIncapacity,
  grantGuardianshipForMinor,
  guardianshipExpiryForMinor,
  isDelegationActive,
  isGuardianshipActive,
  revokeDelegation,
  revokeGuardianship,
} from './index';

// Roshani's date of birth, matching packages/database/src/seed-data.ts's
// caregiverRelationships[0].startsAt (Sunita's guardianship of Roshani
// begins at birth) — reusing the real demo fixture rather than inventing a
// second family, per the standing "invent no facts" constraint.
const roshaniDateOfBirth = '2014-03-10T00:00:00.000Z';

describe('guardianship — minor', () => {
  it('sets expiresAt to the ward\'s 18th birthday, computed rather than accepted from the caller', () => {
    expect(guardianshipExpiryForMinor(roshaniDateOfBirth)).toBe('2032-03-10T00:00:00.000Z');

    const grant = grantGuardianshipForMinor(
      'g-1',
      'roshani',
      'sunita',
      roshaniDateOfBirth,
      '2026-08-10T00:00:00.000Z',
    );

    expect(grant).toEqual({
      id: 'g-1',
      wardId: 'roshani',
      guardianId: 'sunita',
      grounds: 'MINOR',
      grantedAt: '2026-08-10T00:00:00.000Z',
      expiresAt: '2032-03-10T00:00:00.000Z',
      revokedAt: null,
    });
  });

  it('refuses to grant MINOR guardianship for someone already 18+', () => {
    expect(() =>
      grantGuardianshipForMinor('g-1', 'arjun', 'someone', '2000-01-01T00:00:00.000Z', '2026-08-10T00:00:00.000Z'),
    ).toThrow(WardAlreadyOfAgeError);
  });

  it('is active only between grantedAt and expiresAt — never before, never at or after', () => {
    const grant = grantGuardianshipForMinor(
      'g-1',
      'roshani',
      'sunita',
      roshaniDateOfBirth,
      '2026-08-10T00:00:00.000Z',
    );

    expect(isGuardianshipActive(grant, '2026-08-09T00:00:00.000Z')).toBe(false);
    expect(isGuardianshipActive(grant, '2027-01-01T00:00:00.000Z')).toBe(true);
    // The mandatory transition at 18: active up to the instant of the
    // birthday, not one moment after — nothing "silently continues".
    expect(isGuardianshipActive(grant, '2032-03-09T00:00:00.000Z')).toBe(true);
    expect(isGuardianshipActive(grant, '2032-03-10T00:00:00.000Z')).toBe(false);
  });

  it('revokeGuardianship ends access early and is idempotent on a second call', () => {
    const grant = grantGuardianshipForMinor(
      'g-1',
      'roshani',
      'sunita',
      roshaniDateOfBirth,
      '2026-08-10T00:00:00.000Z',
    );

    const revoked = revokeGuardianship(grant, '2027-01-01T00:00:00.000Z');
    expect(revoked.revokedAt).toBe('2027-01-01T00:00:00.000Z');
    expect(isGuardianshipActive(revoked, '2027-06-01T00:00:00.000Z')).toBe(false);

    const revokedAgain = revokeGuardianship(revoked, '2027-06-01T00:00:00.000Z');
    expect(revokedAgain.revokedAt).toBe('2027-01-01T00:00:00.000Z');
  });
});

describe('guardianship — incapacity', () => {
  it('takes expiresAt from the caller rather than computing one, unlike the MINOR path', () => {
    const grant = grantGuardianshipForIncapacity(
      'g-2',
      'janaki',
      'sunita',
      '2027-08-10T00:00:00.000Z',
      '2026-08-10T00:00:00.000Z',
    );

    expect(grant.grounds).toBe('INCAPACITY');
    expect(grant.expiresAt).toBe('2027-08-10T00:00:00.000Z');
  });

  it('rejects an expiry at or before the grant itself — an expiry is mandatory and must mean something', () => {
    expect(() =>
      grantGuardianshipForIncapacity('g-2', 'janaki', 'sunita', '2026-08-10T00:00:00.000Z', '2026-08-10T00:00:00.000Z'),
    ).toThrow(InvalidGuardianshipExpiryError);
  });
});

describe('delegation', () => {
  it('grants a time-bounded, revocable relationship distinct from guardianship — the delegate never gains a grounds field', () => {
    const grant = grantDelegation('d-1', 'janaki', 'arjun', '2026-08-10T00:00:00.000Z', '2026-11-10T00:00:00.000Z');

    expect(grant).toEqual({
      id: 'd-1',
      granterId: 'janaki',
      delegateId: 'arjun',
      grantedAt: '2026-08-10T00:00:00.000Z',
      expiresAt: '2026-11-10T00:00:00.000Z',
      revokedAt: null,
    });
    expect(grant).not.toHaveProperty('grounds');
  });

  it('refuses self-delegation — a competent grandmother is not a dependent of herself either', () => {
    expect(() =>
      grantDelegation('d-1', 'janaki', 'janaki', '2026-08-10T00:00:00.000Z', '2026-11-10T00:00:00.000Z'),
    ).toThrow(SelfDelegationError);
  });

  it('rejects an expiry at or before the grant, same invariant as guardianship', () => {
    expect(() =>
      grantDelegation('d-1', 'janaki', 'arjun', '2026-08-10T00:00:00.000Z', '2026-08-10T00:00:00.000Z'),
    ).toThrow(InvalidDelegationExpiryError);
  });

  it('is active only between grantedAt and expiresAt, and lapses on its own without a revoke', () => {
    const grant = grantDelegation('d-1', 'janaki', 'arjun', '2026-08-10T00:00:00.000Z', '2026-11-10T00:00:00.000Z');

    expect(isDelegationActive(grant, '2026-08-09T00:00:00.000Z')).toBe(false);
    expect(isDelegationActive(grant, '2026-09-01T00:00:00.000Z')).toBe(true);
    expect(isDelegationActive(grant, '2026-11-10T00:00:00.000Z')).toBe(false);
  });

  it('revokeDelegation ends access before the natural expiry and is idempotent', () => {
    const grant = grantDelegation('d-1', 'janaki', 'arjun', '2026-08-10T00:00:00.000Z', '2026-11-10T00:00:00.000Z');

    const revoked = revokeDelegation(grant, '2026-09-01T00:00:00.000Z');
    expect(isDelegationActive(revoked, '2026-09-15T00:00:00.000Z')).toBe(false);

    const revokedAgain = revokeDelegation(revoked, '2026-10-01T00:00:00.000Z');
    expect(revokedAgain.revokedAt).toBe('2026-09-01T00:00:00.000Z');
  });
});
