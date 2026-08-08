import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { HeartPulse, Search, Sparkles, UserRound, Video } from 'lucide-react-native';
import { colors } from '@swasthya/configuration';
import { useAppState } from '@/state/app-state';
import { t } from '@swasthya/localization';

export default function TabsLayout() {
  const { language } = useAppState();
  const options = {
    headerShown: false,
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.muted,
    tabBarHideOnKeyboard: true,
    tabBarStyle: {
      backgroundColor: 'rgba(255,255,255,.97)',
      borderColor: colors.line,
      borderRadius: 24,
      borderTopColor: colors.line,
      borderTopWidth: 1,
      borderWidth: 1,
      bottom: Platform.OS === 'web' ? 18 : 10,
      elevation: 12,
      height: 76,
      left: 16,
      paddingBottom: 10,
      paddingTop: 9,
      position: 'absolute' as const,
      right: 16,
      shadowColor: colors.primaryDark,
      shadowOffset: { height: 8, width: 0 },
      shadowOpacity: 0.13,
      shadowRadius: 20,
    },
    tabBarItemStyle: { borderRadius: 18 },
    tabBarLabelStyle: { fontSize: 10, fontWeight: '800' as const },
  };

  return (
    <Tabs screenOptions={options}>
      <Tabs.Screen
        name="index"
        options={{
          title: t(language, 'companion'),
          tabBarIcon: ({ color, size }) => <Sparkles color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="twin"
        options={{
          title: t(language, 'twin'),
          tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="care"
        options={{
          title: t(language, 'care'),
          tabBarIcon: ({ color, size }) => <Search color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: t(language, 'learn'),
          tabBarIcon: ({ color, size }) => <Video color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="companion"
        options={{
          href: null,
          title: 'Ask',
          tabBarIcon: ({ color, size }) => <HeartPulse color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
