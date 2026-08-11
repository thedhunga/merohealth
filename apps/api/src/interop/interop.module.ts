import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RecordsModule } from '../records/records.module.js';
import { InteropController } from './interop.controller.js';
import { InteropRepository } from './interop.repository.js';
import { InteropService } from './interop.service.js';

/**
 * Imports `RecordsModule` for `RecordsService` — this module's one real
 * dependency, per its `ModuleDescriptor` — and `AuthModule` for
 * `SessionAuthGuard`, the same "import the module, get the guard" pattern
 * `RecordsModule` itself documents.
 */
@Module({
  imports: [AuthModule, RecordsModule],
  controllers: [InteropController],
  providers: [InteropRepository, InteropService],
  exports: [InteropService],
})
export class InteropModule {}
