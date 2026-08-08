import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { HealthLibraryArticleView } from '@/components/health-library/HealthLibraryArticleView';
import { getHealthLibraryArticle, healthLibraryArticles } from '@/content/healthLibrary';

// Runs once per locale already enumerated by the parent [locale] segment's
// own generateStaticParams — returning only `slug` here is the documented
// Next.js pattern for a dynamic segment nested under another dynamic segment.
export function generateStaticParams() {
  return healthLibraryArticles.map((article) => ({ slug: article.slug }));
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
