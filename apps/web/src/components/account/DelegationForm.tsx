'use client';

import type { FormEvent } from 'react';
import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { DelegationGrant, DelegationScope } from '@swasthya/family';

import { Button } from '@/components/ui/Button';
import { earliestSelectableExpiryDate } from '@/lib/delegation-expiry';
import { createDelegation, FamilyApiError } from '@/lib/family-api';

const SCOPES: readonly DelegationScope[] = ['VIEW_RECORD', 'ASK_ASSISTANT', 'MANAGE_APPOINTMENTS', 'UPLOAD_DOCUMENTS'];

// The exact set `apps/api`'s `FamilyGrantsController`/`FamilyGrantsService`
// can return for this endpoint — every other `FamilyApiError.code` falls
// back to `errors.GENERIC`, the same convention `PhoneOtpFlow`'s
// `KNOWN_ERROR_CODES` established for the auth flow.
const KNOWN_ERROR_CODES = [
  'INVALID_PHONE',
  'DELEGATE_NOT_FOUND',
  'SelfDelegationError',
  'EmptyDelegationScopeError',
  'InvalidDelegationExpiryError',
  'VALIDATION_ERROR',
] as const;

/**
 * The first real caller of `POST /family/grants/delegations` — self-service
 * only (family-and-proxy.md §2's "she uses the app herself"), scoped
 * independently per `DelegationScope`, so booking someone's appointments
 * never has to also mean reading her mental-health notes. Assisted
 * enrolment (§3 — someone else recording consent obtained out of band) is
 * deliberately not built here; that needs its own witness/consent-method UI
 * and would misrepresent an in-app self-grant as something it is not if
 * bolted onto this form.
 *
 * `onCreated` lets the caller (`AccountView.tsx`) refresh
 * `useFamilyGrants`'s cached read after a successful grant — this form
 * itself never re-fetches the list, since nothing here reads it.
 */
export function DelegationForm({ onCreated }: { onCreated: () => void }) {
  const t = useTranslations('account.delegation');
  const errorsT = useTranslations('account.delegation.errors');
  const baseId = useId();

  const [phone, setPhone] = useState('');
  const [scopes, setScopes] = useState<DelegationScope[]>([]);
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<DelegationGrant | null>(null);

  function toggleScope(scope: DelegationScope, checked: boolean) {
    setCreated(null);
    setScopes((current) => (checked ? [...current, scope] : current.filter((existing) => existing !== scope)));
  }

  function localizedError(err: unknown): string {
    const code = err instanceof FamilyApiError ? err.code : null;
    const known = KNOWN_ERROR_CODES.find((candidate) => candidate === code);
    return errorsT(known ?? 'GENERIC');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // `<input type="date">` yields a bare `YYYY-MM-DD`; parsed as UTC
      // midnight of that day. `earliestSelectableExpiryDate` below keeps the
      // `min` attribute one day ahead of `now`, which is what actually keeps
      // this after `grantedAt` (the server sets that to its own request
      // time) — plain `min={today}` let a person pick a date that always
      // failed server-side validation.
      const grant = await createDelegation({ delegatePhone: phone, scopes, expiresAt: new Date(expiresAt).toISOString() });
      setCreated(grant);
      setPhone('');
      setScopes([]);
      setExpiresAt('');
      onCreated();
    } catch (err) {
      setError(localizedError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-sand/70 p-6 ring-1 ring-line">
      <div>
        <h2 className="text-xl font-bold text-ink">{t('heading')}</h2>
        <p className="mt-1 text-ink-soft">{t('body')}</p>
      </div>

      <form className="flex flex-col gap-5" onSubmit={(event) => void handleSubmit(event)}>
        <div className="flex flex-col gap-2">
          <label className="font-semibold text-ink" htmlFor={`${baseId}-phone`}>
            {t('phoneLabel')}
          </label>
          <input
            autoComplete="tel"
            className="rounded-xl border border-line bg-white px-4 py-3 text-ink placeholder:text-ink-soft/60"
            id={`${baseId}-phone`}
            inputMode="tel"
            onChange={(event) => setPhone(event.target.value)}
            placeholder={t('phonePlaceholder')}
            type="tel"
            value={phone}
          />
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="font-semibold text-ink">{t('scopesLabel')}</legend>
          {SCOPES.map((scope) => {
            const inputId = `${baseId}-scope-${scope}`;
            return (
              <label className="flex items-center gap-3" htmlFor={inputId} key={scope}>
                <input checked={scopes.includes(scope)} id={inputId} onChange={(event) => toggleScope(scope, event.target.checked)} type="checkbox" />
                <span className="text-ink-soft">{t(`scopes.${scope}`)}</span>
              </label>
            );
          })}
        </fieldset>

        <div className="flex flex-col gap-2">
          <label className="font-semibold text-ink" htmlFor={`${baseId}-expires`}>
            {t('expiresLabel')}
          </label>
          <input
            className="rounded-xl border border-line bg-white px-4 py-3 text-ink"
            id={`${baseId}-expires`}
            min={earliestSelectableExpiryDate(new Date())}
            onChange={(event) => {
              setCreated(null);
              setExpiresAt(event.target.value);
            }}
            type="date"
            value={expiresAt}
          />
        </div>

        {error ? (
          <p className="text-sm font-semibold text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        {created ? (
          <p className="text-sm font-semibold text-forest-700" role="status">
            {t('success')}
          </p>
        ) : null}

        <div>
          <Button disabled={submitting || phone.trim().length === 0 || scopes.length === 0 || expiresAt.trim().length === 0} type="submit" variant="secondary">
            {t('submitCta')}
          </Button>
        </div>
      </form>
    </div>
  );
}
