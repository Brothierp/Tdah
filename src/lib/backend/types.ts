import type { AgeGroup, PublicUser, Settings, Task } from '../types';

export const MIN_PASSWORD_LENGTH = 6;
export const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;

export interface RegisterInput {
  name: string;
  password: string;
  avatar: string;
  ageGroup: AgeGroup;
  /** Mode local (et comptes enfants) : identifiant. */
  username?: string;
  /** Mode cloud : e-mail. */
  email?: string;
}

export interface ChildInput {
  name: string;
  username: string;
  password: string;
  avatar: string;
  ageGroup: AgeGroup;
}

export type RegisterResult = { account: PublicUser } | { needsEmailConfirmation: true };

/** Compte mémorisé sur l'appareil pour l'écran « Qui es-tu ? ». */
export interface KnownAccount {
  id: string;
  name: string;
  avatar: string;
  /** Ce qu'on saisit pour se connecter (identifiant ou e-mail). */
  login: string;
}

export interface Family {
  children: PublicUser[];
  parent: PublicUser | null;
}

export type LinkChildInput = { username: string; password: string } | { code: string };

/**
 * Tout ce dont l'app a besoin pour les comptes et les données.
 * Deux implémentations : locale (tout sur l'appareil) et cloud (Supabase + cache hors ligne).
 */
export interface Backend {
  mode: 'local' | 'cloud';

  restoreSession(): Promise<PublicUser | null>;
  knownAccounts(): Promise<KnownAccount[]>;
  register(input: RegisterInput): Promise<RegisterResult>;
  login(login: string, password: string): Promise<PublicUser>;
  logout(): Promise<void>;
  /** Relit le compte connecté (il a pu changer sur un autre appareil). */
  refreshAccount(): Promise<PublicUser | null>;
  updateProfile(patch: Partial<Pick<PublicUser, 'name' | 'avatar' | 'ageGroup'>>): Promise<PublicUser>;
  changePassword(current: string, next: string): Promise<void>;
  deleteAccount(password: string): Promise<void>;

  getFamily(): Promise<Family>;
  createChild(input: ChildInput): Promise<PublicUser>;
  /** Local : identifiant + mot de passe de l'enfant. Cloud : code généré sur le compte de l'enfant. */
  linkChild(input: LinkChildInput): Promise<PublicUser>;
  /** Cloud : code à 6 chiffres à donner au parent. */
  createLinkCode(): Promise<{ code: string; expiresAt: string }>;
  unlinkChild(childId: string): Promise<void>;
  resetChildPassword(childId: string, password: string): Promise<void>;
  deleteChild(childId: string, parentPassword: string): Promise<void>;

  loadTasks(ownerId: string): Promise<Task[]>;
  /** Enregistre le passage de `prev` à `next` (le cloud n'envoie que les différences). */
  saveTasks(ownerId: string, prev: Task[], next: Task[]): Promise<void>;
  loadSettings(ownerId: string): Promise<Settings>;
  saveSettings(ownerId: string, settings: Settings): Promise<void>;

  /** Nombre de modifications pas encore envoyées au serveur (0 en mode local). */
  pendingChanges(): number;
  /** Envoie les modifications en attente (no-op en mode local). */
  flush(): Promise<void>;
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function checkNewPassword(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`);
  }
}

export function checkUsername(username: string): string {
  const login = normalizeUsername(username);
  if (!USERNAME_RE.test(login)) {
    throw new Error("L'identifiant doit faire 3 à 30 caractères (lettres, chiffres, . _ -).");
  }
  return login;
}
