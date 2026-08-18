'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { navSegments } from '@/content/navigation';
import { Link } from '@/i18n/navigation';
import { ButtonLink } from '@/components/ui/Button';
import { LocaleSwitcher } from '@/components/layout/LocaleSwitcher';
import type { OptionalSessionState } from '@/hooks/useSession';
import { cn } from '@/lib/cn';

export function MobileNav({
  onNavigate,
  session,
}: {
  onNavigate: () => void;
  session: OptionalSessionState;
}) {
  const t = useTranslations('nav');
  const [open, setOpen] = useState<string | null>(navSegments[0]?.key ?? null);

  return (
    <div className="flex flex-col gap-6 pb-10">
      <nav aria-label={t('primaryLabel')}>
        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {navSegments.map((segment) => {
            const expanded = open === segment.key;
            const panelId = `mobile-panel-${segment.key}`;

            return (
              <li key={segment.key}>
                <button
                  aria-controls={panelId}
                  aria-expanded={expanded}
                  className="flex w-full items-center justify-between gap-3 py-4 text-start text-lg font-bold text-ink"
                  onClick={() => {
                    setOpen(expanded ? null : segment.key);
                  }}
                  type="button"
                >
                  {t(`segments.${segment.key}`)}
                  <ChevronDown
                    aria-hidden
                    className={cn(
                      'size-5 shrink-0 text-ink-soft transition-transform',
                      expanded && 'rotate-180',
                    )}
                  />
                </button>

                <div className={cn('pb-4', !expanded && 'hidden')} id={panelId}>
                  {segment.columns.map((column) => (
                    <div className="mb-5 last:mb-0" key={column.headingKey}>
                      <h3 className="mb-2 text-xs font-bold tracking-[0.12em] text-ink-soft uppercase">
                        {t(`headings.${column.headingKey}`)}
                      </h3>
                      <ul className="flex flex-col">
                        {column.items.map((item) => (
                          <li key={`${item.key}-${item.href}`}>
                            <Link
                              className="flex min-h-11 items-center py-2 font-semibold text-ink"
                              href={item.href}
                              onClick={onNavigate}
                            >
                              {t(`items.${item.key}`)}
                            </Link>
                            {item.children ? (
                              <ul className="mb-1 ms-3 border-s border-line ps-3">
                                {item.children.map((child) => (
                                  <li key={`${child.key}-${child.href}`}>
                                    <Link
                                      className="flex min-h-11 items-center py-1.5 text-sm text-ink-soft"
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
                </div>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex flex-col gap-3">
        <ButtonLink href="/get-care" size="lg" variant="primary">
          {t('items.getCareNow')}
        </ButtonLink>
        {session.status === 'authenticated' ? (
          <ButtonLink href="/account" size="lg" variant="secondary">
            {t('actions.account')}
          </ButtonLink>
        ) : (
          <ButtonLink href="/signin" size="lg" variant="secondary">
            {t('actions.signIn')}
          </ButtonLink>
        )}
      </div>

      <LocaleSwitcher />
    </div>
  );
}
