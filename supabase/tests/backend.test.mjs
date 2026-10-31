// Tests d'intégration du backend : à lancer contre une stack Supabase locale.
//   npx supabase start && npm run test:backend
// Variables : SUPABASE_URL (défaut http://127.0.0.1:54321), SUPABASE_ANON_KEY (défaut : clé locale standard).
import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, test } from 'node:test';

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
// Clé « anon » publique de la stack locale de développement Supabase (identique pour tous).
const ANON =
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const CHILD_DOMAIN = 'enfants.focus.invalid';
const run = randomUUID().slice(0, 8);

const client = () => createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

async function signUp(prefix, meta) {
  const c = client();
  const email = `${prefix}-${run}@example.com`;
  const { data, error } = await c.auth.signUp({ email, password: 'secret123', options: { data: meta } });
  assert.ifError(error);
  assert.ok(data.session, 'la confirmation e-mail doit être désactivée en local');
  return { c, id: data.user.id, email };
}

async function family(c, body) {
  const { data, error } = await c.functions.invoke('family', { body });
  if (error) {
    const payload = await error.context?.json?.().catch(() => null);
    return { error: payload?.error ?? error.message, status: error.context?.status };
  }
  return { data };
}

async function loginChild(username, password) {
  const c = client();
  const { data, error } = await c.auth.signInWithPassword({ email: `${username}@${CHILD_DOMAIN}`, password });
  return { c, data, error };
}

const task = (ownerId, title) => ({ id: randomUUID(), owner_id: ownerId, position: 0, data: { title } });

