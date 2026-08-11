import { grantDelegation, grantGuardianshipForMinor } from '@swasthya/family';
import { describe, expect, it } from 'vitest';
import { FamilyGrantsService } from './family-grants.service.js';
import { InMemoryFamilyGrantsStore } from './in-memory-family-grants.store.js';

describe('FamilyGrantsService', () => {
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
    const service = new FamilyGrantsService(new InMemoryFamilyGrantsStore([expiredGuardianship], [delegation]));

    expect(await service.grantsFor('sunita')).toEqual({ guardianships: [expiredGuardianship], delegations: [delegation] });
  });

  it('returns empty arrays for a subject with no grants either direction', async () => {
    const service = new FamilyGrantsService(new InMemoryFamilyGrantsStore());
    expect(await service.grantsFor('nobody')).toEqual({ guardianships: [], delegations: [] });
  });
});
