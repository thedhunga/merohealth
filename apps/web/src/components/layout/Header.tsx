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
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useOptionalSession } from '@/hooks/useSession';
import { cn } from '@/lib/cn';

/** Grace period so the pointer can cross the gap between trigger and panel. */
const CLOSE_DELAY_MS = 140;

export function Header() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const session = useOptionalSession();
  const [openSegment, setOpenSegment] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);
  const mobileDrawerRef = useRef<HTMLDivElement>(null);

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

  // Modal behaviour for the drawer: trap Tab inside it, hide `main`/`footer`
  // from assistive tech while it covers them, and hand focus back to the
  // hamburger button on close rather than wherever it happens to drift.
  useFocusTrap(mobileDrawerRef, mobileOpen, { returnFocusRef: mobileToggleRef });

  const activeSegment = navSegments.find((segment) => segment.key === openSegment);

  return (
    <header
      // Forest chrome book-ends the paper content: the footer is already
      // `bg-indigo-900`, so the header matches it rather than the paler
      // `indigo-800` Hero panel underneath, keeping the two distinct.
      className="sticky top-0 z-50 bg-indigo-900 text-white"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) closeAll();
      }}
      onMouseLeave={scheduleClose}
      ref={headerRef}
    >
      <a
        className="sr-only inline-flex min-h-11 items-center rounded-md bg-white px-4 py-2 font-semibold text-indigo-800 focus:not-sr-only focus:absolute focus:start-4 focus:top-3 focus:z-10"
        href="#main"
      >
        {t('skipToContent')}
      </a>

      <div className="container-site flex h-20 items-center justify-between gap-4">
        <Logo tone="light" />

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
                      expanded
                        ? 'bg-white text-indigo-800'
                        : 'text-indigo-100 hover:bg-white/10 hover:text-white',
                    )}
                    onClick={() => {
                      // Not a toggle: `onFocus`/`onMouseEnter` already open the
                      // panel before a click can land, so a real click or an
                      // Enter/Space activation right after would immediately
                      // re-close it if this ever read stale `expanded` state.
                      // Escape, an outside click and blurring the header are
                      // already three separate ways to close it.
                      cancelClose();
                      setOpenSegment(segment.key);
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
          <LocaleSwitcher tone="light" />
          {session.status === 'authenticated' ? (
            <ButtonLink href="/account" variant="ghostOnDark">
              {t('actions.account')}
            </ButtonLink>
          ) : (
            <>
              <ButtonLink href="/signin" variant="ghostOnDark">
                {t('actions.signIn')}
              </ButtonLink>
              {/*
                `inverse`, not `accent`: Hero's primary CTA is already marigold
                and sits in the same viewport on the homepage, so a second
                marigold button here would spend the accent twice on one screen.
              */}
              <ButtonLink href="/register" variant="inverse">
                {t('actions.register')}
              </ButtonLink>
            </>
          )}
        </div>

        <button
          aria-controls="mobile-drawer"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? t('actions.closeMenu') : t('actions.openMenu')}
          className="grid size-11 place-items-center rounded-lg text-white hover:bg-white/10 lg:hidden"
          onClick={() => {
            setMobileOpen((value) => !value);
          }}
          ref={mobileToggleRef}
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
          aria-label={t('actions.menuLabel')}
          aria-modal="true"
          className="fixed inset-x-0 top-20 bottom-0 z-40 overflow-y-auto bg-paper shadow-menu lg:hidden"
          id="mobile-drawer"
          ref={mobileDrawerRef}
          role="dialog"
          tabIndex={-1}
        >
          <div className="container-site pt-4">
            <MobileNav onNavigate={closeAll} session={session} />
          </div>
        </div>
      ) : null}
    </header>
  );
}
