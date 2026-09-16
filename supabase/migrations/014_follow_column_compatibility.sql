-- BAARO 014 : Correction des colonnes user_id → id + Sécurité complète

-- ============================================
-- 1. RENOMMER user_id EN id (si nécessaire)
-- ============================================

DO $$
BEGIN
  -- poll_votes
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='poll_votes' AND column_name='user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='poll_votes' AND column_name='id'
  ) THEN
    ALTER TABLE public.poll_votes RENAME COLUMN user_id TO id;
  END IF;

  -- post_reactions
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='post_reactions' AND column_name='user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='post_reactions' AND column_name='id'
  ) THEN
    ALTER TABLE public.post_reactions RENAME COLUMN user_id TO id;
  END IF;

  -- post_bookmarks
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='post_bookmarks' AND column_name='user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='post_bookmarks' AND column_name='id'
  ) THEN
    ALTER TABLE public.post_bookmarks RENAME COLUMN user_id TO id;
  END IF;

  -- post_shares
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='post_shares' AND column_name='user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='post_shares' AND column_name='id'
  ) THEN
    ALTER TABLE public.post_shares RENAME COLUMN user_id TO id;
  END IF;
END $$;

-- ============================================
-- 2. CRÉATION DES TABLES (si elles n'existent pas)
-- ============================================

CREATE TABLE IF NOT EXISTS public.polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  position INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.poll_votes (
  poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE,
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  option_id UUID REFERENCES public.poll_options(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (poll_id, id)
);

CREATE TABLE IF NOT EXISTS public.post_reactions (
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL CHECK (reaction IN ('love', 'laugh', 'wow', 'sad', 'angry', 'support')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (post_id, id)
);

CREATE TABLE IF NOT EXISTS public.post_shares (
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (post_id, id)
);

CREATE TABLE IF NOT EXISTS public.post_bookmarks (
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (post_id, id)
);

-- ============================================
-- 3. VUE POUR RÉSULTATS DE SONDAGES
-- ============================================
CREATE OR REPLACE VIEW public.poll_results AS
SELECT 
  po.poll_id,
  po.id AS option_id,
  po.option_text,
  po.position,
  COUNT(pv.id)::INT AS vote_count
FROM public.poll_options po
LEFT JOIN public.poll_votes pv ON po.id = pv.option_id
GROUP BY po.poll_id, po.id, po.option_text, po.position;

-- ============================================
-- 4. INDEX POUR PERFORMANCES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_id ON public.poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_post_id ON public.post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_post_bookmarks_post_id ON public.post_bookmarks(post_id);
CREATE INDEX IF NOT EXISTS idx_post_shares_post_id ON public.post_shares(post_id);

-- ============================================
-- 5. ACTIVATION RLS
-- ============================================
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_shares ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. POLITIQUES DE SÉCURITÉ
-- ============================================

-- Polls
DROP POLICY IF EXISTS "polls_read_public" ON public.polls;
CREATE POLICY "polls_read_public" ON public.polls
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "polls_insert_author" ON public.polls;
CREATE POLICY "polls_insert_author" ON public.polls
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.posts p 
      WHERE p.id = polls.post_id AND p.author_id = auth.uid()
    )
  );

-- Poll options
DROP POLICY IF EXISTS "poll_options_read_public" ON public.poll_options;
CREATE POLICY "poll_options_read_public" ON public.poll_options
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "poll_options_insert_author" ON public.poll_options;
CREATE POLICY "poll_options_insert_author" ON public.poll_options
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.polls p
      JOIN public.posts po ON po.id = p.post_id
      WHERE p.id = poll_options.poll_id AND po.author_id = auth.uid()
    )
  );

-- Poll votes
DROP POLICY IF EXISTS "poll_votes_read_public" ON public.poll_votes;
CREATE POLICY "poll_votes_read_public" ON public.poll_votes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "poll_votes_own" ON public.poll_votes;
CREATE POLICY "poll_votes_own" ON public.poll_votes
  FOR ALL 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Post reactions
