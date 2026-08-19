'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { isDelegationActive, type DelegationGrant, type DelegationScope } from '@swasthya/family';

import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { FamilyApiError, revokeDelegation } from '@/lib/family-api';

const SCOPES: readonly DelegationScope[] = ['VIEW_RECORD', 'ASK_ASSISTANT', 'MANAGE_APPOINTMENTS', 'UPLOAD_DOCUMENTS'];

// The exact set `FamilyGrantsController.revokeDelegation` can return — same
// "everything else falls back to GENERIC" convention `DelegationForm`'s
// `KNOWN_ERROR_CODES` already established for this endpoint family.
const KNOWN_ERROR_CODES = ['DELEGATION_NOT_FOUND'] as const;

function statusKey(grant: DelegationGrant, now: string): 'active' | 'revoked' | 'expired' {
  if (grant.revokedAt !== null) return 'revoked';
  if (!isDelegationActive(grant, now)) return 'expired';
  return 'active';
}

/**
 * §2's other half of self-service delegation, now that `DELETE
 * /family/grants/delegations/:id` exists: the granter's own view of who she
 * has given access to, and the one action §2 requires work — revoking it.
 * `delegateId` is shown honestly as the raw id, not a fabricated name — the
 * same "an id shown honestly beats a name made up to look finished" call
 * `acting-subjects.ts`'s `buildActingSubjects` already made for the switcher,
 * because no lookup from a user id to a display name exists anywhere in this
 * app and inventing one here would be exactly the fabrication the standing
 * constraints rule out.
 *
 * Revoke is offered only on a grant `statusKey` reports `active` — revoking
 * an already-revoked or expired grant would still succeed (packages/family's
 * `revokeDelegation` is idempotent), but offering the action on a row that
 * already reads "revoked"/"expired" would suggest there is still something
 * to take back.
 */
export function DelegationsGrantedList({ grants, onRevoked }: { grants: readonly DelegationGrant[]; onRevoked: () => void }) {
  const t = useTranslations('account.delegation.granted');
  const errorsT = useTranslations('account.delegation.errors');
  const scopesT = useTranslations('account.delegation.scopes');
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRevoke(id: string) {
    setError(null);
    setRevokingId(id);
    try {
      await revokeDelegation(id);
      onRevoked();
    } catch (err) {
      const code = err instanceof FamilyApiError ? err.code : null;
      const known = KNOWN_ERROR_CODES.find((candidate) => candidate === code);
      setError(errorsT(known ?? 'GENERIC'));
    } finally {
      setRevokingId(null);
    }
  }

  if (grants.length === 0) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl bg-sand/70 p-6 ring-1 ring-line">
        <h2 className="text-xl font-bold text-ink">{t('heading')}</h2>
        <p className="text-ink-soft">{t('empty')}</p>
      </div>
    );
  }

  const now = new Date().toISOString();

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-sand/70 p-6 ring-1 ring-line">
      <h2 className="text-xl font-bold text-ink">{t('heading')}</h2>

      <FormError message={error} />

      <ul className="flex flex-col gap-3">
        {grants.map((grant) => {
          const status = statusKey(grant, now);
          return (
            <li className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4" key={grant.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-ink">
                  {t('delegateLabel')} {grant.delegateId}
                </span>
                <span className="text-sm font-semibold text-ink-soft">{t(`status.${status}`)}</span>
              </div>
              <p className="text-sm text-ink-soft">{SCOPES.filter((scope) => grant.scopes.includes(scope)).map((scope) => scopesT(scope)).join(', ')}</p>
              {status === 'active' ? (
                <div>
                  <Button disabled={revokingId === grant.id} onClick={() => void handleRevoke(grant.id)} variant="secondary">
                    {revokingId === grant.id ? t('revoking') : t('revokeCta')}
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
