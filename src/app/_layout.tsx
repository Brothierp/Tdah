import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NotificationRouter } from '@/components/NotificationRouter';
import { AuthProvider, useAuth } from '@/lib/auth';
import { DataProvider } from '@/lib/data';
import { TimerProvider } from '@/lib/timer';
import { useAppTheme } from '@/lib/useAppTheme';

function RootNavigator() {
  const { user, loading } = useAuth();
  const { colors } = useAppTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text },
      }}
    >
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="task/[id]" options={{ presentation: 'modal', headerShown: true, title: 'Tâche' }} />
        <Stack.Screen name="family/[childId]" options={{ headerShown: true, title: 'Enfant' }} />
        <Stack.Screen name="family/add" options={{ presentation: 'modal', headerShown: true, title: 'Ajouter un enfant' }} />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Screen name="privacy" options={{ headerShown: true, title: 'Confidentialité' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <DataProvider>
          <TimerProvider>
            <StatusBar style="auto" />
            <RootNavigator />
            <NotificationRouter />
          </TimerProvider>
        </DataProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
