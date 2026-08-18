'use client';

import { forwardRef, type ComponentProps } from 'react';
import { flushSync } from 'react-dom';
import { createNavigation } from 'next-intl/navigation';

import { runWithViewTransition } from '@/lib/view-transition';
import { routing } from './routing';

const navigation = createNavigation(routing);

export const { redirect, permanentRedirect, usePathname, getPathname } = navigation;

function viewTransitionEnv() {
  return {
    document: typeof document === 'undefined' ? undefined : document,
    matchMedia: typeof window === 'undefined' ? undefined : window.matchMedia?.bind(window),
    flushSync,
  };
}

/**
 * `next-intl`'s `useRouter`, with `push`/`replace` wrapped in the native
 * View Transitions API — Round seven task Q, second box. Every internal
 * navigation goes through this one hook or `Link` below (nothing in
 * `apps/web` imports `next/link` or `next-intl/navigation` directly), so
 * wrapping it here is enough to cover route changes site-wide without
 * touching each call site. `back`/`forward`/`refresh`/`prefetch` pass
 * through unchanged — they're not the "old page → new page" case this task
 * is about. Falls back to an ordinary, un-animated navigation wherever the
 * API is unsupported or `prefers-reduced-motion` is set; see
 * `runWithViewTransition`.
 */
export function useRouter(): ReturnType<typeof navigation.useRouter> {
  const router = navigation.useRouter();

  return {
    ...router,
    push: (href, options) => {
      runWithViewTransition(() => router.push(href, options), viewTransitionEnv());
    },
    replace: (href, options) => {
      runWithViewTransition(() => router.replace(href, options), viewTransitionEnv());
    },
  };
}

const BaseLink = navigation.Link;
type LinkProps = ComponentProps<typeof BaseLink>;
type NavigateEvent = Parameters<NonNullable<LinkProps['onNavigate']>>[0];

/**
 * `next-intl`'s `Link`, routed through the wrapped `useRouter` above so a
 * tapped link gets the same view transition as a programmatic navigation
 * (the mic-hero's push to `/get-care`, sign-in redirects). `onNavigate` —
 * unlike `onClick` — fires only for genuine same-origin client-side
 * navigations: Next has already ruled out modifier-clicks, external URLs
 * and downloads by the time it runs, so `preventDefault()` here can safely
 * hand every remaining case to `useRouter` without re-deriving any of that
 * itself.
 */
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, locale, replace, scroll, onNavigate, ...rest },
  ref,
) {
  const router = useRouter();

  return (
    <BaseLink
      {...rest}
      href={href}
      locale={locale}
      replace={replace}
      scroll={scroll}
      ref={ref}
      onNavigate={(event: NavigateEvent) => {
        // `NavigateEvent` only exposes `preventDefault()`, not a
        // `defaultPrevented` getter, so the caller's own `onNavigate` is
        // wrapped to record whether it actually called it.
        let prevented = false;
        onNavigate?.({
          preventDefault: () => {
            prevented = true;
            event.preventDefault();
          },
        });
        if (prevented) return;
        event.preventDefault();
        const navigate = replace ? router.replace : router.push;
        // `exactOptionalPropertyTypes` rejects `{ scroll: undefined }` —
        // the key has to be absent, not present-but-undefined — so build the
        // options object from only the props actually given.
        const options: Parameters<typeof router.push>[1] = {};
        if (locale !== undefined) options.locale = locale;
        if (scroll !== undefined) options.scroll = scroll;
        navigate(href as Parameters<typeof router.push>[0], options);
      }}
    />
  );
});
Link.displayName = 'Link';
