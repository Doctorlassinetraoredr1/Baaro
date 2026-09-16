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
/** Flag session (onglet) : vrai seulement après clic "Continuer en invité" */
const GUEST_OK_KEY = "baaro_guest_ok";

const DEFAULT_PROFILE = {
  display_name: "Membre BAARO",
  handle: "@membre",
  flag: "🌍",
  bio: "",
};

function clearGuestFlags() {
  try {
    localStorage.removeItem(GUEST_KEY);
  } catch {}
  try {
    sessionStorage.removeItem(GUEST_OK_KEY);
  } catch {}
}

function isGuestOkThisSession() {
  try {
    return sessionStorage.getItem(GUEST_OK_KEY) === "1";
  } catch {
    return false;
  }
}

export function AppProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [userProfile, setUserProfile] = useState(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);

  // Jamais restauré depuis localStorage : évite d'ouvrir l'app en invité au refresh.
  const [isGuest, setIsGuest] = useState(false);

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
   * Charge le profil avec auth.users.id = profiles.id (identité unique).
   * Crée le profil s'il n'existe pas encore pour garantir la persistance.
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

      // Fallback si la colonne s'appelle encore user_id (migrations non appliquées)
      if (error && (error.message?.includes("id") || error.code === "42703")) {
        const legacy = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();
        if (!legacy.error && legacy.data) {
          data = { ...legacy.data, id: legacy.data.user_id || legacy.data.id };
          error = null;
        }
      }

      if (error) throw error;

      // Si le profil n'existe pas encore, on le crée (persistance).
      if (!data) {
        const fallback = {
          id: userId,
          display_name: "Membre BAARO",
          handle: `@user_${String(userId).slice(0, 8)}`,
          flag: "🌍",
          bio: "",
          updated_at: new Date().toISOString(),
        };

        const created = await supabase
          .from("profiles")
          .upsert(fallback, { onConflict: "id" })
          .select("*")
          .single();

        if (created.error) {
          console.error("[BAARO] Échec création profil:", created.error);
          // Dernier recours : insert simple
          const inserted = await supabase
            .from("profiles")
            .insert(fallback)
            .select("*")
            .single();
          if (inserted.error) {
            console.error("[BAARO] Échec insert profil:", inserted.error);
          } else {
            data = inserted.data;
          }
        } else {
          data = created.data;
        }
      }

      if (data) {
        // Normaliser : toujours exposer .id
        const normalized = {
          ...data,
          id: data.id || data.user_id || userId,
        };
        setProfile(normalized);

        setUserProfile({
          display_name:
            normalized.display_name || DEFAULT_PROFILE.display_name,
          handle: normalized.handle || DEFAULT_PROFILE.handle,
          flag: normalized.flag || DEFAULT_PROFILE.flag,
          bio: normalized.bio || DEFAULT_PROFILE.bio,
          ...normalized,
        });
        return normalized;
      }

      return null;
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
        // Toujours repartir sans mode invité auto (refresh / nouvel onglet)
        clearGuestFlags();

        const {
          data: { session: currentSession },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("[BAARO] Session error:", error);
        }

        if (!mounted) return;

        // Toute session anonyme au boot = déconnexion locale → écran login
        if (currentSession?.user?.is_anonymous) {
          try {
            await supabase.auth.signOut({ scope: "local" });
          } catch (e) {
            console.warn("[BAARO] signOut anonyme:", e);
          }
          if (!mounted) return;
          resetUserData();
          setIsGuest(false);
          setIsAnonymous(false);
          return;
        }

        if (currentSession?.user) {
          setSession(currentSession);
          setUser(currentSession.user);
          setIsGuest(false);
          setIsAnonymous(false);
        } else {
          resetUserData();
          setIsGuest(false);
          setIsAnonymous(false);
        }
      } catch (error) {
        console.error("[BAARO] Erreur initialisation auth:", error);
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
      async (event, nextSession) => {
        if (!mounted) return;

        // Session anonyme refusée sauf si l'utilisateur vient de cliquer "invité"
        if (nextSession?.user?.is_anonymous) {
          if (!isGuestOkThisSession()) {
            try {
              await supabase.auth.signOut({ scope: "local" });
            } catch {}
            if (!mounted) return;
            resetUserData();
            setIsGuest(false);
            setIsAnonymous(false);
            setLoading(false);
            return;
          }
          // Clic invité explicite cette session
          setSession(nextSession);
          setUser(nextSession.user);
          setIsAnonymous(true);
          setIsGuest(false);
          setLoading(false);
          return;
        }

        if (nextSession?.user) {
          // Compte réel (email / OAuth)
          clearGuestFlags();
          setSession(nextSession);
          setUser(nextSession.user);
          setIsGuest(false);
          setIsAnonymous(false);
        } else {
          resetUserData();
          setIsGuest(false);
          setIsAnonymous(false);
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
   * Mode invité local (cette session d'onglet uniquement).
   */
  const enableGuestMode = useCallback(() => {
    try {
      sessionStorage.setItem(GUEST_OK_KEY, "1");
    } catch {}
    try {
      localStorage.removeItem(GUEST_KEY);
    } catch {}
    setIsGuest(true);
    setIsAnonymous(true);
    resetUserData();
  }, [resetUserData]);

  /**
   * Déconnexion complète.
   */
  const logout = useCallback(async () => {
    clearGuestFlags();

    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error(
        "[BAARO] Erreur déconnexion:",
        error
      );
    }

    setIsGuest(false);
    setIsAnonymous(false);
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
