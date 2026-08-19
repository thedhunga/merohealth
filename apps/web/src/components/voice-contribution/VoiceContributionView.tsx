'use client';

import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ageBandOptions,
  genderOptions,
  hasCorpusConsent,
  motherTongueOptions,
  type AgeBand,
  type Gender,
  type MotherTongue,
  type VoiceClipSelfReport,
} from '@swasthya/language-corpus';
import { Mic, Square } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { VOICE_CONTRIBUTION_TASKS, type VoiceContributionTask } from '@/content/voice-contribution';
import { useCorpusConsent } from '@/hooks/useCorpusConsent';
import { useSession } from '@/hooks/useSession';
import { useVoiceContributionRecorder } from '@/hooks/useVoiceContributionRecorder';
import { grantCorpusConsent } from '@/lib/corpus-consent-api';
import { generateLocalId } from '@/lib/local-id';
import { submitVoiceClip, VoiceContributionApiError } from '@/lib/voice-contribution-api';

const KIND = 'VOICE_CONTRIBUTION';

/**
 * `/contribute` — Round six §M's third box, §4 stream A of
 * `docs/product/freemium-and-voice-corpus.md`. `useSession` gates this on a
 * live session (redirects to `/signin` otherwise, carrying `?next=`), then
 * `useCorpusConsent` gates it a second time on `VOICE_CONTRIBUTION` consent
 * specifically — a signed-in person who has never opted into *this* stream
 * sees a consent prompt, not the recorder, the same "consent cannot be
 * built later" reasoning `packages/language-corpus`'s own doc comment
 * gives. Self-report is collected once per visit and reused for every clip
 * submitted in that visit, matching the doc's own record shape
 * (`district`/`motherTongue`/`ageBand`/`gender` travel with every clip, not
 * just the first).
 */
export function VoiceContributionView() {
  const t = useTranslations('voiceContribution');
  const session = useSession();
  const user = session.status === 'authenticated' ? session.user : null;
  const [consentState, refreshConsent] = useCorpusConsent(user !== null);
  const [grantingConsent, setGrantingConsent] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [confirmedSelfReport, setConfirmedSelfReport] = useState<VoiceClipSelfReport | null>(null);
  const [completedTaskIds, setCompletedTaskIds] = useState<readonly string[]>([]);

  if (!user || consentState.status === 'loading') {
    return (
      <p className="container-site py-10 text-sm text-ink-soft" role="status">
        {t('loading')}
      </p>
    );
  }

  const hasConsent = hasCorpusConsent(
    consentState.status === 'loaded' ? consentState.grants : [],
    KIND,
    new Date().toISOString(),
  );

  if (!hasConsent) {
    async function handleGrantConsent() {
      setConsentError(null);
      setGrantingConsent(true);
      try {
        await grantCorpusConsent(KIND);
        refreshConsent();
      } catch {
        setConsentError(t('consentGate.error'));
      } finally {
        setGrantingConsent(false);
      }
    }

    return (
      <section className="container-site py-10 sm:py-16">
        <div className="mx-auto max-w-xl rounded-[1.75rem] bg-paper p-6 shadow-lift sm:p-8">
          <h1 className="text-3xl">{t('heading')}</h1>
          <p className="mt-3 leading-relaxed text-ink-soft">{t('consentGate.body')}</p>
          <p className="mt-2 text-sm text-ink-soft">{t('consentGate.optional')}</p>
          <div className="mt-6">
            <Button disabled={grantingConsent} onClick={() => void handleGrantConsent()} variant="accent">
              {t('consentGate.cta')}
            </Button>
          </div>
          <FormError message={consentError} />
        </div>
      </section>
    );
  }

  if (!confirmedSelfReport) {
    return <SelfReportForm onSubmit={setConfirmedSelfReport} />;
  }

  const remainingTasks = VOICE_CONTRIBUTION_TASKS.filter((task) => !completedTaskIds.includes(task.id));
  if (remainingTasks.length === 0) {
    return <DonePanel />;
  }

  const currentTask = remainingTasks[0];
  if (!currentTask) return <DonePanel />;

  return (
    <TaskRecorder
      completedCount={completedTaskIds.length}
      key={currentTask.id}
      onCompleted={() => setCompletedTaskIds((current) => [...current, currentTask.id])}
      selfReport={confirmedSelfReport}
      task={currentTask}
      totalTasks={VOICE_CONTRIBUTION_TASKS.length}
    />
  );
}

