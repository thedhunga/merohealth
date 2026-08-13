import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { IdentityController } from './identity.controller.js';
import { IdentityReviewerGuard } from './identity-reviewer.guard.js';
import { IdentityRepository } from './identity.repository.js';
import { IdentityService } from './identity.service.js';

/**
 * Imports `AuthModule` for `SessionAuthGuard` (the same "import the module,
 * get the guard" wiring `CredentialingModule` uses) and for the exported
 * `AUTH_STORE` token `IdentityService.approve` writes through to raise a
 * verified owner to `IDENTITY_VERIFIED` — the same store `FamilyGrantsService`
 * already reaches into directly for its own phone lookup, not a second one.
 */
@Module({
  imports: [AuthModule],
  controllers: [IdentityController],
  providers: [IdentityRepository, IdentityService, IdentityReviewerGuard],
})
export class IdentityModule {}
