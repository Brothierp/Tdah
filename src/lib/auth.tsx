import * as Crypto from 'expo-crypto';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { keys, readJSON, removeKeys, writeJSON } from './storage';
import type { AgeGroup, PublicUser, User } from './types';

const HASH_ROUNDS = 500;

async function hashPassword(password: string, salt: string): Promise<string> {
  let hash = `${salt}:${password}`;
  for (let i = 0; i < HASH_ROUNDS; i++) {
    hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}${hash}`);
  }
  return hash;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function toPublic({ passwordHash: _h, salt: _s, ...rest }: User): PublicUser {
  return rest;
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export interface RegisterInput {
  name: string;
  username: string;
  password: string;
  avatar: string;
  ageGroup: AgeGroup;
}

interface AuthContextValue {
  user: PublicUser | null;
  /** Le compte connecté peut-il suivre des enfants ? (adulte non supervisé) */
  canSupervise: boolean;
  /** Comptes enfants suivis par le compte connecté. */
  children: PublicUser[];
  /** Parent qui suit le compte connecté, s'il y en a un. */
  parent: PublicUser | null;
  /** Comptes existants sur l'appareil (pour l'écran de choix du profil). */
  accounts: PublicUser[];
  loading: boolean;
  register: (input: RegisterInput) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<User, 'name' | 'avatar' | 'ageGroup'>>) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  createChild: (input: RegisterInput) => Promise<PublicUser>;
  linkChild: (username: string, childPassword: string) => Promise<PublicUser>;
  unlinkChild: (childId: string) => Promise<void>;
  resetChildPassword: (childId: string, newPassword: string) => Promise<void>;
  deleteChild: (childId: string, parentPassword: string) => Promise<void>;
}

function checkNewPassword(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`);
  }
}

