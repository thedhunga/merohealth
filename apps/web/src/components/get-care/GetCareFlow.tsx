'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, LazyMotion, MotionConfig, domAnimation, m } from 'motion/react';
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ExternalLink,
  HeartPulse,
  MessageCircleHeart,
  Mic,
  RotateCcw,
  Search,
  Stethoscope,
  Volume2,
  ShieldCheck,
  TriangleAlert,
  X,
} from 'lucide-react';

import type {
  CompanionResearchResponse,
  ConversationTurn,
  HealthResearch,
  ResearchLanguage,
} from '@/lib/companion-research';
import { consumeCareQuestion } from '@/lib/get-care-session';
import {
  dismissUpsell,
  history,
  isUpsellDismissed,
  markPromptAsked,
  profile,
  recordExchange,
  shouldSuggestSignIn,
  updateProfile,
} from '@/lib/anonymous-history';
import { formatFreemiumPriceNpr, isPremiumLive, PRICE_PLUS_NPR } from '@/content/pricing';
import { nextProfilePrompt, type ProfilePrompt } from '@/lib/profile-prompts';
import { Link } from '@/i18n/navigation';
import { useSpeechPlayback } from '@/hooks/useSpeechPlayback';
import { useSpeechDictation } from '@/hooks/useSpeechDictation';
import { cn } from '@/lib/cn';

type Phase = 'idle' | 'loading' | 'emergency' | 'offTopic' | 'result' | 'unavailable';

/**
 * Round five, task H: one bubble in the visible thread. A superset of
 * `ConversationTurn` — `advisoryText` is display-only (rendered under the
 * assistant bubble that earned it) and never sent back to the provider,
 * matching `ConversationTurn`'s own doc comment on why the advisory is
 * excluded from what the model sees.
 */
interface DisplayTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  advisoryText?: string | null;
}

const transition = { duration: 0.24, ease: [0.22, 1, 0.36, 1] } as const;
/** Same cap the route enforces server-side — trimmed here too so a long session never sends more context than the provider will keep anyway. */
const MAX_CONTEXT_TURNS = 6;

