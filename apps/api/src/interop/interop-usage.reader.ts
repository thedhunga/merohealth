import { Injectable } from '@nestjs/common';
import { isShareLinkActive } from '@swasthya/interop';
import type { QuotaDimension } from '@swasthya/shared-types';
import type { UsageReader } from '../entitlements/usage-reader.js';
import { InteropRepository } from './interop.repository.js';

/**
 * The only dimension this module can honestly meter is `ACTIVE_SHARE_LINKS`
 * — a count of the owner's links that are still active as of now, the same
 * "active" test `resolveSharedBundle` itself gates on. A revoked or expired
 * link frees its slot back for the tier's ceiling, matching how `scheduling`
 * exempts a cancelled appointment from its own conflict check. Any other
 * dimension fails loudly, the same `RecordsUsageReader` convention: this is
 * a route wired ahead of its own metering, not a zero.
 */
@Injectable()
export class InteropUsageReader implements UsageReader {
  constructor(private readonly repository: InteropRepository) {}

  read(ownerId: string, dimension: QuotaDimension): number {
    if (dimension !== 'ACTIVE_SHARE_LINKS') {
      throw new Error(`InteropUsageReader has no meter for ${dimension} yet`);
    }
    const now = new Date().toISOString();
    return this.repository.listForOwner(ownerId).filter((link) => isShareLinkActive(link, now)).length;
  }
}
