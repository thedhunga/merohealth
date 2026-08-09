'use client';

import { useTranslations } from 'next-intl';
import { ArrowRight, ChevronRight } from 'lucide-react';

import type { NavSegment } from '@/content/navigation';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

interface MegaMenuProps {
  segment: NavSegment;
  onNavigate: () => void;
  panelId: string;
}

export function MegaMenu({ segment, onNavigate, panelId }: MegaMenuProps) {
  const t = useTranslations('nav');
  const promo = t.raw(`promos.${segment.key}`) as {
    eyebrow: string;
    title: string;
    cta: string;
  };

  return (
    <div
      // Popped forward off the forest header, the same "white card on a dark
      // ground" language `OrganizationTabs` uses — no hairline border needed
      // since the colour change from the header is already the boundary.
      className="bg-white shadow-menu"
      id={panelId}
      // The panel is a region rather than a menu: it holds links, not commands.
      role="region"
    >
      <div className="container-site grid gap-10 py-10 lg:grid-cols-12 lg:gap-12">
        {segment.columns.map((column, index) => (
          <div
            className={cn(index === 0 ? 'lg:col-span-6' : 'lg:col-span-3')}
            key={column.headingKey}
          >
            {/*
              h3, not h2: this panel sits in the header, ahead of the page's
              own h1 in document order, and MobileNav's equivalent column
              heading is already h3 — matching keeps one screen-reader
              heading level for the same semantic content on both viewports.
            */}
            <h3 className="mb-5 text-xs font-bold tracking-[0.12em] text-ink-soft uppercase">
              {t(`headings.${column.headingKey}`)}
            </h3>

            <ul
              className={cn(
                'flex flex-col gap-1',
                index === 0 && 'sm:grid sm:grid-cols-2 sm:gap-x-8 sm:gap-y-1',
              )}
            >
              {column.items.map((item) => (
                <li key={`${item.key}-${item.href}`}>
                  <Link
                    className="group flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-[0.9375rem] font-semibold text-ink transition-colors hover:bg-jade-50 hover:text-forest-700"
                    href={item.href}
                    onClick={onNavigate}
                  >
                    {t(`items.${item.key}`)}
                    <ChevronRight
                      aria-hidden
                      className="size-4 shrink-0 text-jade-200 opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  </Link>

                  {item.children ? (
                    <ul className="mb-2 ms-3 flex flex-col gap-0.5 border-s border-line ps-3">
                      {item.children.map((child) => (
                        <li key={`${child.key}-${child.href}`}>
                          <Link
                            className="block rounded-md px-2 py-1.5 text-sm text-ink-soft transition-colors hover:text-forest-700"
                            href={child.href}
                            onClick={onNavigate}
                          >
                            {t(`items.${child.key}`)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="lg:col-span-3">
          <Link
            className="group flex h-full flex-col justify-between gap-6 rounded-card bg-linear-to-br from-jade-500 to-forest-700 p-6 text-white transition-transform hover:-translate-y-0.5"
            href={segment.promo.href}
            onClick={onNavigate}
          >
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold tracking-[0.12em] text-jade-200 uppercase">
                {promo.eyebrow}
              </span>
              <span className="text-xl leading-snug font-bold text-balance">{promo.title}</span>
            </div>
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-jade-100">
              {promo.cta}
              <ArrowRight
                aria-hidden
                className="size-4 transition-transform group-hover:translate-x-1"
              />
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
