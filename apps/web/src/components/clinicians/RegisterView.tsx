'use client';

import type { ChangeEvent } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { councilRegistry } from '@swasthya/credentialing';
import type { CouncilKey, CredentialingApplication } from '@swasthya/shared-types';

import { RecordTransform } from '@/components/art/RecordTransform';
import { Button } from '@/components/ui/Button';
import { type CapturedFile, EvidenceCapture } from '@/components/ui/EvidenceCapture';
import { FormError } from '@/components/ui/FormError';
import { PageTemplate } from '@/components/ui/PageTemplate';
import { Section } from '@/components/ui/Section';
import { useSession } from '@/hooks/useSession';
import { cn } from '@/lib/cn';
import { councilName } from '@/lib/council-name';
import { CredentialingApiError, getMyCredentialingApplication, submitCredentialingApplication } from '@/lib/credentialing-api';

const COUNCIL_KEYS = Object.keys(councilRegistry) as CouncilKey[];
const STEP_ORDER = ['details', 'evidence', 'review', 'status'] as const;
type Step = (typeof STEP_ORDER)[number];
const STEP_HEADING_ID = 'register-step-heading';

// The exact set `CredentialingController.submit` can return for this route.
// `ApplicationTransitionError` used to reach the client as a bare 500 with no
// `code` at all — `CredentialingService.submit` now maps it to a
// `BadRequestException` (see that method's own doc comment) so it belongs
// here like any other named error. Every other code falls back to
// `errors.GENERIC`, the same convention `DelegationForm`'s
// `KNOWN_ERROR_CODES` established.
const KNOWN_ERROR_CODES = ['VALIDATION_ERROR', 'ApplicationTransitionError'] as const;

/**
 * `/clinicians/register` — council selection, registration number,
 * certificate/ID capture, then a status screen (identity-and-credentialing.md
 * §3's flow, steps 1-2 plus the submitted state of step 3).
 *
 * Gated behind `useSession()`: `CredentialingController.submit` derives the
 * applicant from the verified session rather than a client-supplied id (see
 * that route's own history note), so there is no honest way to submit
 * without one. This is the phone-verified `REGISTERED` bar every other
 * signed-in page on `apps/web` already sits behind, not the national-ID
 * `IDENTITY_VERIFIED` check identity-and-credentialing.md §1 says must never
 * gate signup — that check happens later, when a reviewer works the queue.
 * Submission now reaches the real `POST /credentialing/applications` and
 * enters the same reviewer queue `ReviewerGuard`-protected routes read from,
 * so the status screen can finally say so truthfully. §3's "no automatic
 * approval, ever" still holds client-side: this never calls
 * `beginReview`/`approveApplication` itself.
 *
 * Also fetches the caller's own application on mount and, if one already
 * exists, jumps straight to `status` showing its real state — including
 * `UNDER_REVIEW`, `APPROVED` and `REJECTED`, not only the just-submitted
 * `EVIDENCE_SUBMITTED` case. Without this, a returning applicant (a reload, a
 * closed tab, or a reviewer decision landing while she was away) had no way
 * to learn her real status short of restarting the form, since `application`
 * previously lived only in this component's own local state.
 */
