import { describe, expect, it } from 'vitest';
import type { ClinicalModuleDescriptor, ClinicalModuleHealth, ClinicalModuleKey } from '@swasthya/shared-types';

import {
  CyclicModuleDependencyError,
  DuplicateModuleError,
  ModuleNotRegisteredError,
  UnknownModuleReferenceError,
  buildModuleRegistry,
  collectHealthStates,
  resolveAvailability,
} from './index';

function makeDescriptor(overrides: Partial<ClinicalModuleDescriptor> & { key: ClinicalModuleKey }): ClinicalModuleDescriptor {
  return {
    requires: [],
    degradesWith: [],
    health: () => Promise.resolve({ status: 'UP' }),
    ...overrides,
  };
}

describe('buildModuleRegistry', () => {
  it('builds a registry keyed by module', () => {
    const registry = buildModuleRegistry([
      makeDescriptor({ key: 'PATIENT_REGISTRY' }),
      makeDescriptor({ key: 'SCHEDULING' }),
    ]);

    expect(registry.size).toBe(2);
    expect(registry.get('PATIENT_REGISTRY')?.key).toBe('PATIENT_REGISTRY');
  });

  it('rejects the same module key registered twice', () => {
    expect(() =>
      buildModuleRegistry([makeDescriptor({ key: 'SCHEDULING' }), makeDescriptor({ key: 'SCHEDULING' })]),
    ).toThrow(DuplicateModuleError);
  });

  it('rejects a "requires" edge to a module that was never registered', () => {
    expect(() =>
      buildModuleRegistry([makeDescriptor({ key: 'SCHEDULING', requires: ['PATIENT_REGISTRY'] })]),
    ).toThrow(UnknownModuleReferenceError);
  });

  it('rejects a "degradesWith" edge to a module that was never registered', () => {
    expect(() =>
      buildModuleRegistry([
        makeDescriptor({ key: 'PRESCRIBING', degradesWith: [{ key: 'MEDICATION_SAFETY', mode: 'MANUAL' }] }),
      ]),
    ).toThrow(UnknownModuleReferenceError);
  });
});

