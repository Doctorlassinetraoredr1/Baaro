-- Onglet "Contact" (Communauté) — v2, performance + fiabilité du matching.
-- Remplace l'approche "une colonne phone_hash/email_hash" par une table dédiée
-- contact_hashes : chaque personne peut avoir PLUSIEURS hachages (variantes de
-- formatage du même numéro : +223 70..., 22370..., 070..., 70...) sans qu'on
-- ait besoin de deviner un indicatif pays. Ça augmente nettement le taux de
-- correspondance avec un vrai répertoire de téléphone, pour un coût quasi nul
-- (quelques lignes de plus par utilisateur, PK sur le hash = recherche O(1)).

-- Nettoyage si vous aviez déjà exécuté l'ancienne version (v1) de ce fichier :
drop index if exists public.profiles_phone_hash_idx;
drop index if exists public.profiles_email_hash_idx;
alter table public.profiles drop column if exists phone_hash;
alter table public.profiles drop column if exists email_hash;

-- Le numéro en clair n'est gardé QUE pour l'affichage à son propriétaire dans
-- ses propres réglages — jamais exposé aux autres.
alter table public.profiles add column if not exists phone text;

create table if not exists public.contact_hashes (
  hash text primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('phone', 'email')),
  created_at timestamptz not null default now()
);

create index if not exists contact_hashes_profile_idx on public.contact_hashes (profile_id);

alter table public.contact_hashes enable row level security;

drop policy if exists "contact_hashes_manage_own" on public.contact_hashes;
create policy "contact_hashes_manage_own"
  on public.contact_hashes for all
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

drop policy if exists "profiles_update_own_contact_fields" on public.profiles;
create policy "profiles_update_own_contact_fields"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Fonction serveur : reçoit une liste de hachages (déjà calculés côté client,
-- variantes comprises) et renvoie les profils publics qui correspondent, avec
-- le hachage qui a matché (matched_hash) — ça permet au client de relier le
-- résultat au contact précis de son répertoire, pour ensuite proposer
-- d'inviter ceux qui n'ont pas matché. Jamais de numéro/e-mail en clair ni de
-- hachage de tiers renvoyé au-delà de ce qui matche la requête.
create or replace function public.find_users_by_contact_hashes(hashes text[])
returns table (
  id uuid,
  display_name text,
  handle text,
  avatar_url text,
  flag text,
  matched_via text,
  matched_hash text
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.handle, p.avatar_url, p.flag,
         ch.kind as matched_via, ch.hash as matched_hash
  from public.contact_hashes ch
  join public.profiles p on p.id = ch.profile_id
  where ch.hash = any(hashes)
    and p.id <> auth.uid();
$$;

grant execute on function public.find_users_by_contact_hashes(text[]) to authenticated, anon;

-- Si votre table `follows` n'a pas déjà de contrainte unique (follower_id, followed_id),
-- décommentez la ligne suivante — elle évite les doublons de demandes d'ami/abonnement :
-- alter table public.follows add constraint follows_unique_pair unique (follower_id, followed_id);
