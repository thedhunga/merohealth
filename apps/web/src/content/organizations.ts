/**
 * The three partner-type routes (employers, health plans, hospitals). Hero
 * art, title and body come from `organizationTabs` (content/home.ts) rather
 * than being duplicated here — the homepage tab panel and each dedicated
 * page describe the same organisation type and must not drift apart. This
 * only adds the anchored capability sections each mega-menu/footer child
 * link (`content/navigation.ts`) points at.
 */
export interface OrganizationPartnerPage {
  kind: 'partner';
  /** Matches an `organizationTabs` entry in `content/home.ts`. */
  key: 'healthPlans' | 'employers' | 'hospitals';
  href: string;
  artPosition: 'start' | 'end';
  /** Ordered anchor sections; `anchorId` matches the `#hash` in `content/navigation.ts`. */
  sections: ReadonlyArray<{ anchorId: string; navKey: string }>;
}

export const organizationPartnerPages: readonly OrganizationPartnerPage[] = [
  {
    kind: 'partner',
    key: 'employers',
    href: '/organizations/employers',
    artPosition: 'end',
    sections: [
      { anchorId: 'integrated-care', navKey: 'integratedCare' },
      { anchorId: 'always-on-care', navKey: 'care247Org' },
      { anchorId: 'chronic-care', navKey: 'chronicCare' },
    ],
  },
  {
    kind: 'partner',
    key: 'healthPlans',
    href: '/organizations/health-plans',
    artPosition: 'start',
    sections: [
      { anchorId: 'integrated-care', navKey: 'integratedCare' },
      { anchorId: 'chronic-care', navKey: 'chronicCare' },
    ],
  },
  {
    kind: 'partner',
    key: 'hospitals',
    href: '/organizations/hospitals-health-systems',
    artPosition: 'end',
    sections: [
      { anchorId: 'platform', navKey: 'virtualCarePlatform' },
      { anchorId: 'emergency', navKey: 'emergencyServices' },
      { anchorId: 'inpatient-outpatient', navKey: 'inpatientOutpatient' },
    ],
  },
];

export function getOrganizationPartnerPage(
  key: OrganizationPartnerPage['key'],
): OrganizationPartnerPage {
  const page = organizationPartnerPages.find((candidate) => candidate.key === key);
  if (!page) {
    throw new Error(`Unknown organization partner page: ${key}`);
  }
  return page;
}
