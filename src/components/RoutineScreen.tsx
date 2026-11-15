import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data';
import { tabInfo, tasksOfTab, type RoutineTab } from '@/lib/moments';
import { formatDuration, useTimer } from '@/lib/timer';
import { useAppTheme } from '@/lib/useAppTheme';
import { FocusCard } from './FocusCard';
import { RewardGoal } from './RewardBar';
import { TaskGroup, TaskItem } from './TaskItem';
import { Button, Card, Fab, Screen, Txt } from './ui';
import { useTaskActions } from './useTaskActions';

/**
 * Un onglet = un moment de la journée (matin, journée, soir).
 * En haut, la tâche à faire maintenant ; en dessous, la suite ; un bouton + pour ajouter.
 */
export function RoutineScreen({ tab }: { tab: RoutineTab }) {
  const { user } = useAuth();
  const { tasks, settings, refresh } = useData();
  const timer = useTimer();
  const { colors } = useAppTheme();
  const { toggle } = useTaskActions();
  const [showDone, setShowDone] = useState(false);
  if (!user) return null;

  const info = tabInfo(tab);
  const mine = tasksOfTab(tasks, tab);
  const [now, ...later] = mine.filter((t) => !t.done);
  const done = mine.filter((t) => t.done);
  const timerActive = timer.status === 'running' || timer.status === 'paused';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Screen onRefresh={refresh}>
        <View style={styles.header}>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="title">
              {info.emoji} {info.title}
            </Txt>
            <View style={styles.sub}>
              <Txt variant="muted">Salut {user.name}</Txt>
              <Txt variant="muted">{` · ⭐ ${settings.stars}`}</Txt>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ouvrir le timer"
            onPress={() => router.navigate('/timer')}
            hitSlop={8}
            style={[styles.round, { backgroundColor: colors.card }]}
          >
            <Text style={{ fontSize: 22 }}>⏳</Text>
          </Pressable>
        </View>

        <RewardGoal />

        {timerActive && (
          <Pressable onPress={() => router.navigate('/timer')} accessibilityRole="button" accessibilityLabel="Voir le timer en cours">
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

        {mine.length === 0 ? (
          <Card style={styles.empty}>
            <Text style={{ fontSize: 44 }}>{info.emoji}</Text>
            <Txt variant="subtitle" style={{ textAlign: 'center' }}>
              Rien pour l’instant
            </Txt>
            <Txt variant="muted" style={{ textAlign: 'center' }}>
              Touche + pour ajouter une tâche.
            </Txt>
          </Card>
        ) : now ? (
          <FocusCard task={now} canPostpone={later.length > 0} />
        ) : (
          <Card style={styles.empty}>
            <Text style={{ fontSize: 44 }}>🏆</Text>
            <Txt variant="subtitle" style={{ textAlign: 'center' }}>
              {tab === 'soir' ? 'Routine finie. Bonne nuit !' : tab === 'matin' ? 'Routine finie. Bonne journée !' : 'Tout est fait !'}
            </Txt>
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

        {mine.length === 0 && (
          <Button variant="ghost" size="sm" label="Ou choisir une routine toute prête" onPress={() => router.push('/templates')} />
        )}
      </Screen>

      <Fab accessibilityLabel="Ajouter une tâche" onPress={() => router.push({ pathname: '/task/[id]', params: { id: 'new', tab } })} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 4 },
  sub: { flexDirection: 'row', flexWrap: 'wrap' },
  round: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  timerBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  timerText: { fontSize: 17, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 28 },
});
