import { describe, expect, it } from 'vitest';
import { openExternalUrl } from './open-external-url';

describe('openExternalUrl', () => {
  it('reports success when the link opens', async () => {
    expect(await openExternalUrl(() => Promise.resolve(), 'https://example.org')).toEqual({
      ok: true,
    });
  });

  it('reports failure instead of rejecting when no app can handle the URL', async () => {
    // The whole point: this used to escape as an unhandled rejection out of a
    // fire-and-forget `onPress`, leaving a tapped citation permanently dead.
    const outcome = await openExternalUrl(
      () => Promise.reject(new Error('No Activity found to handle Intent')),
      'https://example.org',
    );
    expect(outcome).toEqual({ ok: false });
  });

  it('reports failure when the native module throws synchronously', async () => {
    const outcome = await openExternalUrl(() => {
      throw new Error('Linking native module unavailable');
    }, 'https://example.org');
    expect(outcome).toEqual({ ok: false });
  });
});
