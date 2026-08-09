import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { checkModule, checkQuota } from '@swasthya/entitlements';
import type { ModuleKey, QuotaDimension } from '@swasthya/shared-types';
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
 * `ownerId` travels as a plain body/query field today, the same as every
 * other owner-scoped route in this API (there is no auth layer yet — see
 * `RecordsController`'s own `requireOwnerId`). Checked here too, ahead of
 * the controller's own zod validation, because a guard that silently passes
 * `undefined` to `resolveTier` would defeat the point of gating.
 */
function extractOwnerId(context: ExecutionContext): string {
  const request = context.switchToHttp().getRequest<{
    body?: Record<string, unknown>;
    query?: Record<string, unknown>;
  }>();
  const ownerId = request.body?.['ownerId'] ?? request.query?.['ownerId'];
  if (typeof ownerId !== 'string' || ownerId.trim().length === 0) {
    throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'ownerId is required' });
  }
  return ownerId;
}
