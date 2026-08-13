import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { checkModule, checkQuota } from '@swasthya/entitlements';
import { meetsAssuranceForModule, minimumAssuranceLevel } from '@swasthya/identity';
import type { AssuranceLevel, ModuleKey, QuotaDimension } from '@swasthya/shared-types';
import { REQUIRED_MODULE_KEY, REQUIRED_QUOTA_KEY } from './require-entitlement.decorator.js';
import { SUBSCRIPTION_RESOLVER, type SubscriptionResolver } from './subscription-resolver.js';
import { USAGE_READER, type UsageReader } from './usage-reader.js';

/**
 * Enforces `@RequireModule`/`@RequireQuota` at the HTTP boundary — the
 * "checkModule and checkQuota" gate the platform-core queue item asks for. A
 * route with neither decorator passes through untouched; this guard adds no
 * behaviour to routes that don't opt in.
 *
 * `packages/entitlements`'s `checkModule`/`checkQuota` return a verdict
 * rather than throw, precisely so a caller can offer an upgrade instead of a
 * flat failure — that verdict is forwarded whole in the exception body here,
 * so a client can render "upgrade to PLUS" rather than a bare 403.
 *
 * Round two A4: `ownerId` used to come from a client-supplied `body`/`query`
 * field — a tier check against an identity nobody had verified. It now
 * reads `request.subjectId`, which only `SessionAuthGuard` sets, having
 * resolved it from a real session token. Every route carrying
 * `@RequireModule`/`@RequireQuota` must therefore also carry
 * `@UseGuards(SessionAuthGuard, EntitlementsGuard)` — guard order matters,
 * `SessionAuthGuard` first — or this guard has nothing trustworthy to read
 * and fails closed rather than silently resolving a tier for nobody.
 *
 * A paid plan is not the only gate a module can carry. `packages/identity`'s
 * `minimumAssuranceLevel` — transcribed from
 * `identity-and-credentialing.md` §2's table — names `RECORD_SHARING`,
 * `PROVIDER_EXPORT` and `TELECONSULTATION` as requiring `IDENTITY_VERIFIED`,
 * not merely `REGISTERED` (phone + OTP). That table existed since the
 * 2026-08-09 run that built `packages/identity`, deferred wiring it here
 * because `SessionAuthGuard` didn't exist yet to supply a real
 * `assuranceLevel`; it does now, on the same `request.authUser` a `@RequireModule`
 * route already runs behind. Checked here, ahead of `checkModule`, since a
 * plan upgrade cannot substitute for identity verification the way it can
 * for a quota limit.
 */
@Injectable()
export class EntitlementsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(SUBSCRIPTION_RESOLVER) private readonly subscriptions: SubscriptionResolver,
    @Inject(USAGE_READER) private readonly usage: UsageReader,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredModule = this.reflector.get<ModuleKey | undefined>(REQUIRED_MODULE_KEY, context.getHandler());
    const requiredQuota = this.reflector.get<QuotaDimension | undefined>(
      REQUIRED_QUOTA_KEY,
      context.getHandler(),
    );
    if (!requiredModule && !requiredQuota) return true;

    const ownerId = extractOwnerId(context);
    const tier = this.subscriptions.resolveTier(ownerId);

    if (requiredModule) {
      const assuranceLevel = extractAssuranceLevel(context);
      if (!meetsAssuranceForModule(assuranceLevel, requiredModule)) {
        throw new ForbiddenException({
          code: 'IDENTITY_VERIFICATION_REQUIRED',
          module: requiredModule,
          required: minimumAssuranceLevel[requiredModule],
          current: assuranceLevel,
        });
      }

      const verdict = checkModule(tier, requiredModule);
      if (!verdict.allowed) {
        throw new ForbiddenException({ code: 'MODULE_NOT_INCLUDED', ...verdict });
      }
    }

    if (requiredQuota) {
      const used = this.usage.read(ownerId, requiredQuota);
      const verdict = checkQuota(tier, requiredQuota, used);
      if (!verdict.allowed) {
        throw new ForbiddenException({ code: 'QUOTA_EXCEEDED', ...verdict });
      }
    }

    return true;
  }
}

/**
 * `subjectId` is set only by `SessionAuthGuard`, from a verified session
 * token — never trusted from the request body/query the way `ownerId` used
 * to be. A missing value means either the caller has no valid session (the
 * normal 401 case) or this route forgot to run `SessionAuthGuard` first (a
 * wiring bug); both fail the same way, since neither should resolve a tier.
 */
function extractOwnerId(context: ExecutionContext): string {
  const request = context.switchToHttp().getRequest<{ subjectId?: string }>();
  if (!request.subjectId) {
    throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Sign in required' });
  }
  return request.subjectId;
}

/**
 * `SessionAuthGuard` sets `request.authUser` in the same step it sets
 * `request.subjectId`, so a request that reached here (past `extractOwnerId`)
 * always carries one — but this reads independently and defaults to the
 * floor of the ladder rather than assuming, matching `extractOwnerId`'s own
 * fail-closed stance rather than trusting a field a wiring bug could omit.
 */
function extractAssuranceLevel(context: ExecutionContext): AssuranceLevel {
  const request = context.switchToHttp().getRequest<{ authUser?: { assuranceLevel?: AssuranceLevel } }>();
  return request.authUser?.assuranceLevel ?? 'ANONYMOUS';
}
