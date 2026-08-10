import { describe, expect, it } from 'vitest';

import {
  checkModule,
  checkQuota,
  compareTiers,
  formatPrice,
  getPlan,
  hasModule,
  lowestTierWith,
  plans,
} from './index';

describe('plan catalogue', () => {
  it('exposes exactly the three subscription tiers', () => {
    expect(plans.map((plan) => plan.tier)).toEqual(['FREE', 'PLUS', 'PRO']);
  });

  it('keeps bring-your-own storage free and hosted storage paid', () => {
    expect(hasModule('FREE', 'BRING_YOUR_OWN_STORAGE')).toBe(true);
    expect(hasModule('FREE', 'HOSTED_STORAGE')).toBe(false);
    expect(hasModule('PLUS', 'HOSTED_STORAGE')).toBe(true);
  });

  it('never removes a module as the tier goes up', () => {
    for (const [index, plan] of plans.entries()) {
      for (const lower of plans.slice(0, index)) {
        for (const module of lower.modules) {
          expect(plan.modules).toContain(module);
        }
      }
    }
  });

  it('throws on an unknown tier rather than returning a default', () => {
    // @ts-expect-error deliberately invalid tier
    expect(() => getPlan('ENTERPRISE')).toThrow('Unknown plan tier');
  });
});

describe('compareTiers', () => {
  it('orders free below plus below pro', () => {
    expect(compareTiers('FREE', 'PLUS')).toBeLessThan(0);
    expect(compareTiers('PRO', 'PLUS')).toBeGreaterThan(0);
    expect(compareTiers('PLUS', 'PLUS')).toBe(0);
  });
});

describe('checkQuota', () => {
  it('allows usage below the limit and reports the remainder', () => {
    const verdict = checkQuota('FREE', 'DOCUMENTS_STORED', 10);
    expect(verdict.allowed).toBe(true);
    expect(verdict.remaining).toBe(15);
    expect(verdict.upgradeTo).toBeNull();
  });

  it('denies at the limit and points at the cheapest tier with headroom', () => {
    const verdict = checkQuota('FREE', 'DOCUMENTS_STORED', 25);
    expect(verdict.allowed).toBe(false);
    expect(verdict.remaining).toBe(0);
    expect(verdict.upgradeTo).toBe('PLUS');
  });

  it('skips a higher tier that has no headroom either', () => {
    // 600 documents exceeds Plus (500) but Pro is unlimited.
    const verdict = checkQuota('FREE', 'DOCUMENTS_STORED', 600);
    expect(verdict.allowed).toBe(false);
    expect(verdict.upgradeTo).toBe('PRO');
  });

  it('treats a null limit as unlimited', () => {
    const verdict = checkQuota('PRO', 'ASSISTANT_MESSAGES_PER_MONTH', 10_000);
    expect(verdict.allowed).toBe(true);
    expect(verdict.limit).toBeNull();
    expect(verdict.remaining).toBeNull();
  });

  it('offers no upgrade when already on the top tier', () => {
    const verdict = checkQuota('PRO', 'ACTIVE_SHARE_LINKS', 25);
    expect(verdict.allowed).toBe(false);
    expect(verdict.upgradeTo).toBeNull();
  });
});

describe('checkModule', () => {
  it('allows a module the tier includes', () => {
    expect(checkModule('FREE', 'ASSISTANT')).toEqual({
      module: 'ASSISTANT',
      allowed: true,
      upgradeTo: null,
    });
  });

  it('names the tier needed for a locked module', () => {
    expect(checkModule('FREE', 'PROVIDER_EXPORT')).toEqual({
      module: 'PROVIDER_EXPORT',
      allowed: false,
      upgradeTo: 'PRO',
    });
  });
});

describe('lowestTierWith', () => {
  it('finds the cheapest tier offering a module', () => {
    expect(lowestTierWith('ASSISTANT')).toBe('FREE');
    expect(lowestTierWith('DEVICE_SYNC')).toBe('PLUS');
    expect(lowestTierWith('TELECONSULTATION')).toBe('PRO');
  });
});

describe('formatPrice', () => {
  it('labels zero as free rather than an amount', () => {
    expect(formatPrice(0, 'en')).toBe('Free');
    expect(formatPrice(0, 'ne')).toBe('निःशुल्क');
  });

  it('renders paisa as whole rupees', () => {
    expect(formatPrice(49_900, 'en')).toContain('499');
    expect(formatPrice(149_900, 'ne')).toContain('रु');
  });
});
