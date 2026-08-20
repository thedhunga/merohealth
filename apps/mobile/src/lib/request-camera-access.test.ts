import { describe, expect, it } from 'vitest';
import { requestCameraAccess } from './request-camera-access';

describe('requestCameraAccess', () => {
  it('reports granted when the permission is allowed', async () => {
    expect(await requestCameraAccess(() => Promise.resolve({ granted: true }))).toEqual({
      status: 'granted',
    });
  });

  it('reports denied — not failed — when the user refuses', async () => {
    // A refusal is an ordinary answer, not a crash: the screen should treat it
    // differently from a broken request and not show an error line.
    expect(await requestCameraAccess(() => Promise.resolve({ granted: false }))).toEqual({
      status: 'denied',
    });
  });

  it('reports failure instead of rejecting when the request itself throws', async () => {
    // The whole point: this used to escape as an unhandled rejection out of a
    // fire-and-forget `onPress`, leaving the camera toggle permanently dead.
    const outcome = await requestCameraAccess(() =>
      Promise.reject(new Error('getUserMedia is not available')),
    );
    expect(outcome).toEqual({ status: 'failed' });
  });

  it('reports failure when the native module throws synchronously', async () => {
    const outcome = await requestCameraAccess(() => {
      throw new Error('Camera native module unavailable');
    });
    expect(outcome).toEqual({ status: 'failed' });
  });
});
