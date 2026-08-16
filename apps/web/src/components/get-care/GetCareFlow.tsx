'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, LazyMotion, MotionConfig, domAnimation, m } from 'motion/react';
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ExternalLink,
  HeartPulse,
  Mic,
  RotateCcw,
  Search,
  Volume2,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';

import type {
  CompanionResearchResponse,
  HealthResearch,
  ResearchLanguage,
} from '@/lib/companion-research';
import { consumeCareQuestion } from '@/lib/get-care-session';
import {
  history,
  markPromptAsked,
  profile,
  recordExchange,
  shouldSuggestSignIn,
  updateProfile,
} from '@/lib/anonymous-history';
import { nextProfilePrompt, type ProfilePrompt } from '@/lib/profile-prompts';
import { Link } from '@/i18n/navigation';
import { useSpeechPlayback } from '@/hooks/useSpeechPlayback';
import { useSpeechDictation } from '@/hooks/useSpeechDictation';
import { cn } from '@/lib/cn';

type Phase = 'idle' | 'loading' | 'emergency' | 'result' | 'unavailable';

const transition = { duration: 0.24, ease: [0.22, 1, 0.36, 1] } as const;

export function GetCareFlow({ locale }: { locale: ResearchLanguage }) {
  const t = useTranslations('getCare');
  const [question, setQuestion] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [response, setResponse] = useState<CompanionResearchResponse | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<ProfilePrompt | null>(null);
  const [suggestSignIn, setSuggestSignIn] = useState(false);
  const dictation = useSpeechDictation(locale, (text) => {
    setQuestion((current) => (current ? `${current} ${text}` : text));
  });

  useEffect(() => {
    const storedQuestion = consumeCareQuestion();
    if (storedQuestion) setQuestion(storedQuestion);
  }, []);

  const submitQuestion = async (nextQuestion = question) => {
    const message = nextQuestion.normalize('NFKC').trim();
    if (message.length < 3) return;

    setQuestion(message);
    setResponse(null);
    setPhase('loading');

    try {
      const researchResponse = await fetch('/api/companion/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, language: locale }),
      });

      if (!researchResponse.ok) {
        setPhase('unavailable');
        return;
      }

      const body = (await researchResponse.json()) as CompanionResearchResponse;
      setResponse(body);
      const emergency = body.assessment.interruptConversation;
      setPhase(emergency ? 'emergency' : 'result');

      // Remember the exchange on the device, so tomorrow's visit is not a
      // blank slate. Nothing here leaves the phone until the person signs in.
      const answered = body.research?.status === 'complete' && Boolean(body.research.answer);
      recordExchange({
        question: message,
        answer: answered ? (body.research?.answer ?? null) : null,
        language: locale,
        outcome: emergency ? 'emergency' : answered ? 'answered' : 'unavailable',
      });

      // One skippable profile question, only when there is a real answer to
      // react to and only if it would help the next answer.
      if (answered) {
        const answeredCount = history().filter((e) => e.outcome === 'answered').length;
        setPendingPrompt(nextProfilePrompt(message, answeredCount, profile()));
        setSuggestSignIn(shouldSuggestSignIn());
      } else {
        setPendingPrompt(null);
      }
    } catch {
      setPhase('unavailable');
    }
  };

  const answerPrompt = (prompt: ProfilePrompt, option: string) => {
    if (prompt.field === 'conditions') {
      updateProfile({ conditions: option === 'none' ? [] : [option] });
    } else {
      updateProfile({ [prompt.field]: option });
    }
    markPromptAsked(prompt.key);
    setPendingPrompt(null);
  };

  const skipPrompt = (prompt: ProfilePrompt) => {
    markPromptAsked(prompt.key);
    setPendingPrompt(null);
  };

  const reset = () => {
    setQuestion('');
    setResponse(null);
    setPhase('idle');
  };

  return (
    <MotionConfig reducedMotion="user" transition={transition}>
      <LazyMotion features={domAnimation}>
        <section className="relative overflow-hidden bg-indigo-900 py-10 text-white sm:py-16">
          <div
            aria-hidden
            className="absolute -top-28 right-[-8rem] size-80 rounded-full bg-indigo-600/35 blur-3xl"
          />
          <div className="container-site relative grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-start lg:gap-14">
            <div className="lg:sticky lg:top-28">
              <div className="inline-flex items-center gap-2 rounded-pill bg-white/10 px-4 py-2 text-sm font-semibold text-indigo-100 ring-1 ring-white/15">
                <ShieldCheck aria-hidden className="size-4" />
                {t('eyebrow')}
              </div>
              <h1 className="mt-5 max-w-2xl text-4xl text-balance sm:text-5xl">{t('title')}</h1>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-indigo-100">{t('body')}</p>

              <ol className="mt-8 grid gap-3" aria-label={t('steps.label')}>
                {(['safety', 'research', 'next'] as const).map((step, index) => (
                  <li className="flex items-center gap-3 text-sm text-indigo-100" key={step}>
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 font-bold text-white ring-1 ring-white/15">
                      {index + 1}
                    </span>
                    {t(`steps.${step}`)}
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-[1.75rem] bg-paper p-5 text-ink shadow-lift sm:p-8">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitQuestion();
                }}
              >
                <label className="text-base font-bold" htmlFor="health-question">
                  {t('form.label')}
                </label>
                <div className="mt-3 rounded-2xl bg-white p-3 ring-1 ring-line focus-within:ring-2 focus-within:ring-indigo-600">
                  <textarea
                    className="min-h-32 w-full resize-y bg-transparent p-2 text-lg leading-relaxed outline-none placeholder:text-ink-soft"
                    disabled={phase === 'loading'}
                    id="health-question"
                    maxLength={4000}
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder={t('form.placeholder')}
                    value={question}
                  />
                  <div className="mt-2 flex flex-col-reverse gap-3 border-t border-line pt-3 sm:flex-row sm:items-center sm:justify-between">
                    {/*
                      In-place dictation. The previous version linked to
                      /app/companion, which 404s in production — the reported
                      "microphone error" was that dead route. Hidden entirely
                      where the Web Speech API is absent.
                    */}
                    {dictation.supported ? (
                      <button
                        aria-pressed={dictation.status === 'listening'}
                        className={cn(
                          'inline-flex min-h-12 items-center justify-center gap-2 rounded-pill px-4 text-sm font-semibold transition-colors',
                          dictation.status === 'listening'
                            ? 'animate-pulse bg-danger-100 text-danger-500 motion-reduce:animate-none'
                            : 'text-indigo-800 hover:bg-indigo-50',
                        )}
                        onClick={dictation.toggle}
                        type="button"
                      >
                        <Mic aria-hidden className="size-4" />
                        {dictation.status === 'listening'
                          ? t('form.voiceListening')
                          : t('form.voice')}
                      </button>
                    ) : (
                      <span />
                    )}
                    <button
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-pill bg-marigold-500 px-6 font-bold text-indigo-950 transition-colors hover:bg-marigold-300 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={question.trim().length < 3 || phase === 'loading'}
                      type="submit"
                    >
                      {phase === 'loading' ? t('form.checking') : t('form.submit')}
                      <ArrowRight aria-hidden className="size-4" />
                    </button>
                  </div>
                </div>
                <p className="mt-3 flex gap-2 text-xs leading-relaxed text-ink-soft">
                  <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-indigo-600" />
                  {t('form.privacy')}
                </p>
              </form>

              <div aria-live="polite" className="mt-6">
                <AnimatePresence initial={false} mode="wait">
                  {phase === 'idle' ? <IdlePanel key="idle" /> : null}
                  {phase === 'loading' ? <LoadingPanel key="loading" /> : null}
                  {phase === 'emergency' && response ? (
                    <EmergencyPanel key="emergency" response={response} reset={reset} />
                  ) : null}
                  {phase === 'result' && response?.research ? (
                    <ResearchPanel
                      key="result"
                      locale={locale}
                      research={response.research}
                      reset={reset}
                      submitQuestion={submitQuestion}
                    />
                  ) : null}
                  {phase === 'unavailable' ? (
                    <UnavailablePanel key="unavailable" reset={reset} />
                  ) : null}
                </AnimatePresence>

                {/*
                  Reactions to the answer, below it and after it. Profile
                  prompt first (one question, skippable), then the sign-in
                  suggestion — never both on a first visit, and never before
                  a real answer has been given.
                */}
                {phase === 'result' && pendingPrompt ? (
                  <ProfilePromptCard
                    onAnswer={(option) => answerPrompt(pendingPrompt, option)}
                    onSkip={() => skipPrompt(pendingPrompt)}
                    prompt={pendingPrompt}
                  />
                ) : null}
                {phase === 'result' && !pendingPrompt && suggestSignIn ? (
                  <SignInSuggestion />
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </LazyMotion>
    </MotionConfig>
  );
}

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <m.div
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl p-5 sm:p-6 ${className}`}
      exit={{ opacity: 0, y: -8 }}
      initial={{ opacity: 0, y: 12 }}
    >
      {children}
    </m.div>
  );
}

function IdlePanel() {
  const t = useTranslations('getCare');
  return (
    <Panel className="bg-sand">
      <div className="flex items-start gap-3">
        <HeartPulse aria-hidden className="mt-1 size-6 shrink-0 text-indigo-700" />
        <div>
          <h2 className="text-xl">{t('idle.heading')}</h2>
          <p className="mt-2 leading-relaxed text-ink-soft">{t('idle.body')}</p>
        </div>
      </div>
    </Panel>
  );
}

function LoadingPanel() {
  const t = useTranslations('getCare');
  return (
    <Panel className="bg-indigo-50">
      <div className="flex items-center gap-4" role="status">
        <span className="grid size-11 shrink-0 animate-pulse place-items-center rounded-full bg-indigo-800 text-white">
          <Search aria-hidden className="size-5" />
        </span>
        <div>
          <h2 className="text-xl">{t('loading.heading')}</h2>
          <p className="mt-1 text-ink-soft">{t('loading.body')}</p>
        </div>
      </div>
    </Panel>
  );
}

function EmergencyPanel({
  response,
  reset,
}: {
  response: CompanionResearchResponse;
  reset: () => void;
}) {
  const t = useTranslations('getCare');
  return (
    <Panel className="bg-danger-100 ring-1 ring-danger-500/25">
      <div role="alert">
        <div className="flex items-center gap-3 text-danger-500">
          <TriangleAlert aria-hidden className="size-7" />
          <p className="text-sm font-extrabold tracking-wide uppercase">{t('emergency.eyebrow')}</p>
        </div>
        <h2 className="mt-4 text-2xl text-danger-500">{t('emergency.heading')}</h2>
        <p className="mt-3 text-lg leading-relaxed">
          {response.template ?? t('emergency.fallback')}
        </p>
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">{t('emergency.localNotice')}</p>
        <button
          className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-pill bg-white px-5 font-bold text-indigo-800 ring-1 ring-line hover:bg-indigo-50"
          onClick={reset}
          type="button"
        >
          <RotateCcw aria-hidden className="size-4" />
          {t('actions.another')}
        </button>
      </div>
    </Panel>
  );
}

function ResearchPanel({
  research,
  reset,
  submitQuestion,
  locale,
}: {
  research: HealthResearch;
  reset: () => void;
  submitQuestion: (question: string) => Promise<void>;
  locale: ResearchLanguage;
}) {
  const t = useTranslations('getCare');
  const playback = useSpeechPlayback(locale);

  if (research.status !== 'complete' || !research.answer) {
    return <SetupPanel research={research} reset={reset} />;
  }

  return (
    <Panel className="bg-white ring-1 ring-line">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-success-700">
          <CheckCircle2 aria-hidden className="size-6" />
          <p className="text-sm font-extrabold tracking-wide uppercase">{t('result.eyebrow')}</p>
        </div>
        {/*
          Reads the answer aloud in the interface language. Only rendered when
          a matching voice exists on the device, so Nepali is never mangled
          through an English voice — see useSpeechPlayback.
        */}
        {playback.available ? (
          <button
            aria-pressed={playback.speaking}
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-pill px-4 text-sm font-semibold transition-colors',
              playback.speaking
                ? 'bg-indigo-100 text-indigo-800'
                : 'text-indigo-800 hover:bg-indigo-50',
            )}
            onClick={() => playback.toggle(research.answer ?? '')}
            type="button"
          >
            <Volume2 aria-hidden className="size-4" />
            {playback.speaking ? t('result.listenStop') : t('result.listen')}
          </button>
        ) : null}
      </div>
      <h2 className="mt-4 text-2xl">{t('result.heading')}</h2>
      <p className="mt-4 whitespace-pre-wrap text-base leading-7">{research.answer}</p>

      {research.citations.length > 0 ? (
        <div className="mt-7 border-t border-line pt-6">
          <h3 className="flex items-center gap-2 text-lg">
            <BookOpenCheck aria-hidden className="size-5 text-indigo-700" />
            {t('result.sources')}
          </h3>
          <ol className="mt-3 grid gap-3">
            {research.citations.map((citation, index) => (
              <li className="rounded-xl bg-sand p-4" key={citation.url}>
                <a
                  className="font-bold text-indigo-800 underline decoration-indigo-200 underline-offset-4 hover:decoration-indigo-700"
                  href={citation.url}
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  {index + 1}. {citation.title}
                  <ExternalLink aria-hidden className="ms-1 inline size-3.5" />
                </a>
                {citation.snippet ? (
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{citation.snippet}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {research.relatedQuestions.length > 0 ? (
        <div className="mt-7 border-t border-line pt-6">
          <h3 className="text-lg">{t('result.related')}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {research.relatedQuestions.map((relatedQuestion) => (
              <button
                className="min-h-11 rounded-pill bg-indigo-50 px-4 text-left text-sm font-semibold text-indigo-800 hover:bg-indigo-100"
                key={relatedQuestion}
                onClick={() => void submitQuestion(relatedQuestion)}
                type="button"
              >
                {relatedQuestion}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <p className="mt-6 rounded-xl bg-marigold-100 p-4 text-sm leading-relaxed">
        {research.disclaimer}
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-pill bg-indigo-800 px-5 font-bold text-white hover:bg-indigo-700"
          onClick={reset}
          type="button"
        >
          <RotateCcw aria-hidden className="size-4" />
          {t('actions.another')}
        </button>
      </div>
    </Panel>
  );
}

function SetupPanel({ research, reset }: { research: HealthResearch; reset: () => void }) {
  const t = useTranslations('getCare');
  const unavailable = research.status === 'unavailable';
  return (
    <Panel className="bg-sand">
      <BookOpenCheck aria-hidden className="size-7 text-indigo-700" />
      <h2 className="mt-4 text-2xl">{t(unavailable ? 'unavailable.heading' : 'setup.heading')}</h2>
      <p className="mt-3 leading-relaxed text-ink-soft">
        {t(unavailable ? 'unavailable.body' : 'setup.body')}
      </p>
      <p className="mt-4 rounded-xl bg-white p-4 text-sm leading-relaxed">{research.disclaimer}</p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-pill bg-indigo-800 px-5 font-bold text-white hover:bg-indigo-700"
          onClick={reset}
          type="button"
        >
          <RotateCcw aria-hidden className="size-4" />
          {t('actions.another')}
        </button>
      </div>
    </Panel>
  );
}

function UnavailablePanel({ reset }: { reset: () => void }) {
  const t = useTranslations('getCare');
  return (
    <Panel className="bg-sand">
      <TriangleAlert aria-hidden className="size-7 text-marigold-700" />
      <h2 className="mt-4 text-2xl">{t('unavailable.heading')}</h2>
      <p className="mt-3 leading-relaxed text-ink-soft">{t('unavailable.body')}</p>
      <button
        className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-pill bg-indigo-800 px-5 font-bold text-white hover:bg-indigo-700"
        onClick={reset}
        type="button"
      >
        <RotateCcw aria-hidden className="size-4" />
        {t('actions.retry')}
      </button>
    </Panel>
  );
}

function ProfilePromptCard({
  prompt,
  onAnswer,
  onSkip,
}: {
  prompt: ProfilePrompt;
  onAnswer: (option: string) => void;
  onSkip: () => void;
}) {
  const t = useTranslations('getCare.profilePrompts');
  return (
    <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
      <p className="text-sm font-semibold text-indigo-900">{t(`${prompt.key}.question`)}</p>
      <p className="mt-1 text-xs text-ink-soft">{t(`${prompt.key}.why`)}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {prompt.options.map((option) => (
          <button
            className="inline-flex min-h-11 items-center rounded-pill bg-white px-4 text-sm font-medium text-ink ring-1 ring-line transition-colors hover:bg-indigo-100"
            key={option}
            onClick={() => onAnswer(option)}
            type="button"
          >
            {t(`${prompt.key}.options.${option}`)}
          </button>
        ))}
        <button
          className="inline-flex min-h-11 items-center px-3 text-sm text-ink-soft underline-offset-4 hover:underline"
          onClick={onSkip}
          type="button"
        >
          {t('skip')}
        </button>
      </div>
    </div>
  );
}

function SignInSuggestion() {
  const t = useTranslations('getCare.signInSuggestion');
  return (
    <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-marigold-300 bg-marigold-100/60 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-ink">{t('heading')}</p>
        <p className="mt-0.5 text-xs text-ink-soft">{t('body')}</p>
      </div>
      <Link
        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-pill bg-indigo-800 px-5 text-sm font-bold text-white hover:bg-indigo-700"
        href="/signin?next=/get-care"
      >
        {t('cta')}
      </Link>
    </div>
  );
}
