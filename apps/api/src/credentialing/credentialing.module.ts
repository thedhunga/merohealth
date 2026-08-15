import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CredentialingController } from './credentialing.controller.js';
import { CredentialingRepository } from './credentialing.repository.js';
import { CredentialingService } from './credentialing.service.js';
import { ReviewerGuard } from './reviewer.guard.js';

/**
 * Imports `AuthModule` for `SessionAuthGuard` — the same "import the module,
 * get the guard" wiring `RecordsModule` already uses. `ReviewerGuard` now
 * reads `request.authUser`, which only `SessionAuthGuard` populates, so every
 * reviewer route runs `@UseGuards(SessionAuthGuard, ReviewerGuard)` in that
 * order.
 */
@Module({
  imports: [AuthModule],
  controllers: [CredentialingController],
  providers: [CredentialingRepository, CredentialingService, ReviewerGuard],
})
export class CredentialingModule {}
