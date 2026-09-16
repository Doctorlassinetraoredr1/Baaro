import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../contexts/AppContext.jsx";
import AuthScreen from "../features/auth/index.js";
import { MainShell } from "./MainShell.jsx";
import { LoadingScreen } from "./TabFallback.jsx";

export default function App() {
  const { user, isGuest, loading } = useApp();
  const navigate = useNavigate();

  // Restaure l'invitation après login (ton système /invite/:code)
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

  // user.id = profiles.id (jamais user_id)
  const isRealUser = Boolean(user?.id && user.is_anonymous !== true);

  let guestOk = false;
  try {
    guestOk = sessionStorage.getItem("baaro_guest_ok") === "1";
  } catch {
    guestOk = false;
  }

  const isAnonymousAllowed = Boolean(user?.is_anonymous && guestOk);

  // Pas connecté et pas invité en mode guest -> Auth
  if (!isRealUser && !isGuest && !isAnonymousAllowed) {
    return <AuthScreen />;
  }

  // Connecté ou guest autorisé -> App principale
  // MainShell contient déjà toutes tes routes dont /invite/:code et /community
  return <MainShell />;
}
