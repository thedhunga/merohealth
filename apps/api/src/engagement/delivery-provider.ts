import { Injectable, Logger } from '@nestjs/common';
import type { EngagementChannel } from '@swasthya/shared-types';

export const ENGAGEMENT_DELIVERY_PROVIDER = 'ENGAGEMENT_DELIVERY_PROVIDER';

export interface EngagementDeliveryProvider {
  send(channel: EngagementChannel, phone: string, message: string): Promise<void>;
}

/**
 * `ENGAGEMENT_PROVIDER=mock` in `.env.example` — the only adapter this repo
 * ships, mirroring `apps/api/src/auth/sms-provider.ts`'s own precedent
 * (already built for OTP delivery): logs instead of sending, since there is
 * no contracted SMS/WhatsApp gateway yet. Swap this out wholesale once one
 * exists — do not extend it with fake delivery guarantees.
 */
@Injectable()
export class MockEngagementDeliveryProvider implements EngagementDeliveryProvider {
  private readonly logger = new Logger('MockEngagementDeliveryProvider');

  send(channel: EngagementChannel, phone: string, message: string): Promise<void> {
    this.logger.log(`[mock ${channel}] to ${phone}: ${message}`);
    return Promise.resolve();
  }
}

/**
 * Env-gated the same way `sms-provider.ts`'s own `createSmsProvider` picks
 * an adapter. Throws rather than silently falling back to mock for an
 * unrecognised value — believing a message was sent through a real gateway
 * that was never wired up is worse than a loud boot-time failure.
 */
export function createEngagementDeliveryProvider(): EngagementDeliveryProvider {
  const provider = process.env['ENGAGEMENT_PROVIDER'] ?? 'mock';
  if (provider !== 'mock') {
    throw new Error(`ENGAGEMENT_PROVIDER=${provider} has no adapter yet — only "mock" is implemented`);
  }
  return new MockEngagementDeliveryProvider();
}
