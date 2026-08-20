/** The shape of `expo-camera`'s `takePictureAsync` result, narrowed to what this app reads. */
interface CameraPicture {
  uri: string;
  base64?: string | null;
}

export type PhotoCaptureOutcome =
  | { status: 'captured'; uri: string; base64: string }
  | { status: 'failed' };

/**
 * `takePictureAsync` rejects for ordinary, recoverable reasons — the camera
 * is still warming up, a capture is already in flight, the device is out of
 * storage, the web export's `getUserMedia` track was revoked mid-session —
 * and the shutter's `onPress` is fire-and-forget. An unguarded rejection
 * therefore left the shutter doing nothing at all, permanently and with no
 * message, on the app's core "photograph your lab report" path. It can also
 * resolve without `base64` (the field is optional), which is the same
 * dead-end by a different route. Both become a `failed` outcome the screen
 * can say something about, rather than a promise nobody is holding.
 */
export async function capturePhoto(
  take: () => Promise<CameraPicture | null | undefined> | undefined,
): Promise<PhotoCaptureOutcome> {
  try {
    const picture = await take();
    if (!picture?.base64) return { status: 'failed' };
    return { status: 'captured', uri: picture.uri, base64: picture.base64 };
  } catch {
    return { status: 'failed' };
  }
}
