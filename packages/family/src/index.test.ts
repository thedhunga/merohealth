import { describe, expect, it } from 'vitest';

import {
  EmptyDelegationScopeError,
  InvalidDelegationExpiryError,
  InvalidGuardianshipExpiryError,
  SelfDelegationError,
  SelfRecordedAssistedEnrolmentError,
  UnauthorizedAccessError,
  WardAlreadyOfAgeError,
  accessLogForOwner,
  grantDelegation,
  grantDelegationByAssistedEnrolment,
  grantGuardianshipForIncapacity,
  grantGuardianshipForMinor,
  guardianshipExpiryForMinor,
  hasScope,
  isDelegationActive,
  isGuardianshipActive,
  recordDelegatedAccess,
  recordGuardianshipAccess,
  revokeDelegation,
  revokeGuardianship,
  wasAssistedEnrolment,
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
    const grant = grantDelegation(
      'd-1',
      'janaki',
      'arjun',
      ['MANAGE_APPOINTMENTS'],
      '2026-08-10T00:00:00.000Z',
      '2026-11-10T00:00:00.000Z',
    );

    expect(grant).toEqual({
      id: 'd-1',
      granterId: 'janaki',
      delegateId: 'arjun',
      scopes: ['MANAGE_APPOINTMENTS'],
      grantedAt: '2026-08-10T00:00:00.000Z',
      expiresAt: '2026-11-10T00:00:00.000Z',
      revokedAt: null,
      enrolment: null,
    });
    expect(grant).not.toHaveProperty('grounds');
    expect(wasAssistedEnrolment(grant)).toBe(false);
  });

  it('refuses self-delegation — a competent grandmother is not a dependent of herself either', () => {
    expect(() =>
      grantDelegation(
        'd-1',
        'janaki',
        'janaki',
        ['VIEW_RECORD'],
        '2026-08-10T00:00:00.000Z',
        '2026-11-10T00:00:00.000Z',
      ),
    ).toThrow(SelfDelegationError);
  });

  it('refuses a delegation with no scopes — granting nothing is not a delegation', () => {
    expect(() =>
      grantDelegation('d-1', 'janaki', 'arjun', [], '2026-08-10T00:00:00.000Z', '2026-11-10T00:00:00.000Z'),
    ).toThrow(EmptyDelegationScopeError);
  });

  it('rejects an expiry at or before the grant, same invariant as guardianship', () => {
    expect(() =>
      grantDelegation(
        'd-1',
        'janaki',
        'arjun',
        ['VIEW_RECORD'],
        '2026-08-10T00:00:00.000Z',
        '2026-08-10T00:00:00.000Z',
      ),
    ).toThrow(InvalidDelegationExpiryError);
  });

  it('is active only between grantedAt and expiresAt, and lapses on its own without a revoke', () => {
    const grant = grantDelegation(
      'd-1',
      'janaki',
      'arjun',
      ['VIEW_RECORD'],
      '2026-08-10T00:00:00.000Z',
      '2026-11-10T00:00:00.000Z',
    );

    expect(isDelegationActive(grant, '2026-08-09T00:00:00.000Z')).toBe(false);
    expect(isDelegationActive(grant, '2026-09-01T00:00:00.000Z')).toBe(true);
    expect(isDelegationActive(grant, '2026-11-10T00:00:00.000Z')).toBe(false);
  });

  it('revokeDelegation ends access before the natural expiry and is idempotent', () => {
    const grant = grantDelegation(
      'd-1',
      'janaki',
      'arjun',
      ['VIEW_RECORD'],
      '2026-08-10T00:00:00.000Z',
      '2026-11-10T00:00:00.000Z',
    );

    const revoked = revokeDelegation(grant, '2026-09-01T00:00:00.000Z');
    expect(isDelegationActive(revoked, '2026-09-15T00:00:00.000Z')).toBe(false);

    const revokedAgain = revokeDelegation(revoked, '2026-10-01T00:00:00.000Z');
    expect(revokedAgain.revokedAt).toBe('2026-09-01T00:00:00.000Z');
  });
});

