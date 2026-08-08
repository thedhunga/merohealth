'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Menu, X } from 'lucide-react';

import { navSegments } from '@/content/navigation';
import { usePathname } from '@/i18n/navigation';
import { ButtonLink } from '@/components/ui/Button';
import { Logo } from '@/components/layout/Logo';
import { LocaleSwitcher } from '@/components/layout/LocaleSwitcher';
import { MegaMenu } from '@/components/layout/MegaMenu';
import { MobileNav } from '@/components/layout/MobileNav';
import { cn } from '@/lib/cn';

/** Grace period so the pointer can cross the gap between trigger and panel. */
const CLOSE_DELAY_MS = 140;

export function Header() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const [openSegment, setOpenSegment] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headerRef = useRef<HTMLElement>(null);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      setOpenSegment(null);
    }, CLOSE_DELAY_MS);
  }, [cancelClose]);

  const closeAll = useCallback(() => {
    cancelClose();
    setOpenSegment(null);
    setMobileOpen(false);
  }, [cancelClose]);

  // Route changes should never leave a panel or the drawer hanging open.
  useEffect(() => {
    closeAll();
  }, [pathname, closeAll]);

  useEffect(() => cancelClose, [cancelClose]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAll();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) closeAll();
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [closeAll]);

  // Lock background scroll while the mobile drawer is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  const activeSegment = navSegments.find((segment) => segment.key === openSegment);

  return (
    <header
      className="sticky top-0 z-50 border-b border-line bg-white/95 backdrop-blur-sm"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) closeAll();
      }}
      onMouseLeave={scheduleClose}
      ref={headerRef}
    >
      <a
        className="sr-only rounded-md bg-forest-700 px-4 py-2 text-white focus:not-sr-only focus:absolute focus:start-4 focus:top-3 focus:z-10"
        href="#main"
      >
        {t('skipToContent')}
      </a>

      <div className="container-site flex h-20 items-center justify-between gap-4">
        <Logo />

        <nav aria-label={t('primaryLabel')} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {navSegments.map((segment) => {
              const expanded = openSegment === segment.key;
              const panelId = `mega-panel-${segment.key}`;

              return (
                <li key={segment.key}>
                  <button
                    aria-controls={panelId}
                    aria-expanded={expanded}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[0.9375rem] font-semibold transition-colors',
                      expanded ? 'bg-jade-50 text-forest-700' : 'text-ink hover:bg-sand',
                    )}
                    onClick={() => {
                      cancelClose();
                      setOpenSegment(expanded ? null : segment.key);
                    }}
                    onFocus={() => {
                      cancelClose();
                      setOpenSegment(segment.key);
                    }}
                    onMouseEnter={() => {
                      cancelClose();
                      setOpenSegment(segment.key);
                    }}
                    type="button"
                  >
                    {t(`segments.${segment.key}`)}
                    <ChevronDown
                      aria-hidden
                      className={cn('size-4 transition-transform', expanded && 'rotate-180')}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <LocaleSwitcher />
          <ButtonLink href="/signin" variant="ghost">
            {t('actions.signIn')}
          </ButtonLink>
          <ButtonLink href="/register" variant="primary">
            {t('actions.register')}
          </ButtonLink>
        </div>

        <button
          aria-controls="mobile-drawer"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? t('actions.closeMenu') : t('actions.openMenu')}
          className="grid size-11 place-items-center rounded-lg text-ink hover:bg-sand lg:hidden"
          onClick={() => {
            setMobileOpen((value) => !value);
          }}
          type="button"
        >
          {mobileOpen ? <X aria-hidden className="size-6" /> : <Menu aria-hidden className="size-6" />}
        </button>
      </div>

      {activeSegment ? (
        <div
          className="absolute inset-x-0 top-full hidden lg:block"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <MegaMenu
            onNavigate={closeAll}
            panelId={`mega-panel-${activeSegment.key}`}
            segment={activeSegment}
          />
        </div>
      ) : null}

      {mobileOpen ? (
        <div
          className="fixed inset-x-0 top-20 bottom-0 z-40 overflow-y-auto border-t border-line bg-white lg:hidden"
          id="mobile-drawer"
        >
          <div className="container-site pt-4">
            <MobileNav onNavigate={closeAll} />
          </div>
        </div>
      ) : null}
    </header>
  );
}
