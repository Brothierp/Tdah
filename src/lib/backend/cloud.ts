import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { readJSON, writeJSON } from '../storage';
import { diffTasks } from '../taskOps';
import { DEFAULT_SETTINGS, type AgeGroup, type PublicUser, type Settings, type Task } from '../types';
import {
  checkNewPassword,
  checkUsername,
  normalizeUsername,
  type Backend,
  type ChildInput,
  type KnownAccount,
  type RegisterInput,
} from './types';

/**
 * Mode cloud (Supabase) : comptes en ligne, synchronisés entre appareils.
 *
 * Hors ligne : toutes les lectures ont un cache local, et les écritures passent par une
 * file d'attente (« outbox ») persistée, envoyée dès que le réseau revient.
 */

/** Domaine réservé (RFC 2606) des comptes enfants, qui n'ont pas d'e-mail réel. Identique côté serveur. */
export const CHILD_EMAIL_DOMAIN = 'enfants.focus.invalid';

const K = {
  known: 'focus:cloud:known',
  profile: (id: string) => `focus:cloud:${id}:profile`,
  family: (id: string) => `focus:cloud:${id}:family`,
  outbox: (id: string) => `focus:cloud:${id}:outbox`,
  tasks: (viewer: string, owner: string) => `focus:cloud:${viewer}:tasks:${owner}`,
  settings: (viewer: string, owner: string) => `focus:cloud:${viewer}:settings:${owner}`,
};

interface ProfileRow {
  id: string;
  username: string | null;
  name: string;
  avatar: string;
  age_group: AgeGroup;
  parent_id: string | null;
  settings: Partial<Settings>;
  created_at: string;
}

type TaskRow = { id: string; owner_id: string; position: number; data: Omit<Task, 'id'> };

type Op =
  | { kind: 'upsert'; ownerId: string; rows: TaskRow[] }
  | { kind: 'delete'; ownerId: string; ids: string[] }
  | { kind: 'settings'; ownerId: string; settings: Settings };

const PROFILE_COLUMNS = 'id, username, name, avatar, age_group, parent_id, settings, created_at';

class NetworkError extends Error {
  constructor() {
    super('Pas de connexion internet. Réessaie plus tard.');
  }
}

function isNetworkFailure(error: unknown): boolean {
  if (!error) return false;
  const e = error as { name?: string; code?: string; message?: string };
  if (e.name === 'AuthRetryableFetchError' || e.name === 'FunctionsFetchError') return true;
  // Les erreurs PostgREST « réseau » n'ont pas de code SQL.
  if ('code' in e && !e.code && /fetch|network/i.test(e.message ?? '')) return true;
  return /Failed to fetch|Network request failed|NetworkError|Load failed/i.test(e.message ?? '');
}

function authMessage(error: { message?: string; code?: string; name?: string }): string {
  if (isNetworkFailure(error)) return new NetworkError().message;
  const m = error.message ?? '';
  if (/invalid login credentials/i.test(m)) return 'Identifiant ou mot de passe incorrect.';
  if (/email not confirmed/i.test(m)) return 'Confirme d’abord ton e-mail (regarde ta boîte de réception).';
  if (/already registered|already been registered|already exists/i.test(m)) return 'Un compte existe déjà avec cet e-mail.';
  if (/password should be|weak password/i.test(m)) return 'Mot de passe trop faible : au moins 6 caractères.';
  if (/unable to validate email|invalid format|email address .* invalid/i.test(m)) return 'Adresse e-mail invalide.';
  if (/rate limit|for security purposes|too many/i.test(m)) return 'Trop de tentatives. Réessaie dans quelques minutes.';
  return m || 'Une erreur est survenue.';
}

function toLoginEmail(login: string): string {
  const value = login.trim().toLowerCase();
  return value.includes('@') ? value : `${normalizeUsername(value)}@${CHILD_EMAIL_DOMAIN}`;
}

