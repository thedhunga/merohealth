import { useTranslations } from 'next-intl';

import { footerColumns } from '@/content/navigation';
import { Link } from '@/i18n/navigation';
import { LocaleSwitcher } from '@/components/layout/LocaleSwitcher';
import {
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  XIcon,
  YouTubeIcon,
} from '@/components/ui/SocialIcons';

const socials = [
  { key: 'facebook', href: 'https://facebook.com', Icon: FacebookIcon, label: 'Facebook' },
  { key: 'instagram', href: 'https://instagram.com', Icon: InstagramIcon, label: 'Instagram' },
  { key: 'linkedin', href: 'https://linkedin.com', Icon: LinkedInIcon, label: 'LinkedIn' },
  { key: 'youtube', href: 'https://youtube.com', Icon: YouTubeIcon, label: 'YouTube' },
  { key: 'x', href: 'https://x.com', Icon: XIcon, label: 'X' },
] as const;

// The four links a worried visitor most plausibly wants on a phone, one tap
// down from the legal line rather than buried in a column of eleven. The
// rest of `footerColumns` (product catalogue, company pages) is marketing
// content that belongs behind "थप", not in the always-visible set.
const quickLinks = [
  { key: 'helpCenter', href: '/help' },
  { key: 'contactUs', href: '/contact' },
  { key: 'privacy', href: '/legal/privacy' },
  { key: 'pricing', href: '/pricing' },
] as const;

