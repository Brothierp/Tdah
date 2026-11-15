import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Chip, EmojiGrid, ErrorText, Field, Screen, Section, Stepper, ToggleRow, Txt } from '@/components/ui';
import { useAppTheme } from '@/lib/useAppTheme';
import { confirm } from '@/lib/confirm';
import { useChildData } from '@/lib/childData';
import { useData } from '@/lib/data';
import type { TaskInput } from '@/lib/taskOps';
import { ensurePermission, notificationsSupported } from '@/lib/notifications';
import { TASK_EMOJIS } from '@/lib/theme';
import { useTaskActions } from '@/components/useTaskActions';
import { ANYTIME, MOMENTS, momentInfo } from '@/lib/moments';
import type { Moment, ReminderRepeat, Settings, Task } from '@/lib/types';

const DURATIONS = [5, 10, 15, 25, 45];
const pad = (n: number) => String(n).padStart(2, '0');

function defaultReminderDate() {
  const d = new Date(Date.now() + 60 * 60_000);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  return d;
}

interface TaskStore {
  tasks: Task[];
  settings: Settings;
  addTask: (input: TaskInput) => Promise<unknown>;
  updateTask: (id: string, input: TaskInput) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
}

/**
 * Créer (id = "new") ou modifier une tâche.
 * Avec le paramètre `owner`, un parent agit sur la liste d'un de ses enfants.
 */
export default function TaskForm() {
  const { id, owner } = useLocalSearchParams<{ id: string; owner?: string }>();
  const own = useData();
  const childData = useChildData(owner ?? null);

  if (owner && !childData.child) {
    return (
      <Screen edges={[]}>
        <Txt>Ce compte ne fait pas partie de ta famille.</Txt>
        <Button label="Retour" onPress={() => router.back()} />
      </Screen>
    );
  }
  const store: TaskStore = owner ? childData : own;
  if (owner && !childData.ready) return <ActivityIndicator style={{ marginTop: 40 }} />;

  const existing = id !== 'new' ? store.tasks.find((t) => t.id === id) : undefined;
  if (id !== 'new' && !existing) {
    return (
      <Screen edges={[]}>
        <Txt>Cette tâche n’existe plus.</Txt>
        <Button label="Retour" onPress={() => router.back()} />
      </Screen>
    );
  }
  return <TaskFormInner existing={existing} store={store} ownerName={childData.child?.name ?? null} ownerId={owner ?? null} />;
}

