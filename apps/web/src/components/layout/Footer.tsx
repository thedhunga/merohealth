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

export function Footer() {
  const t = useTranslations('footer');
  const nav = useTranslations('nav');
  const brand = useTranslations('brand');
  const year = new Date().getFullYear();

  return (
    <footer className="bg-primary-800 text-primary-100">
      <div className="container-site py-16 md:py-20">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="flex flex-col gap-6 lg:col-span-3">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-bold tracking-[0.14em] text-white">
                {brand('nameLatin')}
              </span>
              <span className="text-lg font-semibold text-primary-200">मेरो स्वास्थ्य</span>
            </div>
            <p className="text-sm leading-relaxed text-balance">{brand('tagline')}</p>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold tracking-[0.12em] text-white uppercase">
                {t('headquarters')}
              </span>
              <p className="text-sm text-primary-200">{t('addressPlaceholder')}</p>
            </div>

            <LocaleSwitcher tone="light" />
          </div>

          <div className="grid gap-10 sm:grid-cols-2 lg:col-span-9 lg:grid-cols-5">
            {footerColumns.map((column) => (
              <div key={column.headingKey}>
                <h2 className="mb-4 text-xs font-bold tracking-[0.12em] text-white uppercase">
                  {t(`headings.${column.headingKey}`)}
                </h2>
                <ul className="flex flex-col gap-2.5">
                  {column.links.map((link) => (
                    <li key={`${link.key}-${link.href}`}>
                      <Link
                        className="text-sm text-primary-100 transition-colors hover:text-white"
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

        <div className="mt-14 flex flex-col gap-8 border-t border-white/15 pt-8">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold tracking-[0.12em] text-white uppercase">
                {t('downloadApp')}
              </span>
              <div className="flex flex-wrap gap-3">
                {/*
                  Store listings do not exist yet, so these point at the web
                  build of the Expo product surface rather than a dead link.
                */}
                <a
                  className="rounded-xl border border-white/25 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                  href="/app"
                >
                  App Store
                </a>
                <a
                  className="rounded-xl border border-white/25 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
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
              <ul className="flex items-center gap-2">
                {socials.map(({ key, href, Icon, label }) => (
                  <li key={key}>
                    <a
                      aria-label={label}
                      className="grid size-10 place-items-center rounded-full border border-white/25 text-white transition-colors hover:bg-white/10"
                      href={href}
                      rel="noreferrer noopener"
                      target="_blank"
                    >
                      <Icon aria-hidden className="size-4.5" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="rounded-xl bg-white/10 p-4 text-xs leading-relaxed text-primary-100">
            {t('demoNotice')}
          </p>

          <p className="text-xs text-primary-200">{t('copyright', { year })}</p>
        </div>
      </div>
    </footer>
  );
}
