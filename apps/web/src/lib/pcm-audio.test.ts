import { describe, expect, it } from 'vitest';

import { decodePcm16Base64, encodePcm16Base64 } from './pcm-audio';

describe('decodePcm16Base64', () => {
  it('decodes a known little-endian int16 byte pattern to the expected samples', () => {
    // int16 values 0, 32767 (max), -32768 (min), little-endian bytes.
    const buffer = new ArrayBuffer(6);
    const view = new DataView(buffer);
    view.setInt16(0, 0, true);
    view.setInt16(2, 32767, true);
    view.setInt16(4, -32768, true);
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const base64 = btoa(binary);

    const samples = decodePcm16Base64(base64);
    expect(samples.length).toBe(3);
    expect(samples[0]).toBeCloseTo(0, 5);
    expect(samples[1]).toBeCloseTo(1, 4);
    expect(samples[2]).toBeCloseTo(-1, 4);
  });

  it('returns an empty array for empty input', () => {
    expect(decodePcm16Base64('').length).toBe(0);
  });
});

describe('encodePcm16Base64', () => {
  it('round-trips silence to silence', () => {
    const silence = new Float32Array(160);
    const base64 = encodePcm16Base64(silence, 16000, 16000);
    const decoded = decodePcm16Base64(base64);
    expect(decoded.every((sample) => sample === 0)).toBe(true);
  });

  it('round-trips full-scale samples within int16 rounding tolerance when rates match', () => {
    const samples = new Float32Array([1, -1, 0.5, -0.5, 0]);
    const base64 = encodePcm16Base64(samples, 16000, 16000);
    const decoded = decodePcm16Base64(base64);
    expect(decoded.length).toBe(samples.length);
    samples.forEach((sample, index) => {
      expect(decoded[index]).toBeCloseTo(sample, 3);
    });
  });

  it('clamps out-of-range samples instead of wrapping', () => {
    const samples = new Float32Array([2, -2]);
    const base64 = encodePcm16Base64(samples, 16000, 16000);
    const decoded = decodePcm16Base64(base64);
    expect(decoded[0]).toBeCloseTo(1, 3);
    expect(decoded[1]).toBeCloseTo(-1, 3);
  });

  it('resamples down from a 48 kHz capture rate to the 16 kHz Gemini Live expects', () => {
    const oneSecondAt48k = new Float32Array(48000);
    const base64 = encodePcm16Base64(oneSecondAt48k, 48000, 16000);
    const decoded = decodePcm16Base64(base64);
    expect(decoded.length).toBe(16000);
  });

  it('leaves sample count unchanged when source and target rates already match', () => {
    const samples = new Float32Array(4000);
    const base64 = encodePcm16Base64(samples, 16000, 16000);
    expect(decodePcm16Base64(base64).length).toBe(4000);
  });
});
