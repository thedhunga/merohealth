import { grantDelegation, grantGuardianshipForMinor } from '@swasthya/family';
import { describe, expect, it } from 'vitest';

import { UnknownActingSubjectError, buildActingSubjects, resolveActingSubject, type ActingSubject } from './acting-subjects';

const self: ActingSubject = { id: 'local-1', displayName: 'You', relationship: 'SELF' };
const grandmother: ActingSubject = { id: 'sunita', displayName: 'Sunita', relationship: 'DELEGATE' };

describe('resolveActingSubject', () => {
  it('resolves an id present in the authorised list', () => {
    expect(resolveActingSubject([self, grandmother], 'sunita')).toBe(grandmother);
  });

  it('resolves the self subject when it is the only one available', () => {
    expect(resolveActingSubject([self], 'local-1')).toBe(self);
  });

  it('refuses to resolve an id outside the authorised list rather than falling back silently', () => {
    // family-and-proxy.md §1: acting for someone else must never look like
    // acting for yourself — a silent fallback to whatever the caller had
    // before would be exactly that failure, so this must throw, not return.
    expect(() => resolveActingSubject([self], 'someone-else')).toThrow(UnknownActingSubjectError);
  });

  it('refuses a lookup against an empty list', () => {
    expect(() => resolveActingSubject([], 'local-1')).toThrow(UnknownActingSubjectError);
  });
});

describe('buildActingSubjects', () => {
  const viewer = { id: 'arjun', displayName: 'You' };
  const now = '2026-08-15T00:00:00.000Z';

  it('is single-SELF when no grants are supplied — the honest state until apps/api exposes a grants endpoint', () => {
    expect(buildActingSubjects(viewer, [], [], now)).toEqual([
      { id: 'arjun', displayName: 'You', relationship: 'SELF' },
    ]);
  });

  it('adds an active ward the viewer guards, keyed by the id listActiveGuardianshipsFor already filtered to', () => {
    const grant = grantGuardianshipForMinor('g-1', 'roshani', 'arjun', '2014-03-10T00:00:00.000Z', '2026-08-10T00:00:00.000Z');

    expect(buildActingSubjects(viewer, [grant], [], now)).toEqual([
      { id: 'arjun', displayName: 'You', relationship: 'SELF' },
      { id: 'roshani', displayName: 'roshani', relationship: 'GUARDIAN' },
    ]);
  });

  it('adds an active granter the viewer may act as a delegate for', () => {
    const grant = grantDelegation('d-1', 'janaki', 'arjun', ['VIEW_RECORD'], '2026-08-10T00:00:00.000Z', '2026-11-10T00:00:00.000Z');

    expect(buildActingSubjects(viewer, [], [grant], now)).toEqual([
      { id: 'arjun', displayName: 'You', relationship: 'SELF' },
      { id: 'janaki', displayName: 'janaki', relationship: 'DELEGATE' },
    ]);
  });

  it('excludes a guardianship that has lapsed past the ward\'s 18th birthday, via listActiveGuardianshipsFor', () => {
    const grant = grantGuardianshipForMinor('g-1', 'roshani', 'arjun', '2014-03-10T00:00:00.000Z', '2026-08-10T00:00:00.000Z');

    expect(buildActingSubjects(viewer, [grant], [], '2033-01-01T00:00:00.000Z')).toEqual([
      { id: 'arjun', displayName: 'You', relationship: 'SELF' },
    ]);
  });

  it('never adds a grant belonging to a different guardian or delegate', () => {
    const guardianship = grantGuardianshipForMinor('g-1', 'roshani', 'sunita', '2014-03-10T00:00:00.000Z', '2026-08-10T00:00:00.000Z');
    const delegation = grantDelegation('d-1', 'janaki', 'sunita', ['VIEW_RECORD'], '2026-08-10T00:00:00.000Z', '2026-11-10T00:00:00.000Z');

    expect(buildActingSubjects(viewer, [guardianship], [delegation], now)).toEqual([
      { id: 'arjun', displayName: 'You', relationship: 'SELF' },
    ]);
  });
});
