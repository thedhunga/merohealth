import { getSafetyTemplate } from '@swasthya/clinical-safety';
import { getTranslations } from 'next-intl/server';

import type { Locale } from '@/i18n/routing';

/**
 * Round seven, task R (third bullet): what `public/sw.js` serves for any
 * navigation that fails while offline. Precached at install time (see the
 * service worker's own comment for how it captures this page's hashed
 * `/_next/static` chunks with no build-time manifest) — a plain server
 * component with no client-side JS of its own, deliberately.
 *
 * **Scope cut, and why.** The ledger's task also asks this page to show the
 * last saved conversation, which needs `localStorage` and so needs a client
 * component. Two attempts at that (a separate `'use client'` child, then
 * collapsing everything into one `'use client'` file) both left Turbopack
 * emitting at least one JS chunk this page's own rendered HTML never
 * references by a literal `<script src>` — Next's RSC streaming protocol
 * pushes some chunk references through inline `self.__next_f.push(...)`
 * data payloads instead, which the service worker's own HTML-scraping
 * precache (see its comment) has no way to see. Confirmed against a real
 * killed-server offline navigation both times: the chunk 404'd and the
 * card silently stayed empty. That failure mode — a card that quietly
 * never has anything to show — is exactly the kind of unreliable feature
 * this ledger's "invent no facts" spirit argues against shipping on a
 * health app's one emergency-information page. This is precisely the
 * problem a real build-time precache manifest (`@serwist/next`) solves;
 * see the service worker's own comment for why this repo doesn't have one.
 * Left as a documented gap rather than a broken feature — the emergency
 * guidance below, the one thing this page cannot afford to fail at, has no
 * such dependency and was verified working with the server genuinely
 * killed, not just network-emulated.
 */
export async function OfflineView({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'offline' });
  const safetyMessage = getSafetyTemplate('emergency-general-v1', locale === 'en' ? 'en' : 'ne');

  return (
    <section className="bg-paper py-12">
      <div className="container-site max-w-xl">
        <h1 className="text-2xl font-bold text-indigo-950">{t('heading')}</h1>
        <p className="mt-2 text-sm text-ink-soft">{t('body')}</p>

        {safetyMessage ? (
          <div className="mt-6 rounded-2xl bg-marigold-100/60 p-4 ring-1 ring-marigold-300">
            <p className="text-xs font-bold tracking-wide text-indigo-700 uppercase">{t('emergencyLabel')}</p>
            <p className="mt-1 text-sm text-ink">{safetyMessage}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
