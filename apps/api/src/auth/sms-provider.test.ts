import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createSmsProvider, MockSmsProvider } from './sms-provider.js';

describe('createSmsProvider', () => {
  const original = process.env['SMS_PROVIDER'];

  afterEach(() => {
    if (original === undefined) delete process.env['SMS_PROVIDER'];
    else process.env['SMS_PROVIDER'] = original;
  });

  it('defaults to the mock adapter when SMS_PROVIDER is unset', () => {
    delete process.env['SMS_PROVIDER'];
    expect(createSmsProvider()).toBeInstanceOf(MockSmsProvider);
  });

  it('returns the mock adapter when SMS_PROVIDER=mock', () => {
    process.env['SMS_PROVIDER'] = 'mock';
    expect(createSmsProvider()).toBeInstanceOf(MockSmsProvider);
  });

  it('throws rather than silently falling back for an unrecognised provider', () => {
    process.env['SMS_PROVIDER'] = 'twilio';
    expect(() => createSmsProvider()).toThrow(
      'SMS_PROVIDER=twilio has no adapter yet — only "mock" is implemented',
    );
  });
});

describe('MockSmsProvider', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves without throwing and never reaches a real gateway', async () => {
    await expect(new MockSmsProvider().send('9800000000', 'your code is 123456')).resolves.toBeUndefined();
  });
});
