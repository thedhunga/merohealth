'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_VOICE_CLIP_DURATION_MS } from '@swasthya/language-corpus';

export type VoiceContributionRecorderStatus =
  | 'idle'
  | 'requesting-permission'
  | 'recording'
  | 'recorded'
  | 'permission-denied'
  | 'unsupported';

export interface VoiceContributionRecording {
  blob: Blob;
  durationMs: number;
}

export interface UseVoiceContributionRecorderResult {
  status: VoiceContributionRecorderStatus;
  /** Ticks while `recording`, frozen once `recorded` — the recorder view's live counter and the value it submits are the same number. */
  elapsedMs: number;
  recording: VoiceContributionRecording | null;
  start: () => Promise<void>;
  stop: () => void;
  /** Discards a `recorded` take so the person can record the same task again before submitting. */
  reset: () => void;
}

/**
 * Browser `MediaRecorder` capture for one Voice Contribution clip. No test
 * file — this codebase does not unit-test hooks or components that wrap
 * browser device APIs (`useGeminiLiveSession.ts`, `useSession.ts`, neither
 * has one either); the pure quality-gate logic this hook leans on
 * (`MAX_VOICE_CLIP_DURATION_MS`, `validateVoiceClipDuration`) already has its
 * own coverage in `@swasthya/language-corpus`.
 *
 * Auto-stops at `MAX_VOICE_CLIP_DURATION_MS` so a free-speech answer that
 * wanders cannot silently produce a clip the server would reject anyway —
 * better to stop the recording and let the person see why than to let them
 * talk for a minute and then fail the upload.
 */
export function useVoiceContributionRecorder(): UseVoiceContributionRecorderResult {
  const [status, setStatus] = useState<VoiceContributionRecorderStatus>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [recording, setRecording] = useState<VoiceContributionRecording | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (autoStopTimerRef.current !== null) clearTimeout(autoStopTimerRef.current);
    if (tickTimerRef.current !== null) clearInterval(tickTimerRef.current);
    autoStopTimerRef.current = null;
    tickTimerRef.current = null;
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stop = useCallback(() => {
    clearTimers();
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  }, [clearTimers]);

  const start = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setStatus('unsupported');
      return;
    }

    setStatus('requesting-permission');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setStatus('permission-denied');
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];
    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(
      (candidate) => typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(candidate),
    );
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      const durationMs = Date.now() - startedAtRef.current;
      releaseStream();
      setRecording({ blob, durationMs });
      setElapsedMs(durationMs);
      setStatus('recorded');
    };

    startedAtRef.current = Date.now();
    recorder.start();
    setStatus('recording');
    setElapsedMs(0);

    tickTimerRef.current = setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 200);
    autoStopTimerRef.current = setTimeout(stop, MAX_VOICE_CLIP_DURATION_MS);
  }, [releaseStream, stop]);

  const reset = useCallback(() => {
    setRecording(null);
    setElapsedMs(0);
    setStatus('idle');
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
      releaseStream();
    };
  }, [clearTimers, releaseStream]);

  return { status, elapsedMs, recording, start, stop, reset };
}
