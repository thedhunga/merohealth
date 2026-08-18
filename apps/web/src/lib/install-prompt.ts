/**
 * Round seven, task R (second bullet): "add to home screen" is the one PWA
 * signal a phone gives us for free, but Android and iOS hand it to us
 * differently — Android fires a cancelable `beforeinstallprompt` event we can
 * defer and replay from our own card; iOS Safari fires nothing at all and
 * only supports the manual Share → Add to Home Screen path, so the best we
 * can do there is show someone where to tap. Both branches share one
 * "dismissed forever" flag so the card never nags twice.
 */

export const INSTALL_DISMISSED_KEY = 'mero-health:install-dismissed';

export function isInstallDismissed(): boolean {
  try {
    return window.localStorage.getItem(INSTALL_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissInstall(): void {
  try {
    window.localStorage.setItem(INSTALL_DISMISSED_KEY, '1');
  } catch {
    // Quota or private mode: the card simply offers itself again next visit
    // — no worse than the dismiss button never having existed.
  }
}

/**
 * Which install path a device gets. Pure string matching, not a hook, so it
 * is testable against a literal user-agent string rather than a real
 * browser. `ipad` matches modern iPadOS Safari too, which now reports as
 * `Macintosh` unless "Request Mobile Website" is on — that particular case
 * is indistinguishable from real desktop Safari from the UA string alone,
 * and desktop Safari has no install path worth showing either, so both
 * correctly fall through to `'other'`.
 */
export function installPlatform(userAgent: string): 'ios' | 'android' | 'other' {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'other';
}

/**
 * True once the app is already running installed, on either platform's own
 * signal — never worth prompting someone who already has it on their home
 * screen. `matchMedia` covers Android/Chrome and desktop; iOS Safari never
 * sets `display-mode: standalone` and instead exposes the non-standard
 * `navigator.standalone` boolean, so both are checked.
 */
export function isRunningStandalone(env: {
  matchMedia?: ((query: string) => { matches: boolean }) | undefined;
  navigatorStandalone?: boolean | undefined;
} = {}): boolean {
  if (env.navigatorStandalone) return true;
  return env.matchMedia?.('(display-mode: standalone)').matches ?? false;
}
