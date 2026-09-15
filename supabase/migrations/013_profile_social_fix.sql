-- BAARO — correctif ciblé profil + abonnements + amis
-- À exécuter dans Supabase SQL Editor.
-- Ne modifie pas les autres fonctionnalités.

alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists birth_date date;
alter table public.profiles add column if not exists location text;
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

alter table public.follows add column if not exists status text not null default 'accepted';
alter table public.follows add column if not exists is_friend boolean not null default false;
alter table public.follows add column if not exists id uuid default gen_random_uuid();

create unique index if not exists idx_follows_id on public.follows(id);
create index if not exists idx_follows_follower_status on public.follows(follower_id, status);
create index if not exists idx_follows_followed_status on public.follows(followed_id, status);
create index if not exists idx_follows_friend on public.follows(follower_id, followed_id, is_friend, status);

create or replace function public.toggle_follow(p_target uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  exists_row boolean;
begin
  if me is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_target is null or p_target = me then raise exception 'INVALID_TARGET'; end if;

  select exists(
    select 1 from public.follows
    where follower_id = me
      and followed_id = p_target
      and status = 'accepted'
  ) into exists_row;

  if exists_row then
    delete from public.follows
    where follower_id = me and followed_id = p_target;
    return false;
  end if;

  insert into public.follows(follower_id, followed_id, status, is_friend)
  values (me, p_target, 'accepted', false)
  on conflict (follower_id, followed_id)
  do update set status = 'accepted';

  return true;
end;
$$;

revoke all on function public.toggle_follow(uuid) from public;
grant execute on function public.toggle_follow(uuid) to authenticated;

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "follows_read" on public.follows;
create policy "follows_read" on public.follows
for select using (true);

drop policy if exists "follows_own" on public.follows;
create policy "follows_own" on public.follows
for all using (auth.uid() = follower_id)
with check (auth.uid() = follower_id);
