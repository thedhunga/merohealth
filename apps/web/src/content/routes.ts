import { healthLibraryArticles } from '@/content/healthLibrary';
import { individualsPages } from '@/content/individuals';
import { organizationPartnerPages } from '@/content/organizations';

/**
 * `pathname` is locale-less (e.g. `/pricing`); `titleKey`/`descriptionKey`
 * are dot-paths into `messages/<locale>.json`, always pointing at copy the
 * page already renders rather than a second SEO-only sentence.
 */
export interface RouteEntry {
  pathname: string;
  titleKey: string;
  descriptionKey: string;
}

/**
 * Routes whose title/description live in a shared content array already —
 * reused here instead of re-listing the same fifteen individuals routes,
 * three organisation-type routes and three health-library slugs a second
 * time, which is exactly the kind of second list that drifts out of sync
 * with the first.
 */
const individualsRoutes: RouteEntry[] = individualsPages.map((page) => ({
  pathname: page.href,
  titleKey: `individuals.${page.key}.hero.title`,
  descriptionKey: `individuals.${page.key}.hero.body`,
}));

const organizationPartnerRoutes: RouteEntry[] = organizationPartnerPages.map((page) => ({
  pathname: page.href,
  // Hero copy for these three lives in `home.organizations.tabs`, not under
  // `organizations.<key>` — see content/organizations.ts's own doc comment.
  titleKey: `home.organizations.tabs.${page.key}.title`,
  descriptionKey: `home.organizations.tabs.${page.key}.body`,
}));

const healthLibraryRoutes: RouteEntry[] = healthLibraryArticles.map((article) => ({
  pathname: `/health-library/${article.slug}`,
  titleKey: `healthLibrary.articles.${article.key}.title`,
  descriptionKey: `healthLibrary.articles.${article.key}.summary`,
}));

/** Every route with no shared content array to derive title/description from. */
const bespokeRoutes: RouteEntry[] = [
  { pathname: '/', titleKey: 'home.hero.title', descriptionKey: 'home.hero.body' },
  { pathname: '/pricing', titleKey: 'pricing.hero.title', descriptionKey: 'pricing.hero.body' },
  {
    pathname: '/individuals/how-it-works',
    titleKey: 'individuals.howItWorks.hero.title',
    descriptionKey: 'individuals.howItWorks.hero.body',
  },
  {
    pathname: '/individuals/without-insurance',
    titleKey: 'individuals.withoutInsurance.hero.title',
    descriptionKey: 'individuals.withoutInsurance.hero.body',
  },
  {
    pathname: '/individuals/faqs',
    titleKey: 'individuals.faqs.hero.title',
    descriptionKey: 'individuals.faqs.hero.body',
  },
  {
    pathname: '/organizations/our-approach',
    titleKey: 'organizations.ourApproach.hero.title',
    descriptionKey: 'organizations.ourApproach.hero.body',
  },
  {
    pathname: '/organizations/partners',
    titleKey: 'organizations.partners.hero.title',
    descriptionKey: 'organizations.partners.hero.body',
  },
  {
    pathname: '/organizations/resource-center',
    titleKey: 'organizations.resourceCenter.hero.title',
    descriptionKey: 'organizations.resourceCenter.hero.body',
  },
  {
    pathname: '/organizations/events',
    titleKey: 'organizations.events.hero.title',
    descriptionKey: 'organizations.events.hero.body',
  },
  {
    pathname: '/clinicians/our-providers',
    titleKey: 'clinicians.ourProviders.hero.title',
    descriptionKey: 'clinicians.ourProviders.hero.body',
  },
  {
    pathname: '/clinicians/clinical-leadership',
    titleKey: 'clinicians.clinicalLeadership.hero.title',
    descriptionKey: 'clinicians.clinicalLeadership.hero.body',
  },
  {
    pathname: '/clinicians/careers',
    titleKey: 'clinicians.careers.hero.title',
    descriptionKey: 'clinicians.careers.hero.body',
  },
  {
    pathname: '/clinicians/commitment-to-quality',
    titleKey: 'clinicians.commitmentToQuality.hero.title',
    descriptionKey: 'clinicians.commitmentToQuality.hero.body',
  },
  { pathname: '/about', titleKey: 'company.about.hero.title', descriptionKey: 'company.about.hero.body' },
  {
    pathname: '/about/impact',
    titleKey: 'company.impact.hero.title',
    descriptionKey: 'company.impact.hero.body',
  },
  {
    pathname: '/about/leadership',
    titleKey: 'company.leadership.hero.title',
    descriptionKey: 'company.leadership.hero.body',
  },
  {
    pathname: '/careers',
    titleKey: 'company.careers.hero.title',
    descriptionKey: 'company.careers.hero.body',
  },
  {
    pathname: '/newsroom',
    titleKey: 'company.newsroom.hero.title',
    descriptionKey: 'company.newsroom.hero.body',
  },
  {
    pathname: '/contact',
    titleKey: 'company.contact.hero.title',
    descriptionKey: 'company.contact.hero.body',
  },
  { pathname: '/legal', titleKey: 'legal.index.hero.title', descriptionKey: 'legal.index.hero.body' },
  {
    pathname: '/legal/privacy',
    titleKey: 'legal.privacy.hero.title',
    descriptionKey: 'legal.privacy.hero.body',
  },
  {
    pathname: '/legal/community-guidelines',
    titleKey: 'legal.communityGuidelines.hero.title',
    descriptionKey: 'legal.communityGuidelines.hero.body',
  },
  {
    pathname: '/accessibility',
    titleKey: 'legal.accessibility.hero.title',
    descriptionKey: 'legal.accessibility.hero.body',
  },
  { pathname: '/help', titleKey: 'legal.help.hero.title', descriptionKey: 'legal.help.hero.body' },
  {
    pathname: '/health-library',
    titleKey: 'healthLibrary.hero.title',
    descriptionKey: 'healthLibrary.hero.body',
  },
];

/**
 * Every statically-known route in `apps/web`, one entry each — the single
 * source both `sitemap.ts` and every page's `generateMetadata` read from, so
 * a route can't exist in one without the other noticing.
 */
export const routeEntries: readonly RouteEntry[] = [
  ...bespokeRoutes,
  ...individualsRoutes,
  ...organizationPartnerRoutes,
  ...healthLibraryRoutes,
];

export function getRouteEntry(pathname: string): RouteEntry {
  const entry = routeEntries.find((candidate) => candidate.pathname === pathname);
  if (!entry) {
    throw new Error(`No SEO metadata registered for route: ${pathname}`);
  }
  return entry;
}
