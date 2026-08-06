import { Module } from '@nestjs/common';
import { CompanionController } from './companion.controller.js';
import { DirectoryController } from './directory.controller.js';
import { HealthController } from './health.controller.js';

@Module({ controllers: [HealthController, CompanionController, DirectoryController] })
export class AppModule {}
