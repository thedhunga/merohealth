import type {
  ClinicalDegradation,
  ClinicalHealthStatus,
  ClinicalModuleDescriptor,
  ClinicalModuleHealth,
  ClinicalModuleKey,
} from '@swasthya/shared-types';

/* ------------------------------------------------------------------ *
 * Registry
 *
 * clinical-suite.md §2: "the shell renders around holes" and "every
 * dependency declares its degradation" both assume the full set of
 * `requires`/`degradesWith` edges is known and internally consistent before
 * anything resolves availability against it. `buildModuleRegistry` is the one
 * place that consistency is checked — a typo'd or not-yet-built dependency
 * key fails loudly here, at wiring time, rather than silently resolving to
 * "unavailable" forever at request time.
 * ------------------------------------------------------------------ */

export type ModuleRegistry = ReadonlyMap<ClinicalModuleKey, ClinicalModuleDescriptor>;

export class DuplicateModuleError extends Error {
  constructor(key: ClinicalModuleKey) {
    super(`Module ${key} is registered more than once`);
    this.name = 'DuplicateModuleError';
  }
}

export class UnknownModuleReferenceError extends Error {
  constructor(from: ClinicalModuleKey, to: ClinicalModuleKey, via: 'requires' | 'degradesWith') {
    super(`${from} declares a "${via}" dependency on ${to}, which is not registered`);
    this.name = 'UnknownModuleReferenceError';
  }
}

/**
 * Guards `resolveAvailability` against a registry that was never validated by
 * `buildModuleRegistry` (a hand-built `Map` in a test, for instance) and so
 * still contains a `requires`/`degradesWith` edge pointing at nothing.
 */
export class ModuleNotRegisteredError extends Error {
  constructor(key: ClinicalModuleKey) {
    super(`No descriptor registered for module ${key}`);
    this.name = 'ModuleNotRegisteredError';
  }
}

export function buildModuleRegistry(descriptors: readonly ClinicalModuleDescriptor[]): ModuleRegistry {
  const registry = new Map<ClinicalModuleKey, ClinicalModuleDescriptor>();

  for (const descriptor of descriptors) {
    if (registry.has(descriptor.key)) throw new DuplicateModuleError(descriptor.key);
    registry.set(descriptor.key, descriptor);
  }

  for (const descriptor of registry.values()) {
    for (const required of descriptor.requires) {
      if (!registry.has(required)) throw new UnknownModuleReferenceError(descriptor.key, required, 'requires');
    }
    for (const dependency of descriptor.degradesWith) {
      if (!registry.has(dependency.key)) {
        throw new UnknownModuleReferenceError(descriptor.key, dependency.key, 'degradesWith');
      }
    }
  }

  return registry;
}

/* ------------------------------------------------------------------ *
 * Resolver
 *
 * Pure and synchronous on purpose: it takes a health snapshot rather than
 * calling `health()` itself, so resolving availability never depends on
 * network timing and is trivial to test against a fixed set of states. See
 * `collectHealthStates` below for the async step that produces a snapshot
 * from a live registry.
 * ------------------------------------------------------------------ */

export interface ResolvedModule {
  key: ClinicalModuleKey;
  /** False when this module's own health is DOWN, or a `requires` dependency is unavailable. */
  available: boolean;
  /** The module's own reported status. DOWN when the snapshot has no entry — unknown health is never treated as UP. */
  health: ClinicalHealthStatus;
  /**
   * Every `requires` dependency (direct or transitive) that is unavailable and
   * therefore takes this module down with it. Empty when `available` is true,
   * and empty when this module is unavailable only because of its *own*
   * health — check `health === 'DOWN'` for that case.
   */
  blockedBy: readonly ClinicalModuleKey[];
  /**
   * Every `degradesWith` dependency currently unavailable, paired with the
   * mode this module itself declared for it. A module can be degraded by more
   * than one dependency at once; this resolver reports each one rather than
   * collapsing them into a single invented severity ranking — the doc names
   * no ordering between `HIDE`/`READ_ONLY`/`QUEUE_AND_RETRY`/`MANUAL`, so
   * picking one here would be a fabricated policy, not a read fact. Always
   * empty when `available` is false: a module that cannot run has nothing
   * left to degrade.
   */
  degradations: readonly { dependency: ClinicalModuleKey; mode: ClinicalDegradation }[];
}

