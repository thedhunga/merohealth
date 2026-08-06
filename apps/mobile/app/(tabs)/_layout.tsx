import { Tabs } from 'expo-router';
import { HeartPulse, Search, Sparkles, UserRound, Video } from 'lucide-react-native';
import { colors } from '@swasthya/configuration';
import { useAppState } from '@/state/app-state';
import { t } from '@swasthya/localization';

export default function TabsLayout() {
  const { language } = useAppState();
  const options = { headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted, tabBarStyle: { height: 74, paddingBottom: 12, paddingTop: 8, borderTopColor: colors.line, backgroundColor: colors.surface }, tabBarLabelStyle: { fontSize: 11, fontWeight: '700' as const } };
  return <Tabs screenOptions={options}>
    <Tabs.Screen name="index" options={{ title: t(language, 'companion'), tabBarIcon: ({ color, size }) => <Sparkles color={color} size={size} /> }} />
    <Tabs.Screen name="twin" options={{ title: t(language, 'twin'), tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} /> }} />
    <Tabs.Screen name="care" options={{ title: t(language, 'care'), tabBarIcon: ({ color, size }) => <Search color={color} size={size} /> }} />
    <Tabs.Screen name="learn" options={{ title: t(language, 'learn'), tabBarIcon: ({ color, size }) => <Video color={color} size={size} /> }} />
    <Tabs.Screen name="companion" options={{ href: null, title: 'Ask', tabBarIcon: ({ color, size }) => <HeartPulse color={color} size={size} /> }} />
  </Tabs>;
}
