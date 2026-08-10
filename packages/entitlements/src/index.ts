import type {
  ModuleKey,
  PlanDefinition,
  PlanTier,
  QuotaDimension,
  QuotaVerdict,
} from '@swasthya/shared-types';

/**
 * Plan catalogue.
 *
 * The tier boundary is deliberate: **bring-your-own storage is free, hosted
 * storage is paid**. When the file lives in the person's own Google Drive it
 * is client-encrypted and costs us nothing to keep, and "your data, your
 * storage" should not be behind a paywall. Hosted storage is where server-side
 * extraction, search and sharing become possible, so that is what people pay
 * for.
 *
 * Prices are in paisa (NPR × 100) so no float arithmetic touches money.
 */
export const plans: readonly PlanDefinition[] = [
  {
    tier: 'FREE',
    nameNe: 'निःशुल्क',
    nameEn: 'Free',
    descriptionNe:
      'नेपाली सहायक, आफ्नै ड्राइभमा राखिने स्वास्थ्य विवरण, र सेवा खोज्ने सुविधा।',
    descriptionEn:
      'The Nepali assistant, a health record kept in your own Drive, and care search.',
    modules: ['ASSISTANT', 'HEALTH_RECORD', 'BRING_YOUR_OWN_STORAGE', 'CARE_DIRECTORY'],
    limits: {
      DOCUMENTS_STORED: 25,
      EXTRACTION_PAGES_PER_MONTH: 10,
      ASSISTANT_MESSAGES_PER_MONTH: 50,
      ACTIVE_SHARE_LINKS: 1,
      CONNECTED_DEVICES: 1,
    },
    monthlyPricePaisa: 0,
  },
  {
    tier: 'PLUS',
    nameNe: 'प्लस',
    nameEn: 'Plus',
    descriptionNe:
      'हामीसँग सुरक्षित भण्डारण, कागजातबाट स्वतः विवरण निकाल्ने सुविधा, उपकरण जोड्ने र विवरण बाँड्ने सुविधा।',
    descriptionEn:
      'Secure hosted storage, automatic extraction from documents, device sync and record sharing.',
    modules: [
      'ASSISTANT',
      'HEALTH_RECORD',
      'BRING_YOUR_OWN_STORAGE',
      'CARE_DIRECTORY',
      'HOSTED_STORAGE',
      'DOCUMENT_EXTRACTION',
      'DEVICE_SYNC',
      'RECORD_SHARING',
    ],
    limits: {
      DOCUMENTS_STORED: 500,
      EXTRACTION_PAGES_PER_MONTH: 150,
      ASSISTANT_MESSAGES_PER_MONTH: 500,
      ACTIVE_SHARE_LINKS: 5,
      CONNECTED_DEVICES: 3,
    },
    monthlyPricePaisa: 49_900,
  },
  {
    tier: 'PRO',
    nameNe: 'प्रो',
    nameEn: 'Pro',
    descriptionNe:
      'असीमित विवरण, चिकित्सक र अस्पताललाई पठाउन मिल्ने निर्यात, र भिडियो परामर्श।',
    descriptionEn:
      'An unlimited record, provider-ready export for clinics and hospitals, and teleconsultation.',
    modules: [
      'ASSISTANT',
      'HEALTH_RECORD',
      'BRING_YOUR_OWN_STORAGE',
      'CARE_DIRECTORY',
      'HOSTED_STORAGE',
      'DOCUMENT_EXTRACTION',
      'DEVICE_SYNC',
      'RECORD_SHARING',
      'PROVIDER_EXPORT',
      'TELECONSULTATION',
    ],
    limits: {
      DOCUMENTS_STORED: null,
      EXTRACTION_PAGES_PER_MONTH: 1_000,
      ASSISTANT_MESSAGES_PER_MONTH: null,
      ACTIVE_SHARE_LINKS: 25,
      CONNECTED_DEVICES: 10,
    },
    monthlyPricePaisa: 149_900,
  },
];

/** Ascending order. Used to find the cheapest tier that unlocks something. */
const tierOrder: readonly PlanTier[] = ['FREE', 'PLUS', 'PRO'];

export function getPlan(tier: PlanTier): PlanDefinition {
  const plan = plans.find((candidate) => candidate.tier === tier);
  if (!plan) throw new Error(`Unknown plan tier: ${tier}`);
  return plan;
}

export function compareTiers(a: PlanTier, b: PlanTier): number {
  return tierOrder.indexOf(a) - tierOrder.indexOf(b);
}

export function hasModule(tier: PlanTier, module: ModuleKey): boolean {
  return getPlan(tier).modules.includes(module);
}

/** Cheapest tier that includes `module`, or null if no tier offers it. */
export function lowestTierWith(module: ModuleKey): PlanTier | null {
  for (const tier of tierOrder) {
    if (hasModule(tier, module)) return tier;
  }
  return null;
}

/**
 * Quota check for a metered dimension.
 *
 * Returns a verdict rather than throwing so callers can prompt an upgrade
 * instead of failing flat. Enforce this at the API boundary — a UI-only gate
 * is not a gate.
 */
export function checkQuota(
  tier: PlanTier,
  dimension: QuotaDimension,
  used: number,
): QuotaVerdict {
  const limit = getPlan(tier).limits[dimension];

  if (limit === null) {
    return { dimension, allowed: true, limit: null, used, remaining: null, upgradeTo: null };
  }

  const remaining = Math.max(0, limit - used);
  const allowed = used < limit;

  return {
    dimension,
    allowed,
    limit,
    used,
    remaining,
    upgradeTo: allowed ? null : nextTierWithHeadroom(tier, dimension, used),
  };
}

/** The cheapest higher tier whose limit for `dimension` still has room. */
function nextTierWithHeadroom(
  current: PlanTier,
  dimension: QuotaDimension,
  used: number,
): PlanTier | null {
  const startIndex = tierOrder.indexOf(current) + 1;

  for (const tier of tierOrder.slice(startIndex)) {
    const limit = getPlan(tier).limits[dimension];
    if (limit === null || used < limit) return tier;
  }

  return null;
}

export interface ModuleVerdict {
  module: ModuleKey;
  allowed: boolean;
  upgradeTo: PlanTier | null;
}

export function checkModule(tier: PlanTier, module: ModuleKey): ModuleVerdict {
  if (hasModule(tier, module)) {
    return { module, allowed: true, upgradeTo: null };
  }

  const required = lowestTierWith(module);
  // Only suggest an upgrade if the required tier is genuinely above this one.
  const upgradeTo = required && compareTiers(required, tier) > 0 ? required : null;

  return { module, allowed: false, upgradeTo };
}

/** Formats paisa as an NPR string, e.g. 49900 → "रु ४९९" / "Rs 499". */
export function formatPrice(paisa: number, language: 'ne' | 'en'): string {
  const rupees = Math.round(paisa / 100);
  if (language === 'en') return rupees === 0 ? 'Free' : `Rs ${rupees.toLocaleString('en-NP')}`;
  return rupees === 0 ? 'निःशुल्क' : `रु ${rupees.toLocaleString('ne-NP')}`;
}
