'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, BookOpenCheck, Keyboard, MessageCircleHeart, Users } from 'lucide-react';

import { Link, useRouter } from '@/i18n/navigation';
import { useSpeechDictation } from '@/hooks/useSpeechDictation';
import { useFamilyGrants } from '@/hooks/useFamilyGrants';
import { useOptionalSession } from '@/hooks/useSession';
import { buildActingSubjects } from '@/lib/acting-subjects';
import { history } from '@/lib/anonymous-history';
import { storeCareListenIntent, storeCareQuestion } from '@/lib/get-care-session';
import { dailyArticle, greetingPeriod, micHeroLayout } from '@/lib/home-screen';
import { cn } from '@/lib/cn';
import { MicHero } from './MicHero';

const CHIP_KEYS = ['fever', 'headache', 'medicine', 'report'] as const;

/**
 * Round seven, task O: `/` for a device with a history of its own — the
 * daily-use surface, not the marketing pitch `HomeGate` falls back to for a
 * first visit. One purpose (ask, by voice, in one tap) plus what is
 * genuinely already true about this person: their last question, their
 * family if they have delegated access to any, one rotating library
 * article. Nothing invented, nothing fetched that a signed-out visitor
 * cannot honestly have.
 */
export function HomeScreen() {
  const t = useTranslations('homeScreen');
  const switcherT = useTranslations('account.switcher');
  const articleT = useTranslations('healthLibrary.articles');
  const locale = useLocale();
  const router = useRouter();
  // No callback is ever invoked here — this screen never listens itself, it
  // only needs to know whether the device *can*, to decide what tapping the
  // mic hands off to `/get-care`.
  const dictation = useSpeechDictation(locale, () => {});
  const session = useOptionalSession();
  const [familyState] = useFamilyGrants(session.status === 'authenticated');

  const greeting = t(`greeting.${greetingPeriod(new Date().getHours())}`);
  const lastExchange = useMemo(() => {
    const exchanges = history();
    return exchanges[exchanges.length - 1];
  }, []);
  // Rotates by calendar day, not on every render — `useMemo` with no deps
  // freezes it at the date this screen mounted, matching every other
  // once-per-visit read on this page (the greeting, the last exchange).
  const article = useMemo(() => dailyArticle(new Date()), []);

  const familyMembers = useMemo(() => {
    if (session.status !== 'authenticated') return [];
    const guardianships = familyState.status === 'loaded' ? familyState.grants.guardianships : [];
    const delegations = familyState.status === 'loaded' ? familyState.grants.delegations : [];
    return buildActingSubjects(
      { id: session.user.userId, displayName: switcherT('self') },
      guardianships,
      delegations,
      new Date().toISOString(),
    ).filter((subject) => subject.relationship !== 'SELF');
  }, [session, familyState, switcherT]);

  const goToGetCare = (question?: string) => {
    if (question) storeCareQuestion(question);
    router.push('/get-care');
  };

  const handleMicTap = () => {
    if (dictation.supported) storeCareListenIntent();
    router.push('/get-care');
  };

  const layout = micHeroLayout(dictation.supported);

  return (
    <section aria-labelledby="home-screen-heading" className="bg-paper py-8 sm:py-12">
      <div className="container-site max-w-xl">
        <h1 className="text-2xl font-bold text-indigo-950" id="home-screen-heading">
          {greeting}
        </h1>

        <div className="mt-6 flex flex-col items-center">
          <MicHero
            label={layout === 'voiceFirst' ? t('micLabel') : t('micUnavailable')}
            onClick={handleMicTap}
            state={layout === 'voiceFirst' ? 'idle' : 'unavailable'}
          />

          <button
            className={cn(
              'mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold transition-colors',
              layout === 'voiceFirst'
                ? 'px-2 text-indigo-700 hover:text-indigo-800'
                : 'rounded-pill bg-marigold-500 px-5 text-indigo-950 hover:bg-marigold-300',
            )}
            onClick={() => goToGetCare()}
            type="button"
          >
            <Keyboard aria-hidden className="size-4" />
            {t('typeLabel')}
          </button>
        </div>

        <ul aria-label={t('chipsLabel')} className="mt-6 flex flex-wrap justify-center gap-2">
          {CHIP_KEYS.map((key) => (
            <li key={key}>
              <button
                className="inline-flex min-h-11 items-center rounded-pill bg-white px-4 text-sm font-medium text-ink ring-1 ring-line transition-colors hover:bg-indigo-50 hover:ring-indigo-200"
                onClick={() => goToGetCare(t(`chips.${key}`))}
                type="button"
              >
                {t(`chips.${key}`)}
              </button>
            </li>
          ))}
        </ul>

        {lastExchange ? (
          <button
            className="mt-6 flex w-full items-start gap-3 rounded-2xl bg-white p-4 text-left ring-1 ring-line transition-colors hover:bg-indigo-50"
            onClick={() => goToGetCare()}
            type="button"
          >
            <MessageCircleHeart aria-hidden className="mt-0.5 size-5 shrink-0 text-indigo-700" />
            <div className="min-w-0">
              <p className="text-xs font-bold tracking-wide text-indigo-700 uppercase">
                {t('lastConversation.heading')}
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-ink">{lastExchange.question}</p>
              <p className="mt-0.5 truncate text-xs text-ink-soft">
                {lastExchange.outcome === 'answered' && lastExchange.answer
                  ? lastExchange.answer
                  : t(`lastConversation.${lastExchange.outcome}Outcome`)}
              </p>
            </div>
          </button>
        ) : null}

        {familyMembers.length > 0 ? (
          <div className="mt-6">
            <p className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-indigo-700 uppercase">
              <Users aria-hidden className="size-3.5" />
              {t('family.heading')}
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {familyMembers.map((member) => (
                <li key={member.id}>
                  <Link
                    className="inline-flex min-h-11 items-center rounded-pill bg-white px-4 text-sm font-medium text-ink ring-1 ring-line hover:bg-indigo-50"
                    href="/account"
                  >
                    {member.displayName}
                    <span className="ms-1.5 text-xs text-ink-soft">
                      · {switcherT(member.relationship === 'GUARDIAN' ? 'guardianSuffix' : 'delegateSuffix')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <Link
          className="mt-6 flex items-center gap-3 rounded-2xl bg-indigo-50 p-4 ring-1 ring-indigo-100 transition-colors hover:bg-indigo-100"
          href={`/health-library/${article.slug}`}
        >
          <BookOpenCheck aria-hidden className="size-5 shrink-0 text-indigo-700" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold tracking-wide text-indigo-700 uppercase">{t('dailyThing.heading')}</p>
            <p className="mt-1 truncate text-sm font-semibold text-ink">{articleT(`${article.key}.title`)}</p>
          </div>
          <ArrowRight aria-hidden className="size-4 shrink-0 text-indigo-700" />
        </Link>
      </div>
    </section>
  );
}
