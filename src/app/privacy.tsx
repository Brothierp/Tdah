import { Stack } from 'expo-router';
import { View } from 'react-native';
import { Screen, Txt } from '@/components/ui';
import { PRIVACY_SECTIONS, PRIVACY_UPDATED } from '@/lib/privacy';

export default function Privacy() {
  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ headerShown: true, title: 'Confidentialité' }} />
      <Txt variant="small">Mise à jour : {PRIVACY_UPDATED}</Txt>
      {PRIVACY_SECTIONS.map((s) => (
        <View key={s.title} style={{ gap: 4 }}>
          <Txt variant="subtitle">{s.title}</Txt>
          <Txt>{s.body}</Txt>
        </View>
      ))}
    </Screen>
  );
}
