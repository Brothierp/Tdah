import * as Crypto from 'expo-crypto';
import { keys, readJSON, removeKeys, writeJSON } from '../storage';
import { DEFAULT_SETTINGS, type PublicUser, type Settings, type Task, type User } from '../types';
import {
  checkNewPassword,
  checkUsername,
  normalizeUsername,
  type Backend,
  type ChildInput,
  type RegisterInput,
} from './types';

/**
 * Mode local : comptes et données sur l'appareil uniquement (AsyncStorage).
 * Utilisé quand aucun serveur n'est configuré. Le suivi parent ne marche que sur le même appareil.
 */

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
  return { ...rest, email: null, parentId: rest.parentId ?? null };
}

async function newUser(
  input: { name: string; username: string; password: string; avatar: string; ageGroup: User['ageGroup'] },
  existing: User[],
  parentId: string | null,
): Promise<User> {
  const name = input.name.trim();
  if (!name) throw new Error('Indique le prénom.');
  const username = checkUsername(input.username);
  checkNewPassword(input.password);
  if (existing.some((u) => u.username === username)) throw new Error('Cet identifiant est déjà utilisé.');
  const salt = toHex(Crypto.getRandomBytes(16));
  return {
    id: Crypto.randomUUID(),
    name,
    username,
    avatar: input.avatar,
    ageGroup: input.ageGroup,
    salt,
    passwordHash: await hashPassword(input.password, salt),
    createdAt: new Date().toISOString(),
    parentId,
  };
}

