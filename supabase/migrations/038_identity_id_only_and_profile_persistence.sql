-- BAARO 038: identité unique = id uniquement + persistance des profils
-- - profiles / wallets / crypto_holdings : clé primaire = id (UUID auth.users.id)
-- - Plus de colonne user_id sur ces tables d'identité
-- - FKs qui référençaient profiles(user_id) pointent vers profiles(id)
-- - RLS et trigger de création automatique de profil à l'inscription

-- 1) Renommer user_id → id sur les tables d'identité si nécessaire
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'id'
  ) THEN
    ALTER TABLE public.profiles RENAME COLUMN user_id TO id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wallets' AND column_name = 'user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wallets' AND column_name = 'id'
  ) THEN
    ALTER TABLE public.wallets RENAME COLUMN user_id TO id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crypto_holdings' AND column_name = 'user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crypto_holdings' AND column_name = 'id'
  ) THEN
    ALTER TABLE public.crypto_holdings RENAME COLUMN user_id TO id;
  END IF;
END $$;

-- 2) S'assurer que id est PK et référence auth.users
DO $$
BEGIN
  -- profiles
  IF to_regclass('public.profiles') IS NOT NULL THEN
    BEGIN
      ALTER TABLE public.profiles
        ALTER COLUMN id SET NOT NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_pkey;
      ALTER TABLE public.profiles ADD PRIMARY KEY (id);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      ALTER TABLE public.profiles
        DROP CONSTRAINT IF EXISTS profiles_id_fkey;
      ALTER TABLE public.profiles
        ADD CONSTRAINT profiles_id_fkey
        FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- wallets
  IF to_regclass('public.wallets') IS NOT NULL THEN
    BEGIN
      ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_pkey;
      ALTER TABLE public.wallets ADD PRIMARY KEY (id);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
      ALTER TABLE public.wallets
        DROP CONSTRAINT IF EXISTS wallets_id_fkey;
      ALTER TABLE public.wallets
        ADD CONSTRAINT wallets_id_fkey
        FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END $$;

-- 3) Corriger les FKs qui pointaient encore vers profiles(user_id)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname, rel.relname AS table_name
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND con.contype = 'f'
      AND pg_get_constraintdef(con.oid) ILIKE '%profiles%user_id%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', r.table_name, r.conname);
  END LOOP;
END $$;

-- Recréer les FKs principales vers profiles(id)
DO $$
BEGIN
  IF to_regclass('public.shops') IS NOT NULL THEN
    BEGIN
      ALTER TABLE public.shops
        DROP CONSTRAINT IF EXISTS shops_owner_id_fkey;
      ALTER TABLE public.shops
        ADD CONSTRAINT shops_owner_id_fkey
        FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  IF to_regclass('public.orders') IS NOT NULL THEN
    BEGIN
      ALTER TABLE public.orders
        DROP CONSTRAINT IF EXISTS orders_buyer_id_fkey;
      ALTER TABLE public.orders
        ADD CONSTRAINT orders_buyer_id_fkey
        FOREIGN KEY (buyer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  IF to_regclass('public.companies') IS NOT NULL THEN
    BEGIN
      ALTER TABLE public.companies
        DROP CONSTRAINT IF EXISTS companies_owner_id_fkey;
      ALTER TABLE public.companies
        ADD CONSTRAINT companies_owner_id_fkey
        FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  IF to_regclass('public.company_reviews') IS NOT NULL THEN
    BEGIN
      ALTER TABLE public.company_reviews
        DROP CONSTRAINT IF EXISTS company_reviews_user_id_fkey;
      ALTER TABLE public.company_reviews
        ADD CONSTRAINT company_reviews_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END $$;

-- 4) RLS : identité = id
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_read" ON public.profiles;
CREATE POLICY "profiles_read" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;
CREATE POLICY "profiles_delete" ON public.profiles
  FOR DELETE USING (auth.uid() = id);

-- wallets
DO $$
BEGIN
  IF to_regclass('public.wallets') IS NOT NULL THEN
    ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "wallet_own" ON public.wallets;
    CREATE POLICY "wallet_own" ON public.wallets
      FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- crypto_holdings
DO $$
BEGIN
  IF to_regclass('public.crypto_holdings') IS NOT NULL THEN
    ALTER TABLE public.crypto_holdings ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "crypto_own" ON public.crypto_holdings;
    CREATE POLICY "crypto_own" ON public.crypto_holdings
      FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- 5) Trigger : créer le profil automatiquement à l'inscription (persistance)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, handle, flag, bio, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'Membre BAARO'),
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'handle', ''),
      '@user_' || left(NEW.id::text, 8)
    ),
    COALESCE(NEW.raw_user_meta_data->>'flag', '🌍'),
    '',
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  -- Wallet de base
  BEGIN
    INSERT INTO public.wallets (id, balance, updated_at)
    VALUES (NEW.id, 0, now())
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    BEGIN
      INSERT INTO public.wallets (id, updated_at)
      VALUES (NEW.id, now())
      ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();

-- 6) Colonne updated_at si absente
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

COMMENT ON COLUMN public.profiles.id IS 'Identifiant utilisateur unique = auth.users.id (UUID). Plus de user_id.';

-- Colonne clé publique E2E (messagerie)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS public_key jsonb;

-- Colonne language (utilisée par l'API chat)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language text;

-- Colonnes métier utilisées par les API
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS restricted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS referral_code text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_referral_code
  ON public.profiles (referral_code)
  WHERE referral_code IS NOT NULL;
