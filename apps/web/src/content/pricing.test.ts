import { plans } from '@swasthya/entitlements';
import { describe, expect, it } from 'vitest';

import { formatQuotaValue, PRICING_MODULE_ORDER, PRICING_QUOTA_ORDER } from './pricing';

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
