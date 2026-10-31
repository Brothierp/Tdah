import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Card, Chip, EmojiGrid, ErrorText, Field, RoundButton, Screen, Stepper, ToggleRow, Txt } from '@/components/ui';
import { confirm } from '@/lib/confirm';
import { useData } from '@/lib/data';
import { ensurePermission, notificationsSupported } from '@/lib/notifications';
import { TASK_EMOJIS } from '@/lib/theme';
import type { ReminderRepeat } from '@/lib/types';

const DURATIONS = [2, 5, 10, 15, 25, 45];
const pad = (n: number) => String(n).padStart(2, '0');

function defaultReminderDate() {
  const d = new Date(Date.now() + 60 * 60_000);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  return d;
}

export default function TaskForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tasks, addTask, updateTask, deleteTask, settings } = useData();
  const existing = id !== 'new' ? tasks.find((t) => t.id === id) : undefined;

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
  const [error, setError] = useState<string | null>(null);

  if (id !== 'new' && !existing) {
    return (
      <Screen edges={[]}>
        <Txt>Cette tâche n’existe plus.</Txt>
        <Button label="Retour" onPress={() => router.back()} />
      </Screen>
    );
  }

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
      reminder: { enabled: reminderOn, at: reminderOn ? at.toISOString() : null, repeat, nudge },
    };
    if (existing) await updateTask(existing.id, input);
    else await addTask(input);
    router.back();
  };

  const remove = async () => {
    if (!existing) return;
    if (await confirm('Supprimer la tâche ?', existing.title, 'Supprimer')) {
      await deleteTask(existing.id);
      router.back();
    }
  };

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: existing ? 'Modifier la tâche' : 'Nouvelle tâche' }} />

      <Field label="Quoi ?" value={title} onChangeText={setTitle} placeholder="ex : Me brosser les dents" maxLength={80} autoFocus={!existing} />

      <View style={{ gap: 8 }}>
        <Txt variant="muted">Une image pour la reconnaître</Txt>
        <EmojiGrid options={TASK_EMOJIS} value={emoji} onChange={setEmoji} />
      </View>

      <View style={{ gap: 8 }}>
        <Txt variant="muted">Combien de temps ? (pour le timer)</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label="Je ne sais pas" selected={duration === null} onPress={() => setDuration(null)} />
          {DURATIONS.map((m) => (
            <Chip key={m} label={`${m} min`} selected={duration === m} onPress={() => setDuration(m)} />
          ))}
        </View>
      </View>

      <Card style={{ gap: 10 }}>
        <Txt variant="subtitle">🪜 Petites étapes (optionnel)</Txt>
        <Txt variant="small">Découper une grosse tâche en petits morceaux aide à se lancer.</Txt>
        {steps.map((s, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Field
                label={`Étape ${i + 1}`}
                value={s}
                onChangeText={(v) => setSteps((prev) => prev.map((p, j) => (j === i ? v : p)))}
                maxLength={80}
              />
            </View>
            <RoundButton
              label="✕"
              accessibilityLabel={`Retirer l'étape ${i + 1}`}
              onPress={() => setSteps((prev) => prev.filter((_, j) => j !== i))}
              size={44}
            />
          </View>
        ))}
        <Button variant="secondary" label="＋ Ajouter une étape" onPress={() => setSteps((prev) => [...prev, ''])} />
      </Card>

      <Card style={{ gap: 12 }}>
        <ToggleRow
          label="🔔 Me le rappeler"
          description={
            settings.remindersEnabled ? 'Une notification au bon moment.' : 'Les rappels sont coupés dans les Réglages.'
          }
          value={reminderOn}
          onValueChange={setReminderOn}
        />
        {reminderOn && (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Chip label="Une fois" selected={repeat === 'none'} onPress={() => setRepeat('none')} />
              <Chip label="🔁 Chaque jour" selected={repeat === 'daily'} onPress={() => setRepeat('daily')} />
            </View>
            {repeat === 'none' && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Chip label="Aujourd'hui" selected={!tomorrow} onPress={() => setTomorrow(false)} />
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
              {repeat === 'daily' ? 'Tous les jours' : tomorrow ? 'Demain' : "Aujourd'hui"} à {pad(hour)}:{pad(minute)}
            </Txt>
            <ToggleRow
              label="⏰ Relancer si pas fait"
              description={`Nouveau rappel ${settings.nudgeDelayMin} min après, si la tâche n'est pas cochée.`}
              value={nudge}
              onValueChange={setNudge}
            />
            {repeat === 'daily' && (
              <Txt variant="small">Une routine quotidienne redevient « à faire » chaque matin.</Txt>
            )}
          </>
        )}
      </Card>

      <ErrorText message={error} />
      <Button label={existing ? 'Enregistrer' : 'Ajouter la tâche'} onPress={save} />
      {existing && <Button variant="ghost" label="🗑 Supprimer la tâche" onPress={remove} />}
    </Screen>
  );
}
