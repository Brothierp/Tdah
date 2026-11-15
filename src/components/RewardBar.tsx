import { StyleSheet, View } from 'react-native';
import { useData } from '@/lib/data';
import { rewardProgress } from '@/lib/rewards';
import { useAppTheme } from '@/lib/useAppTheme';
import { Button, Card, Txt } from './ui';

/** Objectif de récompense : affiché seulement s'il y en a un, en une ligne. */
export function RewardGoal() {
  const { settings, updateSettings } = useData();
  const { colors, radius } = useAppTheme();
  const { available, goal, reached } = rewardProgress(settings);
  if (!goal) return null;

  if (reached) {
    return (
      <Card style={{ gap: 10, backgroundColor: colors.successSoft }}>
        <Txt style={{ fontWeight: '700', textAlign: 'center' }}>🎉 Tu as gagné : {settings.rewardLabel || 'ta récompense'} !</Txt>
        <Button variant="success" size="sm" label="J’ai eu ma récompense" onPress={() => updateSettings({ rewardSpent: settings.rewardSpent + goal })} />
      </Card>
    );
  }

  return (
    <View style={{ gap: 6 }}>
      <View style={styles.goalRow}>
        <Txt variant="small" numberOfLines={1} style={{ flex: 1 }}>
          🎁 {settings.rewardLabel ? `Objectif : ${settings.rewardLabel}` : 'Objectif'}
        </Txt>
        <Txt variant="small" style={{ fontVariant: ['tabular-nums'] }}>
          {available}/{goal} ⭐
        </Txt>
      </View>
      <View style={[styles.bar, { backgroundColor: colors.card, borderRadius: radius }]}>
        <View style={{ width: `${Math.min(1, available / goal) * 100}%`, height: '100%', backgroundColor: colors.warning, borderRadius: radius }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bar: { height: 8, overflow: 'hidden' },
});