async function buildUser(
  { name, username, password, avatar, ageGroup }: RegisterInput,
  existing: User[],
  parentId: string | null = null,
): Promise<User> {
  const cleanName = name.trim();
  const login = normalizeUsername(username);
  if (!cleanName) throw new Error('Indique le prénom.');
  if (!/^[a-z0-9._-]{3,30}$/.test(login)) {
    throw new Error("L'identifiant doit faire 3 à 30 caractères (lettres, chiffres, . _ -).");
  }
  checkNewPassword(password);
  if (existing.some((u) => u.username === login)) throw new Error('Cet identifiant est déjà utilisé.');
  const salt = toHex(Crypto.getRandomBytes(16));
  return {
    id: Crypto.randomUUID(),
    name: cleanName,
    username: login,
    avatar,
    ageGroup,
    salt,
    passwordHash: await hashPassword(password, salt),
    createdAt: new Date().toISOString(),
    parentId,
  };
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const MIN_PASSWORD_LENGTH = 4;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [storedUsers, session] = await Promise.all([
        readJSON<User[]>(keys.users, []),
        readJSON<string | null>(keys.session, null),
      ]);
      setUsers(storedUsers);
      setUserId(storedUsers.some((u) => u.id === session) ? session : null);
      setLoading(false);
    })();
  }, []);

  const saveUsers = useCallback(async (next: User[]) => {
    setUsers(next);
    await writeJSON(keys.users, next);
  }, []);

  const startSession = useCallback(async (id: string | null) => {
    setUserId(id);
    await writeJSON(keys.session, id);
  }, []);

  const register = useCallback(
    async (input: RegisterInput) => {
      const user = await buildUser(input, users);
      await saveUsers([...users, user]);
      await startSession(user.id);
    },
    [users, saveUsers, startSession],
  );

  const login = useCallback(
    async (username: string, password: string) => {
      const found = users.find((u) => u.username === normalizeUsername(username));
      if (!found || (await hashPassword(password, found.salt)) !== found.passwordHash) {
        throw new Error('Identifiant ou mot de passe incorrect.');
      }
      await startSession(found.id);
    },
    [users, startSession],
  );

  const logout = useCallback(() => startSession(null), [startSession]);

  const updateProfile = useCallback<AuthContextValue['updateProfile']>(
    async (patch) => {
      if (!userId) return;
      const name = patch.name?.trim();
      if (patch.name !== undefined && !name) throw new Error('Le prénom ne peut pas être vide.');
      await saveUsers(users.map((u) => (u.id === userId ? { ...u, ...patch, ...(name ? { name } : {}) } : u)));
    },
    [userId, users, saveUsers],
  );

  const checkPassword = useCallback(
    async (password: string): Promise<User> => {
      const current = users.find((u) => u.id === userId);
      if (!current) throw new Error('Aucun compte connecté.');
      if ((await hashPassword(password, current.salt)) !== current.passwordHash) {
        throw new Error('Mot de passe incorrect.');
      }
      return current;
    },
    [users, userId],
  );

  const changePassword = useCallback(
    async (currentPassword: string, next: string) => {
      const current = await checkPassword(currentPassword);
      checkNewPassword(next);
      const salt = toHex(Crypto.getRandomBytes(16));
      const passwordHash = await hashPassword(next, salt);
      await saveUsers(users.map((u) => (u.id === current.id ? { ...u, salt, passwordHash } : u)));
    },
    [checkPassword, users, saveUsers],
  );

  const deleteAccount = useCallback(
    async (password: string) => {
      const current = await checkPassword(password);
      if (current.parentId) {
        throw new Error('Ce compte est suivi par un parent : demande-lui de le supprimer depuis son espace Famille.');
      }
      await removeKeys(keys.tasks(current.id), keys.settings(current.id));
      // Les enfants suivis redeviennent des comptes indépendants.
      await saveUsers(
        users.filter((u) => u.id !== current.id).map((u) => (u.parentId === current.id ? { ...u, parentId: null } : u)),
      );
      await startSession(null);
    },
    [checkPassword, users, saveUsers, startSession],
  );

  const current = users.find((u) => u.id === userId);
  const canSupervise = !!current && current.ageGroup === 'adulte' && !current.parentId;

  /** Vérifie que childId est bien un enfant du compte connecté. */
  const ownChild = useCallback(
    (childId: string): User => {
      const child = users.find((u) => u.id === childId);
      if (!child || !userId || child.parentId !== userId) throw new Error("Ce compte ne fait pas partie de ta famille.");
      return child;
    },
    [users, userId],
  );

  const createChild = useCallback(
    async (input: RegisterInput) => {
      if (!canSupervise || !userId) throw new Error('Seul un compte adulte peut ajouter un enfant.');
      const child = await buildUser(input, users, userId);
      await saveUsers([...users, child]);
      return toPublic(child);
    },
    [canSupervise, userId, users, saveUsers],
  );

  const linkChild = useCallback(
    async (username: string, childPassword: string) => {
      if (!canSupervise || !userId) throw new Error('Seul un compte adulte peut suivre un enfant.');
      const child = users.find((u) => u.username === normalizeUsername(username));
      // Le mot de passe de l'enfant prouve que le parent a son accord / son accès.
      if (!child || (await hashPassword(childPassword, child.salt)) !== child.passwordHash) {
        throw new Error('Identifiant ou mot de passe incorrect.');
      }
      if (child.id === userId) throw new Error('Tu ne peux pas te suivre toi-même.');
      if (child.ageGroup === 'adulte') throw new Error('Seuls les comptes Enfant ou Ado peuvent être suivis.');
      if (child.parentId && child.parentId !== userId) throw new Error('Ce compte est déjà suivi par un autre parent.');
      await saveUsers(users.map((u) => (u.id === child.id ? { ...u, parentId: userId } : u)));
      return toPublic(child);
    },
    [canSupervise, userId, users, saveUsers],
  );

  const unlinkChild = useCallback(
    async (childId: string) => {
      ownChild(childId);
      await saveUsers(users.map((u) => (u.id === childId ? { ...u, parentId: null } : u)));
    },
    [ownChild, users, saveUsers],
  );

  const resetChildPassword = useCallback(
    async (childId: string, newPassword: string) => {
      ownChild(childId);
      checkNewPassword(newPassword);
      const salt = toHex(Crypto.getRandomBytes(16));
      const passwordHash = await hashPassword(newPassword, salt);
      await saveUsers(users.map((u) => (u.id === childId ? { ...u, salt, passwordHash } : u)));
    },
    [ownChild, users, saveUsers],
  );

  const deleteChild = useCallback(
    async (childId: string, parentPassword: string) => {
      ownChild(childId);
      await checkPassword(parentPassword);
      await removeKeys(keys.tasks(childId), keys.settings(childId));
      await saveUsers(users.filter((u) => u.id !== childId));
    },
    [ownChild, checkPassword, users, saveUsers],
  );

  const value = useMemo<AuthContextValue>(() => {
    const parent = current?.parentId ? users.find((u) => u.id === current.parentId) : undefined;
    return {
      user: current ? toPublic(current) : null,
      canSupervise,
      children: userId ? users.filter((u) => u.parentId === userId).map(toPublic) : [],
      parent: parent ? toPublic(parent) : null,
      accounts: users.map(toPublic),
      loading,
      register,
      login,
      logout,
      updateProfile,
      changePassword,
      deleteAccount,
      createChild,
      linkChild,
      unlinkChild,
      resetChildPassword,
      deleteChild,
    };
  }, [
    current,
    canSupervise,
    users,
    userId,
    loading,
    register,
    login,
    logout,
    updateProfile,
    changePassword,
    deleteAccount,
    createChild,
    linkChild,
    unlinkChild,
    resetChildPassword,
    deleteChild,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>.');
  return ctx;
}
