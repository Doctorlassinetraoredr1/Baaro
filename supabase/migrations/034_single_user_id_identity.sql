-- BAARO — Identité unique utilisateur
-- Principe: auth.users.id est l'unique identifiant utilisateur.
-- Le wallet n'a pas de wallet_id: wallets.user_id est sa clé primaire et FK vers auth.users.id.
-- Cette migration ne crée aucun identifiant utilisateur parallèle.

-- Vérification/renforcement du wallet: une ligne de wallet par utilisateur.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.wallets'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) ilike '%user_id%auth.users%'
  ) then
    alter table public.wallets
      add constraint wallets_user_id_auth_fk
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

-- Compatibilité avec les anciennes versions de BAARO :
-- certaines bases possèdent encore follows.following_id au lieu de follows.followed_id.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'follows' and column_name = 'following_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'follows' and column_name = 'followed_id'
  ) then
    alter table public.follows rename column following_id to followed_id;
  elsif not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'follows' and column_name = 'followed_id'
  ) then
    alter table public.follows add column followed_id uuid;
  end if;
end $$;

-- Si les deux colonnes existent dans une ancienne base, recopier les valeurs
-- puis supprimer l'ancien alias pour ne garder qu'un seul nom canonique.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='follows' and column_name='following_id')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='follows' and column_name='followed_id') then
    execute 'update public.follows set followed_id = coalesce(followed_id, following_id) where followed_id is null';
    execute 'alter table public.follows drop column following_id';
  end if;
end $$;

-- Garantir le type/FK de la colonne canonique.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.follows'::regclass
      and contype = 'f'
      and pg_get_constraintdef(oid) ilike '%followed_id%auth.users%'
  ) then
    alter table public.follows
      add constraint follows_followed_id_auth_fk
      foreign key (followed_id) references auth.users(id) on delete cascade;
  end if;
end $$;

-- Unification sociale: toutes les relations pointent vers auth.users.id.
alter table public.follows enable row level security;

-- Lecture publique des relations; écriture par le propriétaire du côté follower.
drop policy if exists "follows_read" on public.follows;
create policy "follows_read" on public.follows for select using (true);

drop policy if exists "follows_own" on public.follows;
create policy "follows_own" on public.follows
  for all using (auth.uid() = follower_id)
  with check (auth.uid() = follower_id);

-- Le destinataire doit pouvoir accepter/refuser uniquement une demande qui lui est destinée.
drop policy if exists "follows_request_receiver" on public.follows;
create policy "follows_request_receiver" on public.follows
  for update using (
    auth.uid() = followed_id
    and status = 'pending'
    and is_friend = true
  )
  with check (auth.uid() = followed_id);

-- Le demandeur crée la relation avec son propre user_id.
-- L'acceptation est ensuite effectuée par le destinataire via ses follower_id/followed_id.

-- Normalisation des colonnes sociales historiques.
alter table public.follows
  add column if not exists status text not null default 'accepted',
  add column if not exists is_friend boolean not null default false;

-- Index utiles sans créer de nouvel identifiant utilisateur.
create index if not exists idx_follows_follower_status on public.follows(follower_id, status);
create index if not exists idx_follows_followed_status on public.follows(followed_id, status);
create index if not exists idx_follows_friend_pair on public.follows(follower_id, followed_id, is_friend, status);

-- Suivi atomique: cible = user_id Supabase, jamais un ID fictif.
create or replace function public.toggle_follow(p_target uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  already_following boolean;
begin
  if me is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_target is null or p_target = me then raise exception 'INVALID_TARGET'; end if;

  if not exists (select 1 from auth.users where id = p_target) then
    raise exception 'USER_NOT_FOUND';
  end if;

  select exists(
    select 1 from public.follows
    where follower_id = me and followed_id = p_target and status = 'accepted'
  ) into already_following;

  if already_following then
    delete from public.follows where follower_id = me and followed_id = p_target;
    return false;
  end if;

  insert into public.follows(follower_id, followed_id, status, is_friend)
  values (me, p_target, 'accepted', false)
  on conflict (follower_id, followed_id)
  do update set status = 'accepted', is_friend = false;

  return true;
end;
$$;

revoke all on function public.toggle_follow(uuid) from public;
grant execute on function public.toggle_follow(uuid) to authenticated;
