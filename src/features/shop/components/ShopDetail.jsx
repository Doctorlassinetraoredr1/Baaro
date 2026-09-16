import { useEffect, useState, useCallback } from "react";
import { ArrowLeft, Minus, Plus, ShoppingCart, Loader2 } from "lucide-react";
import { COLORS } from "../../../theme.js";
import { fetchShopById, fetchShopProducts } from "../../../services/shopApi.js";
import OrderCheckout from "./OrderCheckout.jsx";
import { useToast } from "../../../components/ToastContext.jsx";
import { supabase } from "../../../supabaseClient.js";

export default function ShopDetail({ shopId, userId, onBack }) {
  const { showToast } = useToast();
  const [shop, setShop] = useState(null);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkout, setCheckout] = useState(false);
  const [addingId, setAddingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError("");
      try {
        const [s, p] = await Promise.all([fetchShopById(shopId), fetchShopProducts(shopId)]);
        if (!cancelled) { setShop(s); setProducts(p || []); }
      } catch (e) {
        if (!cancelled) setError(e.message || "Impossible de charger la boutique.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [shopId]);

  // 🆕 Ajout au panier avec persistance Supabase (synchronisé avec CartDrawer)
  const addToCart = useCallback(async (product) => {
    if (!userId) {
      showToast("Connectez-vous pour ajouter au panier", "info");
      return;
    }
    setAddingId(product.id);
    try {
      // Utilisation de la fonction RPC pour ajouter de manière atomique
      const { error } = await supabase.rpc('add_to_cart', {
        p_user_id: userId,
        p_item_id: product.id,
        p_quantity: 1
      });
      
      if (error) throw error;
      
      // Mise à jour de l'état local pour réactivité immédiate
      setCart((items) => {
        const old = items.find((x) => x.productId === product.id);
        if (old) return items.map((x) => x.productId === product.id ? { ...x, quantity: x.quantity + 1 } : x);
        return [...items, {
          productId: product.id,
          name: product.name,
          unitPrice: Number(product.price),
          currency: product.currency || shop?.currency || "XOF",
          quantity: 1
        }];
      });
      showToast(`${product.name} ajouté au panier`, "success");
    } catch (e) {
      console.error("Erreur ajout panier:", e);
      showToast("Erreur lors de l'ajout au panier", "error");
    } finally {
      setAddingId(null);
    }
  }, [userId, shop?.currency, showToast]);

  // 🆕 Modification de quantité avec persistance Supabase
  const changeQuantity = useCallback(async (productId, delta) => {
    if (!userId) return;
    const item = cart.find((x) => x.productId === productId);
    if (!item) return;
    
    const newQty = item.quantity + delta;
    
    try {
      if (newQty <= 0) {
        // ⚠️ Remplace 'user_id' par 'id' ici SI tu as renommé la colonne dans la table cart
        await supabase.from('cart').delete().eq('item_id', productId).eq('user_id', userId);
      } else {
        await supabase.from('cart').update({ quantity: newQty }).eq('item_id', productId).eq('user_id', userId);
      }
      
      setCart((items) => items
        .map((x) => x.productId === productId ? { ...x, quantity: newQty } : x)
        .filter((x) => x.quantity > 0));
    } catch (e) {
      console.error("Erreur mise à jour panier:", e);
      showToast("Erreur de mise à jour", "error");
    }
  }, [userId, cart, showToast]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 className="animate-spin" size={32} style={{ color: COLORS.gold }} />
        <p className="text-sm" style={{ color: COLORS.muted }}>Chargement de la boutique…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 text-center py-8">
        <p className="text-sm" style={{ color: "#ef4444" }}>{error}</p>
        <button 
          type="button" 
          onClick={onBack} 
          className="px-4 py-2 rounded-xl text-sm font-bold border transition-all active:scale-95"
          style={{ borderColor: COLORS.border, color: COLORS.ivory }}
        >
          ← Retour
        </button>
      </div>
    );
  }

  if (!shop) return null;

  if (checkout) {
    return <OrderCheckout
      shop={shop}
      userId={userId}
      items={cart}
      onBack={() => setCheckout(false)}
      onDone={() => { setCart([]); setCheckout(false); }}
    />;
  }

  const total = cart.reduce((sum, x) => sum + x.unitPrice * x.quantity, 0);
  const currency = cart[0]?.currency || shop.currency || "XOF";
  const totalItems = cart.reduce((sum, x) => sum + x.quantity, 0);

  return (
    <div className="flex flex-col gap-4 pb-24">
      <button 
        type="button" 
        onClick={onBack} 
        className="flex items-center gap-2 text-sm font-semibold transition-colors hover:opacity-80 w-fit"
        style={{ color: COLORS.ivory }}
      >
        <ArrowLeft size={16} /> Retour
      </button>

      <section className="rounded-2xl border p-4 shadow-sm" style={{ background: COLORS.surface, borderColor: COLORS.border }}>
        {shop.logo_url && (
          <img src={shop.logo_url} alt={shop.name} className="mb-3 h-36 w-full rounded-xl object-cover" />
        )}
        <h2 className="text-xl font-bold" style={{ color: COLORS.ivory }}>{shop.name}</h2>
        <p className="mt-1 text-xs flex flex-wrap gap-1" style={{ color: COLORS.muted }}>
          {[shop.category, shop.city, shop.country].filter(Boolean).map((item, i, arr) => (
            <span key={i}>{item}{i < arr.length - 1 ? " · " : ""}</span>
          ))}
        </p>
        {shop.description && (
          <p className="mt-3 text-sm leading-relaxed" style={{ color: COLORS.muted }}>{shop.description}</p>
        )}
      </section>

      <div className="grid gap-3">
        {products.length === 0 ? (
          <p className="text-center text-sm py-8" style={{ color: COLORS.muted }}>Aucun produit disponible pour le moment.</p>
        ) : (
          products.map((p) => {
            const qty = cart.find((x) => x.productId === p.id)?.quantity || 0;
            return (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border p-3 transition-all" style={{ background: COLORS.surface, borderColor: COLORS.border }}>
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="h-16 w-16 rounded-lg object-cover bg-gray-800 flex-shrink-0" />
                ) : (
                  <div className="h-16 w-16 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: COLORS.surface2 }}>
                    <ShoppingCart size={20} style={{ color: COLORS.muted }} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate" style={{ color: COLORS.ivory }}>{p.name}</div>
                  {p.description && <div className="mt-1 text-xs line-clamp-2" style={{ color: COLORS.muted }}>{p.description}</div>}
                  <div className="mt-2 text-sm font-semibold" style={{ color: COLORS.gold }}>{Number(p.price).toFixed(2)} {p.currency || currency}</div>
                </div>
                
                {qty === 0 ? (
                  <button 
                    type="button" 
                    onClick={() => addToCart(p)} 
                    disabled={addingId === p.id}
                    className="rounded-lg px-3 py-2 text-xs font-bold transition-all active:scale-95 disabled:opacity-50 flex-shrink-0" 
                    style={{ background: COLORS.gold, color: COLORS.bg }}
                  >
                    {addingId === p.id ? "..." : "Ajouter"}
                  </button>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border px-1 py-1 flex-shrink-0" style={{ borderColor: COLORS.border, background: COLORS.surface2 }}>
                    <button 
                      type="button" 
                      onClick={() => changeQuantity(p.id, -1)}
                      className="p-1 rounded hover:bg-white/5 transition-colors"
                      style={{ color: COLORS.ivory }}
                    >
                      <Minus size={14} />
                    </button>
                    <span className="text-sm font-bold min-w-[20px] text-center" style={{ color: COLORS.ivory }}>{qty}</span>
                    <button 
                      type="button" 
                      onClick={() => changeQuantity(p.id, 1)}
                      className="p-1 rounded hover:bg-white/5 transition-colors"
                      style={{ color: COLORS.ivory }}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 🆕 Barre de panier flottante (style mobile moderne) */}
      {cart.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 max-w-2xl mx-auto flex items-center gap-3 rounded-xl border p-3 shadow-2xl backdrop-blur-md z-40" style={{ background: `${COLORS.surface}E6`, borderColor: COLORS.borderGold }}>
          <div className="p-2 rounded-full flex-shrink-0" style={{ background: COLORS.gold }}>
            <ShoppingCart size={18} style={{ color: COLORS.bg }} />
          </div>
          <div className="flex-1 text-sm min-w-0">
            <div className="font-semibold truncate" style={{ color: COLORS.ivory }}>{totalItems} article(s)</div>
            <div className="text-xs" style={{ color: COLORS.muted }}>Total: <span className="font-bold" style={{ color: COLORS.gold }}>{total.toFixed(2)} {currency}</span></div>
          </div>
          <button 
            type="button" 
            disabled={!userId} 
            onClick={() => setCheckout(true)} 
            className="rounded-lg px-4 py-2.5 text-sm font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0" 
            style={{ background: COLORS.gold, color: COLORS.bg }}
          >
            Commander
          </button>
        </div>
      )}
    </div>
  );
}
