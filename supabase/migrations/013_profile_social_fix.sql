-- 1. Adaptation dynamique de la table 'follows' existante
DO $$ 
BEGIN
    -- Si la table n'existe pas, on la crée
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'follows') THEN
        CREATE TABLE public.follows (
            follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
            following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
            PRIMARY KEY (follower_id, following_id)
        );
    ELSE
        -- Renommer 'followed_id' en 'following_id' si la colonne s'appelait ainsi
        IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'follows' AND column_name = 'followed_id') THEN
            ALTER TABLE public.follows RENAME COLUMN followed_id TO following_id;
        -- Renommer 'target_id' en 'following_id' si la colonne s'appelait ainsi
        ELSIF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'follows' AND column_name = 'target_id') THEN
            ALTER TABLE public.follows RENAME COLUMN target_id TO following_id;
        -- Si 'following_id' n'existe toujours pas, on l'ajoute
        ELSIF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'follows' AND column_name = 'following_id') THEN
            ALTER TABLE public.follows ADD COLUMN following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- 2. Indexation pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);

-- 3. Activation et réinitialisation des politiques RLS
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture publique des abonnements" ON public.follows;
DROP POLICY IF EXISTS "Création par l'utilisateur connecté" ON public.follows;
DROP POLICY IF EXISTS "Suppression par l'utilisateur connecté" ON public.follows;

CREATE POLICY "Lecture publique des abonnements" ON public.follows
    FOR SELECT USING (true);

CREATE POLICY "Création par l'utilisateur connecté" ON public.follows
    FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Suppression par l'utilisateur connecté" ON public.follows
    FOR DELETE USING (auth.uid() = follower_id);

-- 4. Fonction RPC pour récupérer les amis réciproques[span_3](start_span)[span_3](end_span)
CREATE OR REPLACE FUNCTION public.get_user_friends(user_id_param UUID)
RETURNS TABLE (friend_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT f1.following_id AS friend_id
  FROM public.follows f1
  INNER JOIN public.follows f2 
    ON f1.following_id = f2.follower_id 
   AND f1.follower_id = f2.following_id
  WHERE f1.follower_id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
