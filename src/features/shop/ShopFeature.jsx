import { useEffect, useState } from "react";
import { Store, Search, Package, Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "../../supabaseClient.js";
import { COLORS } from "../../theme.js";

export function LocalShopDirectory({ onSelectShop }) {
  const [shops, setShops] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true); 
      setError("");
      try {
        let q = supabase
          .from("shops")
          .select("id, name, description, category, country, city, logo_url, currency")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(50);
        
        const term = query.trim().replace(/[%_]/g, (m) => `\\${m}`);
        if (term) {
          q = q.or(`name.ilike.%${term}%,city.ilike.%${term}%,category.ilike.%${term}%`);
        }
        
        const { data, error: err } = await q;
        if (err) throw err;
        if (!cancelled) setShops(data || []);
      } catch (e) {
        if (!cancelled) setError(e.message || "Erreur de chargement de l'annuaire.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250); // Petit délai pour éviter les requêtes à chaque frappe
    
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="animate-spin" size={24} style={{ color: COLORS.gold }} />
        <p className="ml-3 text-sm" style={{ color: COLORS.muted }}>Chargement de l'annuaire…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Barre de recherche */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: COLORS.muted }} />
        <input 
          type="search" 
          value={query} 
          onChange={(e) => setQuery(e.target.value)} 
          placeholder="Rechercher une boutique, ville, catégorie…" 
          className="w-full rounded-xl border pl-9 pr-3 py-2.5 text-sm outline-none transition-colors focus:border-amber-400/50" 
          style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }} 
        />
      </div>

      {error && (
        <p className="text-sm text-center py-4" style={{ color: "#ef4444" }}>{error}</p>
      )}

      {!error && shops.length === 0 && (
        <div className="text-center py-8">
          <Store size={32} className="mx-auto mb-2 opacity-30" style={{ color: COLORS.muted }} />
          <p className="text-sm" style={{ color: COLORS.muted }}>Aucune boutique active ne correspond à ta recherche.</p>
        </div>
      )}

      {/* Liste des boutiques */}
      <div className="grid gap-3">
        {shops.map((s) => (
          <button 
            key={s.id} 
            type="button" 
            onClick={() => onSelectShop?.(s)} 
            className="rounded-xl border p-3 text-left transition-all hover:shadow-md active:scale-[0.98]" 
            style={{ background: COLORS.surface, borderColor: COLORS.border }}
          >
            <div className="flex items-start gap-3">
              {s.logo_url ? (
                <img src={s.logo_url} alt={s.name} className="h-12 w-12 rounded-lg object-cover flex-shrink-0 bg-gray-800" />
              ) : (
                <div className="h-12 w-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: COLORS.surface2 }}>
                  <Store size={20} style={{ color: COLORS.muted }} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate" style={{ color: COLORS.ivory }}>{s.name}</div>
                <div className="mt-1 text-xs flex flex-wrap gap-1" style={{ color: COLORS.muted }}>
                  {[s.category, s.city, s.country].filter(Boolean).map((item, i, arr) => (
                    <span key={i}>{item}{i < arr.length - 1 ? " · " : ""}</span>
                  ))}
                </div>
              </div>
            </div>
            {s.description && (
              <p className="mt-2 line-clamp-2 text-xs leading-relaxed" style={{ color: COLORS.muted }}>
                {s.description}
              </p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ShopProductManager({ shopId, shopCurrency = "XOF" }) {
  const [products, setProducts] = useState([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [type, setType] = useState("produit");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    // ✅ Utilisation de 'shop_items' pour correspondre à la migration 044
    const { data, error: err } = await supabase
      .from("shop_items")
      .select("id, name, description, price, currency, type, is_available, stock")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false });
      
    if (err) setError(err.message);
    setProducts(data || []);
    setLoading(false);
  }

  useEffect(() => { 
    if (shopId) load(); 
  }, [shopId]);

  async function add(e) {
    e.preventDefault(); 
    setError("");
    const p = Number(price);
    
    if (!name.trim() || !Number.isFinite(p) || p < 0) { 
      setError("Un nom et un prix valides sont requis."); 
      return; 
    }
    
    setSaving(true);
    try {
      const { error: err } = await supabase.from("shop_items").insert({
        shop_id: shopId, 
        name: name.trim(), 
        price: p, 
        currency: shopCurrency, 
        type,
        is_available: true,
        stock: 0 // Valeur par défaut, peut être modifiée plus tard
      });
      
      if (err) throw err;
      
      setName(""); 
      setPrice(""); 
      await load();
    } catch (e) { 
      setError(e.message || "Erreur lors de l'ajout du produit."); 
    } finally { 
      setSaving(false); 
    }
  }

  async function toggle(product) {
    const { error: err } = await supabase
      .from("shop_items")
      .update({ is_available: !product.is_available })
      .eq("id", product.id);
      
    if (err) {
      setError(err.message); 
    } else { 
      await load(); 
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Formulaire d'ajout */}
      <form onSubmit={add} className="rounded-xl border p-4 space-y-3" style={{ background: COLORS.surface, borderColor: COLORS.border }}>
        <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: COLORS.ivory }}>
          <Package size={16} style={{ color: COLORS.gold }} />
          Ajouter un produit ou service
        </h3>
        
        <input 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          placeholder="Nom du produit / service" 
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-amber-400/50" 
          style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }} 
        />
        
        <div className="flex gap-2">
          <input 
            type="number" 
            step="0.01" 
            min="0" 
            value={price} 
            onChange={(e) => setPrice(e.target.value)} 
            placeholder={`Prix (${shopCurrency})`} 
            className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-amber-400/50" 
            style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }} 
          />
          <select 
            value={type} 
            onChange={(e) => setType(e.target.value)} 
            className="rounded-lg border px-3 py-2 text-sm outline-none" 
            style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }}
          >
            <option value="produit">Produit</option>
            <option value="service">Service</option>
          </select>
        </div>
        
        {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
        
        <button 
          disabled={saving} 
          className="w-full rounded-lg py-2 text-sm font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed" 
          style={{ background: COLORS.gold, color: COLORS.bg }}
        >
          {saving ? "Ajout en cours…" : "Ajouter au catalogue"}
        </button>
      </form>

      {/* Liste des produits */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin" size={24} style={{ color: COLORS.gold }} />
        </div>
      ) : products.length === 0 ? (
        <p className="text-center text-sm py-4" style={{ color: COLORS.muted }}>Aucun produit dans cette boutique pour le moment.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase px-1" style={{ color: COLORS.muted }}>Catalogue ({products.length})</p>
          {products.map((p) => (
            <div 
              key={p.id} 
              className="flex items-center justify-between rounded-xl border p-3 transition-all" 
              style={{ 
                background: COLORS.surface, 
                borderColor: COLORS.border,
                opacity: p.is_available ? 1 : 0.6
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate" style={{ color: COLORS.ivory }}>{p.name}</div>
                <div className="text-xs mt-1 flex items-center gap-2" style={{ color: COLORS.muted }}>
                  <span>{p.price} {p.currency}</span>
                  <span>·</span>
                  <span className="capitalize">{p.type}</span>
                  {!p.is_available && <span className="text-red-400">· Indisponible</span>}
                </div>
              </div>
              
              <button 
                type="button" 
                onClick={() => toggle(p)} 
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95"
                style={{ 
                  background: p.is_available ? "rgba(239, 68, 68, 0.1)" : "rgba(45, 191, 166, 0.1)",
                  color: p.is_available ? "#ef4444" : COLORS.teal
                }}
              >
                {p.is_available ? <EyeOff size={14} /> : <Eye size={14} />}
                {p.is_available ? "Masquer" : "Afficher"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
