import { plans } from '@swasthya/entitlements';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  formatFreemiumMinutes,
  formatFreemiumPriceNpr,
  formatQuotaValue,
  PRICING_MODULE_ORDER,
  PRICING_QUOTA_ORDER,
} from './pricing';

describe('PRICING_MODULE_ORDER', () => {
  it('lists every module any plan offers, so the comparison grid never silently drops one', () => {
    const allModules = new Set(plans.flatMap((plan) => plan.modules));
    for (const moduleKey of allModules) {
      expect(PRICING_MODULE_ORDER).toContain(moduleKey);
    }
  });
});

describe('PRICING_QUOTA_ORDER', () => {
  it('lists every quota dimension every plan defines a limit for', () => {
    for (const plan of plans) {
      for (const dimension of Object.keys(plan.limits)) {
        expect(PRICING_QUOTA_ORDER).toContain(dimension);
      }
    }
  });
});

describe('formatQuotaValue', () => {
  it('returns the unlimited label for a null limit', () => {
    expect(formatQuotaValue(null, 'en', 'Unlimited')).toBe('Unlimited');
    expect(formatQuotaValue(null, 'ne', 'असीमित')).toBe('असीमित');
  });

  it('formats a numeric limit with the locale\'s own grouping, not a hardcoded one', () => {
    expect(formatQuotaValue(1000, 'en', 'Unlimited')).toBe((1000).toLocaleString('en-NP'));
    expect(formatQuotaValue(1000, 'ne', 'असीमित')).toBe((1000).toLocaleString('ne-NP'));
  });
});

// The env vars below are only ever read once, at module load — same as any
// other NEXT_PUBLIC_ config in this app, baked in at build time — so each
// test stubs the env and re-imports the module fresh rather than mutating
// the already-evaluated FREEMIUM_VOICE_CONFIG in place.
describe('FREEMIUM_VOICE_CONFIG', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is entirely null with no freemium-voice env vars set, never a guessed number', async () => {
    const { FREEMIUM_VOICE_CONFIG } = await import('./pricing');
    expect(FREEMIUM_VOICE_CONFIG).toEqual({
      trialMinutesFree: null,
      plus: { priceNpr: null, minutesPerMonth: null },
      pro: { priceNpr: null, minutesPerMonth: null },
    });
  });

  it('reads owner-set values once the env vars exist', async () => {
    vi.stubEnv('NEXT_PUBLIC_TRIAL_MINUTES_FREE', '10');
    vi.stubEnv('NEXT_PUBLIC_PRICE_PLUS_NPR', '499');
    vi.stubEnv('NEXT_PUBLIC_MINUTES_PLUS', '120');
    vi.stubEnv('NEXT_PUBLIC_PRICE_PRO_NPR', '1499');
    vi.stubEnv('NEXT_PUBLIC_MINUTES_PRO', '400');

    const { FREEMIUM_VOICE_CONFIG, PRICE_PLUS_NPR, MINUTES_PRO } = await import('./pricing');
    expect(FREEMIUM_VOICE_CONFIG).toEqual({
      trialMinutesFree: 10,
      plus: { priceNpr: 499, minutesPerMonth: 120 },
      pro: { priceNpr: 1499, minutesPerMonth: 400 },
    });
    expect(PRICE_PLUS_NPR).toBe(499);
    expect(MINUTES_PRO).toBe(400);
  });

  it('treats a non-numeric or non-positive value as unset rather than throwing', async () => {
    vi.stubEnv('NEXT_PUBLIC_PRICE_PLUS_NPR', 'not-a-number');
    vi.stubEnv('NEXT_PUBLIC_MINUTES_PRO', '-5');

    const { FREEMIUM_VOICE_CONFIG } = await import('./pricing');
    expect(FREEMIUM_VOICE_CONFIG.plus.priceNpr).toBeNull();
    expect(FREEMIUM_VOICE_CONFIG.pro.minutesPerMonth).toBeNull();
  });
});

describe('formatFreemiumPriceNpr', () => {
  it('returns the caller-supplied price-soon label when the price is unset', () => {
    expect(formatFreemiumPriceNpr(null, 'ne', 'मूल्य छिट्टै')).toBe('मूल्य छिट्टै');
    expect(formatFreemiumPriceNpr(null, 'en', 'Price soon')).toBe('Price soon');
  });

  it('formats a set price in the same रु/Rs style as @swasthya/entitlements\' formatPrice', () => {
    expect(formatFreemiumPriceNpr(499, 'en', 'Price soon')).toBe(`Rs ${(499).toLocaleString('en-NP')}`);
    expect(formatFreemiumPriceNpr(499, 'ne', 'मूल्य छिट्टै')).toBe(`रु ${(499).toLocaleString('ne-NP')}`);
  });
});

describe('formatFreemiumMinutes', () => {
  it('returns the caller-supplied label when the minute count is unset', () => {
    expect(formatFreemiumMinutes(null, 'en', 'Minutes soon')).toBe('Minutes soon');
  });

  it('formats a set minute count with the locale\'s own grouping', () => {
    expect(formatFreemiumMinutes(120, 'en', 'Minutes soon')).toBe((120).toLocaleString('en-NP'));
    expect(formatFreemiumMinutes(120, 'ne', 'मिनेट छिट्टै')).toBe((120).toLocaleString('ne-NP'));
  });
});
