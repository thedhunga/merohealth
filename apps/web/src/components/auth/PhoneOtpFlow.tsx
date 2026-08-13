'use client';

import type { FormEvent } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { RecordTransform } from '@/components/art/RecordTransform';
import { Button } from '@/components/ui/Button';
import { Link, useRouter } from '@/i18n/navigation';
import { PageTemplate } from '@/components/ui/PageTemplate';
import { Section } from '@/components/ui/Section';
import { AuthApiError, requestOtp, verifyOtp, type AuthIntent } from '@/lib/auth-api';
import { sanitizeNextPath, switchLinkHref } from '@/lib/safe-redirect';

type Step = 'phone' | 'code';

const STEP_HEADING_ID = 'auth-step-heading';

// The exact set `apps/api`'s `AuthController`/`AuthService` can return —
// every other `AuthApiError.code` (a network failure, an unexpected 500)
// falls back to `errors.GENERIC` rather than surfacing an un-translated key.
const KNOWN_ERROR_CODES = [
  'INVALID_PHONE',
  'OTP_COOLDOWN',
  'OTP_CHALLENGE_NOT_FOUND',
  'OTP_EXPIRED',
  'OTP_ATTEMPTS_EXCEEDED',
  'OTP_INCORRECT',
  'NOT_REGISTERED',
  'ALREADY_REGISTERED',
  'DISPLAY_NAME_REQUIRED',
  'VALIDATION_ERROR',
] as const;

/**
 * Phone + OTP — `/signin` and `/register` share this: the two flows differ
 * only in whether a display name is collected up front and which intent is
 * sent to `POST /auth/otp/verify` (identity-and-credentialing.md §2 doesn't
 * distinguish them as separate mechanisms, just separate outcomes for an
 * existing vs. new phone number). A successful verify leaves a live
 * `mero_session` cookie (`AuthController.verifyOtp` sets it), so this
 * redirects into `/account` — the protected landing page Round two §D2
 * built — instead of the static confirmation panel this used to end on back
 * when `apps/web` had nowhere authenticated to send anyone. Unless a
 * `?next=` param is present: `useSession` attaches one whenever it bounces a
 * signed-out visitor off *another* protected page (e.g.
 * `/clinicians/register`) through here first, and without reading it back
 * every such visitor would land on `/account` instead of the page they were
 * actually trying to reach. Read from `window.location.search` rather than
 * `useSearchParams()` — that hook forces a Suspense boundary on a
 * statically-prerendered page. `next` is also threaded onto the sign-in ↔
 * register switch link below, so a visitor who doesn't have an account yet
 * and clicks through from `/signin?next=…` to `/register` still lands on
 * their original destination afterwards instead of `/account`.
 */
