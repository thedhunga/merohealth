import { Module } from '@nestjs/common';
import { InMemoryDocumentStore } from '@swasthya/storage-adapters';
import { RecordsController } from './records.controller.js';
import { RecordsRepository } from './records.repository.js';
import { HEALTH_DOCUMENT_STORE, RecordsService } from './records.service.js';

/**
 * Binds the storage port to the in-memory hosted adapter for now. Swapping in
 * the real MinIO-backed adapter (queued next after the Prisma schema) is a
 * one-line change here — nothing in RecordsService or RecordsController
 * knows which adapter is behind the port.
 */
@Module({
  controllers: [RecordsController],
  providers: [
    RecordsRepository,
    RecordsService,
    { provide: HEALTH_DOCUMENT_STORE, useValue: new InMemoryDocumentStore('HOSTED') },
  ],
})
export class RecordsModule {}