export function Footer() {
  const t = useTranslations('footer');
  const nav = useTranslations('nav');
  const brand = useTranslations('brand');
  const year = new Date().getFullYear();

  const socialLinks = (
    <ul className="flex items-center gap-2">
      {socials.map(({ key, href, Icon, label }) => (
        <li key={key}>
          <a
            aria-label={label}
            className="grid size-11 place-items-center rounded-full border border-white/25 text-white transition-colors hover:bg-white/10"
            href={href}
            rel="noreferrer noopener"
            target="_blank"
          >
            <Icon aria-hidden className="size-4.5" />
          </a>
        </li>
      ))}
    </ul>
  );

  const columnsAccordion = (
    <div className="grid grid-cols-2 gap-x-6">
      {footerColumns.map((column) => (
        <details className="group border-b border-white/15 py-3" key={column.headingKey}>
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-xs font-bold tracking-[0.12em] text-white uppercase [&::-webkit-details-marker]:hidden">
            {t(`headings.${column.headingKey}`)}
            <span
              aria-hidden
              className="text-lg font-black text-white transition-transform group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <ul className="mt-3 hidden flex-col gap-2.5 group-open:flex">
            {column.links.map((link) => (
              <li key={`${link.key}-${link.href}`}>
                <Link
                  className="flex min-h-11 items-center text-sm text-indigo-100 transition-colors hover:text-white"
                  href={link.href}
                >
                  {nav(`items.${link.key}`)}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );

  return (
    <footer className="bg-indigo-900 text-indigo-100">
      <div className="container-site py-10 sm:py-16 md:py-20">
        {/*
          Below `sm` (the 375px phone the product is measured at) the owner's
          direction is: four links, language, social, legal line — everything
          else (brand tagline, address, download-app, the five-column nav
          catalogue) folds behind one "थप" disclosure instead of rendering
          open. That replaced a footer that alone was ~2100px of an 8978px
          homepage. `sm` and up render the original always-open layout below,
          unchanged — there's no mobile measurement motivating a change there.
        */}
        <div className="flex flex-col gap-6 sm:hidden">
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
            {quickLinks.map((link) => (
              <li key={link.key}>
                <Link
                  className="flex min-h-11 items-center text-sm font-semibold text-white"
                  href={link.href}
                >
                  {nav(`items.${link.key}`)}
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <LocaleSwitcher tone="light" />
            {socialLinks}
          </div>

          <details className="group border-t border-white/15 pt-4">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-xs font-bold tracking-[0.12em] text-white uppercase [&::-webkit-details-marker]:hidden">
              {t('more')}
              <span
                aria-hidden
                className="text-lg font-black transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <div className="mt-5 flex flex-col gap-8">
              <div className="flex flex-col gap-2">
                <span className="text-lg font-semibold text-indigo-200">मेरो स्वास्थ्य</span>
                <p className="text-sm leading-relaxed text-balance">{brand('tagline')}</p>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold tracking-[0.12em] text-white uppercase">
                  {t('headquarters')}
                </span>
                <p className="text-sm text-indigo-200">{t('addressPlaceholder')}</p>
              </div>

              {/*
                `/app` currently 404s in production (queue item B3 — the root
                `vercel.json` that publishes the Expo build there never runs
                because the Vercel project's Root Directory is `apps/web`).
                Left reachable here rather than removed, since that's a known
                issue for task B3 to fix, not this one.
              */}
              <div className="flex flex-col gap-3">
                <span className="text-xs font-bold tracking-[0.12em] text-white uppercase">
                  {t('downloadApp')}
                </span>
                <div className="flex flex-wrap gap-3">
                  <a
                    className="inline-flex min-h-11 items-center rounded-xl border border-white/25 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                    href="/app"
                  >
                    App Store
                  </a>
                  <a
                    className="inline-flex min-h-11 items-center rounded-xl border border-white/25 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                    href="/app"
                  >
                    Google Play
                  </a>
                </div>
              </div>

              {columnsAccordion}
            </div>
          </details>
        </div>

        <div className="hidden gap-8 sm:grid sm:gap-12 lg:grid-cols-12">
          <div className="flex flex-col gap-4 sm:gap-6 lg:col-span-3">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-bold tracking-[0.14em] text-white">
                {brand('nameLatin')}
              </span>
              <span className="text-lg font-semibold text-indigo-200">मेरो स्वास्थ्य</span>
            </div>
            <p className="text-sm leading-relaxed text-balance">{brand('tagline')}</p>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold tracking-[0.12em] text-white uppercase">
                {t('headquarters')}
              </span>
              <p className="text-sm text-indigo-200">{t('addressPlaceholder')}</p>
            </div>

            <LocaleSwitcher tone="light" />
          </div>

          <div className="lg:col-span-9">
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
              {footerColumns.map((column) => (
                <div key={column.headingKey}>
                  <h2 className="mb-4 text-xs font-bold tracking-[0.12em] text-white uppercase">
                    {t(`headings.${column.headingKey}`)}
                  </h2>
                  <ul className="flex flex-col gap-2.5">
                    {column.links.map((link) => (
                      <li key={`${link.key}-${link.href}`}>
                        <Link
                          className="flex min-h-11 items-center text-sm text-indigo-100 transition-colors hover:text-white"
                          href={link.href}
                        >
                          {nav(`items.${link.key}`)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-6 border-t border-white/15 pt-6 sm:mt-14 sm:gap-8 sm:pt-8">
          <div className="hidden flex-wrap items-center justify-between gap-6 sm:flex">
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold tracking-[0.12em] text-white uppercase">
                {t('downloadApp')}
              </span>
              <div className="flex flex-wrap gap-3">
                <a
                  className="inline-flex min-h-11 items-center rounded-xl border border-white/25 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                  href="/app"
                >
                  App Store
                </a>
                <a
                  className="inline-flex min-h-11 items-center rounded-xl border border-white/25 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                  href="/app"
                >
                  Google Play
                </a>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold tracking-[0.12em] text-white uppercase">
                {t('followUs')}
              </span>
              {socialLinks}
            </div>
          </div>

          <p className="rounded-xl bg-white/10 p-3 text-xs leading-relaxed text-indigo-100 sm:p-4">
            {t('demoNotice')}
          </p>

          <p className="text-xs text-indigo-200">{t('copyright', { year })}</p>
        </div>
      </div>
    </footer>
  );
}
