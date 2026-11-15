import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Txt } from '@/components/ui';
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

/** Une ligne de tâche épurée : case à cocher, image, titre. Toucher le titre ouvre la tâche. */
export function TaskItem({ task, onToggle, isFirst }: { task: Task; onToggle: (task: Task) => void; isFirst: boolean }) {
  const { colors, fontScale } = useAppTheme();
  return (
    <View style={[styles.row, !isFirst && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.done }}
        accessibilityLabel={`${task.done ? 'Décocher' : 'Cocher'} ${task.title}`}
        onPress={() => onToggle(task)}
        hitSlop={12}
        style={[styles.check, { borderColor: task.done ? colors.success : colors.textMuted, backgroundColor: task.done ? colors.success : 'transparent' }]}
      >
        {task.done ? <Text style={styles.checkMark}>✓</Text> : null}
      </Pressable>
      <Pressable
        style={styles.body}
        onPress={() => router.push(`/task/${task.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`Ouvrir ${task.title}`}
      >
        <Text style={{ fontSize: 22 }}>{task.emoji}</Text>
        <Txt
          numberOfLines={2}
          style={{
            flex: 1,
            fontSize: 17 * fontScale,
            color: task.done ? colors.textMuted : colors.text,
            textDecorationLine: task.done ? 'line-through' : 'none',
          }}
        >
          {task.title}
        </Txt>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  check: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkMark: { color: '#FFFFFF', fontWeight: '900', fontSize: 16 },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 32 },
});
