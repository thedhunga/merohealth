import { useTranslations } from 'next-intl';

import { CalmMind } from '@/components/art/CalmMind';
import { ButtonLink } from '@/components/ui/Button';
import { Highlights } from '@/components/ui/Highlights';
import { PageTemplate } from '@/components/ui/PageTemplate';
import { Section, SectionHeading } from '@/components/ui/Section';

const BUILT_KEYS = ['semantic', 'noTextAsImage', 'nativeControls'] as const;

/**
 * `/accessibility`. The ledger's own "Responsive audit" item is checked, but
 * "Accessibility pass: heading order, landmarks, focus traps in the mobile
 * drawer, contrast, and a keyboard walkthrough of the mega-menu" is still
 * unchecked — so this page says both things at once rather than claiming an
 * audit that hasn't happened. The three highlights are narrowly, verifiably
 * true today (semantic headings/landmarks throughout, `aria-hidden` art per
 * the art direction's "never render text as an image" rule, and `FaqList`'s
 * native `<details>`/`<summary>` disclosures) — deliberately narrower than a
 * blanket "fully accessible" claim, since the mega-menu keyboard walkthrough
 * specifically is the unfinished item. `CalmMind`'s first dedicated use
 * outside `mentalHealth`/`sleep` — "considered, unhurried" fits a page about
 * paying attention to how the product is built.
 */
export function AccessibilityView() {
  const t = useTranslations('legal.accessibility');
  const companyCta = useTranslations('company.cta');
  const nav = useTranslations('nav');

  const hero = {
    eyebrow: nav('items.accessibility'),
    title: t('hero.title'),
    body: t('hero.body'),
    Art: CalmMind,
    artPosition: 'start' as const,
    tone: 'paper' as const,
  };

  return (
    <PageTemplate hero={hero}>
      <Section labelledBy="accessibility-built-heading">
        <SectionHeading
          align="center"
          id="accessibility-built-heading"
          title={t('highlightsHeading')}
        />
        <Highlights
          className="mt-12"
          items={BUILT_KEYS.map((key) => ({
            key,
            title: t(`highlights.items.${key}.title`),
            body: t(`highlights.items.${key}.body`),
          }))}
        />
      </Section>

      <Section labelledBy="accessibility-outstanding-heading" tone="mint">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
          <h2 className="text-2xl font-bold text-ink" id="accessibility-outstanding-heading">
            {t('outstanding.heading')}
          </h2>
          <p className="text-lg leading-relaxed text-ink-soft">{t('outstanding.body')}</p>
          <ButtonLink className="mt-1" href="/contact">
            {companyCta('primaryCta')}
          </ButtonLink>
        </div>
      </Section>
    </PageTemplate>
  );
}
