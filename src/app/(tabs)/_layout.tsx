import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { ActivityIndicator, Text } from 'react-native';
import { useData } from '@/lib/data';
import { useAppTheme } from '@/lib/useAppTheme';

// On entre toujours par « index », qui ouvre l'onglet du moment (matin, journée ou soir).
export const unstable_settings = { initialRouteName: 'index' };

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 24, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
}

/**
 * La journée en 3 onglets : Matin, Journée, Soir (+ Réglages).
 * Le timer (bouton ⏳) et l'espace Famille (Réglages) sont des écrans à part, avec un retour.
 */
export default function TabsLayout() {
  const { colors } = useAppTheme();
  const { ready, settings } = useData();
  // Écran d'entrée invisible dans la barre (il redirige vers l'onglet du moment).
  const hidden = { tabBarButton: () => null, tabBarItemStyle: { display: 'none' as const } };

  // On attend les données, puis questionnaire au premier lancement (quel que soit l'onglet demandé).
  if (!ready) return <ActivityIndicator style={{ flex: 1, backgroundColor: colors.background }} color={colors.primary} size="large" />;
  if (!settings.onboarded) return <Redirect href="/welcome" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border, height: 66, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 14, fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={hidden} />
      <Tabs.Screen name="matin" options={{ title: 'Matin', tabBarIcon: ({ focused }) => <TabIcon emoji="☀️" focused={focused} /> }} />
      <Tabs.Screen name="journee" options={{ title: 'Journée', tabBarIcon: ({ focused }) => <TabIcon emoji="🌤️" focused={focused} /> }} />
      <Tabs.Screen name="soir" options={{ title: 'Soir', tabBarIcon: ({ focused }) => <TabIcon emoji="🌙" focused={focused} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Réglages', tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" focused={focused} /> }} />
    </Tabs>
  );
}
