import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  type ScrollViewProps,
} from 'react-native';
import { colors, spacing } from '@swasthya/configuration';

/**
 * Split out of `ui.tsx` on purpose, the same move `Pill.tsx` and
 * `SathiOrb.tsx` made: it has no `react-native-reanimated` or
 * `lucide-react-native` import anywhere in its module, so it renders under
 * `react-test-renderer` + vitest without either package's mock — see
 * `Screen.test.tsx`.
 */
export function Screen({ children, contentContainerStyle, ...props }: ScrollViewProps) {
  const { width } = useWindowDimensions();
  return (
    <ScrollView
      contentContainerStyle={[
        styles.screen,
        { paddingHorizontal: width >= 720 ? spacing.xxl : spacing.lg },
        contentContainerStyle,
      ]}
      showsVerticalScrollIndicator={false}
      {...props}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignSelf: 'center',
    backgroundColor: colors.canvas,
    flexGrow: 1,
    gap: spacing.xl,
    maxWidth: 1180,
    paddingBottom: 124,
    paddingTop: spacing.xl,
    width: '100%',
  },
});