function TaskFormInner({
  existing,
  store,
  ownerName,
  ownerId,
}: {
  existing?: Task;
  store: TaskStore;
  ownerName: string | null;
  ownerId: string | null;
}) {
  const { addTask, updateTask, deleteTask, settings } = store;
  const { colors } = useAppTheme();
  const [showEmojis, setShowEmojis] = useState(false);
  const { remove: removeWithUndo } = useTaskActions();

  const initialDate = existing?.reminder.at ? new Date(existing.reminder.at) : defaultReminderDate();
  const isTomorrow = (d: Date) => d.toDateString() !== new Date().toDateString() && d > new Date();

  const [title, setTitle] = useState(existing?.title ?? '');
  const [emoji, setEmoji] = useState(existing?.emoji ?? TASK_EMOJIS[0]);
  const [duration, setDuration] = useState<number | null>(existing?.durationMin ?? null);
  const [steps, setSteps] = useState<string[]>(existing?.steps.map((s) => s.title) ?? []);
  const [reminderOn, setReminderOn] = useState(existing?.reminder.enabled ?? false);
  const [tomorrow, setTomorrow] = useState(isTomorrow(initialDate));
  const [hour, setHour] = useState(initialDate.getHours());
  const [minute, setMinute] = useState(initialDate.getMinutes());
  const [repeat, setRepeat] = useState<ReminderRepeat>(existing?.reminder.repeat ?? 'none');
  const [nudge, setNudge] = useState(existing?.reminder.nudge ?? true);
  const [moment, setMoment] = useState<Moment | null>(existing?.moment ?? null);

  const chooseMoment = (m: Moment | null) => {
    setMoment(m);
    // L'heure du rappel suit le moment choisi (modifiable ensuite).
    const info = momentInfo(m);
    if (info) {
      setHour(info.defaultTime[0]);
      setMinute(info.defaultTime[1]);
      const passed = new Date().getHours() * 60 + new Date().getMinutes() >= info.defaultTime[0] * 60 + info.defaultTime[1];
      setTomorrow(passed);
    }
  };
  const [error, setError] = useState<string | null>(null);

  const setIn = (minutes: number) => {
    const d = new Date(Date.now() + minutes * 60_000);
    d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
    setTomorrow(d.toDateString() !== new Date().toDateString());
    setHour(d.getHours());
    setMinute(d.getMinutes());
  };

  const reminderDate = () => {
    const d = new Date();
    if (tomorrow && repeat === 'none') d.setDate(d.getDate() + 1);
    d.setHours(hour, minute, 0, 0);
    return d;
  };

  const save = async () => {
    setError(null);
    if (!title.trim()) return setError('Donne un nom à ta tâche.');
    const at = reminderDate();
    if (reminderOn && repeat === 'none' && at.getTime() <= Date.now()) {
      return setError('Cette heure est déjà passée : choisis une heure plus tard ou « demain ».');
    }
    if (reminderOn && settings.remindersEnabled && notificationsSupported) {
      const granted = await ensurePermission();
      if (!granted) {
        Alert.alert('Notifications bloquées', 'Autorise les notifications pour Focus dans les réglages du téléphone pour recevoir tes rappels.');
      }
    }
    const input = {
      title,
      emoji,
      durationMin: duration,
      steps,
      moment,
      reminder: { enabled: reminderOn, at: reminderOn ? at.toISOString() : null, repeat, nudge },
    };
    if (existing) await updateTask(existing.id, input);
    else await addTask(input);
    router.back();
  };

  const remove = async () => {
    if (!existing) return;
    if (!ownerName) {
      // Sa propre tâche : suppression immédiate, avec « Annuler » pendant quelques secondes.
      router.back();
      await removeWithUndo(existing);
      return;
    }
    if (await confirm('Supprimer la tâche ?', existing.title, 'Supprimer')) {
      await deleteTask(existing.id);
      router.back();
    }
  };

  const hasOptions = !!existing && (existing.steps.length > 0 || existing.reminder.enabled || existing.durationMin != null || existing.reminder.repeat === 'daily');

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen
        options={{
          title: `${existing ? 'Modifier la tâche' : 'Nouvelle tâche'}${ownerName ? ` · ${ownerName}` : ''}`,
        }}
      />

      {!existing && (
        <Button
          variant="secondary"
          label="💡 Choisir une routine toute prête"
          onPress={() => router.replace(ownerId ? { pathname: '/templates', params: { owner: ownerId } } : '/templates')}
        />
      )}

      <Field
        label="Quoi ?"
        value={title}
        onChangeText={setTitle}
        placeholder="ex : Me brosser les dents"
        maxLength={80}
        autoFocus={!existing}
        returnKeyType="done"
        onSubmitEditing={save}
      />

      <View style={{ gap: 10 }}>
        <Txt variant="muted">Quand ?</Txt>
        <View style={styles.chips}>
          {MOMENTS.map((m) => (
            <Chip key={m.value} label={`${m.emoji} ${m.label}`} selected={moment === m.value} onPress={() => chooseMoment(m.value)} />
          ))}
          <Chip label={`${ANYTIME.emoji} ${ANYTIME.label}`} selected={moment === null} onPress={() => chooseMoment(null)} />
        </View>
      </View>

      <Section title="Plus d’options" initiallyOpen={hasOptions}>
        <Txt variant="small">Image, durée, étapes, tous les jours, rappel. Tout est facultatif.</Txt>

        <View style={styles.inline}>
          <Text style={{ fontSize: 34 }}>{emoji}</Text>
          <Txt style={{ flex: 1 }}>Image</Txt>
          <Button size="sm" variant="secondary" label={showEmojis ? 'Fermer' : 'Changer'} onPress={() => setShowEmojis((v) => !v)} />
        </View>
        {showEmojis && (
          <EmojiGrid
            options={TASK_EMOJIS}
            value={emoji}
            onChange={(e) => {
              setEmoji(e);
              setShowEmojis(false);
            }}
          />
        )}

        <View style={{ gap: 8 }}>
          <Txt>Durée (pour le timer)</Txt>
          <View style={styles.chips}>
            <Chip label="?" selected={duration === null} onPress={() => setDuration(null)} />
            {DURATIONS.map((m) => (
              <Chip key={m} label={`${m} min`} selected={duration === m} onPress={() => setDuration(m)} />
            ))}
          </View>
        </View>

        <ToggleRow
          label="Tous les jours"
          description="Une routine : elle revient « à faire » chaque matin."
          value={repeat === 'daily'}
          onValueChange={(v) => setRepeat(v ? 'daily' : 'none')}
        />

        <View style={{ gap: 8 }}>
          <Txt>Petites étapes</Txt>
          <Txt variant="small">Découper une grosse tâche aide à se lancer.</Txt>
          {steps.map((st, i) => (
            <View key={i} style={styles.inline}>
              <Txt variant="muted" style={{ width: 22 }}>
                {i + 1}.
              </Txt>
              <View style={{ flex: 1 }}>
                <TextInput
                  value={st}
                  onChangeText={(v) => setSteps((prev) => prev.map((x, j) => (j === i ? v : x)))}
                  placeholder={`Étape ${i + 1}`}
                  placeholderTextColor={colors.textMuted}
                  maxLength={80}
                  accessibilityLabel={`Étape ${i + 1}`}
                  style={[styles.stepInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.background }]}
                />
              </View>
              <Button
                size="sm"
                variant="ghost"
                label="✕"
                accessibilityLabel={`Retirer l'étape ${i + 1}`}
                onPress={() => setSteps((prev) => prev.filter((_, j) => j !== i))}
              />
            </View>
          ))}
          <Button size="sm" variant="secondary" label="+ Ajouter une étape" onPress={() => setSteps((prev) => [...prev, ''])} />
        </View>

        <ToggleRow
          label="Me le rappeler"
          description={settings.remindersEnabled ? 'Une notification au bon moment.' : 'Les rappels sont coupés dans les Réglages.'}
          value={reminderOn}
          onValueChange={setReminderOn}
        />
        {reminderOn && (
          <View style={{ gap: 12 }}>
            {repeat === 'none' && (
              <View style={styles.chips}>
                <Chip label="Aujourd’hui" selected={!tomorrow} onPress={() => setTomorrow(false)} />
                <Chip label="Demain" selected={tomorrow} onPress={() => setTomorrow(true)} />
                <Chip label="Dans 15 min" onPress={() => setIn(15)} />
                <Chip label="Dans 1 h" onPress={() => setIn(60)} />
              </View>
            )}
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 24 }}>
              <Stepper label="Heure" value={hour} onChange={setHour} min={0} max={23} format={pad} />
              <Stepper label="Minutes" value={minute} onChange={setMinute} min={0} max={55} step={5} format={pad} />
            </View>
            <Txt variant="muted" style={{ textAlign: 'center' }}>
              {repeat === 'daily' ? 'Tous les jours' : tomorrow ? 'Demain' : 'Aujourd’hui'} à {pad(hour)}:{pad(minute)}
            </Txt>
            <ToggleRow
              label="Relancer si pas fait"
              description={`Nouveau rappel ${settings.nudgeDelayMin} min après, si la tâche n’est pas cochée.`}
              value={nudge}
              onValueChange={setNudge}
            />
          </View>
        )}
      </Section>

      <ErrorText message={error} />
      <Button label={existing ? 'Enregistrer' : 'Ajouter la tâche'} onPress={save} />
      {existing && <Button variant="ghost" label="Supprimer la tâche" onPress={remove} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
});
