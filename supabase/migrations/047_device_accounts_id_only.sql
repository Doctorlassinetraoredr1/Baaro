-- BAARO 047: device_accounts — identité = id (auth.users.id), plus de user_id
-- Clés étrangères métier (author_id, sender_id, etc.) non concernées.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'device_accounts'
      AND column_name = 'user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'device_accounts'
      AND column_name = 'id'
  ) THEN
    ALTER TABLE public.device_accounts RENAME COLUMN user_id TO id;
  END IF;
END $$;

-- PK (device_id, id)
DO $$
BEGIN
  IF to_regclass('public.device_accounts') IS NOT NULL THEN
    ALTER TABLE public.device_accounts DROP CONSTRAINT IF EXISTS device_accounts_pkey;
    ALTER TABLE public.device_accounts
      ALTER COLUMN id SET NOT NULL,
      ALTER COLUMN device_id SET NOT NULL;
    BEGIN
      ALTER TABLE public.device_accounts
        ADD PRIMARY KEY (device_id, id);
    EXCEPTION WHEN OTHERS THEN
      -- déjà en place
      NULL;
    END;

    ALTER TABLE public.device_accounts DROP CONSTRAINT IF EXISTS device_accounts_id_fkey;
    ALTER TABLE public.device_accounts
      ADD CONSTRAINT device_accounts_id_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

    COMMENT ON COLUMN public.device_accounts.id IS
      'Identifiant utilisateur = auth.users.id (plus de user_id)';
  END IF;
END $$;
