-- BAARO 045: Correction régression amis + respect identifiant unique 'id'

-- 1. Annuler le renommage fautif (following_id -> followed_id) pour rester cohérent 
-- avec 008, 014 et le frontend (FriendRequests.jsx, useSocial.js)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'follows' AND column_name = 'following_id'
  ) THEN
    ALTER TABLE public.follows RENAME COLUMN following_id TO followed_id;
  END IF;
END $$;

-- 2. Recréer la fonction RPC get_user_friends avec le paramètre 'id_param' (pas de user_id)
-- et ajout des vérifications de statut pour ne retourner que les vraies amitiés réciproques
CREATE OR REPLACE FUNCTION public.get_user_friends(id_param UUID)
RETURNS TABLE (friend_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT f1.followed_id AS friend_id
  FROM public.follows f1
  INNER JOIN public.follows f2
    ON f1.followed_id = f2.follower_id
    AND f1.follower_id = f2.followed_id
  WHERE f1.follower_id = id_param
    AND f1.status = 'accepted'
    AND f1.is_friend = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Optimisation de l'index pour les requêtes d'amis réciproques
CREATE INDEX IF NOT EXISTS idx_follows_follower_followed ON public.follows(follower_id, followed_id);
