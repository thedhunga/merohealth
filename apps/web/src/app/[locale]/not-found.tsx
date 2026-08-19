import type { Metadata } from 'next';

import { NotFoundView } from '@/components/layout/NotFoundView';

/**
 * Catches an explicit `notFound()` call from a page inside a valid locale
 * segment — e.g. `health-library/[slug]/page.tsx` on an unknown slug. See
 * `NotFoundView`'s own doc comment for why this exists.
 *
 * **What this deliberately does not cover, verified empirically against a
 * production build (curl, not assumed):** a genuinely unmatched path with
 * no route file at all anywhere in the tree — `/en/some-typo-nobody-wrote`
 * — never enters `[locale]/layout.tsx` in the first place (Next can't
 * resolve a layout chain for a path with no matching page), so it can't
 * reach this file either; it falls straight through to Next's own
 * unstyled, English-only default. A bad locale segment itself (`/xx/foo`)
 * hits the same fallback, for the same reason (`[locale]/layout.tsx`
 * throws `notFound()` before `<html>` renders, so the parent boundary must
 * catch it, and there is no parent boundary here).
 *
 * A root `app/not-found.tsx` looks like the fix for both gaps, and this
 * repo has no root `app/layout.tsx` to conflict with one — but a first
 * attempt at exactly that (this same run) proved empirically dead: even
 * with a working root `not-found.tsx` file wired correctly into Next's own
 * route manifest (confirmed by inspecting the compiled chunk), a clean
 * `pnpm build` still served Next's stock default for every unmatched-path
 * case above. Root cause not fully chased down — plausibly Next.js's
 * App Router requires an actual root `layout.tsx` to render *any* custom
 * root boundary for a request that never matched a route file, as opposed
 * to a `notFound()` thrown from within an already-matched tree, which is a
 * different internal code path. Adding a root `layout.tsx` would fix it,
 * but `[locale]/layout.tsx` already renders `<html>`/`<body>` for every
 * real route, so a second one at the true root would double them up for
 * the entire site — a much bigger, riskier change than this file, and not
 * something to take on inside a "fix the 404 page" task. Left as a known,
 * documented gap for whoever next has the scope to restructure the root
 * layout deliberately, not by accident chasing a 404 page.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function NotFoundPage() {
  return <NotFoundView />;
}
