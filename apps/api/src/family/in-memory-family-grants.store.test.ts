import { grantDelegation, grantGuardianshipForMinor } from '@swasthya/family';
import { describe, expect, it } from 'vitest';
import { InMemoryFamilyGrantsStore } from './in-memory-family-grants.store.js';

describe('InMemoryFamilyGrantsStore', () => {
  const guardianship = grantGuardianshipForMinor('g-1', 'roshani', 'sunita', '2014-03-10T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
  const delegation = grantDelegation('d-1', 'janaki', 'arjun', ['VIEW_RECORD'], '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z');
  const store = new InMemoryFamilyGrantsStore([guardianship], [delegation]);

  it('scopes guardianshipsFor to the requested guardian, never returning another guardian’s grants', async () => {
    expect(await store.guardianshipsFor('sunita')).toEqual([guardianship]);
    expect(await store.guardianshipsFor('someone-else')).toEqual([]);
  });

  it('scopes delegationsFor to the requested delegate, never returning another delegate’s grants', async () => {
    expect(await store.delegationsFor('arjun')).toEqual([delegation]);
    expect(await store.delegationsFor('someone-else')).toEqual([]);
  });
});
