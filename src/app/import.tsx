import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useFeedback } from '@/components/Feedback';
import { Button, Card, Screen, Txt } from '@/components/ui';
import { useData } from '@/lib/data';
import { parseImport, splitDuplicates } from '@/lib/importLink';

const MOMENT_LABEL = { matin: '☀️ matin', midi: '🍽️ midi', aprem: '🌤️ après-midi', soir: '🌙 soir' } as const;

/** Reçoit des tâches envoyées par une autre app (lien focustdah://import?d=…) et les ajoute après confirmation. */
export default function ImportScreen() {
  const { d } = useLocalSearchParams<{ d?: string }>();
  const { tasks, addTasks } = useData();
  const { toast } = useFeedback();
  const [busy, setBusy] = useState(false);
  const payload = useMemo(() => parseImport(d), [d]);
  const split = useMemo(() => (payload ? splitDuplicates(payload.tasks, tasks) : null), [payload, tasks]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!payload || !split) {
    return (
      <Screen edges={['bottom']}>
        <Stack.Screen options={{ title: 'Importer' }} />
        <Card style={{ gap: 12 }}>
          <Txt variant="subtitle">Lien illisible</Txt>
          <Txt variant="muted">Ce lien ne contient aucune tâche à ajouter. Renvoie-le depuis l’autre app.</Txt>
          <Button label="Retour" variant="secondary" onPress={close} />
        </Card>
      </Screen>
    );
  }

  const add = async () => {
    setBusy(true);
    try {
      if (split.fresh.length) await addTasks(split.fresh);
      const n = split.fresh.length;
      toast(n ? `${n} tâche${n > 1 ? 's' : ''} ajoutée${n > 1 ? 's' : ''}` : 'Tout était déjà dans ta liste');
      close();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: `Depuis ${payload.source}` }} />
      <Txt variant="muted">
        {payload.label ? `${payload.label} · ` : ''}
        {split.fresh.length} tâche{split.fresh.length > 1 ? 's' : ''} à ajouter à ta journée.
      </Txt>
      <Card style={{ gap: 10 }}>
        {split.fresh.map((t) => (
          <View key={t.title} style={{ gap: 2 }}>
            <Txt variant="body">
              {t.emoji} {t.title}
            </Txt>
            <Txt variant="small">
              {[t.moment ? MOMENT_LABEL[t.moment] : '🕐 quand je veux', t.durationMin ? `${t.durationMin} min` : null, t.steps.length ? `${t.steps.length} étapes` : null]
                .filter(Boolean)
                .join(' · ')}
            </Txt>
          </View>
        ))}
        {split.already.length > 0 && (
          <Txt variant="small">Déjà dans ta liste : {split.already.map((t) => t.title).join(', ')}</Txt>
        )}
      </Card>
      <Button
        label={split.fresh.length ? `Ajouter ${split.fresh.length} tâche${split.fresh.length > 1 ? 's' : ''}` : 'Fermer'}
        onPress={split.fresh.length ? add : close}
        disabled={busy}
      />
      {split.fresh.length > 0 && <Button label="Annuler" variant="ghost" onPress={close} />}
    </Screen>
  );
}
