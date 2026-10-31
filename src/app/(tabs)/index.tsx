import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFeedback } from '@/components/Feedback';
import { FocusCard } from '@/components/FocusCard';
import { RewardBar } from '@/components/RewardBar';
import { TaskItem } from '@/components/TaskItem';
import { Button, Card, Screen, Segmented, Txt } from '@/components/ui';
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
    <Screen onRefresh={refresh}>
      <View style={{ gap: 2 }}>
        <Txt variant="title">
          {user.avatar} Salut {user.name} !
        </Txt>
        <Txt variant="muted" style={{ textTransform: 'capitalize' }}>
          {todayLabel()} · {momentLabel(now)}
        </Txt>
      </View>

      <RewardBar />

      {timerActive && (
        <Pressable onPress={() => router.navigate('/timer')} accessibilityRole="button" accessibilityLabel="Ouvrir le timer">
          <Card style={{ backgroundColor: colors.primarySoft, borderColor: colors.primary, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Text style={{ fontSize: 24 }}>⏳</Text>
            <Txt style={{ flex: 1, fontWeight: '700' }} numberOfLines={1}>
              {timer.label || 'Timer'} — {formatDuration(timer.remainingSec)}
              {timer.status === 'paused' ? ' (pause)' : ''}
            </Txt>
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
        <>
          <FocusCard upcoming={upcoming} />
          <QuickAdd />
        </>
      ) : (
        <>
          <QuickAdd />

          {tasks.length === 0 && (
            <Card style={{ alignItems: 'center', gap: 8, paddingVertical: 24 }}>
              <Text style={{ fontSize: 48 }}>🌱</Text>
              <Txt variant="subtitle">Rien pour l’instant</Txt>
              <Txt variant="muted" style={{ textAlign: 'center' }}>
                Écris une petite tâche ci-dessus, ou choisis une routine toute prête.
              </Txt>
            </Card>
          )}

          {todo.length > 0 && (
            <View
              style={[styles.progress, { backgroundColor: colors.primarySoft, borderRadius: radius }]}
              accessibilityLabel={`${done.length} tâches faites sur ${tasks.length}`}
            >
              <View
                style={{ width: `${(done.length / tasks.length) * 100}%`, height: '100%', backgroundColor: colors.success, borderRadius: radius }}
              />
            </View>
          )}

          {groupByMoment(todo).map((group) => (
            <View key={group.moment ?? 'libre'} style={{ gap: 10 }}>
              <View style={styles.groupHeader}>
                <Txt variant="subtitle">{momentLabel(group.moment)}</Txt>
                {group.moment === now && (
                  <View style={[styles.nowBadge, { backgroundColor: colors.primary }]}>
                    <Text style={{ color: colors.primaryText, fontWeight: '800', fontSize: 13 }}>MAINTENANT</Text>
                  </View>
                )}
              </View>
              {group.tasks.map((t, i) => (
                <TaskItem key={t.id} task={t} onToggle={toggle} isFirst={i === 0} isLast={i === group.tasks.length - 1} />
              ))}
            </View>
          ))}

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
                    <TaskItem key={t.id} task={t} onToggle={toggle} isFirst={i === 0} isLast={i === done.length - 1} />
                  ))}
                  <Button variant="secondary" label="🧹 Ranger les tâches faites" onPress={clearDone} />
                  <Txt variant="small" style={{ textAlign: 'center' }}>
                    Les routines de chaque jour sont gardées : elles reviennent demain.
                  </Txt>
                </>
              )}
            </View>
          )}
        </>
      )}

      <View style={styles.actions}>
        <Button label="＋ Tâche détaillée" variant="secondary" onPress={() => router.push('/task/new')} style={{ flex: 1 }} />
        <Button label="💡 Idées" variant="secondary" onPress={() => router.push('/templates')} style={{ flex: 1 }} />
      </View>
    </Screen>
  );
}

/** Ajout rapide en une ligne : capturer une idée avant qu'elle s'envole. */
function QuickAdd() {
  const { addTask } = useData();
  const { toast } = useFeedback();
  const { colors, radius, fontScale } = useAppTheme();
  const [title, setTitle] = useState('');

  const submit = async () => {
    const clean = title.trim();
    if (!clean) return;
    setTitle('');
    await addTask({
      title: clean,
      emoji: '📝',
      durationMin: null,
      steps: [],
      moment: null,
      reminder: { enabled: false, at: null, repeat: 'none', nudge: true },
    });
    toast('Ajoutée ✔');
  };

  return (
    <View style={[styles.quick, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: radius }]}>
      <TextInput
        value={title}
        onChangeText={setTitle}
        onSubmitEditing={submit}
        placeholder="Ajouter vite une tâche…"
        placeholderTextColor={colors.textMuted}
        returnKeyType="done"
        maxLength={80}
        accessibilityLabel="Ajouter vite une tâche"
        style={{ flex: 1, fontSize: 17 * fontScale, color: colors.text, paddingVertical: 12 }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ajouter"
        onPress={submit}
        disabled={!title.trim()}
        style={[styles.quickButton, { backgroundColor: title.trim() ? colors.primary : colors.primarySoft }]}
      >
        <Text style={{ color: title.trim() ? colors.primaryText : colors.primary, fontSize: 26, fontWeight: '800' }}>＋</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  progress: { height: 12, overflow: 'hidden' },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  nowBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  actions: { flexDirection: 'row', gap: 10 },
  quick: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 14, paddingRight: 6, borderWidth: 1 },
  quickButton: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
});
