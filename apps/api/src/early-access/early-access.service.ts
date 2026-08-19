import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { EARLY_ACCESS_STORE, type EarlyAccessSource, type EarlyAccessStore } from './early-access-store.js';
import { EarlyAccessRateLimiter } from './early-access-rate-limiter.js';

export interface RegisterInput {
  contact: string | null;
  source: EarlyAccessSource;
  registeredAt: Date;
}

export interface LinkToUserInput extends RegisterInput {
  userId: string;
}

@Injectable()
export class EarlyAccessService {
  constructor(
    @Inject(EARLY_ACCESS_STORE) private readonly store: EarlyAccessStore,
    private readonly rateLimiter: EarlyAccessRateLimiter,
  ) {}

  /** The anonymous, pre-sign-in path — `EarlyAccessController.register`. */
  async register(input: RegisterInput, rateLimitKey: string): Promise<{ outcome: 'created' | 'alreadyRegistered' }> {
    if (!this.rateLimiter.allow(rateLimitKey)) {
      throw new HttpException(
        { code: 'EARLY_ACCESS_RATE_LIMITED', message: 'Too many requests — try again later' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const result = await this.store.register({ ...input, userId: null });
    // `register`'s own contract never returns `linked` for an anonymous
    // call (`userId: null` can't cause a link) — narrowed here so this
    // method's return type promises exactly what it can produce.
    return { outcome: result.outcome === 'created' ? 'created' : 'alreadyRegistered' };
  }

  /** Called from `HistoryController.migrate` once a person is signed in — never reachable anonymously, so no rate limit. */
  async linkToUser(input: LinkToUserInput): Promise<void> {
    await this.store.register({ ...input, userId: input.userId });
  }
}