describe('backend Focus', () => {
  let parent, stranger, kidId;
  const kidUsername = `leo${run}`;

  test("l'inscription crée le profil (et refuse l'âge « enfant » en libre-service)", async () => {
    parent = await signUp('maman', { name: 'Maman', avatar: '🐼', age_group: 'adulte' });
    stranger = await signUp('inconnu', { name: 'Inconnu', age_group: 'adulte' });
    const sneaky = await signUp('sneaky', { name: 'Sneaky', age_group: 'enfant' });
    const { data } = await parent.c.from('profiles').select('*').eq('id', parent.id).single();
    assert.equal(data.name, 'Maman');
    assert.equal(data.avatar, '🐼');
    assert.equal(data.age_group, 'adulte');
    const { data: s } = await sneaky.c.from('profiles').select('age_group').eq('id', sneaky.id).single();
    assert.equal(s.age_group, 'ado');
  });

  test('un anonyme ne lit aucun profil', async () => {
    const { data } = await client().from('profiles').select('*');
    assert.deepEqual(data ?? [], []);
  });

  test('un parent crée le compte de son enfant, qui se connecte avec son identifiant', async () => {
    const res = await family(parent.c, {
      action: 'create_child',
      username: kidUsername,
      name: 'Léo',
      avatar: '🦊',
      age_group: 'enfant',
      password: 'leo123',
    });
    assert.ifError(res.error);
    kidId = res.data.child_id;
    const dup = await family(parent.c, { action: 'create_child', username: kidUsername, name: 'X', password: 'leo123' });
    assert.equal(dup.status, 409);
    const { data, error } = await loginChild(kidUsername, 'leo123');
    assert.ifError(error);
    assert.equal(data.user.id, kidId);
    const { data: p } = await parent.c.from('profiles').select('*').eq('id', kidId).single();
    assert.equal(p.parent_id, parent.id);
    assert.equal(p.age_group, 'enfant');
    assert.equal(p.username, kidUsername);
  });

  test('un adulte suivi ou un enfant ne peut pas créer de compte enfant', async () => {
    const { c } = await loginChild(kidUsername, 'leo123');
    const res = await family(c, { action: 'create_child', username: `x${run}`, name: 'X', password: 'secret123' });
    assert.equal(res.status, 403);
  });

  test('parent et enfant partagent les tâches ; un inconnu ne voit rien', async () => {
    const { c: kid } = await loginChild(kidUsername, 'leo123');
    const fromParent = task(kidId, 'Préparer le cartable');
    assert.ifError((await parent.c.from('tasks').insert(fromParent)).error);
    const own = task(kidId, 'Lire 10 minutes');
    assert.ifError((await kid.from('tasks').insert(own)).error);

    const { data: kidTasks } = await kid.from('tasks').select('id').eq('owner_id', kidId);
    assert.equal(kidTasks.length, 2);
    const { data: parentView } = await parent.c.from('tasks').select('id').eq('owner_id', kidId);
    assert.equal(parentView.length, 2);

    const { data: spy } = await stranger.c.from('tasks').select('id').eq('owner_id', kidId);
    assert.equal(spy.length, 0);
    const { data: spyProfile } = await stranger.c.from('profiles').select('id').eq('id', kidId);
    assert.equal(spyProfile.length, 0);
    const forged = await stranger.c.from('tasks').insert(task(kidId, 'Piège'));
    assert.ok(forged.error, 'un inconnu ne doit pas pouvoir écrire chez un enfant');
    const upd = await stranger.c.from('tasks').update({ data: { title: 'hack' } }).eq('id', own.id).select();
    assert.equal(upd.data?.length ?? 0, 0);

    // Le parent coche / modifie, l'enfant voit la modification.
    assert.ifError((await parent.c.from('tasks').update({ data: { title: 'Lire 15 minutes' } }).eq('id', own.id)).error);
    const { data: updated } = await kid.from('tasks').select('data, updated_by').eq('id', own.id).single();
    assert.equal(updated.data.title, 'Lire 15 minutes');
    assert.equal(updated.updated_by, parent.id);
  });

  test("l'enfant voit son parent mais ne peut pas changer de parent ni devenir adulte", async () => {
    const { c: kid } = await loginChild(kidUsername, 'leo123');
    const { data: parents } = await kid.from('profiles').select('name').eq('id', parent.id);
    assert.equal(parents[0]?.name, 'Maman');
    const steal = await kid.from('profiles').update({ parent_id: null }).eq('id', kidId);
    assert.ok(steal.error, 'parent_id ne doit pas être modifiable');
    const grow = await kid.from('profiles').update({ age_group: 'adulte' }).eq('id', kidId);
    assert.ok(grow.error, 'un enfant suivi ne peut pas devenir adulte');
    const ok = await kid.from('profiles').update({ avatar: '🚀', settings: { remindersEnabled: false } }).eq('id', kidId);
    assert.ifError(ok.error);
  });

  test('un inconnu ne peut ni changer le mot de passe ni supprimer un enfant', async () => {
    assert.equal((await family(stranger.c, { action: 'reset_child_password', child_id: kidId, password: 'hacked1' })).status, 403);
    assert.equal((await family(stranger.c, { action: 'delete_child', child_id: kidId })).status, 403);
    const unlink = await stranger.c.rpc('unlink_child', { p_child: kidId });
    assert.ok(unlink.error);
  });

  test('le parent change le mot de passe de son enfant', async () => {
    const res = await family(parent.c, { action: 'reset_child_password', child_id: kidId, password: 'nouveau1' });
    assert.ifError(res.error);
    assert.ok((await loginChild(kidUsername, 'leo123')).error);
    assert.ifError((await loginChild(kidUsername, 'nouveau1')).error);
  });

  test('un compte suivi ne peut pas se supprimer lui-même', async () => {
    const { c: kid } = await loginChild(kidUsername, 'nouveau1');
    assert.equal((await family(kid, { action: 'delete_account' })).status, 403);
  });

  test('liaison par code : un ado relie son compte à un parent', async () => {
    const ado = await signUp('ado', { name: 'Jade', age_group: 'ado' });
    const adult = await signUp('adulte', { name: 'Papa', age_group: 'adulte' });
    assert.ok((await adult.c.rpc('create_link_code')).error, 'un adulte ne génère pas de code');

    const { data: code, error } = await ado.c.rpc('create_link_code');
    assert.ifError(error);
    assert.match(code.code, /^\d{6}$/);

    assert.ok((await ado.c.rpc('redeem_link_code', { p_code: code.code })).error, "l'ado ne peut pas se relier à lui-même");
    const wrong = code.code === '000000' ? '000001' : '000000';
    assert.equal((await parent.c.rpc('redeem_link_code', { p_code: wrong })).data, null);
    const { data: childId, error: redeemError } = await parent.c.rpc('redeem_link_code', { p_code: code.code });
    assert.ifError(redeemError);
    assert.equal(childId, ado.id);
    assert.equal((await adult.c.rpc('redeem_link_code', { p_code: code.code })).data, null, 'un code ne sert qu’une fois');
    assert.ok((await ado.c.rpc('create_link_code')).error, 'déjà suivi');

    // Le parent arrête le suivi : il ne voit plus les tâches.
    assert.ifError((await ado.c.from('tasks').insert(task(ado.id, 'Réviser'))).error);
    assert.equal((await parent.c.from('tasks').select('id').eq('owner_id', ado.id)).data.length, 1);
    assert.ifError((await parent.c.rpc('unlink_child', { p_child: ado.id })).error);
    assert.equal((await parent.c.from('tasks').select('id').eq('owner_id', ado.id)).data.length, 0);
  });

  test('anti-devinette : 10 essais ratés par heure maximum', async () => {
    const guesser = await signUp('devin', { name: 'Devin', age_group: 'adulte' });
    let last;
    for (let i = 0; i < 10; i++) {
      last = await guesser.c.rpc('redeem_link_code', { p_code: String(100000 + i) });
      assert.equal(last.data, null);
    }
    last = await guesser.c.rpc('redeem_link_code', { p_code: '123456' });
    assert.match(last.error?.message ?? '', /Trop d'essais/);
  });

  test("le parent supprime le compte de l'enfant (tâches comprises)", async () => {
    assert.ifError((await family(parent.c, { action: 'delete_child', child_id: kidId })).error);
    assert.ok((await loginChild(kidUsername, 'nouveau1')).error);
    assert.equal((await parent.c.from('tasks').select('id').eq('owner_id', kidId)).data.length, 0);
  });

  test('un utilisateur supprime son propre compte', async () => {
    const temp = await signUp('temp', { name: 'Temp', age_group: 'adulte' });
    assert.ifError((await temp.c.from('tasks').insert(task(temp.id, 'x'))).error);
    assert.ifError((await family(temp.c, { action: 'delete_account' })).error);
    const { error } = await client().auth.signInWithPassword({ email: temp.email, password: 'secret123' });
    assert.ok(error);
  });
});