export class CyclicModuleDependencyError extends Error {
  constructor(chain: readonly ClinicalModuleKey[]) {
    super(`Cyclic "requires" dependency: ${chain.join(' → ')}`);
    this.name = 'CyclicModuleDependencyError';
  }
}

/**
 * Computes, for every registered module, what it can currently do given a
 * snapshot of module health. Two cascades, per §2:
 *
 * - `requires` is transitive and binary: any unavailable link in the chain
 *   makes every module above it unavailable too.
 * - `degradesWith` never cascades past one hop: a module only reacts to its
 *   own declared dependencies, in the mode *it* chose, exactly the point of
 *   §2's worked example (prescribing degrades to MANUAL against a down drug
 *   database rather than going down with it).
 */
export function resolveAvailability(
  registry: ModuleRegistry,
  healthStates: ReadonlyMap<ClinicalModuleKey, ClinicalModuleHealth>,
): ReadonlyMap<ClinicalModuleKey, ResolvedModule> {
  const cache = new Map<ClinicalModuleKey, ResolvedModule>();

  function resolve(key: ClinicalModuleKey, visiting: ReadonlySet<ClinicalModuleKey>): ResolvedModule {
    const cached = cache.get(key);
    if (cached) return cached;
    if (visiting.has(key)) throw new CyclicModuleDependencyError([...visiting, key]);

    const descriptor = registry.get(key);
    if (!descriptor) throw new ModuleNotRegisteredError(key);
    const nextVisiting = new Set(visiting).add(key);

    const health = healthStates.get(key)?.status ?? 'DOWN';

    const blockedBy = new Set<ClinicalModuleKey>();
    for (const required of descriptor.requires) {
      const resolvedRequired = resolve(required, nextVisiting);
      if (!resolvedRequired.available) {
        blockedBy.add(required);
        for (const transitive of resolvedRequired.blockedBy) blockedBy.add(transitive);
      }
    }

    const available = health !== 'DOWN' && blockedBy.size === 0;

    const degradations: { dependency: ClinicalModuleKey; mode: ClinicalDegradation }[] = [];
    if (available) {
      for (const dependency of descriptor.degradesWith) {
        const resolvedDependency = resolve(dependency.key, nextVisiting);
        if (!resolvedDependency.available) {
          degradations.push({ dependency: dependency.key, mode: dependency.mode });
        }
      }
    }

    const result: ResolvedModule = { key, available, health, blockedBy: [...blockedBy], degradations };
    cache.set(key, result);
    return result;
  }

  for (const key of registry.keys()) resolve(key, new Set());
  return cache;
}

/**
 * Bridges from a live registry to the health snapshot `resolveAvailability`
 * needs, calling every module's `health()` in parallel. A probe that throws
 * is itself treated as DOWN rather than rejecting the whole call — §2 rule 6
 * ("timeouts and circuit breakers on every outbound call") applies to this
 * package's own dependency on each module's health check, not only to the
 * modules it is describing.
 */
export async function collectHealthStates(
  registry: ModuleRegistry,
): Promise<ReadonlyMap<ClinicalModuleKey, ClinicalModuleHealth>> {
  const entries = await Promise.all(
    [...registry.entries()].map(async ([key, descriptor]) => {
      try {
        return [key, await descriptor.health()] as const;
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        return [key, { status: 'DOWN', detail } satisfies ClinicalModuleHealth] as const;
      }
    }),
  );
  return new Map(entries);
}
