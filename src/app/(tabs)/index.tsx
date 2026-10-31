import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { TaskItem } from '@/components/TaskItem';
import { Button, Card, Screen, Txt } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data';
import { randomCheer } from '@/lib/theme';
import { formatDuration, useTimer } from '@/lib/timer';
import type { Task } from '@/lib/types';
import { useAppTheme } from '@/lib/useAppTheme';

function todayLabel() {
  return new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function TasksScreen() {
  const { user } = useAuth();
  const { tasks, toggleTask, clearDone, settings } = useData();
  const timer = useTimer();
  const { colors, radius, playful } = useAppTheme();
  const [showDone, setShowDone] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [toastOpacity] = useState(() => new Animated.Value(0));

  const todo = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  const progress = tasks.length ? done.length / tasks.length : 0;

  useEffect(() => {
    if (!toast) return;
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
      Animated.delay(1400),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: Platform.OS !== 'web' }),
    ]).start(() => setToast(null));
  }, [toast, toastOpacity]);

  const onToggle = async (task: Task) => {
    const nowDone = await toggleTask(task.id);
    if (nowDone && user) {
      setToast(randomCheer(user.ageGroup));
      if (settings.hapticsEnabled && Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    }
  };

  if (!user) return null;
  const timerActive = timer.status === 'running' || timer.status === 'paused';

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <View style={{ gap: 2 }}>
          <Txt variant="title">
            {user.avatar} Salut {user.name} !
          </Txt>
          <Txt variant="muted" style={{ textTransform: 'capitalize' }}>
            {todayLabel()}
          </Txt>
        </View>

        {timerActive && (
          <Pressable onPress={() => router.navigate('/timer')} accessibilityRole="button">
            <Card style={{ backgroundColor: colors.primarySoft, borderColor: colors.primary, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Text style={{ fontSize: 24 }}>⏳</Text>
              <Txt style={{ flex: 1, fontWeight: '700' }} numberOfLines={1}>
                {timer.label || 'Timer'} — {formatDuration(timer.remainingSec)}
                {timer.status === 'paused' ? ' (pause)' : ''}
              </Txt>
            </Card>
          </Pressable>
        )}

        {tasks.length > 0 && (
          <Card style={{ gap: 10 }}>
            <Txt variant="subtitle">
              {todo.length === 0
                ? playful
                  ? 'Tout est fait, bravo ! 🏆'
                  : 'Tout est fait ✅'
                : `${done.length} / ${tasks.length} ${playful ? 'faites 💪' : 'terminées'}`}
            </Txt>
            <View style={[styles.bar, { backgroundColor: colors.primarySoft, borderRadius: radius }]}>
              <View
                style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: colors.success, borderRadius: radius }}
              />
            </View>
          </Card>
        )}

        {tasks.length === 0 && (
          <Card style={{ alignItems: 'center', gap: 8, paddingVertical: 28 }}>
            <Text style={{ fontSize: 48 }}>🌱</Text>
            <Txt variant="subtitle">Rien pour l’instant</Txt>
            <Txt variant="muted" style={{ textAlign: 'center' }}>
              Ajoute une première petite tâche. Plus elle est simple, plus c’est facile de commencer !
            </Txt>
          </Card>
        )}

        {todo.length > 0 && <Txt variant="subtitle">À faire</Txt>}
        {todo.map((t, i) => (
          <TaskItem key={t.id} task={t} onToggle={onToggle} isFirst={i === 0} isLast={i === todo.length - 1} />
        ))}

        <Button label="＋ Ajouter une tâche" onPress={() => router.push('/task/new')} />

        {done.length > 0 && (
          <View style={{ gap: 12 }}>
            <Button
              variant="ghost"
              label={`${showDone ? '▾' : '▸'} Faites (${done.length})`}
              onPress={() => setShowDone((s) => !s)}
              style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }}
            />
            {showDone && (
              <>
                {done.map((t, i) => (
                  <TaskItem key={t.id} task={t} onToggle={onToggle} isFirst={i === 0} isLast={i === done.length - 1} />
                ))}
                <Button variant="secondary" label="🧹 Effacer les tâches faites" onPress={clearDone} />
                <Txt variant="small" style={{ textAlign: 'center' }}>
                  Les routines quotidiennes sont gardées : elles reviennent demain.
                </Txt>
              </>
            )}
          </View>
        )}
      </Screen>

      {toast && (
        <Animated.View
          pointerEvents="none"
          style={[styles.toast, { opacity: toastOpacity, backgroundColor: colors.success, borderRadius: radius }]}
        >
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 14, overflow: 'hidden' },
  toast: { position: 'absolute', bottom: 24, alignSelf: 'center', paddingHorizontal: 22, paddingVertical: 14 },
  toastText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
});
