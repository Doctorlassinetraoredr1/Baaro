-- BAARO 042 : Notifications temps réel + Triggers automatiques

-- ============================================
-- 1. CORRIGER user_id → id sur notifications
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='notifications' AND column_name='user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='notifications' AND column_name='id'
  ) THEN
    ALTER TABLE public.notifications RENAME COLUMN user_id TO id;
  END IF;
END $$;

-- Ajouter les colonnes manquantes pour le typage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='notifications' AND column_name='type'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN type TEXT DEFAULT 'general';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='notifications' AND column_name='source_id'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN source_id UUID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='notifications' AND column_name='actor_id'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================
-- 2. RLS + POLITIQUES
-- ============================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_own_read" ON public.notifications;
CREATE POLICY "notif_own_read" ON public.notifications
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "notif_own_update" ON public.notifications;
CREATE POLICY "notif_own_update" ON public.notifications
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "notif_own_delete" ON public.notifications;
CREATE POLICY "notif_own_delete" ON public.notifications
  FOR DELETE USING (auth.uid() = id);

-- ============================================
-- 3. INDEX
-- ============================================
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(id, created_at DESC)
  WHERE read = false;

-- ============================================
-- 4. FONCTION HELPER : créer une notification
-- ============================================
CREATE OR REPLACE FUNCTION public.create_notification(
  p_target_id UUID,
  p_actor_id UUID,
  p_type TEXT,
  p_message TEXT,
  p_source_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ne pas notifier soi-même
  IF p_target_id = p_actor_id THEN RETURN; END IF;
  
  -- Ne pas dupliquer (même source + même type dans les 5 dernières minutes)
  IF p_source_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.notifications
    WHERE id = p_target_id
      AND type = p_type
      AND source_id = p_source_id
      AND created_at > NOW() - INTERVAL '5 minutes'
  ) THEN RETURN; END IF;

  INSERT INTO public.notifications (id, actor_id, type, message, source_id, read, created_at)
  VALUES (p_target_id, p_actor_id, p_type, p_message, p_source_id, false, NOW());
END;
$$;

REVOKE ALL ON FUNCTION public.create_notification(UUID, UUID, TEXT, TEXT, UUID) FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.create_notification(UUID, UUID, TEXT, TEXT, UUID) TO AUTHENTICATED;

-- ============================================
-- 5. TRIGGER AUTO : réaction → notification
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_on_reaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_author UUID;
  v_actor_name TEXT;
BEGIN
  SELECT author_id INTO v_post_author FROM public.posts WHERE id = NEW.post_id;
  SELECT COALESCE(full_name, display_name, handle, 'Quelqu''un') INTO v_actor_name
    FROM public.profiles WHERE id = NEW.id;

  PERFORM public.create_notification(
    v_post_author,
    NEW.id,
    'reaction',
    v_actor_name || ' a réagi ' || NEW.reaction || ' à votre publication',
    NEW.post_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_reaction ON public.post_reactions;
CREATE TRIGGER trg_notify_reaction
  AFTER INSERT ON public.post_reactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_reaction();

-- ============================================
-- 6. TRIGGER AUTO : commentaire → notification
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_author UUID;
  v_actor_name TEXT;
BEGIN
  SELECT author_id INTO v_post_author FROM public.posts WHERE id = NEW.post_id;
  SELECT COALESCE(full_name, display_name, handle, 'Quelqu''un') INTO v_actor_name
    FROM public.profiles WHERE id = NEW.author_id;

  PERFORM public.create_notification(
    v_post_author,
    NEW.author_id,
    'comment',
    v_actor_name || ' a commenté votre publication',
    NEW.post_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_comment ON public.comments;
CREATE TRIGGER trg_notify_comment
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

-- ============================================
-- 7. TRIGGER AUTO : follow → notification
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_name TEXT;
BEGIN
  SELECT COALESCE(full_name, display_name, handle, 'Quelqu''un') INTO v_actor_name
    FROM public.profiles WHERE id = NEW.follower_id;

  PERFORM public.create_notification(
    NEW.followed_id,
    NEW.follower_id,
    'follow',
    v_actor_name || ' vous suit maintenant',
    NULL
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_follow ON public.follows;
CREATE TRIGGER trg_notify_follow
  AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();

-- ============================================
-- 8. TRIGGER AUTO : vote sondage → notification
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_on_poll_vote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_id UUID;
  v_post_author UUID;
  v_actor_name TEXT;
  v_question TEXT;
BEGIN
  SELECT post_id INTO v_post_id FROM public.polls WHERE id = NEW.poll_id;
  SELECT author_id INTO v_post_author FROM public.posts WHERE id = v_post_id;
  SELECT question INTO v_question FROM public.polls WHERE id = NEW.poll_id;
  SELECT COALESCE(full_name, display_name, handle, 'Quelqu''un') INTO v_actor_name
    FROM public.profiles WHERE id = NEW.id;

  PERFORM public.create_notification(
    v_post_author,
    NEW.id,
    'poll_vote',
    v_actor_name || ' a voté à votre sondage : ' || LEFT(v_question, 50),
    v_post_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_poll_vote ON public.poll_votes;
CREATE TRIGGER trg_notify_poll_vote
  AFTER INSERT ON public.poll_votes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_poll_vote();

-- ============================================
-- 9. REALTIME
-- ============================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- ============================================
-- 10. FONCTION : compter les non-lues
-- ============================================
CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INT FROM public.notifications
  WHERE id = auth.uid() AND read = false;
$$;

REVOKE ALL ON FUNCTION public.get_unread_notification_count() FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.get_unread_notification_count() TO AUTHENTICATED;
