'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * In-browser dictation over the Web Speech API.
 *
 * Both microphone buttons used to link to `/app/companion`, which 404s in
 * production — the "error" a person hit was a dead route, not a failed
 * recording. Dictation now happens in place instead of routing anywhere.
 *
 * Support is feature-detected and `supported` starts false on the server, so
 * a browser without the API (notably Firefox) renders no microphone button at
 * all rather than a control that cannot work.
 *
 * Privacy note, deliberately in code rather than lore: on Chrome the Web
 * Speech API ships audio to the browser vendor's recognition service. That is
 * the person's own browser feature under their own permission prompt, and no
 * audio ever reaches Mero Health servers — but it is why dictation is a
 * button the person presses, never something that starts on its own.
 */

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};


/** BCP-47 tags the recognizers actually accept for our locales. */
const recognitionLang: Record<string, string> = {
  ne: 'ne-NP',
  'ne-Latn': 'ne-NP',
  en: 'en-US',
};

export type DictationStatus = 'idle' | 'listening' | 'denied';

export interface SpeechDictationOptions {
  /**
   * Round five, task H. Off by default (one utterance per tap, as before —
   * `SymptomEntry` still wants that). On: `continuous`/`interimResults`
   * turn on, and an utterance is not delivered the moment the recognizer
   * pauses — it is delivered `silenceTimeoutMs` after the person actually
   * stops talking, so a mid-sentence breath does not split one thought into
   * two questions.
   */
  conversation?: boolean;
  /** Silence, in ms, after speech before the accumulated utterance sends. Conversation mode only. */
  silenceTimeoutMs?: number;
}

const DEFAULT_SILENCE_TIMEOUT_MS = 1200;

export function useSpeechDictation(
  locale: string,
  onFinalText: (text: string) => void,
  options: SpeechDictationOptions = {},
) {
  const { conversation = false, silenceTimeoutMs = DEFAULT_SILENCE_TIMEOUT_MS } = options;
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<DictationStatus>('idle');
  const recognizerRef = useRef<SpeechRecognitionLike | null>(null);
  // Ref so a stale closure never delivers text to an unmounted caller.
  const onFinalRef = useRef(onFinalText);
  onFinalRef.current = onFinalText;
  // Conversation mode only: accumulates final chunks across the recognizer's
  // own result batches until the silence timer decides the utterance is done.
  const transcriptRef = useRef('');
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const w = window as SpeechWindow;
    setSupported(Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition));

    // Round seven, task P: a device that already denied the mic permission
    // (in a previous visit, or via a site-settings toggle) must not wait for
    // a tap to find that out — the caller needs to know before it ever
    // renders the mic as the primary action. `permissions.query` answers
    // that without prompting; `cancelled` stops the async result from
    // landing after this effect's own cleanup has already run.
    let cancelled = false;
    let liveStatus: PermissionStatus | null = null;
    const syncFromPermission = () => {
      if (cancelled || !liveStatus) return;
      setStatus((current) => (current === 'listening' ? current : liveStatus!.state === 'denied' ? 'denied' : 'idle'));
    };

    // Optional chaining guards the call itself, not just its result — Safari
    // below 16 has no `navigator.permissions` object at all, which `?.`
    // catches at runtime regardless of what the DOM lib types claim.
    navigator.permissions
      ?.query({ name: 'microphone' as PermissionName })
      .then((result) => {
        if (cancelled) return;
        liveStatus = result;
        result.onchange = syncFromPermission;
        syncFromPermission();
      })
      .catch(() => {
        // Firefox doesn't support querying this permission name at all —
        // denial still surfaces the moment a real attempt hits `onerror`,
        // just not before that first tap.
      });

    return () => {
      cancelled = true;
      if (liveStatus) liveStatus.onchange = null;
      clearSilenceTimer();
      recognizerRef.current?.abort();
      recognizerRef.current = null;
    };
  }, [clearSilenceTimer]);

  const stop = useCallback(() => {
    clearSilenceTimer();
    recognizerRef.current?.stop();
  }, [clearSilenceTimer]);

  const start = useCallback(() => {
    const w = window as SpeechWindow;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor || recognizerRef.current) return;

    const recognizer = new Ctor();
    recognizer.lang = recognitionLang[locale] ?? 'ne-NP';
    recognizer.continuous = conversation;
    recognizer.interimResults = conversation;
    transcriptRef.current = '';

    recognizer.onresult = (event) => {
      let finalChunk = '';
      let sawInterim = false;
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result?.isFinal) finalChunk += result[0].transcript;
        else sawInterim = true;
      }

      if (!conversation) {
        const trimmed = finalChunk.trim();
        if (trimmed) onFinalRef.current(trimmed);
        return;
      }

      if (finalChunk) transcriptRef.current += finalChunk;
      if (!finalChunk && !sawInterim) return;

      // Any speech — interim or final — pushes the silence window out. The
      // utterance is only "done" once the person has actually stopped
      // talking for `silenceTimeoutMs`, not on the recognizer's own guess.
      clearSilenceTimer();
      silenceTimerRef.current = setTimeout(() => {
        silenceTimerRef.current = null;
        const spoken = transcriptRef.current.trim();
        transcriptRef.current = '';
        // Stop before delivering: the caller's answer (and its speech) must
        // not be picked back up by a recognizer still listening underneath it.
        recognizerRef.current?.stop();
        if (spoken) onFinalRef.current(spoken);
      }, silenceTimeoutMs);
    };

    recognizer.onerror = ({ error }) => {
      // `not-allowed` is a real state the UI must explain; everything else
      // (no-speech, aborted, network) just returns the button to idle.
      setStatus(error === 'not-allowed' || error === 'service-not-allowed' ? 'denied' : 'idle');
    };

    recognizer.onend = () => {
      recognizerRef.current = null;
      clearSilenceTimer();
      setStatus((current) => (current === 'denied' ? 'denied' : 'idle'));
    };

    recognizerRef.current = recognizer;
    setStatus('listening');
    recognizer.start();
  }, [locale, conversation, silenceTimeoutMs, clearSilenceTimer]);

  const toggle = useCallback(() => {
    if (status === 'listening') stop();
    else start();
  }, [status, start, stop]);

  return { supported, status, start, stop, toggle };
}
