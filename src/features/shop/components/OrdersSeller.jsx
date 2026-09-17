import { useEffect, useState, useCallback } from "react";
import { 
  Package, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Loader2, 
  ShoppingBag, 
  Truck,
  Copy,
  Check
} from "lucide-react";
import { COLORS } from "../../../theme.js";
import { fetchSellerOrders, updateOrderStatus } from "../../../services/shopApi.js";
import { useToast } from "../../../components/ToastContext.jsx";

// Configuration des statuts avec icônes et couleurs
const STATUS_CONFIG = {
  pending: { 
    label: "En attente", 
    icon: Clock, 
    bg: "rgba(217, 174, 82, 0.15)", 
    color: COLORS.gold 
  },
  confirmed: { 
    label: "Confirmée", 
    icon: CheckCircle, 
    bg: "rgba(45, 191, 166, 0.15)", 
    color: COLORS.teal 
  },
  ready: { 
    label: "Prête", 
    icon: Package, 
    bg: "rgba(59, 130, 246, 0.15)", 
    color: "#3b82f6" 
  },
  completed: { 
    label: "Terminée", 
    icon: CheckCircle, 
    bg: "rgba(45, 191, 166, 0.2)", 
    color: COLORS.teal 
  },
  cancelled: { 
    label: "Annulée", 
    icon: XCircle, 
    bg: "rgba(239, 68, 68, 0.15)", 
    color: "#ef4444" 
  },
};

// Actions disponibles selon le statut actuel
const getNextActions = (currentStatus) => {
  const flow = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["ready", "cancelled"],
    ready: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
  };
  return flow[currentStatus] || [];
};

