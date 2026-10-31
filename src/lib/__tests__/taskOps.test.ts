import { describe, expect, it } from '@jest/globals';
import {
  clearDoneIn,
  createTask,
  diffTasks,
  doneTodayCount,
  moveTaskIn,
  resetDailyTasks,
  toggleStepIn,
  toggleTaskIn,
  updateTaskIn,
  type TaskInput,
} from '../taskOps';
import type { Task } from '../types';

const input = (title: string, extra: Partial<TaskInput> = {}): TaskInput => ({
  title,
  emoji: '📝',
  durationMin: null,
  steps: [],
  reminder: { enabled: false, at: null, repeat: 'none', nudge: false },
  ...extra,
});

const yesterday = () => new Date(Date.now() - 24 * 3600 * 1000).toISOString();

describe('createTask', () => {
  it('nettoie le titre et les étapes vides', () => {
    const t = createTask(input('  Ranger  ', { steps: ['Lit', ' ', 'Bureau '] }), 'parent-1');
    expect(t.title).toBe('Ranger');
    expect(t.steps.map((s) => s.title)).toEqual(['Lit', 'Bureau']);
    expect(t.done).toBe(false);
    expect(t.createdBy).toBe('parent-1');
  });
});

describe('updateTaskIn', () => {
  it('garde l’état des étapes existantes', () => {
    const t = createTask(input('A', { steps: ['un', 'deux'] }));
    const checked = toggleStepIn([t], t.id, t.steps[0].id);
    const [updated] = updateTaskIn(checked, t.id, input('A bis', { steps: ['un', 'trois'] }));
    expect(updated.title).toBe('A bis');
    expect(updated.steps[0]).toMatchObject({ title: 'un', done: true });
    expect(updated.steps[1]).toMatchObject({ title: 'trois', done: false });
  });
});

describe('toggleTaskIn / toggleStepIn', () => {
  it('cocher une tâche coche toutes ses étapes', () => {
    const t = createTask(input('A', { steps: ['un', 'deux'] }));
    const { tasks, nowDone } = toggleTaskIn([t], t.id);
    expect(nowDone).toBe(true);
    expect(tasks[0].doneAt).not.toBeNull();
    expect(tasks[0].steps.every((s) => s.done)).toBe(true);
    expect(toggleTaskIn(tasks, t.id).nowDone).toBe(false);
  });

  it('la tâche est faite quand toutes les étapes le sont', () => {
    const t = createTask(input('A', { steps: ['un', 'deux'] }));
    let list = toggleStepIn([t], t.id, t.steps[0].id);
    expect(list[0].done).toBe(false);
    list = toggleStepIn(list, t.id, t.steps[1].id);
    expect(list[0].done).toBe(true);
    list = toggleStepIn(list, t.id, t.steps[1].id);
    expect(list[0].done).toBe(false);
    expect(list[0].doneAt).toBeNull();
  });
});

describe('resetDailyTasks', () => {
  it('remet à faire les routines terminées un autre jour', () => {
    const routine: Task = {
      ...createTask(input('Dents', { reminder: { enabled: true, at: yesterday(), repeat: 'daily', nudge: false } })),
      done: true,
      doneAt: yesterday(),
    };
    const once: Task = { ...createTask(input('Courses')), done: true, doneAt: yesterday() };
    const [r, o] = resetDailyTasks([routine, once]);
    expect(r.done).toBe(false);
    expect(o.done).toBe(true);
  });

  it('renvoie la même liste si rien ne change', () => {
    const list = [createTask(input('A'))];
    expect(resetDailyTasks(list)).toBe(list);
  });
});

describe('moveTaskIn', () => {
  it('saute les tâches de l’autre liste (faites / à faire)', () => {
    const [a, b, c] = ['A', 'B', 'C'].map((t) => createTask(input(t)));
    const doneB = { ...b, done: true };
    const moved = moveTaskIn([a, doneB, c], c.id, -1);
    expect(moved.map((t) => t.title)).toEqual(['C', 'B', 'A']);
    expect(moveTaskIn([a, doneB, c], a.id, -1).map((t) => t.title)).toEqual(['A', 'B', 'C']);
  });
});

describe('clearDoneIn / doneTodayCount', () => {
  it('garde les routines quotidiennes', () => {
    const routine = {
      ...createTask(input('Dents', { reminder: { enabled: true, at: yesterday(), repeat: 'daily', nudge: false } })),
      done: true,
      doneAt: new Date().toISOString(),
    };
    const once = { ...createTask(input('Courses')), done: true, doneAt: yesterday() };
    const todo = createTask(input('Lire'));
    expect(clearDoneIn([routine, once, todo]).map((t) => t.title)).toEqual(['Dents', 'Lire']);
    expect(doneTodayCount([routine, once, todo])).toBe(1);
  });
});

describe('diffTasks', () => {
  it('ne renvoie que les tâches nouvelles, modifiées ou déplacées', () => {
    const [a, b, c] = ['A', 'B', 'C'].map((t) => createTask(input(t)));
    const prev = [a, b, c];
    const changedB = { ...b, title: 'B2' };
    const d = createTask(input('D'));
    const next = [a, changedB, c, d];
    const diff = diffTasks(prev, next);
    expect(diff.upserts.map((u) => [u.task.title, u.position])).toEqual([
      ['B2', 1],
      ['D', 3],
    ]);
    expect(diff.deletes).toEqual([]);
  });

  it('détecte les suppressions et les changements de position', () => {
    const [a, b, c] = ['A', 'B', 'C'].map((t) => createTask(input(t)));
    const diff = diffTasks([a, b, c], [c, a]);
    expect(diff.deletes).toEqual([b.id]);
    expect(diff.upserts.map((u) => [u.task.title, u.position])).toEqual([
      ['C', 0],
      ['A', 1],
    ]);
  });

  it('aucune différence si rien ne bouge', () => {
    const list = [createTask(input('A'))];
    expect(diffTasks(list, list)).toEqual({ upserts: [], deletes: [] });
  });
});
