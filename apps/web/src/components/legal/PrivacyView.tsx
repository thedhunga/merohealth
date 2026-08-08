import { useTranslations } from 'next-intl';

import { RecordTransform } from '@/components/art/RecordTransform';
import { ButtonLink } from '@/components/ui/Button';
import { Highlights } from '@/components/ui/Highlights';
import { PageTemplate } from '@/components/ui/PageTemplate';
import { Section, SectionHeading } from '@/components/ui/Section';

const PRINCIPLE_KEYS = ['storage', 'confirmed', 'safety'] as const;

/**
 * `/legal/privacy` — the highest-risk copy in the Legal routes task. Not a
 * lawyer-drafted policy: `packages/configuration`'s `legalEntity` is still
 * `'Demonstration entity — configure before launch'`, so this states plainly
 * that no registered entity has issued a formal policy yet, then restates
 * three things that are genuinely already true about how the product
 * handles data — reusing the same facts `individuals.faqs` items three and
 * five and `company.about`'s highlights already established (client-
 * encrypted BYO storage, CONFIRMED/CORRECTED-only reasoning, the
 * deterministic safety check ahead of the model) — rather than drafting new
 * legal terms this build has no authority to issue. `RecordTransform` (a lab
 * report becoming a structured record) reused a third time for its direct
 * fit with "how your data is handled."
 */
export function PrivacyView() {
  const t = useTranslations('legal.privacy');
  const companyCta = useTranslations('company.cta');
  const nav = useTranslations('nav');

  const hero = {
    eyebrow: nav('items.privacy'),
    title: t('hero.title'),
    body: t('hero.body'),
    Art: RecordTransform,
    artPosition: 'start' as const,
    tone: 'paper' as const,
  };

  return (
    <PageTemplate hero={hero}>
      <Section labelledBy="privacy-principles-heading">
        <SectionHeading
          align="center"
          id="privacy-principles-heading"
          title={t('principlesHeading')}
        />
        <Highlights
          className="mt-12"
          items={PRINCIPLE_KEYS.map((key) => ({
            key,
            title: t(`highlights.items.${key}.title`),
            body: t(`highlights.items.${key}.body`),
          }))}
        />
      </Section>

      <Section labelledBy="privacy-contact-heading" tone="mint">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
          <h2 className="text-2xl font-bold text-ink" id="privacy-contact-heading">
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
