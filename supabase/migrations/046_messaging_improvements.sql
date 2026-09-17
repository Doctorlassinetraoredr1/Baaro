-- ============================================================
-- BAARO — Amélioration messagerie (sans régression)
-- À exécuter dans Supabase > SQL Editor, après les scripts existants
-- ============================================================

-- 1) Statut en ligne / "vu"
alter table profiles
  add column if not exists last_seen_at timestamptz;

alter table messages
  add column if not exists read_at timestamptz;

-- 2) Modification / suppression de message (soft delete)
alter table messages
  add column if not exists edited_at timestamptz;

alter table messages
  add column if not exists deleted_at timestamptz;

-- RLS : autoriser l'expéditeur à modifier/supprimer (soft) son propre message
drop policy if exists "messages_update_own" on messages;
create policy "messages_update_own"
  on messages for update
  using (auth.uid() = sender_id)
  with check (auth.uid() = sender_id);

-- RLS : autoriser un utilisateur à mettre à jour read_at sur les messages
-- qu'il reçoit (pour marquer "vu")
drop policy if exists "messages_mark_read" on messages;
create policy "messages_mark_read"
  on messages for update
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- RLS : autoriser chaque utilisateur à mettre à jour son propre last_seen_at
drop policy if exists "profiles_update_last_seen" on profiles;
create policy "profiles_update_last_seen"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 3) Réactions sur les messages
create table if not exists message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

alter table message_reactions enable row level security;

drop policy if exists "reactions_select_participants" on message_reactions;
create policy "reactions_select_participants"
  on message_reactions for select
  using (
    exists (
      select 1 from conversations c
      where c.id = message_reactions.conversation_id
        and (c.user1_id = auth.uid() or c.user2_id = auth.uid())
    )
  );

drop policy if exists "reactions_insert_own" on message_reactions;
create policy "reactions_insert_own"
  on message_reactions for insert
  with check (auth.uid() = user_id);

drop policy if exists "reactions_delete_own" on message_reactions;
create policy "reactions_delete_own"
  on message_reactions for delete
  using (auth.uid() = user_id);

-- 4) Activer le Realtime sur les nouvelles tables / colonnes suivies
-- (Database > Replication dans Supabase, ou via SQL si la publication existe déjà) :
alter publication supabase_realtime add table message_reactions;
alter publication supabase_realtime add table profiles;

-- NB: la table "messages" est déjà en Realtime (utilisée pour les INSERT) ;
-- ce script ne fait qu'ajouter les UPDATE nécessaires aux accusés de
-- lecture, à l'édition et à la suppression, qui passent par le même canal.
