import { useEffect, useState, useCallback } from "react";
import { Package, Clock, CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { COLORS } from "../../../theme.js";
import { fetchBuyerOrders } from "../../../services/shopApi.js";

// Helper pour styliser les badges de statut
const getStatusStyle = (status) => {
  const s = status?.toLowerCase() || "";
  if (s.includes("completed") || s.includes("livré")) {
    return { bg: "rgba(45, 191, 166, 0.15)", color: COLORS.teal, icon: CheckCircle };
  }
  if (s.includes("cancelled") || s.includes("annulé")) {
    return { bg: "rgba(239, 68, 68, 0.15)", color: "#ef4444", icon: XCircle };
  }
  if (s.includes("pending") || s.includes("attente") || s.includes("processing")) {
    return { bg: "rgba(217, 174, 82, 0.15)", color: COLORS.gold, icon: Clock };
  }
  return { bg: "rgba(255, 255, 255, 0.1)", color: COLORS.muted, icon: AlertCircle };
};

export default function OrdersBuyer({ userId }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchBuyerOrders(userId);
      setOrders(data || []);
    } catch (e) {
      console.error("Erreur chargement commandes:", e);
      setError(e.message || "Impossible de charger les commandes.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 className="animate-spin" size={32} style={{ color: COLORS.gold }} />
        <p className="text-sm" style={{ color: COLORS.muted }}>Chargement de vos commandes…</p>
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
        <Package size={48} style={{ color: COLORS.muted, opacity: 0.3 }} />
        <p className="text-sm font-semibold" style={{ color: COLORS.ivory }}>Aucune commande pour le moment</p>
        <p className="text-xs" style={{ color: COLORS.muted }}>Vos achats apparaîtront ici.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {orders.map((o) => {
        const statusStyle = getStatusStyle(o.status);
        const StatusIcon = statusStyle.icon;
        
        return (
          <div 
            key={o.id} 
            className="rounded-xl border p-4 transition-all hover:border-amber-400/30" 
            style={{ background: COLORS.surface, borderColor: COLORS.border }}
          >
            {/* En-tête : Boutique et Statut */}
            <div className="flex justify-between items-start gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm truncate" style={{ color: COLORS.ivory }}>
                  {o.shops?.name || "Boutique"}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: COLORS.muted }}>
                  {new Date(o.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                  {" · "}
                  {o.method === "pickup" ? "Retrait en boutique" : "Livraison"}
                </p>
              </div>
              <div 
                className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold flex-shrink-0"
                style={{ background: statusStyle.bg, color: statusStyle.color }}
              >
                <StatusIcon size={12} />
                <span className="capitalize">{o.status || "Inconnu"}</span>
              </div>
            </div>

            {/* Liste des articles */}
            {o.order_items?.length > 0 && (
              <div className="mt-3 pt-3 border-t" style={{ borderColor: COLORS.border }}>
                <div className="flex flex-wrap gap-1.5">
                  {o.order_items.map((i, idx) => (
                    <span 
                      key={idx} 
                      className="text-xs px-2 py-1 rounded-md"
                      style={{ background: COLORS.surface2, color: COLORS.muted }}
                    >
                      {i.name} × {i.quantity}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Pied de carte : Total et Code de retrait */}
            <div className="mt-3 flex items-center justify-between">
              <div className="text-sm font-bold" style={{ color: COLORS.gold }}>
                {Number(o.total_amount || 0).toFixed(2)} {o.currency || "XOF"}
              </div>
              
              {o.pickup_code && (o.status?.toLowerCase().includes("completed") || o.status?.toLowerCase().includes("livré")) && (
                <div className="text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1" style={{ background: COLORS.gold, color: COLORS.bg }}>
                  <Package size={12} />
                  Code : {o.pickup_code}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
