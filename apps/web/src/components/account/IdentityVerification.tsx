'use client';

import type { ChangeEvent } from 'react';
import { useEffect, useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { IdentityDocumentType, VerificationRequest } from '@swasthya/shared-types';

import { Button } from '@/components/ui/Button';
import { type CapturedFile, EvidenceCapture } from '@/components/ui/EvidenceCapture';
import { FormError } from '@/components/ui/FormError';
import { getMyVerification, IdentityApiError, submitIdentityEvidence } from '@/lib/identity-api';

const DOCUMENT_TYPES: readonly IdentityDocumentType[] = ['NATIONAL_ID', 'CITIZENSHIP', 'PASSPORT', 'DRIVING_LICENCE'];

// The exact set `IdentityController.submit` can return for this route.
// `VerificationTransitionError` is the one domain error `IdentityService.submit`
// maps to a 400 — see that method's own doc comment. Every other code falls
// back to `errors.GENERIC`, the same convention `DelegationForm`'s
// `KNOWN_ERROR_CODES` established.
const KNOWN_ERROR_CODES = ['VALIDATION_ERROR', 'VerificationTransitionError'] as const;

type LoadState = { status: 'loading' } | { status: 'loaded'; request: VerificationRequest } | { status: 'error' };

/**
 * `/account`'s call to action for identity-and-credentialing.md §2's second
 * assurance rung: `RECORD_SHARING`/`TELECONSULTATION` require
 * `IDENTITY_VERIFIED`, and since the 2026-08-13 `apps/api/src/identity/`
 * build that rung is only reachable by a reviewer approving evidence
 * submitted against `POST /identity/verification/evidence` — a route no
 * `apps/web`/`apps/mobile` UI had ever called. `AccountView.tsx` mounts this
 * only while the signed-in visitor's own `assuranceLevel` is still
 * `REGISTERED`; once it reads `IDENTITY_VERIFIED` there is nothing left for
 * this component to do.
 *
 * Never shown to gate signup itself — identity-and-credentialing.md §1's "a
 * national ID is never required to sign up" already holds by construction
 * here, since this only ever renders on the already-authenticated account
 * page, well after registration.
 */
export function IdentityVerification() {
  const t = useTranslations('account.identityVerification');
  const errorsT = useTranslations('account.identityVerification.errors');
  const baseId = useId();

  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [documentType, setDocumentType] = useState<IdentityDocumentType | null>(null);
  const [evidence, setEvidence] = useState<CapturedFile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyVerification()
      .then((request) => {
        if (!cancelled) setLoad({ status: 'loaded', request });
      })
      .catch(() => {
        if (!cancelled) setLoad({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Revokes the *previous* object URL whenever the field is replaced or the
  // component unmounts — the same pattern `RegisterView.tsx` uses for its own
  // two capture fields.
  useEffect(() => {
    if (!evidence) return;
    return () => URL.revokeObjectURL(evidence.previewUrl);
  }, [evidence]);

  function captureEvidence(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setEvidence({ file, previewUrl: URL.createObjectURL(file) });
  }

  function localizedError(err: unknown): string {
    const code = err instanceof IdentityApiError ? err.code : null;
    const known = KNOWN_ERROR_CODES.find((candidate) => candidate === code);
    return errorsT(known ?? 'GENERIC');
  }

  async function handleSubmit() {
    if (!documentType || !evidence) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      // `local-file:` marks this as a reference to a file that only ever
      // lived in this browser tab, not a real uploaded object —
      // `packages/identity` has no evidence-storage adapter yet, the same
      // still-open gap `RegisterView.tsx`'s own submission already notes.
      const request = await submitIdentityEvidence({
        documentType,
        evidenceImageRef: `local-file:${evidence.file.name}`,
      });
      setLoad({ status: 'loaded', request });
      setDocumentType(null);
      setEvidence(null);
    } catch (err) {
      setSubmitError(localizedError(err));
    } finally {
      setSubmitting(false);
    }
  }

  // A failed status fetch degrades to showing nothing rather than a broken
  // form — the same "never blocks the rest of the page" convention
  // `useFamilyGrants` documents for its own `error` state. `loading` is the
  // one other transient state with no form to show yet.
  if (load.status === 'loading' || load.status === 'error') return null;

  const { request } = load;
  const canSubmit = (request.status === 'NOT_STARTED' || request.status === 'REJECTED') && !submitting;

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-sand/70 p-6 ring-1 ring-line">
      <div>
        <h2 className="text-xl font-bold text-ink">{t('heading')}</h2>
        <p className="mt-1 text-ink-soft">{t('body')}</p>
      </div>

      {request.status === 'EVIDENCE_SUBMITTED' || request.status === 'UNDER_REVIEW' ? (
        <p className="rounded-xl bg-indigo-100 p-4 text-sm font-semibold text-indigo-800" role="status">
          {t('status.pending')}
        </p>
      ) : null}

      {request.status === 'APPROVED' ? (
        <p className="rounded-xl bg-indigo-100 p-4 text-sm font-semibold text-success-700" role="status">
          {t('status.approved')}
        </p>
      ) : null}

      {request.status === 'REJECTED' ? (
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700" role="alert">
          {t('status.rejected', { reason: request.rejectionReason ?? '' })}
        </p>
      ) : null}

      {canSubmit ? (
        <div className="flex flex-col gap-5">
          <fieldset className="flex flex-col gap-3">
            <legend className="font-semibold text-ink">{t('documentTypeLabel')}</legend>
            {DOCUMENT_TYPES.map((type) => {
              const optionId = `${baseId}-document-${type}`;
              return (
                <label className="flex items-center gap-3" htmlFor={optionId} key={type}>
                  <input
                    checked={documentType === type}
                    id={optionId}
                    name="documentType"
                    onChange={() => setDocumentType(type)}
                    type="radio"
                    value={type}
                  />
                  <span className="text-ink-soft">{t(`documentTypes.${type}`)}</span>
                </label>
              );
            })}
          </fieldset>

          <EvidenceCapture
            captured={evidence}
            changeLabel={t('evidence.changeFile')}
            chooseLabel={t('evidence.chooseFile')}
            hint={t('evidence.hint')}
            id={`${baseId}-evidence`}
            label={t('evidence.label')}
            onCapture={captureEvidence}
          />

          <FormError message={submitError} />

          <div>
            <Button
              disabled={submitting || !documentType || !evidence}
              onClick={() => void handleSubmit()}
              variant="secondary"
            >
              {request.status === 'REJECTED' ? t('resubmitCta') : t('submitCta')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
