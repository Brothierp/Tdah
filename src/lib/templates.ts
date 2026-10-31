import type { TaskInput } from './taskOps';
import type { AgeGroup, Moment } from './types';

/**
 * Modèles prêts à l'emploi : on ajoute une routine complète en un geste,
 * avec des étapes déjà découpées. Tout reste modifiable ensuite.
 */

type TemplateTask = { title: string; emoji: string; durationMin?: number; steps?: string[]; daily?: boolean; moment?: Moment | null };

export interface TemplatePack {
  id: string;
  title: string;
  emoji: string;
  description: string;
  /** Tranches d'âge à qui proposer ce modèle en premier. */
  for: AgeGroup[];
  tasks: TemplateTask[];
}

export const TEMPLATE_PACKS: TemplatePack[] = [
  {
    id: 'matin',
    title: 'Routine du matin',
    emoji: '☀️',
    description: 'Se préparer sans rien oublier.',
    for: ['enfant', 'ado', 'adulte'],
    tasks: [
      { title: 'Me lever et m’habiller', emoji: '👕', durationMin: 5, steps: ['Sortir du lit', 'Mettre mes vêtements'], daily: true, moment: 'matin' },
      { title: 'Petit-déjeuner', emoji: '🍽️', durationMin: 15, daily: true, moment: 'matin' },
      { title: 'Me brosser les dents', emoji: '🦷', durationMin: 2, steps: ['Dentifrice', 'Brosser 2 minutes', 'Rincer'], daily: true, moment: 'matin' },
      { title: 'Préparer mon sac', emoji: '🎒', durationMin: 5, steps: ['Cahiers / dossiers', 'Trousse / clés', 'Gourde'], daily: true, moment: 'matin' },
    ],
  },
  {
    id: 'soir',
    title: 'Routine du soir',
    emoji: '🌙',
    description: 'Ralentir et préparer demain.',
    for: ['enfant', 'ado', 'adulte'],
    tasks: [
      { title: 'Douche', emoji: '🚿', durationMin: 10, daily: true, moment: 'soir' },
      { title: 'Me brosser les dents', emoji: '🦷', durationMin: 2, daily: true, moment: 'soir' },
      { title: 'Préparer mes affaires de demain', emoji: '🎒', durationMin: 5, steps: ['Vêtements', 'Sac'], daily: true, moment: 'soir' },
      { title: 'Moment calme (lecture, musique)', emoji: '📚', durationMin: 15, daily: true, moment: 'soir' },
    ],
  },
  {
    id: 'devoirs',
    title: 'Devoirs',
    emoji: '📚',
    description: 'Commencer, travailler par petits blocs, ranger.',
    for: ['enfant', 'ado'],
    tasks: [
      { title: 'Sortir mes affaires et l’agenda', emoji: '📝', durationMin: 2, moment: 'aprem' },
      { title: 'Faire les exercices', emoji: '✏️', durationMin: 15, steps: ['Lire la consigne', 'Faire le premier exercice', 'Vérifier'], moment: 'aprem' },
      { title: 'Petite pause pour bouger', emoji: '🏃', durationMin: 5, moment: 'aprem' },
      { title: 'Ranger mon cartable', emoji: '🎒', durationMin: 2, moment: 'aprem' },
    ],
  },
  {
    id: 'chambre',
    title: 'Ranger ma chambre',
    emoji: '🧹',
    description: 'Une grosse tâche découpée en petits morceaux.',
    for: ['enfant', 'ado'],
    tasks: [
      {
        title: 'Ranger ma chambre',
        emoji: '🧹',
        durationMin: 15,
        steps: ['Linge sale dans le panier', 'Objets par terre à leur place', 'Bureau', 'Faire le lit'],
      },
    ],
  },
  {
    id: 'travail',
    title: 'Démarrer ma journée',
    emoji: '💻',
    description: 'Se lancer au travail ou en cours sans se disperser.',
    for: ['adulte', 'ado'],
    tasks: [
      { title: 'Boire un verre d’eau', emoji: '💧', durationMin: 1, daily: true, moment: 'matin' },
      { title: 'Choisir mes 3 priorités', emoji: '⭐', durationMin: 5, daily: true, moment: 'matin' },
      { title: 'Bloc de concentration', emoji: '💻', durationMin: 25, steps: ['Couper les notifications', 'Une seule tâche', 'Noter les idées parasites'], moment: 'matin' },
      { title: 'Pause : bouger', emoji: '🏃', durationMin: 5, moment: 'matin' },
    ],
  },
  {
    id: 'maison',
    title: 'Maison',
    emoji: '🏠',
    description: 'Les tâches ménagères, une par une.',
    for: ['adulte', 'ado'],
    tasks: [
      { title: 'Vaisselle', emoji: '🍽️', durationMin: 10 },
      { title: 'Lancer une machine', emoji: '🧺', durationMin: 5, steps: ['Trier le linge', 'Lessive', 'Lancer'] },
      { title: 'Passer l’aspirateur', emoji: '🧹', durationMin: 15 },
      { title: 'Faire la liste de courses', emoji: '🛒', durationMin: 5 },
    ],
  },
  {
    id: 'sante',
    title: 'Prendre soin de moi',
    emoji: '💊',
    description: 'Médicaments, eau, mouvement.',
    for: ['adulte', 'ado', 'enfant'],
    tasks: [
      { title: 'Prendre mon traitement', emoji: '💊', durationMin: 1, daily: true, moment: 'matin' },
      { title: 'Boire de l’eau', emoji: '💧', durationMin: 1, daily: true, moment: 'aprem' },
      { title: 'Bouger 10 minutes', emoji: '🏃', durationMin: 10, daily: true, moment: 'aprem' },
    ],
  },
];

export function packsFor(ageGroup: AgeGroup): TemplatePack[] {
  return [...TEMPLATE_PACKS].sort((a, b) => Number(b.for.includes(ageGroup)) - Number(a.for.includes(ageGroup)));
}

export function packToInputs(pack: TemplatePack): (TaskInput & { moment: Moment | null })[] {
  return pack.tasks.map((t) => ({
    title: t.title,
    emoji: t.emoji,
    durationMin: t.durationMin ?? null,
    steps: t.steps ?? [],
    moment: t.moment ?? null,
    reminder: { enabled: false, at: null, repeat: t.daily ? 'daily' : 'none', nudge: true },
  }));
}
