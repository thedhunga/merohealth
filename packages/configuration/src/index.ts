export const brandConfig = {
  englishName: 'Mero Health',
  companionEnglishName: 'Swasthya Sathi',
  nepaliName: 'मेरो स्वास्थ्य',
  companionNepaliName: 'स्वास्थ्य साथी',
  logoPath: 'assets/brand/mark.png',
  contact: { supportEmail: 'support@example.invalid', supportPhone: null },
  legalEntity: {
    displayName: 'Demonstration entity — configure before launch',
    registrationId: null,
    jurisdiction: 'NP',
  },
} as const;
/**
 * Brand palette, shared by the Expo app and the marketing site.
 *
 * Warm and Nepali rather than clinical: deep forest as a confident ground and
 * सयपत्री marigold as the accent, on a warm paper base. The previous deep-teal
 * on greenish-white read grey and institutional. Deliberately avoids the
 * teal/blue every competitor in this category uses.
 *
 * Keys are unchanged so existing consumers keep compiling; only the values
 * moved. `apps/web/src/styles/globals.css` mirrors these.
 */
export const colors = {
  ink: '#132A21',
  muted: '#465B51',
  canvas: '#F6F0E5',
  surface: '#FFFCF7',
  primary: '#0B4F3A',
  primaryDark: '#07231A',
  mint: '#D8F0E5',
  mintStrong: '#A9DFC9',
  saffron: '#F4A62A',
  saffronSoft: '#FDF0D8',
  danger: '#B42318',
  dangerSoft: '#FEE4E2',
  info: '#17916B',
  line: '#E4DDD0',
} as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radii = { sm: 10, md: 16, lg: 24, pill: 999 } as const;
export const motion = {
  quick: 160,
  standard: 280,
  reveal: 440,
  spring: { damping: 18, stiffness: 180, mass: 0.8 },
} as const;
