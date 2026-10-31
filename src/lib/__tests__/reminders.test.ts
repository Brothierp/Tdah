import { describe, expect, it } from '@jest/globals';
import { reminderOccurrences } from '../notifications';
import { createTask } from '../taskOps';
import type { Task } from '../types';

function task(reminder: Task['reminder'], extra: Partial<Task> = {}): Task {
  return {
    ...createTask({ title: 'T', emoji: '📝', durationMin: null, steps: [], reminder }),
    ...extra,
  };
}

const at = (h: number, m: number, dayOffset = 0) => {
  const d = new Date(2026, 9, 31, h, m);
  d.setDate(d.getDate() + dayOffset);
  return d;
};
const NOW = at(10, 0);

describe('reminderOccurrences', () => {
  it('aucun rappel si désactivé', () => {
    expect(reminderOccurrences(task({ enabled: false, at: at(12, 0).toISOString(), repeat: 'none', nudge: false }), NOW)).toEqual([]);
  });

  it('rappel unique à la date choisie, supprimé quand la tâche est faite', () => {
    const t = task({ enabled: true, at: at(12, 0).toISOString(), repeat: 'none', nudge: false });
    expect(reminderOccurrences(t, NOW)).toEqual([at(12, 0)]);
    expect(reminderOccurrences({ ...t, done: true, doneAt: NOW.toISOString() }, NOW)).toEqual([]);
  });

  it('routine : 3 jours glissants à la même heure', () => {
    const t = task({ enabled: true, at: at(18, 30, -5).toISOString(), repeat: 'daily', nudge: false });
    expect(reminderOccurrences(t, NOW)).toEqual([at(18, 30), at(18, 30, 1), at(18, 30, 2)]);
  });

  it('routine déjà faite aujourd’hui : on saute le jour même', () => {
    const t = task(
      { enabled: true, at: at(18, 30).toISOString(), repeat: 'daily', nudge: false },
      { done: true, doneAt: at(9, 0).toISOString() },
    );
    expect(reminderOccurrences(t, NOW)).toEqual([at(18, 30, 1), at(18, 30, 2)]);
  });
});
