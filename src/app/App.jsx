import { useApp } from "../contexts/AppContext.jsx";
import AuthScreen from "../features/auth/index.js";
import { MainShell } from "./MainShell.jsx";
import { LoadingScreen } from "./TabFallback.jsx";

/**
 * Point d'entrée principal de BAARO.
 *
 * - Chargement        -> LoadingScreen
 * - Utilisateur connecté -> MainShell
 * - Mode invité       -> MainShell
 * - Aucun accès       -> AuthScreen
 */
export default function App() {
  const { session, isGuest, loading } = useApp();

  if (loading) {
    return <LoadingScreen />;
  }

  /**
   * Un utilisateur peut entrer de deux façons :
   *
   * 1. avec une session Supabase ;
   * 2. comme invité.
   *
   * Dans les deux cas, on affiche l'application.
   */
  if (!session && !isGuest) {
    return <AuthScreen />;
  }

  return <MainShell />;
}
