import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatTime, reminderLabel } from '@/components/TaskItem';
import { Button, Card, ErrorText, Field, Screen, Txt } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useChildData } from '@/lib/childData';
import { confirm } from '@/lib/confirm';
import { doneTodayCount } from '@/lib/taskOps';
import { AGE_GROUPS } from '@/lib/theme';
import type { Task } from '@/lib/types';
import { useAppTheme } from '@/lib/useAppTheme';

/** Suivi d'un enfant par son parent. */
export default function ChildScreen() {
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const { child, ready, tasks, settings } = useChildData(childId);
  const { unlinkChild, resetChildPassword, deleteChild } = useAuth();
  const { colors } = useAppTheme();
  const [newPassword, setNewPassword] = useState('');
  const [pwMessage, setPwMessage] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [parentPassword, setParentPassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!child) {
    return (
      <Screen edges={[]}>
        <Txt>Ce compte ne fait pas partie de ta famille.</Txt>
        <Button label="Retour" onPress={() => router.back()} />
      </Screen>
    );
  }
  if (!ready) return <ActivityIndicator style={{ marginTop: 40 }} />;

  const todo = tasks.filter((t) => !t.done);
  const doneToday = tasks.filter((t) => t.done);
  const age = AGE_GROUPS.find((g) => g.value === child.ageGroup);
  const editTask = (t: Task) => router.push({ pathname: '/task/[id]', params: { id: t.id, owner: child.id } });

  const resetPassword = async () => {
    setPwError(null);
    setPwMessage(null);
    try {
      await resetChildPassword(child.id, newPassword);
      setNewPassword('');
      setPwMessage(`Nouveau mot de passe enregistré pour ${child.name} ✅`);
    } catch (e) {
      setPwError((e as Error).message);
    }
  };

  const unlink = async () => {
    if (await confirm(`Ne plus suivre ${child.name} ?`, 'Son compte et ses tâches sont conservés.', 'Ne plus suivre')) {
      await unlinkChild(child.id);
      router.back();
    }
  };

  const remove = async () => {
    setDeleteError(null);
    if (!(await confirm(`Supprimer le compte de ${child.name} ?`, 'Ses tâches seront effacées. C’est définitif.', 'Supprimer'))) {
      return;
    }
    try {
      await deleteChild(child.id, parentPassword);
      router.back();
    } catch (e) {
      setDeleteError((e as Error).message);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: `${child.avatar} ${child.name}` }} />

      <Card style={{ gap: 6 }}>
        <Txt variant="subtitle">
          {doneTodayCount(tasks)} faite{doneTodayCount(tasks) > 1 ? 's' : ''} aujourd’hui · {todo.length} à faire
        </Txt>
        <Txt variant="small">
          {age?.emoji} {age?.label} · identifiant : {child.username}
        </Txt>
        <Txt variant="small">
          {settings.remindersEnabled ? '🔔 Rappels activés sur son compte' : '🔕 Rappels coupés sur son compte'}
        </Txt>
      </Card>

      <Button label={`＋ Ajouter une tâche pour ${child.name}`} onPress={() => router.push({ pathname: '/task/[id]', params: { id: 'new', owner: child.id } })} />

      <Txt variant="subtitle">À faire</Txt>
      {todo.length === 0 && <Txt variant="muted">Rien en attente 🎉</Txt>}
      {todo.map((t) => (
        <ChildTaskRow key={t.id} task={t} onPress={() => editTask(t)} />
      ))}

      {doneToday.length > 0 && <Txt variant="subtitle">Faites</Txt>}
      {doneToday.map((t) => (
        <ChildTaskRow key={t.id} task={t} onPress={() => editTask(t)} />
      ))}

      <Card style={{ gap: 10 }}>
        <Txt variant="subtitle">🔑 Mot de passe oublié ?</Txt>
        <Field label={`Nouveau mot de passe pour ${child.name}`} value={newPassword} onChangeText={setNewPassword} secureTextEntry />
        <ErrorText message={pwError} />
        {pwMessage ? <Txt style={{ color: colors.success, fontWeight: '600' }}>{pwMessage}</Txt> : null}
        <Button variant="secondary" label="Changer son mot de passe" onPress={resetPassword} disabled={!newPassword} />
      </Card>

      <Button variant="secondary" label="Ne plus suivre ce compte" onPress={unlink} />

      <Card style={{ gap: 10, borderColor: colors.danger }}>
        <Txt variant="subtitle">Supprimer son compte</Txt>
        <Field label="Confirme avec TON mot de passe" value={parentPassword} onChangeText={setParentPassword} secureTextEntry />
        <ErrorText message={deleteError} />
        <Button variant="danger" label="Supprimer définitivement" onPress={remove} disabled={!parentPassword} />
      </Card>
    </Screen>
  );
}

function ChildTaskRow({ task, onPress }: { task: Task; onPress: () => void }) {
  const { colors, radius } = useAppTheme();
  const steps = task.steps.length ? `🪜 ${task.steps.filter((s) => s.done).length}/${task.steps.length}` : null;
  const meta = [
    task.done && task.doneAt ? `✅ à ${formatTime(task.doneAt)}` : null,
    reminderLabel(task),
    task.durationMin ? `⏱ ${task.durationMin} min` : null,
    steps,
  ].filter(Boolean);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Modifier ${task.title}`} onPress={onPress}>
      <View
        style={[
          styles.row,
          {
            backgroundColor: task.done ? colors.successSoft : colors.card,
            borderColor: task.done ? colors.success : colors.border,
            borderRadius: radius,
          },
        ]}
      >
        <Text style={{ fontSize: 26 }}>{task.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Txt style={{ fontWeight: '700', textDecorationLine: task.done ? 'line-through' : 'none' }}>{task.title}</Txt>
          {meta.length > 0 && <Txt variant="small">{meta.join(' · ')}</Txt>}
        </View>
        <Txt style={{ color: colors.primary }}>✏️</Txt>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1.5 },
});
