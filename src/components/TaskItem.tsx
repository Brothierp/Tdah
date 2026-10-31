import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RoundButton, Txt } from '@/components/ui';
import { useData } from '@/lib/data';
import { useTimer } from '@/lib/timer';
import type { Task } from '@/lib/types';
import { useAppTheme } from '@/lib/useAppTheme';

export function formatTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function reminderLabel(task: Task): string | null {
  const { reminder } = task;
  if (!reminder.enabled || !reminder.at) return null;
  if (reminder.repeat === 'daily') return `🔁 ${formatTime(reminder.at)}`;
  const d = new Date(reminder.at);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const day =
    d.toDateString() === today.toDateString()
      ? ''
      : d.toDateString() === tomorrow.toDateString()
        ? 'demain '
        : `${d.getDate()}/${d.getMonth() + 1} `;
  return `🔔 ${day}${formatTime(reminder.at)}`;
}

export function TaskItem({
  task,
  onToggle,
  isFirst,
  isLast,
}: {
  task: Task;
  onToggle: (task: Task) => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { colors, radius, fontScale } = useAppTheme();
  const { toggleStep, moveTask } = useData();
  const timer = useTimer();
  const [open, setOpen] = useState(false);
  const stepsDone = task.steps.filter((s) => s.done).length;
  const reminder = reminderLabel(task);

  const startTimer = () => {
    timer.start(task.durationMin ?? 5, `${task.emoji} ${task.title}`, task.id);
    router.navigate('/timer');
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: task.done ? colors.successSoft : colors.card,
          borderColor: task.done ? colors.success : colors.border,
          borderRadius: radius,
        },
      ]}
    >
      <View style={styles.row}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: task.done }}
          accessibilityLabel={`${task.done ? 'Décocher' : 'Cocher'} ${task.title}`}
          onPress={() => onToggle(task)}
          hitSlop={8}
          style={[
            styles.check,
            {
              borderColor: task.done ? colors.success : colors.primary,
              backgroundColor: task.done ? colors.success : 'transparent',
            },
          ]}
        >
          <Text style={{ fontSize: 26 }}>{task.done ? '✔️' : task.emoji}</Text>
        </Pressable>

        <Pressable
          style={{ flex: 1, gap: 2 }}
          onPress={() => setOpen((o) => !o)}
          accessibilityRole="button"
          accessibilityLabel={`${open ? 'Replier' : 'Déplier'} ${task.title}`}
        >
          <Txt
            variant="subtitle"
            style={{ fontSize: 18 * fontScale, textDecorationLine: task.done ? 'line-through' : 'none' }}
            numberOfLines={open ? undefined : 2}
          >
            {task.title}
          </Txt>
          <View style={styles.meta}>
            {task.durationMin ? <Txt variant="small">⏱ {task.durationMin} min</Txt> : null}
            {reminder ? <Txt variant="small">{reminder}</Txt> : null}
            {task.steps.length > 0 ? (
              <Txt variant="small">
                🪜 {stepsDone}/{task.steps.length} étapes
              </Txt>
            ) : null}
          </View>
        </Pressable>

        {!task.done && (
          <RoundButton label="▶" accessibilityLabel={`Lancer le timer pour ${task.title}`} onPress={startTimer} size={44} />
        )}
      </View>

      {open && (
        <View style={{ gap: 10, marginTop: 12 }}>
          {task.steps.map((s) => (
            <Pressable
              key={s.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: s.done }}
              onPress={() => toggleStep(task.id, s.id)}
              style={styles.step}
            >
              <View
                style={[
                  styles.stepBox,
                  { borderColor: colors.primary, backgroundColor: s.done ? colors.primary : 'transparent' },
                ]}
              >
                {s.done ? <Text style={{ color: colors.primaryText, fontWeight: '800' }}>✓</Text> : null}
              </View>
              <Txt style={{ flex: 1, textDecorationLine: s.done ? 'line-through' : 'none' }}>{s.title}</Txt>
            </Pressable>
          ))}
          <View style={styles.actions}>
            <RoundButton label="✏️" accessibilityLabel="Modifier" onPress={() => router.push(`/task/${task.id}`)} />
            {!isFirst && <RoundButton label="↑" accessibilityLabel="Monter" onPress={() => moveTask(task.id, -1)} />}
            {!isLast && <RoundButton label="↓" accessibilityLabel="Descendre" onPress={() => moveTask(task.id, 1)} />}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, borderWidth: 1.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  check: { width: 54, height: 54, borderRadius: 27, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 8 },
  stepBox: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
});
