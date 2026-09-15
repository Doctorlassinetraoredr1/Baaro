import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { supabase } from "../supabaseClient";

const AppContext = createContext(null);

const GUEST_KEY = "baaro_is_guest";

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isGuest, setIsGuest] = useState(() => {
    try {
      return localStorage.getItem(GUEST_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (id) => {
    if (!id) {
      setProfile(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Erreur chargement profil :", error);
        setProfile(null);
        return;
      }

      setProfile(data);
    } catch (error) {
      console.error("Erreur chargement profil :", error);
      setProfile(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("Erreur récupération session :", error);
        }

        if (!mounted) return;

        if (session?.user) {
          setUser(session.user);
          setIsGuest(false);

          try {
            localStorage.setItem(GUEST_KEY, "false");
          } catch {
            // localStorage indisponible : on continue normalement
          }

          await fetchUserProfile(session.user.id);
        } else {
          let storedGuest = false;

          try {
            storedGuest = localStorage.getItem(GUEST_KEY) === "true";
          } catch {
            storedGuest = false;
          }

          setIsGuest(storedGuest);
          setUser(null);
          setProfile(null);
        }
      } catch (error) {
        console.error("Erreur initialisation authentification :", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (session?.user) {
        setUser(session.user);
        setIsGuest(false);

        try {
          localStorage.setItem(GUEST_KEY, "false");
        } catch {
          // localStorage indisponible : on continue normalement
        }

        await fetchUserProfile(session.user.id);
      } else if (
        event === "SIGNED_OUT" ||
        event === "INITIAL_SESSION"
      ) {
        setUser(null);
        setProfile(null);

        let storedGuest = false;

        try {
          storedGuest = localStorage.getItem(GUEST_KEY) === "true";
        } catch {
          storedGuest = false;
        }

        setIsGuest(storedGuest);
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  /**
   * Active le mode invité.
   *
   * Aucun compte Supabase n'est créé.
   * Le mode invité est conservé localement.
   */
  const enableGuestMode = () => {
    try {
      localStorage.setItem(GUEST_KEY, "true");
    } catch {
      // Le mode invité fonctionne quand même pendant cette session.
    }

    setIsGuest(true);
    setUser(null);
    setProfile(null);
  };

  /**
   * Déconnexion complète.
   */
  const logout = async () => {
    try {
      localStorage.removeItem(GUEST_KEY);
    } catch {
      // Rien à faire si localStorage est indisponible.
    }

    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Erreur déconnexion :", error);
    }

    setIsGuest(false);
    setUser(null);
    setProfile(null);
  };

  const value = {
    user,
    profile,
    isGuest,
    loading,

    // Compatibilité avec les composants existants.
    // session correspond à l'utilisateur connecté.
    session: user
      ? {
          user,
        }
      : null,

    enableGuestMode,
    logout,
    setProfile,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error("useApp doit être utilisé dans AppProvider");
  }

  return context;
};

export default AppContext;