export function PhoneOtpFlow({ intent }: { intent: AuthIntent }) {
  const t = useTranslations(intent === 'REGISTER' ? 'auth.register' : 'auth.signIn');
  const errorsT = useTranslations('auth.errors');
  const nav = useTranslations('nav');
  const locale = useLocale() as 'ne' | 'en';
  const baseId = useId();
  const router = useRouter();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // `null` on the first render (matching SSR, which has no
  // `window.location.search` to read) and populated post-mount — see the
  // component doc comment above.
  const [next, setNext] = useState<string | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);
  useEffect(() => {
    setNext(sanitizeNextPath(new URLSearchParams(window.location.search).get('next')));
  }, []);

  function localizedError(err: unknown): string {
    const code = err instanceof AuthApiError ? err.code : null;
    const known = KNOWN_ERROR_CODES.find((candidate) => candidate === code);
    return errorsT(known ?? 'GENERIC');
  }

  async function handlePhoneSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (intent === 'REGISTER' && displayName.trim().length === 0) {
      setError(errorsT('DISPLAY_NAME_REQUIRED'));
      return;
    }
    setSubmitting(true);
    try {
      const result = await requestOtp(phone);
      setChallengeId(result.challengeId);
      setDebugCode(result.debugCode ?? null);
      setStep('code');
    } catch (err) {
      setError(localizedError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCodeSubmit(event: FormEvent) {
    event.preventDefault();
    if (!challengeId) return;
    setError(null);
    setSubmitting(true);
    try {
      await verifyOtp({
        challengeId,
        code,
        phone,
        intent,
        ...(intent === 'REGISTER' ? { displayName: displayName.trim() } : {}),
        locale,
      });
      // Leaves `submitting` true rather than resetting it — the form is
      // about to unmount as the router navigates away, and re-enabling the
      // button for the instant before that happens would just flash.
      router.push(next ?? '/account');
    } catch (err) {
      setError(localizedError(err));
      setSubmitting(false);
    }
  }

  function backToPhone() {
    setStep('phone');
    setCode('');
    setError(null);
  }

  const hero = {
    eyebrow: t('hero.eyebrow'),
    title: t('hero.title'),
    body: t('hero.body'),
    Art: RecordTransform,
    artPosition: 'end' as const,
  };

  return (
    <PageTemplate hero={hero}>
      <Section labelledBy={STEP_HEADING_ID}>
        <div className="mx-auto flex max-w-md flex-col gap-8">
          {step === 'phone' ? (
            <form className="flex flex-col gap-6" onSubmit={(event) => void handlePhoneSubmit(event)}>
              <div>
                <h2 className="text-2xl font-bold text-ink md:text-3xl" id={STEP_HEADING_ID} ref={headingRef} tabIndex={-1}>
                  {t('phone.heading')}
                </h2>
                <p className="mt-2 text-lg text-ink-soft">{t('phone.body')}</p>
              </div>

              {intent === 'REGISTER' ? (
                <div className="flex flex-col gap-2">
                  <label className="font-semibold text-ink" htmlFor={`${baseId}-name`}>
                    {t('phone.nameLabel')}
                  </label>
                  <input
                    autoComplete="name"
                    className="rounded-xl border border-line bg-white px-4 py-3 text-ink placeholder:text-ink-soft/60"
                    id={`${baseId}-name`}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder={t('phone.namePlaceholder')}
                    type="text"
                    value={displayName}
                  />
                </div>
              ) : null}

              <div className="flex flex-col gap-2">
                <label className="font-semibold text-ink" htmlFor={`${baseId}-phone`}>
                  {t('phone.phoneLabel')}
                </label>
                <input
                  autoComplete="tel"
                  className="rounded-xl border border-line bg-white px-4 py-3 text-ink placeholder:text-ink-soft/60"
                  id={`${baseId}-phone`}
                  inputMode="tel"
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder={t('phone.phonePlaceholder')}
                  type="tel"
                  value={phone}
                />
              </div>

              {error ? <p role="alert" className="text-sm font-semibold text-red-700">{error}</p> : null}

              <div>
                <Button disabled={submitting || phone.trim().length === 0} type="submit" variant="accent">
                  {t('phone.submitCta')}
                </Button>
              </div>

              <p className="text-sm text-ink-soft">
                {intent === 'REGISTER' ? (
                  <>
                    {t('phone.switchPrompt')}{' '}
                    <Link className="font-semibold text-forest-700 underline" href={switchLinkHref('/signin', next)}>
                      {nav('actions.signIn')}
                    </Link>
                  </>
                ) : (
                  <>
                    {t('phone.switchPrompt')}{' '}
                    <Link className="font-semibold text-forest-700 underline" href={switchLinkHref('/register', next)}>
                      {nav('actions.register')}
                    </Link>
                  </>
                )}
              </p>
            </form>
          ) : null}

          {step === 'code' ? (
            <form className="flex flex-col gap-6" onSubmit={(event) => void handleCodeSubmit(event)}>
              <div>
                <h2 className="text-2xl font-bold text-ink md:text-3xl" id={STEP_HEADING_ID} ref={headingRef} tabIndex={-1}>
                  {t('code.heading')}
                </h2>
                <p className="mt-2 text-lg text-ink-soft">{t('code.body')}</p>
              </div>

              {debugCode ? (
                <p className="rounded-2xl bg-sand/70 p-4 text-sm text-ink-soft ring-1 ring-line">
                  {t('code.devCodeNotice', { code: debugCode })}
                </p>
              ) : null}

              <div className="flex flex-col gap-2">
                <label className="font-semibold text-ink" htmlFor={`${baseId}-code`}>
                  {t('code.codeLabel')}
                </label>
                <input
                  autoComplete="one-time-code"
                  className="rounded-xl border border-line bg-white px-4 py-3 text-center text-2xl tracking-[0.5em] text-ink"
                  id={`${baseId}-code`}
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                  placeholder={t('code.codePlaceholder')}
                  type="text"
                  value={code}
                />
              </div>

              {error ? <p role="alert" className="text-sm font-semibold text-red-700">{error}</p> : null}

              <div className="flex gap-3">
                <Button onClick={backToPhone} type="button" variant="secondary">
                  {t('code.backCta')}
                </Button>
                <Button disabled={submitting || code.trim().length === 0} type="submit" variant="accent">
                  {t('code.submitCta')}
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      </Section>
    </PageTemplate>
  );
}
