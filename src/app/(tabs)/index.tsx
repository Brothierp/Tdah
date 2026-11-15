import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { FocusCard } from '@/components/FocusCard';
import { RewardGoal } from '@/components/RewardBar';
import { TaskGroup, TaskItem } from '@/components/TaskItem';
import { Button, Card, Fab, Screen, Txt } from '@/components/ui';
import { useTaskActions } from '@/components/useTaskActions';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data';
import { upcomingTasks } from '@/lib/moments';
import { formatDuration, useTimer } from '@/lib/timer';
import { useAppTheme } from '@/lib/useAppTheme';

/**
 * Accueil volontairement minimal :
 *  1. la tâche à faire maintenant, en grand ;
 *  2. la suite, en liste simple (case + titre) ;
 *  3. un bouton + pour ajouter.
 */
export default function TodayScreen() {
  const { user } = useAuth();
  const { ready, tasks, settings, refresh } = useData();
  const timer = useTimer();
  const { colors } = useAppTheme();
  const { toggle } = useTaskActions();
  const [showDone, setShowDone] = useState(false);

  if (!user) return null;
  if (!ready) return <ActivityIndicator style={{ marginTop: 80 }} color={colors.primary} size="large" />;
  if (!settings.onboarded) return <Redirect href="/welcome" />;

  const upcoming = upcomingTasks(tasks);
  const [now, ...later] = upcoming;
  const done = tasks.filter((t) => t.done);
  const timerActive = timer.status === 'running' || timer.status === 'paused';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Screen onRefresh={refresh}>
        <View style={styles.header}>
          <Txt variant="title" numberOfLines={1} style={{ flex: 1 }}>
            Salut {user.name}
          </Txt>
          <Text style={[styles.stars, { color: colors.text }]} accessibilityLabel={`${settings.stars} étoiles`}>
            ⭐ {settings.stars}
          </Text>
        </View>

        <RewardGoal />

        {timerActive && (
          <Pressable onPress={() => router.navigate('/timer')} accessibilityRole="button" accessibilityLabel="Ouvrir le timer">
            <Card style={[styles.timerBanner, { backgroundColor: colors.primary }]}>
              <Text style={[styles.timerText, { color: colors.primaryText, flex: 1 }]} numberOfLines={1}>
                ⏳ {timer.label || 'Timer'}
              </Text>
              <Text style={[styles.timerText, { color: colors.primaryText, fontVariant: ['tabular-nums'] }]}>
                {timer.status === 'paused' ? 'pause' : formatDuration(timer.remainingSec)}
              </Text>
            </Card>
          </Pressable>
        )}

        {tasks.length === 0 ? (
          <Card style={styles.empty}>
            <Text style={{ fontSize: 44 }}>🌱</Text>
            <Txt variant="subtitle">Rien pour l’instant</Txt>
            <Txt variant="muted" style={{ textAlign: 'center' }}>
              Touche + pour ajouter une tâche.
            </Txt>
            <Button label="Choisir une routine toute prête" variant="secondary" onPress={() => router.push('/templates')} style={{ alignSelf: 'stretch' }} />
          </Card>
        ) : now ? (
          <FocusCard task={now} canPostpone={later.length > 0} />
        ) : (
          <Card style={styles.empty}>
            <Text style={{ fontSize: 44 }}>🏆</Text>
            <Txt variant="subtitle">Tout est fait !</Txt>
          </Card>
        )}

        {later.length > 0 && (
          <View style={{ gap: 8 }}>
            <Txt variant="label">Ensuite</Txt>
            <TaskGroup>
              {later.map((t, i) => (
                <TaskItem key={t.id} task={t} onToggle={toggle} isFirst={i === 0} />
              ))}
            </TaskGroup>
          </View>
        )}

        {done.length > 0 && (
          <View style={{ gap: 8 }}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: showDone }} onPress={() => setShowDone((s) => !s)}>
              <Txt variant="label">
                {showDone ? '▾' : '▸'} Faites ({done.length})
              </Txt>
            </Pressable>
            {showDone && (
              <TaskGroup>
                {done.map((t, i) => (
                  <TaskItem key={t.id} task={t} onToggle={toggle} isFirst={i === 0} />
                ))}
              </TaskGroup>
            )}
          </View>
        )}
      </Screen>

      <Fab accessibilityLabel="Ajouter une tâche" onPress={() => router.push('/task/new')} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 4 },
  stars: { fontSize: 18, fontWeight: '800' },
  timerBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  timerText: { fontSize: 17, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 28 },
});
