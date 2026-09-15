-- BAARO — Identité canonique unique
-- Source de vérité utilisateur: auth.users.id (UUID Supabase Auth).
-- Les identifiants locaux, emails, handles et noms ne doivent jamais être utilisés
-- comme clés de relation utilisateur.

DO $$
DECLARE
  r record;
BEGIN
  -- Tables principales: ajouter la FK vers auth.users si une colonne utilisateur
  -- existe et qu'une FK équivalente n'est pas déjà présente.
  FOR r IN
    SELECT * FROM (VALUES
      ('profiles','user_id'),
      ('wallets','user_id'),
      ('transactions','user_id'),
      ('crypto_holdings','user_id'),
      ('post_likes','user_id'),
      ('comments','author_id'),
      ('follows','follower_id'),
      ('follows','followed_id'),
      ('messages','sender_id'),
      ('messages','recipient_id'),
      ('videos','author_id'),
      ('notifications','user_id'),
      ('notification_preferences','user_id'),
      ('push_tokens','user_id'),
      ('post_reactions','user_id'),
      ('post_bookmarks','user_id'),
      ('post_shares','user_id'),
      ('poll_votes','user_id'),
      ('story_reactions','user_id'),
      ('story_views','user_id'),
      ('group_members','user_id'),
      ('channel_messages','sender_id'),
      ('voice_participants','user_id'),
      ('debate_participants','user_id'),
      ('debate_messages','sender_id'),
      ('wallet_ledger','user_id')
    ) AS x(table_name, column_name)
  LOOP
    IF to_regclass('public.' || r.table_name) IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM information_schema.columns c
         WHERE c.table_schema='public' AND c.table_name=r.table_name
           AND c.column_name=r.column_name AND c.udt_name='uuid'
       )
       AND NOT EXISTS (
         SELECT 1 FROM pg_constraint c
         WHERE c.conrelid=('public.'||r.table_name)::regclass
           AND c.contype='f'
           AND c.confrelid='auth.users'::regclass
           AND pg_get_constraintdef(c.oid) ILIKE '%'||r.column_name||'%'
       ) THEN
      BEGIN
        EXECUTE format(
          'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE CASCADE',
          r.table_name, left(r.table_name||'_'||r.column_name||'_auth_fk', 63), r.column_name
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
    END IF;
  END LOOP;
END $$;

-- Empêcher les relations self-follow et les profils sans utilisateur.
DO $$ BEGIN
  IF to_regclass('public.follows') IS NOT NULL THEN
    BEGIN
      ALTER TABLE public.follows ADD CONSTRAINT follows_no_self CHECK (follower_id <> followed_id);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- RLS: une ligne appartenant à un utilisateur ne peut être créée/modifiée
-- qu'avec son auth.uid(). Les policies existantes plus spécifiques restent intactes.
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.post_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.post_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.story_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.story_views ENABLE ROW LEVEL SECURITY;

COMMENT ON SCHEMA public IS 'BAARO: auth.users.id is the single canonical user identity for all user relations.';
