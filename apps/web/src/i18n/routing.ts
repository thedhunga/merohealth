import { defineRouting } from 'next-intl/routing';

export const locales = ['ne', 'en'] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: 'ne',
  // Nepali is the product's first language, so it is served from the bare
  // path (`/individuals`) and English is prefixed (`/en/individuals`).
  localePrefix: 'as-needed',
});
