import { describe, expect, it } from '@jest/globals';
import { currentMoment, groupByMoment, upcomingTasks } from '../moments';
import { applyCompletion, rewardProgress, visibleStreak } from '../rewards';
import { createTask, moveTaskIn, postponeTaskIn, type TaskInput } from '../taskOps';
import { packToInputs, packsFor, TEMPLATE_PACKS } from '../templates';
import type { Moment } from '../types';

const input = (title: string, moment: Moment | null = null): TaskInput => ({
  title,
  emoji: '📝',
  durationMin: null,
  steps: [],
  moment,
  reminder: { enabled: false, at: null, repeat: 'none', nudge: false },
});

const at = (h: number, day = 31) => new Date(2026, 9, day, h, 0);

describe('moments', () => {
  it('situe l’heure dans la journée', () => {
    expect(currentMoment(at(8))).toBe('matin');
    expect(currentMoment(at(12))).toBe('midi');
    expect(currentMoment(at(15))).toBe('aprem');
    expect(currentMoment(at(21))).toBe('soir');
  });

  it('propose d’abord le moment actuel, puis le retard, puis « quand je veux », puis plus tard', () => {
    const tasks = [input('Soir', 'soir'), input('Libre'), input('Matin', 'matin'), input('Aprem', 'aprem')].map((i) => createTask(i));
    expect(upcomingTasks(tasks, at(15)).map((t) => t.title)).toEqual(['Aprem', 'Matin', 'Libre', 'Soir']);
  });

  it('ignore les tâches faites', () => {
    const [a, b] = [input('A', 'matin'), input('B', 'matin')].map((i) => createTask(i));
    expect(upcomingTasks([{ ...a, done: true }, b], at(8)).map((t) => t.title)).toEqual(['B']);
  });

  it('groupe par moment dans l’ordre de la journée', () => {
    const tasks = [input('Libre'), input('Soir', 'soir'), input('Matin', 'matin')].map((i) => createTask(i));
    expect(groupByMoment(tasks).map((g) => g.moment)).toEqual(['matin', 'soir', null]);
  });

  it('« plus tard » passe la tâche en dernier ; monter reste dans le même moment', () => {
    const [a, b, c] = [input('A', 'matin'), input('B', 'soir'), input('C', 'matin')].map((i) => createTask(i));
    expect(postponeTaskIn([a, b, c], a.id).map((t) => t.title)).toEqual(['B', 'C', 'A']);
    expect(moveTaskIn([a, b, c], c.id, -1).map((t) => t.title)).toEqual(['C', 'B', 'A']);
  });
});

describe('récompenses', () => {
  const zero = { stars: 0, streak: 0, lastDoneDay: null };

  it('compte les étoiles et la série de jours', () => {
    let s = applyCompletion(zero, 1, at(9, 1));
    s = applyCompletion(s, 1, at(10, 1));
    expect(s).toEqual({ stars: 2, streak: 1, lastDoneDay: '2026-10-01' });
    s = applyCompletion(s, 1, at(9, 2));
    expect(s.streak).toBe(2);
    s = applyCompletion(s, 1, at(9, 5));
    expect(s.streak).toBe(1);
  });

  it('décocher retire une étoile sans casser la série ni descendre sous zéro', () => {
    const s = applyCompletion({ stars: 1, streak: 4, lastDoneDay: '2026-10-31' }, -1, at(9));
    expect(s).toEqual({ stars: 0, streak: 4, lastDoneDay: '2026-10-31' });
    expect(applyCompletion(s, -1, at(9)).stars).toBe(0);
  });

  it('la série affichée retombe à 0 après un jour sans tâche', () => {
    const s = { stars: 3, streak: 3, lastDoneDay: '2026-10-30' };
    expect(visibleStreak(s, at(9, 31))).toBe(3);
    expect(visibleStreak(s, new Date(2026, 10, 2))).toBe(0);
  });

  it('objectif de récompense', () => {
    expect(rewardProgress({ stars: 12, rewardGoal: 10, rewardSpent: 0 })).toEqual({ available: 12, goal: 10, reached: true });
    expect(rewardProgress({ stars: 12, rewardGoal: 10, rewardSpent: 10 }).reached).toBe(false);
    expect(rewardProgress({ stars: 5, rewardGoal: null, rewardSpent: 0 }).reached).toBe(false);
  });
});

describe('modèles', () => {
  it('chaque modèle donne des tâches valides', () => {
    for (const pack of TEMPLATE_PACKS) {
      const inputs = packToInputs(pack);
      expect(inputs.length).toBeGreaterThan(0);
      for (const i of inputs) expect(createTask(i).title.length).toBeGreaterThan(0);
    }
  });

  it('les routines sont quotidiennes, sans notification imposée', () => {
    const morning = packToInputs(TEMPLATE_PACKS.find((p) => p.id === 'matin')!);
    expect(morning.every((t) => t.reminder.repeat === 'daily' && !t.reminder.enabled && t.moment === 'matin')).toBe(true);
  });

  it('propose d’abord les modèles adaptés à l’âge', () => {
    expect(packsFor('adulte')[0].for).toContain('adulte');
    expect(packsFor('enfant').findIndex((p) => p.id === 'chambre')).toBeLessThan(packsFor('enfant').findIndex((p) => p.id === 'maison'));
  });
});
