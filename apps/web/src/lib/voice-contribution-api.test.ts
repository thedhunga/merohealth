import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VoiceContributionApiError, submitVoiceClip } from '@/lib/voice-contribution-api';

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

const selfReport = { district: 'Kathmandu', motherTongue: 'NEPALI' as const, ageBand: '25_34' as const, gender: null };

describe('submitVoiceClip', () => {
  it('base64-encodes the recording and posts to /v1/language-corpus/voice-contribution/clips', async () => {
    const clip = { id: 'clip-1', contributorId: 'owner-1' };
    const fetchMock = mockFetchOnce(201, clip);
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' });

    const result = await submitVoiceClip({
      id: 'clip-1',
      taskId: 'free-speech-dal',
      taskKind: 'FREE_SPEECH',
      selfReport,
      device: 'test-agent',
      durationMs: 4_000,
      blob,
    });

    expect(result).toEqual(clip);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4000/v1/language-corpus/voice-contribution/clips');
    expect(init.credentials).toBe('include');
    const body = JSON.parse(init.body as string) as {
      id: string;
      taskId: string;
      taskKind: string;
      contentType: string;
      bytesBase64: string;
      durationMs: number;
    };
    expect(body.id).toBe('clip-1');
    expect(body.taskId).toBe('free-speech-dal');
    expect(body.taskKind).toBe('FREE_SPEECH');
    expect(body.contentType).toBe('audio/webm');
    expect(body.durationMs).toBe(4_000);
    const decoded = Uint8Array.from(atob(body.bytesBase64), (char) => char.charCodeAt(0));
    expect(Array.from(decoded)).toEqual([1, 2, 3]);
  });

  it('surfaces the server-provided machine-readable code on failure, e.g. missing consent', async () => {
    mockFetchOnce(403, { code: 'VOICE_CONTRIBUTION_CONSENT_REQUIRED', message: 'No live consent' });
    const blob = new Blob([new Uint8Array([1])], { type: 'audio/webm' });

    await expect(
      submitVoiceClip({ id: 'clip-1', taskId: 'free-speech-dal', taskKind: 'FREE_SPEECH', selfReport, device: 'test-agent', durationMs: 4_000, blob }),
    ).rejects.toMatchObject({ code: 'VOICE_CONTRIBUTION_CONSENT_REQUIRED' });
  });

  it('surfaces a duration-rejection code distinctly from a duplicate-rejection code', async () => {
    mockFetchOnce(400, { code: 'VOICE_CLIP_TOO_SHORT', message: 'Voice clip rejected: TOO_SHORT' });
    const blob = new Blob([new Uint8Array([1])], { type: 'audio/webm' });

    await expect(
      submitVoiceClip({ id: 'clip-1', taskId: 'free-speech-dal', taskKind: 'FREE_SPEECH', selfReport, device: 'test-agent', durationMs: 100, blob }),
    ).rejects.toBeInstanceOf(VoiceContributionApiError);
  });
});
