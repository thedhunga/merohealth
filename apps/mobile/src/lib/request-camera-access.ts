/** The slice of `expo-camera`'s `PermissionResponse` this app actually reads. */
interface CameraPermissionResult {
  granted: boolean;
}

export type CameraAccessOutcome =
  | { status: 'granted' }
  | { status: 'denied' }
  | { status: 'failed' };

/**
 * `useCameraPermissions`' `requestPermission` returns a promise that **rejects**
 * when the underlying permission request itself breaks — the web export's
 * `navigator.mediaDevices.getUserMedia` is unavailable or blocked by policy, or
 * the native module is missing on a stripped build — and the consultation
 * screen fired it as `void enableCamera()` from `onPress`. An unguarded
 * rejection therefore left the camera toggle doing nothing at all with no
 * message, indistinguishable from a slow one. A resolved-but-not-`granted`
 * response is the ordinary "user said no" case, not a crash, so it is its own
 * `denied` outcome; only a thrown error becomes `failed`, the one the screen
 * says something about.
 */
export async function requestCameraAccess(
  request: () => Promise<CameraPermissionResult>,
): Promise<CameraAccessOutcome> {
  try {
    const result = await request();
    return result.granted ? { status: 'granted' } : { status: 'denied' };
  } catch {
    return { status: 'failed' };
  }
}
