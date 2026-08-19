'use client';

import { useTranslations } from 'next-intl';
import { Mic, PhoneOff, RotateCcw, TriangleAlert } from 'lucide-react';

import { GetCareFlow } from '@/components/get-care/GetCareFlow';
import { useGeminiLiveSession, type LiveTranscriptTurn } from '@/hooks/useGeminiLiveSession';
import type { ResearchLanguage } from '@/lib/companion-research';
import { cn } from '@/lib/cn';

/**
 * `/voice-lab` (Round six K′) — noindex, flag-gated on `GEMINI_LIVE_ENABLED`.
 * The page itself has no client-visible flag to check: it always attempts a
 * session, and `useGeminiLiveSession` reads the 404-with-the-flag-off
 * response from `/api/voice/token` the same way any other failure to
 * connect is read — as `'fallback'`, which renders the exact conversation
 * mode (`GetCareFlow`, Round five task H) a person would get from
 * `/get-care`. This is deliberate: whether the flag is off, the mint
 * failed, the socket dropped, or the microphone was denied, the person
 * should never see a broken lab page, only the working fallback.
 */
export function VoiceLabView({ locale }: { locale: ResearchLanguage }) {
  const t = useTranslations('voiceLab');
  const { status, transcript, emergencyTemplate, start, stop } = useGeminiLiveSession(locale);

  if (status === 'fallback') {
    return (
      <div>
        <p className="container-site pt-6 text-sm text-ink-soft" role="status">
          {t('fallbackNotice')}
        </p>
        <GetCareFlow locale={locale} />
      </div>
    );
  }

  return (
    <section className="container-site py-10 sm:py-16">
      <div className="mx-auto max-w-xl">
        <div className="inline-flex items-center gap-2 rounded-pill bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-800">
          {t('eyebrow')}
        </div>
        <h1 className="mt-4 text-3xl">{t('heading')}</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">{t('body')}</p>

        {status === 'emergency' ? (
          <EmergencyPanel onRestart={() => void start()} template={emergencyTemplate} />
        ) : (
          <div className="mt-6 rounded-[1.75rem] bg-paper p-5 shadow-lift sm:p-8">
            <TranscriptList transcript={transcript} />
            <div className="mt-6 flex justify-center" aria-live="polite">
              {status === 'idle' || status === 'ended' ? (
                <button
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-pill bg-marigold-500 px-6 font-bold text-indigo-950 transition-colors hover:bg-marigold-300"
                  onClick={() => void start()}
                  type="button"
                >
                  <Mic aria-hidden className="size-4" />
                  {t('start')}
                </button>
              ) : status === 'connecting' ? (
                <span className="min-h-12 px-6 py-3 text-sm font-semibold text-indigo-800" role="status">
                  {t('connecting')}
                </span>
              ) : (
                <button
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-pill bg-danger-100 px-6 font-bold text-danger-500 transition-colors hover:bg-danger-100/70"
                  onClick={stop}
                  type="button"
                >
                  <PhoneOff aria-hidden className="size-4" />
                  {t('end')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function TranscriptList({ transcript }: { transcript: LiveTranscriptTurn[] }) {
  const t = useTranslations('voiceLab.transcript');
  if (transcript.length === 0) return null;

  return (
    <ol aria-label={t('you')} className="flex flex-col gap-3">
      {transcript.map((turn) => (
        <li className={cn('flex', turn.speaker === 'user' ? 'justify-end' : 'justify-start')} key={turn.id}>
          <div
            className={cn(
              'max-w-[85%] rounded-2xl px-4 py-3 text-base leading-7 whitespace-pre-wrap',
              turn.speaker === 'user' ? 'bg-indigo-800 text-white' : 'bg-sand text-ink',
            )}
          >
            <span className="sr-only">{turn.speaker === 'user' ? t('you') : t('assistant')}: </span>
            {turn.text}
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * The emergency watcher's own vetted words, never Gemini's — see
 * `useGeminiLiveSession.ts`'s `appendTranscript`, which closes the session
 * outright the moment `assessSafety` flags either side of the transcript
 * and hands this component `getSafetyTemplate`'s fixed string. `template`
 * is `null` only if the matched rule's `templateId` somehow has no entry in
 * `approvedSafetyTemplates` — defensive, should not happen — in which case
 * the generic `emergency.fallback` copy still gets said rather than nothing.
 */
function EmergencyPanel({ template, onRestart }: { template: string | null; onRestart: () => void }) {
  const t = useTranslations('voiceLab.emergency');
  return (
    <div className="theme-pin-light mt-6 rounded-2xl bg-danger-100 p-5 ring-1 ring-danger-500/25 sm:p-6" role="alert">
      <div className="flex items-center gap-3 text-danger-500">
        <TriangleAlert aria-hidden className="size-7" />
        <p className="text-sm font-extrabold tracking-wide uppercase">{t('eyebrow')}</p>
      </div>
      <h2 className="mt-4 text-2xl text-danger-500">{t('heading')}</h2>
      <p className="mt-3 text-lg leading-relaxed">{template ?? t('fallback')}</p>
      <button
        className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-pill bg-white px-5 font-bold text-indigo-800 ring-1 ring-line hover:bg-indigo-50"
        onClick={onRestart}
        type="button"
      >
        <RotateCcw aria-hidden className="size-4" />
        {t('restart')}
      </button>
    </div>
  );
}
