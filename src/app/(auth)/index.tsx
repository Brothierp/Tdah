import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Screen, Txt } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useAppTheme } from '@/lib/useAppTheme';

/** Accueil : choix du profil (pratique quand plusieurs personnes partagent l'appareil). */
export default function Welcome() {
  const { accounts } = useAuth();
  const { colors } = useAppTheme();

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={{ fontSize: 64 }}>🎯</Text>
        <Txt variant="title">Focus</Txt>
        <Txt variant="muted" style={{ textAlign: 'center' }}>
          Une chose à la fois. Tes tâches, ton timer et tes rappels, au même endroit.
        </Txt>
      </View>

      {accounts.length > 0 && (
        <Card style={{ gap: 12 }}>
          <Txt variant="subtitle">Qui es-tu ?</Txt>
          <View style={styles.grid}>
            {accounts.map((a) => (
              <Pressable
                key={a.id}
                accessibilityRole="button"
                accessibilityLabel={`Se connecter en tant que ${a.name}`}
                onPress={() => router.push({ pathname: '/login', params: { login: a.login } })}
                style={({ pressed }) => [
                  styles.profile,
                  { backgroundColor: colors.primarySoft, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={{ fontSize: 40 }}>{a.avatar}</Text>
                <Txt numberOfLines={1} style={{ fontWeight: '700' }}>
                  {a.name}
                </Txt>
              </Pressable>
            ))}
          </View>
        </Card>
      )}

      <Button label="✨ Créer un compte" onPress={() => router.push('/register')} />
      <Button label="J'ai déjà un compte" variant="secondary" onPress={() => router.push('/login')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  profile: { width: 96, alignItems: 'center', gap: 4, paddingVertical: 12, paddingHorizontal: 6, borderRadius: 18 },
});
