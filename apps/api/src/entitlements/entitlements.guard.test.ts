import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AssuranceLevel, PlanTier, QuotaDimension } from '@swasthya/shared-types';
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
    /* FREE plan does not include HOSTED_STORAGE; REGISTERED is enough on identity */
  }

  @RequireModule('RECORD_SHARING')
  identityGated(this: void) {
    /* PLUS plan includes RECORD_SHARING, but it requires IDENTITY_VERIFIED */
  }

  @RequireQuota('DOCUMENTS_STORED')
  quotaGated(this: void) {
    /* gated on document count */
  }
}

interface TestRequest {
  subjectId?: string;
  authUser?: { assuranceLevel: AssuranceLevel };
}

/**
 * Real requests carry `authUser` alongside `subjectId` — `SessionAuthGuard`
 * sets both from the same resolved session in one step — so every request
 * built here does too, unless a test specifically wants a request that
 * skipped `SessionAuthGuard`'s output shape.
 */
function withAuthUser(subjectId: string, assuranceLevel: AssuranceLevel = 'REGISTERED'): TestRequest {
  return { subjectId, authUser: { assuranceLevel } };
}

function makeContext(handler: () => void, request: TestRequest = {}): ExecutionContext {
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
const { open, moduleGated, identityGated, quotaGated } = TestController.prototype;

describe('EntitlementsGuard', () => {
  it('passes routes with no @RequireModule/@RequireQuota untouched', () => {
    const guard = buildGuard('FREE');
    expect(guard.canActivate(makeContext(open))).toBe(true);
  });

  it('denies a module the caller’s plan does not include', () => {
    const guard = buildGuard('FREE');
    expect(() => guard.canActivate(makeContext(moduleGated, withAuthUser('owner-1')))).toThrow(
      ForbiddenException,
    );
  });

  it('allows a module the caller’s plan does include', () => {
    const guard = buildGuard('PLUS');
    expect(guard.canActivate(makeContext(moduleGated, withAuthUser('owner-1')))).toBe(true);
  });

  it('denies once usage has reached the plan’s quota limit', () => {
    const guard = buildGuard('FREE', { DOCUMENTS_STORED: 25 } as Record<QuotaDimension, number>);
    expect(() => guard.canActivate(makeContext(quotaGated, withAuthUser('owner-1')))).toThrow(
      ForbiddenException,
    );
  });

  it('allows usage under the plan’s quota limit', () => {
    const guard = buildGuard('FREE', { DOCUMENTS_STORED: 24 } as Record<QuotaDimension, number>);
    expect(guard.canActivate(makeContext(quotaGated, withAuthUser('owner-1')))).toBe(true);
  });

  it('carries the verdict, including the upgrade suggestion, in the exception body', () => {
    const guard = buildGuard('FREE', { DOCUMENTS_STORED: 25 } as Record<QuotaDimension, number>);
    try {
      guard.canActivate(makeContext(quotaGated, withAuthUser('owner-1')));
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

  // `identity-and-credentialing.md` §2: RECORD_SHARING/PROVIDER_EXPORT/TELECONSULTATION
  // require IDENTITY_VERIFIED, not merely a phone-verified REGISTERED session.
  // These three cases were previously unreachable — nothing in `apps/api` ever
  // read `packages/identity`'s `minimumAssuranceLevel` before this fix.

  it('denies a module requiring IDENTITY_VERIFIED to a merely REGISTERED caller, even on a plan that includes it', () => {
    const guard = buildGuard('PLUS'); // PLUS includes RECORD_SHARING by plan tier
    expect(() =>
      guard.canActivate(makeContext(identityGated, withAuthUser('owner-1', 'REGISTERED'))),
    ).toThrow(ForbiddenException);
  });

  it('allows a module requiring IDENTITY_VERIFIED once the caller has reached it', () => {
    const guard = buildGuard('PLUS');
    expect(
      guard.canActivate(makeContext(identityGated, withAuthUser('owner-1', 'IDENTITY_VERIFIED'))),
    ).toBe(true);
  });

  it('carries the required and current assurance level in the exception body', () => {
    const guard = buildGuard('PLUS');
    try {
      guard.canActivate(makeContext(identityGated, withAuthUser('owner-1', 'REGISTERED')));
      expect.unreachable('expected canActivate to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'IDENTITY_VERIFICATION_REQUIRED',
        module: 'RECORD_SHARING',
        required: 'IDENTITY_VERIFIED',
        current: 'REGISTERED',
      });
    }
  });

  it('checks identity assurance ahead of plan tier — a plan without the module still reports the identity gap first', () => {
    const guard = buildGuard('FREE'); // FREE does not include RECORD_SHARING either
    try {
      guard.canActivate(makeContext(identityGated, withAuthUser('owner-1', 'REGISTERED')));
      expect.unreachable('expected canActivate to throw');
    } catch (error) {
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'IDENTITY_VERIFICATION_REQUIRED',
      });
    }
  });

  it('treats a missing authUser as ANONYMOUS rather than assuming REGISTERED', () => {
    const guard = buildGuard('PLUS');
    expect(() => guard.canActivate(makeContext(moduleGated, { subjectId: 'owner-1' }))).toThrow(
      ForbiddenException,
    );
  });
});
