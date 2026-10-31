import { StyleSheet, Text, View } from 'react-native';
import { useData } from '@/lib/data';
import { rewardProgress, visibleStreak } from '@/lib/rewards';
import { useAppTheme } from '@/lib/useAppTheme';
import { Button, Card, Txt } from './ui';

/** Étoiles, série de jours et objectif de récompense : motivation immédiate et visible. */
export function RewardBar() {
  const { settings, updateSettings } = useData();
  const { colors, radius } = useAppTheme();
  const streak = visibleStreak(settings);
  const { available, goal, reached } = rewardProgress(settings);

  return (
    <Card style={{ gap: 10, paddingVertical: 12 }}>
      <View style={styles.row}>
        <View style={styles.stat} accessibilityLabel={`${settings.stars} étoiles`}>
          <Text style={styles.icon}>⭐</Text>
          <Txt variant="subtitle">{settings.stars}</Txt>
        </View>
        <View style={styles.stat} accessibilityLabel={`Série de ${streak} jours`}>
          <Text style={styles.icon}>🔥</Text>
          <Txt variant="subtitle">
            {streak} {streak > 1 ? 'jours' : 'jour'}
          </Txt>
        </View>
        {goal ? (
          <View style={[styles.stat, { flex: 1, justifyContent: 'flex-end' }]}>
            <Text style={styles.icon}>🎁</Text>
            <Txt variant="small" numberOfLines={1} style={{ flexShrink: 1 }}>
              {Math.min(available, goal)}/{goal}
            </Txt>
          </View>
        ) : null}
      </View>

      {goal ? (
        <View style={[styles.bar, { backgroundColor: colors.primarySoft, borderRadius: radius }]}>
          <View
            style={{
              width: `${Math.min(1, available / goal) * 100}%`,
              height: '100%',
              backgroundColor: reached ? colors.success : colors.warning,
              borderRadius: radius,
            }}
          />
        </View>
      ) : null}

      {reached ? (
        <View style={{ gap: 8 }}>
          <Txt style={{ fontWeight: '700', textAlign: 'center' }}>
            🎉 Tu as gagné : {settings.rewardLabel || 'ta récompense'} !
          </Txt>
          <Button
            variant="success"
            label="J’ai eu ma récompense"
            onPress={() => updateSettings({ rewardSpent: settings.rewardSpent + (goal ?? 0) })}
          />
        </View>
      ) : goal && settings.rewardLabel ? (
        <Txt variant="small" style={{ textAlign: 'center' }}>
          Objectif : {settings.rewardLabel}
        </Txt>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  icon: { fontSize: 22 },
  bar: { height: 12, overflow: 'hidden' },
});
