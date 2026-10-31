import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { useFeedback } from '@/components/Feedback';
import { Button, Card, Screen, Txt } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useChildData } from '@/lib/childData';
import { useData } from '@/lib/data';
import { packsFor, packToInputs, type TemplatePack } from '@/lib/templates';

/** Routines toutes prêtes, ajoutées en un geste. Avec `?owner=<enfant>`, un parent les ajoute à son enfant. */
export default function Templates() {
  const { owner } = useLocalSearchParams<{ owner?: string }>();
  const { user } = useAuth();
  const own = useData();
  const child = useChildData(owner ?? null);
  const { toast } = useFeedback();
  const target = owner ? child.child : user;
  if (!target) return null;

  const add = async (pack: TemplatePack) => {
    const inputs = packToInputs(pack);
    await (owner ? child.addTasks(inputs) : own.addTasks(inputs));
    toast(`${pack.emoji} ${inputs.length} tâche${inputs.length > 1 ? 's' : ''} ajoutée${inputs.length > 1 ? 's' : ''}`);
    router.back();
  };

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: owner ? `Idées pour ${target.name}` : 'Idées de routines' }} />
      <Txt variant="muted">
        Choisis une routine : ses tâches et ses étapes sont ajoutées d’un coup. Tu pourras tout modifier ensuite.
      </Txt>
      {packsFor(target.ageGroup).map((pack) => (
        <Card key={pack.id} style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: 36 }}>{pack.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Txt variant="subtitle">{pack.title}</Txt>
              <Txt variant="small">{pack.description}</Txt>
            </View>
          </View>
          <View style={{ gap: 4 }}>
            {pack.tasks.map((t) => (
              <Txt key={t.title} variant="muted">
                {t.emoji} {t.title}
                {t.daily ? ' · chaque jour' : ''}
              </Txt>
            ))}
          </View>
          <Button label={`Ajouter « ${pack.title} »`} variant="secondary" onPress={() => add(pack)} />
        </Card>
      ))}
    </Screen>
  );
}
