'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { RecordTransform } from '@/components/art/RecordTransform';
import { DelegationForm } from '@/components/account/DelegationForm';
import { DelegationsGrantedList } from '@/components/account/DelegationsGrantedList';
import { ProfileSwitcher } from '@/components/account/ProfileSwitcher';
import { Button, ButtonLink } from '@/components/ui/Button';
import { PageTemplate } from '@/components/ui/PageTemplate';
import { Section } from '@/components/ui/Section';
import { useRouter } from '@/i18n/navigation';
import { useFamilyGrants } from '@/hooks/useFamilyGrants';
import { useSession } from '@/hooks/useSession';
import { buildActingSubjects, resolveActingSubject } from '@/lib/acting-subjects';
import { logout } from '@/lib/auth-api';

const IDENTITY_HEADING_ID = 'account-identity-heading';

/**
 * Round two §D2: what `PhoneOtpFlow.tsx`'s success step now redirects into,
 * and the first screen on `apps/web` that shows anything specific to the
 * signed-in person rather than marketing content. Deliberately narrow —
 * identity, who this account may act as, and the one real way into the
 * actual product (`/app`, the Expo build D1 now serves) — because there is
 * no other real, non-fabricated content to put here yet. An empty dashboard
 * built only to hold a switcher would be the mistake the D2 ledger entry
 * itself warns against; this shows exactly what `GET /auth/me` and
 * `@swasthya/family` can honestly answer today and nothing more.
 */
export function AccountView() {
  const t = useTranslations('account');
  const router = useRouter();
  const session = useSession();
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const user = session.status === 'authenticated' ? session.user : null;
  const [familyGrants, refreshFamilyGrants] = useFamilyGrants(user !== null);

  const actingSubjects = useMemo(() => {
    if (!user) return [];
    // `GET /family/grants` now backs this — see `useFamilyGrants`'s own doc
    // comment for why `loading`/`error` both degrade to empty arrays rather
    // than blocking the rest of this page, which has real data regardless.
    const guardianships = familyGrants.status === 'loaded' ? familyGrants.grants.guardianships : [];
    const delegations = familyGrants.status === 'loaded' ? familyGrants.grants.delegations : [];
    return buildActingSubjects({ id: user.userId, displayName: t('switcher.self') }, guardianships, delegations, new Date().toISOString());
  }, [user, familyGrants, t]);

  const hero = {
    eyebrow: t('hero.eyebrow'),
    title: t('hero.title'),
    body: t('hero.body'),
    Art: RecordTransform,
    artPosition: 'end' as const,
  };

  // `useSession` redirects to `/signin` on anything other than a live
  // session, so this is the only other state ever visible here.
  if (!user) {
    return (
      <PageTemplate hero={hero}>
        <Section labelledBy={IDENTITY_HEADING_ID}>
          <p id={IDENTITY_HEADING_ID} role="status">
            {t('loading')}
          </p>
        </Section>
      </PageTemplate>
    );
  }

  // `user.userId` is always the SELF entry's id — `buildActingSubjects`
  // puts it first unconditionally — so this never throws on first render,
  // only ever on a genuinely unauthorised switch target afterwards.
  const activeSubject = resolveActingSubject(actingSubjects, activeSubjectId ?? user.userId);

  function handleSwitch(subjectId: string) {
    resolveActingSubject(actingSubjects, subjectId); // throws on an id outside the authorised list — see the function's own doc comment
    setActiveSubjectId(subjectId);
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      router.push('/signin');
    }
  }

  return (
    <PageTemplate hero={hero}>
      <Section labelledBy={IDENTITY_HEADING_ID}>
        <div className="flex flex-col gap-8">
          <ProfileSwitcher active={activeSubject} onSwitch={handleSwitch} subjects={actingSubjects} />

          <div className="flex flex-col gap-3 rounded-2xl bg-sand/70 p-6 ring-1 ring-line">
            <h2 className="text-xl font-bold text-ink" id={IDENTITY_HEADING_ID}>
              {t('identity.heading')}
            </h2>
            <p className="text-ink-soft">
              <span className="font-semibold text-ink">{t('identity.phoneLabel')}</span> {user.phone}
            </p>
            <p className="text-ink-soft">
              <span className="font-semibold text-ink">{t('identity.assuranceLabel')}</span>{' '}
              {t(`identity.assurance.${user.assuranceLevel}`)}
            </p>
          </div>

          <DelegationForm onCreated={refreshFamilyGrants} />

          <DelegationsGrantedList
            grants={familyGrants.status === 'loaded' ? familyGrants.grants.delegationsGranted : []}
            onRevoked={refreshFamilyGrants}
          />

          <div className="flex flex-col gap-4 rounded-2xl bg-forest-800 p-8 text-white md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold">{t('openApp.heading')}</h2>
              <p className="mt-1 text-jade-100">{t('openApp.body')}</p>
            </div>
            <ButtonLink external href="/app" variant="accent">
              {t('openApp.cta')}
            </ButtonLink>
          </div>

          <div>
            <Button disabled={signingOut} onClick={() => void handleSignOut()} variant="secondary">
              {t('signOut.cta')}
            </Button>
          </div>
        </div>
      </Section>
    </PageTemplate>
  );
}
