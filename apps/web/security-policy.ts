export const SAME_ORIGIN_MEDIA_POLICY =
  'camera=(self), microphone=(self), geolocation=(), payment=()';

/**
 * Deliberately narrow — it restricts only the resource types that this
 * app's own code never legitimately needs to relax, and says nothing about
 * `script-src`, `style-src`, `img-src` or `connect-src`.
 *
 * That gap is not an oversight. Every route under `[locale]` is prerendered
 * static HTML (`generateStaticParams`, confirmed in `next build`'s own
 * output — the whole marketing site is `●`/`○`, none of it `ƒ`), and
 * restricting `script-src` for real would need one of two things this repo
 * doesn't have yet: a per-request nonce (which means reading `headers()`
 * somewhere every page shares, e.g. the root layout — and `headers()`
 * forces the *entire* route into dynamic, server-rendered-per-request mode,
 * trading away the static hosting this app's page-weight/LCP budget
 * depends on — see the `S`/`S′` tasks in `docs/product/agent-progress.md`);
 * or a build-time allowlist of every inline script's exact hash, which
 * Next's own App Router defeats on its own: every page ships an inline
 * `self.__next_f.push(...)` hydration script whose content is unique per
 * page and per build, so no static hash list could ever cover it, and
 * without a nonce there is no way to tell Next to sign its own script with
 * one. Both paths are real, and the nonce path is the standard one Next's
 * own CSP guide documents — but the static→dynamic trade-off is a product
 * call, not something to ship as a side effect of adding a header.
 *
 * What *is* here needs neither: `object-src`/`base-uri`/`form-action`/
 * `frame-ancestors` block plugin embeds, `<base>`-tag hijacking, and
 * cross-origin form hijacking without touching how any script or style
 * loads. Confirmed against this app's own code before shipping, not
 * assumed: no `<form>` anywhere in `apps/web/src` sets a native `action`
 * (every one is `onSubmit`-driven), and nothing calls `window.open`.
 */
export const SCOPED_CONTENT_SECURITY_POLICY =
  "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests";

/**
 * Two years, subdomains included. No `preload` directive: submitting a
 * domain to the browser preload list is a slow-to-reverse commitment (an
 * owner call, not one to make as a side effect of a header sweep) — this
 * header is what an owner would add `preload` to later, at
 * https://hstspreload.org, once ready to commit.
 */
export const STRICT_TRANSPORT_SECURITY = 'max-age=63072000; includeSubDomains';
