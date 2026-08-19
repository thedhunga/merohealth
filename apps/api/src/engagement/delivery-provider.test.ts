import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createEngagementDeliveryProvider, MockEngagementDeliveryProvider } from './delivery-provider.js';

describe('createEngagementDeliveryProvider', () => {
  const original = process.env['ENGAGEMENT_PROVIDER'];

  afterEach(() => {
    if (original === undefined) delete process.env['ENGAGEMENT_PROVIDER'];
    else process.env['ENGAGEMENT_PROVIDER'] = original;
  });

  it('defaults to the mock adapter when ENGAGEMENT_PROVIDER is unset', () => {
    delete process.env['ENGAGEMENT_PROVIDER'];
    expect(createEngagementDeliveryProvider()).toBeInstanceOf(MockEngagementDeliveryProvider);
  });

  it('returns the mock adapter when ENGAGEMENT_PROVIDER=mock', () => {
    process.env['ENGAGEMENT_PROVIDER'] = 'mock';
    expect(createEngagementDeliveryProvider()).toBeInstanceOf(MockEngagementDeliveryProvider);
  });

  it('throws rather than silently falling back for an unrecognised provider', () => {
    process.env['ENGAGEMENT_PROVIDER'] = 'whatsapp-business';
    expect(() => createEngagementDeliveryProvider()).toThrow(
      'ENGAGEMENT_PROVIDER=whatsapp-business has no adapter yet — only "mock" is implemented',
    );
  });
});

describe('MockEngagementDeliveryProvider', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves without throwing for every channel and never reaches a real gateway', async () => {
    const provider = new MockEngagementDeliveryProvider();
    await expect(provider.send('SMS', '9800000000', 'reminder')).resolves.toBeUndefined();
    await expect(provider.send('WHATSAPP', '9800000000', 'reminder')).resolves.toBeUndefined();
  });
});
