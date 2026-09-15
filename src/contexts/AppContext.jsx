import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { supabase } from "../supabaseClient";
import { API_BASE } from "../config.js";
import { getDeviceId } from "../device.js";

const AppContext = createContext(null);

const GUEST_KEY = "baaro_is_guest";

const DEFAULT_PROFILE = {
  display_name: "Membre BAARO",
  handle: "@membre",
  flag: "🌍",
  bio: "",
};

export function AppProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [userProfile, setUserProfile] = useState(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);

  const [isGuest, setIsGuest] = useState(() => {
    try {
      return localStorage.getItem(GUEST_KEY) === "true";
    } catch {
      return false;
    }
  });

  const [isAnonymous, setIsAnonymous] = useState(false);

  const [pointsBalance, setPointsBalance] = useState(0);
  const [baroBalance, setBaroBalance] = useState(0);
  const [earnedToday, setEarnedToday] = useState(0);
  const [remainingToday, setRemainingToday] = useState(100);
  const [dailyCap, setDailyCap] = useState(100);

  // Identifiant utilisateur unique.
  const id = user?.id || null;

  const resetUserData = useCallback(() => {
    setUser(null);
    setSession(null);
    setProfile(null);
    setUserProfile(DEFAULT_PROFILE);
    setPointsBalance(0);
    setBaroBalance(0);
    setEarnedToday(0);
    setRemainingToday(100);
    setDailyCap(100);
    setIsAnonymous(false);
  }, []);

  /**
   * Charge le profil avec auth.users.id = profiles.id.
   */
  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      setUserProfile(DEFAULT_PROFILE);
      return null;
    }

    try {
      let { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) throw error;

      // Si le profil n'existe pas encore, on le crée.
      if (!data) {
        const fallback = {
          id: userId,
          display_name: "Membre BAARO",
          handle: `@user_${userId.slice(0, 8)}`,
          flag: "🌍",
          bio: "",
        };

        const created = await supabase
          .from("profiles")
          .upsert(fallback, { onConflict: "id" })
          .select("*")
          .single();

        if (!created.error) {
          data = created.data;
        }
      }

      if (data) {
        setProfile(data);

        setUserProfile({
          display_name:
            data.display_name || DEFAULT_PROFILE.display_name,
          handle: data.handle || DEFAULT_PROFILE.handle,
          flag: data.flag || DEFAULT_PROFILE.flag,
          bio: data.bio || DEFAULT_PROFILE.bio,
          ...data,
        });
      }

      return data;
    } catch (error) {
      console.error("[BAARO] Erreur chargement profil:", error);
      return null;
    }
  }, []);

  /**
   * Appel centralisé au wallet.
   */
  const callWallet = useCallback(async (action, payload = {}) => {
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();

    if (!currentSession?.access_token) {
      return {
        ok: false,
        error: "Non authentifié",
      };
    }

    try {
      const response = await fetch(`${API_BASE}/api/wallet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentSession.access_token}`,
        },
        body: JSON.stringify({
          action,
          ...payload,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          ok: false,
          error: data.error || "Erreur serveur",
        };
      }

      return {
        ok: true,
        ...data,
      };
    } catch (error) {
      console.error("[BAARO] Erreur wallet:", error);

      return {
        ok: false,
        error: "Impossible de joindre le serveur",
      };
    }
  }, []);

  /**
   * Synchronise les soldes et limites journalières.
   */
  const applyWalletStatus = useCallback((status) => {
    if (!status?.ok) return;

    if (typeof status.balance === "number") {
      setPointsBalance(status.balance);
    }

    if (typeof status.holdings === "number") {
      setBaroBalance(status.holdings);
    }

    if (typeof status.earnedToday === "number") {
      setEarnedToday(status.earnedToday);
    }

    if (typeof status.remainingToday === "number") {
      setRemainingToday(status.remainingToday);
    }

    if (typeof status.dailyCap === "number") {
      setDailyCap(status.dailyCap);
    }
  }, []);

  const refreshWalletStatus = useCallback(async () => {
    const status = await callWallet("status");

    applyWalletStatus(status);

    return status;
  }, [callWallet, applyWalletStatus]);

  /**
   * Enregistre l'appareil après authentification.
   */
  const registerDevice = useCallback(async () => {
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();

    if (!currentSession?.access_token) return;

    try {
      await fetch(`${API_BASE}/api/register-device`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentSession.access_token}`,
        },
        body: JSON.stringify({
          deviceId: getDeviceId(),
        }),
      });
    } catch (error) {
      console.warn(
        "[BAARO] register-device failed",
        error
      );
    }
  }, []);

  /**
   * Initialisation de la session.
   */
  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        const {
          data: { session: currentSession },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error(
            "[BAARO] Session error:",
            error
          );
        }

        if (!mounted) return;

        if (currentSession?.user) {
          setSession(currentSession);
          setUser(currentSession.user);
          setIsGuest(false);
          setIsAnonymous(
            currentSession.user.is_anonymous === true
          );

          try {
            localStorage.setItem(
              GUEST_KEY,
              "false"
            );
          } catch {}
        } else {
          resetUserData();

          let storedGuest = false;

          try {
            storedGuest =
              localStorage.getItem(GUEST_KEY) === "true";
          } catch {}

          setIsGuest(storedGuest);
        }
      } catch (error) {
        console.error(
          "[BAARO] Erreur initialisation auth:",
          error
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!mounted) return;

        if (nextSession?.user) {
          setSession(nextSession);
          setUser(nextSession.user);
          setIsGuest(false);
          setIsAnonymous(
            nextSession.user.is_anonymous === true
          );

          try {
            localStorage.setItem(
              GUEST_KEY,
              "false"
            );
          } catch {}
        } else {
          resetUserData();

          let storedGuest = false;

          try {
            storedGuest =
              localStorage.getItem(GUEST_KEY) === "true";
          } catch {}

          setIsGuest(storedGuest);
        }

        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [resetUserData]);

  /**
   * Charge toutes les données après connexion.
   */
  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    const loadUserData = async () => {
      await loadProfile(id);

      if (cancelled) return;

      const status = await refreshWalletStatus();

      if (cancelled) return;

      if (status.ok) {
        await registerDevice();
      }
    };

    loadUserData().catch((error) => {
      console.error(
        "[BAARO] Erreur chargement données utilisateur:",
        error
      );
    });

    return () => {
      cancelled = true;
    };
  }, [
    id,
    loadProfile,
    refreshWalletStatus,
    registerDevice,
  ]);

  /**
   * Mode invité local.
   */
  const enableGuestMode = useCallback(() => {
    try {
      localStorage.setItem(
        GUEST_KEY,
        "true"
      );
    } catch {}

    setIsGuest(true);
    resetUserData();
  }, [resetUserData]);

  /**
   * Déconnexion complète.
   */
  const logout = useCallback(async () => {
    try {
      localStorage.removeItem(GUEST_KEY);
    } catch {}

    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error(
        "[BAARO] Erreur déconnexion:",
        error
      );
    }

    setIsGuest(false);
    resetUserData();
  }, [resetUserData]);

  /**
   * Gagner des points.
   */
  const earnPoints = useCallback(
    async (
      actionKey,
      detail = "",
      referenceId = null
    ) => {
      const result = await callWallet("earn", {
        actionKey,
        detail,
        referenceId,
      });

      applyWalletStatus(result);

      return result;
    },
    [callWallet, applyWalletStatus]
  );

  /**
   * Échanger une récompense.
   */
  const redeemReward = useCallback(
    async (optionId) => {
      const result = await callWallet(
        "redeem",
        { optionId }
      );

      applyWalletStatus(result);

      return result;
    },
    [callWallet, applyWalletStatus]
  );

  /**
   * Convertir les points en BARO.
   */
  const convertToBaro = useCallback(
    async (pts) => {
      const result = await callWallet(
        "convert",
        { pts }
      );

      applyWalletStatus(result);

      return result;
    },
    [callWallet, applyWalletStatus]
  );

  /**
   * Mise à jour du profil.
   */
  const updateProfile = useCallback(
    async (updates) => {
      if (!id) {
        return {
          ok: false,
          error: "Non authentifié",
        };
      }

      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", id)
        .select("*")
        .single();

      if (error) {
        return {
          ok: false,
          error,
        };
      }

      setProfile(data);
      setUserProfile((previous) => ({
        ...previous,
        ...data,
      }));

      return {
        ok: true,
        profile: data,
      };
    },
    [id]
  );

  const value = {
    // Identité canonique.
    id,
    user,
    session,
    profile,
    userProfile,

    // Compatibilité avec MainShell et les anciens composants.
    userId: id,
    setProfile,
    setUserProfile,

    // Authentification.
    isGuest,
    isAnonymous,
    loading,
    enableGuestMode,
    logout,

    // Wallet.
    pointsBalance,
    setPointsBalance,
    baroBalance,
    setBaroBalance,
    earnedToday,
    remainingToday,
    dailyCap,

    // Récompenses.
    earnPoints,
    redeemReward,
    convertToBaro,
    refreshWalletStatus,

    // Profil.
    updateProfile,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error(
      "useApp doit être utilisé dans AppProvider"
    );
  }

  return context;
}

export default AppContext;
