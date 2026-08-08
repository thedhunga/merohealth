import { Module } from '@nestjs/common';
import { CompanionController } from './companion.controller.js';
import { DirectoryController } from './directory.controller.js';
import { HealthController } from './health.controller.js';
import { PerplexityHealthService } from './perplexity-health.service.js';

@Module({
  controllers: [HealthController, CompanionController, DirectoryController],
  providers: [PerplexityHealthService],
})
export class AppModule {}
