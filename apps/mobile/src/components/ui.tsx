import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
} from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { colors, radii, spacing } from '@swasthya/configuration';
import type { LucideIcon } from 'lucide-react-native';

// Moved to its own file, `Screen.tsx` — see that file's doc comment for why.
export { Screen } from './Screen';

// Moved to its own file, `SathiOrb.tsx` — see that file's doc comment for why.
export { SathiOrb } from './SathiOrb';

interface ActionCardProps extends PressableProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  tone?: 'default' | 'danger' | 'warm' | 'forest' | 'jade';
  badge?: string;
}

export function ActionCard({
  icon: Icon,
  title,
  subtitle,
  tone = 'default',
  badge,
  ...props
}: ActionCardProps) {
  // Five tones, all within the forest/jade/marigold family — the previous
  // 'blue'/'violet' names mapped to off-brand hues the health-tech-blue rule
  // forbids, so the tones were renamed to match what they actually render.
  const palette =
    tone === 'danger'
      ? [colors.dangerSoft, colors.danger]
      : tone === 'warm'
        ? [colors.saffronSoft, colors.saffronDeep]
        : tone === 'forest'
          ? [colors.mintFaint, colors.primaryDeep]
          : tone === 'jade'
            ? [colors.mintStrong, colors.info]
            : [colors.mint, colors.primary];

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.actionCard,
        { backgroundColor: palette[0], opacity: pressed ? 0.76 : 1 },
      ]}
      {...props}
    >
      <View style={[styles.actionIcon, { borderColor: `${palette[1]}18` }]}>
        <Icon color={palette[1]} size={23} strokeWidth={2.1} />
      </View>
      <View style={styles.actionText}>
        {badge ? <Text style={[styles.actionBadge, { color: palette[1] }]}>{badge}</Text> : null}
        <Text style={styles.actionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.actionSubtitle}>{subtitle}</Text> : null}
      </View>
      <ChevronRight color={palette[1]} size={18} />
    </Pressable>
  );
}

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

const styles = StyleSheet.create({
  actionCard: {
    alignItems: 'center',
    borderRadius: 20,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 92,
    padding: spacing.lg,
  },
  actionIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,.78)',
    borderRadius: 17,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  actionText: { flex: 1, gap: 3 },
  actionBadge: { fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  actionTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  actionSubtitle: { color: colors.muted, fontSize: 12, lineHeight: 17 },
});
