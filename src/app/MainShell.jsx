import { useState, useEffect, Suspense } from "react";
import { useApp } from "../contexts/AppContext.jsx";
import { Header } from "../components/Header.jsx";
import { Navigation } from "../components/Navigation.jsx";
import ProfileModal from "../components/ProfileModal.jsx";
import { NotificationDrawer } from "../components/NotificationDrawer.jsx";
import { GlobalSearchModal } from "../components/GlobalSearchModal.jsx";
import { ErrorBoundary } from "../components/ErrorBoundary.jsx";
import { OnboardingModal } from "../features/profile/index.js";
import { useApplyPendingReferral } from "../hooks/useApplyPendingReferral.js";
import { useToast } from "../components/ToastContext.jsx";
import { COLORS } from "../theme.js";
import { tabs } from "./tabs.jsx";
import { TabFallback } from "./TabFallback.jsx";
import { OfflineBanner } from "../components/OfflineBanner.jsx";
import { saveLastTab, loadLastTab } from "../lib/perf.js";

const THEME_BG_MAP = {
  midnight: "#0B1220",
  oled: "#000000",
  emerald: "#061A14",
};

const WELCOME_TOAST_KEY = "baaro:welcome_toast_shown";

export function MainShell() {
  const {
    user,
    userProfile,
    pointsBalance,
    baroBalance,
    earnPoints,
    setUserProfile,
    isAnonymous,
  } = useApp();

  const { showToast, showPointsReward } = useToast();
  const id = user?.id; // SEULEMENT id, jamais userId

  useApplyPendingReferral({ showToast });

  const [activeTab, setActiveTab] = useState(() => loadLastTab("feed"));
  const [lang, setLang] = useState("fr");
  const [currentTheme, setCurrentTheme] = useState("midnight");
  
  // États des modales et de l'UI
  const [inspectingProfileId, setInspectingProfileId] = useState(null);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [forceOnboarding, setForceOnboarding] = useState(false);
  const [pulsePoints, setPulsePoints] = useState(false);

  useEffect(() => {
    if (!id) return;
    try { if (localStorage.getItem(WELCOME_TOAST_KEY)) return; } catch {}
    const timer = setTimeout(() => {
      try { localStorage.setItem(WELCOME_TOAST_KEY, "1"); } catch {}
      if (isAnonymous) {
        showToast("Bienvenue! Explore librement. Crée un compte pour gagner.", "info", 5500);
      } else if (pointsBalance > 0) {
        showPointsReward(pointsBalance >= 50 ? 50 : pointsBalance, "Bonus de bienvenue");
      } else {
        showToast("Bienvenue sur BAARO — like, publie et débat pour gagner.", "info", 4500);
      }
      setPulsePoints(true);
    }, 900);
    return () => clearTimeout(timer);
  }, [id, isAnonymous, pointsBalance, showToast, showPointsReward]);

  const themeBg = THEME_BG_MAP[currentTheme] || THEME_BG_MAP.midnight;

  useEffect(() => { saveLastTab(activeTab); }, [activeTab]);

  const isImmersive = activeTab === "videos";
  const Tab = tabs[activeTab] || null;

  // Tous les tabs reçoivent id, pas userId
  const tabProps = {
    feed: { id, onOpenProfile: setInspectingProfileId, onRewardPoints: earnPoints },
    friends: { id, onOpenProfile: setInspectingProfileId },
    community: { id, onOpenProfile: setInspectingProfileId },
    companies: { id, onOpenProfile: setInspectingProfileId },
    discover: {
      userId: id,
      onOpenPost: () => setActiveTab("feed"),
      onOpenLive: () => setActiveTab("debates"),
      onOpenProfile: setInspectingProfileId,
    },
    privacy: { onBack: () => setActiveTab("settings") },
    videos: { id, onRewardPoints: earnPoints, onExit: () => setActiveTab("feed") },
    messages: { id, onRewardPoints: earnPoints, onOpenProfile: setInspectingProfileId },
    wallet: { onNavigateToCrypto: () => setActiveTab("crypto") },
    crypto: {},
    debates: { id, currentUserId: id, onRewardPoints: earnPoints, onOpenProfile: setInspectingProfileId },
    offline: { onRewardPoints: earnPoints },
    assistant: { id, userProfile, pointsBalance, baroBalance, onRewardPoints: earnPoints },
    settings: {
      id,
      userProfile,
      setUserProfile,
      currentTheme,
      onSelectTheme: setCurrentTheme,
      onReplayOnboarding: () => setForceOnboarding(true),
      onOpenPrivacy: () => setActiveTab("privacy"),
    },
    // ShopTab attend userId ; on passe id + alias
    shop: { id, userId: id },
  };

  return (
    <div
      className="min-h-screen flex flex-col transition-colors duration-500"
      style={{ background: isImmersive ? "#000" : themeBg, color: COLORS.ivory }}
    >
      <OfflineBanner />
      <OnboardingModal forceOpen={forceOnboarding} onClose={() => setForceOnboarding(false)} />

      {!isImmersive && (
        <Header
          lang={lang}
          setLang={setLang}
          pointsBalance={pointsBalance}
          baroBalance={baroBalance}
          userProfile={userProfile}
          onOpenProfile={() => setInspectingProfileId(id)}
          onOpenNotifications={() => setNotifDrawerOpen(true)}
          onOpenSearch={() => setSearchModalOpen(true)}
          pulsePoints={pulsePoints}
        />
      )}

      {isImmersive ? (
        <main id="main-content" className="flex-1 relative" tabIndex={-1}>
          <ErrorBoundary>
            <Suspense fallback={<TabFallback />}>
              {Tab ? <Tab {...(tabProps[activeTab] || {})} /> : null}
            </Suspense>
          </ErrorBoundary>
        </main>
      ) : (
        <div className="max-w-7xl mx-auto w-full px-3 sm:px-6 pt-4 sm:pt-6 flex-1 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-1">
            <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
          </div>
          <main id="main-content" className="md:col-span-3 mobile-nav-spacer" tabIndex={-1}>
            <ErrorBoundary>
              <Suspense fallback={<TabFallback />}>
                {Tab ? <Tab {...(tabProps[activeTab] || {})} /> : null}
              </Suspense>
            </ErrorBoundary>
          </main>
        </div>
      )}

      {isImmersive && <div className="md:hidden"><Navigation activeTab={activeTab} setActiveTab={setActiveTab} /></div>}

      {/* Modale de consultation de profil */}
      {inspectingProfileId && (
        <ProfileModal
          id={inspectingProfileId}
          currentId={id}
          onClose={() => setInspectingProfileId(null)}
          onNavigateToMessages={() => setActiveTab("messages")}
          // ✅ Redirige proprement vers l'onglet Paramètres au lieu d'ouvrir une modale inexistante
          onOpenSettings={() => {
            setInspectingProfileId(null);
            setActiveTab("settings");
          }}
        />
      )}

      <NotificationDrawer 
        isOpen={notifDrawerOpen} 
        onClose={() => setNotifDrawerOpen(false)} 
        id={id} 
      />
      
      <GlobalSearchModal 
        isOpen={searchModalOpen} 
        onClose={() => setSearchModalOpen(false)} 
        onSelectUser={(profileId) => setInspectingProfileId(profileId)} 
        onSelectTab={(tabId) => setActiveTab(tabId)}
        // ✅ Permet à la recherche globale d'ouvrir une boutique spécifique
        onSelectShop={(shopId) => {
          setActiveTab("shop");
          // Note : Si ton composant Shop a besoin de l'ID de la boutique pour l'ouvrir directement,
          // tu peux le stocker dans un état global ou le passer via un contexte ici.
        }}
      />
    </div>
  );
}
