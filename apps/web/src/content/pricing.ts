import { getPlan } from '@swasthya/entitlements';
import type { PlanTier, QuotaDimension } from '@swasthya/shared-types';

/**
 * Canonical module display order for the pricing comparison grid.
 *
 * Derived from the PRO plan's own module list rather than a second,
 * hand-maintained array: `packages/entitlements` already guarantees (and
 * tests) that a higher tier never drops a module a lower tier has, so PRO is
 * always the superset. Reading the order from the catalogue itself means a
 * module added to a plan shows up here without a second list to remember.
 */
export const PRICING_MODULE_ORDER = getPlan('PRO').modules;

/**
 * `QuotaDimension` is a union, not an array, so it has no natural order.
 * This is the one list on this page that isn't read out of the catalogue —
 * it only fixes a display order, never a limit value.
 */
export const PRICING_QUOTA_ORDER: readonly QuotaDimension[] = [
  'DOCUMENTS_STORED',
  'EXTRACTION_PAGES_PER_MONTH',
  'ASSISTANT_MESSAGES_PER_MONTH',
  'ACTIVE_SHARE_LINKS',
  'CONNECTED_DEVICES',
];

/** Mirrors `formatPrice`'s locale mapping in `@swasthya/entitlements`. */
export function formatQuotaValue(
  value: number | null,
  locale: 'ne' | 'en',
  unlimitedLabel: string,
): string {
  if (value === null) return unlimitedLabel;
  return value.toLocaleString(locale === 'ne' ? 'ne-NP' : 'en-NP');
}

/* ------------------------------------------------------------------ *
 * Freemium voice minutes — Round six §L.
 *
 * `docs/product/freemium-and-voice-corpus.md` §2 adds a second freemium axis
 * on top of the module catalogue above: how many minutes of duplex voice
 * conversation (Gemini Live) each tier gets. Prices and minute counts are the
 * owner's call, not ours to invent, so every value here is read from a
 * single build-time config sourced from public env vars and stays `null`
 * until the owner sets it in `apps/web/.env.example`. A later task renders
 * the "price soon" state for whichever of these is still unset — this file
 * only has to make "unset" a value callers can check for, never a guess.
 * ------------------------------------------------------------------ */

function readPositiveInt(envValue: string | undefined): number | null {
  if (!envValue) return null;
  const parsed = Number.parseInt(envValue, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export interface FreemiumVoiceTierConfig {
  /** Monthly price in whole NPR (not paisa — there is no fractional rupee tier price here). */
  priceNpr: number | null;
  minutesPerMonth: number | null;
}

export interface FreemiumVoiceConfig {
  trialMinutesFree: number | null;
  plus: FreemiumVoiceTierConfig;
  pro: FreemiumVoiceTierConfig;
}

export const FREEMIUM_VOICE_CONFIG: FreemiumVoiceConfig = {
  trialMinutesFree: readPositiveInt(process.env['NEXT_PUBLIC_TRIAL_MINUTES_FREE']),
  plus: {
    priceNpr: readPositiveInt(process.env['NEXT_PUBLIC_PRICE_PLUS_NPR']),
    minutesPerMonth: readPositiveInt(process.env['NEXT_PUBLIC_MINUTES_PLUS']),
  },
  pro: {
    priceNpr: readPositiveInt(process.env['NEXT_PUBLIC_PRICE_PRO_NPR']),
    minutesPerMonth: readPositiveInt(process.env['NEXT_PUBLIC_MINUTES_PRO']),
  },
};

/**
 * The `/pricing` cards need one voice-minutes figure per tier, not the whole
 * config shape — FREE shows the trial allowance, PLUS and PRO show their own
 * monthly minutes. Centralised here (rather than a switch in the component)
 * so the FREE↔trial mapping is defined once and covered by a test.
 */
export function getFreemiumVoiceMinutesForTier(tier: PlanTier): number | null {
  switch (tier) {
    case 'FREE':
      return FREEMIUM_VOICE_CONFIG.trialMinutesFree;
    case 'PLUS':
      return FREEMIUM_VOICE_CONFIG.plus.minutesPerMonth;
    case 'PRO':
      return FREEMIUM_VOICE_CONFIG.pro.minutesPerMonth;
  }
}

/** Named placeholders the ledger task calls out by name — all sourced from the one config above. */
export const TRIAL_MINUTES_FREE = FREEMIUM_VOICE_CONFIG.trialMinutesFree;
export const PRICE_PLUS_NPR = FREEMIUM_VOICE_CONFIG.plus.priceNpr;
export const MINUTES_PLUS = FREEMIUM_VOICE_CONFIG.plus.minutesPerMonth;
export const PRICE_PRO_NPR = FREEMIUM_VOICE_CONFIG.pro.priceNpr;
export const MINUTES_PRO = FREEMIUM_VOICE_CONFIG.pro.minutesPerMonth;

/**
 * NPR formatting for the freemium-voice prices above. Mirrors
 * `formatPrice`'s "रु"/"Rs" style in `@swasthya/entitlements` rather than
 * `Intl.NumberFormat`'s currency style, so a Plus/Pro card reads consistently
 * whichever pricing surface it sits next to. `priceSoonLabel` is supplied by
 * the caller (a translation) rather than hardcoded here, same as
 * `formatQuotaValue`'s `unlimitedLabel` above.
 */
export function formatFreemiumPriceNpr(
  priceNpr: number | null,
  locale: 'ne' | 'en',
  priceSoonLabel: string,
): string {
  if (priceNpr === null) return priceSoonLabel;
  const formatted = priceNpr.toLocaleString(locale === 'ne' ? 'ne-NP' : 'en-NP');
  return locale === 'ne' ? `रु ${formatted}` : `Rs ${formatted}`;
}

/**
 * Minute counts share the same "unset → placeholder label" shape as prices,
 * but the caller-supplied label differs by field (e.g. "मिनेट छिट्टै" for a
 * minutes allowance vs. "price soon" for a price), so this takes the same
 * two-argument shape as `formatQuotaValue` rather than assuming a unit.
 */
export function formatFreemiumMinutes(
  minutes: number | null,
  locale: 'ne' | 'en',
  unsetLabel: string,
): string {
  if (minutes === null) return unsetLabel;
  return minutes.toLocaleString(locale === 'ne' ? 'ne-NP' : 'en-NP');
}
