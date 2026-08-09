/**
 * Site information architecture.
 *
 * This is the single source of truth for the header mega-menu, the mobile
 * drawer and the footer. Structure and hrefs live here; every user-visible
 * string is a key into `messages/<locale>.json` under the `nav` namespace.
 */

export interface MegaMenuItem {
  /** Key into `nav.items` */
  key: string;
  href: string;
  /** Optional short line rendered under the label in the mega-menu */
  descriptionKey?: string;
  children?: Array<{ key: string; href: string }>;
  /** Renders the item as a call-to-action pill rather than a plain link */
  emphasis?: boolean;
}

export interface MegaMenuColumn {
  /** Key into `nav.headings` */
  headingKey: string;
  items: MegaMenuItem[];
}

export interface NavSegment {
  /** Key into `nav.segments` */
  key: string;
  href: string;
  columns: MegaMenuColumn[];
  promo: {
    /** Keys into `nav.promos.<key>` for `.title` and `.cta` */
    key: string;
    href: string;
  };
}

export const navSegments: NavSegment[] = [
  {
    key: 'individuals',
    href: '/individuals',
    columns: [
      {
        headingKey: 'waysWeHelp',
        items: [
          {
            key: 'care247',
            href: '/individuals/24-7-care',
            children: [{ key: 'getCareNow', href: '/get-care' }],
          },
          { key: 'primaryCare', href: '/individuals/primary-care' },
          { key: 'mentalHealth', href: '/individuals/mental-health' },
          {
            key: 'weightManagement',
            href: '/individuals/weight-management',
            children: [
              { key: 'nutrition', href: '/individuals/weight-management/nutrition' },
              {
                key: 'diabetesPrevention',
                href: '/individuals/weight-management/diabetes-prevention',
              },
            ],
          },
          { key: 'diabetesManagement', href: '/individuals/diabetes-management' },
          { key: 'hypertensionManagement', href: '/individuals/hypertension-management' },
          {
            key: 'specialtyWellness',
            href: '/individuals/specialty-wellness',
            children: [
              { key: 'dermatology', href: '/individuals/specialty-wellness/dermatology' },
              {
                key: 'expertMedicalOpinion',
                href: '/individuals/specialty-wellness/expert-medical-opinion',
              },
              { key: 'sleep', href: '/individuals/specialty-wellness/sleep' },
            ],
          },
        ],
      },
      {
        headingKey: 'explore',
        items: [
          { key: 'withoutInsurance', href: '/individuals/without-insurance' },
          { key: 'howItWorks', href: '/individuals/how-it-works' },
          { key: 'faqs', href: '/individuals/faqs' },
          { key: 'pricing', href: '/pricing' },
          { key: 'aboutUs', href: '/about' },
          { key: 'ourImpact', href: '/about/impact' },
          { key: 'healthLibrary', href: '/health-library' },
          { key: 'contactUs', href: '/contact' },
        ],
      },
    ],
    promo: { key: 'individuals', href: '/individuals/specialty-wellness/sleep' },
  },
  {
    key: 'organizations',
    href: '/organizations',
    columns: [
      {
        headingKey: 'partners',
        items: [
          {
            key: 'employers',
            href: '/organizations/employers',
            children: [
              { key: 'integratedCare', href: '/organizations/employers#integrated-care' },
              { key: 'care247Org', href: '/organizations/employers#always-on-care' },
              { key: 'chronicCare', href: '/organizations/employers#chronic-care' },
            ],
          },
          {
            key: 'healthPlans',
            href: '/organizations/health-plans',
            children: [
              { key: 'integratedCare', href: '/organizations/health-plans#integrated-care' },
              { key: 'chronicCare', href: '/organizations/health-plans#chronic-care' },
            ],
          },
          {
            key: 'hospitals',
            href: '/organizations/hospitals-health-systems',
            children: [
              {
                key: 'virtualCarePlatform',
                href: '/organizations/hospitals-health-systems#platform',
              },
              {
                key: 'emergencyServices',
                href: '/organizations/hospitals-health-systems#emergency',
              },
              {
                key: 'inpatientOutpatient',
                href: '/organizations/hospitals-health-systems#inpatient-outpatient',
              },
            ],
          },
        ],
      },
      {
        headingKey: 'explore',
        items: [
          { key: 'ourApproach', href: '/organizations/our-approach' },
          { key: 'connectedPartners', href: '/organizations/partners' },
          { key: 'resourceCenter', href: '/organizations/resource-center' },
          { key: 'events', href: '/organizations/events' },
          { key: 'aboutUs', href: '/about' },
          { key: 'ourImpact', href: '/about/impact' },
          { key: 'contactUs', href: '/contact' },
        ],
      },
    ],
    promo: { key: 'organizations', href: '/organizations/resource-center' },
  },
  {
    key: 'clinicians',
    href: '/clinicians',
    columns: [
      {
        headingKey: 'ourTeam',
        items: [
          { key: 'register', href: '/clinicians/register' },
          { key: 'ourProviders', href: '/clinicians/our-providers' },
          { key: 'clinicalLeadership', href: '/clinicians/clinical-leadership' },
          { key: 'providerCareers', href: '/clinicians/careers' },
        ],
      },
      {
        headingKey: 'explore',
        items: [
          { key: 'joinOurTeam', href: '/clinicians/careers' },
          { key: 'commitmentToQuality', href: '/clinicians/commitment-to-quality' },
          { key: 'aboutUs', href: '/about' },
          { key: 'ourImpact', href: '/about/impact' },
          { key: 'contactUs', href: '/contact' },
        ],
      },
    ],
    promo: { key: 'clinicians', href: '/clinicians/careers' },
  },
];

