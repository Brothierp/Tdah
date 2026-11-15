import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Screen, Txt } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data';
import { ROUTINE_TABS, tabOf } from '@/lib/moments';
import { buildRoutines, QUESTIONS, withoutDuplicates, type Answers } from '@/lib/questionnaire';
import { useAppTheme } from '@/lib/useAppTheme';

/**
 * Premier lancement : quelques questions simples (une par écran, de gros boutons),
 * puis les routines du matin, de la journée et du soir sont créées à partir des réponses.
 * Peut être refait plus tard depuis les Réglages (sans créer de doublons).
 */
export default function Welcome() {
  const { user, canSupervise } = useAuth();
  const { tasks, addTasks, updateSettings } = useData();
  const { colors, radius, fontScale } = useAppTheme();
  // 0 = bienvenue, 1..N = questions, N+1 = récapitulatif
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  if (!user) return null;

  const total = QUESTIONS.length + 2;
  const question = step >= 1 && step <= QUESTIONS.length ? QUESTIONS[step - 1] : null;
  const routines = withoutDuplicates(tasks, buildRoutines(answers, user.ageGroup));

  const finish = async (withRoutines: boolean) => {
    if (withRoutines && routines.length) await addTasks(routines);
    await updateSettings({ onboarded: true });
    router.replace('/');
  };

  const answer = (value: string) => {
    if (!question) return;
    setAnswers((a) => ({ ...a, [question.id]: value }));
    setStep(step + 1);
  };

  return (
    <Screen>
      <View style={styles.top}>
        <View style={styles.dots} accessibilityLabel={`Étape ${step + 1} sur ${total}`}>
          {Array.from({ length: total }, (_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i <= step ? colors.primary : colors.border }]} />
          ))}
        </View>
        {step > 0 ? (
          <Button size="sm" variant="ghost" label="Retour" onPress={() => setStep(step - 1)} />
        ) : (
          <Button size="sm" variant="ghost" label="Passer" onPress={() => finish(false)} />
        )}
      </View>

      {step === 0 && (
        <View style={styles.center}>
          <Text style={styles.hero}>👋</Text>
          <Txt variant="title" style={{ textAlign: 'center' }}>
            Bienvenue {user.name} !
          </Txt>
          <Txt variant="muted" style={{ textAlign: 'center', fontSize: 18 * fontScale }}>
            Quelques questions rapides pour préparer tes routines du matin, de la journée et du soir.
          </Txt>
          <Button label="Commencer" onPress={() => setStep(1)} style={{ alignSelf: 'stretch', marginTop: 12 }} />
        </View>
      )}

      {question && (
        <View style={styles.center}>
          <Text style={styles.hero}>{question.emoji}</Text>
          <Txt variant="title" style={{ textAlign: 'center' }}>
            {question.text(user.ageGroup)}
          </Txt>
          <View style={{ alignSelf: 'stretch', gap: 12, marginTop: 12 }}>
            {question.options.map((o) => {
              const selected = answers[question.id] === o.value;
              return (
                <Pressable
                  key={o.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => answer(o.value)}
                  style={({ pressed }) => [
                    styles.answer,
                    {
                      borderRadius: radius,
                      backgroundColor: selected ? colors.primary : colors.card,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 19 * fontScale, fontWeight: '700', color: selected ? colors.primaryText : colors.text }}>
                    {o.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {step === total - 1 && (
        <View style={{ gap: 16 }}>
          <Txt variant="title">Tes routines sont prêtes</Txt>
          <Txt variant="muted">Tu pourras tout modifier ensuite.</Txt>
          {ROUTINE_TABS.map((t) => {
            const items = routines.filter((r) => tabOf(r.moment) === t.key);
            if (items.length === 0) return null;
            return (
              <Card key={t.key} style={{ gap: 8 }}>
                <Txt variant="label">
                  {t.emoji} {t.title}
                </Txt>
                {items.map((r) => (
                  <Txt key={r.title}>
                    {r.emoji} {r.title}
                  </Txt>
                ))}
              </Card>
            );
          })}
          {routines.length === 0 && <Txt variant="muted">Tout est déjà dans tes routines.</Txt>}
          {canSupervise && (
            <Txt variant="small">👨‍👩‍👧 Tu es parent ? Dans les Réglages, « Ma famille » permet de créer le compte de ton enfant.</Txt>
          )}
          <Button label="C’est parti ! 🚀" onPress={() => finish(true)} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dots: { flexDirection: 'row', gap: 6, flexShrink: 1 },
  dot: { width: 18, height: 6, borderRadius: 3 },
  center: { alignItems: 'center', gap: 14, paddingTop: 24 },
  hero: { fontSize: 72, textAlign: 'center' },
  answer: { minHeight: 64, paddingHorizontal: 20, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
});
