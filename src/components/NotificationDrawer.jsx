import { useState, useEffect, useCallback } from "react";
import { Bell, CheckCheck, Trash2, X, Coins, Heart, MessageSquare, Award, Sparkles, UserPlus, BarChart2 } from "lucide-react";
import { COLORS } from "../theme.js";
import { supabase } from "../supabaseClient.js";

// Icônes et couleurs selon le type de notification
const NOTIF_STYLES = {
  reaction: { icon: Heart, color: "#EC4899", title: "Nouvelle réaction" },
  comment: { icon: MessageSquare, color: "#8B5CF6", title: "Nouveau commentaire" },
  follow: { icon: UserPlus, color: "#2DBFA6", title: "Nouvel abonné" },
  poll_vote: { icon: BarChart2, color: "#D9AE52", title: "Nouveau vote" },
  reward: { icon: Coins, color: "#D9AE52", title: "Points gagnés" },
  badge: { icon: Award, color: "#D9AE52", title: "Badge débloqué" },
  general: { icon: Sparkles, color: "#2DBFA6", title: "Notification" },
};

export function NotificationDrawer({ isOpen, onClose, userId }) {
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(false);

  // Charger les notifications depuis la base
  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("notifications")
      .select("id, type, message, source_id, actor_id, read, created_at")
      .eq("id", userId) // Convention : id = auth.users.id
      .order("created_at", { ascending: false })
      .limit(30);
    
    if (!error) {
      setItems(data || []);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  // ⚡ Realtime : nouvelles notifications instantanées
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notif-drawer-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `id=eq.${userId}` },
        (payload) => {
          setNotifs((prev) => [payload.new, ...prev].slice(0, 30));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `id=eq.${userId}` },
        () => { load(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, load]);

  const markAllRead = async () => {
    if (!userId) return;
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", userId)
      .eq("read", false);
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAll = async () => {
    if (!userId) return;
    await supabase
      .from("notifications")
      .delete()
      .eq("id", userId);
    setNotifs([]);
  };

  const deleteOne = async (notif) => {
    if (!userId) return;
    await supabase
      .from("notifications")
      .delete()
      .eq("id", userId)
      .eq("created_at", notif.created_at);
    setNotifs((prev) => prev.filter((n) => n.created_at !== notif.created_at));
  };

  const unreadCount = notifs.filter((n) => !n.read).length;

  const formatTime = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return "À l'instant";
    if (min < 60) return `Il y a ${min}min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `Il y a ${h}h`;
    const d = Math.floor(h / 24);
    return `Il y a ${d}j`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm h-full glass-card border-l shadow-2xl p-5 flex flex-col justify-between"
        style={{ borderColor: COLORS.borderGold, background: COLORS.surface }}
      >
        {/* Header */}
        <div>
          <div className="flex items-center justify-between pb-4 border-b" style={{ borderColor: COLORS.border }}>
            <div className="flex items-center gap-2">
              <Bell size={20} style={{ color: COLORS.gold }} />
              <h3 className="text-base font-bold" style={{ color: COLORS.ivory }}>Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: COLORS.teal, color: COLORS.bg }}>
                  {unreadCount} nouvelles
                </span>
              )}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg border hover:bg-white/5" style={{ borderColor: COLORS.border, color: COLORS.ivory }}>
              <X size={16} />
            </button>
          </div>

          {/* Quick Actions */}
          <div className="flex justify-between items-center py-2.5 text-xs font-semibold" style={{ color: COLORS.muted }}>
            <button onClick={markAllRead} disabled={unreadCount === 0} className="flex items-center gap-1 hover:text-amber-400 transition disabled:opacity-40">
              <CheckCheck size={14} />
              <span>Tout marquer lu</span>
            </button>
            <button onClick={clearAll} disabled={notifs.length === 0} className="flex items-center gap-1 hover:text-rose-400 transition disabled:opacity-40">
              <Trash2 size={14} />
              <span>Effacer</span>
            </button>
          </div>

          {/* Notifications Log */}
          <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[72vh] pr-1">
            {loading && <div className="text-xs text-center py-10" style={{ color: COLORS.muted }}>Chargement…</div>}
            {!loading && notifs.length === 0 ? (
              <div className="text-xs text-center py-10" style={{ color: COLORS.muted }}>
                Aucune notification pour le moment.
              </div>
            ) : (
              notifs.map((n) => {
                const style = NOTIF_STYLES[n.type] || NOTIF_STYLES.general;
                const Icon = style.icon;
                return (
                  <div
                    key={n.created_at}
                    className={`p-3 rounded-2xl border flex items-start gap-3 transition relative ${!n.read ? "gold-glow" : ""}`}
                    style={{
                      background: !n.read ? COLORS.surface2 : COLORS.bg,
                      borderColor: !n.read ? COLORS.borderGold : COLORS.border
                    }}
                  >
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${style.color}20`, color: style.color }}>
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold truncate" style={{ color: COLORS.ivory }}>
                          {style.title}
                        </span>
                        <span className="text-[9px]" style={{ color: COLORS.muted }}>
                          {formatTime(n.created_at)}
                        </span>
                      </div>
                      <p className="text-[11px] mt-0.5 leading-snug" style={{ color: COLORS.muted }}>
                        {n.message}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteOne(n)}
                      className="absolute top-2 right-2 p-1 opacity-40 hover:opacity-100 transition"
                      style={{ color: COLORS.muted }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t text-[11px] text-center" style={{ borderColor: COLORS.border, color: COLORS.muted }}>
          BAARO Realtime Push Engine v2.0
        </div>
      </div>
    </div>
  );
}
