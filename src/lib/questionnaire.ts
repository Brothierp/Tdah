import { tabOf } from './moments';
import type { TaskInput } from './taskOps';
import type { AgeGroup, Moment, Task } from './types';

/**
 * Petit questionnaire du premier lancement : une question par écran, 2 ou 3 réponses.
 * Les réponses construisent les routines du matin, de la journée et du soir.
 */

export interface Question {
  id: string;
  emoji: string;
  text: (age: AgeGroup) => string;
  options: { value: string; label: string }[];
}

export type Answers = Record<string, string>;

const YES_NO = [
  { value: 'oui', label: 'Oui' },
  { value: 'non', label: 'Non' },
];

export const QUESTIONS: Question[] = [
  {
    id: 'breakfast',
    emoji: '🥣',
    text: () => 'Le matin, tu prends un petit-déjeuner ?',
    options: YES_NO,
  },
  {
    id: 'bag',
    emoji: '🎒',
    text: (age) => (age === 'adulte' ? 'Tu dois préparer un sac (travail, sport…) ?' : 'Tu as un sac ou un cartable à préparer ?'),
    options: [
      { value: 'veille', label: 'Oui, la veille au soir' },
      { value: 'matin', label: 'Oui, le matin' },
      { value: 'non', label: 'Non' },
    ],
  },
  {
    id: 'shower',
    emoji: '🚿',
    text: () => 'Tu prends ta douche plutôt…',
    options: [
      { value: 'matin', label: 'Le matin' },
      { value: 'soir', label: 'Le soir' },
      { value: 'non', label: 'Je ne veux pas de rappel' },
    ],
  },
  {
    id: 'meds',
    emoji: '💊',
    text: () => 'Tu as un traitement (médicament) à prendre ?',
    options: [
      { value: 'matin', label: 'Oui, le matin' },
      { value: 'soir', label: 'Oui, le soir' },
      { value: 'non', label: 'Non' },
    ],
  },
  {
    id: 'work',
    emoji: '📚',
    text: (age) =>
      age === 'adulte'
        ? 'Dans la journée, tu veux de l’aide pour te concentrer sur une tâche ?'
        : 'Tu as des devoirs à faire après l’école ?',
    options: YES_NO,
  },
  {
    id: 'clothes',
    emoji: '👕',
    text: () => 'Tu veux préparer tes vêtements la veille ?',
    options: YES_NO,
  },
  {
    id: 'calm',
    emoji: '📖',
    text: () => 'Un moment calme avant de dormir (lecture, musique) ?',
    options: YES_NO,
  },
];

type Item = { title: string; emoji: string; minutes: number; steps?: string[]; moment: Moment | null };

function routine(item: Item): TaskInput {
  return {
    title: item.title,
    emoji: item.emoji,
    durationMin: item.minutes,
    steps: item.steps ?? [],
    moment: item.moment,
    // Une routine revient chaque jour ; pas de notification imposée (activable ensuite).
    reminder: { enabled: false, at: null, repeat: 'daily', nudge: true },
  };
}

/** Construit les routines à partir des réponses, dans l'ordre logique de la journée. */
export function buildRoutines(answers: Answers, age: AgeGroup): TaskInput[] {
  const a = (id: string) => answers[id];
  const kid = age !== 'adulte';
  const items: (Item | false)[] = [
    // Matin
    { title: 'Me lever et m’habiller', emoji: '👕', minutes: 5, steps: ['Sortir du lit', 'Mettre mes vêtements'], moment: 'matin' },
    a('shower') === 'matin' && { title: 'Douche', emoji: '🚿', minutes: 10, moment: 'matin' },
    a('breakfast') === 'oui' && { title: 'Petit-déjeuner', emoji: '🥣', minutes: 15, moment: 'matin' },
    a('meds') === 'matin' && { title: 'Prendre mon traitement', emoji: '💊', minutes: 1, moment: 'matin' },
    { title: 'Me brosser les dents', emoji: '🦷', minutes: 2, steps: ['Dentifrice', 'Brosser 2 minutes', 'Rincer'], moment: 'matin' },
    a('bag') === 'matin' && {
      title: kid ? 'Préparer mon cartable' : 'Préparer mon sac',
      emoji: '🎒',
      minutes: 5,
      steps: kid ? ['Cahiers et livres', 'Trousse', 'Goûter et gourde'] : ['Clés et papiers', 'Chargeur', 'Gourde'],
      moment: 'matin',
    },

    // Journée
    a('work') === 'oui' &&
      (kid
        ? {
            title: 'Faire mes devoirs',
            emoji: '📚',
            minutes: 20,
            steps: ['Sortir l’agenda', 'Faire un exercice', 'Vérifier', 'Ranger mes affaires'],
            moment: null,
          }
        : {
            title: 'Bloc de concentration',
            emoji: '💻',
            minutes: 25,
            steps: ['Choisir UNE tâche', 'Couper les notifications', 'Travailler jusqu’au timer'],
            moment: null,
          }),

    // Soir
    a('shower') === 'soir' && { title: 'Douche', emoji: '🚿', minutes: 10, moment: 'soir' },
    a('meds') === 'soir' && { title: 'Prendre mon traitement', emoji: '💊', minutes: 1, moment: 'soir' },
    a('bag') === 'veille' && {
      title: kid ? 'Préparer mon cartable pour demain' : 'Préparer mon sac pour demain',
      emoji: '🎒',
      minutes: 5,
      steps: kid ? ['Regarder l’emploi du temps', 'Cahiers et livres', 'Trousse'] : ['Clés et papiers', 'Chargeur', 'Gourde'],
      moment: 'soir',
    },
    a('clothes') === 'oui' && { title: 'Préparer mes vêtements pour demain', emoji: '👕', minutes: 3, moment: 'soir' },
    { title: 'Me brosser les dents', emoji: '🦷', minutes: 2, moment: 'soir' },
    a('calm') === 'oui' && { title: 'Moment calme', emoji: '📖', minutes: 15, moment: 'soir' },
    { title: 'Aller au lit', emoji: '🛏️', minutes: 1, moment: 'soir' },
  ];
  return items.filter((i): i is Item => !!i).map(routine);
}

const key = (title: string, moment: Moment | null | undefined) => `${tabOf(moment)}|${title.trim().toLowerCase()}`;

/** Évite les doublons quand on refait le questionnaire : même titre dans le même onglet = déjà là. */
export function withoutDuplicates(existing: Task[], inputs: TaskInput[]): TaskInput[] {
  const seen = new Set(existing.map((t) => key(t.title, t.moment)));
  return inputs.filter((i) => {
    const k = key(i.title, i.moment);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
