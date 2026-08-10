import { defineRouting } from 'next-intl/routing';

export const locales = ['ne', 'en'] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: 'ne',
  // Nepali is the product's first language, so it is served from the bare
  // path (`/individuals`) and English is prefixed (`/en/individuals`).
  localePrefix: 'as-needed',
  // Off deliberately. Accept-Language negotiation would hand English to most
  // visitors — including Nepali speakers whose phones are set to en-US — which
  // defeats the point of being Nepali-first. English is a deliberate choice
  // via the switcher, not a guess made from a header.
  localeDetection: false,
});
