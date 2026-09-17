import { useState, useEffect, useMemo, useCallback } from "react";
import { Store, PlusCircle, Package, ClipboardList, Loader2, ShoppingCart } from "lucide-react";
import { COLORS } from "../../theme.js";
import { supabase } from "../../supabaseClient.js";
import { LocalShopDirectory, ShopProductManager } from "./ShopFeature.jsx";
import ShopRegistrationForm from "./ShopRegistrationForm.jsx";
import ShopDetail from "./components/ShopDetail.jsx";
import OrdersBuyer from "./components/OrdersBuyer.jsx";
import OrdersSeller from "./components/OrdersSeller.jsx";
import CartDrawer from "./components/CartDrawer.jsx"; // 🆕 Import du panier

/**
 * Onglet Boutiques BAARO — version finale avec Panier
 * Modes : directory | detail | register | manage | orders-buyer | orders-seller
 */
export default function ShopTab({ userId, id }) {
  userId = userId || id;
  const [mode, setMode] = useState("directory");
  const [myShop, setMyShop] = useState(null);
  const [selectedShopId, setSelectedShopId] = useState(null);
  const [loadingShop, setLoadingShop] = useState(false);
  const [error, setError] = useState(null);
  
  // 🆕 État pour le tiroir du panier
  const [cartOpen, setCartOpen] = useState(false);

  // Récupération de la boutique de l'utilisateur
  useEffect(() => {
    if (!userId) {
      setMyShop(null);
      return;
    }

    let cancelled = false;
    setLoadingShop(true);
    setError(null);

    (async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from("shops")
          .select("id, name, currency, is_active, country, city")
          .eq("owner_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fetchError) throw fetchError;
        if (!cancelled) setMyShop(data || null);
      } catch (err) {
        console.error("Erreur chargement boutique:", err);
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoadingShop(false);
      }
    })();

    return () => { cancelled = true; };
  }, [userId]);

  const getButtonStyle = useMemo(() => {
    return (active, activeColor = "gold") => ({
      background: active ? (activeColor === "teal" ? COLORS.tealGlow || COLORS.goldGlow : COLORS.goldGlow) : COLORS.surface2,
      borderColor: active ? (activeColor === "teal" ? COLORS.borderTeal || COLORS.borderGold : COLORS.borderGold) : COLORS.border,
      color: active ? (activeColor === "teal" ? COLORS.teal || COLORS.gold : COLORS.gold) : COLORS.ivory,
      transition: "all 0.2s ease-in-out",
      opacity: loadingShop ? 0.6 : 1,
      pointerEvents: loadingShop ? "none" : "auto",
    });
  }, [loadingShop]);

  const handleDirectoryClick = useCallback(() => { setMode("directory"); setSelectedShopId(null); }, []);
  const handleDetailBack = useCallback(() => { setSelectedShopId(null); setMode("directory"); }, []);
  const handleShopSelect = useCallback((shop) => { setSelectedShopId(shop.id); setMode("detail"); }, []);
  const handleRegistrationComplete = useCallback(() => { setMode("manage"); }, []);

  const renderContent = useMemo(() => {
    if (loadingShop) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin" size={32} style={{ color: COLORS.gold }} />
          <p className="ml-3 text-sm" style={{ color: COLORS.muted }}>Chargement...</p>
        </div>
      );
    }
    if (error) {
      return (
        <div className="p-4 rounded-xl border" style={{ background: COLORS.surface2, borderColor: "#ef4444" }}>
          <p className="text-sm" style={{ color: "#ef4444" }}>Erreur: {error}</p>
        </div>
      );
    }

    switch (mode) {
      case "directory": return <LocalShopDirectory onSelectShop={handleShopSelect} />;
      case "detail": return selectedShopId ? <ShopDetail shopId={selectedShopId} userId={userId} onBack={handleDetailBack} /> : null;
      case "register": return <ShopRegistrationForm onRegistered={handleRegistrationComplete} />;
      case "manage": return myShop ? <ShopProductManager shopId={myShop.id} shopCurrency={myShop.currency} /> : <p className="text-sm" style={{ color: COLORS.muted }}>Aucune boutique trouvée. Créez-en une d'abord.</p>;
      case "orders-seller": return myShop ? <OrdersSeller shopId={myShop.id} /> : null;
      case "orders-buyer": return userId ? <OrdersBuyer userId={userId} /> : null;
      default: return null;
    }
  }, [mode, loadingShop, error, myShop, userId, selectedShopId, handleShopSelect, handleDetailBack, handleRegistrationComplete]);

  return (
    <div className="flex flex-col gap-4">
      {/* Navigation */}
      <nav className="flex flex-wrap gap-2" role="tablist" aria-label="Navigation boutique">
        <button type="button" onClick={handleDirectoryClick} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border" style={getButtonStyle(mode === "directory" || mode === "detail")} role="tab" aria-selected={mode === "directory" || mode === "detail"} disabled={loadingShop}>
          <Store size={14} /> Annuaire
        </button>

        <button type="button" onClick={() => setMode("register")} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border" style={getButtonStyle(mode === "register")} role="tab" aria-selected={mode === "register"} disabled={loadingShop}>
          <PlusCircle size={14} /> Créer ma boutique
        </button>

        {myShop && (
          <>
            <button type="button" onClick={() => setMode("manage")} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border" style={getButtonStyle(mode === "manage", "teal")} role="tab" aria-selected={mode === "manage"} disabled={loadingShop}>
              <Package size={14} /> Mes produits
            </button>
            <button type="button" onClick={() => setMode("orders-seller")} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border" style={getButtonStyle(mode === "orders-seller", "teal")} role="tab" aria-selected={mode === "orders-seller"} disabled={loadingShop}>
              <ClipboardList size={14} /> Commandes reçues
            </button>
          </>
        )}

        {userId && (
          <>
            <button type="button" onClick={() => setMode("orders-buyer")} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border" style={getButtonStyle(mode === "orders-buyer")} role="tab" aria-selected={mode === "orders-buyer"} disabled={loadingShop}>
              Mes commandes
            </button>
            
            {/*  Bouton Panier */}
            <button 
              type="button" 
              onClick={() => setCartOpen(true)} 
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border"
              style={{ borderColor: COLORS.borderGold, color: COLORS.gold }}
              aria-label="Ouvrir le panier"
            >
              <ShoppingCart size={14} /> Panier
            </button>
          </>
        )}
      </nav>

      {/* Contenu principal */}
      <main role="tabpanel">
        {renderContent}
      </main>

      {/* 🆕 Tiroir du Panier (Cart Drawer) */}
      {userId && (
        <CartDrawer 
          isOpen={cartOpen} 
          onClose={() => setCartOpen(false)} 
          userId={userId} 
        />
      )}
    </div>
  );
}
