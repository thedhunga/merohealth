import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PlanTier, QuotaDimension } from '@swasthya/shared-types';
import { describe, expect, it } from 'vitest';
import { EntitlementsGuard } from './entitlements.guard.js';
import { RequireModule, RequireQuota } from './require-entitlement.decorator.js';
import type { SubscriptionResolver } from './subscription-resolver.js';
import type { UsageReader } from './usage-reader.js';

class TestController {
  open(this: void) {
    /* no entitlement decorators — should always pass through */
  }

  @RequireModule('HOSTED_STORAGE')
  moduleGated(this: void) {
    /* FREE plan does not include HOSTED_STORAGE */
  }

  @RequireQuota('DOCUMENTS_STORED')
  quotaGated(this: void) {
    /* gated on document count */
  }
}

function makeContext(handler: () => void, request: { subjectId?: string } = {}): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => TestController,
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({}), getNext: () => undefined }),
  } as unknown as ExecutionContext;
}

function buildGuard(tier: PlanTier, used: Record<QuotaDimension, number> = {} as Record<QuotaDimension, number>) {
  const subscriptions: SubscriptionResolver = { resolveTier: () => tier };
  const usage: UsageReader = { read: (_ownerId, dimension) => used[dimension] ?? 0 };
  return new EntitlementsGuard(new Reflector(), subscriptions, usage);
}

// Referenced off the prototype, not an instance — these handlers never touch
// `this`, and going through an instance trips `@typescript-eslint/unbound-method`
// for a case that isn't actually unsafe here.
const { open, moduleGated, quotaGated } = TestController.prototype;

describe('EntitlementsGuard', () => {
  it('passes routes with no @RequireModule/@RequireQuota untouched', () => {
    const guard = buildGuard('FREE');
    expect(guard.canActivate(makeContext(open))).toBe(true);
  });

  it('denies a module the caller’s plan does not include', () => {
    const guard = buildGuard('FREE');
    expect(() => guard.canActivate(makeContext(moduleGated, { subjectId: 'owner-1' }))).toThrow(
      ForbiddenException,
    );
  });

  it('allows a module the caller’s plan does include', () => {
    const guard = buildGuard('PLUS');
    expect(guard.canActivate(makeContext(moduleGated, { subjectId: 'owner-1' }))).toBe(true);
  });

  it('denies once usage has reached the plan’s quota limit', () => {
    const guard = buildGuard('FREE', { DOCUMENTS_STORED: 25 } as Record<QuotaDimension, number>);
    expect(() => guard.canActivate(makeContext(quotaGated, { subjectId: 'owner-1' }))).toThrow(
      ForbiddenException,
    );
  });

  it('allows usage under the plan’s quota limit', () => {
    const guard = buildGuard('FREE', { DOCUMENTS_STORED: 24 } as Record<QuotaDimension, number>);
    expect(guard.canActivate(makeContext(quotaGated, { subjectId: 'owner-1' }))).toBe(true);
  });

  it('carries the verdict, including the upgrade suggestion, in the exception body', () => {
    const guard = buildGuard('FREE', { DOCUMENTS_STORED: 25 } as Record<QuotaDimension, number>);
    try {
      guard.canActivate(makeContext(quotaGated, { subjectId: 'owner-1' }));
      expect.unreachable('expected canActivate to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'QUOTA_EXCEEDED',
        dimension: 'DOCUMENTS_STORED',
        allowed: false,
        upgradeTo: 'PLUS',
      });
    }
  });

  it('rejects a gated route with no verified subjectId rather than resolving a tier for nobody', () => {
    const guard = buildGuard('FREE');
    expect(() => guard.canActivate(makeContext(moduleGated, {}))).toThrow(UnauthorizedException);
  });

  it('never reads ownerId from a client-supplied body/query — only request.subjectId counts', () => {
    const guard = buildGuard('PLUS');
    const context = {
      getHandler: () => moduleGated,
      getClass: () => TestController,
      switchToHttp: () => ({
        getRequest: () => ({ body: { ownerId: 'owner-1' }, query: { ownerId: 'owner-1' } }),
        getResponse: () => ({}),
        getNext: () => undefined,
      }),
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
