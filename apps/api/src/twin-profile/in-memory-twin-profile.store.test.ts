import { describe, expect, it } from 'vitest';
import type { TwinFact } from '@swasthya/shared-types';
import { InMemoryTwinProfileStore } from './in-memory-twin-profile.store.js';

const FACT: TwinFact = {
  id: 'fact-1',
  kind: 'AGE_BAND',
  label: 'Age range',
  value: '40to60',
  provenance: 'PATIENT_REPORTED',
  verification: 'PATIENT_CONFIRMED',
  sensitivity: 'STANDARD',
  recordedAt: '2026-08-16T00:00:00.000Z',
  version: 1,
};

describe('InMemoryTwinProfileStore.confirmFacts', () => {
  it('stores every fact under the confirming user and reports how many were created', async () => {
    const store = new InMemoryTwinProfileStore();

    const result = await store.confirmFacts({ userId: 'sunita', facts: [FACT] });

    expect(result).toEqual({ created: 1 });
    expect(store.factsByUserId.get('sunita')).toEqual([FACT]);
  });

  it('appends across separate confirmations rather than overwriting', async () => {
    const store = new InMemoryTwinProfileStore();
    await store.confirmFacts({ userId: 'sunita', facts: [FACT] });

    await store.confirmFacts({ userId: 'sunita', facts: [{ ...FACT, id: 'fact-2', kind: 'CARE_FOCUS', value: 'parent' }] });

    expect(store.factsByUserId.get('sunita')).toHaveLength(2);
  });

  it('keeps different users independent', async () => {
    const store = new InMemoryTwinProfileStore();
    await store.confirmFacts({ userId: 'sunita', facts: [FACT] });

    await store.confirmFacts({ userId: 'ram', facts: [] });

    expect(store.factsByUserId.get('sunita')).toHaveLength(1);
    expect(store.factsByUserId.get('ram')).toEqual([]);
  });
});
