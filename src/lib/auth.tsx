import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import {
  backend,
  type ChildInput,
  type KnownAccount,
  type LinkChildInput,
  type RegisterInput,
  type RegisterResult,
} from './backend';
import type { PublicUser } from './types';

export { MIN_PASSWORD_LENGTH, type RegisterInput } from './backend';

interface AuthContextValue {
  /** 'cloud' : comptes en ligne (Supabase). 'local' : tout reste sur l'appareil. */
  mode: 'local' | 'cloud';
  user: PublicUser | null;
  /** Le compte connecté peut-il suivre des enfants ? (adulte non supervisé) */
  canSupervise: boolean;
  /** Comptes enfants suivis par le compte connecté. */
  children: PublicUser[];
  /** Parent qui suit le compte connecté, s'il y en a un. */
  parent: PublicUser | null;
  /** Comptes mémorisés sur l'appareil (pour l'écran de choix du profil). */
  accounts: KnownAccount[];
  loading: boolean;
  register: (input: RegisterInput) => Promise<RegisterResult>;
  login: (login: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<PublicUser, 'name' | 'avatar' | 'ageGroup'>>) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  refreshFamily: () => Promise<void>;
  createChild: (input: ChildInput) => Promise<PublicUser>;
  linkChild: (input: LinkChildInput) => Promise<PublicUser>;
  createLinkCode: () => Promise<{ code: string; expiresAt: string }>;
  unlinkChild: (childId: string) => Promise<void>;
  resetChildPassword: (childId: string, newPassword: string) => Promise<void>;
  deleteChild: (childId: string, parentPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children: content }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [family, setFamily] = useState<{ children: PublicUser[]; parent: PublicUser | null }>({ children: [], parent: null });
  const [accounts, setAccounts] = useState<KnownAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAccounts = useCallback(async () => setAccounts(await backend.knownAccounts()), []);

  const refreshFamily = useCallback(async () => {
    setFamily(await backend.getFamily());
  }, []);

  const enter = useCallback(
    async (account: PublicUser | null) => {
      setUser(account);
      setFamily(account ? await backend.getFamily().catch(() => ({ children: [], parent: null })) : { children: [], parent: null });
      await loadAccounts();
    },
    [loadAccounts],
  );

  useEffect(() => {
    (async () => {
      const account = await backend.restoreSession().catch(() => null);
      await enter(account);
      setLoading(false);
    })();
  }, [enter]);

  // Au retour dans l'app : le compte a pu changer ailleurs (parent relié, avatar…).
  useEffect(() => {
    if (!user) return;
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return;
      const fresh = await backend.refreshAccount().catch(() => null);
      if (fresh) setUser(fresh);
      refreshFamily().catch(() => {});
    });
    return () => sub.remove();
  }, [user, refreshFamily]);

  const register = useCallback<AuthContextValue['register']>(
    async (input) => {
      const result = await backend.register(input);
      if ('account' in result) await enter(result.account);
      return result;
    },
    [enter],
  );

  const login = useCallback(async (login: string, password: string) => enter(await backend.login(login, password)), [enter]);

  const logout = useCallback(async () => {
    await backend.logout();
    await enter(null);
  }, [enter]);

  const updateProfile = useCallback<AuthContextValue['updateProfile']>(async (patch) => {
    setUser(await backend.updateProfile(patch));
    setAccounts(await backend.knownAccounts());
  }, []);

  const deleteAccount = useCallback(
    async (password: string) => {
      await backend.deleteAccount(password);
      await enter(null);
    },
    [enter],
  );

  const withFamilyRefresh = useCallback(
    <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
      async (...args: A) => {
        const result = await fn(...args);
        await refreshFamily();
        return result;
      },
    [refreshFamily],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      mode: backend.mode,
      user,
      canSupervise: !!user && user.ageGroup === 'adulte' && !user.parentId,
      children: family.children,
      parent: family.parent,
      accounts,
      loading,
      register,
      login,
      logout,
      updateProfile,
      changePassword: (current, next) => backend.changePassword(current, next),
      deleteAccount,
      refreshFamily,
      createChild: withFamilyRefresh((input: ChildInput) => backend.createChild(input)),
      linkChild: withFamilyRefresh((input: LinkChildInput) => backend.linkChild(input)),
      createLinkCode: () => backend.createLinkCode(),
      unlinkChild: withFamilyRefresh((id: string) => backend.unlinkChild(id)),
      resetChildPassword: (id, password) => backend.resetChildPassword(id, password),
      deleteChild: withFamilyRefresh((id: string, password: string) => backend.deleteChild(id, password)),
    }),
    [user, family, accounts, loading, register, login, logout, updateProfile, deleteAccount, refreshFamily, withFamilyRefresh],
  );

  return <AuthContext.Provider value={value}>{content}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>.');
  return ctx;
}
