import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radii, spacing } from '@swasthya/configuration';

/**
 * Split out of `ui.tsx` on purpose: it is the only exported component there
 * with no `react-native-reanimated` or `lucide-react-native` import anywhere
 * in its module, both of which fail to load under `react-test-renderer` +
 * vitest today (reanimated needs its own mock; `lucide-react-native` pulls
 * in `react-native-svg`, which deep-imports `react-native/Libraries/...`
 * paths Node's package-exports map blocks outside Metro). That made it the
 * first real component this repo's render-test harness could exercise
 * end-to-end — see `Pill.test.tsx` and `apps/mobile/vitest.config.ts`.
 */
export function Pill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.pill, selected && styles.pillSelected]}
    >
      <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  pillSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { color: colors.ink, fontWeight: '800' },
  pillTextSelected: { color: 'white' },
});
