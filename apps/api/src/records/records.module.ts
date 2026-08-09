import { Module } from '@nestjs/common';
import { InMemoryDocumentStore, type HealthDocumentStore } from '@swasthya/storage-adapters';
import { MinioDocumentStore, minioConfigFromEnv } from '@swasthya/storage-adapters/hosted';
import { EntitlementsGuard } from '../entitlements/entitlements.guard.js';
import { FreeTierSubscriptionResolver, SUBSCRIPTION_RESOLVER } from '../entitlements/subscription-resolver.js';
import { USAGE_READER } from '../entitlements/usage-reader.js';
import { RecordsController } from './records.controller.js';
import { RecordsRepository } from './records.repository.js';
import { RecordsUsageReader } from './records-usage.reader.js';
import { HEALTH_DOCUMENT_STORE, RecordsService } from './records.service.js';

/**
 * `OBJECT_STORAGE_ENDPOINT` (see `.env.example`) is how a deployment opts into the
 * real MinIO-backed adapter; unset, this falls back to the in-memory store so a
 * bare checkout still boots and its own test suite never needs a running object
 * store. Nothing in `RecordsService`/`RecordsController` knows which adapter this
 * resolves to — that is the point of the port.
 */
function createDocumentStore(): HealthDocumentStore {
  return process.env['OBJECT_STORAGE_ENDPOINT']
    ? new MinioDocumentStore(minioConfigFromEnv())
    : new InMemoryDocumentStore('HOSTED');
}

/**
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
    { provide: HEALTH_DOCUMENT_STORE, useFactory: createDocumentStore },
    { provide: SUBSCRIPTION_RESOLVER, useClass: FreeTierSubscriptionResolver },
    { provide: USAGE_READER, useClass: RecordsUsageReader },
  ],
  // RecordsService is this module's public port — `clinical-charting`
  // imports RecordsModule to inject it, the same "import the module, get the
  // service" wiring SchedulingModule already uses for PatientRegistryModule.
  exports: [RecordsService],
})
export class RecordsModule {}
