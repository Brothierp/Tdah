// Fonction serveur « family » : actions qui nécessitent des droits d'administration.
//   create_child          un parent crée le compte de son enfant (identifiant, sans e-mail)
//   reset_child_password  un parent change le mot de passe de son enfant
//   delete_child          un parent supprime le compte de son enfant
//   delete_account        un utilisateur supprime son propre compte (obligatoire sur les stores)
//
// L'identité de l'appelant est vérifiée à partir de son jeton de session.
// Aucune dépendance : appels HTTP directs aux API Auth (admin) et REST de Supabase.

/** Domaine réservé (RFC 2606) : les comptes enfants n'ont pas d'e-mail réel. */
const CHILD_EMAIL_DOMAIN = 'enfants.focus.invalid';
const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;
const MIN_PASSWORD_LENGTH = 6;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function call(path: string, init: { method?: string; body?: unknown; token?: string; prefer?: string } = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${init.token ?? SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.prefer ? { Prefer: init.prefer } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  return { ok: res.ok, status: res.status, data };
}

function failure(res: { status: number; data: unknown }): string {
  const d = res.data as { msg?: string; message?: string; error_description?: string } | null;
  return d?.msg ?? d?.message ?? d?.error_description ?? `Erreur ${res.status}`;
}

const admin = {
  getUser: (token: string) => call('/auth/v1/user', { token }),
  createUser: (body: unknown) => call('/auth/v1/admin/users', { method: 'POST', body }),
  updateUser: (id: string, body: unknown) => call(`/auth/v1/admin/users/${id}`, { method: 'PUT', body }),
  deleteUser: (id: string) => call(`/auth/v1/admin/users/${id}`, { method: 'DELETE' }),
  selectProfile: (filter: string) => call(`/rest/v1/profiles?select=id,age_group,parent_id&${filter}`),
  updateProfile: (id: string, patch: unknown) =>
    call(`/rest/v1/profiles?id=eq.${id}`, { method: 'PATCH', body: patch, prefer: 'return=minimal' }),
};

interface Profile {
  id: string;
  age_group: 'enfant' | 'ado' | 'adulte';
  parent_id: string | null;
}

async function getProfile(id: string): Promise<Profile | null> {
  const res = await admin.selectProfile(`id=eq.${encodeURIComponent(id)}`);
  if (!res.ok) throw new HttpError(500, failure(res));
  return (res.data as Profile[])[0] ?? null;
}

async function ownChild(parentId: string, childId: unknown): Promise<Profile> {
  if (typeof childId !== 'string' || !/^[0-9a-f-]{36}$/i.test(childId)) throw new HttpError(400, 'child_id invalide.');
  const child = await getProfile(childId);
  if (!child || child.parent_id !== parentId) throw new HttpError(403, 'Ce compte ne fait pas partie de ta famille.');
  return child;
}

function checkPassword(password: unknown): string {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new HttpError(400, `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`);
  }
  return password;
}

async function handle(callerId: string, body: Record<string, unknown>) {
  const caller = await getProfile(callerId);
  if (!caller) throw new HttpError(403, 'Profil introuvable.');

  switch (body.action) {
    case 'create_child': {
      if (caller.age_group !== 'adulte' || caller.parent_id) {
        throw new HttpError(403, 'Seul un compte adulte peut ajouter un enfant.');
      }
      const username = String(body.username ?? '').trim().toLowerCase();
      if (!USERNAME_RE.test(username)) {
        throw new HttpError(400, "L'identifiant doit faire 3 à 30 caractères (lettres, chiffres, . _ -).");
      }
      const name = String(body.name ?? '').trim().slice(0, 30);
      if (!name) throw new HttpError(400, 'Indique le prénom.');
      const ageGroup = body.age_group === 'ado' ? 'ado' : 'enfant';
      const password = checkPassword(body.password);

      const taken = await admin.selectProfile(`username=eq.${username}`);
      if (taken.ok && (taken.data as Profile[]).length > 0) throw new HttpError(409, 'Cet identifiant est déjà utilisé.');

      const created = await admin.createUser({
        email: `${username}@${CHILD_EMAIL_DOMAIN}`,
        password,
        email_confirm: true,
        user_metadata: { name, avatar: String(body.avatar ?? '🦊').slice(0, 16), age_group: 'ado' },
      });
      if (!created.ok) {
        const exists = created.status === 422 && /already/i.test(failure(created));
        throw new HttpError(exists ? 409 : 500, exists ? 'Cet identifiant est déjà utilisé.' : failure(created));
      }
      const childId = (created.data as { id: string }).id;
      const updated = await admin.updateProfile(childId, { username, age_group: ageGroup, parent_id: callerId });
      if (!updated.ok) {
        await admin.deleteUser(childId);
        throw new HttpError(500, failure(updated));
      }
      return { child_id: childId };
    }

    case 'reset_child_password': {
      const child = await ownChild(callerId, body.child_id);
      const res = await admin.updateUser(child.id, { password: checkPassword(body.password) });
      if (!res.ok) throw new HttpError(500, failure(res));
      return { ok: true };
    }

    case 'delete_child': {
      const child = await ownChild(callerId, body.child_id);
      const res = await admin.deleteUser(child.id);
      if (!res.ok) throw new HttpError(500, failure(res));
      return { ok: true };
    }

    case 'delete_account': {
      if (caller.parent_id) {
        throw new HttpError(403, 'Ce compte est suivi par un parent : demande-lui de le supprimer depuis son espace Famille.');
      }
      // Les enfants suivis redeviennent indépendants (clé étrangère « on delete set null »).
      const res = await admin.deleteUser(callerId);
      if (!res.ok) throw new HttpError(500, failure(res));
      return { ok: true };
    }

    default:
      throw new HttpError(400, 'Action inconnue.');
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Méthode non autorisée.' });
  try {
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) throw new HttpError(401, 'Non connecté.');
    const user = await admin.getUser(token);
    const callerId = (user.data as { id?: string } | null)?.id;
    if (!user.ok || !callerId) throw new HttpError(401, 'Session invalide.');
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    return json(200, await handle(callerId, body));
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status === 500) console.error(e);
    return json(status, { error: e instanceof Error ? e.message : 'Erreur inconnue.' });
  }
});
