'use client';

import type { ChangeEvent } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { councilRegistry } from '@swasthya/credentialing';
import type { CouncilKey, CredentialingApplication } from '@swasthya/shared-types';

import { RecordTransform } from '@/components/art/RecordTransform';
import { Button } from '@/components/ui/Button';
import { PageTemplate } from '@/components/ui/PageTemplate';
import { Section } from '@/components/ui/Section';
import { cn } from '@/lib/cn';
import { submitNewClinicianApplication } from '@/lib/clinician-application';
import { councilName } from '@/lib/council-name';

const COUNCIL_KEYS = Object.keys(councilRegistry) as CouncilKey[];
const STEP_ORDER = ['details', 'evidence', 'review', 'status'] as const;
type Step = (typeof STEP_ORDER)[number];
const STEP_HEADING_ID = 'register-step-heading';

interface CapturedFile {
  file: File;
  previewUrl: string;
}

/**
 * A hidden file input triggered by its own visible `<label>` — the standard
 * accessible pattern for styling a file picker without JS click-forwarding.
 * `capture="environment"` opens the device camera directly on a phone
 * browser while still falling back to a plain file picker on desktop; there
 * is no live-preview camera flow on the web the way `apps/mobile`'s
 * `expo-camera` capture screen has one.
 */
function EvidenceCapture({
  captured,
  chooseLabel,
  changeLabel,
  hint,
  id,
  label,
  onCapture,
}: {
  captured: CapturedFile | null;
  chooseLabel: string;
  changeLabel: string;
  hint: string;
  id: string;
  label: string;
  onCapture: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4">
      <div>
        <p className="font-semibold text-ink">{label}</p>
        <p className="text-sm text-ink-soft">{hint}</p>
      </div>
      {captured ? (
        <img
          alt={label}
          className="aspect-[3/2] w-full rounded-xl object-cover"
          src={captured.previewUrl}
        />
      ) : null}
      <label
        className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-pill bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-800 hover:bg-indigo-100"
        htmlFor={id}
      >
        {captured ? changeLabel : chooseLabel}
      </label>
      <input
        accept="image/*"
        capture="environment"
        className="sr-only"
        id={id}
        onChange={onCapture}
        type="file"
      />
    </div>
  );
}

/**
 * `/clinicians/register` — council selection, registration number,
 * certificate/ID capture, then a status screen (identity-and-credentialing.md
 * §3's flow, steps 1-2 plus the submitted state of step 3).
 *
 * Entirely client-side state: `apps/web` has no backend route and
 * `packages/credentialing` has no evidence-storage adapter yet (both named
 * as open gaps in `agent-progress.md`), so this can build and submit a real
 * `CredentialingApplication` through the domain package but has nowhere to
 * persist it — the status screen says so plainly rather than implying a
 * review team is already looking at it. §3's "no automatic approval, ever"
 * is followed literally: this never calls `beginReview`/`approveApplication`
 * itself, so the only reachable status here is `EVIDENCE_SUBMITTED`.
 */
export function RegisterView() {
  const t = useTranslations('clinicians.register');
  const nav = useTranslations('nav');
  const locale = useLocale();
  const baseId = useId();

  const [step, setStep] = useState<Step>('details');
  const [selectedCouncil, setSelectedCouncil] = useState<CouncilKey | null>(null);
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [certificate, setCertificate] = useState<CapturedFile | null>(null);
  const [identity, setIdentity] = useState<CapturedFile | null>(null);
  const [application, setApplication] = useState<CredentialingApplication | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

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

  function handleSubmit() {
    if (!selectedCouncil || !certificate || !identity) return;
    const submitted = submitNewClinicianApplication({
      council: selectedCouncil,
      registrationNumber,
      certificateFileName: certificate.file.name,
      identityFileName: identity.file.name,
      submittedAt: new Date().toISOString(),
    });
    setApplication(submitted);
    setStep('status');
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

              <div className="flex gap-3">
                <Button onClick={() => setStep('evidence')} variant="secondary">
                  {t('review.backCta')}
                </Button>
                {/* The single marigold action across this whole flow — the
                    actual moment of commitment, not every "continue" click. */}
                <Button onClick={handleSubmit} variant="accent">
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
              <p className="text-lg text-ink-soft">
                {t('status.body', { council: councilName(application.council, locale) })}
              </p>
              <div className="rounded-2xl bg-sand/70 p-4 ring-1 ring-line">
                <p className="text-sm font-semibold tracking-wide text-ink-soft uppercase">
                  {t('status.referenceLabel')}
                </p>
                <p className="font-mono text-ink">{application.id}</p>
              </div>
              <p className="rounded-2xl bg-sand/70 p-4 text-sm leading-relaxed text-ink-soft ring-1 ring-line">
                {t('status.demoNotice')}
              </p>
              <div>
                <Button onClick={resetFlow} variant="secondary">
                  {t('status.startOverCta')}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </Section>
    </PageTemplate>
  );
}
