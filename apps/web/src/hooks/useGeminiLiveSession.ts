'use client';

import { useCallback, useRef, useState } from 'react';
import { assessSafety, getSafetyTemplate } from '@swasthya/clinical-safety';

import { buildAudioChunkMessage, buildSetupMessage, parseLiveServerMessages } from '@/lib/gemini-live-protocol';
import { decodePcm16Base64, encodePcm16Base64 } from '@/lib/pcm-audio';
import { buildLiveSystemInstruction, type LiveLanguage } from '@/lib/voice-live-instruction';

/**
 * Opens and runs a Gemini Live duplex voice session for `/voice-lab`
 * (Round six K′). Deliberately not unit tested, same reasoning
 * `useSpeechDictation.ts`/`useSpeechPlayback.ts` give: every dependency
 * here (`WebSocket`, `AudioContext`, `getUserMedia`) exists only in a
 * browser, and this repo has no jsdom test harness. Everything that *can*
 * be tested without a browser — message shapes, PCM encode/decode, the
 * system instruction — already is, in `gemini-live-protocol.ts`,
 * `pcm-audio.ts` and `voice-live-instruction.ts`.
 *
 * Model id is unverified against a live session (`GEMINI_LIVE_ENABLED` is
 * off everywhere this run can reach) — overridable via
 * `NEXT_PUBLIC_GEMINI_LIVE_MODEL` for whoever runs the owner's phone test.
 */
const DEFAULT_LIVE_MODEL = 'gemini-live-2.5-flash-preview';
const LIVE_MODEL = process.env['NEXT_PUBLIC_GEMINI_LIVE_MODEL'] || DEFAULT_LIVE_MODEL;
const WS_ENDPOINT =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent';
/** How long we wait for `setupComplete` before giving up and falling back to conversation mode. */
const SETUP_TIMEOUT_MS = 8000;
const languageCodeFor: Record<LiveLanguage, string> = { ne: 'ne-NP', en: 'en-US' };
/** Gemini Live's fixed output sample rate (see `pcm-audio.ts`). */
const PLAYBACK_SAMPLE_RATE = 24000;

export type LiveSessionStatus = 'idle' | 'connecting' | 'active' | 'fallback' | 'emergency' | 'ended';

export interface LiveTranscriptTurn {
  id: string;
  speaker: 'user' | 'model';
  text: string;
}

type AudioContextCtor = typeof AudioContext;
function resolveAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  if (typeof AudioContext !== 'undefined') return AudioContext;
  // Older Safari only. `AudioContext` itself is a DOM global, not a
  // `Window` interface member, so the fallback needs its own loose cast
  // rather than intersecting `Window`.
  const legacy = (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  return legacy ?? null;
}

