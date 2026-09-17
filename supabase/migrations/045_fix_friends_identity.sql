-- BAARO 045: Correction fonction get_user_friends
-- Exécuter dans Supabase > SQL Editor

-- 1. S'assurer que la colonne s'appelle followed_id (pas following_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'follows' 
    AND column_name = 'following_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'follows' 
    AND column_name = 'followed_id'
  ) THEN
    ALTER TABLE public.follows RENAME COLUMN following_id TO followed_id;
  END IF;
  
  ALTER TABLE public.follows 
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'accepted',
  ADD COLUMN IF NOT EXISTS is_friend BOOLEAN DEFAULT false;
END $$;

-- 2. Supprimer les anciennes fonctions
DROP FUNCTION IF EXISTS public.get_user_friends(UUID);
DROP FUNCTION IF EXISTS public.get_user_friends(user_id_param UUID);

-- 3. Créer la fonction avec le bon paramètre (id, pas user_id)
CREATE OR REPLACE FUNCTION public.get_user_friends(user_id UUID)
RETURNS TABLE (friend_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT f1.followed_id
  FROM public.follows f1
  INNER JOIN public.follows f2 
    ON f1.followed_id = f2.follower_id 
    AND f1.follower_id = f2.followed_id
  WHERE f1.follower_id = user_id
    AND (f1.status = 'accepted' OR f1.status IS NULL)
    AND (f1.is_friend = true OR f1.is_friend IS NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Index de performance
CREATE INDEX IF NOT EXISTS idx_follows_reciprocal 
ON public.follows(follower_id, followed_id) 
WHERE status = 'accepted' OR status IS NULL;
