'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Share, SquarePlus, X } from 'lucide-react';

import { dismissInstall, installPlatform, isInstallDismissed, isRunningStandalone } from '@/lib/install-prompt';

/**
 * The `beforeinstallprompt` event Chrome fires on Android. Not in
 * `lib.dom.d.ts` — Chrome-only and never standardised — so it is typed by
 * hand from the parts this component actually calls.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Round seven, task R (second bullet). Rendered by `GetCareFlow` once the
 * person has a second real answer — enough conversations that "keep this on
 * your phone" is a genuine offer, not a first-visit interruption. `show`
 * only says the *moment* is right; this component still decides on its own
 * whether there is anything to actually show — nothing renders once
 * dismissed, already installed, or on a platform with no install path at
 * all (desktop browsers, in-app webviews without `beforeinstallprompt`).
 *
 * The `beforeinstallprompt` listener is attached unconditionally on mount
 * (not gated behind `show`) because Chrome fires it once, early, and a
 * listener added after the fact never sees it — `GetCareFlow` is exactly
 * where the "second answer" engagement signal lives, so mounting this here
 * rather than higher in the tree still catches it comfortably before that
 * point in a real conversation.
 */
export function InstallPrompt({ show, onDismissed }: { show: boolean; onDismissed: () => void }) {
  const t = useTranslations('getCare.installPrompt');
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');
  const [standalone, setStandalone] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    setPlatform(installPlatform(navigator.userAgent));
    setStandalone(
      isRunningStandalone({
        matchMedia: window.matchMedia?.bind(window),
        navigatorStandalone: (navigator as Navigator & { standalone?: boolean }).standalone,
      }),
    );

    const onBeforeInstallPrompt = (event: Event) => {
      // Stops Chrome's own mini-infobar so only this card offers install —
      // one calm ask, not two competing ones.
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  if (!show || standalone || isInstallDismissed()) return null;
  if (platform === 'other') return null;
  if (platform === 'android' && !deferred) return null;

  const dismiss = () => {
    dismissInstall();
    onDismissed();
  };

  const install = async () => {
    if (!deferred) return;
    // The captured event is single-use regardless of the outcome — clearing
    // it here is what makes the `android && !deferred` guard above hide the
    // card again once someone has actually answered the browser's dialog.
    setDeferred(null);
    await deferred.prompt();
    await deferred.userChoice;
  };

  return (
    // `theme-pin-light`: see `EarlyAccessCard.tsx`'s identical card for why.
    <div className="theme-pin-light mt-4 flex flex-col gap-3 rounded-2xl border border-marigold-300 bg-marigold-100/60 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex-1">
        <p className="text-sm font-semibold text-ink">{t('heading')}</p>
        {platform === 'android' ? (
          <p className="mt-0.5 text-xs text-ink-soft">{t('androidBody')}</p>
        ) : (
          <div className="mt-2 space-y-1.5 text-xs text-ink-soft">
            <p>{t('iosBody')}</p>
            <p className="flex items-center gap-1.5">
              <Share aria-hidden className="size-4 shrink-0" />
              {t('iosStep1')}
            </p>
            <p className="flex items-center gap-1.5">
              <SquarePlus aria-hidden className="size-4 shrink-0" />
              {t('iosStep2')}
            </p>
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {platform === 'android' ? (
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-pill bg-indigo-800 px-4 text-sm font-bold text-white hover:bg-indigo-700"
            onClick={() => void install()}
            type="button"
          >
            {t('androidCta')}
          </button>
        ) : null}
        <button
          aria-label={t('dismiss')}
          className="grid size-11 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-white/70"
          onClick={dismiss}
          type="button"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  );
}
