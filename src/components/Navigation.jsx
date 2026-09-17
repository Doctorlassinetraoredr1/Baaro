import { useState } from "react";
import { useTranslation } from "react-i18next";
import { 
  Home, 
  Video, 
  MessageSquare, 
  Wallet, 
  Users, 
  TrendingUp, 
  WifiOff, 
  Sparkles, 
  Settings, 
  Building2, 
  Coins,
  Compass,
  X,
  Menu
} from "lucide-react";
import { useApp } from "../contexts/AppContext.jsx";
import { COLORS } from "../theme.js";

const MAIN_ITEMS = [
  { id: "feed", label: "Fil", icon: Home, badge: null },
  { id: "videos", label: "Vidéos", icon: Video, badge: null },
  { id: "messages", label: "Chat", icon: MessageSquare, badge: null },
  { id: "debates", label: "Débats", icon: TrendingUp, badge: null },
  { id: "shop", label: "Shop", icon: Building2, badge: null },
];

const MORE_ITEMS = [
  { id: "discover", label: "Découvrir", icon: Compass, badge: null },
  { id: "companies", label: "Entreprises", icon: Building2, badge: null },
  { id: "community", label: "Communauté", icon: Users, badge: null },
  { id: "friends", label: "Amis", icon: Users, badge: null },
  { id: "crypto", label: "BARO", icon: Coins, badge: "PRO" },
  { id: "wallet", label: "Portefeuille", icon: Wallet, badge: null },
  { id: "offline", label: "Hors-ligne", icon: WifiOff, badge: "P2P" },
  { id: "assistant", label: "IA Assistant", icon: Sparkles, badge: null },
  { id: "settings", label: "Réglages", icon: Settings, badge: null },
];

export function Navigation({ activeTab, setActiveTab }) {
  const { t } = useTranslation();
  const [moreOpen, setMoreOpen] = useState(false);
  const { user, isGuest } = useApp();

  const goTo = (id) => {
    setActiveTab(id);
    setMoreOpen(false);
  };

  const activeItem = [...MAIN_ITEMS, ...MORE_ITEMS].find(item => item.id === activeTab);

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden md:flex flex-col gap-2 p-4" style={{ background: COLORS.surface }}>
        {MAIN_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => goTo(item.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                isActive ? "bg-white/10" : "hover:bg-white/5"
              }`}
              style={{ color: isActive ? COLORS.gold : COLORS.ivory }}
            >
              <Icon size={20} />
              <span className="font-medium text-sm">{t(`nav.${item.id}`, item.label)}</span>
              {item.badge && (
                <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full" style={{ background: COLORS.gold, color: COLORS.bg }}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
        
        <div className="border-t my-2" style={{ borderColor: COLORS.border }} />
        
        <button
          onClick={() => setMoreOpen(true)}
          className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-all"
          style={{ color: COLORS.muted }}
        >
          <Menu size={20} />
          <span className="font-medium text-sm">{t("nav.more", "Plus")}</span>
        </button>
      </nav>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t z-50" style={{ background: COLORS.surface, borderColor: COLORS.border }}>
        <div className="flex items-center justify-around p-2">
          {MAIN_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => goTo(item.id)}
                className="flex flex-col items-center gap-1 p-2 rounded-lg transition-all"
                style={{ color: isActive ? COLORS.gold : COLORS.muted }}
              >
                <Icon size={20} />
                <span className="text-[10px] font-medium">{t(`nav.${item.id}`, item.label)}</span>
              </button>
            );
          })}
          
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center gap-1 p-2 rounded-lg transition-all"
            style={{ color: activeTab === "plus" ? COLORS.gold : COLORS.muted }}
          >
            <Menu size={20} />
            <span className="text-[10px] font-medium">{t("nav.more", "Plus")}</span>
          </button>
        </div>
      </nav>

      {/* Menu Plus (mobile) */}
      {moreOpen && (
        <div
          className="md:hidden fixed inset-0 z-[60] flex flex-col justify-end"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="rounded-t-3xl border-t p-4 pb-8"
            style={{
              background: COLORS.surface || "#111A2C",
              borderColor: COLORS.borderGold,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm" style={{ color: COLORS.ivory }}>
                {t("nav.more", "Plus")}
              </h3>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="p-2 rounded-full"
                style={{ color: COLORS.muted }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {MORE_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => goTo(item.id)}
                    className="flex flex-col items-center gap-2 p-3 rounded-2xl border transition"
                    style={{
                      background: isActive
                        ? "rgba(217,174,82,0.15)"
                        : "rgba(255,255,255,0.03)",
                      borderColor: isActive
                        ? COLORS.borderGold
                        : COLORS.border,
                      color: isActive ? COLORS.gold : COLORS.ivory,
                    }}
                  >
                    <Icon size={22} />
                    <span className="text-[11px] font-medium text-center leading-tight">
                      {t(`nav.${item.id}`, item.label)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