describe('delegation scopes', () => {
  it('grants scopes independently — MANAGE_APPOINTMENTS without VIEW_RECORD does not imply record access', () => {
    // family-and-proxy.md §2: "Booking an appointment must not require
    // reading her mental-health notes."
    const grant = grantDelegation(
      'd-2',
      'janaki',
      'arjun',
      ['MANAGE_APPOINTMENTS'],
      '2026-08-10T00:00:00.000Z',
      '2026-11-10T00:00:00.000Z',
    );

    expect(hasScope(grant, 'MANAGE_APPOINTMENTS', '2026-09-01T00:00:00.000Z')).toBe(true);
    expect(hasScope(grant, 'VIEW_RECORD', '2026-09-01T00:00:00.000Z')).toBe(false);
    expect(hasScope(grant, 'ASK_ASSISTANT', '2026-09-01T00:00:00.000Z')).toBe(false);
    expect(hasScope(grant, 'UPLOAD_DOCUMENTS', '2026-09-01T00:00:00.000Z')).toBe(false);
  });

  it('a delegate may hold more than one scope at once', () => {
    const grant = grantDelegation(
      'd-2',
      'janaki',
      'arjun',
      ['VIEW_RECORD', 'ASK_ASSISTANT'],
      '2026-08-10T00:00:00.000Z',
      '2026-11-10T00:00:00.000Z',
    );

    expect(hasScope(grant, 'VIEW_RECORD', '2026-09-01T00:00:00.000Z')).toBe(true);
    expect(hasScope(grant, 'ASK_ASSISTANT', '2026-09-01T00:00:00.000Z')).toBe(true);
    expect(hasScope(grant, 'UPLOAD_DOCUMENTS', '2026-09-01T00:00:00.000Z')).toBe(false);
  });

  it('a held scope stops counting once the grant expires — scope membership alone is not enough', () => {
    const grant = grantDelegation(
      'd-2',
      'janaki',
      'arjun',
      ['VIEW_RECORD'],
      '2026-08-10T00:00:00.000Z',
      '2026-11-10T00:00:00.000Z',
    );

    expect(hasScope(grant, 'VIEW_RECORD', '2026-11-10T00:00:00.000Z')).toBe(false);
  });

  it('a held scope stops counting once the grant is revoked', () => {
    const grant = grantDelegation(
      'd-2',
      'janaki',
      'arjun',
      ['UPLOAD_DOCUMENTS'],
      '2026-08-10T00:00:00.000Z',
      '2026-11-10T00:00:00.000Z',
    );
    const revoked = revokeDelegation(grant, '2026-09-01T00:00:00.000Z');

    expect(hasScope(revoked, 'UPLOAD_DOCUMENTS', '2026-09-15T00:00:00.000Z')).toBe(false);
  });
});

