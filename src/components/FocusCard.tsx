import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { momentLabel } from '@/lib/moments';
import { useTimer } from '@/lib/timer';
import type { Task } from '@/lib/types';
import { useAppTheme } from '@/lib/useAppTheme';
import { Button, Card, Txt } from './ui';
import { useTaskActions } from './useTaskActions';

/**
 * Mode « Une chose à la fois » : une seule tâche, une seule étape, UN seul gros bouton.
 * Le timer et « Plus tard » restent à portée, en plus discret. La suite est annoncée.
 */
export function FocusCard({ upcoming }: { upcoming: Task[] }) {
  const { colors, fontScale, playful } = useAppTheme();
  const { toggle, completeStep, postpone } = useTaskActions();
  const timer = useTimer();
  const task = upcoming[0];

  if (!task) {
    return (
      <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 36 }}>
        <Text style={{ fontSize: 56 }}>🏆</Text>
        <Txt variant="title" style={{ textAlign: 'center' }}>
          {playful ? 'Tout est fait, bravo !' : 'Tout est fait.'}
        </Txt>
        <Txt variant="muted" style={{ textAlign: 'center' }}>
          Profite de ton temps libre. Le bouton + permet d’ajouter une tâche.
        </Txt>
      </Card>
    );
  }

  const stepIndex = task.steps.findIndex((s) => !s.done);
  const step = stepIndex >= 0 ? task.steps[stepIndex] : null;
  const next = upcoming[1];
  const timerOnThis = timer.taskId === task.id && (timer.status === 'running' || timer.status === 'paused');
  const minutes = task.durationMin ?? 5;

  const start = () => {
    if (!timerOnThis) timer.start(minutes, `${task.emoji} ${task.title}`, task.id);
    router.navigate('/timer');
  };

  return (
    <View style={{ gap: 12 }}>
      <Card style={styles.card}>
        <Txt variant="label" style={{ color: colors.primary }}>
          Maintenant · {momentLabel(task.moment)}
        </Txt>
        <Text style={{ fontSize: 56 }} accessibilityElementsHidden>
          {task.emoji}
        </Text>
        <Txt variant="title" style={{ textAlign: 'center', fontSize: 26 * fontScale }}>
          {task.title}
        </Txt>

        {step ? (
          <View style={[styles.step, { backgroundColor: colors.background }]}>
            <Txt variant="small">
              Étape {stepIndex + 1} sur {task.steps.length}
            </Txt>
            <Txt variant="subtitle" style={{ textAlign: 'center' }}>
              {step.title}
            </Txt>
            <View style={styles.dots} accessibilityElementsHidden>
              {task.steps.map((s) => (
                <View key={s.id} style={[styles.dot, { backgroundColor: s.done ? colors.success : s.id === step.id ? colors.primary : colors.border }]} />
              ))}
            </View>
          </View>
        ) : task.durationMin ? (
          <Txt variant="muted">environ {task.durationMin} min</Txt>
        ) : null}

        <View style={styles.actions}>
          {step ? (
            <Button label="✓ Étape faite" variant="success" onPress={() => completeStep(task, step)} />
          ) : (
            <Button label="✓ C'est fait !" variant="success" onPress={() => toggle(task)} />
          )}
          <Button
            variant="secondary"
            label={timerOnThis ? 'Voir le timer' : `▶ Lancer le timer · ${minutes} min`}
            onPress={start}
          />
          <View style={styles.links}>
            {upcoming.length > 1 && <Button variant="ghost" size="sm" label="Plus tard" onPress={() => postpone(task)} />}
            {step && <Button variant="ghost" size="sm" label="Toute la tâche est faite" onPress={() => toggle(task)} />}
          </View>
        </View>
      </Card>

      {next && (
        <Txt variant="muted" style={{ textAlign: 'center' }} numberOfLines={1}>
          Ensuite : {next.emoji} {next.title}
        </Txt>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: 10, paddingVertical: 22 },
  step: { alignSelf: 'stretch', alignItems: 'center', gap: 6, padding: 14, borderRadius: 14, marginTop: 4 },
  dots: { flexDirection: 'row', gap: 6, marginTop: 2 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  actions: { alignSelf: 'stretch', gap: 10, marginTop: 8 },
  links: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 4 },
});
