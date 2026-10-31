import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Screen, Segmented, ToggleRow, Txt } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data';
import { packsFor, packToInputs } from '@/lib/templates';
import type { Settings } from '@/lib/types';
import { useAppTheme } from '@/lib/useAppTheme';

const STEPS = 4;

/** Accueil guidé : 4 écrans courts, une seule question par écran, et on peut tout passer. */
export default function Welcome() {
  const { user, canSupervise } = useAuth();
  const { settings, updateSettings, addTasks } = useData();
  const { colors, radius } = useAppTheme();
  const [step, setStep] = useState(0);
  const [packs, setPacks] = useState<string[]>([]);
  if (!user) return null;

  const view: NonNullable<Settings['homeView']> = settings.homeView ?? (user.ageGroup === 'enfant' ? 'focus' : 'list');
  const suggestions = packsFor(user.ageGroup).slice(0, 4);

  const finish = async () => {
    const chosen = suggestions.filter((p) => packs.includes(p.id));
    if (chosen.length) await addTasks(chosen.flatMap(packToInputs));
    await updateSettings({ onboarded: true, homeView: view });
    router.replace('/');
  };

  const next = () => (step < STEPS - 1 ? setStep(step + 1) : finish());

  return (
    <Screen>
      <View style={styles.top}>
        <View style={styles.dots} accessibilityLabel={`Étape ${step + 1} sur ${STEPS}`}>
          {Array.from({ length: STEPS }, (_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i <= step ? colors.primary : colors.border }]} />
          ))}
        </View>
        <Button label="Passer" variant="ghost" onPress={finish} style={{ paddingHorizontal: 8, minHeight: 40 }} />
      </View>

      {step === 0 && (
        <View style={{ gap: 16 }}>
          <Text style={styles.hero}>👋</Text>
          <Txt variant="title" style={{ textAlign: 'center' }}>
            Bienvenue {user.name} !
          </Txt>
          <Txt variant="muted" style={{ textAlign: 'center' }}>
            Focus t’aide à avancer, une chose à la fois.
          </Txt>
          {[
            ['🎯', 'Une tâche à la fois', 'Pas de liste qui fait peur : juste la prochaine chose à faire.'],
            ['🪜', 'Des petites étapes', 'Les grosses tâches sont découpées en morceaux faciles.'],
            ['⏳', 'Un timer visuel', 'Tu vois le temps passer, et on te prévient avant la fin.'],
            ['🔔', 'Des rappels', 'Seulement si tu veux, au bon moment.'],
          ].map(([emoji, title, text]) => (
            <Card key={title} style={styles.feature}>
              <Text style={{ fontSize: 32 }}>{emoji}</Text>
              <View style={{ flex: 1 }}>
                <Txt style={{ fontWeight: '700' }}>{title}</Txt>
                <Txt variant="small">{text}</Txt>
              </View>
            </Card>
          ))}
        </View>
      )}

      {step === 1 && (
        <View style={{ gap: 16 }}>
          <Txt variant="title">Comment veux-tu voir ta journée ?</Txt>
          <Txt variant="muted">Tu pourras changer à tout moment, en haut de l’écran.</Txt>
          {(
            [
              ['focus', '🎯', 'Une chose à la fois', 'Une seule tâche à l’écran. Idéal pour ne pas se disperser.'],
              ['list', '📋', 'Ma journée', 'Toutes les tâches, rangées par moment : matin, midi, après-midi, soir.'],
            ] as const
          ).map(([value, emoji, title, text]) => {
            const selected = view === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => updateSettings({ homeView: value })}
                style={[
                  styles.choice,
                  { borderRadius: radius, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primarySoft : colors.card },
                ]}
              >
                <Text style={{ fontSize: 40 }}>{emoji}</Text>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt variant="subtitle">{title}</Txt>
                  <Txt variant="small">{text}</Txt>
                </View>
                <Text style={{ fontSize: 24 }}>{selected ? '✅' : '⚪'}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {step === 2 && (
        <View style={{ gap: 16 }}>
          <Txt variant="title">Ton confort</Txt>
          <Txt variant="muted">Pour que l’écran soit agréable à lire.</Txt>
          <Card style={{ gap: 12 }}>
            <Txt style={{ fontWeight: '700' }}>Taille du texte</Txt>
            <Segmented
              value={settings.textSize}
              onChange={(v) => updateSettings({ textSize: v })}
              options={[
                { value: 'normal', label: 'Normal' },
                { value: 'grand', label: 'Grand' },
                { value: 'tres-grand', label: 'Très grand' },
              ]}
            />
            <Txt>Voici un exemple de texte.</Txt>
          </Card>
          <Card>
            <ToggleRow
              label="🌿 Mode calme"
              description="Couleurs plus douces, pas d’animations ni de confettis."
              value={settings.calmMode}
              onValueChange={(v) => updateSettings({ calmMode: v })}
            />
            <ToggleRow
              label="📳 Vibrations"
              description="Une petite vibration quand une tâche est finie."
              value={settings.hapticsEnabled}
              onValueChange={(v) => updateSettings({ hapticsEnabled: v })}
            />
          </Card>
        </View>
      )}

      {step === 3 && (
        <View style={{ gap: 16 }}>
          <Txt variant="title">Pour bien démarrer</Txt>
          <Txt variant="muted">Choisis des routines toutes prêtes (ou aucune). Tu pourras les modifier.</Txt>
          {suggestions.map((pack) => {
            const selected = packs.includes(pack.id);
            return (
              <Pressable
                key={pack.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                onPress={() => setPacks((p) => (selected ? p.filter((x) => x !== pack.id) : [...p, pack.id]))}
                style={[
                  styles.choice,
                  { borderRadius: radius, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primarySoft : colors.card },
                ]}
              >
                <Text style={{ fontSize: 34 }}>{pack.emoji}</Text>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt style={{ fontWeight: '700' }}>{pack.title}</Txt>
                  <Txt variant="small">{pack.tasks.map((t) => t.emoji).join(' ')}</Txt>
                </View>
                <Text style={{ fontSize: 24 }}>{selected ? '✅' : '⬜'}</Text>
              </Pressable>
            );
          })}
          {canSupervise && (
            <Card style={{ backgroundColor: colors.primarySoft, borderColor: colors.primary }}>
              <Txt variant="small">
                👨‍👩‍👧 Tu es parent ? L’onglet Famille te permet de créer le compte de ton enfant et de suivre sa journée.
              </Txt>
            </Card>
          )}
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        {step > 0 && <Button label="Retour" variant="secondary" onPress={() => setStep(step - 1)} style={{ flex: 1 }} />}
        <Button label={step < STEPS - 1 ? 'Suivant' : 'C’est parti ! 🚀'} onPress={next} style={{ flex: 2 }} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 28, height: 8, borderRadius: 4 },
  hero: { fontSize: 72, textAlign: 'center' },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderWidth: 2 },
});
