-- BAARO 041: identité canonique unique + identifiant public unique
--
-- Règle définitive :
--   auth.users.id = profiles.id = wallets.id = crypto_holdings.id
--   => un seul UUID canonique pour l'identité d'un compte.
--
-- Les colonnes user_id des tables relationnelles restent des FK vers profiles.id.
-- Elles ne sont PAS des identifiants concurrents : elles désignent l'utilisateur
-- associé à une ligne de relation (like, vote, membre, notification, etc.).

DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    -- L'identité technique BAARO est exactement auth.users.id.
    ALTER TABLE public.profiles
      ALTER COLUMN id SET NOT NULL;

    ALTER TABLE public.profiles
      DROP CONSTRAINT IF EXISTS profiles_id_fkey;
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

    -- Chaque compte doit avoir un identifiant public unique.
    -- Les anciens profils sans handle reçoivent un identifiant déterministe.
    UPDATE public.profiles
       SET handle = '@user_' || replace(left(id::text, 12), '-', '')
     WHERE handle IS NULL OR length(trim(handle)) = 0;

    -- Normalisation minimale des handles existants.
    UPDATE public.profiles
       SET handle = lower(trim(handle))
     WHERE handle IS NOT NULL
       AND handle <> lower(trim(handle));

    -- Un seul handle, insensible à la casse.
    DROP INDEX IF EXISTS public.profiles_handle_unique;
    CREATE UNIQUE INDEX profiles_handle_unique
      ON public.profiles (lower(handle));

    ALTER TABLE public.profiles
      ALTER COLUMN handle SET NOT NULL;
  END IF;

  IF to_regclass('public.wallets') IS NOT NULL THEN
    ALTER TABLE public.wallets ALTER COLUMN id SET NOT NULL;
    ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_id_fkey;
    ALTER TABLE public.wallets
      ADD CONSTRAINT wallets_id_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.crypto_holdings') IS NOT NULL THEN
    ALTER TABLE public.crypto_holdings ALTER COLUMN id SET NOT NULL;
    ALTER TABLE public.crypto_holdings DROP CONSTRAINT IF EXISTS crypto_holdings_id_fkey;
    ALTER TABLE public.crypto_holdings
      ADD CONSTRAINT crypto_holdings_id_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Vérification finale : aucune table d'identité ne doit avoir user_id.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','wallets','crypto_holdings'] LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = t
        AND column_name = 'user_id'
    ) THEN
      RAISE EXCEPTION 'BAARO: %.user_id interdit — utiliser %.id', t, t;
    END IF;
  END LOOP;
END $$;

COMMENT ON COLUMN public.profiles.id IS
  'Identifiant technique canonique unique BAARO = auth.users.id';
COMMENT ON COLUMN public.profiles.handle IS
  'Identifiant public unique BAARO, insensible à la casse';

-- Recréer le trigger d'inscription avec profiles.id (et non profiles.user_id).

-- Recréer le trigger d'inscription avec profiles.id et un fallback handle garanti unique.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_name text;
  base_handle text;
  fallback_handle text;
BEGIN
  base_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    nullif(new.phone, ''),
    'Membre BAARO'
  );

  base_handle := lower(trim(coalesce(
    nullif(new.raw_user_meta_data ->> 'handle', ''),
    '@user_' || substr(replace(new.id::text, '-', ''), 1, 8)
  )));
  IF left(base_handle, 1) <> '@' THEN
    base_handle := '@' || base_handle;
  END IF;
  base_handle := left(base_handle, 40);
  fallback_handle := '@user_' || substr(replace(new.id::text, '-', ''), 1, 12);

  BEGIN
    INSERT INTO public.profiles (id, display_name, handle, flag)
    VALUES (new.id, left(base_name, 80), base_handle, '🌍')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN unique_violation THEN
    INSERT INTO public.profiles (id, display_name, handle, flag)
    VALUES (new.id, left(base_name, 80), fallback_handle, '🌍')
    ON CONFLICT (id) DO NOTHING;
  END;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Réparer les comptes créés avant l'activation du trigger canonique.
INSERT INTO public.profiles (id, display_name, handle, flag)
SELECT
  u.id,
  left(coalesce(
    nullif(u.raw_user_meta_data ->> 'display_name', ''),
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    nullif(u.raw_user_meta_data ->> 'name', ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    nullif(u.phone, ''),
    'Membre BAARO'
  ), 80),
  left('@user_' || substr(replace(u.id::text, '-', ''), 1, 12), 40),
  '🌍'
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;