export function useGeminiLiveSession(language: LiveLanguage) {
  const [status, setStatus] = useState<LiveSessionStatus>('idle');
  const [transcript, setTranscript] = useState<LiveTranscriptTurn[]>([]);
  const [emergencyTemplate, setEmergencyTemplate] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureContextRef = useRef<AudioContext | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const playbackCursorRef = useRef(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  /** Accumulated text of the *current* turn per speaker — reset on `turnComplete` — since the watcher must see the whole thought, not one delta at a time. */
  const currentTurnRef = useRef<{ user: string; model: string }>({ user: '', model: '' });

  const stopPlayback = useCallback(() => {
    for (const source of activeSourcesRef.current) {
      try {
        source.stop();
      } catch {
        // Already finished playing — stopping it again is a no-op we can ignore.
      }
    }
    activeSourcesRef.current = [];
    playbackCursorRef.current = playbackContextRef.current?.currentTime ?? 0;
  }, []);

  const teardownAudio = useCallback(() => {
    stopPlayback();
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
    captureContextRef.current?.close().catch(() => undefined);
    captureContextRef.current = null;
    playbackContextRef.current?.close().catch(() => undefined);
    playbackContextRef.current = null;
  }, [stopPlayback]);

  const endSession = useCallback(
    (nextStatus: LiveSessionStatus) => {
      socketRef.current?.close();
      socketRef.current = null;
      teardownAudio();
      setStatus(nextStatus);
    },
    [teardownAudio],
  );

  const playAudioChunk = useCallback((base64: string) => {
    const context = playbackContextRef.current;
    if (!context) return;
    const samples = decodePcm16Base64(base64);
    if (samples.length === 0) return;
    const buffer = context.createBuffer(1, samples.length, PLAYBACK_SAMPLE_RATE);
    buffer.copyToChannel(samples, 0);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    const startAt = Math.max(context.currentTime, playbackCursorRef.current);
    source.start(startAt);
    playbackCursorRef.current = startAt + buffer.duration;
    activeSourcesRef.current.push(source);
  }, []);

  const appendTranscript = useCallback(
    (speaker: 'user' | 'model', delta: string) => {
      setTranscript((previous) => {
        const last = previous[previous.length - 1];
        if (last && last.speaker === speaker) {
          return [...previous.slice(0, -1), { ...last, text: last.text + delta }];
        }
        return [...previous, { id: crypto.randomUUID(), speaker, text: delta }];
      });

      // Emergency watcher, Round six K′: runs on both sides of the live
      // transcript, on every delta — the only enforcement duplex voice has,
      // since (unlike the text path) nothing runs before the model here.
      currentTurnRef.current[speaker] += delta;
      const assessment = assessSafety(currentTurnRef.current[speaker]);
      if (assessment.interruptConversation) {
        const template = assessment.templateId ? getSafetyTemplate(assessment.templateId, language) : null;
        setEmergencyTemplate(template);
        endSession('emergency');
      }
    },
    [endSession, language],
  );

  const startMicCapture = useCallback(() => {
    const stream = streamRef.current;
    const AudioContextImpl = resolveAudioContextCtor();
    if (!stream || !AudioContextImpl) return;

    const captureContext = new AudioContextImpl();
    captureContextRef.current = captureContext;
    const source = captureContext.createMediaStreamSource(stream);
    // `createScriptProcessor` is deprecated in favour of AudioWorklet, but it
    // needs no separate worklet module served as a static asset — the right
    // trade for a flag-gated spike page, not for the eventual product path.
    const processor = captureContext.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (event) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      const input = event.inputBuffer.getChannelData(0);
      const base64 = encodePcm16Base64(input, captureContext.sampleRate);
      socket.send(JSON.stringify(buildAudioChunkMessage(base64)));
    };
    // Routed through a muted gain node rather than straight to `destination`:
    // some browsers stop firing `onaudioprocess` on a node that reaches no
    // destination at all, but connecting the mic straight to the speakers
    // would create feedback.
    const mute = captureContext.createGain();
    mute.gain.value = 0;
    source.connect(processor);
    processor.connect(mute);
    mute.connect(captureContext.destination);
  }, []);

  const handleServerFrame = useCallback(
    (raw: unknown) => {
      for (const event of parseLiveServerMessages(raw)) {
        if (event.type === 'setupComplete') {
          setStatus('active');
          startMicCapture();
        } else if (event.type === 'transcript') {
          appendTranscript(event.speaker, event.textDelta);
        } else if (event.type === 'audio') {
          playAudioChunk(event.base64);
        } else if (event.type === 'turnComplete') {
          currentTurnRef.current = { user: '', model: '' };
        } else if (event.type === 'interrupted') {
          stopPlayback();
        }
      }
    },
    [appendTranscript, playAudioChunk, startMicCapture, stopPlayback],
  );

  const start = useCallback(async () => {
    setStatus('connecting');
    setTranscript([]);
    setEmergencyTemplate(null);
    currentTurnRef.current = { user: '', model: '' };

    let token: string;
    try {
      const tokenResponse = await fetch('/api/voice/token', { method: 'POST' });
      if (!tokenResponse.ok) {
        setStatus('fallback');
        return;
      }
      const body = (await tokenResponse.json()) as { token?: string };
      if (!body.token) {
        setStatus('fallback');
        return;
      }
      token = body.token;
    } catch {
      setStatus('fallback');
      return;
    }

    const AudioContextImpl = resolveAudioContextCtor();
    if (!AudioContextImpl || typeof navigator === 'undefined' || !navigator.mediaDevices) {
      setStatus('fallback');
      return;
    }

    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      // Permission denied, or no microphone — the same "cannot listen" gap
      // that already sends a typed-only person to conversation mode.
      setStatus('fallback');
      return;
    }

    playbackContextRef.current = new AudioContextImpl();
    playbackCursorRef.current = 0;

    let settled = false;
    const settleOnce = (nextStatus: LiveSessionStatus) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      endSession(nextStatus);
    };

    const timeoutId = setTimeout(() => settleOnce('fallback'), SETUP_TIMEOUT_MS);

    const socket = new WebSocket(`${WS_ENDPOINT}?key=${encodeURIComponent(token)}`);
    socketRef.current = socket;

    socket.onopen = () => {
      socket.send(
        JSON.stringify(
          buildSetupMessage({
            model: LIVE_MODEL,
            systemInstruction: buildLiveSystemInstruction(language),
            languageCode: languageCodeFor[language],
          }),
        ),
      );
    };

    socket.onmessage = (event) => {
      void (async () => {
        try {
          const raw = typeof event.data === 'string' ? event.data : await (event.data as Blob).text();
          const parsed: unknown = JSON.parse(raw);
          if (!settled && parsed && typeof parsed === 'object' && 'setupComplete' in parsed) {
            settled = true;
            clearTimeout(timeoutId);
          }
          handleServerFrame(parsed);
        } catch {
          // A frame that isn't valid JSON is dropped rather than crashing the session.
        }
      })();
    };

    socket.onerror = () => settleOnce('fallback');

    socket.onclose = () => {
      clearTimeout(timeoutId);
      // A close we did not initiate ourselves (`endSession` already moved
      // status off `active`/`connecting` before closing) is a dropped
      // connection — fall back. Read via the functional updater, never the
      // `status` captured when this closure was created, since it is stale
      // by the time a real close event arrives.
      setStatus((current) => (current === 'active' || current === 'connecting' ? 'fallback' : current));
      teardownAudio();
    };
  }, [endSession, handleServerFrame, language, teardownAudio]);

  const stop = useCallback(() => endSession('ended'), [endSession]);

  return { status, transcript, emergencyTemplate, start, stop };
}
