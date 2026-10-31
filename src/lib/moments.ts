import type { Moment, Task } from './types';

/**
 * Moments de la journée : un emploi du temps visuel, simple et prévisible.
 * Les heures servent à savoir « où on en est » et à proposer une heure de rappel.
 */
export const MOMENTS: { value: Moment; label: string; emoji: string; until: number; defaultTime: [number, number] }[] = [
  { value: 'matin', label: 'Matin', emoji: '☀️', until: 11, defaultTime: [7, 30] },
  { value: 'midi', label: 'Midi', emoji: '🍽️', until: 14, defaultTime: [12, 0] },
  { value: 'aprem', label: 'Après-midi', emoji: '🌤️', until: 18, defaultTime: [16, 30] },
  { value: 'soir', label: 'Soir', emoji: '🌙', until: 24, defaultTime: [19, 30] },
];

export const ANYTIME = { label: 'Quand je veux', emoji: '🕐' };

export function momentInfo(moment: Moment | null | undefined) {
  return MOMENTS.find((m) => m.value === moment) ?? null;
}

export function momentLabel(moment: Moment | null | undefined): string {
  const info = momentInfo(moment);
  return info ? `${info.emoji} ${info.label}` : `${ANYTIME.emoji} ${ANYTIME.label}`;
}

export function currentMoment(now = new Date()): Moment {
  const h = now.getHours();
  return (MOMENTS.find((m) => h < m.until) ?? MOMENTS[MOMENTS.length - 1]).value;
}

const momentIndex = (m: Moment) => MOMENTS.findIndex((x) => x.value === m);

/**
 * Priorité d'une tâche pour « que faire maintenant » :
 * moment actuel, puis moments déjà passés (en retard), puis « quand je veux », puis plus tard.
 */
function rank(task: Task, now: Date): number {
  if (!task.moment) return 2;
  const diff = momentIndex(task.moment) - momentIndex(currentMoment(now));
  if (diff === 0) return 0;
  if (diff < 0) return 1;
  return 2 + diff;
}

/** Les tâches à faire, dans l'ordre où les faire maintenant (ordre de la liste conservé à priorité égale). */
export function upcomingTasks(tasks: Task[], now = new Date()): Task[] {
  return tasks
    .map((task, index) => ({ task, index, r: rank(task, now) }))
    .filter(({ task }) => !task.done)
    .sort((a, b) => a.r - b.r || a.index - b.index)
    .map(({ task }) => task);
}

export interface MomentGroup {
  moment: Moment | null;
  tasks: Task[];
}

/** Regroupe les tâches par moment, dans l'ordre de la journée (« quand je veux » à la fin). */
export function groupByMoment(tasks: Task[]): MomentGroup[] {
  const groups: MomentGroup[] = [...MOMENTS.map((m) => ({ moment: m.value as Moment | null, tasks: [] as Task[] })), { moment: null, tasks: [] }];
  for (const task of tasks) {
    const group = groups.find((g) => g.moment === (task.moment ?? null));
    group?.tasks.push(task);
  }
  return groups.filter((g) => g.tasks.length > 0);
}
