import { useApp } from "../contexts/AppContext.jsx";
import AuthScreen from "../features/auth/index.js";
import { MainShell } from "./MainShell.jsx";
import { LoadingScreen } from "./TabFallback.jsx";

export default function App() {
  const { user, isGuest, loading } = useApp();

  if (loading) {
    return <LoadingScreen />;
  }

  // Compte réel uniquement, ou invité après clic explicite (isGuest / guest_ok).
  // Une session anonyme restaurée sans flag ne doit PAS ouvrir l'app.
  const isRealUser = Boolean(user && user.is_anonymous !== true);
  let guestOk = false;
  try {
    guestOk = sessionStorage.getItem("baaro_guest_ok") === "1";
  } catch {}
  const isAnonymousAllowed =
    Boolean(user?.is_anonymous) && guestOk;

  if (!isRealUser && !isGuest && !isAnonymousAllowed) {
    return <AuthScreen />;
  }

  return <MainShell />;
}
