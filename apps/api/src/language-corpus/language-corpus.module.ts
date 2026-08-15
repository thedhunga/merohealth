import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CorpusReviewerGuard } from './corpus-reviewer.guard.js';
import { LanguageCorpusController } from './language-corpus.controller.js';
import { LanguageCorpusRepository } from './language-corpus.repository.js';
import { LanguageCorpusService } from './language-corpus.service.js';

/**
 * Imports `AuthModule` for `SessionAuthGuard` — the same "import the module,
 * get the guard" wiring `CredentialingModule` already uses. `CorpusReviewerGuard`
 * now reads `request.authUser`, which only `SessionAuthGuard` populates, so
 * every reviewer route runs `@UseGuards(SessionAuthGuard, CorpusReviewerGuard)`
 * in that order.
 */
@Module({
  imports: [AuthModule],
  controllers: [LanguageCorpusController],
  providers: [LanguageCorpusRepository, LanguageCorpusService, CorpusReviewerGuard],
})
export class LanguageCorpusModule {}
