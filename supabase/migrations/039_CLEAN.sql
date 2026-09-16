-- BAARO 039: fonctions wallet alignées sur wallets.id (plus de wallets.user_id)
-- transactions.user_id reste une FK relationnelle (correct).
-- À exécuter APRÈS 038_identity_id_only_and_profile_persistence.sql

-- Colonnes attendues
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS balance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- DROP obligatoire : CREATE OR REPLACE ne peut pas changer les défauts de paramètres
DROP FUNCTION IF EXISTS public.wallet_ensure(uuid, numeric);
DROP FUNCTION IF EXISTS public.wallet_earn(uuid, numeric, text, text, numeric, boolean);
DROP FUNCTION IF EXISTS public.wallet_earn(uuid, numeric, text, text, numeric, boolean, uuid);
DROP FUNCTION IF EXISTS public.wallet_redeem(uuid, numeric, text, text);
DROP FUNCTION IF EXISTS public.wallet_convert(uuid, numeric);

-- wallet_ensure
CREATE OR REPLACE FUNCTION public.wallet_ensure(p_user_id uuid, p_welcome_bonus numeric DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.wallets%rowtype;
  bonus numeric := greatest(coalesce(p_welcome_bonus, 0), 0);
BEGIN
  INSERT INTO public.wallets(id, balance, updated_at)
  VALUES (p_user_id, 0, now())
  ON CONFLICT (id) DO NOTHING;

  SELECT * INTO w FROM public.wallets WHERE id = p_user_id FOR UPDATE;

  IF bonus > 0 AND NOT EXISTS (
    SELECT 1 FROM public.transactions
    WHERE user_id = p_user_id AND action_key = 'welcome_bonus'
  ) THEN
    UPDATE public.wallets
      SET balance = balance + bonus, updated_at = now()
    WHERE id = p_user_id
    RETURNING * INTO w;

    INSERT INTO public.transactions(user_id, label, pts, action_key, day_key)
    VALUES (p_user_id, 'Bonus de bienvenue', bonus, 'welcome_bonus', current_date);
  END IF;

  RETURN jsonb_build_object('id', w.id, 'user_id', w.id, 'balance', w.balance, 'updated_at', w.updated_at);
END;
$$;

-- wallet_earn (anti-farming + reference_id)
CREATE OR REPLACE FUNCTION public.wallet_earn(
  p_user_id uuid,
  p_pts numeric,
  p_label text,
  p_action_key text,
  p_daily_cap numeric DEFAULT 100,
  p_daily_bonus boolean DEFAULT false,
  p_reference_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.wallets%rowtype;
  earned numeric := 0;
  actual_pts numeric;
  tx public.transactions%rowtype;
  event_exists boolean := false;
BEGIN
  IF p_pts IS NULL OR p_pts <= 0 THEN RAISE EXCEPTION 'INVALID_POINTS'; END IF;
  IF length(coalesce(p_label,'')) = 0 THEN RAISE EXCEPTION 'INVALID_LABEL'; END IF;

  IF NOT p_daily_bonus THEN
    IF p_reference_id IS NULL THEN RAISE EXCEPTION 'REWARD_REFERENCE_REQUIRED'; END IF;

    CASE p_action_key
      WHEN 'publish_post' THEN
        SELECT EXISTS(SELECT 1 FROM public.posts WHERE id = p_reference_id AND author_id = p_user_id) INTO event_exists;
      WHEN 'publish_post_media' THEN
        SELECT EXISTS(SELECT 1 FROM public.posts WHERE id = p_reference_id AND author_id = p_user_id AND media_url IS NOT NULL) INTO event_exists;
      WHEN 'like_post' THEN
        SELECT EXISTS(SELECT 1 FROM public.post_likes WHERE post_id = p_reference_id AND user_id = p_user_id) INTO event_exists;
      WHEN 'comment' THEN
        SELECT EXISTS(SELECT 1 FROM public.comments WHERE id = p_reference_id AND author_id = p_user_id) INTO event_exists;
      WHEN 'subscribe' THEN
        SELECT EXISTS(SELECT 1 FROM public.follows WHERE follower_id = p_user_id AND followed_id = p_reference_id) INTO event_exists;
      WHEN 'like_video' THEN
        SELECT EXISTS(SELECT 1 FROM public.video_likes WHERE video_id = p_reference_id AND user_id = p_user_id) INTO event_exists;
      WHEN 'comment_video' THEN
        SELECT EXISTS(SELECT 1 FROM public.video_comments WHERE id = p_reference_id AND author_id = p_user_id) INTO event_exists;
      WHEN 'publish_video' THEN
        SELECT EXISTS(SELECT 1 FROM public.videos WHERE id = p_reference_id AND author_id = p_user_id) INTO event_exists;
      WHEN 'repost_video' THEN
        SELECT EXISTS(SELECT 1 FROM public.videos WHERE id = p_reference_id AND author_id = p_user_id) INTO event_exists;
      WHEN 'publish_story' THEN
        SELECT EXISTS(SELECT 1 FROM public.stories WHERE id = p_reference_id AND author_id = p_user_id) INTO event_exists;
      ELSE
        RAISE EXCEPTION 'UNVERIFIABLE_REWARD_ACTION';
    END CASE;

    IF NOT event_exists THEN RAISE EXCEPTION 'REWARD_EVENT_NOT_FOUND'; END IF;

    IF EXISTS (
      SELECT 1 FROM public.transactions
      WHERE user_id = p_user_id AND action_key = p_action_key AND reference_id = p_reference_id AND pts > 0
    ) THEN
      RAISE EXCEPTION 'REWARD_ALREADY_CLAIMED';
    END IF;
  ELSE
    IF p_action_key <> 'daily_bonus' THEN RAISE EXCEPTION 'INVALID_DAILY_BONUS'; END IF;
    IF EXISTS (
      SELECT 1 FROM public.transactions
      WHERE user_id = p_user_id AND action_key = 'daily_bonus' AND day_key = current_date
    ) THEN
      RAISE EXCEPTION 'DAILY_BONUS_ALREADY_CLAIMED';
    END IF;
  END IF;

  PERFORM public.wallet_ensure(p_user_id, 0);
  SELECT * INTO w FROM public.wallets WHERE id = p_user_id FOR UPDATE;

  SELECT coalesce(sum(pts), 0) INTO earned
  FROM public.transactions
  WHERE user_id = p_user_id AND pts > 0 AND created_at >= date_trunc('day', now());

  IF earned >= p_daily_cap THEN RAISE EXCEPTION 'DAILY_CAP_REACHED'; END IF;
  actual_pts := least(p_pts, p_daily_cap - earned);

  UPDATE public.wallets
    SET balance = balance + actual_pts, updated_at = now()
  WHERE id = p_user_id
  RETURNING * INTO w;

  INSERT INTO public.transactions(user_id, label, pts, action_key, day_key, reference_id)
  VALUES (p_user_id, left(p_label, 120), actual_pts, p_action_key, current_date, p_reference_id)
  RETURNING * INTO tx;

  RETURN jsonb_build_object(
    'balance', w.balance,
    'earned_today', earned + actual_pts,
    'remaining_today', greatest(0, p_daily_cap - earned - actual_pts),
    'transaction', to_jsonb(tx)
  );
END;
$$;

-- wallet_redeem
CREATE OR REPLACE FUNCTION public.wallet_redeem(
  p_user_id uuid,
  p_cost numeric,
  p_label text,
  p_action_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.wallets%rowtype;
  tx public.transactions%rowtype;
BEGIN
  IF p_cost IS NULL OR p_cost <= 0 THEN RAISE EXCEPTION 'INVALID_COST'; END IF;
  PERFORM public.wallet_ensure(p_user_id, 0);
  SELECT * INTO w FROM public.wallets WHERE id = p_user_id FOR UPDATE;
  IF w.balance < p_cost THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;

  UPDATE public.wallets SET balance = balance - p_cost, updated_at = now()
  WHERE id = p_user_id RETURNING * INTO w;

  INSERT INTO public.transactions(user_id, label, pts, action_key, day_key)
  VALUES (p_user_id, left(p_label, 120), -p_cost, p_action_key, current_date)
  RETURNING * INTO tx;

  RETURN jsonb_build_object('balance', w.balance, 'transaction', to_jsonb(tx));
END;
$$;

-- wallet_convert (points → holdings)
CREATE OR REPLACE FUNCTION public.wallet_convert(
  p_user_id uuid,
  p_pts numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.wallets%rowtype;
  h public.crypto_holdings%rowtype;
  tx public.transactions%rowtype;
BEGIN
  IF p_pts IS NULL OR p_pts <= 0 THEN RAISE EXCEPTION 'INVALID_POINTS'; END IF;
  PERFORM public.wallet_ensure(p_user_id, 0);
  SELECT * INTO w FROM public.wallets WHERE id = p_user_id FOR UPDATE;
  IF w.balance < p_pts THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;

  INSERT INTO public.crypto_holdings(id, holdings, updated_at)
  VALUES (p_user_id, 0, now())
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.wallets SET balance = balance - p_pts, updated_at = now()
  WHERE id = p_user_id RETURNING * INTO w;

  UPDATE public.crypto_holdings
    SET holdings = holdings + p_pts, updated_at = now()
  WHERE id = p_user_id
  RETURNING * INTO h;

  INSERT INTO public.transactions(user_id, label, pts, action_key, day_key)
  VALUES (p_user_id, 'Conversion points → BAARO', -p_pts, 'convert_to_baro', current_date)
  RETURNING * INTO tx;

  RETURN jsonb_build_object('balance', w.balance, 'holdings', h.holdings, 'transaction', to_jsonb(tx));
END;
$$;

-- Grants
REVOKE ALL ON FUNCTION public.wallet_ensure(uuid, numeric) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.wallet_earn(uuid, numeric, text, text, numeric, boolean, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.wallet_redeem(uuid, numeric, text, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.wallet_convert(uuid, numeric) FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.wallet_ensure(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.wallet_earn(uuid, numeric, text, text, numeric, boolean, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.wallet_redeem(uuid, numeric, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.wallet_convert(uuid, numeric) TO service_role;
