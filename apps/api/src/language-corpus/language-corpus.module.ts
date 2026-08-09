import { Module } from '@nestjs/common';
import { CorpusReviewerGuard } from './corpus-reviewer.guard.js';
import { LanguageCorpusController } from './language-corpus.controller.js';
import { LanguageCorpusRepository } from './language-corpus.repository.js';
import { LanguageCorpusService } from './language-corpus.service.js';

@Module({
  controllers: [LanguageCorpusController],
  providers: [LanguageCorpusRepository, LanguageCorpusService, CorpusReviewerGuard],
})
export class LanguageCorpusModule {}
