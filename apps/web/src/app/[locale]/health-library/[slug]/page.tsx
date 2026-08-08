import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { HealthLibraryArticleView } from '@/components/health-library/HealthLibraryArticleView';
import { getHealthLibraryArticle, healthLibraryArticles } from '@/content/healthLibrary';
import { getRouteEntry } from '@/content/routes';
import { buildPageMetadata } from '@/lib/seo';

// Runs once per locale already enumerated by the parent [locale] segment's
// own generateStaticParams — returning only `slug` here is the documented
// Next.js pattern for a dynamic segment nested under another dynamic segment.
export function generateStaticParams() {
  return healthLibraryArticles.map((article) => ({ slug: article.slug }));
}

// Reads the same registry entry `sitemap.ts` uses for this slug, rather than
// a titleKey computed a second way — an unknown slug returns no metadata at
// all and falls through to the page's own `notFound()` below.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const article = getHealthLibraryArticle(slug);
  if (!article) {
    return {};
  }

  const pathname = `/health-library/${article.slug}`;
  const { titleKey, descriptionKey } = getRouteEntry(pathname);
  return buildPageMetadata({ locale, pathname, titleKey, descriptionKey });
}

export default async function HealthLibraryArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const article = getHealthLibraryArticle(slug);
  if (!article) {
    notFound();
  }

  return <HealthLibraryArticleView article={article} />;
}
