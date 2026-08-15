import { Injectable } from '@nestjs/common';
import type { QuotaDimension } from '@swasthya/shared-types';
import type { UsageReader } from './usage-reader.js';

/**
 * `EntitlementsGuard` injects a `UsageReader` unconditionally — even on a
 * route that only carries `@RequireModule` — because the binding is resolved
 * once at construction, not per-route. A module gating on module membership
 * alone has nothing to meter, so this stands in for that case: unlike
 * `RecordsUsageReader`'s single real dimension, every call here is a route
 * wired ahead of its own metering, so it always fails loudly rather than
 * reporting zero usage and letting a quota gate pass by accident.
 */
@Injectable()
export class NoQuotaUsageReader implements UsageReader {
  read(ownerId: string, dimension: QuotaDimension): number {
    throw new Error(`No quota is metered here; unexpected @RequireQuota(${dimension}) for ${ownerId}`);
  }
}
