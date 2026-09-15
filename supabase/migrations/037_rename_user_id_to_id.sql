-- BAARO: supprimer le problème user_id — identité unique = id
-- profiles.id / wallets.id / crypto_holdings.id = auth.users.id
-- Ne renomme PAS les colonnes FK des tables de relation (post_likes.user_id, etc.)

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='id'
  ) THEN
    ALTER TABLE public.profiles RENAME COLUMN user_id TO id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='wallets' AND column_name='user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='wallets' AND column_name='id'
  ) THEN
    ALTER TABLE public.wallets RENAME COLUMN user_id TO id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crypto_holdings' AND column_name='user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crypto_holdings' AND column_name='id'
  ) THEN
    ALTER TABLE public.crypto_holdings RENAME COLUMN user_id TO id;
  END IF;
END $$;

-- Policies
DO $$
BEGIN
  DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
  CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
  DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
  CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

  DROP POLICY IF EXISTS "wallet_own" ON public.wallets;
  CREATE POLICY "wallet_own" ON public.wallets FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

  DROP POLICY IF EXISTS "crypto_own" ON public.crypto_holdings;
  CREATE POLICY "crypto_own" ON public.crypto_holdings FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

COMMENT ON TABLE public.profiles IS 'BAARO: id = auth.users.id (identité unique, plus de user_id)';
COMMENT ON TABLE public.wallets IS 'BAARO: id = auth.users.id';
COMMENT ON TABLE public.crypto_holdings IS 'BAARO: id = auth.users.id';

-- =====================================================================
-- IMPORTANT : les fonctions PL/pgSQL ne sont PAS mises à jour automatiquement
-- par un RENAME COLUMN. On corrige les références wallets.user_id / 
-- profiles.user_id / crypto_holdings.user_id dans les corps de fonctions.
-- =====================================================================
DO $$
DECLARE
  r RECORD;
  def text;
  new_def text;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, n.nspname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND pg_get_functiondef(p.oid) ~* '(wallets|profiles|crypto_holdings).*user_id|from public\.(wallets|profiles|crypto_holdings) where user_id'
  LOOP
    def := pg_get_functiondef(r.oid);
    new_def := def;
    -- Remplacements ciblés pour les tables d'identité uniquement
    new_def := regexp_replace(new_def, 'from public\.wallets where user_id', 'from public.wallets where id', 'gi');
    new_def := regexp_replace(new_def, 'from public\.profiles where user_id', 'from public.profiles where id', 'gi');
    new_def := regexp_replace(new_def, 'from public\.crypto_holdings where user_id', 'from public.crypto_holdings where id', 'gi');
    new_def := regexp_replace(new_def, 'update public\.wallets set ([^;]+) where user_id', 'update public.wallets set \1 where id', 'gi');
    new_def := regexp_replace(new_def, 'update public\.profiles set ([^;]+) where user_id', 'update public.profiles set \1 where id', 'gi');
    new_def := regexp_replace(new_def, 'update public\.crypto_holdings set ([^;]+) where user_id', 'update public.crypto_holdings set \1 where id', 'gi');
    new_def := regexp_replace(new_def, 'join public\.profiles p on p\.user_id', 'join public.profiles p on p.id', 'gi');
    new_def := regexp_replace(new_def, 'left join public\.profiles p on p\.user_id', 'left join public.profiles p on p.id', 'gi');
    new_def := regexp_replace(new_def, 'profiles\.user_id', 'profiles.id', 'gi');
    new_def := regexp_replace(new_def, 'wallets\.user_id', 'wallets.id', 'gi');
    new_def := regexp_replace(new_def, 'crypto_holdings\.user_id', 'crypto_holdings.id', 'gi');

    IF new_def IS DISTINCT FROM def THEN
      BEGIN
        EXECUTE new_def;
        RAISE NOTICE 'Fonction corrigée: %.%', r.nspname, r.proname;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Impossible de corriger %.%: %', r.nspname, r.proname, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;
