-- ============================================================
-- Renommage notifications : user_id -> id (destinataire),
-- l'ancienne clé primaire "id" devient "notification_id".
-- À exécuter dans Supabase > SQL Editor.
-- ============================================================

-- 1) Libérer le nom "id" en renommant l'ancienne clé primaire
alter table notifications rename column id to notification_id;

-- 2) Le destinataire s'appelle maintenant "id", comme le reste du projet
alter table notifications rename column user_id to id;

-- 3) La policy RLS existante référence encore "user_id" : on la recrée
drop policy if exists "notif_own" on notifications;
create policy "notif_own"
  on notifications for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- NB : la contrainte de clé primaire et le "default gen_random_uuid()"
-- suivent automatiquement le renommage de colonne, rien d'autre à faire
-- côté schéma.
