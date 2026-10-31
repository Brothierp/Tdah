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
  /** Comptes existants sur l'appareil (pour l'écran de choix du profil). */
  accounts: PublicUser[];
  loading: boolean;
  register: (input: RegisterInput) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<User, 'name' | 'avatar' | 'ageGroup'>>) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
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
    async ({ name, username, password, avatar, ageGroup }: RegisterInput) => {
      const cleanName = name.trim();
      const login = normalizeUsername(username);
      if (!cleanName) throw new Error('Indique ton prénom.');
      if (!/^[a-z0-9._-]{3,30}$/.test(login)) {
        throw new Error("L'identifiant doit faire 3 à 30 caractères (lettres, chiffres, . _ -).");
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        throw new Error(`Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`);
      }
      if (users.some((u) => u.username === login)) throw new Error('Cet identifiant est déjà utilisé.');

      const salt = toHex(Crypto.getRandomBytes(16));
      const user: User = {
        id: Crypto.randomUUID(),
        name: cleanName,
        username: login,
        avatar,
        ageGroup,
        salt,
        passwordHash: await hashPassword(password, salt),
        createdAt: new Date().toISOString(),
      };
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
      if (next.length < MIN_PASSWORD_LENGTH) {
        throw new Error(`Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`);
      }
      const salt = toHex(Crypto.getRandomBytes(16));
      const passwordHash = await hashPassword(next, salt);
      await saveUsers(users.map((u) => (u.id === current.id ? { ...u, salt, passwordHash } : u)));
    },
    [checkPassword, users, saveUsers],
  );

  const deleteAccount = useCallback(
    async (password: string) => {
      const current = await checkPassword(password);
      await removeKeys(keys.tasks(current.id), keys.settings(current.id));
      await saveUsers(users.filter((u) => u.id !== current.id));
      await startSession(null);
    },
    [checkPassword, users, saveUsers, startSession],
  );

  const value = useMemo<AuthContextValue>(() => {
    const current = users.find((u) => u.id === userId);
    return {
      user: current ? toPublic(current) : null,
      accounts: users.map(toPublic),
      loading,
      register,
      login,
      logout,
      updateProfile,
      changePassword,
      deleteAccount,
    };
  }, [users, userId, loading, register, login, logout, updateProfile, changePassword, deleteAccount]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>.');
  return ctx;
}
