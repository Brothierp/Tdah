import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTimer } from '@/lib/timer';
import type { Task } from '@/lib/types';
import { useAppTheme } from '@/lib/useAppTheme';
import { Button, Card, Txt } from './ui';
import { useTaskActions } from './useTaskActions';

/** « Maintenant » : une tâche, une étape, un gros bouton. Le reste en petit. */
export function FocusCard({ task, canPostpone }: { task: Task; canPostpone: boolean }) {
  const { fontScale } = useAppTheme();
  const { toggle, completeStep, postpone } = useTaskActions();
  const timer = useTimer();

  const stepIndex = task.steps.findIndex((s) => !s.done);
  const step = stepIndex >= 0 ? task.steps[stepIndex] : null;
  const minutes = task.durationMin ?? 5;
  const timerOnThis = timer.taskId === task.id && (timer.status === 'running' || timer.status === 'paused');

  const startTimer = () => {
    if (!timerOnThis) timer.start(minutes, `${task.emoji} ${task.title}`, task.id);
    router.navigate('/timer');
  };

  return (
    <Card style={styles.card}>
      <Text style={{ fontSize: 52 }} accessibilityElementsHidden>
        {task.emoji}
      </Text>
      <Txt variant="title" style={{ textAlign: 'center', fontSize: 26 * fontScale }}>
        {task.title}
      </Txt>
      {step ? (
        <Txt variant="muted" style={{ textAlign: 'center', fontSize: 18 * fontScale }}>
          {stepIndex + 1}/{task.steps.length} · {step.title}
        </Txt>
      ) : null}

      <Button
        label={step ? '✓ Fait' : '✓ C’est fait'}
        accessibilityLabel={step ? 'Étape faite' : 'C’est fait'}
        variant="success"
        onPress={() => (step ? completeStep(task, step) : toggle(task))}
        style={{ alignSelf: 'stretch', marginTop: 6 }}
      />
      <View style={styles.links}>
        <Button variant="ghost" size="sm" label={timerOnThis ? 'Voir le timer' : `▶ Timer ${minutes} min`} onPress={startTimer} />
        {canPostpone && <Button variant="ghost" size="sm" label="Plus tard" onPress={() => postpone(task)} />}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: 8, paddingTop: 24, paddingBottom: 8 },
  links: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
});
