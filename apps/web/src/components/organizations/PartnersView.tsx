import { useTranslations } from 'next-intl';

import { HospitalReach } from '@/components/art/HospitalReach';
import { partnerPlaceholders } from '@/content/home';
import { PageTemplate } from '@/components/ui/PageTemplate';
import { Section, SectionHeading } from '@/components/ui/Section';

/**
 * `/organizations/partners`. Reuses `partnerPlaceholders` and the
 * `home.partners` disclaimer copy verbatim rather than a second, near-
 * identical namespace — the homepage marquee and this dedicated directory
 * describe the exact same "no signed partners yet" state, and a duplicate
 * copy of that disclaimer would risk the two drifting apart.
 */
export function PartnersView() {
  const t = useTranslations('organizations.partners');
  const homePartners = useTranslations('home.partners');
  const cta = useTranslations('organizations.cta');
  const nav = useTranslations('nav');

  const hero = {
    eyebrow: nav('items.connectedPartners'),
    title: t('hero.title'),
    body: t('hero.body'),
    Art: HospitalReach,
    artPosition: 'start' as const,
  };

  const ctaProps = {
    id: 'partners-cta-heading',
    heading: cta('heading'),
    body: cta('body'),
    primaryCta: { href: '/contact', label: cta('primaryCta') },
    secondaryCta: { href: '/organizations/resource-center', label: cta('secondaryCta') },
  };

  return (
    <PageTemplate cta={ctaProps} hero={hero}>
      <Section labelledBy="partners-list-heading">
        <SectionHeading
          align="center"
          body={homePartners('body')}
          id="partners-list-heading"
          title={homePartners('heading')}
        />

        <span className="mx-auto mt-6 block w-fit rounded-pill bg-marigold-100 px-3 py-1 text-xs font-bold tracking-wide text-marigold-600 uppercase">
          {homePartners('placeholderNote')}
        </span>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {partnerPlaceholders.map((name) => (
            <li
              className="grid h-16 place-items-center rounded-xl border border-line bg-sand px-5 text-center text-sm font-semibold text-ink-soft"
              key={name}
            >
              {name}
            </li>
          ))}
        </ul>
      </Section>
    </PageTemplate>
  );
}
