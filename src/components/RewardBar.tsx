import { StyleSheet, Text, View } from 'react-native';
import { useData } from '@/lib/data';
import { rewardProgress, visibleStreak } from '@/lib/rewards';
import { useAppTheme } from '@/lib/useAppTheme';
import { Button, Card, Txt } from './ui';

/** Petite pastille d'en-tête : étoiles (et série de jours quand il y en a une). */
export function RewardPill() {
  const { settings } = useData();
  const { colors } = useAppTheme();
  const streak = visibleStreak(settings);
  return (
    <View
      style={[styles.pill, { backgroundColor: colors.card }]}
      accessibilityLabel={`${settings.stars} étoiles${streak > 1 ? `, série de ${streak} jours` : ''}`}
    >
      <Text style={styles.pillText}>⭐</Text>
      <Text style={[styles.pillText, { color: colors.text, fontWeight: '800' }]}>{settings.stars}</Text>
      {streak > 1 ? (
        <>
          <Text style={[styles.pillText, { color: colors.textMuted }]}> · 🔥</Text>
          <Text style={[styles.pillText, { color: colors.text, fontWeight: '800' }]}>{streak}</Text>
        </>
      ) : null}
    </View>
  );
}

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
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  pillText: { fontSize: 16 },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bar: { height: 8, overflow: 'hidden' },
});
