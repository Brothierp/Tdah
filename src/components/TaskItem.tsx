import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Txt } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data';
import { useTaskActions } from './useTaskActions';
import { useTimer } from '@/lib/timer';
import type { Task } from '@/lib/types';
import { useAppTheme } from '@/lib/useAppTheme';

export function formatTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function reminderLabel(task: Task): string | null {
  const { reminder } = task;
  if (!reminder.enabled || !reminder.at) return reminder.repeat === 'daily' ? '🔁' : null;
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

/** Regroupe des tâches dans une seule carte (moins de cadres = moins de bruit visuel). */
export function TaskGroup({ children }: { children: ReactNode }) {
  const { colors, radius } = useAppTheme();
  return <View style={{ backgroundColor: colors.card, borderRadius: radius, overflow: 'hidden' }}>{children}</View>;
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
  const { colors, fontScale } = useAppTheme();
  const { moveTask } = useData();
  const { completeStep } = useTaskActions();
  const timer = useTimer();
  const { parent } = useAuth();
  const fromParent = parent && task.createdBy === parent.id ? parent : null;
  const [open, setOpen] = useState(false);
  const stepsDone = task.steps.filter((s) => s.done).length;

  // Une seule ligne d'informations, courte.
  const meta = [
    task.durationMin ? `${task.durationMin} min` : null,
    task.steps.length > 0 ? `${stepsDone}/${task.steps.length} étapes` : null,
    reminderLabel(task),
    fromParent ? `de ${fromParent.name}` : null,
  ].filter(Boolean);

  const startTimer = () => {
    timer.start(task.durationMin ?? 5, `${task.emoji} ${task.title}`, task.id);
    router.navigate('/timer');
  };

  return (
    <View style={[styles.item, !isFirst && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: task.done }}
          accessibilityLabel={`${task.done ? 'Décocher' : 'Cocher'} ${task.title}`}
          onPress={() => onToggle(task)}
          hitSlop={10}
          style={[
            styles.check,
            { borderColor: task.done ? colors.success : colors.textMuted, backgroundColor: task.done ? colors.success : 'transparent' },
          ]}
        >
          {task.done ? <Text style={styles.checkMark}>✓</Text> : null}
        </Pressable>

        <Pressable
          style={styles.body}
          onPress={() => setOpen((o) => !o)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`${open ? 'Replier' : 'Déplier'} ${task.title}`}
        >
          <Text style={{ fontSize: 24 }}>{task.emoji}</Text>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt
              style={{
                fontSize: 17 * fontScale,
                fontWeight: '600',
                color: task.done ? colors.textMuted : colors.text,
                textDecorationLine: task.done ? 'line-through' : 'none',
              }}
              numberOfLines={open ? undefined : 2}
            >
              {task.title}
            </Txt>
            {meta.length > 0 ? (
              <Txt variant="small" numberOfLines={1}>
                {meta.join(' · ')}
              </Txt>
            ) : null}
          </View>
          <Text style={{ color: colors.textMuted, fontSize: 16 }}>{open ? '▾' : '▸'}</Text>
        </Pressable>
      </View>

      {open && (
        <View style={styles.details}>
          {task.steps.map((s) => (
            <Pressable
              key={s.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: s.done }}
              onPress={() => completeStep(task, s)}
              style={styles.step}
            >
              <View style={[styles.stepBox, { borderColor: s.done ? colors.success : colors.textMuted, backgroundColor: s.done ? colors.success : 'transparent' }]}>
                {s.done ? <Text style={[styles.checkMark, { fontSize: 14 }]}>✓</Text> : null}
              </View>
              <Txt style={{ flex: 1, color: s.done ? colors.textMuted : colors.text, textDecorationLine: s.done ? 'line-through' : 'none' }}>
                {s.title}
              </Txt>
            </Pressable>
          ))}
          <View style={styles.actions}>
            {!task.done && <Button size="sm" variant="secondary" label="▶ Timer" accessibilityLabel={`Lancer le timer pour ${task.title}`} onPress={startTimer} />}
            <Button size="sm" variant="secondary" label="Modifier" onPress={() => router.push(`/task/${task.id}`)} />
            {!isFirst && <Button size="sm" variant="ghost" label="↑" accessibilityLabel="Monter" onPress={() => moveTask(task.id, -1)} />}
            {!isLast && <Button size="sm" variant="ghost" label="↓" accessibilityLabel="Descendre" onPress={() => moveTask(task.id, 1)} />}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  item: { paddingHorizontal: 14, paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  check: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkMark: { color: '#FFFFFF', fontWeight: '900', fontSize: 17 },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  details: { gap: 12, marginTop: 12, paddingLeft: 42 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  stepBox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