describe('assisted enrolment (family-and-proxy.md §3)', () => {
  it.each([['IN_PERSON_VERBAL'], ['WITNESSED'], ['CLINICIAN_ATTESTED'], ['WRITTEN']] as const)(
    'records %s as the consent method, and who recorded it — not merely that consent happened',
    (consentMethod) => {
      const grant = grantDelegationByAssistedEnrolment(
        'd-3',
        'janaki',
        'arjun',
        ['VIEW_RECORD', 'MANAGE_APPOINTMENTS'],
        '2026-08-10T00:00:00.000Z',
        '2026-11-10T00:00:00.000Z',
        consentMethod,
        'arjun',
      );

      expect(grant.enrolment).toEqual({ method: consentMethod, recordedBy: 'arjun' });
      expect(wasAssistedEnrolment(grant)).toBe(true);
    },
  );

  it('the person recording the enrolment need not be the delegate — a clinician can witness consent for a grant to someone else', () => {
    const grant = grantDelegationByAssistedEnrolment(
      'd-3',
      'janaki',
      'arjun',
      ['VIEW_RECORD'],
      '2026-08-10T00:00:00.000Z',
      '2026-11-10T00:00:00.000Z',
      'CLINICIAN_ATTESTED',
      'dr-thapa',
    );

    expect(grant.enrolment).toEqual({ method: 'CLINICIAN_ATTESTED', recordedBy: 'dr-thapa' });
  });

  it('refuses a granter recording her own "assisted" enrolment — that is self-service, not assistance', () => {
    expect(() =>
      grantDelegationByAssistedEnrolment(
        'd-3',
        'janaki',
        'arjun',
        ['VIEW_RECORD'],
        '2026-08-10T00:00:00.000Z',
        '2026-11-10T00:00:00.000Z',
        'WRITTEN',
        'janaki',
      ),
    ).toThrow(SelfRecordedAssistedEnrolmentError);
  });

  it('still enforces the ordinary delegation invariants — self-delegation, empty scopes, bad expiry', () => {
    expect(() =>
      grantDelegationByAssistedEnrolment(
        'd-3',
        'janaki',
        'arjun',
        [],
        '2026-08-10T00:00:00.000Z',
        '2026-11-10T00:00:00.000Z',
        'WITNESSED',
        'arjun',
      ),
    ).toThrow(EmptyDelegationScopeError);
  });

  it('a self-service grant is never mistaken for an assisted one, and vice versa', () => {
    const selfService = grantDelegation(
      'd-4',
      'janaki',
      'arjun',
      ['VIEW_RECORD'],
      '2026-08-10T00:00:00.000Z',
      '2026-11-10T00:00:00.000Z',
    );
    const assisted = grantDelegationByAssistedEnrolment(
      'd-5',
      'janaki',
      'arjun',
      ['VIEW_RECORD'],
      '2026-08-10T00:00:00.000Z',
      '2026-11-10T00:00:00.000Z',
      'IN_PERSON_VERBAL',
      'arjun',
    );

    expect(wasAssistedEnrolment(selfService)).toBe(false);
    expect(wasAssistedEnrolment(assisted)).toBe(true);
  });

  it('revocation is not tied to the granter being the one who calls it — a support agent can revoke on her behalf', () => {
    // family-and-proxy.md §2: "through any channel — including by phone to
    // support, because a person who cannot use the app cannot use an
    // in-app revoke button either." revokeDelegation takes only the grant
    // and a timestamp — no caller identity — so it already never requires
    // the granter herself to be the one invoking it from the app.
    const grant = grantDelegationByAssistedEnrolment(
      'd-6',
      'janaki',
      'arjun',
      ['VIEW_RECORD'],
      '2026-08-10T00:00:00.000Z',
      '2026-11-10T00:00:00.000Z',
      'WITNESSED',
      'arjun',
    );

    // A support agent handling a phone call from janaki records the same
    // revocation a self-service in-app tap would have produced.
    const revokedByPhoneSupport = revokeDelegation(grant, '2026-09-01T00:00:00.000Z');

    expect(isDelegationActive(revokedByPhoneSupport, '2026-09-15T00:00:00.000Z')).toBe(false);
  });
});

describe('access log — guardianship (family-and-proxy.md §4)', () => {
  it("logs a guardian opening the ward's record, attributed to the guardianship grant", () => {
    const grant = grantGuardianshipForMinor('g-1', 'roshani', 'sunita', roshaniDateOfBirth, '2026-08-10T00:00:00.000Z');

    const entry = recordGuardianshipAccess('a-1', grant, 'lab report — 2026-07-01', '2026-08-11T09:00:00.000Z');

    expect(entry).toEqual({
      id: 'a-1',
      ownerId: 'roshani',
      actorId: 'sunita',
      resource: 'lab report — 2026-07-01',
      occurredAt: '2026-08-11T09:00:00.000Z',
      authority: { type: 'GUARDIANSHIP', grantId: 'g-1' },
    });
  });

  it('refuses to log an access under guardianship that has already lapsed at 18', () => {
    const grant = grantGuardianshipForMinor('g-1', 'roshani', 'sunita', roshaniDateOfBirth, '2026-08-10T00:00:00.000Z');

    expect(() => recordGuardianshipAccess('a-1', grant, 'lab report', '2032-03-10T00:00:00.000Z')).toThrow(
      UnauthorizedAccessError,
    );
  });

  it('refuses to log an access after guardianship was revoked', () => {
    const grant = grantGuardianshipForMinor('g-1', 'roshani', 'sunita', roshaniDateOfBirth, '2026-08-10T00:00:00.000Z');
    const revoked = revokeGuardianship(grant, '2027-01-01T00:00:00.000Z');

    expect(() => recordGuardianshipAccess('a-1', revoked, 'lab report', '2027-06-01T00:00:00.000Z')).toThrow(
      UnauthorizedAccessError,
    );
  });
});