export interface FooterColumn {
  headingKey: string;
  links: Array<{ key: string; href: string }>;
}

export const footerColumns: FooterColumn[] = [
  {
    headingKey: 'individuals',
    links: [
      { key: 'care247', href: '/individuals/24-7-care' },
      { key: 'mentalHealth', href: '/individuals/mental-health' },
      { key: 'weightManagement', href: '/individuals/weight-management' },
      { key: 'diabetesManagement', href: '/individuals/diabetes-management' },
      { key: 'hypertensionManagement', href: '/individuals/hypertension-management' },
      { key: 'specialtyWellness', href: '/individuals/specialty-wellness' },
      { key: 'primaryCare', href: '/individuals/primary-care' },
    ],
  },
  {
    headingKey: 'organizations',
    links: [
      { key: 'ourApproach', href: '/organizations/our-approach' },
      { key: 'employers', href: '/organizations/employers' },
      { key: 'healthPlans', href: '/organizations/health-plans' },
      { key: 'hospitals', href: '/organizations/hospitals-health-systems' },
      { key: 'resourceCenter', href: '/organizations/resource-center' },
    ],
  },
  {
    headingKey: 'clinicians',
    links: [
      { key: 'register', href: '/clinicians/register' },
      { key: 'commitmentToQuality', href: '/clinicians/commitment-to-quality' },
      { key: 'providerCareers', href: '/clinicians/careers' },
    ],
  },
  {
    headingKey: 'whoWeAre',
    links: [
      { key: 'ourCompany', href: '/about' },
      { key: 'ourImpact', href: '/about/impact' },
      { key: 'leadership', href: '/about/leadership' },
      { key: 'careers', href: '/careers' },
      { key: 'events', href: '/organizations/events' },
      { key: 'newsroom', href: '/newsroom' },
    ],
  },
  {
    headingKey: 'helpfulLinks',
    links: [
      { key: 'contactUs', href: '/contact' },
      { key: 'pricing', href: '/pricing' },
      { key: 'healthLibrary', href: '/health-library' },
      { key: 'helpCenter', href: '/help' },
      { key: 'legal', href: '/legal' },
      { key: 'privacy', href: '/legal/privacy' },
      { key: 'accessibility', href: '/accessibility' },
      { key: 'communityGuidelines', href: '/legal/community-guidelines' },
    ],
  },
];