export function createCloudBackend(url: string, key: string): Backend {
  const sb: SupabaseClient = createClient(url, key, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
  });

  let me: { id: string; email: string | null } | null = null;
  let outbox: Op[] = [];
  let flushing: Promise<void> | null = null;

  if (Platform.OS !== 'web') {
    // Sur mobile, on ne rafraîchit la session que quand l'app est au premier plan.
    AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        sb.auth.startAutoRefresh();
        flush();
      } else {
        sb.auth.stopAutoRefresh();
      }
    });
  }

  function toAccount(row: ProfileRow): PublicUser {
    const ownEmail = row.id === me?.id ? me.email : null;
    return {
      id: row.id,
      name: row.name,
      username: row.username,
      email: ownEmail && !ownEmail.endsWith(`@${CHILD_EMAIL_DOMAIN}`) ? ownEmail : null,
      avatar: row.avatar,
      ageGroup: row.age_group,
      createdAt: row.created_at,
      parentId: row.parent_id,
    };
  }

  function requireMe() {
    if (!me) throw new Error('Aucun compte connecté.');
    return me;
  }

  async function fetchProfile(id: string): Promise<ProfileRow> {
    const { data, error } = await sb.from('profiles').select(PROFILE_COLUMNS).eq('id', id).single();
    if (error) throw isNetworkFailure(error) ? new NetworkError() : new Error(error.message);
    return data as ProfileRow;
  }

  async function startSession(user: { id: string; email?: string | null }): Promise<PublicUser> {
    me = { id: user.id, email: user.email ?? null };
    outbox = await readJSON<Op[]>(K.outbox(user.id), []);
    const row = await fetchProfile(user.id);
    await writeJSON(K.profile(user.id), row);
    const account = toAccount(row);
    await remember({ id: account.id, name: account.name, avatar: account.avatar, login: account.email ?? account.username ?? '' });
    return account;
  }

  async function remember(entry: KnownAccount) {
    if (!entry.login) return;
    const list = await readJSON<KnownAccount[]>(K.known, []);
    await writeJSON(K.known, [entry, ...list.filter((a) => a.id !== entry.id)].slice(0, 8));
  }

  async function forget(id: string) {
    const list = await readJSON<KnownAccount[]>(K.known, []);
    await writeJSON(K.known, list.filter((a) => a.id !== id));
  }

  /** Vérifie le mot de passe du compte connecté avant une action sensible. */
  async function reauthenticate(password: string) {
    const { email } = requireMe();
    if (!email) throw new Error('Session invalide.');
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(isNetworkFailure(error) ? new NetworkError().message : 'Mot de passe incorrect.');
    }
  }

  async function callFamily<T>(body: Record<string, unknown>): Promise<T> {
    const { data, error } = await sb.functions.invoke('family', { body });
    if (error) {
      if (isNetworkFailure(error)) throw new NetworkError();
      const payload = await (error as { context?: Response }).context?.json?.().catch(() => null);
      throw new Error(payload?.error ?? error.message);
    }
    return data as T;
  }

  async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
    const { data, error } = await sb.rpc(fn, args);
    if (error) throw isNetworkFailure(error) ? new NetworkError() : new Error(error.message);
    return data as T;
  }

  // --- File d'attente hors ligne -------------------------------------------------

  async function persistOutbox() {
    if (me) await writeJSON(K.outbox(me.id), outbox);
  }

  async function applyOp(op: Op) {
    switch (op.kind) {
      case 'upsert':
        return (await sb.from('tasks').upsert(op.rows)).error;
      case 'delete':
        return (await sb.from('tasks').delete().in('id', op.ids)).error;
      case 'settings':
        return (await sb.from('profiles').update({ settings: op.settings }).eq('id', op.ownerId)).error;
    }
  }

  function flush(): Promise<void> {
    if (flushing) return flushing;
    flushing = (async () => {
      while (outbox.length > 0 && me) {
        const op = outbox[0];
        const error = await applyOp(op).catch((e: unknown) => e as Error);
        if (error && isNetworkFailure(error)) return; // on réessaiera plus tard
        if (error) console.warn('Synchronisation : modification refusée par le serveur', error);
        outbox.shift();
        await persistOutbox();
      }
    })().finally(() => {
      flushing = null;
    });
    return flushing;
  }

  async function enqueue(op: Op) {
    if (op.kind === 'settings') outbox = outbox.filter((o) => !(o.kind === 'settings' && o.ownerId === op.ownerId));
    outbox.push(op);
    await persistOutbox();
    flush();
  }

  const hasPending = (ownerId: string) => outbox.some((o) => o.ownerId === ownerId);

  return {
    mode: 'cloud',

    async restoreSession() {
      const { data } = await sb.auth.getSession();
      const user = data.session?.user;
      if (!user) return null;
      try {
        return await startSession(user);
      } catch (e) {
        if (e instanceof NetworkError) {
          // Hors ligne : on continue avec le profil en cache.
          const cached = await readJSON<ProfileRow | null>(K.profile(user.id), null);
          return cached ? toAccount(cached) : null;
        }
        await sb.auth.signOut({ scope: 'local' });
        me = null;
        return null;
      }
    },

    knownAccounts: () => readJSON<KnownAccount[]>(K.known, []),

    async register(input: RegisterInput) {
      const email = (input.email ?? '').trim().toLowerCase();
      const name = input.name.trim();
      if (!name) throw new Error('Indique ton prénom.');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Adresse e-mail invalide.');
      checkNewPassword(input.password);
      const { data, error } = await sb.auth.signUp({
        email,
        password: input.password,
        options: { data: { name, avatar: input.avatar, age_group: input.ageGroup } },
      });
      if (error) throw new Error(authMessage(error));
      if (!data.session || !data.user) return { needsEmailConfirmation: true };
      return { account: await startSession(data.user) };
    },

    async login(login, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email: toLoginEmail(login), password });
      if (error) throw new Error(authMessage(error));
      return startSession(data.user);
    },

    async logout() {
      await flush().catch(() => {});
      await sb.auth.signOut({ scope: 'local' });
      me = null;
      outbox = [];
    },

    async refreshAccount() {
      if (!me) return null;
      try {
        const row = await fetchProfile(me.id);
        await writeJSON(K.profile(me.id), row);
        return toAccount(row);
      } catch {
        const cached = await readJSON<ProfileRow | null>(K.profile(me.id), null);
        return cached ? toAccount(cached) : null;
      }
    },

    async updateProfile(patch) {
      const { id } = requireMe();
      const row: Partial<ProfileRow> = {};
      if (patch.name !== undefined) {
        const name = patch.name.trim();
        if (!name) throw new Error('Le prénom ne peut pas être vide.');
        row.name = name;
      }
      if (patch.avatar !== undefined) row.avatar = patch.avatar;
      if (patch.ageGroup !== undefined) row.age_group = patch.ageGroup;
      const { data, error } = await sb.from('profiles').update(row).eq('id', id).select(PROFILE_COLUMNS).single();
      if (error) {
        if (isNetworkFailure(error)) throw new NetworkError();
        throw new Error(/adulte/.test(error.message) ? 'Un compte suivi ne peut pas être adulte.' : error.message);
      }
      await writeJSON(K.profile(id), data);
      const account = toAccount(data as ProfileRow);
      await remember({ id, name: account.name, avatar: account.avatar, login: account.email ?? account.username ?? '' });
      return account;
    },

    async changePassword(current, next) {
      checkNewPassword(next);
      await reauthenticate(current);
      const { error } = await sb.auth.updateUser({ password: next });
      if (error) throw new Error(authMessage(error));
    },

    async deleteAccount(password) {
      const { id } = requireMe();
      await reauthenticate(password);
      await callFamily({ action: 'delete_account' });
      await sb.auth.signOut({ scope: 'local' });
      await forget(id);
      await AsyncStorage.multiRemove([K.profile(id), K.family(id), K.outbox(id)]);
      me = null;
      outbox = [];
    },

    async getFamily() {
      const { id } = requireMe();
      try {
        const own = await fetchProfile(id);
        const { data, error } = await sb.from('profiles').select(PROFILE_COLUMNS).eq('parent_id', id).order('created_at');
        if (error) throw isNetworkFailure(error) ? new NetworkError() : new Error(error.message);
        const parent = own.parent_id ? await fetchProfile(own.parent_id).catch(() => null) : null;
        const family = { children: (data as ProfileRow[]).map(toAccount), parent: parent ? toAccount(parent) : null };
        await writeJSON(K.family(id), family);
        return family;
      } catch (e) {
        if (!(e instanceof NetworkError)) throw e;
        return readJSON(K.family(id), { children: [], parent: null });
      }
    },

    async createChild(input: ChildInput) {
      const username = checkUsername(input.username);
      checkNewPassword(input.password);
      if (!input.name.trim()) throw new Error('Indique le prénom.');
      const { child_id } = await callFamily<{ child_id: string }>({
        action: 'create_child',
        username,
        name: input.name.trim(),
        avatar: input.avatar,
        age_group: input.ageGroup,
        password: input.password,
      });
      return toAccount(await fetchProfile(child_id));
    },

    async linkChild(input) {
      if (!('code' in input)) throw new Error('Saisis le code affiché sur le compte de l’enfant.');
      const code = input.code.replace(/\D/g, '');
      if (code.length !== 6) throw new Error('Le code fait 6 chiffres.');
      const childId = await rpc<string | null>('redeem_link_code', { p_code: code });
      if (!childId) throw new Error('Code invalide ou expiré.');
      return toAccount(await fetchProfile(childId));
    },

    async createLinkCode() {
      const res = await rpc<{ code: string; expires_at: string }>('create_link_code');
      return { code: res.code, expiresAt: res.expires_at };
    },

    async unlinkChild(childId) {
      await rpc('unlink_child', { p_child: childId });
    },

    async resetChildPassword(childId, password) {
      checkNewPassword(password);
      await callFamily({ action: 'reset_child_password', child_id: childId, password });
    },

    async deleteChild(childId, parentPassword) {
      await reauthenticate(parentPassword);
      await callFamily({ action: 'delete_child', child_id: childId });
    },

    async loadTasks(ownerId) {
      const { id: viewer } = requireMe();
      const cacheKey = K.tasks(viewer, ownerId);
      await flush().catch(() => {});
      // Des modifications attendent encore le réseau : la version locale est la plus récente.
      if (hasPending(ownerId)) return readJSON<Task[]>(cacheKey, []);
      const { data, error } = await sb.from('tasks').select('id, data, position').eq('owner_id', ownerId).order('position');
      if (error) {
        if (isNetworkFailure(error)) return readJSON<Task[]>(cacheKey, []);
        throw new Error(error.message);
      }
      const tasks = (data as Pick<TaskRow, 'id' | 'data'>[]).map((r) => ({ ...r.data, id: r.id }) as Task);
      await writeJSON(cacheKey, tasks);
      return tasks;
    },

    async saveTasks(ownerId, prev, next) {
      const { id: viewer } = requireMe();
      await writeJSON(K.tasks(viewer, ownerId), next);
      const { upserts, deletes } = diffTasks(prev, next);
      if (upserts.length > 0) {
        await enqueue({
          kind: 'upsert',
          ownerId,
          rows: upserts.map(({ task: { id, ...data }, position }) => ({ id, owner_id: ownerId, position, data })),
        });
      }
      if (deletes.length > 0) await enqueue({ kind: 'delete', ownerId, ids: deletes });
    },

    async loadSettings(ownerId) {
      const { id: viewer } = requireMe();
      const cacheKey = K.settings(viewer, ownerId);
      const cached = async () => ({ ...DEFAULT_SETTINGS, ...(await readJSON<Partial<Settings>>(cacheKey, {})) });
      if (outbox.some((o) => o.kind === 'settings' && o.ownerId === ownerId)) return cached();
      const { data, error } = await sb.from('profiles').select('settings').eq('id', ownerId).single();
      if (error) {
        if (isNetworkFailure(error)) return cached();
        throw new Error(error.message);
      }
      const settings = { ...DEFAULT_SETTINGS, ...(data.settings as Partial<Settings>) };
      await writeJSON(cacheKey, settings);
      return settings;
    },

    async saveSettings(ownerId, settings) {
      const { id: viewer } = requireMe();
      await writeJSON(K.settings(viewer, ownerId), settings);
      await enqueue({ kind: 'settings', ownerId, settings });
    },

    pendingChanges: () => outbox.length,
    flush,
  };
}
