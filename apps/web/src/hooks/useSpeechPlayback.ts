'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Reads an answer aloud with the browser's own speech synthesis.
 *
 * The button renders only when a voice matching the interface language
 * actually exists on the device. That check is the whole point: most Android
 * phones ship a Nepali voice through the system TTS, but many desktops do
 * not, and reading Devanagari aloud with an English voice would produce
 * gibberish precisely for the person who most needs the answer spoken.
 * Better no button than a wrong voice.
 *
 * Synthesis runs entirely on the device or the OS speech service — the
 * answer text never goes to Mero Health servers because of this feature.
 */
const localePrefix: Record<string, string> = {
  ne: 'ne',
  'ne-Latn': 'ne',
  en: 'en',
};

export function useSpeechPlayback(locale: string) {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const prefix = localePrefix[locale] ?? 'ne';
    const pick = () => {
      const match = window.speechSynthesis
        .getVoices()
        .find((candidate) => candidate.lang.toLowerCase().startsWith(prefix));
      setVoice(match ?? null);
    };

    // Chrome populates the voice list asynchronously; the first call often
    // returns [] and the real list arrives via voiceschanged.
    pick();
    window.speechSynthesis.addEventListener('voiceschanged', pick);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', pick);
      window.speechSynthesis.cancel();
    };
  }, [locale]);

  const toggle = useCallback(
    (text: string) => {
      if (!voice) return;
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        setSpeaking(false);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      // Slightly slower than default: these are health answers being heard
      // once, not skimmed, often by someone who chose voice because reading
      // is the barrier.
      utterance.rate = 0.9;
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(utterance);
    },
    [voice],
  );

  return { available: voice !== null, speaking, toggle };
}
