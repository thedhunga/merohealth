import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  VoiceValidationApiError,
  fetchClipAudio,
  fetchNextClipToValidate,
  submitClipValidation,
} from '@/lib/voice-validation-api';

function mockFetchOnce(status: number, body: unknown = {}) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.stubGlobal('window', {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchNextClipToValidate', () => {
  it('gets /v1/language-corpus/voice-contribution/validation/next and unwraps the clip', async () => {
    const clip = { id: 'clip-1', contributorId: 'owner-1' };
    const fetchMock = mockFetchOnce(200, { clip });

    const result = await fetchNextClipToValidate();

    expect(result).toEqual(clip);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4000/v1/language-corpus/voice-contribution/validation/next');
    expect(init.credentials).toBe('include');
  });

  it('reports null when nothing remains to validate', async () => {
    mockFetchOnce(200, { clip: null });
    expect(await fetchNextClipToValidate()).toBeNull();
  });
});

describe('fetchClipAudio', () => {
  it('decodes bytesBase64 into a Blob carrying the server content type', async () => {
    const fetchMock = mockFetchOnce(200, { contentType: 'audio/webm', bytesBase64: btoa('clip bytes') });

    const blob = await fetchClipAudio('clip-1');

    expect(blob.type).toBe('audio/webm');
    expect(await blob.text()).toBe('clip bytes');
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4000/v1/language-corpus/voice-contribution/clips/clip-1/audio');
  });

  it('surfaces the server-provided code when the caller owns the clip', async () => {
    mockFetchOnce(403, { code: 'OWN_CLIP_VALIDATION_FORBIDDEN', message: 'A contributor cannot validate their own clip.' });
    await expect(fetchClipAudio('clip-1')).rejects.toMatchObject({ code: 'OWN_CLIP_VALIDATION_FORBIDDEN' });
  });
});

describe('submitClipValidation', () => {
  it('posts the verdict and returns the resulting validation and status', async () => {
    const validation = { id: 'v1', clipId: 'clip-1', validatorId: 'validator-1', verdict: 'RIGHT' };
    const fetchMock = mockFetchOnce(201, { validation, status: 'VERIFIED' });

    const result = await submitClipValidation('clip-1', 'RIGHT');

    expect(result).toEqual({ validation, status: 'VERIFIED' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4000/v1/language-corpus/voice-contribution/clips/clip-1/validations');
    expect(JSON.parse(init.body as string)).toEqual({ verdict: 'RIGHT' });
  });

  it('surfaces a duplicate-vote code distinctly from an already-resolved code', async () => {
    mockFetchOnce(400, { code: 'CLIP_ALREADY_VALIDATED_BY_YOU', message: 'Already validated' });
    await expect(submitClipValidation('clip-1', 'WRONG')).rejects.toBeInstanceOf(VoiceValidationApiError);
  });
});
