'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ClipValidationVerdict, VoiceClip } from '@swasthya/language-corpus';

import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { useSession } from '@/hooks/useSession';
import {
  fetchClipAudio,
  fetchNextClipToValidate,
  submitClipValidation,
  VoiceValidationApiError,
} from '@/lib/voice-validation-api';

type ViewState = { status: 'loading' } | { status: 'done' } | { status: 'ready'; clip: VoiceClip; audioUrl: string };

/**
 * A race a validator did not cause — someone else finished this clip first,
 * or it was already theirs/already voted by them — so the response is to
 * move on quietly, not to blame the person who just clicked. Distinct from
 * an unrecognised code, which is a real failure and gets the generic error.
 */
const RACE_ERROR_CODES = ['OWN_CLIP_VALIDATION_FORBIDDEN', 'CLIP_ALREADY_VALIDATED_BY_YOU', 'CLIP_ALREADY_RESOLVED'] as const;

/**
 * `/validate` — Round six §M's Validation flow box, §4's "crowd
 * verification": contributors validate others' clips, listening and marking
 * each one right / wrong / unclear; two agreeing decides it
 * (`deriveClipVerificationStatus` in `packages/language-corpus`).
 *
 * `useSession` gates this on a live session, same as `/contribute`. Unlike
 * `/contribute`, there is no `useCorpusConsent` gate here — judging someone
 * else's already-consented clip is not itself a new act of contributing
 * one's own voice, so `LanguageCorpusService.nextClipForValidation` asks for
 * nothing beyond a session.
 */
export function VoiceValidationView() {
  const t = useTranslations('voiceValidation');
  const session = useSession();
  const user = session.status === 'authenticated' ? session.user : null;
  const [state, setState] = useState<ViewState>({ status: 'loading' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNext = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const clip = await fetchNextClipToValidate();
      if (!clip) {
        setState({ status: 'done' });
        return;
      }
      const blob = await fetchClipAudio(clip.id);
      setState({ status: 'ready', clip, audioUrl: URL.createObjectURL(blob) });
    } catch {
      setState({ status: 'done' });
      setError(t('errors.GENERIC'));
    }
  }, [t]);

  // Deliberately keyed on `user` alone, not `loadNext`: this should fire
  // once a session exists, not again every time `loadNext`'s identity
  // changes with `t`. Every later advance is driven from inside `vote`.
  useEffect(() => {
    if (user) void loadNext();
  }, [user]);

  useEffect(() => {
    return () => {
      if (state.status === 'ready') URL.revokeObjectURL(state.audioUrl);
    };
  }, [state]);

  if (!user || state.status === 'loading') {
    return (
      <p className="container-site py-10 text-sm text-ink-soft" role="status">
        {t('loading')}
      </p>
    );
  }

  if (state.status === 'done') {
    return (
      <section className="container-site py-10 sm:py-16">
        <div className="mx-auto max-w-xl rounded-[1.75rem] bg-paper p-6 text-center shadow-lift sm:p-8">
          <h1 className="text-3xl">{t('done.heading')}</h1>
          <p className="mt-3 leading-relaxed text-ink-soft">{t('done.body')}</p>
          <FormError message={error} />
        </div>
      </section>
    );
  }

  const { clip, audioUrl } = state;

  async function vote(verdict: ClipValidationVerdict) {
    setError(null);
    setSubmitting(true);
    try {
      await submitClipValidation(clip.id, verdict);
      await loadNext();
    } catch (err) {
      const code = err instanceof VoiceValidationApiError ? err.code : null;
      if (RACE_ERROR_CODES.some((candidate) => candidate === code)) {
        await loadNext();
        return;
      }
      setError(t('errors.GENERIC'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="container-site py-10 sm:py-16">
      <div className="mx-auto max-w-xl">
        <h1 className="text-3xl">{t('heading')}</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">{t('intro')}</p>

        <div className="mt-6 rounded-[1.75rem] bg-paper p-6 shadow-lift sm:p-8">
          <p className="text-sm font-semibold text-accent-text">
            {t(clip.taskKind === 'READ_PROMPT' ? 'taskContext.readPromptHeading' : 'taskContext.freeSpeechHeading')}
          </p>

          <audio className="mt-4 w-full" controls src={audioUrl} />

          <FormError message={error} />

          {/*
            Three co-equal judgements, not a primary action against
            secondary ones — none gets the `accent` marigold the art
            direction reserves for "the single most important action on a
            screen" (`Button.tsx`'s own comment).
          */}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button disabled={submitting} onClick={() => void vote('RIGHT')} variant="secondary">
              {t('verdict.right')}
            </Button>
            <Button disabled={submitting} onClick={() => void vote('WRONG')} variant="secondary">
              {t('verdict.wrong')}
            </Button>
            <Button disabled={submitting} onClick={() => void vote('UNCLEAR')} variant="secondary">
              {t('verdict.unclear')}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
