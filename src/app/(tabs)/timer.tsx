import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ProgressRing } from '@/components/ProgressRing';
import { Button, Chip, Field, Screen, Stepper, Txt } from '@/components/ui';
import { useData } from '@/lib/data';
import { notificationsSupported } from '@/lib/notifications';
import { formatDuration, useTimer } from '@/lib/timer';
import { useAppTheme } from '@/lib/useAppTheme';

const PRESETS = [1, 2, 5, 10, 15, 20, 25];

export default function TimerScreen() {
  const timer = useTimer();
  const { tasks, toggleTask } = useData();
  const { colors, playful } = useAppTheme();
  const [minutes, setMinutes] = useState(5);
  const [label, setLabel] = useState('');

  const task = timer.taskId ? tasks.find((t) => t.id === timer.taskId) : undefined;

  if (timer.status === 'idle') {
    return (
      <Screen>
        <Txt variant="title">⏳ Timer</Txt>
        <Txt variant="muted">
          Choisis une durée courte pour démarrer. {playful ? 'Prêt ? Feu, partez ! 🏁' : 'Le plus dur, c’est de commencer.'}
        </Txt>

        <View style={styles.presets}>
          {PRESETS.map((m) => (
            <Chip key={m} label={`${m} min`} selected={minutes === m} onPress={() => setMinutes(m)} />
          ))}
        </View>

        <Stepper label="Ou règle toi-même (minutes)" value={minutes} onChange={setMinutes} min={1} max={120} />

        <Field
          label="Pour quoi faire ? (optionnel)"
          value={label}
          onChangeText={setLabel}
          placeholder="ex : ranger mon bureau"
          maxLength={60}
        />

        <Button label={`▶ Démarrer ${minutes} min`} onPress={() => timer.start(minutes, label.trim())} />
        {!notificationsSupported && (
          <Txt variant="small">Sur le web, l’alerte de fin ne s’affiche que si l’app reste ouverte.</Txt>
        )}
      </Screen>
    );
  }

  const finished = timer.status === 'finished';
  const progress = finished ? 0 : timer.totalSec ? timer.remainingSec / timer.totalSec : 0;

  return (
    <Screen>
      <Txt variant="title">⏳ Timer</Txt>
      {timer.label ? (
        <Txt variant="subtitle" style={{ textAlign: 'center' }}>
          {timer.label}
        </Txt>
      ) : null}

      <View style={{ alignItems: 'center', marginVertical: 8 }}>
        <ProgressRing progress={progress} color={finished ? colors.success : undefined}>
          {finished ? (
            <Text style={{ fontSize: 72 }}>🎉</Text>
          ) : (
            <Text
              accessibilityRole="timer"
              accessibilityLabel={`${Math.floor(timer.remainingSec / 60)} minutes ${timer.remainingSec % 60} secondes restantes`}
              style={{ fontSize: 56, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] }}
            >
              {formatDuration(timer.remainingSec)}
            </Text>
          )}
        </ProgressRing>
      </View>

      {finished ? (
        <View style={{ gap: 12 }}>
          <Txt variant="subtitle" style={{ textAlign: 'center' }}>
            {playful ? 'Temps écoulé ! Bien joué 🙌' : 'Temps écoulé.'}
          </Txt>
          {task && !task.done && (
            <Button
              label="✅ J'ai fini la tâche"
              onPress={async () => {
                await toggleTask(task.id);
                timer.reset();
              }}
            />
          )}
          <Button variant="secondary" label="＋ 5 minutes de plus" onPress={() => timer.addMinutes(5)} />
          <Button variant="ghost" label="Nouveau timer" onPress={timer.reset} />
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {timer.status === 'running' ? (
            <Button label="⏸ Pause" onPress={timer.pause} />
          ) : (
            <Button label="▶ Reprendre" onPress={timer.resume} />
          )}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button variant="secondary" label="＋ 1 min" onPress={() => timer.addMinutes(1)} style={{ flex: 1 }} />
            <Button variant="secondary" label="⏹ Arrêter" onPress={timer.reset} style={{ flex: 1 }} />
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
