import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Screen, Txt } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { backend } from '@/lib/backend';
import { doneTodayCount, resetDailyTasks } from '@/lib/taskOps';
import type { Task } from '@/lib/types';
import { useAppTheme } from '@/lib/useAppTheme';

interface Summary {
  todo: number;
  doneToday: number;
}

/** Espace parents : vue d'ensemble des enfants suivis. */
export default function FamilyScreen() {
  const { children, refreshFamily } = useAuth();
  const { colors, radius } = useAppTheme();
  const [summaries, setSummaries] = useState<Record<string, Summary>>({});

  // Liste des enfants à jour (un enfant a pu être relié depuis un autre appareil).
  useFocusEffect(
    useCallback(() => {
      refreshFamily().catch(() => {});
    }, [refreshFamily]),
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const entries = await Promise.all(
          children.map(async (c) => {
            const tasks = resetDailyTasks(await backend.loadTasks(c.id).catch((): Task[] => []));
            return [c.id, { todo: tasks.filter((t) => !t.done).length, doneToday: doneTodayCount(tasks) }] as const;
          }),
        );
        if (!cancelled) setSummaries(Object.fromEntries(entries));
      })();
      return () => {
        cancelled = true;
      };
    }, [children]),
  );

  return (
    <Screen>
      <Txt variant="title">👨‍👩‍👧 Famille</Txt>
      <Txt variant="muted">
        Suis la journée de tes enfants, ajoute-leur des tâches et des rappels. Ils voient que leur compte est suivi.
      </Txt>

      {children.length === 0 && (
        <Card style={{ alignItems: 'center', gap: 8, paddingVertical: 24 }}>
          <Text style={{ fontSize: 44 }}>🧒</Text>
          <Txt variant="subtitle">Aucun enfant pour l’instant</Txt>
          <Txt variant="muted" style={{ textAlign: 'center' }}>
            Crée un compte pour ton enfant, ou relie un compte qui existe déjà sur cet appareil.
          </Txt>
        </Card>
      )}

      {children.map((c) => {
        const s = summaries[c.id];
        const total = s ? s.todo + s.doneToday : 0;
        return (
          <Pressable
            key={c.id}
            accessibilityRole="button"
            accessibilityLabel={`Voir la journée de ${c.name}`}
            onPress={() => router.push(`/family/${c.id}`)}
          >
            <Card style={{ gap: 10 }}>
              <View style={styles.row}>
                <Text style={{ fontSize: 40 }}>{c.avatar}</Text>
                <View style={{ flex: 1 }}>
                  <Txt variant="subtitle">{c.name}</Txt>
                  <Txt variant="small">
                    {s
                      ? s.todo === 0
                        ? s.doneToday > 0
                          ? `Tout est fait aujourd’hui 🏆 (${s.doneToday})`
                          : 'Aucune tâche en cours'
                        : `${s.doneToday} faite${s.doneToday > 1 ? 's' : ''} aujourd’hui · ${s.todo} à faire`
                      : '…'}
                  </Txt>
                </View>
                <Txt variant="subtitle" style={{ color: colors.primary }}>
                  ›
                </Txt>
              </View>
              {total > 0 && (
                <View style={[styles.bar, { backgroundColor: colors.primarySoft, borderRadius: radius }]}>
                  <View
                    style={{
                      width: `${((s?.doneToday ?? 0) / total) * 100}%`,
                      height: '100%',
                      backgroundColor: colors.success,
                      borderRadius: radius,
                    }}
                  />
                </View>
              )}
            </Card>
          </Pressable>
        );
      })}

      <Button label="＋ Ajouter un enfant" onPress={() => router.push('/family/add')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bar: { height: 10, overflow: 'hidden' },
});
