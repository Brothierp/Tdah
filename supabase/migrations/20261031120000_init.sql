-- Focus : schéma initial
-- Profils (un par compte), tâches, codes de liaison parent ↔ enfant.
-- Règle d'accès : chacun voit ses données ; un parent voit et modifie celles de ses enfants.

-------------------------------------------------------------------------------
-- Profils
-------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Identifiant de connexion des comptes enfants (sans e-mail). Null pour les comptes avec e-mail.
  username text unique check (username ~ '^[a-z0-9._-]{3,30}$'),
  name text not null check (char_length(name) between 1 and 30),
  avatar text not null default '🦊' check (char_length(avatar) between 1 and 16),
  age_group text not null default 'adulte' check (age_group in ('enfant', 'ado', 'adulte')),
  parent_id uuid references public.profiles (id) on delete set null check (parent_id is distinct from id),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) < 4096),
  created_at timestamptz not null default now()
);

create index profiles_parent_id_idx on public.profiles (parent_id);

alter table public.profiles enable row level security;

-- Fonctions d'aide (security definer : évite la récursion des règles RLS sur profiles).
create function public.my_parent_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select parent_id from public.profiles where id = auth.uid()
$$;

create function public.is_parent_of(child uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = child and parent_id = auth.uid())
$$;

create policy "profil : moi, mes enfants, mon parent"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or parent_id = (select auth.uid()) or id = (select public.my_parent_id()));

create policy "profil : je modifie le mien"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Seules ces colonnes sont modifiables par l'utilisateur (pas parent_id ni username).
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (name, avatar, age_group, settings) on public.profiles to authenticated;

-- Un compte suivi ne peut pas se déclarer « adulte » (il pourrait sinon suivre d'autres enfants).
create function public.profiles_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is not null and new.age_group = 'adulte' then
    raise exception 'Un compte suivi par un parent ne peut pas être adulte.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger profiles_guard before insert or update on public.profiles
  for each row execute function public.profiles_guard();

-- Création automatique du profil à l'inscription.
-- L'inscription libre ne permet que « ado » ou « adulte » (« enfant » devient « ado ») : les comptes enfants sont créés
-- par un parent (fonction serveur « family »), qui fixe ensuite age_group et parent_id.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, name, avatar, age_group)
  values (
    new.id,
    left(coalesce(nullif(trim(meta ->> 'name'), ''), 'Moi'), 30),
    left(coalesce(nullif(meta ->> 'avatar', ''), '🦊'), 16),
    case when meta ->> 'age_group' in ('ado', 'enfant') then 'ado' else 'adulte' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-------------------------------------------------------------------------------
-- Tâches
-------------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  position integer not null default 0,
  -- Contenu de la tâche (titre, emoji, étapes, rappel…), au format de l'app.
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 16384),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

create index tasks_owner_id_idx on public.tasks (owner_id, position);

alter table public.tasks enable row level security;

create policy "tâches : les miennes et celles de mes enfants"
  on public.tasks for all
  to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_parent_of(owner_id)))
  with check (owner_id = (select auth.uid()) or (select public.is_parent_of(owner_id)));

revoke all on public.tasks from anon, authenticated;
grant select, insert, update, delete on public.tasks to authenticated;

create function public.tasks_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  -- Une tâche ne change pas de propriétaire.
  if tg_op = 'UPDATE' and new.owner_id <> old.owner_id then
    raise exception 'owner_id ne peut pas changer.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger tasks_touch before insert or update on public.tasks
  for each row execute function public.tasks_touch();

-------------------------------------------------------------------------------
-- Liaison parent ↔ enfant par code (le code est généré sur le compte de l'enfant)
-------------------------------------------------------------------------------
create table public.link_codes (
  code text primary key,
  child_id uuid not null unique references public.profiles (id) on delete cascade,
  expires_at timestamptz not null
);

create table public.link_attempts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  at timestamptz not null default now()
);

create index link_attempts_user_idx on public.link_attempts (user_id, at);

-- Aucune règle : tables accessibles uniquement via les fonctions ci-dessous.
alter table public.link_codes enable row level security;
alter table public.link_attempts enable row level security;
revoke all on public.link_codes, public.link_attempts from anon, authenticated;

create function public.create_link_code()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.profiles;
  new_code text;
  expires timestamptz := now() + interval '15 minutes';
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then
    raise exception 'Non connecté.' using errcode = '28000';
  end if;
  if me.parent_id is not null then
    raise exception 'Ton compte est déjà suivi par un parent.' using errcode = 'P0001';
  end if;
  if me.age_group = 'adulte' then
    raise exception 'Seuls les comptes Enfant ou Ado peuvent être suivis.' using errcode = 'P0001';
  end if;

  delete from public.link_codes where child_id = me.id or expires_at < now();
  loop
    new_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from public.link_codes where code = new_code);
  end loop;
  insert into public.link_codes (code, child_id, expires_at) values (new_code, me.id, expires);
  return jsonb_build_object('code', new_code, 'expires_at', expires);
end;
$$;

-- Renvoie l'id de l'enfant relié, ou null si le code est invalide ou expiré.
-- (Pas d'exception dans ce cas : l'essai raté doit être enregistré, une exception l'annulerait.)
create function public.redeem_link_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.profiles;
  target public.link_codes;
  failures int;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then
    raise exception 'Non connecté.' using errcode = '28000';
  end if;
  if me.age_group <> 'adulte' or me.parent_id is not null then
    raise exception 'Seul un compte adulte peut suivre un enfant.' using errcode = 'P0001';
  end if;

  -- Limite anti-devinette : 10 essais ratés par heure.
  select count(*) into failures from public.link_attempts
    where user_id = me.id and at > now() - interval '1 hour';
  if failures >= 10 then
    raise exception 'Trop d''essais. Réessaie dans une heure.' using errcode = 'P0001';
  end if;

  select * into target from public.link_codes where code = trim(p_code) and expires_at > now();
  if target.code is null then
    insert into public.link_attempts (user_id) values (me.id);
    return null;
  end if;

  update public.profiles set parent_id = me.id where id = target.child_id and parent_id is null;
  if not found then
    raise exception 'Ce compte est déjà suivi par un parent.' using errcode = 'P0001';
  end if;
  delete from public.link_codes where code = target.code;
  return target.child_id;
end;
$$;

create function public.unlink_child(p_child uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set parent_id = null where id = p_child and parent_id = auth.uid();
  if not found then
    raise exception 'Ce compte ne fait pas partie de ta famille.' using errcode = 'P0001';
  end if;
end;
$$;

-- Les fonctions ne sont appelables que par un utilisateur connecté.
revoke execute on function public.my_parent_id(), public.is_parent_of(uuid), public.create_link_code(),
  public.redeem_link_code(text), public.unlink_child(uuid) from public, anon;
grant execute on function public.my_parent_id(), public.is_parent_of(uuid), public.create_link_code(),
  public.redeem_link_code(text), public.unlink_child(uuid) to authenticated;
revoke execute on function public.handle_new_user(), public.profiles_guard(), public.tasks_touch() from public, anon, authenticated;