function SelfReportForm({ onSubmit }: { onSubmit: (report: VoiceClipSelfReport) => void }) {
  const t = useTranslations('voiceContribution');
  const [district, setDistrict] = useState('');
  const [motherTongue, setMotherTongue] = useState<MotherTongue | ''>('');
  const [ageBand, setAgeBand] = useState<AgeBand | ''>('');
  const [gender, setGender] = useState<Gender | ''>('');

  const canSubmit = district.trim().length > 0 && motherTongue !== '' && ageBand !== '';

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit({ district: district.trim(), motherTongue, ageBand, gender: gender === '' ? null : gender });
  }

  const fieldClass = 'rounded-xl border border-line bg-surface px-4 py-3 text-ink';

  return (
    <section className="container-site py-10 sm:py-16">
      <div className="mx-auto max-w-xl rounded-[1.75rem] bg-paper p-6 shadow-lift sm:p-8">
        <h1 className="text-3xl">{t('heading')}</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">{t('intro')}</p>

        <form className="mt-6 flex flex-col gap-5" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <label className="font-semibold text-ink" htmlFor="voice-contribution-district">
              {t('selfReport.district.label')}
            </label>
            <input
              className={fieldClass}
              id="voice-contribution-district"
              onChange={(event) => setDistrict(event.target.value)}
              placeholder={t('selfReport.district.placeholder')}
              type="text"
              value={district}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-semibold text-ink" htmlFor="voice-contribution-mother-tongue">
              {t('selfReport.motherTongue.label')}
            </label>
            <select
              className={fieldClass}
              id="voice-contribution-mother-tongue"
              onChange={(event) => setMotherTongue(event.target.value as MotherTongue)}
              value={motherTongue}
            >
              <option value="">{t('selfReport.choose')}</option>
              {motherTongueOptions.map((option) => (
                <option key={option} value={option}>
                  {t(`selfReport.motherTongue.options.${option}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-semibold text-ink" htmlFor="voice-contribution-age-band">
              {t('selfReport.ageBand.label')}
            </label>
            <select
              className={fieldClass}
              id="voice-contribution-age-band"
              onChange={(event) => setAgeBand(event.target.value as AgeBand)}
              value={ageBand}
            >
              <option value="">{t('selfReport.choose')}</option>
              {ageBandOptions.map((option) => (
                <option key={option} value={option}>
                  {t(`selfReport.ageBand.options.${option}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-semibold text-ink" htmlFor="voice-contribution-gender">
              {t('selfReport.gender.label')} <span className="font-normal text-ink-soft">{t('selfReport.optional')}</span>
            </label>
            <select
              className={fieldClass}
              id="voice-contribution-gender"
              onChange={(event) => setGender(event.target.value as Gender)}
              value={gender}
            >
              <option value="">{t('selfReport.choose')}</option>
              {genderOptions.map((option) => (
                <option key={option} value={option}>
                  {t(`selfReport.gender.options.${option}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Button disabled={!canSubmit} type="submit" variant="accent">
              {t('selfReport.submitCta')}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}

const KNOWN_SUBMIT_ERROR_CODES = [
  'VOICE_CONTRIBUTION_CONSENT_REQUIRED',
  'VOICE_CLIP_TOO_SHORT',
  'VOICE_CLIP_TOO_LONG',
  'VOICE_CLIP_DUPLICATE',
] as const;

function TaskRecorder({
  task,
  selfReport,
  totalTasks,
  completedCount,
  onCompleted,
}: {
  task: VoiceContributionTask;
  selfReport: VoiceClipSelfReport;
  totalTasks: number;
  completedCount: number;
  onCompleted: () => void;
}) {
  const t = useTranslations('voiceContribution');
  const recorderT = useTranslations('voiceContribution.recorder');
  const { status, elapsedMs, recording, start, stop, reset } = useVoiceContributionRecorder();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const previewUrl = useMemo(() => (recording ? URL.createObjectURL(recording.blob) : null), [recording]);
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function handleSubmit() {
    if (!recording) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await submitVoiceClip({
        id: generateLocalId('voice-clip'),
        taskId: task.id,
        taskKind: task.kind,
        selfReport,
        device: navigator.userAgent,
        durationMs: Math.round(recording.durationMs),
        blob: recording.blob,
      });
      onCompleted();
    } catch (err) {
      const code = err instanceof VoiceContributionApiError ? err.code : null;
      const known = KNOWN_SUBMIT_ERROR_CODES.find((candidate) => candidate === code);
      setSubmitError(recorderT(`errors.${known ?? 'GENERIC'}`));
    } finally {
      setSubmitting(false);
    }
  }

  const seconds = Math.floor(elapsedMs / 1000);

  return (
    <section className="container-site py-10 sm:py-16">
      <div className="mx-auto max-w-xl">
        <p className="text-sm font-semibold text-accent-text">{t('progress', { done: completedCount, total: totalTasks })}</p>
        <h1 className="mt-2 text-2xl">{t(`tasks.${task.kind === 'READ_PROMPT' ? 'readPromptHeading' : 'freeSpeechHeading'}`)}</h1>

        <div className="mt-6 rounded-[1.75rem] bg-paper p-6 shadow-lift sm:p-8">
          <p className="text-lg leading-relaxed text-ink" lang="ne">
            {t(`tasks.${task.id}.prompt`)}
          </p>

          {status === 'unsupported' ? (
            <p className="mt-6 text-sm font-semibold text-accent-danger" role="alert">
              {recorderT('unsupported')}
            </p>
          ) : status === 'permission-denied' ? (
            <p className="mt-6 text-sm font-semibold text-accent-danger" role="alert">
              {recorderT('permissionDenied')}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col items-center gap-4">
            {status === 'idle' || status === 'requesting-permission' || status === 'permission-denied' || status === 'unsupported' ? (
              <Button disabled={status === 'requesting-permission'} onClick={() => void start()} variant="accent">
                <Mic aria-hidden className="size-4" />
                {recorderT('start')}
              </Button>
            ) : status === 'recording' ? (
              <>
                <p aria-live="polite" className="text-sm font-semibold text-ink-soft" role="status">
                  {recorderT('recording', { seconds })}
                </p>
                <Button onClick={stop} variant="secondary">
                  <Square aria-hidden className="size-4" />
                  {recorderT('stop')}
                </Button>
              </>
            ) : previewUrl ? (
              <div className="flex w-full flex-col items-center gap-4">
                <audio className="w-full" controls src={previewUrl} />
                <FormError message={submitError} />
                <div className="flex flex-wrap justify-center gap-3">
                  <Button disabled={submitting} onClick={reset} variant="secondary">
                    {recorderT('reRecord')}
                  </Button>
                  <Button disabled={submitting} onClick={() => void handleSubmit()} variant="accent">
                    {submitting ? recorderT('uploading') : recorderT('submit')}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function DonePanel() {
  const t = useTranslations('voiceContribution.done');
  return (
    <section className="container-site py-10 sm:py-16">
      <div className="mx-auto max-w-xl rounded-[1.75rem] bg-paper p-6 text-center shadow-lift sm:p-8">
        <h1 className="text-3xl">{t('heading')}</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">{t('body')}</p>
      </div>
    </section>
  );
}
