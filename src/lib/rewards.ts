import type { Settings } from './types';

/** Jour local au format AAAA-MM-JJ. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function yesterdayKey(now: Date): string {
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  return dayKey(d);
}

type Stats = Pick<Settings, 'stars' | 'streak' | 'lastDoneDay'>;

/**
 * Une tâche cochée (+1) ou décochée (-1) : met à jour les étoiles et la série de jours.
 * Décocher retire l'étoile mais ne casse pas la série (pas de punition).
 */
export function applyCompletion(stats: Stats, delta: 1 | -1, now = new Date()): Stats {
  const stars = Math.max(0, stats.stars + delta);
  if (delta < 0) return { ...stats, stars };
  const today = dayKey(now);
  if (stats.lastDoneDay === today) return { ...stats, stars };
  const streak = stats.lastDoneDay === yesterdayKey(now) ? stats.streak + 1 : 1;
  return { stars, streak, lastDoneDay: today };
}

/** Série affichée : elle reste visible tant qu'on n'a pas « raté » un jour entier. */
export function visibleStreak(stats: Stats, now = new Date()): number {
  if (!stats.lastDoneDay) return 0;
  return stats.lastDoneDay === dayKey(now) || stats.lastDoneDay === yesterdayKey(now) ? stats.streak : 0;
}

export function rewardProgress(settings: Pick<Settings, 'stars' | 'rewardGoal' | 'rewardSpent'>) {
  const available = Math.max(0, settings.stars - settings.rewardSpent);
  const goal = settings.rewardGoal;
  return { available, goal, reached: goal != null && goal > 0 && available >= goal };
}
