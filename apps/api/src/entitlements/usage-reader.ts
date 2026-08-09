import type { QuotaDimension } from '@swasthya/shared-types';

/**
 * DI token. Each feature module binds its own implementation, scoped to the
 * quota dimensions that module can actually meter — there is no single
 * global usage source yet, so this port stays module-local rather than
 * pretending one implementation could answer for every dimension today.
 */
export const USAGE_READER = 'USAGE_READER';

export interface UsageReader {
  /** Current usage for `ownerId` against `dimension`, as of this call. */
  read(ownerId: string, dimension: QuotaDimension): number;
}
