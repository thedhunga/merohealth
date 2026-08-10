import { Injectable } from '@nestjs/common';
import type { QuotaDimension } from '@swasthya/shared-types';
import type { UsageReader } from '../entitlements/usage-reader.js';
import { RecordsRepository } from './records.repository.js';

/**
 * The only dimension this module can honestly meter today is
 * `DOCUMENTS_STORED` — a straight count off `RecordsRepository`. The other
 * four dimensions in `QuotaDimension` (extraction pages, assistant messages,
 * share links, connected devices) belong to modules that don't exist yet;
 * asking this reader about one is a route wired ahead of its own metering,
 * so it fails loudly rather than silently reporting zero usage and letting
 * the gate pass by accident.
 */
@Injectable()
export class RecordsUsageReader implements UsageReader {
  constructor(private readonly repository: RecordsRepository) {}

  read(ownerId: string, dimension: QuotaDimension): number {
    if (dimension !== 'DOCUMENTS_STORED') {
      throw new Error(`RecordsUsageReader has no meter for ${dimension} yet`);
    }
    return this.repository.listDocuments(ownerId).length;
  }
}
