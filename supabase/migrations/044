-- BAARO 044 : Table des produits + Système de panier

-- ============================================
-- 1. CRÉATION DE LA TABLE shop_items (Produits)
-- ============================================
CREATE TABLE IF NOT EXISTS public.shop_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'pts',
  image_url TEXT,
  stock INT DEFAULT 0,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS pour shop_items
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_items_read_public" ON public.shop_items;
CREATE POLICY "shop_items_read_public" ON public.shop_items
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "shop_items_insert_owner" ON public.shop_items;
CREATE POLICY "shop_items_insert_owner" ON public.shop_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.shops WHERE id = shop_items.shop_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "shop_items_update_owner" ON public.shop_items;
CREATE POLICY "shop_items_update_owner" ON public.shop_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.shops WHERE id = shop_items.shop_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "shop_items_delete_owner" ON public.shop_items;
CREATE POLICY "shop_items_delete_owner" ON public.shop_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.shops WHERE id = shop_items.shop_id AND owner_id = auth.uid())
  );

-- ============================================
-- 2. CRÉATION DE LA TABLE cart (Panier)
-- ============================================
CREATE TABLE IF NOT EXISTS public.cart (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES public.shop_items(id) ON DELETE CASCADE NOT NULL,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, item_id)
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_cart_user_id ON public.cart(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_item_id ON public.cart(item_id);

-- RLS pour le panier
ALTER TABLE public.cart ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cart_read_own" ON public.cart;
CREATE POLICY "cart_read_own" ON public.cart
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "cart_insert_own" ON public.cart;
CREATE POLICY "cart_insert_own" ON public.cart
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cart_update_own" ON public.cart;
CREATE POLICY "cart_update_own" ON public.cart
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cart_delete_own" ON public.cart;
CREATE POLICY "cart_delete_own" ON public.cart
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 3. FONCTION pour ajouter au panier
-- ============================================
CREATE OR REPLACE FUNCTION public.add_to_cart(
  p_user_id UUID,
  p_item_id UUID,
  p_quantity INT DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cart_item RECORD;
BEGIN
  -- Vérifier que l'article existe et est disponible
  IF NOT EXISTS (
    SELECT 1 FROM public.shop_items 
    WHERE id = p_item_id AND is_available = true
  ) THEN
    RAISE EXCEPTION 'Article non disponible';
  END IF;

  -- Upsert dans le panier (ajoute la quantité si l'article est déjà dans le panier)
  INSERT INTO public.cart (user_id, item_id, quantity, updated_at)
  VALUES (p_user_id, p_item_id, p_quantity, NOW())
  ON CONFLICT (user_id, item_id) DO UPDATE
  SET quantity = public.cart.quantity + p_quantity,
      updated_at = NOW()
  RETURNING * INTO v_cart_item;

  RETURN jsonb_build_object(
    'cart_id', v_cart_item.id,
    'quantity', v_cart_item.quantity
  );
END;
$$;

REVOKE ALL ON FUNCTION public.add_to_cart(UUID, UUID, INT) FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.add_to_cart(UUID, UUID, INT) TO AUTHENTICATED;

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION public.update_cart_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cart_updated_at ON public.cart;
CREATE TRIGGER trg_cart_updated_at
  BEFORE UPDATE ON public.cart
  FOR EACH ROW
  EXECUTE FUNCTION public.update_cart_updated_at();