export function createLocalBackend(): Backend {
  let session: string | null = null;

  const users = () => readJSON<User[]>(keys.users, []);
  const saveUsers = (list: User[]) => writeJSON(keys.users, list);
  const setSession = async (id: string | null) => {
    session = id;
    await writeJSON(keys.session, id);
  };

  async function current(): Promise<User> {
    const me = (await users()).find((u) => u.id === session);
    if (!me) throw new Error('Aucun compte connecté.');
    return me;
  }

  async function verify(user: User, password: string) {
    if ((await hashPassword(password, user.salt)) !== user.passwordHash) throw new Error('Mot de passe incorrect.');
  }

  async function ownChild(childId: string): Promise<{ list: User[]; child: User; me: User }> {
    const list = await users();
    const me = list.find((u) => u.id === session);
    const child = list.find((u) => u.id === childId);
    if (!me || !child || child.parentId !== me.id) throw new Error('Ce compte ne fait pas partie de ta famille.');
    return { list, child, me };
  }

  const canSupervise = (u: User) => u.ageGroup === 'adulte' && !u.parentId;

  return {
    mode: 'local',

    async restoreSession() {
      const [list, stored] = await Promise.all([users(), readJSON<string | null>(keys.session, null)]);
      const me = list.find((u) => u.id === stored);
      session = me?.id ?? null;
      return me ? toPublic(me) : null;
    },

    async knownAccounts() {
      return (await users()).map((u) => ({ id: u.id, name: u.name, avatar: u.avatar, login: u.username }));
    },

    async register(input: RegisterInput) {
      const list = await users();
      const user = await newUser({ ...input, username: input.username ?? '' }, list, null);
      await saveUsers([...list, user]);
      await setSession(user.id);
      return { account: toPublic(user) };
    },

    async login(login, password) {
      const found = (await users()).find((u) => u.username === normalizeUsername(login));
      if (!found || (await hashPassword(password, found.salt)) !== found.passwordHash) {
        throw new Error('Identifiant ou mot de passe incorrect.');
      }
      await setSession(found.id);
      return toPublic(found);
    },

    logout: () => setSession(null),

    async refreshAccount() {
      const me = (await users()).find((u) => u.id === session);
      return me ? toPublic(me) : null;
    },

    async updateProfile(patch) {
      const me = await current();
      const name = patch.name?.trim();
      if (patch.name !== undefined && !name) throw new Error('Le prénom ne peut pas être vide.');
      if (me.parentId && patch.ageGroup === 'adulte') throw new Error('Un compte suivi ne peut pas être adulte.');
      const updated: User = { ...me, ...patch, ...(name ? { name } : {}) };
      await saveUsers((await users()).map((u) => (u.id === me.id ? updated : u)));
      return toPublic(updated);
    },

    async changePassword(currentPassword, next) {
      const me = await current();
      await verify(me, currentPassword);
      checkNewPassword(next);
      const salt = toHex(Crypto.getRandomBytes(16));
      const passwordHash = await hashPassword(next, salt);
      await saveUsers((await users()).map((u) => (u.id === me.id ? { ...u, salt, passwordHash } : u)));
    },

    async deleteAccount(password) {
      const me = await current();
      await verify(me, password);
      if (me.parentId) {
        throw new Error('Ce compte est suivi par un parent : demande-lui de le supprimer depuis son espace Famille.');
      }
      await removeKeys(keys.tasks(me.id), keys.settings(me.id));
      // Les enfants suivis redeviennent des comptes indépendants.
      await saveUsers(
        (await users()).filter((u) => u.id !== me.id).map((u) => (u.parentId === me.id ? { ...u, parentId: null } : u)),
      );
      await setSession(null);
    },

    async getFamily() {
      const list = await users();
      const me = list.find((u) => u.id === session);
      if (!me) return { children: [], parent: null };
      const parent = me.parentId ? list.find((u) => u.id === me.parentId) : undefined;
      return {
        children: list.filter((u) => u.parentId === me.id).map(toPublic),
        parent: parent ? toPublic(parent) : null,
      };
    },

    async createChild(input: ChildInput) {
      const list = await users();
      const me = await current();
      if (!canSupervise(me)) throw new Error('Seul un compte adulte peut ajouter un enfant.');
      const child = await newUser(input, list, me.id);
      await saveUsers([...list, child]);
      return toPublic(child);
    },

    async linkChild(input) {
      if (!('username' in input)) throw new Error('Saisis l’identifiant et le mot de passe de l’enfant.');
      const me = await current();
      if (!canSupervise(me)) throw new Error('Seul un compte adulte peut suivre un enfant.');
      const list = await users();
      const child = list.find((u) => u.username === normalizeUsername(input.username));
      // Le mot de passe de l'enfant prouve que le parent a son accord / son accès.
      if (!child || (await hashPassword(input.password, child.salt)) !== child.passwordHash) {
        throw new Error('Identifiant ou mot de passe incorrect.');
      }
      if (child.id === me.id) throw new Error('Tu ne peux pas te suivre toi-même.');
      if (child.ageGroup === 'adulte') throw new Error('Seuls les comptes Enfant ou Ado peuvent être suivis.');
      if (child.parentId && child.parentId !== me.id) throw new Error('Ce compte est déjà suivi par un autre parent.');
      const linked = { ...child, parentId: me.id };
      await saveUsers(list.map((u) => (u.id === child.id ? linked : u)));
      return toPublic(linked);
    },

    async createLinkCode() {
      throw new Error('Les codes de liaison ne servent qu’en mode connecté.');
    },

    async unlinkChild(childId) {
      const { list } = await ownChild(childId);
      await saveUsers(list.map((u) => (u.id === childId ? { ...u, parentId: null } : u)));
    },

    async resetChildPassword(childId, password) {
      const { list } = await ownChild(childId);
      checkNewPassword(password);
      const salt = toHex(Crypto.getRandomBytes(16));
      const passwordHash = await hashPassword(password, salt);
      await saveUsers(list.map((u) => (u.id === childId ? { ...u, salt, passwordHash } : u)));
    },

    async deleteChild(childId, parentPassword) {
      const { list, me } = await ownChild(childId);
      await verify(me, parentPassword);
      await removeKeys(keys.tasks(childId), keys.settings(childId));
      await saveUsers(list.filter((u) => u.id !== childId));
    },

    loadTasks: (ownerId) => readJSON<Task[]>(keys.tasks(ownerId), []),
    saveTasks: (ownerId, _prev, next) => writeJSON(keys.tasks(ownerId), next),
    async loadSettings(ownerId) {
      return { ...DEFAULT_SETTINGS, ...(await readJSON<Partial<Settings>>(keys.settings(ownerId), {})) };
    },
    saveSettings: (ownerId, settings) => writeJSON(keys.settings(ownerId), settings),

    pendingChanges: () => 0,
    flush: async () => {},
  };
}
