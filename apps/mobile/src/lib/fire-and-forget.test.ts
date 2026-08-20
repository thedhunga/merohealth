import { describe, expect, it, vi } from 'vitest';
import { fireAndForget } from './fire-and-forget';

describe('fireAndForget', () => {
  it('runs the side effect', () => {
    const run = vi.fn(() => Promise.resolve());
    fireAndForget(run);
    expect(run).toHaveBeenCalledOnce();
  });

  it('does not surface a rejection as an unhandled rejection', async () => {
    // The whole point: a bare `void Speech.stop()` leaves a rejected promise
    // unhandled, which crashes on Hermes / spams the web console. Here it is
    // swallowed. Fail the test if the process sees an unhandled rejection.
    const onUnhandled = vi.fn();
    process.on('unhandledRejection', onUnhandled);
    try {
      fireAndForget(() => Promise.reject(new Error('native module unavailable')));
      // Let the microtask queue drain so a leaked rejection would fire.
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(onUnhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('swallows a synchronous throw from an entirely-absent native module', () => {
    expect(() =>
      fireAndForget(() => {
        throw new Error('Speech native module is not linked');
      }),
    ).not.toThrow();
  });

  it('tolerates a synchronous void side effect', () => {
    const run = vi.fn(() => undefined);
    expect(() => fireAndForget(run)).not.toThrow();
    expect(run).toHaveBeenCalledOnce();
  });
});
