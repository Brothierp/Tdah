import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ProgressRing } from '@/components/ProgressRing';
import { Button, Card, Field, Screen, Section, Stepper, Txt } from '@/components/ui';
import { useTaskActions } from '@/components/useTaskActions';
import { useData } from '@/lib/data';
import { upcomingTasks } from '@/lib/moments';
import { notificationsSupported } from '@/lib/notifications';
import { formatDuration, useTimer } from '@/lib/timer';
import { useAppTheme } from '@/lib/useAppTheme';

const PRESETS = [2, 5, 10, 15, 25];

function clock(ms: number) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function TimerScreen() {
  const timer = useTimer();
  const { tasks } = useData();
  const { toggle, completeStep } = useTaskActions();
  const { colors, radius, fontScale, playful } = useAppTheme();
  const [minutes, setMinutes] = useState(20);
  const [label, setLabel] = useState('');

  const task = timer.taskId ? tasks.find((t) => t.id === timer.taskId) : undefined;

  if (timer.status === 'idle') {
    const suggestions = upcomingTasks(tasks).slice(0, 3);
    return (
      <Screen>
        <Txt variant="title">⏳ Timer</Txt>
        <Txt variant="muted">{playful ? 'Choisis, et c’est parti ! 🏁' : 'Le plus dur, c’est de commencer : choisis une durée courte.'}</Txt>

        {suggestions.length > 0 && (
          <View style={{ gap: 10 }}>
            <Txt variant="subtitle">Pour une tâche</Txt>
            {suggestions.map((t) => (
              <Button
                key={t.id}
                variant="secondary"
                label={`▶ ${t.emoji} ${t.title} · ${t.durationMin ?? 5} min`}
                onPress={() => timer.start(t.durationMin ?? 5, `${t.emoji} ${t.title}`, t.id)}
              />
            ))}
          </View>
        )}

        <Txt variant="subtitle">Juste un timer</Txt>
        <View style={styles.tiles}>
          {PRESETS.map((m) => (
            <Pressable
              key={m}
              accessibilityRole="button"
              accessibilityLabel={`Démarrer ${m} minutes`}
              onPress={() => timer.start(m, label.trim())}
              style={({ pressed }) => [styles.tile, { backgroundColor: colors.primary, borderRadius: radius, opacity: pressed ? 0.8 : 1 }]}
            >
              <Text style={{ color: colors.primaryText, fontSize: 30 * fontScale, fontWeight: '800' }}>{m}</Text>
              <Text style={{ color: colors.primaryText, fontSize: 14 * fontScale, fontWeight: '700' }}>min</Text>
            </Pressable>
          ))}
        </View>

        <Section title="⚙️ Autre durée, nom du timer">
          <Field label="Pour quoi faire ? (optionnel)" value={label} onChangeText={setLabel} placeholder="ex : ranger mon bureau" maxLength={60} />
          <Stepper label="Minutes" value={minutes} onChange={setMinutes} min={1} max={120} />
          <Button label={`▶ Démarrer ${minutes} min`} onPress={() => timer.start(minutes, label.trim())} />
        </Section>

        {!notificationsSupported && <Txt variant="small">Sur le web, l’alerte de fin ne s’affiche que si l’app reste ouverte.</Txt>}
      </Screen>
    );
  }

  const finished = timer.status === 'finished';
  const progress = finished ? 0 : timer.totalSec ? timer.remainingSec / timer.totalSec : 0;
  const step = task && !task.done ? task.steps.find((s) => !s.done) : undefined;
  const ringColor = finished ? colors.success : timer.warning ? colors.warning : undefined;

  return (
    <Screen>
      <Txt variant="title">⏳ Timer</Txt>
      {timer.label ? (
        <Txt variant="subtitle" style={{ textAlign: 'center' }}>
          {timer.label}
        </Txt>
      ) : null}

      {timer.warning && (
        <Card style={{ backgroundColor: colors.warning, borderColor: colors.warning }}>
          <Txt style={{ fontWeight: '800', textAlign: 'center', color: '#1E1B2E' }}>⏳ Plus qu’une minute : prépare-toi à finir.</Txt>
        </Card>
      )}

      <View style={{ alignItems: 'center', marginVertical: 4 }}>
        <ProgressRing progress={progress} color={ringColor}>
          {finished ? (
            <Text style={{ fontSize: 72 }}>🎉</Text>
          ) : (
            <View style={{ alignItems: 'center' }}>
              <Text
                accessibilityRole="timer"
                accessibilityLabel={`${Math.floor(timer.remainingSec / 60)} minutes ${timer.remainingSec % 60} secondes restantes`}
                style={{ fontSize: 56, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] }}
              >
                {formatDuration(timer.remainingSec)}
              </Text>
              {timer.status === 'running' && timer.endAt ? (
                <Txt variant="small">fin à {clock(timer.endAt)}</Txt>
              ) : (
                <Txt variant="small">en pause</Txt>
              )}
            </View>
          )}
        </ProgressRing>
      </View>

      {step && task && !finished && (
        <Card style={{ alignItems: 'center', gap: 8 }}>
          <Txt variant="small">Étape en cours</Txt>
          <Txt variant="subtitle" style={{ textAlign: 'center' }}>
            {step.title}
          </Txt>
          <Button label="✓ Étape faite" variant="secondary" onPress={() => completeStep(task, step)} style={{ alignSelf: 'stretch' }} />
        </Card>
      )}

      {finished ? (
        <View style={{ gap: 12 }}>
          <Txt variant="subtitle" style={{ textAlign: 'center' }}>
            {playful ? 'Temps écoulé ! Bien joué 🙌' : 'Temps écoulé.'}
          </Txt>
          {task && !task.done && (
            <Button
              variant="success"
              label="✅ J’ai fini la tâche"
              onPress={async () => {
                await toggle(task);
                timer.reset();
              }}
            />
          )}
          <Button variant="secondary" label="☕ Faire une pause de 5 min" onPress={() => timer.start(5, '☕ Pause')} />
          <Button variant="secondary" label="＋ 5 minutes de plus" onPress={() => timer.addMinutes(5)} />
          <Button variant="ghost" label="Nouveau timer" onPress={timer.reset} />
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {timer.status === 'running' ? <Button label="⏸ Pause" onPress={timer.pause} /> : <Button label="▶ Reprendre" onPress={timer.resume} />}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button variant="secondary" label="＋ 1 min" onPress={() => timer.addMinutes(1)} style={{ flex: 1 }} />
            <Button variant="secondary" label="⏹ Arrêter" onPress={timer.reset} style={{ flex: 1 }} />
          </View>
          {task && !task.done && (
            <Button
              variant="success"
              label="✅ C’est fait (avant la fin)"
              onPress={async () => {
                await toggle(task);
                timer.reset();
              }}
            />
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: 96, height: 86, alignItems: 'center', justifyContent: 'center' },
});
