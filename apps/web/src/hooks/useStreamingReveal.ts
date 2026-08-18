'use client';

import { useEffect, useMemo, useState } from 'react';
import { shouldAnimateReveal } from '@/hooks/useReveal';

/**
 * Prefixes of `text`, one per word, each including that word's trailing
 * whitespace — so `prefixes[i]` is always an exact substring of `text` and
 * the `whitespace-pre-wrap` formatting the answer bubble renders with
 * (newlines, paragraph breaks) survives the reveal untouched. Exported
 * alongside the hook so both it and `revealStepDelayMs` are testable without
 * a DOM or a timer, matching `shouldAnimateReveal`/`revealClassName`.
 */
export function buildWordReveal(text: string): string[] {
  const words = text.match(/\S+\s*/g);
  if (!words || words.length === 0) return [text];
  const prefixes: string[] = [];
  let acc = '';
  for (const word of words) {
    acc += word;
    prefixes.push(acc);
  }
  return prefixes;
}

const MIN_TOTAL_MS = 240;
const MAX_TOTAL_MS = 1400;
const MS_PER_WORD = 28;

/**
 * Per-word delay for a `wordCount`-word reveal: proportional for short
 * answers so a two-word reply doesn't crawl, capped so a long paragraph
 * still finishes in under 1.4s rather than reading as a stuck spinner.
 */
export function revealStepDelayMs(wordCount: number): number {
  if (wordCount <= 1) return 0;
  const total = Math.min(MAX_TOTAL_MS, Math.max(MIN_TOTAL_MS, wordCount * MS_PER_WORD));
  return total / wordCount;
}

interface UseStreamingRevealOptions {
  /** Streams only when true — lets a caller skip the effect entirely for text that shouldn't animate. */
  enabled?: boolean | undefined;
}

interface UseStreamingRevealResult {
  /** Grows word by word from `''` to `text`; always a valid prefix, so `whitespace-pre-wrap` never renders a mid-word tear. */
  revealedText: string;
  /** True once the full text is showing — the signal for whatever should appear only after the answer has finished. */
  done: boolean;
}

/**
 * Round seven, task Q (third box): "the answer panel streams text in
 * (word-chunked reveal from the response)". The API returns the whole
 * answer in one response (`/api/companion/research` is not an SSE/stream
 * endpoint — see its route handler), so this reveals an already-complete
 * string progressively on the client rather than consuming a real stream.
 *
 * Each turn bubble mounts exactly once (`turns` is append-only, keyed by a
 * stable id — see `GetCareFlow`), so the effect below runs once per answer
 * and never restarts mid-type on an unrelated re-render.
 */
export function useStreamingReveal(
  text: string,
  { enabled = true }: UseStreamingRevealOptions = {},
): UseStreamingRevealResult {
  const prefixes = useMemo(() => buildWordReveal(text), [text]);
  // Computed once per mount (this hook only ever runs client-side, in
  // response to a turn just added by a fetch handler — never during SSR —
  // so there is no hydration mismatch to guard against the way `useReveal`
  // must for content that exists on first paint).
  const shouldAnimate = useMemo(
    () =>
      enabled &&
      prefixes.length > 1 &&
      shouldAnimateReveal({
        matchMedia: typeof window.matchMedia === 'function' ? window.matchMedia.bind(window) : undefined,
      }),
    [enabled, prefixes.length],
  );
  const [step, setStep] = useState(shouldAnimate ? 0 : prefixes.length);

  useEffect(() => {
    if (!shouldAnimate) return;
    let cancelled = false;
    let index = 0;
    const delay = revealStepDelayMs(prefixes.length);
    let timer: ReturnType<typeof setTimeout>;
    const scheduleNext = () => {
      if (cancelled) return;
      index += 1;
      setStep(index);
      if (index < prefixes.length) timer = setTimeout(scheduleNext, delay);
    };
    timer = setTimeout(scheduleNext, delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [prefixes, shouldAnimate]);

  return {
    revealedText: prefixes[Math.min(step, prefixes.length - 1)] ?? text,
    done: step >= prefixes.length,
  };
}
