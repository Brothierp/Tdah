export type AgeGroup = 'enfant' | 'ado' | 'adulte';

/** Compte tel que vu par l'app (sans secret). */
export interface PublicUser {
  id: string;
  name: string;
  /** Identifiant de connexion sans e-mail (comptes locaux et comptes enfants). */
  username: string | null;
  /** E-mail de connexion (comptes cloud créés en libre-service). */
  email?: string | null;
  avatar: string;
  ageGroup: AgeGroup;
  createdAt: string;
  /** Compte parent qui suit ce compte (enfant / ado). */
  parentId?: string | null;
}

/** Compte stocké en mode local (avec l'empreinte du mot de passe). */
export interface User extends PublicUser {
  username: string;
  passwordHash: string;
  salt: string;
}

export interface Step {
  id: string;
  title: string;
  done: boolean;
}

export type ReminderRepeat = 'none' | 'daily';

/** Moment de la journée : sert d'emploi du temps visuel. null = « quand je veux ». */
export type Moment = 'matin' | 'midi' | 'aprem' | 'soir';

export interface TaskReminder {
  enabled: boolean;
  /** Date/heure du rappel (ISO). */
  at: string | null;
  repeat: ReminderRepeat;
  /** Relance automatique si la tâche n'est pas cochée. */
  nudge: boolean;
}

export interface Task {
  id: string;
  title: string;
  emoji: string;
  done: boolean;
  doneAt: string | null;
  createdAt: string;
  /** Identifiant du parent si la tâche a été ajoutée par lui (sinon null). */
  createdBy?: string | null;
  /** Durée estimée en minutes (sert à lancer le timer). */
  durationMin: number | null;
  steps: Step[];
  reminder: TaskReminder;
  /** Moment de la journée (absent sur les anciennes tâches = « quand je veux »). */
  moment?: Moment | null;
}

export interface Settings {
  /** Interrupteur général : désactive toutes les notifications de rappel. */
  remindersEnabled: boolean;
  /** Rappel quotidien des tâches restantes. */
  dailySummaryEnabled: boolean;
  dailySummaryHour: number;
  dailySummaryMinute: number;
  /** Délai de relance (minutes) quand une tâche n'est pas faite. */
  nudgeDelayMin: number;
  hapticsEnabled: boolean;
  keepScreenAwake: boolean;
  /** Prévenir 1 minute avant la fin du timer (aide aux transitions). */
  timerWarning: boolean;

  // Confort
  /** Écran d'accueil : une seule tâche à la fois, ou toute la liste. null = selon l'âge. */
  homeView: 'focus' | 'list' | null;
  textSize: 'normal' | 'grand' | 'tres-grand';
  /** Mode calme : pas d'animations ni de confettis, couleurs plus douces. */
  calmMode: boolean;

  // Motivation
  stars: number;
  /** Nombre de jours d'affilée avec au moins une tâche faite. */
  streak: number;
  /** Dernier jour (AAAA-MM-JJ) avec une tâche faite. */
  lastDoneDay: string | null;
  /** Objectif : nombre d'étoiles pour obtenir la récompense (null = pas d'objectif). */
  rewardGoal: number | null;
  rewardLabel: string;
  /** Étoiles déjà « dépensées » pour des récompenses. */
  rewardSpent: number;

  /** Accueil guidé déjà vu. */
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  remindersEnabled: true,
  dailySummaryEnabled: false,
  dailySummaryHour: 8,
  dailySummaryMinute: 0,
  nudgeDelayMin: 15,
  hapticsEnabled: true,
  keepScreenAwake: true,
  timerWarning: true,
  homeView: null,
  textSize: 'normal',
  calmMode: false,
  stars: 0,
  streak: 0,
  lastDoneDay: null,
  rewardGoal: null,
  rewardLabel: '',
  rewardSpent: 0,
  onboarded: false,
};
