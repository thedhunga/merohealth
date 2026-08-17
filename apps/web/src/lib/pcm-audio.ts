/**
 * Raw PCM encode/decode for Gemini Live's duplex audio (Round six K′).
 * Gemini Live expects 16-bit PCM, little-endian, mono, 16 kHz microphone
 * input and returns audio in the same layout at 24 kHz — documented, fixed
 * formats, unlike the setup/message shapes in `gemini-live-protocol.ts`
 * which are this run's best reading of a preview surface.
 *
 * Pure functions over `Float32Array`/base64 strings, not `AudioContext` —
 * `useGeminiLiveSession.ts` is the only caller that touches the browser
 * audio graph, so this module (the actual bit-level format, easy to get
 * subtly wrong) can be unit tested directly. `btoa`/`atob` are used rather
 * than `Buffer` because this code runs in the browser, where `Buffer` does
 * not exist; both are global in Node 22 too, so the same code is what the
 * tests exercise.
 */

/** Linear-interpolation resample — good enough for speech, not audio-grade, but this is a spike. */
function resampleLinear(samples: Float32Array, sourceRate: number, targetRate: number): Float32Array {
  if (sourceRate === targetRate || samples.length === 0) return samples;
  const ratio = sourceRate / targetRate;
  const outLength = Math.max(1, Math.round(samples.length / ratio));
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const sourceIndex = i * ratio;
    const lower = Math.floor(sourceIndex);
    const upper = Math.min(samples.length - 1, lower + 1);
    const weight = sourceIndex - lower;
    out[i] = (samples[lower] ?? 0) * (1 - weight) + (samples[upper] ?? 0) * weight;
  }
  return out;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Encodes a captured audio buffer (whatever sample rate the browser's `AudioContext` used) to base64 16 kHz PCM16 for `buildAudioChunkMessage`. */
export function encodePcm16Base64(samples: Float32Array, sourceSampleRate: number, targetSampleRate = 16000): string {
  const resampled = resampleLinear(samples, sourceSampleRate, targetSampleRate);
  const buffer = new ArrayBuffer(resampled.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < resampled.length; i++) {
    const clamped = Math.max(-1, Math.min(1, resampled[i] ?? 0));
    view.setInt16(i * 2, Math.round(clamped * (clamped < 0 ? 0x8000 : 0x7fff)), true);
  }
  return arrayBufferToBase64(buffer);
}

/**
 * Decodes Gemini's 24 kHz PCM16 output audio into samples an `AudioBuffer`
 * can play. Explicitly parameterized `Float32Array<ArrayBuffer>` — the bare
 * `Float32Array` type defaults its buffer parameter to `ArrayBufferLike`,
 * which `AudioBuffer.copyToChannel` (the only caller, in
 * `useGeminiLiveSession.ts`) does not accept.
 */
export function decodePcm16Base64(base64: string): Float32Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const view = new DataView(bytes.buffer);
  const sampleCount = Math.floor(bytes.length / 2);
  const samples = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    const int16 = view.getInt16(i * 2, true);
    samples[i] = int16 / (int16 < 0 ? 0x8000 : 0x7fff);
  }
  return samples;
}
