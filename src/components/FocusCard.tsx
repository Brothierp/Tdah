import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { momentLabel } from '@/lib/moments';
import { useTimer } from '@/lib/timer';
import type { Task } from '@/lib/types';
import { useAppTheme } from '@/lib/useAppTheme';
import { Button, Card, Txt } from './ui';
import { useTaskActions } from './useTaskActions';

/**
 * Mode « Une chose à la fois » : une seule tâche à l'écran, une seule étape à la fois,
 * trois gros boutons. On montre aussi ce qui vient ensuite (prévisibilité).
 */
export function FocusCard({ upcoming }: { upcoming: Task[] }) {
  const { colors, radius, fontScale, playful } = useAppTheme();
  const { toggle, completeStep, postpone } = useTaskActions();
  const timer = useTimer();
  const task = upcoming[0];

  if (!task) {
    return (
      <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 32 }}>
        <Text style={{ fontSize: 64 }}>🏆</Text>
        <Txt variant="title" style={{ textAlign: 'center' }}>
          {playful ? 'Tout est fait, bravo !' : 'Tout est fait.'}
        </Txt>
        <Txt variant="muted" style={{ textAlign: 'center' }}>
          Profite de ton temps libre. Tu peux aussi ajouter une nouvelle tâche.
        </Txt>
      </Card>
    );
  }

  const stepIndex = task.steps.findIndex((s) => !s.done);
  const step = stepIndex >= 0 ? task.steps[stepIndex] : null;
  const next = upcoming[1];
  const timerOnThis = timer.taskId === task.id && (timer.status === 'running' || timer.status === 'paused');

  const start = () => {
    if (!timerOnThis) timer.start(task.durationMin ?? 5, `${task.emoji} ${task.title}`, task.id);
    router.navigate('/timer');
  };

  return (
    <View style={{ gap: 12 }}>
      <View
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.primary, borderRadius: radius * 1.3 }]}
        accessibilityLabel={`Maintenant : ${task.title}`}
      >
        <Txt variant="small" style={{ fontWeight: '700', color: colors.primary, textTransform: 'uppercase', letterSpacing: 1 }}>
          Maintenant · {momentLabel(task.moment)}
        </Txt>
        <Text style={{ fontSize: 72 }}>{task.emoji}</Text>
        <Txt variant="title" style={{ textAlign: 'center', fontSize: 30 * fontScale }}>
          {task.title}
        </Txt>
        {task.durationMin ? <Txt variant="muted">⏱ environ {task.durationMin} min</Txt> : null}

        {step && (
          <View style={[styles.step, { backgroundColor: colors.primarySoft, borderRadius: radius }]}>
            <Txt variant="small" style={{ fontWeight: '700' }}>
              Étape {stepIndex + 1} sur {task.steps.length}
            </Txt>
            <Txt variant="subtitle" style={{ textAlign: 'center' }}>
              {step.title}
            </Txt>
            <View style={styles.dots} accessibilityElementsHidden>
              {task.steps.map((s) => (
                <View
                  key={s.id}
                  style={[styles.dot, { backgroundColor: s.done ? colors.success : s.id === step.id ? colors.primary : colors.border }]}
                />
              ))}
            </View>
            <Button label="✓ Étape faite" variant="secondary" onPress={() => completeStep(task, step)} style={{ alignSelf: 'stretch' }} />
          </View>
        )}
      </View>

      <Button label={timerOnThis ? '⏳ Voir le timer' : `▶ Commencer${task.durationMin ? ` (${task.durationMin} min)` : ''}`} onPress={start} />
      <Button label="✅ C'est fait !" variant="success" onPress={() => toggle(task)} />
      {upcoming.length > 1 && <Button label="⏭ Plus tard" variant="ghost" onPress={() => postpone(task)} />}

      {next && (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
          <Txt variant="muted">Ensuite :</Txt>
          <Text style={{ fontSize: 22 }}>{next.emoji}</Text>
          <Txt style={{ flex: 1, fontWeight: '600' }} numberOfLines={1}>
            {next.title}
          </Txt>
          {upcoming.length > 2 && <Txt variant="small">+{upcoming.length - 2}</Txt>}
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: 10, padding: 22, borderWidth: 2 },
  step: { alignSelf: 'stretch', alignItems: 'center', gap: 8, padding: 14, marginTop: 6 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
