import { useTranslations } from 'next-intl';

import { ButtonLink } from '@/components/ui/Button';
import { PageTemplate } from '@/components/ui/PageTemplate';
import { Section } from '@/components/ui/Section';
import type { HealthLibraryArticle } from '@/content/healthLibrary';

/**
 * Renders any `/health-library/<slug>` route from its `content/healthLibrary.ts`
 * entry, the same one-component-per-content-array pattern as
 * `IndividualsPageView`. The body is two short paragraphs rather than
 * `Highlights` — these are single-topic explainers, not a scannable list —
 * and closes with a `relatedPrompt` pointing at the existing page where this
 * article's fact was first established (`legal/privacy`, `individuals/faqs`
 * or `clinicians/commitment-to-quality`), so the article routes to something
 * real instead of a dead end.
 */
export function HealthLibraryArticleView({ article }: { article: HealthLibraryArticle }) {
  const t = useTranslations(`healthLibrary.articles.${article.key}`);
  const shared = useTranslations('healthLibrary');
  const nav = useTranslations('nav');

  const hero = {
    eyebrow: nav('items.healthLibrary'),
    title: t('title'),
    body: t('summary'),
    Art: article.Art,
    artPosition: article.artPosition,
  };

  const cta = {
    id: `${article.key}-cta-heading`,
    heading: shared('cta.heading'),
    body: shared('cta.body'),
    primaryCta: { href: '/register', label: shared('cta.primaryCta') },
    secondaryCta: { href: '/individuals/faqs', label: shared('cta.secondaryCta') },
  };

  return (
    <PageTemplate cta={cta} hero={hero}>
      <Section labelledBy={`${article.key}-body-heading`}>
        <h2 className="sr-only" id={`${article.key}-body-heading`}>
          {t('title')}
        </h2>
        <div className="mx-auto flex max-w-2xl flex-col gap-6 text-lg leading-relaxed text-ink-soft">
          <p>{t('body.paragraphOne')}</p>
          <p>{t('body.paragraphTwo')}</p>
        </div>
      </Section>

      <Section labelledBy={`${article.key}-related-heading`} tone="mint">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
          <h2 className="text-2xl font-bold text-ink" id={`${article.key}-related-heading`}>
            {t('relatedPrompt.heading')}
          </h2>
          <p className="text-lg leading-relaxed text-ink-soft">{t('relatedPrompt.body')}</p>
          <ButtonLink className="mt-1" href={article.relatedHref}>
            {nav(`items.${article.relatedNavKey}`)}
          </ButtonLink>
        </div>
      </Section>
    </PageTemplate>
  );
}
