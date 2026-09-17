import { useEffect } from "react";
import { Routes, Route, useNavigate, useParams, Navigate } from "react-router-dom";
import { useApp } from "../contexts/AppContext.jsx";
import AuthScreen from "../features/auth/index.js";
import { MainShell } from "./MainShell.jsx";
import { LoadingScreen } from "./TabFallback.jsx";
import InvitePage from "../pages/InvitePage.jsx";
import { PrivacyPage } from "../components/PrivacyPage.jsx";

function InviteRouteGate() {
  const { code } = useParams();
  const { user, loading } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (!code) return;
    // Mémorise le code si pas encore connecté
    if (!loading && !user?.id) {
      try {
        localStorage.setItem("pending_invite_code", code);
      } catch {}
    }
  }, [code, user?.id, loading]);

  if (loading) return <LoadingScreen />;
  return <InvitePage />;
}

function PrivacyRoute() {
  const navigate = useNavigate();
  return <PrivacyPage onBack={() => navigate("/")} />;
}

function AppShell() {
  const { user, isGuest, loading } = useApp();
  const navigate = useNavigate();

  // Restaure l'invitation après login
  useEffect(() => {
    if (!loading && user?.id) {
      try {
        const pending = localStorage.getItem("pending_invite_code");
        if (pending) {
          localStorage.removeItem("pending_invite_code");
          navigate(`/invite/${pending}`, { replace: true });
        }
      } catch {}
    }
  }, [user?.id, loading, navigate]);

  if (loading) {
    return <LoadingScreen />;
  }

  const isRealUser = Boolean(user?.id && user.is_anonymous !== true);

  let guestOk = false;
  try {
    guestOk = sessionStorage.getItem("baaro_guest_ok") === "1";
  } catch {
    guestOk = false;
  }

  const isAnonymousAllowed = Boolean(user?.is_anonymous && guestOk);

  if (!isRealUser && !isGuest && !isAnonymousAllowed) {
    return <AuthScreen />;
  }

  return <MainShell />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/invite/:code" element={<InviteRouteGate />} />
      <Route path="/privacy" element={<PrivacyRoute />} />
      <Route path="/*" element={<AppShell />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
