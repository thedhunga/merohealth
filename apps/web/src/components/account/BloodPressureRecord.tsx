'use client';

import type { ChangeEvent } from 'react';
import { useEffect, useId, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { HealthObservation } from '@swasthya/shared-types';

import { Button } from '@/components/ui/Button';
import { type CapturedFile, EvidenceCapture } from '@/components/ui/EvidenceCapture';
import { FormError } from '@/components/ui/FormError';
import {
  captureBloodPressurePhoto,
  confirmObservation,
  fetchAllObservations,
  fetchDocumentObservations,
  rejectObservation,
} from '@/lib/records-api';
import { BloodPressureTrendChart } from './BloodPressureTrendChart';

type CaptureState =
  | { phase: 'idle' }
  | { phase: 'uploading' }
  | { phase: 'awaiting-confirmation'; drafts: readonly HealthObservation[] }
  | { phase: 'no-reading' }
  | { phase: 'extraction-pending' }
  | { phase: 'error' };

/**
 * Round four F4: photograph → record → trend, end to end, for blood
 * pressure — the one analyte this round wires all the way through, since
 * the hypertension page and the (decorative) cuff-loop imagery already
 * assume it. Owns the capture control, the draft-confirmation step and the
 * trend chart together because all three share one piece of state: the
 * confirmed observations the chart reads from only change once a draft is
 * actually confirmed here.
 *
 * Capture always runs extraction inline (`RecordsService.captureDocument`),
 * so the response already carries the outcome — no polling. `no-reading` and
 * `extraction-pending` are deliberately different messages: the first is a
 * definite "nothing legible in that photo", the second is the outage case
 * the task asks for by name — "the photo is stored, extraction will follow,
 * nothing is lost" — covering both "not configured yet" and "the provider
 * failed", since neither loses the document either way.
 */
export function BloodPressureRecord() {
  const t = useTranslations('account.bloodPressure');
  const locale = useLocale() as 'ne' | 'en';
  const baseId = useId();

  const [observations, setObservations] = useState<readonly HealthObservation[]>([]);
  const [evidence, setEvidence] = useState<CapturedFile | null>(null);
  const [capture, setCapture] = useState<CaptureState>({ phase: 'idle' });

  useEffect(() => {
    let cancelled = false;
    void fetchAllObservations().then((items) => {
      if (!cancelled && items) setObservations(items);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!evidence) return;
    return () => URL.revokeObjectURL(evidence.previewUrl);
  }, [evidence]);

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setEvidence({ file, previewUrl: URL.createObjectURL(file) });
    setCapture({ phase: 'idle' });
  }

  async function handleUpload() {
    if (!evidence) return;
    setCapture({ phase: 'uploading' });

    const document = await captureBloodPressurePhoto({ file: evidence.file, title: t('documentTitle') });
    setEvidence(null);

    if (!document) {
      setCapture({ phase: 'error' });
      return;
    }

    if (document.status === 'AWAITING_CONFIRMATION') {
      const drafts = await fetchDocumentObservations(document.id);
      setCapture(drafts && drafts.length > 0 ? { phase: 'awaiting-confirmation', drafts } : { phase: 'error' });
      return;
    }
    if (document.status === 'CONFIRMED') {
      setCapture({ phase: 'no-reading' });
      return;
    }
    // STORED (no extraction service wired) or EXTRACTION_FAILED (attempted and failed) —
    // the document is safe either way; only the message differs from a clean "nothing found".
    setCapture({ phase: 'extraction-pending' });
  }

  async function handleDecision(observationId: string, decision: 'confirm' | 'reject') {
    const ok = decision === 'confirm' ? await confirmObservation(observationId) : await rejectObservation(observationId);
    if (!ok) return;

    setCapture((prev) => {
      if (prev.phase !== 'awaiting-confirmation') return prev;
      const remaining = prev.drafts.filter((draft) => draft.id !== observationId);
      return remaining.length > 0 ? { phase: 'awaiting-confirmation', drafts: remaining } : { phase: 'idle' };
    });

    if (decision === 'confirm') {
      const refreshed = await fetchAllObservations();
      if (refreshed) setObservations(refreshed);
    }
  }

  return (
    <div className="flex flex-col gap-5 rounded-2xl bg-sand/70 p-6 ring-1 ring-line">
      <div>
        <h2 className="text-xl font-bold text-ink">{t('heading')}</h2>
        <p className="mt-1 text-ink-soft">{t('body')}</p>
      </div>

      <BloodPressureTrendChart observations={observations} />

      <div className="flex flex-col gap-3">
        <EvidenceCapture
          captured={evidence}
          changeLabel={t('evidence.changeFile')}
          chooseLabel={t('evidence.chooseFile')}
          hint={t('evidence.hint')}
          id={`${baseId}-evidence`}
          label={t('evidence.label')}
          onCapture={handleFile}
        />

        {evidence ? (
          <div>
            <Button disabled={capture.phase === 'uploading'} onClick={() => void handleUpload()} variant="secondary">
              {capture.phase === 'uploading' ? t('uploading') : t('uploadCta')}
            </Button>
          </div>
        ) : null}

        <FormError message={capture.phase === 'error' ? t('errors.generic') : null} />
        {capture.phase === 'no-reading' ? (
          <p className="rounded-xl bg-indigo-100 p-4 text-sm font-semibold text-indigo-800" role="status">
            {t('noReading')}
          </p>
        ) : null}
        {capture.phase === 'extraction-pending' ? (
          <p className="rounded-xl bg-indigo-100 p-4 text-sm font-semibold text-indigo-800" role="status">
            {t('extractionPending')}
          </p>
        ) : null}
      </div>

      {capture.phase === 'awaiting-confirmation' ? (
        <div className="flex flex-col gap-3">
          <p className="font-semibold text-ink">{t('confirmation.heading')}</p>
          <ul className="flex flex-col gap-3">
            {capture.drafts.map((draft) => (
              <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 ring-1 ring-line" key={draft.id}>
                <div>
                  <p className="font-semibold text-ink">{locale === 'ne' ? draft.labelNe : draft.labelEn}</p>
                  <p className="text-ink-soft">
                    {draft.value} {draft.unit}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => void handleDecision(draft.id, 'confirm')} variant="secondary">
                    {t('confirmation.confirmCta')}
                  </Button>
                  <button
                    className="inline-flex min-h-11 items-center px-3 text-sm text-ink-soft underline-offset-4 hover:underline"
                    onClick={() => void handleDecision(draft.id, 'reject')}
                    type="button"
                  >
                    {t('confirmation.rejectCta')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