describe('resolveAvailability', () => {
  it('reports a healthy, dependency-free module as fully available', () => {
    const registry = buildModuleRegistry([makeDescriptor({ key: 'PATIENT_REGISTRY' })]);
    const health = new Map<ClinicalModuleKey, ClinicalModuleHealth>([['PATIENT_REGISTRY', { status: 'UP' }]]);

    const resolved = resolveAvailability(registry, health);

    expect(resolved.get('PATIENT_REGISTRY')).toEqual({
      key: 'PATIENT_REGISTRY',
      available: true,
      health: 'UP',
      blockedBy: [],
      degradations: [],
    });
  });

  it('treats a module missing from the health snapshot as DOWN, never UP', () => {
    const registry = buildModuleRegistry([makeDescriptor({ key: 'PATIENT_REGISTRY' })]);

    const resolved = resolveAvailability(registry, new Map());

    const result = resolved.get('PATIENT_REGISTRY');
    expect(result?.health).toBe('DOWN');
    expect(result?.available).toBe(false);
  });

  it('a module DOWN by its own health is unavailable with no blockedBy entries', () => {
    const registry = buildModuleRegistry([makeDescriptor({ key: 'PATIENT_REGISTRY' })]);
    const health = new Map<ClinicalModuleKey, ClinicalModuleHealth>([['PATIENT_REGISTRY', { status: 'DOWN' }]]);

    const result = resolveAvailability(registry, health).get('PATIENT_REGISTRY');

    expect(result?.available).toBe(false);
    expect(result?.blockedBy).toEqual([]);
  });

  it('cascades "requires" so a down dependency takes the dependent down too', () => {
    const registry = buildModuleRegistry([
      makeDescriptor({ key: 'PATIENT_REGISTRY' }),
      makeDescriptor({ key: 'SCHEDULING', requires: ['PATIENT_REGISTRY'] }),
    ]);
    const health = new Map<ClinicalModuleKey, ClinicalModuleHealth>([
      ['PATIENT_REGISTRY', { status: 'DOWN' }],
      ['SCHEDULING', { status: 'UP' }],
    ]);

    const resolved = resolveAvailability(registry, health);

    expect(resolved.get('SCHEDULING')?.available).toBe(false);
    expect(resolved.get('SCHEDULING')?.blockedBy).toEqual(['PATIENT_REGISTRY']);
  });

  it('cascades "requires" transitively, naming every link in the chain', () => {
    const registry = buildModuleRegistry([
      makeDescriptor({ key: 'PATIENT_REGISTRY' }),
      makeDescriptor({ key: 'SCHEDULING', requires: ['PATIENT_REGISTRY'] }),
      makeDescriptor({ key: 'CLINICAL_CHARTING', requires: ['SCHEDULING'] }),
    ]);
    const health = new Map<ClinicalModuleKey, ClinicalModuleHealth>([
      ['PATIENT_REGISTRY', { status: 'DOWN' }],
      ['SCHEDULING', { status: 'UP' }],
      ['CLINICAL_CHARTING', { status: 'UP' }],
    ]);

    const resolved = resolveAvailability(registry, health);

    expect(resolved.get('SCHEDULING')?.blockedBy).toEqual(['PATIENT_REGISTRY']);
    const charting = resolved.get('CLINICAL_CHARTING');
    expect(charting?.available).toBe(false);
    expect(new Set(charting?.blockedBy)).toEqual(new Set(['SCHEDULING', 'PATIENT_REGISTRY']));
  });

  it('a "degradesWith" dependency that is DOWN triggers the declared mode, worked example from §2', () => {
    const registry = buildModuleRegistry([
      makeDescriptor({ key: 'MEDICATION_SAFETY' }),
      makeDescriptor({
        key: 'PRESCRIBING',
        degradesWith: [{ key: 'MEDICATION_SAFETY', mode: 'MANUAL' }],
      }),
    ]);
    const health = new Map<ClinicalModuleKey, ClinicalModuleHealth>([
      ['MEDICATION_SAFETY', { status: 'DOWN' }],
      ['PRESCRIBING', { status: 'UP' }],
    ]);

    const resolved = resolveAvailability(registry, health);

    expect(resolved.get('PRESCRIBING')?.available).toBe(true);
    expect(resolved.get('PRESCRIBING')?.degradations).toEqual([{ dependency: 'MEDICATION_SAFETY', mode: 'MANUAL' }]);
  });

  it('a "degradesWith" dependency that is merely DEGRADED, not DOWN, does not trigger the mode', () => {
    const registry = buildModuleRegistry([
      makeDescriptor({ key: 'MEDICATION_SAFETY' }),
      makeDescriptor({
        key: 'PRESCRIBING',
        degradesWith: [{ key: 'MEDICATION_SAFETY', mode: 'MANUAL' }],
      }),
    ]);
    const health = new Map<ClinicalModuleKey, ClinicalModuleHealth>([
      ['MEDICATION_SAFETY', { status: 'DEGRADED' }],
      ['PRESCRIBING', { status: 'UP' }],
    ]);

    const resolved = resolveAvailability(registry, health);

    expect(resolved.get('PRESCRIBING')?.degradations).toEqual([]);
  });

  it('reports every simultaneously-triggered degradation rather than collapsing to one', () => {
    const registry = buildModuleRegistry([
      makeDescriptor({ key: 'MEDICATION_SAFETY' }),
      makeDescriptor({ key: 'PATIENT_REGISTRY' }),
      makeDescriptor({
        key: 'PRESCRIBING',
        degradesWith: [
          { key: 'MEDICATION_SAFETY', mode: 'MANUAL' },
          { key: 'PATIENT_REGISTRY', mode: 'READ_ONLY' },
        ],
      }),
    ]);
    const health = new Map<ClinicalModuleKey, ClinicalModuleHealth>([
      ['MEDICATION_SAFETY', { status: 'DOWN' }],
      ['PATIENT_REGISTRY', { status: 'DOWN' }],
      ['PRESCRIBING', { status: 'UP' }],
    ]);

    const resolved = resolveAvailability(registry, health);

    expect(resolved.get('PRESCRIBING')?.degradations).toEqual([
      { dependency: 'MEDICATION_SAFETY', mode: 'MANUAL' },
      { dependency: 'PATIENT_REGISTRY', mode: 'READ_ONLY' },
    ]);
  });

  it('an unavailable module reports no degradations — nothing left to degrade', () => {
    const registry = buildModuleRegistry([
      makeDescriptor({ key: 'PATIENT_REGISTRY' }),
      makeDescriptor({
        key: 'SCHEDULING',
        requires: ['PATIENT_REGISTRY'],
        degradesWith: [{ key: 'PATIENT_REGISTRY', mode: 'READ_ONLY' }],
      }),
    ]);
    const health = new Map<ClinicalModuleKey, ClinicalModuleHealth>([
      ['PATIENT_REGISTRY', { status: 'DOWN' }],
      ['SCHEDULING', { status: 'UP' }],
    ]);

    const resolved = resolveAvailability(registry, health);

    expect(resolved.get('SCHEDULING')?.available).toBe(false);
    expect(resolved.get('SCHEDULING')?.degradations).toEqual([]);
  });

  it('throws on a cyclic "requires" chain instead of recursing forever', () => {
    const registry = buildModuleRegistry([
      makeDescriptor({ key: 'PATIENT_REGISTRY', requires: ['SCHEDULING'] }),
      makeDescriptor({ key: 'SCHEDULING', requires: ['PATIENT_REGISTRY'] }),
    ]);
    const health = new Map<ClinicalModuleKey, ClinicalModuleHealth>([
      ['PATIENT_REGISTRY', { status: 'UP' }],
      ['SCHEDULING', { status: 'UP' }],
    ]);

    expect(() => resolveAvailability(registry, health)).toThrow(CyclicModuleDependencyError);
  });

  it('throws a clear error for a registry that skipped buildModuleRegistry validation', () => {
    const unvalidated = new Map<ClinicalModuleKey, ClinicalModuleDescriptor>([
      ['SCHEDULING', makeDescriptor({ key: 'SCHEDULING', requires: ['PATIENT_REGISTRY'] })],
    ]);

    expect(() => resolveAvailability(unvalidated, new Map())).toThrow(ModuleNotRegisteredError);
  });
});

describe('collectHealthStates', () => {
  it('calls health() on every registered module and collects the results', async () => {
    const registry = buildModuleRegistry([
      makeDescriptor({ key: 'PATIENT_REGISTRY', health: () => Promise.resolve({ status: 'UP' }) }),
      makeDescriptor({ key: 'SCHEDULING', health: () => Promise.resolve({ status: 'DEGRADED', detail: 'slow' }) }),
    ]);

    const snapshot = await collectHealthStates(registry);

    expect(snapshot.get('PATIENT_REGISTRY')).toEqual({ status: 'UP' });
    expect(snapshot.get('SCHEDULING')).toEqual({ status: 'DEGRADED', detail: 'slow' });
  });

  it('treats a health probe that throws as DOWN rather than rejecting the whole call', async () => {
    const registry = buildModuleRegistry([
      makeDescriptor({
        key: 'PATIENT_REGISTRY',
        health: () => Promise.reject(new Error('timed out')),
      }),
    ]);

    const snapshot = await collectHealthStates(registry);

    expect(snapshot.get('PATIENT_REGISTRY')).toEqual({ status: 'DOWN', detail: 'timed out' });
  });
});
