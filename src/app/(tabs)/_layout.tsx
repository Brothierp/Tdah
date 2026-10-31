import { Tabs } from 'expo-router/js-tabs';
import { Text } from 'react-native';
import { useAuth } from '@/lib/auth';
import { useTimer } from '@/lib/timer';
import { useAppTheme } from '@/lib/useAppTheme';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 24, opacity: focused ? 1 : 0.55 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  const { colors } = useAppTheme();
  const timer = useTimer();
  const { canSupervise, children } = useAuth();
  const timerActive = timer.status === 'running' || timer.status === 'paused';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border, height: 64, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 13, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Aujourd’hui', tabBarIcon: ({ focused }) => <TabIcon emoji="✅" focused={focused} /> }}
      />
      <Tabs.Screen
        name="timer"
        options={{
          title: 'Timer',
          tabBarIcon: ({ focused }) => <TabIcon emoji="⏳" focused={focused} />,
          // Petit point discret quand un timer tourne.
          tabBarBadge: timerActive ? '' : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary, minWidth: 12, maxHeight: 12, borderRadius: 6, top: 2 },
        }}
      />
      <Tabs.Screen
        name="family"
        options={{
          title: 'Famille',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👨‍👩‍👧" focused={focused} />,
          // Réservé aux comptes adultes (ou à ceux qui suivent déjà des enfants).
          href: canSupervise || children.length > 0 ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Réglages', tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" focused={focused} /> }}
      />
    </Tabs>
  );
}