export default function OrdersSeller({ shopId }) {
  const { showToast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchSellerOrders(shopId);
      setOrders(data || []);
    } catch (e) {
      console.error("Erreur chargement commandes vendeur:", e);
      setError(e.message || "Impossible de charger les commandes.");
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    load();
  }, [load]);

  const changeStatus = async (orderId, newStatus) => {
    setUpdatingId(orderId);
    try {
      await updateOrderStatus(orderId, newStatus);
      await load();
      showToast(
        `Commande mise à jour : ${STATUS_CONFIG[newStatus]?.label || newStatus}`,
        "success"
      );
    } catch (e) {
      console.error("Erreur mise à jour statut:", e);
      showToast(e.message || "Mise à jour impossible.", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  const copyPickupCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      showToast("Code copié !", "success");
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      showToast("Copie impossible", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 className="animate-spin" size={32} style={{ color: COLORS.gold }} />
        <p className="text-sm" style={{ color: COLORS.muted }}>Chargement des commandes…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <AlertCircle size={32} style={{ color: "#ef4444" }} />
        <p className="text-sm" style={{ color: "#ef4444" }}>{error}</p>
        <button
          onClick={load}
          className="px-4 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95"
          style={{ borderColor: COLORS.border, color: COLORS.ivory }}
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (!orders.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <ShoppingBag size={48} style={{ color: COLORS.muted, opacity: 0.3 }} />
        <p className="text-sm font-semibold" style={{ color: COLORS.ivory }}>Aucune commande reçue</p>
        <p className="text-xs" style={{ color: COLORS.muted }}>Les nouvelles commandes apparaîtront ici.</p>
      </div>
    );
  }

  // Statistiques rapides
  const pendingCount = orders.filter(o => o.status === "pending").length;
  const readyCount = orders.filter(o => o.status === "ready").length;

  return (
    <div className="flex flex-col gap-4">
      {/* Stats rapides */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border p-3" style={{ background: COLORS.surface, borderColor: COLORS.border }}>
          <div className="flex items-center gap-2 mb-1">
            <Clock size={14} style={{ color: COLORS.gold }} />
            <span className="text-xs" style={{ color: COLORS.muted }}>En attente</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: COLORS.gold }}>{pendingCount}</p>
        </div>
        <div className="rounded-xl border p-3" style={{ background: COLORS.surface, borderColor: COLORS.border }}>
          <div className="flex items-center gap-2 mb-1">
            <Package size={14} style={{ color: "#3b82f6" }} />
            <span className="text-xs" style={{ color: COLORS.muted }}>Prêtes</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: "#3b82f6" }}>{readyCount}</p>
        </div>
      </div>

      {/* Liste des commandes */}
      <div className="grid gap-3">
        {orders.map((o) => {
          const statusCfg = STATUS_CONFIG[o.status] || STATUS_CONFIG.pending;
          const StatusIcon = statusCfg.icon;
          const actions = getNextActions(o.status);
          const isUpdating = updatingId === o.id;

          return (
            <div
              key={o.id}
              className="rounded-xl border p-4 transition-all"
              style={{ 
                background: COLORS.surface, 
                borderColor: o.status === "pending" ? COLORS.borderGold : COLORS.border 
              }}
            >
              {/* Header : Numéro + Statut */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold" style={{ color: COLORS.ivory }}>
                      #{o.id.slice(0, 8)}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: COLORS.muted, background: COLORS.surface2 }}>
                      {o.method === "pickup" ? (
                        <span className="flex items-center gap-1"><Package size={10} /> Retrait</span>
                      ) : (
                        <span className="flex items-center gap-1"><Truck size={10} /> Livraison</span>
                      )}
                    </span>
                  </div>
                  <p className="text-[10px]" style={{ color: COLORS.muted }}>
                    {new Date(o.created_at).toLocaleString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </p>
                </div>

                {/* Badge de statut */}
                <div
                  className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold flex-shrink-0"
                  style={{ background: statusCfg.bg, color: statusCfg.color }}
                >
                  <StatusIcon size={12} />
                  <span>{statusCfg.label}</span>
                </div>
              </div>

              {/* Articles */}
              {o.order_items?.length > 0 && (
                <div className="mb-3 p-2 rounded-lg" style={{ background: COLORS.surface2 }}>
                  <div className="flex flex-wrap gap-1.5">
                    {o.order_items.map((i, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2 py-1 rounded-md"
                        style={{ background: COLORS.bg, color: COLORS.muted }}
                      >
                        {i.name} × {i.quantity}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Code de retrait */}
              {o.pickup_code && (
                <button
                  onClick={() => copyPickupCode(o.pickup_code)}
                  className="w-full flex items-center justify-between gap-2 mb-3 p-2 rounded-lg border transition-all active:scale-[0.98]"
                  style={{ 
                    background: "rgba(217, 174, 82, 0.1)", 
                    borderColor: COLORS.borderGold 
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Copy size={14} style={{ color: COLORS.gold }} />
                    <span className="text-xs" style={{ color: COLORS.muted }}>Code :</span>
                    <span className="text-sm font-bold" style={{ color: COLORS.gold }}>
                      {o.pickup_code}
                    </span>
                  </div>
                  {copiedCode === o.pickup_code ? (
                    <Check size={14} style={{ color: COLORS.teal }} />
                  ) : (
                    <span className="text-[10px]" style={{ color: COLORS.muted }}>Copier</span>
                  )}
                </button>
              )}

              {/* Total */}
              <div className="flex items-center justify-between mb-3 pb-3 border-b" style={{ borderColor: COLORS.border }}>
                <span className="text-xs" style={{ color: COLORS.muted }}>Total</span>
                <span className="text-lg font-bold" style={{ color: COLORS.gold }}>
                  {Number(o.total_amount || 0).toFixed(2)} {o.currency}
                </span>
              </div>

              {/* Actions rapides */}
              {actions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {actions.map((action) => {
                    const actionCfg = STATUS_CONFIG[action];
                    const ActionIcon = actionCfg.icon;
                    return (
                      <button
                        key={action}
                        onClick={() => changeStatus(o.id, action)}
                        disabled={isUpdating}
                        className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ 
                          background: actionCfg.bg, 
                          color: actionCfg.color,
                          border: `1px solid ${actionCfg.color}40`
                        }}
                      >
                        {isUpdating ? (
                          <Loader2 className="animate-spin" size={12} />
                        ) : (
                          <ActionIcon size={12} />
                        )}
                        {actionCfg.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-2">
                  <span className="text-xs italic" style={{ color: COLORS.muted }}>
                    {o.status === "completed" ? "✓ Commande finalisée" : "Aucune action disponible"}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
