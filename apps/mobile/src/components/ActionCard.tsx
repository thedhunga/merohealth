import { Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { colors, spacing } from '@swasthya/configuration';
import type { LucideIcon } from 'lucide-react-native';

/**
 * Split out of `ui.tsx` on purpose, the same move `Pill`/`SathiOrb`/
 * `Screen`/`SectionTitle` already made: it was the one remaining export
 * there blocked on `lucide-react-native`, which fails to parse under
 * vitest (Round seven GGGG's log entry) with no working stock mock. Now
 * unblocked by a hand-rolled one, `src/test/lucide-mock.ts`, aliased in
 * `apps/mobile/vitest.config.ts` the same way `react-native-reanimated`
 * was for `SathiOrb` — see `ActionCard.test.tsx`.
 */
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
