import { useTranslations } from 'next-intl';

import { HabitSprout } from '@/components/art/HabitSprout';
import { PageTemplate } from '@/components/ui/PageTemplate';
import { Section } from '@/components/ui/Section';

/**
 * `/legal/community-guidelines`. No feature exists yet where people interact
 * with each other on Mero Health — no forums, reviews or public profiles —
 * so drafting guidelines now would be governing a feature that doesn't
 * exist. Same honest-empty-state pattern as `LeadershipView`/`NewsroomView`,
 * reusing `HabitSprout`'s "still forming" metaphor a third time.
 */
export function CommunityGuidelinesView() {
  const t = useTranslations('legal.communityGuidelines');
  const nav = useTranslations('nav');

  const hero = {
    eyebrow: nav('items.communityGuidelines'),
    title: t('hero.title'),
    body: t('hero.body'),
    Art: HabitSprout,
    artPosition: 'end' as const,
    tone: 'paper' as const,
  };

  return (
    <PageTemplate hero={hero}>
      <Section labelledBy="community-guidelines-empty-heading">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-3 text-center">
          <h2 className="text-2xl font-bold text-ink" id="community-guidelines-empty-heading">
            {t('emptyState.heading')}
          </h2>
          <p className="text-lg leading-relaxed text-ink-soft">{t('emptyState.body')}</p>
        </div>
      </Section>
    </PageTemplate>
  );
}
