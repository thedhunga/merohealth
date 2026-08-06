export const brandConfig = {
  englishName: 'Swasthya Sathi',
  nepaliName: 'स्वास्थ्य साथी',
  logoPath: 'assets/brand/mark.png',
  contact: { supportEmail: 'support@example.invalid', supportPhone: null },
  legalEntity: { displayName: 'Demonstration entity — configure before launch', registrationId: null, jurisdiction: 'NP' },
} as const;
export const colors = {
  ink: '#102B2B', muted: '#5F7370', canvas: '#F6F8F4', surface: '#FFFFFF',
  primary: '#0B685C', primaryDark: '#074E47', mint: '#DDF3EB', mintStrong: '#A8DBC9',
  saffron: '#F2B84B', saffronSoft: '#FFF1CE', danger: '#B42318', dangerSoft: '#FEE4E2',
  info: '#285D9A', line: '#DCE6E2',
} as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radii = { sm: 10, md: 16, lg: 24, pill: 999 } as const;
export const motion = { quick: 160, standard: 280, reveal: 440, spring: { damping: 18, stiffness: 180, mass: 0.8 } } as const;
