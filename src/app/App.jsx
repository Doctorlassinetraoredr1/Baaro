import { useApp } from "../contexts/AppContext.jsx";
import AuthScreen from "../features/auth/index.js";
import { MainShell } from "./MainShell.jsx";
import { LoadingScreen } from "./TabFallback.jsx";

export default function App() {
  const { user, isGuest, loading } = useApp();

  if (loading) {
    return <LoadingScreen />;
  }

  // Utilisateur connecté OU mode invité
  if (!user && !isGuest) {
    return <AuthScreen />;
  }

  return <MainShell />;
}
