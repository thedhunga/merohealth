import { Module } from '@nestjs/common';
import { PatientRegistryModule } from '../patient-registry/patient-registry.module.js';
import { createEngagementDeliveryProvider, ENGAGEMENT_DELIVERY_PROVIDER } from './delivery-provider.js';
import { EngagementMessageRateLimiter } from './engagement-message-rate-limiter.js';
import { EngagementController } from './engagement.controller.js';
import { EngagementRepository } from './engagement.repository.js';
import { EngagementService } from './engagement.service.js';

@Module({
  imports: [PatientRegistryModule],
  controllers: [EngagementController],
  providers: [
    EngagementRepository,
    EngagementService,
    EngagementMessageRateLimiter,
    { provide: ENGAGEMENT_DELIVERY_PROVIDER, useFactory: createEngagementDeliveryProvider },
  ],
  exports: [EngagementService],
})
export class EngagementModule {}
