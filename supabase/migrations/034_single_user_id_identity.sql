-- BAARO: correctif définitif identité + profil + abonnements + amis
-- Exécuter après les migrations existantes. Id utilisateur canonique = auth.users.id.

-- PROFIL: colonnes nécessaires et RLS
alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists birth_date date;
alter table public.profiles add column if not exists location text;
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists cover_url text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists updated_at timestamptz default now();
alter table public.profiles enable row level security;
drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read" on public.profiles for select using (true);
drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = user_id);
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- WALLET: une seule ligne par utilisateur, même user_id que auth.users.id.
alter table public.wallets enable row level security;
drop policy if exists "wallet_own" on public.wallets;
create policy "wallet_own" on public.wallets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- FOLLOWS: normaliser l'ancien nom avant toute requête qui utilise followed_id.
do $$
begin
  if to_regclass('public.follows') is null then
    create table public.follows (
      follower_id uuid not null references auth.users(id) on delete cascade,
      followed_id uuid not null references auth.users(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (follower_id, followed_id)
    );
  end if;
end $$;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='follows' and column_name='following_id')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='follows' and column_name='followed_id') then
    alter table public.follows rename column following_id to followed_id;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='follows' and column_name='followed_id') then
    alter table public.follows add column followed_id uuid;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='follows' and column_name='following_id')
     and exists (select 1 from information_schema.columns where table_schema='public' and table_name='follows' and column_name='followed_id') then
    update public.follows set followed_id=coalesce(followed_id,following_id) where followed_id is null;
    alter table public.follows drop column following_id;
  end if;
end $$;

alter table public.follows add column if not exists status text not null default 'accepted';
alter table public.follows add column if not exists is_friend boolean not null default false;
alter table public.follows add column if not exists id uuid default gen_random_uuid();

-- Garantir l'unicité du couple sans dépendre du nom d'une ancienne PK.
create unique index if not exists uq_follows_user_pair on public.follows(follower_id, followed_id);
create index if not exists idx_follows_follower_status on public.follows(follower_id,status);
create index if not exists idx_follows_followed_status on public.follows(followed_id,status);
create index if not exists idx_follows_friends on public.follows(follower_id,followed_id,is_friend,status);

-- Recréer les FK utilisateur si elles manquent.
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.follows'::regclass and contype='f' and pg_get_constraintdef(oid) ilike '%follower_id%auth.users%') then
    alter table public.follows add constraint follows_follower_auth_fk foreign key (follower_id) references auth.users(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.follows'::regclass and contype='f' and pg_get_constraintdef(oid) ilike '%followed_id%auth.users%') then
    alter table public.follows add constraint follows_followed_auth_fk foreign key (followed_id) references auth.users(id) on delete cascade;
  end if;
end $$;

alter table public.follows enable row level security;
drop policy if exists "follows_read" on public.follows;
create policy "follows_read" on public.follows for select using (true);
drop policy if exists "follows_own" on public.follows;
create policy "follows_own" on public.follows for insert with check (auth.uid()=follower_id);
drop policy if exists "follows_delete_own" on public.follows;
create policy "follows_delete_own" on public.follows for delete using (auth.uid()=follower_id);
drop policy if exists "follows_request_receiver" on public.follows;
create policy "follows_request_receiver" on public.follows for update using (auth.uid()=followed_id and status='pending' and is_friend=true) with check (auth.uid()=followed_id);

-- Suivre / désuivre. La cible est toujours auth.users.id.
create or replace function public.toggle_follow(p_target uuid)
returns boolean language plpgsql security definer set search_path=public,auth as $$
declare me uuid:=auth.uid(); following boolean;
begin
  if me is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_target is null or p_target=me then raise exception 'INVALID_TARGET'; end if;
  if not exists(select 1 from auth.users where id=p_target) then raise exception 'USER_NOT_FOUND'; end if;
  select exists(select 1 from public.follows where follower_id=me and followed_id=p_target and status='accepted') into following;
  if following then delete from public.follows where follower_id=me and followed_id=p_target; return false; end if;
  insert into public.follows(follower_id,followed_id,status,is_friend) values(me,p_target,'accepted',false)
    on conflict(follower_id,followed_id) do update set status='accepted',is_friend=false;
  return true;
end $$;
revoke all on function public.toggle_follow(uuid) from public;
grant execute on function public.toggle_follow(uuid) to authenticated;
