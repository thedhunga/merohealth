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

export function useSpeechDictation(locale: string, onFinalText: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<DictationStatus>('idle');
  const recognizerRef = useRef<SpeechRecognitionLike | null>(null);
  // Ref so a stale closure never delivers text to an unmounted caller.
  const onFinalRef = useRef(onFinalText);
  onFinalRef.current = onFinalText;

  useEffect(() => {
    const w = window as SpeechWindow;
    setSupported(Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition));
    return () => {
      recognizerRef.current?.abort();
      recognizerRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    recognizerRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const w = window as SpeechWindow;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor || recognizerRef.current) return;

    const recognizer = new Ctor();
    recognizer.lang = recognitionLang[locale] ?? 'ne-NP';
    recognizer.continuous = false;
    recognizer.interimResults = false;

    recognizer.onresult = (event) => {
      let text = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result?.isFinal) text += result[0].transcript;
      }
      const trimmed = text.trim();
      if (trimmed) onFinalRef.current(trimmed);
    };

    recognizer.onerror = ({ error }) => {
      // `not-allowed` is a real state the UI must explain; everything else
      // (no-speech, aborted, network) just returns the button to idle.
      setStatus(error === 'not-allowed' || error === 'service-not-allowed' ? 'denied' : 'idle');
    };

    recognizer.onend = () => {
      recognizerRef.current = null;
      setStatus((current) => (current === 'denied' ? 'denied' : 'idle'));
    };

    recognizerRef.current = recognizer;
    setStatus('listening');
    recognizer.start();
  }, [locale]);

  const toggle = useCallback(() => {
    if (status === 'listening') stop();
    else start();
  }, [status, start, stop]);

  return { supported, status, toggle };
}