DROP POLICY IF EXISTS "post_reactions_read_public" ON public.post_reactions;
CREATE POLICY "post_reactions_read_public" ON public.post_reactions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "post_reactions_own" ON public.post_reactions;
CREATE POLICY "post_reactions_own" ON public.post_reactions
  FOR ALL 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Post bookmarks (PRIVÉ)
DROP POLICY IF EXISTS "post_bookmarks_own" ON public.post_bookmarks;
CREATE POLICY "post_bookmarks_own" ON public.post_bookmarks
  FOR ALL 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Post shares
DROP POLICY IF EXISTS "post_shares_read_public" ON public.post_shares;
CREATE POLICY "post_shares_read_public" ON public.post_shares
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "post_shares_own" ON public.post_shares;
CREATE POLICY "post_shares_own" ON public.post_shares
  FOR ALL 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================
-- 7. FONCTION toggle_follow
-- ============================================
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
    WHERE follower_id = auth.uid() AND followed_id = p_target
  ) INTO v_is_following;
  
  IF v_is_following THEN
    DELETE FROM public.follows 
    WHERE follower_id = auth.uid() AND followed_id = p_target;
    RETURN FALSE;
  ELSE
    INSERT INTO public.follows (follower_id, followed_id)
    VALUES (auth.uid(), p_target);
    RETURN TRUE;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_follow(UUID) FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.toggle_follow(UUID) TO AUTHENTICATED;

-- ============================================
-- 8. FONCTION vote_poll (sécurisée)
-- ============================================
CREATE OR REPLACE FUNCTION public.vote_poll(p_poll_id UUID, p_option_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.poll_votes 
    WHERE poll_id = p_poll_id AND id = auth.uid() 
    AND created_at > NOW() - INTERVAL '2 seconds'
  ) THEN
    RAISE EXCEPTION 'SOCIAL_RATE_LIMIT';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM public.poll_options 
    WHERE id = p_option_id AND poll_id = p_poll_id
  ) THEN
    RAISE EXCEPTION 'INVALID_POLL_OPTION';
  END IF;
  
  IF EXISTS (SELECT 1 FROM public.poll_votes WHERE poll_id = p_poll_id AND id = auth.uid()) THEN
    UPDATE public.poll_votes 
    SET option_id = p_option_id, created_at = NOW()
    WHERE poll_id = p_poll_id AND id = auth.uid();
  ELSE
    INSERT INTO public.poll_votes (poll_id, id, option_id)
    VALUES (p_poll_id, auth.uid(), p_option_id);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.vote_poll(UUID, UUID) FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.vote_poll(UUID, UUID) TO AUTHENTICATED;

-- ============================================
-- 9. FONCTION get_social_suggestions
-- ============================================
CREATE OR REPLACE FUNCTION public.get_social_suggestions(p_limit INT DEFAULT 6)
RETURNS TABLE (id UUID, handle TEXT, full_name TEXT, avatar_url TEXT, mutual_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id, p.handle, p.full_name, p.avatar_url,
    (SELECT COUNT(*) FROM public.follows f2 
     WHERE f2.followed_id = p.id 
     AND f2.follower_id IN (SELECT followed_id FROM public.follows WHERE follower_id = auth.uid())
    )::INT AS mutual_count
  FROM public.profiles p
  WHERE p.id != auth.uid()
    AND p.id NOT IN (SELECT followed_id FROM public.follows WHERE follower_id = auth.uid())
  ORDER BY mutual_count DESC, RANDOM()
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_social_suggestions(INT) FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.get_social_suggestions(INT) TO AUTHENTICATED;

-- ============================================
-- 10. ACTIVATION REALTIME
-- ============================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.post_reactions;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.post_bookmarks;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.post_shares;
EXCEPTION WHEN duplicate_object THEN 
  NULL;
END $$;

ALTER TABLE public.poll_votes REPLICA IDENTITY FULL;
ALTER TABLE public.post_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.post_bookmarks REPLICA IDENTITY FULL;
ALTER TABLE public.post_shares REPLICA IDENTITY FULL;
