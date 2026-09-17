import { useState, useEffect, useCallback } from "react";
import { 
  Search, 
  MapPin, 
  Store, 
  Plus, 
  Package, 
  Edit3, 
  Trash2, 
  Loader2, 
  AlertCircle,
  Image as ImageIcon,
  X
} from "lucide-react";
import { COLORS } from "../../theme.js";
import { supabase } from "../../supabaseClient.js";
import { fetchActiveShops, fetchShopProducts } from "../../services/shopApi.js";
import { useToast } from "../../components/ToastContext.jsx";

// ==========================================
// 1. COMPOSANT LOCAL SHOP DIRECTORY (Annuaire)
// ==========================================
export function LocalShopDirectory({ onSelectShop }) {
  const { showToast } = useToast();
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("");
  const [category, setCategory] = useState("");

  const loadShops = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchActiveShops({
        query: search,
        country: country || undefined,
        category: category || undefined,
      });
      setShops(data || []);
    } catch (e) {
      console.error("Erreur chargement boutiques:", e);
      setError(e.message || "Impossible de charger les boutiques.");
    } finally {
      setLoading(false);
    }
  }, [search, country, category]);

  useEffect(() => {
    loadShops();
  }, [loadShops]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 className="animate-spin" size={32} style={{ color: COLORS.gold }} />
        <p className="text-sm" style={{ color: COLORS.muted }}>Chargement des boutiques…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <AlertCircle size={32} style={{ color: "#ef4444" }} />
        <p className="text-sm" style={{ color: "#ef4444" }}>{error}</p>
        <button
          onClick={loadShops}
          className="px-4 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95"
          style={{ borderColor: COLORS.border, color: COLORS.ivory }}
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filtres */}
      <div className="flex flex-col gap-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: COLORS.muted }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une boutique..."
            className="w-full pl-10 pr-3 py-2.5 rounded-xl border text-sm outline-none transition-colors focus:border-amber-400/50"
            style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }}
          />
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Pays (ex: ML, FR)"
            className="flex-1 px-3 py-2 rounded-xl border text-xs outline-none transition-colors focus:border-amber-400/50"
            style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }}
          />
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Catégorie"
            className="flex-1 px-3 py-2 rounded-xl border text-xs outline-none transition-colors focus:border-amber-400/50"
            style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }}
          />
        </div>
      </div>

      {/* Liste des boutiques */}
      {shops.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
          <Store size={48} style={{ color: COLORS.muted, opacity: 0.3 }} />
          <p className="text-sm font-semibold" style={{ color: COLORS.ivory }}>Aucune boutique trouvée</p>
          <p className="text-xs" style={{ color: COLORS.muted }}>Essayez de modifier vos filtres.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {shops.map((shop) => (
            <button
              key={shop.id}
              onClick={() => onSelectShop(shop)}
              className="flex flex-col rounded-xl border p-4 text-left transition-all hover:border-amber-400/50 active:scale-[0.98]"
              style={{ background: COLORS.surface, borderColor: COLORS.border }}
            >
              {shop.logo_url ? (
                <img
                  src={shop.logo_url}
                  alt={shop.name}
                  className="w-full h-32 rounded-lg object-cover mb-3 bg-gray-800"
                />
              ) : (
                <div
                  className="w-full h-32 rounded-lg flex items-center justify-center mb-3"
                  style={{ background: COLORS.surface2 }}
                >
                  <Store size={32} style={{ color: COLORS.muted }} />
                </div>
              )}
              <h3 className="font-bold text-sm mb-1 truncate" style={{ color: COLORS.ivory }}>
                {shop.name}
              </h3>
              {shop.category && (
                <p className="text-xs mb-1" style={{ color: COLORS.muted }}>
                  {shop.category}
                </p>
              )}
              {(shop.city || shop.country) && (
                <div className="flex items-center gap-1 text-xs" style={{ color: COLORS.muted }}>
                  <MapPin size={12} />
                  <span>{[shop.city, shop.country].filter(Boolean).join(", ")}</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ==========================================
// 2. COMPOSANT SHOP PRODUCT MANAGER (Gestion produits)
// ==========================================
export function ShopProductManager({ shopId, shopCurrency }) {
  const { showToast } = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    image_url: "",
    stock: "0",
    is_available: true,
  });
  const [saving, setSaving] = useState(false);

  const loadProducts = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchShopProducts(shopId, { onlyAvailable: false });
      setProducts(data || []);
    } catch (e) {
      console.error("Erreur chargement produits:", e);
      setError(e.message || "Impossible de charger les produits.");
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const openForm = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name || "",
        description: product.description || "",
        price: String(product.price || ""),
        image_url: product.image_url || "",
        stock: String(product.stock || 0),
        is_available: product.is_available ?? true,
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: "",
        description: "",
        price: "",
        image_url: "",
        stock: "0",
        is_available: true,
      });
    }
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingProduct(null);
    setFormData({
      name: "",
      description: "",
      price: "",
      image_url: "",
      stock: "0",
      is_available: true,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.price) {
      showToast("Nom et prix sont obligatoires", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        shop_id: shopId,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price: parseFloat(formData.price),
        currency: shopCurrency || "XOF",
        image_url: formData.image_url.trim() || null,
        stock: parseInt(formData.stock) || 0,
        is_available: formData.is_available,
      };

      if (editingProduct) {
        const { error } = await supabase
          .from("shop_items")
          .update(payload)
          .eq("id", editingProduct.id);
        if (error) throw error;
        showToast("Produit modifié", "success");
      } else {
        const { error } = await supabase.from("shop_items").insert(payload);
        if (error) throw error;
        showToast("Produit ajouté", "success");
      }

      closeForm();
      await loadProducts();
    } catch (e) {
      console.error("Erreur sauvegarde produit:", e);
      showToast(e.message || "Erreur lors de la sauvegarde", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (productId) => {
    if (!window.confirm("Supprimer ce produit ?")) return;
    try {
      const { error } = await supabase.from("shop_items").delete().eq("id", productId);
      if (error) throw error;
      showToast("Produit supprimé", "success");
      await loadProducts();
    } catch (e) {
      console.error("Erreur suppression:", e);
      showToast("Erreur lors de la suppression", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 className="animate-spin" size={32} style={{ color: COLORS.gold }} />
        <p className="text-sm" style={{ color: COLORS.muted }}>Chargement des produits…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm" style={{ color: COLORS.ivory }}>
          Mes produits ({products.length})
        </h3>
        <button
          onClick={() => openForm()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
          style={{ background: COLORS.gold, color: COLORS.bg }}
        >
          <Plus size={14} />
          Ajouter
        </button>
      </div>

      {error && (
        <div className="rounded-xl border p-3 text-sm" style={{ background: "rgba(239, 68, 68, 0.1)", borderColor: "#ef4444", color: "#ef4444" }}>
          {error}
        </div>
      )}

      {/* Liste des produits */}
      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
          <Package size={48} style={{ color: COLORS.muted, opacity: 0.3 }} />
          <p className="text-sm font-semibold" style={{ color: COLORS.ivory }}>Aucun produit</p>
          <p className="text-xs" style={{ color: COLORS.muted }}>Ajoutez votre premier produit !</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {products.map((product) => (
            <div
              key={product.id}
              className="flex items-center gap-3 rounded-xl border p-3"
              style={{ background: COLORS.surface, borderColor: COLORS.border }}
            >
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div
                  className="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: COLORS.surface2 }}
                >
                  <ImageIcon size={20} style={{ color: COLORS.muted }} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-sm truncate" style={{ color: COLORS.ivory }}>
                  {product.name}
                </h4>
                <p className="text-xs mt-0.5" style={{ color: COLORS.muted }}>
                  {product.description?.slice(0, 50)}{product.description?.length > 50 ? "..." : ""}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-bold" style={{ color: COLORS.gold }}>
                    {Number(product.price).toFixed(2)} {product.currency}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: COLORS.surface2, color: COLORS.muted }}>
                    Stock: {product.stock}
                  </span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{
                      background: product.is_available ? "rgba(45, 191, 166, 0.15)" : "rgba(239, 68, 68, 0.15)",
                      color: product.is_available ? COLORS.teal : "#ef4444",
                    }}
                  >
                    {product.is_available ? "Disponible" : "Indisponible"}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => openForm(product)}
                  className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                  style={{ color: COLORS.gold }}
                  aria-label="Modifier"
                >
                  <Edit3 size={14} />
                </button>
                <button
                  onClick={() => handleDelete(product.id)}
                  className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10"
                  style={{ color: "#ef4444" }}
                  aria-label="Supprimer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Formulaire modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={closeForm}
        >
          <div
            className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl p-6"
            style={{ background: COLORS.surface, borderColor: COLORS.borderGold }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base" style={{ color: COLORS.ivory }}>
                {editingProduct ? "Modifier le produit" : "Ajouter un produit"}
              </h3>
              <button
                onClick={closeForm}
                className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                style={{ color: COLORS.muted }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold mb-1 block" style={{ color: COLORS.ivory }}>
                  Nom du produit *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border text-sm outline-none transition-colors focus:border-amber-400/50"
                  style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold mb-1 block" style={{ color: COLORS.ivory }}>
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl border text-sm outline-none resize-none transition-colors focus:border-amber-400/50"
                  style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold mb-1 block" style={{ color: COLORS.ivory }}>
                    Prix *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border text-sm outline-none transition-colors focus:border-amber-400/50"
                    style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold mb-1 block" style={{ color: COLORS.ivory }}>
                    Stock
                  </label>
                  <input
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border text-sm outline-none transition-colors focus:border-amber-400/50"
                    style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold mb-1 block" style={{ color: COLORS.ivory }}>
                  URL de l'image
                </label>
                <input
                  type="url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-xl border text-sm outline-none transition-colors focus:border-amber-400/50"
                  style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_available"
                  checked={formData.is_available}
                  onChange={(e) => setFormData({ ...formData, is_available: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="is_available" className="text-xs" style={{ color: COLORS.ivory }}>
                  Produit disponible à la vente
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95"
                  style={{ borderColor: COLORS.border, color: COLORS.muted }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
                  style={{ background: COLORS.gold, color: COLORS.bg }}
                >
                  {saving ? (
                    <>
                      <Loader2 className="animate-spin" size={14} />
                      Enregistrement...
                    </>
                  ) : (
                    editingProduct ? "Modifier" : "Ajouter"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
