-- BAARO 042: Correction complète du système social (abonnements + amis + notifications)

-- 1. Corriger les colonnes de la table follows (si nécessaire)
DO $$
BEGIN
  -- Renommer 'following_id' en 'followed_id' si la dérive existe
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'follows' AND column_name = 'following_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'follows' AND column_name = 'followed_id'
  ) THEN
    ALTER TABLE public.follows RENAME COLUMN following_id TO followed_id;
  END IF;

  -- Ajouter les colonnes manquantes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'follows' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.follows ADD COLUMN status text DEFAULT 'accepted';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'follows' AND column_name = 'is_friend'
  ) THEN
    ALTER TABLE public.follows ADD COLUMN is_friend boolean DEFAULT false;
  END IF;

  -- Normaliser les données existantes
  UPDATE public.follows SET status = 'accepted' WHERE status IS NULL;
  UPDATE public.follows SET is_friend = false WHERE is_friend IS NULL;
END $$;

-- 2. Créer la fonction get_user_friends (manquante dans votre base)
CREATE OR REPLACE FUNCTION public.get_user_friends(id_param UUID)
RETURNS TABLE(friend_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    CASE 
      WHEN f.follower_id = id_param THEN f.followed_id
      ELSE f.follower_id
    END AS friend_id
  FROM public.follows f
  WHERE (f.follower_id = id_param OR f.followed_id = id_param)
    AND f.status = 'accepted'
    AND f.is_friend = true;
END;
$$;

-- 3. Mettre à jour toggle_follow
CREATE OR REPLACE FUNCTION public.toggle_follow(p_target UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_following BOOLEAN;
BEGIN
  IF p_target = auth.uid() THEN
    RAISE EXCEPTION 'CANNOT_FOLLOW_SELF';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_target) THEN
    RAISE EXCEPTION 'TARGET_NOT_FOUND';
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM public.follows 
    WHERE follower_id = auth.uid() AND followed_id = p_target AND status = 'accepted'
  ) INTO v_is_following;
  
  IF v_is_following THEN
    DELETE FROM public.follows 
    WHERE follower_id = auth.uid() AND followed_id = p_target;
    RETURN FALSE;
  ELSE
    INSERT INTO public.follows (follower_id, followed_id, status, is_friend)
    VALUES (auth.uid(), p_target, 'accepted', false)
    ON CONFLICT (follower_id, followed_id) DO UPDATE 
    SET status = 'accepted', is_friend = false;
    RETURN TRUE;
  END IF;
END;
$$;

-- 4. Créer la table notifications si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  message TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_read" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;

CREATE POLICY "notifications_read" ON public.notifications 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notifications_insert" ON public.notifications 
  FOR INSERT WITH CHECK (auth.uid() = actor_id);

-- 5. Créer un trigger pour générer automatiquement les notifications de follow
CREATE OR REPLACE FUNCTION public.create_follow_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, actor_id, type, message)
    VALUES (NEW.followed_id, NEW.follower_id, 'follow', 'a commencé à vous suivre')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_follow_created ON public.follows;
CREATE TRIGGER on_follow_created
AFTER INSERT ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.create_follow_notification();

-- 6. Index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_follows_followed ON public.follows (followed_id, status);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows (follower_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications (user_id, created_at DESC);

-- 7. Permissions
REVOKE ALL ON FUNCTION public.get_user_friends(UUID) FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.get_user_friends(UUID) TO AUTHENTICATED;
