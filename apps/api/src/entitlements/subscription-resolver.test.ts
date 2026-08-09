import { describe, expect, it } from 'vitest';
import { FreeTierSubscriptionResolver, type SubscriptionResolver } from './subscription-resolver.js';

describe('FreeTierSubscriptionResolver', () => {
  it('resolves every owner to FREE, since no subscription persistence exists yet', () => {
    const resolver: SubscriptionResolver = new FreeTierSubscriptionResolver();
    expect(resolver.resolveTier('owner-1')).toBe('FREE');
    expect(resolver.resolveTier('owner-2')).toBe('FREE');
  });
});
