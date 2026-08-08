import type { ComponentType } from 'react';

import { AroundTheClockCare } from '@/components/art/AroundTheClockCare';
import { HomeFirstVisit } from '@/components/art/HomeFirstVisit';
import { RecordTransform } from '@/components/art/RecordTransform';

type Art = ComponentType<{ className?: string }>;

/**
 * One article. `key` indexes `healthLibrary.articles.<key>` for the
 * title/summary/body copy; `slug` is the URL segment under
 * `/health-library/<slug>`. `relatedHref` + `relatedNavKey` point back to the
 * existing page where this article's fact was first established, so the
 * article closes by routing to something real rather than a dead end.
 */
export interface HealthLibraryArticle {
  key: string;
  slug: string;
  Art: Art;
  artPosition: 'start' | 'end';
  relatedHref: string;
  /** Key into `nav.items` for the related-page link label. */
  relatedNavKey: string;
}

/**
 * A deliberately small set: each article restates one leg of the
 * storage/confirmed/safety triad `legal/privacy` already established as
 * "what's genuinely true today" (`PrivacyView`'s `PRINCIPLE_KEYS`), in
 * longer explainer voice, rather than inventing new topics this repo has no
 * source material for.
 */
export const healthLibraryArticles: readonly HealthLibraryArticle[] = [
  {
    key: 'storageChoice',
    slug: 'choosing-where-your-record-lives',
    Art: HomeFirstVisit,
    artPosition: 'start',
    relatedHref: '/legal/privacy',
    relatedNavKey: 'privacy',
  },
  {
    key: 'confirmedRecords',
    slug: 'why-nothing-is-used-until-you-confirm-it',
    Art: RecordTransform,
    artPosition: 'end',
    relatedHref: '/individuals/faqs',
    relatedNavKey: 'faqs',
  },
  {
    key: 'safetyCheck',
    slug: 'the-safety-check-before-every-answer',
    Art: AroundTheClockCare,
    artPosition: 'start',
    relatedHref: '/clinicians/commitment-to-quality',
    relatedNavKey: 'commitmentToQuality',
  },
];

export function getHealthLibraryArticle(slug: string): HealthLibraryArticle | undefined {
  return healthLibraryArticles.find((article) => article.slug === slug);
}
