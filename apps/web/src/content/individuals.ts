import type { ComponentType } from 'react';

import { AroundTheClockCare } from '@/components/art/AroundTheClockCare';
import { CalmMind } from '@/components/art/CalmMind';
import { DiagnosticFocus } from '@/components/art/DiagnosticFocus';
import { HabitSprout } from '@/components/art/HabitSprout';
import { HomeFirstVisit } from '@/components/art/HomeFirstVisit';
import { VitalsTrend } from '@/components/art/VitalsTrend';

type Art = ComponentType<{ className?: string }>;
type PageImage = { src: string; objectPosition?: string };

/** A page with no sub-services: hero + three short highlights + the shared CTA band. */
export interface ConditionPage {
  kind: 'condition';
  /** Key into `nav.items` (title) and `individuals.<key>` (hero/highlights copy). */
  key: string;
  href: string;
  Art: Art;
  image?: PageImage;
  artPosition: 'start' | 'end';
  /** Ordered keys into `individuals.<key>.highlights.items`. */
  highlightKeys: readonly string[];
}

/** A page that only routes on to its own sub-services: hero + a `FeatureGrid` of children. */
export interface SegmentPage {
  kind: 'segment';
  key: string;
  href: string;
  Art: Art;
  image?: PageImage;
  artPosition: 'start' | 'end';
  children: ReadonlyArray<{ key: string; href: string; Art: Art }>;
}

export type IndividualsPage = ConditionPage | SegmentPage;

const HIGHLIGHT_KEYS = ['one', 'two', 'three'] as const;

/**
 * Every Individuals route, in the order the queue listed them. `weightManagement`
 * and `specialtyWellness` are segment pages (they only route on to their own
 * children); everything else is a condition page.
 */
export const individualsPages: readonly IndividualsPage[] = [
  {
    kind: 'condition',
    key: 'care247',
    href: '/individuals/24-7-care',
    Art: AroundTheClockCare,
    image: { src: '/imagery/care-247.webp' },
    artPosition: 'end',
    highlightKeys: HIGHLIGHT_KEYS,
  },
  {
    kind: 'condition',
    key: 'primaryCare',
    href: '/individuals/primary-care',
    Art: HomeFirstVisit,
    image: { src: '/imagery/primary-care.webp' },
    artPosition: 'start',
    highlightKeys: HIGHLIGHT_KEYS,
  },
  {
    kind: 'condition',
    key: 'mentalHealth',
    href: '/individuals/mental-health',
    Art: CalmMind,
    image: { src: '/imagery/mero-private-care.webp', objectPosition: '42% center' },
    artPosition: 'end',
    highlightKeys: HIGHLIGHT_KEYS,
  },
  {
    kind: 'segment',
    key: 'weightManagement',
    href: '/individuals/weight-management',
    Art: HabitSprout,
    artPosition: 'start',
    children: [
      { key: 'nutrition', href: '/individuals/weight-management/nutrition', Art: HabitSprout },
      {
        key: 'diabetesPrevention',
        href: '/individuals/weight-management/diabetes-prevention',
        Art: VitalsTrend,
      },
    ],
  },
  {
    kind: 'condition',
    key: 'diabetesManagement',
    href: '/individuals/diabetes-management',
    Art: VitalsTrend,
    artPosition: 'end',
    highlightKeys: HIGHLIGHT_KEYS,
  },
  {
    kind: 'condition',
    key: 'hypertensionManagement',
    href: '/individuals/hypertension-management',
    Art: VitalsTrend,
    artPosition: 'start',
    highlightKeys: HIGHLIGHT_KEYS,
  },
  {
    kind: 'segment',
    key: 'specialtyWellness',
    href: '/individuals/specialty-wellness',
    Art: DiagnosticFocus,
    artPosition: 'end',
    children: [
      {
        key: 'dermatology',
        href: '/individuals/specialty-wellness/dermatology',
        Art: DiagnosticFocus,
      },
      {
        key: 'expertMedicalOpinion',
        href: '/individuals/specialty-wellness/expert-medical-opinion',
        Art: DiagnosticFocus,
      },
      { key: 'sleep', href: '/individuals/specialty-wellness/sleep', Art: CalmMind },
    ],
  },
  {
    kind: 'condition',
    key: 'nutrition',
    href: '/individuals/weight-management/nutrition',
    Art: HabitSprout,
    image: { src: '/imagery/healthy-habits.webp' },
    artPosition: 'start',
    highlightKeys: HIGHLIGHT_KEYS,
  },
  {
    kind: 'condition',
    key: 'diabetesPrevention',
    href: '/individuals/weight-management/diabetes-prevention',
    Art: VitalsTrend,
    artPosition: 'end',
    highlightKeys: HIGHLIGHT_KEYS,
  },
  {
    kind: 'condition',
    key: 'dermatology',
    href: '/individuals/specialty-wellness/dermatology',
    Art: DiagnosticFocus,
    artPosition: 'start',
    highlightKeys: HIGHLIGHT_KEYS,
  },
  {
    kind: 'condition',
    key: 'expertMedicalOpinion',
    href: '/individuals/specialty-wellness/expert-medical-opinion',
    Art: DiagnosticFocus,
    artPosition: 'end',
    highlightKeys: HIGHLIGHT_KEYS,
  },
  {
    kind: 'condition',
    key: 'sleep',
    href: '/individuals/specialty-wellness/sleep',
    Art: CalmMind,
    artPosition: 'start',
    highlightKeys: HIGHLIGHT_KEYS,
  },
];

export function getIndividualsPage(key: string): IndividualsPage {
  const page = individualsPages.find((candidate) => candidate.key === key);
  if (!page) {
    throw new Error(`Unknown individuals page: ${key}`);
  }
  return page;
}
