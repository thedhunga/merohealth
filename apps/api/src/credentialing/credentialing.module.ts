import { Module } from '@nestjs/common';
import { CredentialingController } from './credentialing.controller.js';
import { CredentialingRepository } from './credentialing.repository.js';
import { CredentialingService } from './credentialing.service.js';
import { ReviewerGuard } from './reviewer.guard.js';

@Module({
  controllers: [CredentialingController],
  providers: [CredentialingRepository, CredentialingService, ReviewerGuard],
})
export class CredentialingModule {}
