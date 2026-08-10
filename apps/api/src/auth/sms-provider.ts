import { Injectable, Logger } from '@nestjs/common';

export const SMS_PROVIDER = 'SMS_PROVIDER';

export interface SmsProvider {
  send(phone: string, message: string): Promise<void>;
}

/**
 * `SMS_PROVIDER=mock` in `.env.example` — the only adapter this repo ships,
 * since there is no contracted SMS gateway yet. Logs instead of sending, the
 * same honest "process-local placeholder" `FreeTierSubscriptionResolver`
 * already sets a precedent for: swap this out wholesale once a real gateway
 * exists, do not extend it with fake delivery guarantees.
 */
@Injectable()
export class MockSmsProvider implements SmsProvider {
  private readonly logger = new Logger('MockSmsProvider');

  send(phone: string, message: string): Promise<void> {
    this.logger.log(`[mock SMS] to ${phone}: ${message}`);
    return Promise.resolve();
  }
}

/**
 * Env-gated the same way `records.module.ts`'s `createDocumentStore` picks
 * an adapter, so a future real gateway slots in behind the same switch.
 * Throws rather than silently falling back to mock for an unrecognised
 * value — sending no SMS while believing one went out is worse than a
 * loud boot-time failure.
 */
export function createSmsProvider(): SmsProvider {
  const provider = process.env['SMS_PROVIDER'] ?? 'mock';
  if (provider !== 'mock') {
    throw new Error(`SMS_PROVIDER=${provider} has no adapter yet — only "mock" is implemented`);
  }
  return new MockSmsProvider();
}
