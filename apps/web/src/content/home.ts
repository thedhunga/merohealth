import {
  Activity,
  Brain,
  HeartPulse,
  Salad,
  ScanLine,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react';

export interface ServiceCard {
  /** Key into `home.services.items` */
  key: string;
  href: string;
  Icon: LucideIcon;
  /** Tailwind classes for the card's icon chip. */
  tone: string;
  /** Optional sub-links, keyed into `nav.items`. */
  links?: Array<{ key: string; href: string }>;
}

export const serviceCards: readonly ServiceCard[] = [
  {
    key: 'care247',
    href: '/individuals/24-7-care',
    Icon: Stethoscope,
    tone: 'bg-primary-100 text-primary-700',
  },
  {
    key: 'primaryCare',
    href: '/individuals/primary-care',
    Icon: HeartPulse,
    tone: 'bg-info-100 text-info-700',
  },
  {
    key: 'mentalHealth',
    href: '/individuals/mental-health',
    Icon: Brain,
    tone: 'bg-saffron-100 text-saffron-600',
  },
  {
    key: 'conditionManagement',
    href: '/individuals/diabetes-management',
    Icon: Activity,
    tone: 'bg-primary-100 text-primary-700',
    links: [
      { key: 'diabetesManagement', href: '/individuals/diabetes-management' },
      { key: 'weightManagement', href: '/individuals/weight-management' },
      { key: 'hypertensionManagement', href: '/individuals/hypertension-management' },
    ],
  },
  {
    key: 'specialtyCare',
    href: '/individuals/specialty-wellness',
    Icon: ScanLine,
    tone: 'bg-info-100 text-info-700',
    links: [
      { key: 'dermatology', href: '/individuals/specialty-wellness/dermatology' },
      {
        key: 'expertMedicalOpinion',
        href: '/individuals/specialty-wellness/expert-medical-opinion',
      },
    ],
  },
  {
    key: 'healthyHabits',
    href: '/individuals/weight-management/nutrition',
    Icon: Salad,
    tone: 'bg-saffron-100 text-saffron-600',
    links: [
      { key: 'nutrition', href: '/individuals/weight-management/nutrition' },
      { key: 'sleep', href: '/individuals/specialty-wellness/sleep' },
    ],
  },
];

export interface OrganizationTab {
  /** Key into `home.organizations.tabs` */
  key: string;
  href: string;
  image: string;
  /**
   * Illustrative figures for the demonstration build.
   *
   * These are NOT verified claims. Every value must be replaced with a
   * substantiated figure, or the section removed, before publication — see the
   * demonstration notice in the footer.
   */
  stats: ReadonlyArray<{ value: string; labelNe: string; labelEn: string }>;
}

export const organizationTabs: readonly OrganizationTab[] = [
  {
    key: 'healthPlans',
    href: '/organizations/health-plans',
    image: '/imagery/mero-health-companion.webp',
    stats: [
      {
        value: '—',
        labelNe: 'साझेदार बीमा योजना (प्रकाशन अघि प्रमाणित गर्नुपर्ने)',
        labelEn: 'Partner health plans (to be substantiated before launch)',
      },
      {
        value: '—',
        labelNe: 'पहुँच भएका सदस्य (प्रकाशन अघि प्रमाणित गर्नुपर्ने)',
        labelEn: 'Members with access (to be substantiated before launch)',
      },
    ],
  },
  {
    key: 'employers',
    href: '/organizations/employers',
    image: '/imagery/nepali-care-team.webp',
    stats: [
      {
        value: '—',
        labelNe: 'साझेदार रोजगारदाता (प्रकाशन अघि प्रमाणित गर्नुपर्ने)',
        labelEn: 'Partner employers (to be substantiated before launch)',
      },
      {
        value: '—',
        labelNe: 'कर्मचारी सन्तुष्टि (प्रकाशन अघि प्रमाणित गर्नुपर्ने)',
        labelEn: 'Employee satisfaction (to be substantiated before launch)',
      },
    ],
  },
  {
    key: 'hospitals',
    href: '/organizations/hospitals-health-systems',
    image: '/imagery/digital-health-body.webp',
    stats: [
      {
        value: '—',
        labelNe: 'साझेदार अस्पताल (प्रकाशन अघि प्रमाणित गर्नुपर्ने)',
        labelEn: 'Partner hospitals (to be substantiated before launch)',
      },
      {
        value: '—',
        labelNe: 'सेवा पुगेका जिल्ला (प्रकाशन अघि प्रमाणित गर्नुपर्ने)',
        labelEn: 'Districts reached (to be substantiated before launch)',
      },
    ],
  },
];

/** Fictional demonstration testimonials. Keys index `home.testimonials.items`. */
export const testimonialKeys = ['sabina', 'raju', 'mina', 'prakash'] as const;

/**
 * Placeholder partner names.
 *
 * Deliberately generic and clearly fictional. Real partner and insurer
 * listings require signed agreements before they may appear.
 */
export const partnerPlaceholders = [
  'Demo Health Plan',
  'Demo District Hospital',
  'Demo Polyclinic',
  'Demo Diagnostics',
  'Demo Community Care',
  'Demo Employer Group',
  'Demo Pharmacy Network',
  'Demo Teaching Hospital',
] as const;
