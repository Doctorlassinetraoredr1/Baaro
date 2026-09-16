import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, ShoppingBag, Truck, Store } from "lucide-react";
import { COLORS } from "../../../theme.js";
import { createOrder } from "../../../services/shopApi.js";
import { createPayment, getAvailableProviders } from "../../../lib/paymentProvider.js";
import { useToast } from "../../../components/ToastContext.jsx";

export default function OrderCheckout({ shop, userId, items, onBack, onDone }) {
  const { showToast } = useToast();
  const [method, setMethod] = useState("pickup");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [providers, setProviders] = useState([]);
  const [providerId, setProviderId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const totalHint = items.reduce(
    (sum, x) => sum + Number(x.unitPrice || 0) * Number(x.quantity || 0),
    0
  );
  const currency = items[0]?.currency || shop?.currency || "XOF";
  const totalItems = items.reduce((sum, x) => sum + Number(x.quantity || 0), 0);

  useEffect(() => {
    const country = shop?.country || "ML";
    const available = getAvailableProviders(country).filter((p) => p.enabled !== false);
    setProviders(available);
    setProviderId(available[0]?.id || "");
  }, [shop?.country]);

  async function submit(e) {
    e.preventDefault();
    if (!userId || !items.length || !shop?.id) {
      showToast("Informations de commande incomplètes", "error");
      return;
    }
    if (method === "delivery" && !address.trim()) {
      setError("L'adresse de livraison est obligatoire.");
      return;
    }
    if (!providerId) {
      setError("Choisis un moyen de paiement.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      // ✅ Convention : on utilise 'buyer_id' (rôle spécifique) mais on s'assure que c'est bien l'id de l'utilisateur
      const order = await createOrder({
        shopId: shop.id,
        buyerId: userId,
        items,
        method,
        notes: notes.trim() || null,
        dropoffAddress: method === "delivery" ? address.trim() : null,
      });

      const paymentRef = `order_${order.id}_${Date.now()}`;
      const provider = providers.find((p) => p.id === providerId);
      const payment = await createPayment({
        provider: providerId,
        shopId: shop.id,
        orderId: order.id,
        paymentRef,
        amount: Number(order.total_amount),
        currency: order.currency || currency,
        paymentType: "order",
        channel: provider?.channels?.[0],
      });

      showToast("Commande créée avec succès !", "success");
      onDone?.(order, payment);
      
      if (payment?.payment_url) {
        window.location.href = payment.payment_url;
      } else {
        setError("Commande créée, mais le lien de paiement est indisponible. Réessaie depuis tes commandes.");
      }
    } catch (err) {
      console.error("Erreur checkout:", err);
      setError(err.message || "Impossible de créer ou payer la commande.");
      showToast("Erreur lors de la commande", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto flex max-w-lg flex-col gap-4 pb-8">
      {/* Bouton retour */}
      <button 
        type="button" 
        onClick={onBack} 
        className="flex items-center gap-2 text-sm font-semibold transition-colors hover:opacity-80 w-fit"
        style={{ color: COLORS.ivory }}
      >
        <ArrowLeft size={16} /> Retour au panier
      </button>

      <h2 className="text-lg font-bold" style={{ color: COLORS.ivory }}>
        Finaliser la commande
      </h2>

      {/* Récapitulatif des articles */}
      <div className="rounded-xl border p-4" style={{ background: COLORS.surface, borderColor: COLORS.border }}>
        <div className="flex items-center gap-2 mb-3 pb-2 border-b" style={{ borderColor: COLORS.border }}>
          <ShoppingBag size={16} style={{ color: COLORS.gold }} />
          <span className="text-xs font-bold" style={{ color: COLORS.ivory }}>
            {totalItems} article{totalItems > 1 ? 's' : ''}
          </span>
        </div>
        
        {items.map((x) => (
          <div key={x.productId} className="flex justify-between py-2 text-sm border-b last:border-0" style={{ borderColor: `${COLORS.border}40` }}>
            <span className="flex-1 truncate pr-2" style={{ color: COLORS.ivory }}>
              {x.name} <span style={{ color: COLORS.muted }}>× {x.quantity}</span>
            </span>
            <span className="font-semibold" style={{ color: COLORS.gold }}>
              {(Number(x.unitPrice) * Number(x.quantity)).toFixed(2)} {x.currency}
            </span>
          </div>
        ))}
        
        <div className="mt-3 flex justify-between pt-3 border-t font-bold" style={{ borderColor: COLORS.border }}>
          <span style={{ color: COLORS.ivory }}>Total</span>
          <span className="text-lg" style={{ color: COLORS.gold }}>
            {totalHint.toFixed(2)} {currency}
          </span>
        </div>
        <p className="mt-2 text-[11px]" style={{ color: COLORS.muted }}>
          Le montant final est recalculé et contrôlé côté serveur.
        </p>
      </div>

      {/* Mode de livraison */}
      <div className="space-y-2">
        <label className="text-xs font-bold" style={{ color: COLORS.ivory }}>Mode de réception</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMethod("pickup")}
            className="flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-bold transition-all active:scale-95"
            style={{
              background: method === "pickup" ? "rgba(217, 174, 82, 0.1)" : COLORS.surface2,
              borderColor: method === "pickup" ? COLORS.borderGold : COLORS.border,
              color: method === "pickup" ? COLORS.gold : COLORS.muted
            }}
          >
            <Store size={16} /> Retrait
          </button>
          <button
            type="button"
            onClick={() => setMethod("delivery")}
            className="flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-bold transition-all active:scale-95"
            style={{
              background: method === "delivery" ? "rgba(217, 174, 82, 0.1)" : COLORS.surface2,
              borderColor: method === "delivery" ? COLORS.borderGold : COLORS.border,
              color: method === "delivery" ? COLORS.gold : COLORS.muted
            }}
          >
            <Truck size={16} /> Livraison
          </button>
        </div>
      </div>

      {/* Adresse de livraison (conditionnel) */}
      {method === "delivery" && (
        <div className="space-y-1">
          <label className="text-xs font-bold" style={{ color: COLORS.ivory }}>Adresse de livraison *</label>
          <textarea 
            required 
            value={address} 
            onChange={(e) => setAddress(e.target.value)} 
            placeholder="Quartier, rue, point de repère..." 
            rows={3} 
            className="w-full rounded-xl border px-3 py-2 text-sm outline-none resize-none transition-colors focus:border-amber-400/50"
            style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }}
          />
        </div>
      )}

      {/* Moyen de paiement */}
      <div className="space-y-1">
        <label className="text-xs font-bold" style={{ color: COLORS.ivory }}>Moyen de paiement</label>
        <select 
          value={providerId} 
          onChange={(e) => setProviderId(e.target.value)} 
          className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:border-amber-400/50"
          style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }}
        >
          {providers.map((p) => (
            <option key={p.id} value={p.id} style={{ background: COLORS.surface, color: COLORS.ivory }}>
              {p.icon || "💳"} {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* Note pour le vendeur */}
      <div className="space-y-1">
        <label className="text-xs font-bold" style={{ color: COLORS.ivory }}>Note pour le vendeur (optionnel)</label>
        <textarea 
          value={notes} 
          onChange={(e) => setNotes(e.target.value)} 
          placeholder="Ex: Emballez bien, appelez avant de livrer..." 
          rows={2} 
          className="w-full rounded-xl border px-3 py-2 text-sm outline-none resize-none transition-colors focus:border-amber-400/50"
          style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }}
        />
      </div>

      {/* Message d'erreur */}
      {error && (
        <div className="rounded-xl border p-3 text-sm" style={{ background: "rgba(239, 68, 68, 0.1)", borderColor: "#ef4444", color: "#ef4444" }}>
          {error}
        </div>
      )}

      {/* Bouton de soumission */}
      <button 
        type="submit" 
        disabled={saving} 
        className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: COLORS.gold, color: COLORS.bg }}
      >
        {saving ? (
          <>
            <Loader2 className="animate-spin" size={16} />
            Préparation du paiement…
          </>
        ) : (
          <>
            <ShoppingBag size={16} />
            Payer {totalHint.toFixed(2)} {currency}
          </>
        )}
      </button>
    </form>
  );
}
