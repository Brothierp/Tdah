import { describe, expect, it } from '@jest/globals';
import { currentTab, tabOf, tasksOfTab } from '../moments';
import { buildRoutines, QUESTIONS, withoutDuplicates } from '../questionnaire';
import { createTask } from '../taskOps';

const titles = (inputs: { title: string; moment?: string | null }[], moment: string | null) =>
  inputs.filter((i) => (i.moment ?? null) === moment).map((i) => i.title);

describe('onglets', () => {
  it('range chaque moment dans le bon onglet', () => {
    expect(tabOf('matin')).toBe('matin');
    expect(tabOf('midi')).toBe('journee');
    expect(tabOf('aprem')).toBe('journee');
    expect(tabOf(null)).toBe('journee');
    expect(tabOf('soir')).toBe('soir');
  });

  it('ouvre le bon onglet selon l’heure', () => {
    expect(currentTab(new Date(2026, 10, 15, 7))).toBe('matin');
    expect(currentTab(new Date(2026, 10, 15, 15))).toBe('journee');
    expect(currentTab(new Date(2026, 10, 15, 20))).toBe('soir');
  });
});

describe('questionnaire', () => {
  it('chaque question a 2 ou 3 réponses', () => {
    for (const q of QUESTIONS) {
      expect(q.options.length).toBeGreaterThanOrEqual(2);
      expect(q.options.length).toBeLessThanOrEqual(3);
      expect(q.text('enfant').length).toBeGreaterThan(5);
    }
  });

  it('toutes les réponses « oui » donnent des routines complètes et ordonnées', () => {
    const r = buildRoutines(
      { breakfast: 'oui', bag: 'matin', shower: 'matin', meds: 'matin', work: 'oui', clothes: 'oui', calm: 'oui' },
      'enfant',
    );
    expect(titles(r, 'matin')).toEqual([
      'Me lever et m’habiller',
      'Douche',
      'Petit-déjeuner',
      'Prendre mon traitement',
      'Me brosser les dents',
      'Préparer mon cartable',
    ]);
    expect(titles(r, null)).toEqual(['Faire mes devoirs']);
    expect(titles(r, 'soir')).toEqual(['Préparer mes vêtements pour demain', 'Me brosser les dents', 'Moment calme', 'Aller au lit']);
    expect(r.every((t) => t.reminder.repeat === 'daily' && !t.reminder.enabled)).toBe(true);
  });

  it('respecte les « non » et le moment choisi', () => {
    const r = buildRoutines({ breakfast: 'non', bag: 'veille', shower: 'soir', meds: 'non', work: 'non', clothes: 'non', calm: 'non' }, 'adulte');
    expect(titles(r, 'matin')).toEqual(['Me lever et m’habiller', 'Me brosser les dents']);
    expect(titles(r, null)).toEqual([]);
    expect(titles(r, 'soir')).toEqual(['Douche', 'Préparer mon sac pour demain', 'Me brosser les dents', 'Aller au lit']);
  });

  it('adapte le vocabulaire à l’âge', () => {
    expect(titles(buildRoutines({ work: 'oui' }, 'adulte'), null)).toEqual(['Bloc de concentration']);
    expect(QUESTIONS.find((q) => q.id === 'bag')!.text('enfant')).toMatch(/cartable/);
  });

  it('ne crée pas de doublons quand on refait le questionnaire', () => {
    const first = buildRoutines({ breakfast: 'oui' }, 'ado');
    const existing = first.map((i) => createTask(i));
    expect(withoutDuplicates(existing, buildRoutines({ breakfast: 'oui', calm: 'oui' }, 'ado')).map((i) => i.title)).toEqual(['Moment calme']);
    // « Me brosser les dents » existe matin ET soir : ce ne sont pas des doublons.
    expect(tasksOfTab(existing, 'soir').map((t) => t.title)).toContain('Me brosser les dents');
    expect(tasksOfTab(existing, 'matin').map((t) => t.title)).toContain('Me brosser les dents');
  });
});
