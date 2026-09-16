import { useState, useEffect } from "react";
import { X, ShoppingBag, Trash2, Plus, Minus } from "lucide-react";
import { COLORS } from "../../../theme.js";
import { supabase } from "../../../supabaseClient.js";
import { useToast } from "../../../components/ToastContext.jsx";

export default function CartDrawer({ isOpen, onClose, userId }) {
  const { showToast } = useToast();
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Charger le panier depuis la base de données
  useEffect(() => {
    if (!isOpen || !userId) return;
    
    loadCart();
  }, [isOpen, userId]);

  const loadCart = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("cart")
        .select(`
          *,
          shop_items (
            id,
            name,
            price,
            image_url,
            shops (
              name,
              currency
            )
          )
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCartItems(data || []);
    } catch (error) {
      console.error("Erreur chargement panier:", error);
      showToast("Erreur de chargement du panier", "error");
    } finally {
      setLoading(false);
    }
  };

  // Mettre à jour la quantité
  const updateQuantity = async (cartId, newQuantity) => {
    if (newQuantity < 1) return;
    
    setUpdating(true);
    try {
      const { error } = await supabase
        .from("cart")
        .update({ quantity: newQuantity })
        .eq("id", cartId);

      if (error) throw error;
      
      setCartItems(items => 
        items.map(item => 
          item.id === cartId ? { ...item, quantity: newQuantity } : item
        )
      );
    } catch (error) {
      showToast("Erreur mise à jour quantité", "error");
    } finally {
      setUpdating(false);
    }
  };

  // Supprimer un article
  const removeItem = async (cartId) => {
    try {
      const { error } = await supabase
        .from("cart")
        .delete()
        .eq("id", cartId);

      if (error) throw error;
      
      setCartItems(items => items.filter(item => item.id !== cartId));
      showToast("Article retiré du panier", "success");
    } catch (error) {
      showToast("Erreur suppression article", "error");
    }
  };

  // Vider le panier
  const clearCart = async () => {
    if (!window.confirm("Vider tout le panier ?")) return;
    
    try {
      const { error } = await supabase
        .from("cart")
        .delete()
        .eq("user_id", userId);

      if (error) throw error;
      
      setCartItems([]);
      showToast("Panier vidé", "success");
    } catch (error) {
      showToast("Erreur vidage du panier", "error");
    }
  };

  // Calculer le total
  const total = cartItems.reduce((sum, item) => {
    const price = item.shop_items?.price || 0;
    return sum + (price * item.quantity);
  }, 0);

  const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div 
        className="fixed right-0 top-0 h-full w-full max-w-md bg-[#0F0F0F] shadow-2xl z-50 flex flex-col animate-slide-in-right"
        style={{ 
          borderLeft: `1px solid ${COLORS.border}`,
          animation: "slideInRight 0.3s ease-out"
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: COLORS.border }}>
          <div className="flex items-center gap-2">
            <ShoppingBag size={20} style={{ color: COLORS.gold }} />
            <h2 className="text-lg font-bold" style={{ color: COLORS.ivory }}>
              Mon Panier
            </h2>
            {itemCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: COLORS.gold, color: COLORS.bg }}>
                {itemCount} article{itemCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            style={{ color: COLORS.muted }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: COLORS.gold }} />
            </div>
          ) : cartItems.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag size={48} style={{ color: COLORS.muted, opacity: 0.3 }} className="mx-auto mb-4" />
              <p className="text-sm" style={{ color: COLORS.muted }}>
                Votre panier est vide
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 rounded-lg text-sm font-bold"
                style={{ background: COLORS.gold, color: COLORS.bg }}
              >
                Continuer les achats
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {cartItems.map((item) => {
                const product = item.shop_items;
                const shop = product?.shops;
                const itemTotal = (product?.price || 0) * item.quantity;
                
                return (
                  <div
                    key={item.id}
                    className="flex gap-3 p-3 rounded-xl border"
                    style={{ background: COLORS.surface, borderColor: COLORS.border }}
                  >
                    {/* Image */}
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-[#1A1A1A] flex-shrink-0">
                      {product?.image_url ? (
                        <img 
                          src={product.image_url} 
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ color: COLORS.muted }}>
                          <ShoppingBag size={24} />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate" style={{ color: COLORS.ivory }}>
                        {product?.name}
                      </h3>
                      {shop && (
                        <p className="text-xs" style={{ color: COLORS.muted }}>
                          {shop.name}
                        </p>
                      )}
                      
                      {/* Quantité */}
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          disabled={updating || item.quantity <= 1}
                          className="p-1 rounded hover:bg-white/5 disabled:opacity-30"
                          style={{ color: COLORS.ivory }}
                        >
                          <Minus size={14} />
                        </button>
                        <span className="text-sm font-bold min-w-[24px] text-center" style={{ color: COLORS.ivory }}>
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          disabled={updating}
                          className="p-1 rounded hover:bg-white/5 disabled:opacity-30"
                          style={{ color: COLORS.ivory }}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Prix et suppression */}
                    <div className="flex flex-col justify-between items-end">
                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-1 rounded hover:bg-red-500/20 transition-colors"
                        style={{ color: "#ef4444" }}
                      >
                        <Trash2 size={16} />
                      </button>
                      <span className="font-bold text-sm" style={{ color: COLORS.gold }}>
                        {itemTotal.toFixed(2)} {shop?.currency || 'pts'}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Bouton vider le panier */}
              <button
                onClick={clearCart}
                className="w-full py-2 rounded-lg text-xs font-bold border border-dashed"
                style={{ borderColor: COLORS.border, color: COLORS.muted }}
              >
                Vider le panier
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {cartItems.length > 0 && (
          <div className="p-4 border-t" style={{ borderColor: COLORS.border, background: COLORS.surface }}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm" style={{ color: COLORS.muted }}>Total</span>
              <span className="text-xl font-bold" style={{ color: COLORS.gold }}>
                {total.toFixed(2)} pts
              </span>
            </div>
            <button
              className="w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95"
              style={{ background: COLORS.gold, color: COLORS.bg }}
              onClick={() => showToast("Paiement bientôt disponible", "info")}
            >
              Procéder au paiement
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}
