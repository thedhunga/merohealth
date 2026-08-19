'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  grantConsent,
  hasPurpose,
  optionalPurposes,
  revokeConsent,
  type ConsentGrant,
  type ConsentPurpose,
} from '@swasthya/language-corpus';

import { RecordTransform } from '@/components/art/RecordTransform';
import { ButtonLink } from '@/components/ui/Button';
import { PageTemplate } from '@/components/ui/PageTemplate';
import { Section, SectionHeading } from '@/components/ui/Section';
import { cn } from '@/lib/cn';
import { generateLocalId } from '@/lib/local-id';

type OptionalPurpose = Exclude<ConsentPurpose, 'SERVICE_DELIVERY'>;

// `optionalPurposes` excludes SERVICE_DELIVERY by construction, not by type
// (it is `readonly ConsentPurpose[]` at its source in `packages/language-corpus`)
// — this filter narrows it back to `OptionalPurpose` for a type-checked
// `PURPOSE_KEYS` lookup below, the same fix `apps/mobile`'s `app/consent.tsx`
// needed for the identical mismatch.
const isOptionalPurpose = (purpose: ConsentPurpose): purpose is OptionalPurpose => purpose !== 'SERVICE_DELIVERY';
const PURPOSES = optionalPurposes.filter(isOptionalPurpose);

const PURPOSE_KEYS: Record<OptionalPurpose, string> = {
  MODEL_TRAINING_TEXT: 'modelTrainingText',
  MODEL_TRAINING_VOICE: 'modelTrainingVoice',
  HUMAN_REVIEW: 'humanReview',
};

/**
 * `/legal/data-consent` — language-corpus.md §3's consent screen for
 * `apps/web`, the sibling of `apps/mobile`'s `app/consent.tsx`. Entirely
 * client-side state, the same "domain layer built, nothing to persist to
 * yet" shape `RegisterView` already established for `/clinicians/register`:
 * `apps/web` has no account/auth layer (see this ledger's standing note on
 * every `apps/api`-adjacent run touching owner scoping), so a grant made
 * here lives for the browser tab, not a real account. What matters today is
 * that toggling goes through `packages/language-corpus`'s own
 * `grantConsent`/`revokeConsent` — never a hand-rolled boolean — so the same
 * lifecycle rules apply here as everywhere else the package is used
 * (`revokedAt` set rather than the row deleted; a fresh row on re-grant
 * rather than reviving an old one) and wiring this to a real account later
 * is a storage change, not a logic rewrite.
 *
 * Each purpose is its own real `<input type="checkbox">` (§3's "separately
 * toggleable" read literally as native, independently operable controls,
 * not a single combined switch) — `legal.accessibility`'s own "native
 * controls where it matters" precedent, so the toggle is keyboard-operable
 * and announced as a checkbox without any custom ARIA role. `RecordTransform`
 * reused a fifth time, same as `legal.privacy` — this is still a page about
 * what happens to your data.
 */
export function DataConsentView() {
  const t = useTranslations('legal.dataConsent');
  const nav = useTranslations('nav');
  const companyCta = useTranslations('company.cta');
  const [ownerId] = useState(() => generateLocalId('owner'));
  const [grants, setGrants] = useState<ConsentGrant[]>([]);

  const hero = {
    eyebrow: nav('items.dataConsent'),
    title: t('hero.title'),
    body: t('hero.body'),
    Art: RecordTransform,
    artPosition: 'start' as const,
    tone: 'paper' as const,
  };

  const toggle = (purpose: OptionalPurpose, granted: boolean) => {
    const now = new Date().toISOString();
    setGrants((current) =>
      granted
        ? hasPurpose(current, purpose, now)
          ? current
          : [...current, grantConsent(purpose, ownerId, now)]
        : revokeConsent(current, purpose, now),
    );
  };

  return (
    <PageTemplate hero={hero}>
      <Section labelledBy="data-consent-purposes-heading">
        <SectionHeading
          align="center"
          body={t('guide')}
          id="data-consent-purposes-heading"
          title={t('purposesHeading')}
        />
        <ul className="mx-auto mt-12 flex max-w-2xl flex-col gap-6">
          {PURPOSES.map((purpose) => {
            const key = PURPOSE_KEYS[purpose];
            const checked = hasPurpose(grants, purpose, new Date().toISOString());
            const inputId = `consent-${key}`;
            const descId = `${inputId}-description`;

            return (
              <li
                className="flex flex-col gap-4 rounded-card border border-line bg-surface p-6 sm:flex-row sm:items-start sm:justify-between sm:gap-8"
                key={purpose}
              >
                <div className="flex-1">
                  <label className="text-lg font-bold text-ink" htmlFor={inputId}>
                    {t(`purposes.${key}.title`)}
                  </label>
                  <p className="mt-2 leading-relaxed text-ink-soft" id={descId}>
                    {t(`purposes.${key}.body`)}
                  </p>
                </div>
                <label className="flex shrink-0 cursor-pointer items-center gap-3 sm:pt-1" htmlFor={inputId}>
                  <span aria-hidden className="text-sm font-semibold text-ink-soft">
                    {checked ? t('onLabel') : t('offLabel')}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      'relative inline-flex h-7 w-12 items-center rounded-pill transition-colors',
                      checked ? 'bg-indigo-700' : 'bg-line',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block size-5 rounded-full bg-surface shadow transition-transform',
                        checked ? 'translate-x-6' : 'translate-x-1',
                      )}
                    />
                  </span>
                  <input
                    aria-describedby={descId}
                    checked={checked}
                    className="sr-only"
                    id={inputId}
                    onChange={(event) => toggle(purpose, event.target.checked)}
                    type="checkbox"
                  />
                </label>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section labelledBy="data-consent-contact-heading" tone="mint">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
          <h2 className="text-2xl font-bold text-ink" id="data-consent-contact-heading">
            {t('contactPrompt.heading')}
          </h2>
          <p className="text-lg leading-relaxed text-ink-soft">{t('contactPrompt.body')}</p>
          <ButtonLink className="mt-1" href="/contact">
            {companyCta('primaryCta')}
          </ButtonLink>
        </div>
      </Section>
    </PageTemplate>
  );
}
