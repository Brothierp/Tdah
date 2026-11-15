import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { FocusCard } from '@/components/FocusCard';
import { RewardGoal, RewardPill } from '@/components/RewardBar';
import { TaskGroup, TaskItem } from '@/components/TaskItem';
import { Button, Card, Fab, Screen, Segmented, Txt } from '@/components/ui';
import { useTaskActions } from '@/components/useTaskActions';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data';
import { currentMoment, groupByMoment, momentLabel, upcomingTasks } from '@/lib/moments';
import { formatDuration, useTimer } from '@/lib/timer';
import { useAppTheme } from '@/lib/useAppTheme';

function todayLabel() {
  return new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function TodayScreen() {
  const { user } = useAuth();
  const { ready, tasks, settings, updateSettings, clearDone, refresh } = useData();
  const timer = useTimer();
  const { colors, radius } = useAppTheme();
  const { toggle } = useTaskActions();
  const [showDone, setShowDone] = useState(false);

  if (!user) return null;
  // On attend les données : évite d'afficher l'écran une fraction de seconde avant l'accueil guidé.
  if (!ready) return <ActivityIndicator style={{ marginTop: 80 }} color={colors.primary} size="large" />;
  // Premier lancement : accueil guidé.
  if (!settings.onboarded) return <Redirect href="/welcome" />;

  const view = settings.homeView ?? (user.ageGroup === 'enfant' ? 'focus' : 'list');
  const upcoming = upcomingTasks(tasks);
  const todo = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  const now = currentMoment();
  const timerActive = timer.status === 'running' || timer.status === 'paused';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Screen onRefresh={refresh}>
        {/* En-tête : qui, quand, combien d'étoiles. Rien d'autre. */}
        <View style={styles.header}>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="title" numberOfLines={1}>
              Salut {user.name} !
            </Txt>
            <Txt variant="muted" style={{ textTransform: 'capitalize' }}>
              {todayLabel()} · {momentLabel(now)}
            </Txt>
          </View>
          <RewardPill />
        </View>

        <RewardGoal />

        {timerActive && (
          <Pressable onPress={() => router.navigate('/timer')} accessibilityRole="button" accessibilityLabel="Ouvrir le timer">
            <Card style={[styles.timerBanner, { backgroundColor: colors.primary }]}>
              <Text style={{ fontSize: 20 }}>⏳</Text>
              <Text style={[styles.timerText, { color: colors.primaryText, flex: 1 }]} numberOfLines={1}>
                {timer.label || 'Timer'}
              </Text>
              <Text style={[styles.timerText, { color: colors.primaryText, fontVariant: ['tabular-nums'] }]}>
                {timer.status === 'paused' ? 'pause' : formatDuration(timer.remainingSec)}
              </Text>
            </Card>
          </Pressable>
        )}

        <Segmented
          value={view}
          onChange={(v) => updateSettings({ homeView: v })}
          options={[
            { value: 'focus', label: '🎯 Une à la fois' },
            { value: 'list', label: '📋 Ma journée' },
          ]}
        />

        {view === 'focus' ? (
          <FocusCard upcoming={upcoming} />
        ) : tasks.length === 0 ? (
          <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 28 }}>
            <Text style={{ fontSize: 44 }}>🌱</Text>
            <Txt variant="subtitle">Ta journée est vide</Txt>
            <Txt variant="muted" style={{ textAlign: 'center' }}>
              Ajoute une petite tâche, ou commence avec une routine toute prête.
            </Txt>
            <Button label="💡 Choisir une routine" variant="secondary" onPress={() => router.push('/templates')} style={{ alignSelf: 'stretch' }} />
          </Card>
        ) : (
          <>
            <View style={{ gap: 8 }}>
              <Txt variant="muted">
                {todo.length === 0 ? 'Tout est fait 🎉' : `${done.length} sur ${tasks.length} faite${done.length > 1 ? 's' : ''}`}
              </Txt>
              <View
                style={[styles.progress, { backgroundColor: colors.card, borderRadius: radius }]}
                accessibilityLabel={`${done.length} tâches faites sur ${tasks.length}`}
              >
                <View style={{ width: `${(done.length / tasks.length) * 100}%`, height: '100%', backgroundColor: colors.success, borderRadius: radius }} />
              </View>
            </View>

            {groupByMoment(todo).map((group) => (
              <View key={group.moment ?? 'libre'} style={{ gap: 8 }}>
                <View style={styles.groupHeader}>
                  <Txt variant="label" style={group.moment === now ? { color: colors.primary } : undefined}>
                    {momentLabel(group.moment)}
                  </Txt>
                  {group.moment === now && (
                    <Txt variant="label" style={{ color: colors.primary }}>
                      · maintenant
                    </Txt>
                  )}
                </View>
                <TaskGroup>
                  {group.tasks.map((t, i) => (
                    <TaskItem key={t.id} task={t} onToggle={toggle} isFirst={i === 0} isLast={i === group.tasks.length - 1} />
                  ))}
                </TaskGroup>
              </View>
            ))}

            {done.length > 0 && (
              <View style={{ gap: 8 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showDone }}
                  onPress={() => setShowDone((s) => !s)}
                  style={styles.groupHeader}
                >
                  <Txt variant="label">
                    {showDone ? '▾' : '▸'} Faites ({done.length})
                  </Txt>
                </Pressable>
                {showDone && (
                  <>
                    <TaskGroup>
                      {done.map((t, i) => (
                        <TaskItem key={t.id} task={t} onToggle={toggle} isFirst={i === 0} isLast={i === done.length - 1} />
                      ))}
                    </TaskGroup>
                    <Button variant="ghost" size="sm" label="Ranger les tâches faites" onPress={clearDone} />
                  </>
                )}
              </View>
            )}
          </>
        )}
      </Screen>

      <Fab accessibilityLabel="Ajouter une tâche" onPress={() => router.push('/task/new')} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timerBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  timerText: { fontSize: 17, fontWeight: '700' },
  progress: { height: 8, overflow: 'hidden' },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
});
