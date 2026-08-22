import { StyleSheet } from 'react-native';
import { colors, radii, spacing } from '@swasthya/configuration';

// Moved to its own file, `Screen.tsx` — see that file's doc comment for why.
export { Screen } from './Screen';

// Moved to its own file, `SathiOrb.tsx` — see that file's doc comment for why.
export { SathiOrb } from './SathiOrb';

// Moved to its own file, `ActionCard.tsx` — see that file's doc comment for why.
export { ActionCard } from './ActionCard';

// Moved to its own file, `Pill.tsx` — see that file's doc comment for why.
export { Pill } from './Pill';

// Moved to its own file, `SectionTitle.tsx` — see that file's doc comment for why.
export { SectionTitle } from './SectionTitle';

export const uiStyles = StyleSheet.create({
  h1: {
    color: colors.ink,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1.1,
    lineHeight: 43,
  },
  body: { color: colors.muted, fontSize: 16, lineHeight: 25 },
  label: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.xl,
    shadowColor: colors.primaryDark,
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: spacing.xl,
    shadowColor: colors.primary,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  primaryButtonText: { color: 'white', fontSize: 16, fontWeight: '900' },
});
