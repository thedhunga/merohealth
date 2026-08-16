import { describe, expect, it } from 'vitest';
import { InMemoryTwinProfileStore } from './in-memory-twin-profile.store.js';
import { TwinProfileService } from './twin-profile.service.js';

describe('TwinProfileService.confirmProfile', () => {
  it('builds one PATIENT_REPORTED/PATIENT_CONFIRMED fact per confirmed field, including one per condition', async () => {
    const store = new InMemoryTwinProfileStore();
    const service = new TwinProfileService(store);

    const result = await service.confirmProfile('sunita', {
      ageBand: '40to60',
      askingFor: 'parent',
      conditions: ['diabetes', 'bloodPressure'],
    });

    expect(result).toEqual({ created: 4 });
    const facts = store.factsByUserId.get('sunita') ?? [];
    expect(facts).toHaveLength(4);
    for (const fact of facts) {
      expect(fact.provenance).toBe('PATIENT_REPORTED');
      expect(fact.verification).toBe('PATIENT_CONFIRMED');
    }
    expect(facts.map((f) => [f.kind, f.value])).toEqual([
      ['AGE_BAND', '40to60'],
      ['CARE_FOCUS', 'parent'],
      ['CONDITION', 'diabetes'],
      ['CONDITION', 'bloodPressure'],
    ]);
  });

  it('creates nothing for fields that were not offered', async () => {
    const store = new InMemoryTwinProfileStore();
    const service = new TwinProfileService(store);

    const result = await service.confirmProfile('sunita', { ageBand: '18to40' });

    expect(result).toEqual({ created: 1 });
    expect(store.factsByUserId.get('sunita')).toHaveLength(1);
  });

  it('gives each fact a distinct id even when confirming the same condition kind twice', async () => {
    const store = new InMemoryTwinProfileStore();
    const service = new TwinProfileService(store);

    await service.confirmProfile('sunita', { conditions: ['diabetes', 'thyroid'] });

    const [first, second] = store.factsByUserId.get('sunita') ?? [];
    expect(first?.id).not.toBe(second?.id);
  });
});