export function RegisterView() {
  const t = useTranslations('clinicians.register');
  const errorsT = useTranslations('clinicians.register.errors');
  const nav = useTranslations('nav');
  const locale = useLocale();
  const baseId = useId();
  const session = useSession();

  const [step, setStep] = useState<Step>('details');
  const [selectedCouncil, setSelectedCouncil] = useState<CouncilKey | null>(null);
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [certificate, setCertificate] = useState<CapturedFile | null>(null);
  const [identity, setIdentity] = useState<CapturedFile | null>(null);
  const [application, setApplication] = useState<CredentialingApplication | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(true);

  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  // Runs once the session is live. `getMyCredentialingApplication` returns
  // `null` for an applicant who has never submitted — a real, honest outcome
  // (see `CredentialingService.findMine`'s own doc comment), not an error, so
  // only a genuinely existing application jumps the step forward. A failed
  // fetch degrades to the ordinary apply flow rather than blocking the page,
  // the same "never blocks" convention `useFamilyGrants` documents for its
  // own error state.
  useEffect(() => {
    if (session.status !== 'authenticated') return;
    let cancelled = false;
    getMyCredentialingApplication()
      .then((existing) => {
        if (cancelled) return;
        if (existing) {
          setApplication(existing);
          setStep('status');
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCheckingExisting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session.status]);

  // Revokes the *previous* object URL whenever a field is replaced or the
  // component unmounts — not on every render, since the cleanup closure
  // captures the value from the render it belonged to.
  useEffect(() => {
    if (!certificate) return;
    return () => URL.revokeObjectURL(certificate.previewUrl);
  }, [certificate]);
  useEffect(() => {
    if (!identity) return;
    return () => URL.revokeObjectURL(identity.previewUrl);
  }, [identity]);

  function captureFile(event: ChangeEvent<HTMLInputElement>, setFile: (value: CapturedFile) => void) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFile({ file, previewUrl: URL.createObjectURL(file) });
  }

  function localizedError(err: unknown): string {
    const code = err instanceof CredentialingApiError ? err.code : null;
    const known = KNOWN_ERROR_CODES.find((candidate) => candidate === code);
    return errorsT(known ?? 'GENERIC');
  }

  async function handleSubmit() {
    if (!selectedCouncil || !certificate || !identity) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const submitted = await submitCredentialingApplication({
        council: selectedCouncil,
        registrationNumber,
        // `local-file:` marks this as a reference to a file that only ever
        // lived in this browser tab, not a real uploaded object —
        // `packages/credentialing` has no evidence-storage adapter yet (a
        // separate, still-open gap), so nothing downstream mistakes it for
        // one.
        certificateImageRef: `local-file:${certificate.file.name}`,
        identityImageRef: `local-file:${identity.file.name}`,
      });
      setApplication(submitted);
      setStep('status');
    } catch (err) {
      setSubmitError(localizedError(err));
    } finally {
      setSubmitting(false);
    }
  }

  function resetFlow() {
    setStep('details');
    setSelectedCouncil(null);
    setRegistrationNumber('');
    setCertificate(null);
    setIdentity(null);
    setApplication(null);
  }

  const canContinueFromDetails = selectedCouncil !== null && registrationNumber.trim().length > 0;
  const canContinueFromEvidence = certificate !== null && identity !== null;

  const hero = {
    eyebrow: nav('items.register'),
    title: t('hero.title'),
    body: t('hero.body'),
    Art: RecordTransform,
    artPosition: 'end' as const,
  };

  // `useSession` redirects to `/signin` on anything other than a live
  // session (see its own doc comment), so this is the only other state ever
  // visible here — the same pattern `AccountView.tsx` uses for its one other
  // protected page. Also holds on `checkingExisting` so the `details` step
  // never flashes before the existing-application fetch above has a chance
  // to redirect a returning applicant to `status`.
  if (session.status !== 'authenticated' || checkingExisting) {
    return (
      <PageTemplate hero={hero}>
        <Section labelledBy={STEP_HEADING_ID}>
          <p id={STEP_HEADING_ID} role="status">
            {t('loading')}
          </p>
        </Section>
      </PageTemplate>
    );
  }

  return (
    <PageTemplate hero={hero}>
      <Section labelledBy={STEP_HEADING_ID}>
        <div className="mx-auto flex max-w-2xl flex-col gap-10">
          <ol aria-label={t('stepsLabel')} className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
            {STEP_ORDER.map((key, index) => {
              const isCurrent = key === step;
              const isComplete = STEP_ORDER.indexOf(step) > index;
              return (
                <li
                  aria-current={isCurrent ? 'step' : undefined}
                  className={cn(
                    'flex items-center gap-2',
                    isCurrent ? 'text-indigo-800' : isComplete ? 'text-success-600' : 'text-ink-soft',
                  )}
                  key={key}
                >
                  <span
                    className={cn(
                      'grid size-6 shrink-0 place-items-center rounded-full text-xs',
                      isCurrent
                        ? 'bg-indigo-800 text-white'
                        : isComplete
                          ? 'bg-indigo-100 text-success-700'
                          : 'bg-sand text-ink-soft',
                    )}
                  >
                    {index + 1}
                  </span>
                  {t(`steps.${key}`)}
                </li>
              );
            })}
          </ol>

          {step === 'details' ? (
            <div className="flex flex-col gap-8">
              <div>
                <h2 className="text-2xl font-bold text-ink md:text-3xl" id={STEP_HEADING_ID} ref={headingRef} tabIndex={-1}>
                  {t('details.heading')}
                </h2>
                <p className="mt-2 text-lg text-ink-soft">{t('details.body')}</p>
              </div>

              <fieldset className="flex flex-col gap-3">
                <legend className="text-sm font-semibold tracking-wide text-ink-soft uppercase">
                  {t('details.councilLegend')}
                </legend>
                {COUNCIL_KEYS.map((key) => {
                  const optionId = `${baseId}-council-${key}`;
                  const selected = key === selectedCouncil;
                  return (
                    <label
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors',
                        selected ? 'border-indigo-700 bg-indigo-50' : 'border-line bg-white hover:border-indigo-200',
                      )}
                      htmlFor={optionId}
                      key={key}
                    >
                      <input
                        checked={selected}
                        className="mt-1"
                        id={optionId}
                        name="council"
                        onChange={() => setSelectedCouncil(key)}
                        type="radio"
                        value={key}
                      />
                      <span className="flex flex-col gap-0.5">
                        <span className="font-semibold text-ink">{t(`professions.${key}`)}</span>
                        <span className="text-sm text-ink-soft">{councilName(key, locale)}</span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>

              <div className="flex flex-col gap-2">
                <label className="font-semibold text-ink" htmlFor={`${baseId}-registration-number`}>
                  {t('details.registrationNumberLabel')}
                </label>
                <input
                  className="rounded-xl border border-line bg-white px-4 py-3 text-ink placeholder:text-ink-soft/60"
                  id={`${baseId}-registration-number`}
                  onChange={(event) => setRegistrationNumber(event.target.value)}
                  placeholder={t('details.registrationNumberPlaceholder')}
                  type="text"
                  value={registrationNumber}
                />
              </div>

              <div>
                <Button disabled={!canContinueFromDetails} onClick={() => setStep('evidence')} variant="primary">
                  {t('details.continueCta')}
                </Button>
              </div>
            </div>
          ) : null}

          {step === 'evidence' ? (
            <div className="flex flex-col gap-8">
              <div>
                <h2 className="text-2xl font-bold text-ink md:text-3xl" id={STEP_HEADING_ID} ref={headingRef} tabIndex={-1}>
                  {t('evidence.heading')}
                </h2>
                <p className="mt-2 text-lg text-ink-soft">{t('evidence.body')}</p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <EvidenceCapture
                  captured={certificate}
                  changeLabel={t('evidence.changeFile')}
                  chooseLabel={t('evidence.chooseFile')}
                  hint={t('evidence.certificateHint')}
                  id={`${baseId}-certificate`}
                  label={t('evidence.certificateLabel')}
                  onCapture={(event) => captureFile(event, setCertificate)}
                />
                <EvidenceCapture
                  captured={identity}
                  changeLabel={t('evidence.changeFile')}
                  chooseLabel={t('evidence.chooseFile')}
                  hint={t('evidence.identityHint')}
                  id={`${baseId}-identity`}
                  label={t('evidence.identityLabel')}
                  onCapture={(event) => captureFile(event, setIdentity)}
                />
              </div>

              <div className="flex gap-3">
                <Button onClick={() => setStep('details')} variant="secondary">
                  {t('evidence.backCta')}
                </Button>
                <Button disabled={!canContinueFromEvidence} onClick={() => setStep('review')} variant="primary">
                  {t('evidence.continueCta')}
                </Button>
              </div>
            </div>
          ) : null}

          {step === 'review' && selectedCouncil && certificate && identity ? (
            <div className="flex flex-col gap-8">
              <div>
                <h2 className="text-2xl font-bold text-ink md:text-3xl" id={STEP_HEADING_ID} ref={headingRef} tabIndex={-1}>
                  {t('review.heading')}
                </h2>
                <p className="mt-2 text-lg text-ink-soft">{t('review.body')}</p>
              </div>

              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-semibold tracking-wide text-ink-soft uppercase">
                    {t('review.councilLabel')}
                  </dt>
                  <dd className="text-ink">
                    {t(`professions.${selectedCouncil}`)} — {councilName(selectedCouncil, locale)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold tracking-wide text-ink-soft uppercase">
                    {t('review.registrationNumberLabel')}
                  </dt>
                  <dd className="text-ink">{registrationNumber}</dd>
                </div>
              </dl>

              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold tracking-wide text-ink-soft uppercase">
                    {t('review.certificateLabel')}
                  </p>
                  <img
                    alt={t('review.certificateLabel')}
                    className="mt-2 aspect-[3/2] w-full rounded-xl object-cover"
                    src={certificate.previewUrl}
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold tracking-wide text-ink-soft uppercase">
                    {t('review.identityLabel')}
                  </p>
                  <img
                    alt={t('review.identityLabel')}
                    className="mt-2 aspect-[3/2] w-full rounded-xl object-cover"
                    src={identity.previewUrl}
                  />
                </div>
              </div>

              <FormError message={submitError} />

              <div className="flex gap-3">
                <Button disabled={submitting} onClick={() => setStep('evidence')} variant="secondary">
                  {t('review.backCta')}
                </Button>
                {/* The single marigold action across this whole flow — the
                    actual moment of commitment, not every "continue" click. */}
                <Button disabled={submitting} onClick={() => void handleSubmit()} variant="accent">
                  {t('review.submitCta')}
                </Button>
              </div>
            </div>
          ) : null}

          {step === 'status' && application ? (
            <div className="flex flex-col gap-6">
              <h2 className="text-2xl font-bold text-ink md:text-3xl" id={STEP_HEADING_ID} ref={headingRef} tabIndex={-1}>
                {t('status.heading')}
              </h2>

              {application.status === 'EVIDENCE_SUBMITTED' || application.status === 'UNDER_REVIEW' ? (
                <p className="text-lg text-ink-soft">
                  {t('status.body', { council: councilName(application.council, locale) })}
                </p>
              ) : null}

              {application.status === 'APPROVED' ? (
                <p className="rounded-xl bg-indigo-100 p-4 text-sm font-semibold text-success-700" role="status">
                  {t('status.approved')}
                </p>
              ) : null}

              {application.status === 'REJECTED' ? (
                <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700" role="alert">
                  {t('status.rejected', { reason: application.rejectionReason ?? '' })}
                </p>
              ) : null}

              <div className="rounded-2xl bg-sand/70 p-4 ring-1 ring-line">
                <p className="text-sm font-semibold tracking-wide text-ink-soft uppercase">
                  {t('status.referenceLabel')}
                </p>
                <p className="font-mono text-ink">{application.id}</p>
              </div>
              <p className="rounded-2xl bg-sand/70 p-4 text-sm leading-relaxed text-ink-soft ring-1 ring-line">
                {t('status.demoNotice')}
              </p>
              {/* `canTransitionApplication` (`packages/credentialing`) only permits
                  re-entering `EVIDENCE_SUBMITTED` from `REJECTED` (or `NOT_STARTED`,
                  which never reaches this branch — `application` is only ever a
                  persisted record). Showing this for `EVIDENCE_SUBMITTED`/
                  `UNDER_REVIEW`/`APPROVED` would let a clinician refill the whole
                  form only to have the real submit throw `ApplicationTransitionError`,
                  and `resetFlow` clears `application` to `null` with nothing left to
                  re-fetch it, losing her real status until a reload. Same gate
                  `IdentityVerification.tsx`'s `canSubmit` already applies. */}
              {application.status === 'REJECTED' ? (
                <div>
                  <Button onClick={resetFlow} variant="secondary">
                    {t('status.startOverCta')}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </Section>
    </PageTemplate>
  );
}
