import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@swasthya/configuration';

/**
 * Split out of `ui.tsx` on purpose, the same move `Pill.tsx` and
 * `SathiOrb.tsx` made: it has no `react-native-reanimated` or
 * `lucide-react-native` import anywhere in its module, so it renders under
 * `react-test-renderer` + vitest without either package's mock — see
 * `SectionTitle.test.tsx`.
 */
export function SectionTitle({
  eyebrow,
  title,
  body,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
}) {
  return (
    <View style={styles.sectionTitle}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.h2}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { gap: spacing.sm },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  h2: { color: colors.ink, fontSize: 28, fontWeight: '900', letterSpacing: -0.7, lineHeight: 35 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 23 },
});