describe('access log — delegation (family-and-proxy.md §4)', () => {
  it("logs a delegate's access under the specific scope exercised", () => {
    const grant = grantDelegation(
      'd-1',
      'janaki',
      'arjun',
      ['VIEW_RECORD', 'MANAGE_APPOINTMENTS'],
      '2026-08-10T00:00:00.000Z',
      '2026-11-10T00:00:00.000Z',
    );

    const entry = recordDelegatedAccess('a-2', grant, 'VIEW_RECORD', 'discharge summary', '2026-08-15T00:00:00.000Z');

    expect(entry).toEqual({
      id: 'a-2',
      ownerId: 'janaki',
      actorId: 'arjun',
      resource: 'discharge summary',
      occurredAt: '2026-08-15T00:00:00.000Z',
      authority: { type: 'DELEGATION', grantId: 'd-1', scope: 'VIEW_RECORD' },
    });
  });

  it('refuses to log access under a scope the delegate was never granted', () => {
    // family-and-proxy.md §2: booking an appointment must not require
    // reading mental-health notes — a MANAGE_APPOINTMENTS-only delegate
    // exercising VIEW_RECORD is exactly the access this must catch.
    const grant = grantDelegation(
      'd-1',
      'janaki',
      'arjun',
      ['MANAGE_APPOINTMENTS'],
      '2026-08-10T00:00:00.000Z',
      '2026-11-10T00:00:00.000Z',
    );

    expect(() =>
      recordDelegatedAccess('a-2', grant, 'VIEW_RECORD', 'discharge summary', '2026-08-15T00:00:00.000Z'),
    ).toThrow(UnauthorizedAccessError);
  });

  it('refuses to log access after the delegation was revoked', () => {
    const grant = grantDelegation(
      'd-1',
      'janaki',
      'arjun',
      ['VIEW_RECORD'],
      '2026-08-10T00:00:00.000Z',
      '2026-11-10T00:00:00.000Z',
    );
    const revoked = revokeDelegation(grant, '2026-09-01T00:00:00.000Z');

    expect(() =>
      recordDelegatedAccess('a-2', revoked, 'VIEW_RECORD', 'discharge summary', '2026-09-15T00:00:00.000Z'),
    ).toThrow(UnauthorizedAccessError);
  });
});

describe('access log — owner visibility (family-and-proxy.md §4)', () => {
  it("shows the owner every access to her own record, not only to an administrator", () => {
    const delegation = grantDelegation(
      'd-1',
      'janaki',
      'arjun',
      ['VIEW_RECORD'],
      '2026-08-10T00:00:00.000Z',
      '2026-11-10T00:00:00.000Z',
    );
    const guardianship = grantGuardianshipForMinor('g-1', 'roshani', 'sunita', roshaniDateOfBirth, '2026-08-10T00:00:00.000Z');

    const janakiEntry = recordDelegatedAccess('a-2', delegation, 'VIEW_RECORD', 'discharge summary', '2026-08-15T00:00:00.000Z');
    const roshaniEntry = recordGuardianshipAccess('a-1', guardianship, 'lab report', '2026-08-11T09:00:00.000Z');

    // janaki's own log — only the entry on her record, never roshani's.
    expect(accessLogForOwner([janakiEntry, roshaniEntry], 'janaki')).toEqual([janakiEntry]);
  });

  it('never surfaces an entry where the viewer was only the actor, not the owner', () => {
    // Sunita is the guardian (the actor) here, not the owner — her own log
    // must not show her own access to roshani's record; that entry belongs
    // to roshani's log, since visibility belongs to the person, not the helper.
    const guardianship = grantGuardianshipForMinor('g-1', 'roshani', 'sunita', roshaniDateOfBirth, '2026-08-10T00:00:00.000Z');
    const entry = recordGuardianshipAccess('a-1', guardianship, 'lab report', '2026-08-11T09:00:00.000Z');

    expect(accessLogForOwner([entry], 'sunita')).toEqual([]);
    expect(accessLogForOwner([entry], 'roshani')).toEqual([entry]);
  });

  it('orders entries on the same record oldest first, so the history reads chronologically', () => {
    const grant = grantDelegation(
      'd-1',
      'janaki',
      'arjun',
      ['VIEW_RECORD'],
      '2026-08-10T00:00:00.000Z',
      '2026-11-10T00:00:00.000Z',
    );
    const later = recordDelegatedAccess('a-2', grant, 'VIEW_RECORD', 'second visit', '2026-08-20T00:00:00.000Z');
    const earlier = recordDelegatedAccess('a-1', grant, 'VIEW_RECORD', 'first visit', '2026-08-12T00:00:00.000Z');

    expect(accessLogForOwner([later, earlier], 'janaki')).toEqual([earlier, later]);
  });
});
