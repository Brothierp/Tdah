import { describe, expect, it } from '@jest/globals';
import { parseImport, splitDuplicates } from '../importLink';
import { createTask } from '../taskOps';

const link = (obj: unknown) => JSON.stringify(obj);

describe('parseImport', () => {
  it('lit les tâches envoyées par Reset 66', () => {
    const p = parseImport(
      link({ v: 1, src: 'Reset 66', lab: 'Jour 3', t: [{ t: 'Debout à 08h00', e: '☀️', m: 'matin' }, { t: 'Séance douce', e: '🚶', min: 13, m: 'aprem', s: ['Échauffement', 'Squat sur chaise'] }] }),
    );
    expect(p?.source).toBe('Reset 66');
    expect(p?.label).toBe('Jour 3');
    expect(p?.tasks).toHaveLength(2);
    expect(p?.tasks[1]).toMatchObject({ durationMin: 13, moment: 'aprem', steps: ['Échauffement', 'Squat sur chaise'] });
    expect(p?.tasks[0].reminder.repeat).toBe('none');
  });

  it('accepte un paramètre encore encodé', () => {
    expect(parseImport(encodeURIComponent(link({ t: [{ t: 'Eau' }] })))?.tasks[0].title).toBe('Eau');
  });

  it('rejette les liens vides, cassés ou sans tâche', () => {
    expect(parseImport(undefined)).toBeNull();
    expect(parseImport('pas du json')).toBeNull();
    expect(parseImport(link({ t: [{ t: '   ' }] }))).toBeNull();
  });

  it('borne les valeurs reçues', () => {
    const p = parseImport(link({ t: [{ t: 'x'.repeat(200), e: '🙂🙂🙂🙂🙂🙂', min: 9999, m: 'nuit', s: Array(30).fill('étape') }] }));
    const t = p!.tasks[0];
    expect(t.title).toHaveLength(80);
    expect(t.durationMin).toBeNull();
    expect(t.moment).toBeNull();
    expect(t.steps).toHaveLength(12);
  });
});

describe('splitDuplicates', () => {
  it('ne réajoute pas une tâche encore à faire', () => {
    const existing = [createTask({ title: 'Boire 2 L d’eau', emoji: '💧', durationMin: null, steps: [], reminder: { enabled: false, at: null, repeat: 'none', nudge: false } })];
    const p = parseImport(link({ t: [{ t: 'boire 2 l d’eau' }, { t: 'Lire 10 pages' }] }))!;
    const { fresh, already } = splitDuplicates(p.tasks, existing);
    expect(fresh.map((t) => t.title)).toEqual(['Lire 10 pages']);
    expect(already).toHaveLength(1);
  });
});
