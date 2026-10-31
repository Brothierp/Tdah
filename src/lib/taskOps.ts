import * as Crypto from 'expo-crypto';
import type { Step, Task } from './types';

/**
 * Opérations pures sur une liste de tâches.
 * Partagées entre le compte connecté (data.tsx) et l'espace parents (childData.ts).
 */

export type TaskInput = Pick<Task, 'title' | 'emoji' | 'durationMin' | 'reminder' | 'moment'> & { steps: string[] };

function isToday(iso: string | null) {
  return iso != null && new Date(iso).toDateString() === new Date().toDateString();
}

/** Les routines quotidiennes redeviennent « à faire » chaque nouveau jour. */
export function resetDailyTasks(tasks: Task[]): Task[] {
  let changed = false;
  const next = tasks.map((t) => {
    if (t.reminder.repeat === 'daily' && t.done && !isToday(t.doneAt)) {
      changed = true;
      return { ...t, done: false, doneAt: null, steps: t.steps.map((s) => ({ ...s, done: false })) };
    }
    return t;
  });
  return changed ? next : tasks;
}

function buildSteps(titles: string[], previous: Step[] = []): Step[] {
  return titles
    .map((t) => t.trim())
    .filter(Boolean)
    .map((title) => previous.find((s) => s.title === title) ?? { id: Crypto.randomUUID(), title, done: false });
}

export function createTask({ steps, ...input }: TaskInput, createdBy: string | null = null): Task {
  return {
    ...input,
    title: input.title.trim(),
    id: Crypto.randomUUID(),
    done: false,
    doneAt: null,
    createdAt: new Date().toISOString(),
    createdBy,
    steps: buildSteps(steps),
  };
}

export function updateTaskIn(tasks: Task[], id: string, { steps, ...input }: TaskInput): Task[] {
  return tasks.map((t) => (t.id === id ? { ...t, ...input, title: input.title.trim(), steps: buildSteps(steps, t.steps) } : t));
}

export function toggleTaskIn(tasks: Task[], id: string): { tasks: Task[]; nowDone: boolean } {
  let nowDone = false;
  const next = tasks.map((t) => {
    if (t.id !== id) return t;
    nowDone = !t.done;
    return {
      ...t,
      done: nowDone,
      doneAt: nowDone ? new Date().toISOString() : null,
      steps: nowDone ? t.steps.map((s) => ({ ...s, done: true })) : t.steps,
    };
  });
  return { tasks: next, nowDone };
}

export function toggleStepIn(tasks: Task[], taskId: string, stepId: string): Task[] {
  return tasks.map((t) => {
    if (t.id !== taskId) return t;
    const steps = t.steps.map((s) => (s.id === stepId ? { ...s, done: !s.done } : s));
    const allDone = steps.length > 0 && steps.every((s) => s.done);
    return { ...t, steps, done: allDone, doneAt: allDone ? (t.doneAt ?? new Date().toISOString()) : null };
  });
}

export function deleteTaskIn(tasks: Task[], id: string): Task[] {
  return tasks.filter((t) => t.id !== id);
}

/** Les routines quotidiennes sont conservées : elles reviendront demain. */
export function clearDoneIn(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.done || t.reminder.repeat === 'daily');
}

/** Échange avec la tâche voisine visible dans le même groupe (même moment, à faire / faites). */
export function moveTaskIn(tasks: Task[], id: string, direction: -1 | 1): Task[] {
  const index = tasks.findIndex((t) => t.id === id);
  if (index < 0) return tasks;
  const sameGroup = (t: Task) => t.done === tasks[index].done && (t.moment ?? null) === (tasks[index].moment ?? null);
  let target = index + direction;
  while (target >= 0 && target < tasks.length && !sameGroup(tasks[target])) target += direction;
  if (target < 0 || target >= tasks.length) return tasks;
  const next = [...tasks];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Nombre de tâches faites aujourd'hui (pour le suivi parent). */
export function doneTodayCount(tasks: Task[]): number {
  return tasks.filter((t) => t.done && isToday(t.doneAt)).length;
}

/**
 * Différences entre deux versions de la liste (pour n'envoyer au serveur que ce qui a changé).
 * Une tâche est renvoyée si elle est nouvelle, modifiée (nouvel objet) ou a changé de place.
 */
export function diffTasks(prev: Task[], next: Task[]): { upserts: { task: Task; position: number }[]; deletes: string[] } {
  const prevIndex = new Map(prev.map((t, i) => [t.id, i]));
  const upserts: { task: Task; position: number }[] = [];
  next.forEach((task, position) => {
    const i = prevIndex.get(task.id);
    if (i === undefined || prev[i] !== task || i !== position) upserts.push({ task, position });
  });
  const nextIds = new Set(next.map((t) => t.id));
  const deletes = prev.filter((t) => !nextIds.has(t.id)).map((t) => t.id);
  return { upserts, deletes };
}

/** « Plus tard » : la tâche passe après les autres tâches de son moment. */
export function postponeTaskIn(tasks: Task[], id: string): Task[] {
  const task = tasks.find((t) => t.id === id);
  if (!task) return tasks;
  return [...tasks.filter((t) => t.id !== id), task];
}
