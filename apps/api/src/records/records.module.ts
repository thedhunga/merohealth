import { Module } from '@nestjs/common';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { EntitlementsGuard } from '../entitlements/entitlements.guard.js';
import { FreeTierSubscriptionResolver, SUBSCRIPTION_RESOLVER } from '../entitlements/subscription-resolver.js';
import { USAGE_READER } from '../entitlements/usage-reader.js';
import { RecordsController } from './records.controller.js';
import { RecordsRepository } from './records.repository.js';
import { RecordsUsageReader } from './records-usage.reader.js';
import { HEALTH_DOCUMENT_STORE, RecordsService } from './records.service.js';

/**
 * Binds the storage port to the in-memory hosted adapter for now. Swapping in
 * the real MinIO-backed adapter (queued next after the Prisma schema) is a
 * one-line change here — nothing in RecordsService or RecordsController
 * knows which adapter is behind the port.
 *
 * Also binds this module's two entitlement ports: `SUBSCRIPTION_RESOLVER` to
 * the `FREE`-for-everyone stand-in (no Subscription persistence exists yet)
 * and `USAGE_READER` to `RecordsUsageReader`, the only quota dimension this
 * module can meter honestly today. `EntitlementsGuard` itself is generic and
 * lives outside this module — provided here only because Nest resolves a
 * controller's `@UseGuards` providers from its own module's container.
 */
@Module({
  controllers: [RecordsController],
  providers: [
    RecordsRepository,
    RecordsService,
    RecordsUsageReader,
    EntitlementsGuard,
    { provide: HEALTH_DOCUMENT_STORE, useValue: new InMemoryDocumentStore('HOSTED') },
    { provide: SUBSCRIPTION_RESOLVER, useClass: FreeTierSubscriptionResolver },
    { provide: USAGE_READER, useClass: RecordsUsageReader },
  ],
})
export class RecordsModule {}
