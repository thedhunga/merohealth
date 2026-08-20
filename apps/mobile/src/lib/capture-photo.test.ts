import { describe, expect, it } from 'vitest';
import { capturePhoto } from './capture-photo';

describe('capturePhoto', () => {
  it('passes a real picture through', async () => {
    const outcome = await capturePhoto(() =>
      Promise.resolve({ uri: 'file://x.jpg', base64: 'AAAA' }),
    );
    expect(outcome).toEqual({ status: 'captured', uri: 'file://x.jpg', base64: 'AAAA' });
  });

  it('reports failure instead of rejecting when the camera throws', async () => {
    // The whole point: this used to escape as an unhandled rejection out of a
    // fire-and-forget `onPress`, leaving the shutter permanently dead.
    const outcome = await capturePhoto(() => Promise.reject(new Error('Camera is not ready yet.')));
    expect(outcome).toEqual({ status: 'failed' });
  });

  it('reports failure when the camera view has not mounted yet', async () => {
    // `cameraRef.current?.takePictureAsync(...)` evaluates to `undefined`
    // rather than a promise while the ref is null.
    const outcome = await capturePhoto(() => undefined);
    expect(outcome).toEqual({ status: 'failed' });
  });

  it('reports failure when the picture comes back without bytes to upload', async () => {
    expect(await capturePhoto(() => Promise.resolve({ uri: 'file://x.jpg' }))).toEqual({
      status: 'failed',
    });
    expect(await capturePhoto(() => Promise.resolve({ uri: 'file://x.jpg', base64: null }))).toEqual(
      { status: 'failed' },
    );
    expect(await capturePhoto(() => Promise.resolve(null))).toEqual({ status: 'failed' });
  });

  it('reports failure when the camera throws synchronously', async () => {
    const outcome = await capturePhoto(() => {
      throw new Error('native module unavailable');
    });
    expect(outcome).toEqual({ status: 'failed' });
  });
});