export function GetCareFlow({ locale }: { locale: ResearchLanguage }) {
  const t = useTranslations('getCare');
  const advisoryT = useTranslations('getCare.advisory');
  const [question, setQuestion] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [response, setResponse] = useState<CompanionResearchResponse | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<ProfilePrompt | null>(null);
  const [suggestSignIn, setSuggestSignIn] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);
  // One id per conversation session — regenerated on `reset()` — so the
  // saved history and the thread UI can both group turns asked in one
  // sitting. `useState(() => ...)` rather than a module-level call: the id
  // must be stable across this component's re-renders but fresh per mount.
  const [conversationId, setConversationId] = useState(() => crypto.randomUUID());
  const [turns, setTurns] = useState<DisplayTurn[]>([]);
  const [noVoiceNotice, setNoVoiceNotice] = useState(false);
  const playback = useSpeechPlayback(locale);
  // Set right before an auto-spoken answer starts, cleared the moment that
  // utterance ends (naturally or by barge-in) — the signal the effect below
  // uses to decide whether ending playback should reopen the mic.
  const autoRestartAfterSpeechRef = useRef(false);

  useEffect(() => {
    const storedQuestion = consumeCareQuestion();
    if (storedQuestion) setQuestion(storedQuestion);
  }, []);

  const submitQuestion = async (nextQuestion = question, opts: { spoken?: boolean } = {}) => {
    const message = nextQuestion.normalize('NFKC').trim();
    if (message.length < 3) return;
    const spoken = opts.spoken ?? false;

    setQuestion(message);
    setResponse(null);
    setPhase('loading');

    const apiTurns: ConversationTurn[] = turns
      .slice(-MAX_CONTEXT_TURNS)
      .map((turn) => ({ role: turn.role, text: turn.text }));

    try {
      const researchResponse = await fetch('/api/companion/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, language: locale, turns: apiTurns }),
      });

      if (!researchResponse.ok) {
        setPhase('unavailable');
        return;
      }

      const body = (await researchResponse.json()) as CompanionResearchResponse;
      setResponse(body);
      const emergency = body.assessment.interruptConversation;
      const offTopic = !emergency && body.domain === 'OFF_TOPIC';
      setPhase(emergency ? 'emergency' : offTopic ? 'offTopic' : 'result');

      // Remember the exchange on the device, so tomorrow's visit is not a
      // blank slate. Nothing here leaves the phone until the person signs in.
      const answered = body.research?.status === 'complete' && Boolean(body.research.answer);
      recordExchange({
        question: message,
        answer: answered ? (body.research?.answer ?? null) : null,
        language: locale,
        outcome: emergency ? 'emergency' : offTopic ? 'offTopic' : answered ? 'answered' : 'unavailable',
        conversationId,
        spokenIn: spoken,
        // Only ever set alongside a real answer, so the saved transcript
        // shows the same warning the person saw, not a stray one attached
        // to a refusal or an unavailable state.
        ...(answered && body.advisory ? { advisory: body.advisory } : {}),
      });

      if (answered && body.research?.answer) {
        const answerText = body.research.answer;
        const advisoryText = body.advisory
          ? body.advisory.kind === 'medicine'
            ? advisoryT('medicine', { medicines: formatMedicineList(body.advisory.medicines, locale) })
            : advisoryT('advice')
          : null;

        setTurns((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: 'user', text: message },
          { id: crypto.randomUUID(), role: 'assistant', text: answerText, advisoryText },
        ]);

        // Auto-speak only when the question itself came in by voice — a
        // typed follow-up inside the same voice conversation stays silent,
        // matching how the mic was never asked to reopen for it either.
        if (spoken) {
          if (playback.available) {
            const spokenText = advisoryText ? `${answerText} ${advisoryText}` : answerText;
            autoRestartAfterSpeechRef.current = true;
            playback.toggle(spokenText);
          } else if (!noVoiceNotice) {
            // No voice on this device for the interface language: never
            // read Nepali in an English voice, so the text stands alone —
            // said once per conversation, not on every turn.
            setNoVoiceNotice(true);
          }
        }

        const answeredCount = history().filter((e) => e.outcome === 'answered').length;
        setPendingPrompt(nextProfilePrompt(message, answeredCount, profile()));
        setSuggestSignIn(shouldSuggestSignIn());
        // Round six, task L: the moment the value is felt — right after the
        // first spoken answer, per docs/product/freemium-and-voice-corpus.md
        // §2. Only ever reached on a real answer (never emergency/off-topic,
        // which return `research: null` and skip this whole branch), and
        // never shown twice once dismissed.
        if (spoken && !isUpsellDismissed()) {
          setShowUpsell(true);
        }
      } else {
        setPendingPrompt(null);
      }
    } catch {
      setPhase('unavailable');
    }
  };

  const dictation = useSpeechDictation(
    locale,
    (text) => {
      setQuestion(text);
      void submitQuestion(text, { spoken: true });
    },
    { conversation: true },
  );

  // Conversation, not query: once a spoken answer finishes playing, the mic
  // reopens on its own so the next turn needs no tap. Guarded by the ref
  // rather than firing whenever `speaking` goes false, so a barge-in
  // (cancel, then immediately listen again in `handleMicClick`) never
  // double-starts the recognizer.
  useEffect(() => {
    if (!playback.speaking && autoRestartAfterSpeechRef.current) {
      autoRestartAfterSpeechRef.current = false;
      dictation.start();
    }
  }, [playback.speaking, dictation]);

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

  // Tapping the mic while the answer is being read is the product's one
  // barge-in gesture: cancel the playback outright (never `toggle`, which
  // would read "start speaking" as "resume") and start listening for what
  // the person is already saying.
  const handleMicClick = () => {
    if (playback.speaking) {
      autoRestartAfterSpeechRef.current = false;
      playback.cancel();
      dictation.start();
      return;
    }
    dictation.toggle();
  };

  const reset = () => {
    autoRestartAfterSpeechRef.current = false;
    dictation.stop();
    playback.cancel();
    setQuestion('');
    setResponse(null);
    setPhase('idle');
    setConversationId(crypto.randomUUID());
    setTurns([]);
    setNoVoiceNotice(false);
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
                        disabled={phase === 'loading'}
                        onClick={handleMicClick}
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
                  {phase === 'offTopic' ? (
                    <OffTopicPanel key="offTopic" playback={playback} reset={reset} />
                  ) : null}
                  {phase === 'result' && response?.research ? (
                    <ConversationPanel
                      key="result"
                      noVoiceNotice={noVoiceNotice}
                      playback={playback}
                      research={response.research}
                      reset={reset}
                      submitQuestion={submitQuestion}
                      turns={turns}
                    />
                  ) : null}
                  {phase === 'unavailable' ? (
                    <UnavailablePanel key="unavailable" reset={reset} />
                  ) : null}
                </AnimatePresence>

                {/*
                  Reactions to the answer, below it and after it. Profile
                  prompt first (one question, skippable), then the upsell
                  card (Round six L — only after a voice answer, dismissible),
                  then the sign-in suggestion — never more than one of these
                  three at once, and never before a real answer has been
                  given.
                */}
                {phase === 'result' && pendingPrompt ? (
                  <ProfilePromptCard
                    onAnswer={(option) => answerPrompt(pendingPrompt, option)}
                    onSkip={() => skipPrompt(pendingPrompt)}
                    prompt={pendingPrompt}
                  />
                ) : null}
                {phase === 'result' && !pendingPrompt && showUpsell ? (
                  <UpsellCard
                    locale={locale}
                    onDismiss={() => {
                      setShowUpsell(false);
                      dismissUpsell();
                    }}
                  />
                ) : null}
                {phase === 'result' && !pendingPrompt && !showUpsell && suggestSignIn ? (
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

/**
 * Round five, task I: the fixed containment reply for a question the
 * deterministic classifier kept outside the model entirely (or discarded
 * after the model itself drifted off-topic — see the route's post-check).
 * Warm, one line, no lecture, per the ledger. Indigo rather than the
 * emergency panel's danger red — this is a redirect, not an alarm.
 * `playback` is lifted from `GetCareFlow` (task H) rather than owned here,
 * so the conversation's one speech-synthesis instance never forks in two.
 */
function OffTopicPanel({
  reset,
  playback,
}: {
  reset: () => void;
  playback: ReturnType<typeof useSpeechPlayback>;
}) {
  const t = useTranslations('getCare.offTopic');
  const actionsT = useTranslations('getCare.actions');
  const resultT = useTranslations('getCare.result');
  const reply = t('reply');
  return (
    <Panel className="bg-indigo-50">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-indigo-700">
          <MessageCircleHeart aria-hidden className="size-6" />
          <p className="text-sm font-extrabold tracking-wide uppercase">{t('eyebrow')}</p>
        </div>
        {playback.available ? (
          <button
            aria-label={playback.speaking ? resultT('listenStop') : resultT('listen')}
            aria-pressed={playback.speaking}
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-pill px-4 text-sm font-semibold transition-colors',
              playback.speaking ? 'bg-indigo-100 text-indigo-800' : 'text-indigo-800 hover:bg-white',
            )}
            onClick={() => playback.toggle(reply)}
            type="button"
          >
            <Volume2 aria-hidden className="size-4" />
          </button>
        ) : null}
      </div>
      <p className="mt-4 text-lg leading-relaxed">{reply}</p>
      <button
        className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-pill bg-indigo-800 px-5 font-bold text-white hover:bg-indigo-700"
        onClick={reset}
        type="button"
      >
        <RotateCcw aria-hidden className="size-4" />
        {actionsT('another')}
      </button>
    </Panel>
  );
}

/** `Intl.ListFormat` gives a grammatically correct "X, Y and Z" / "X, Y र Z" join, matching `BloodPressureTrendChart.tsx`'s locale-to-BCP-47 mapping. */
function formatMedicineList(medicines: readonly string[], locale: ResearchLanguage): string {
  return new Intl.ListFormat(locale === 'ne' ? 'ne-NP' : 'en-US', {
    style: 'long',
    type: 'conjunction',
  }).format(medicines);
}

function AdvisoryBlock({ text }: { text: string }) {
  return (
    <p className="mt-3 flex gap-2 rounded-xl bg-marigold-100 p-4 text-sm leading-relaxed font-semibold text-marigold-900" role="note">
      <Stethoscope aria-hidden className="mt-0.5 size-4 shrink-0" />
      {text}
    </p>
  );
}

/**
 * Round five, task H: the visible thread. Replaces the single "one question,
 * one answer" card with every turn in the current conversation, newest at
 * the bottom — `turns` already carries whatever advisory text an answer
 * earned, computed once in `GetCareFlow` so this component never recomputes
 * (or drifts from) the same logic used to decide what gets auto-spoken.
 * Citations, related questions and the disclaimer still describe only the
 * *latest* answer — `research` — the same way the single-card version did.
 */
function ConversationPanel({
  turns,
  research,
  reset,
  submitQuestion,
  playback,
  noVoiceNotice,
}: {
  turns: DisplayTurn[];
  research: HealthResearch;
  reset: () => void;
  submitQuestion: (question: string) => Promise<void>;
  playback: ReturnType<typeof useSpeechPlayback>;
  noVoiceNotice: boolean;
}) {
  const t = useTranslations('getCare');
  const conversationT = useTranslations('getCare.conversation');

  if (research.status !== 'complete' || !research.answer) {
    return <SetupPanel research={research} reset={reset} />;
  }

  const lastAssistantTurn = [...turns].reverse().find((turn) => turn.role === 'assistant');
  // Spoken as one utterance with the answer, so Listen (and auto-speak)
  // never lets the warning go unheard just because it renders as a separate block.
  const spokenText = lastAssistantTurn
    ? [lastAssistantTurn.text, lastAssistantTurn.advisoryText].filter(Boolean).join(' ')
    : research.answer;

  return (
    <Panel className="bg-white ring-1 ring-line">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-success-700">
          <CheckCircle2 aria-hidden className="size-6" />
          <p className="text-sm font-extrabold tracking-wide uppercase">{t('result.eyebrow')}</p>
        </div>
        {/*
          Reads the latest answer aloud in the interface language. Only
          rendered when a matching voice exists on the device, so Nepali is
          never mangled through an English voice — see useSpeechPlayback.
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
            onClick={() => playback.toggle(spokenText ?? '')}
            type="button"
          >
            <Volume2 aria-hidden className="size-4" />
            {playback.speaking ? t('result.listenStop') : t('result.listen')}
          </button>
        ) : null}
      </div>

      <ol aria-label={conversationT('threadLabel')} className="mt-5 flex flex-col gap-3">
        {turns.map((turn) => (
          <li className={cn('flex', turn.role === 'user' ? 'justify-end' : 'justify-start')} key={turn.id}>
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-4 py-3 text-base leading-7 whitespace-pre-wrap',
                turn.role === 'user' ? 'bg-indigo-800 text-white' : 'bg-sand text-ink',
              )}
            >
              <span className="sr-only">
                {turn.role === 'user' ? conversationT('you') : conversationT('assistant')}:{' '}
              </span>
              {turn.text}
              {turn.role === 'assistant' && turn.advisoryText ? (
                <AdvisoryBlock text={turn.advisoryText} />
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      {noVoiceNotice ? (
        <p className="mt-4 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-800" role="status">
          {conversationT('noVoice')}
        </p>
      ) : null}

      {turns.length > 0 ? (
        <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-ink-soft">
          <ShieldCheck aria-hidden className="size-3.5 shrink-0 text-indigo-600" />
          {conversationT('safeNote')}
        </p>
      ) : null}

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

/**
 * Round six, task L: one Nepali sentence with the price, offered — never
 * imposed — after the first voice answer. `PRICE_PLUS_NPR` reads `null`
 * until the owner sets it (`apps/web/.env.example`), in which case the
 * sentence honestly says "price soon" rather than a guessed number, matching
 * `/pricing`'s own placeholder convention. The close button is the only
 * dismiss control anywhere in this flow — `onDismiss` both hides it for the
 * rest of this session and persists the choice so it never nags again.
 */
function UpsellCard({
  locale,
  onDismiss,
}: {
  locale: ResearchLanguage;
  onDismiss: () => void;
}) {
  const t = useTranslations('getCare.upsell');
  const pricingT = useTranslations('pricing');
  const price = formatFreemiumPriceNpr(PRICE_PLUS_NPR, locale, pricingT('priceSoon'));
  // Owner decision 2026-08-18: premium is not for sale yet. Until
  // NEXT_PUBLIC_PREMIUM_LAUNCH=live the card builds anticipation instead of
  // quoting a price — "coming soon, be the first" — and links to early access.
  const premiumLive = isPremiumLive();

  return (
    <div className="mt-4 flex items-start gap-3 rounded-2xl border border-marigold-300 bg-marigold-100/60 p-4">
      <p className="flex-1 text-sm leading-relaxed font-semibold text-ink">
        {premiumLive ? t('body', { price }) : t('comingSoonBody')}
      </p>
      <div className="flex shrink-0 items-center gap-1">
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-pill bg-indigo-800 px-4 text-sm font-bold text-white hover:bg-indigo-700"
          href={premiumLive ? '/pricing' : '/pricing#early-access'}
        >
          {premiumLive ? t('cta') : t('comingSoonCta')}
        </Link>
        <button
          aria-label={t('dismiss')}
          className="grid size-11 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-white/70"
          onClick={onDismiss}
          type="button"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  );
}
