import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { API_BASE } from "../config.js";
import { getDeviceId } from "../device.js";

const AppContext = createContext(null);

const GUEST_PROFILE_STORAGE_KEY = "baaro-guest-profile-v2";

function readGuestProfile() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(GUEST_PROFILE_STORAGE_KEY);
    if (!raw) return null;

    const profile = JSON.parse(raw);
    return profile && typeof profile === "object" ? profile : null;
  } catch (error) {
    console.warn("[BAARO] Impossible de lire le profil invité local:", error);
    return null;
  }
}

function saveGuestProfile(profile) {
  if (typeof window === "undefined" || !profile) return;

  try {
    window.localStorage.setItem(
      GUEST_PROFILE_STORAGE_KEY,
      JSON.stringify(profile)
    );
  } catch (error) {
    console.warn("[BAARO] Impossible de sauvegarder le profil invité:", error);
  }
}

function clearGuestProfile() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(GUEST_PROFILE_STORAGE_KEY);
  } catch (error) {
    console.warn("[BAARO] Impossible de supprimer le profil invité:", error);
  }
}

function normalizeProfile(profile = {}, fallback = {}) {
  const get = (key, defaultValue) =>
    Object.prototype.hasOwnProperty.call(profile, key)
      ? profile[key]
      : Object.prototype.hasOwnProperty.call(fallback, key)
        ? fallback[key]
        : defaultValue;

  return {
    display_name: get("display_name", "Membre BAARO") || "Membre BAARO",
    handle: get("handle", "@membre") || "@membre",
    flag: get("flag", "🌍") || "🌍",
    bio: get("bio", ""),
    avatar_url: get("avatar_url", null),
    cover_url: get("cover_url", null),
    country: get("country", null),
    registered_country: get("registered_country", null),
    country_changed_at: get("country_changed_at", null),
    country_change_available_at: get("country_change_available_at", null),
    first_name: get("first_name", ""),
    last_name: get("last_name", ""),
    birth_date: get("birth_date", null),
    location: get("location", ""),
    is_verified: get("is_verified", false) === true,
  };
}

export function AppProvider({ children }) {
  const [session, setSession] = useState(null);
  const [userId, setUserId] = useState(null);

  const [userProfile, setUserProfile] = useState({
    display_name: "Membre BAARO",
    handle: "@membre",
    flag: "🌍",
    bio: "",
    first_name: "",
    last_name: "",
    birth_date: null,
    location: "",
    country: null,
    registered_country: null,
    country_changed_at: null,
    country_change_available_at: null,
    avatar_url: null,
    cover_url: null,
    is_verified: false,
  });

  const [pointsBalance, setPointsBalance] = useState(0);
  const [baroBalance, setBaroBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAnonymous, setIsAnonymous] = useState(false);

  const [earnedToday, setEarnedToday] = useState(0);
  const [remainingToday, setRemainingToday] = useState(100);
  const [dailyCap, setDailyCap] = useState(100);

  useEffect(() => {
    let active = true;

    const applySession = (nextSession) => {
      if (!active) return;

      const nextUser = nextSession?.user || null;
      const anonymous = nextUser?.is_anonymous === true;

      setSession(nextSession);
      setUserId(nextUser?.id || null);
      setIsAnonymous(anonymous);

      if (anonymous) {
        const savedGuestProfile = readGuestProfile();

        if (savedGuestProfile) {
          setUserProfile((previous) => ({
            ...previous,
            ...savedGuestProfile,
          }));
        }
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session);

      if (active) {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);

      if (active) {
        setLoading(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const callWallet = useCallback(async (action, payload = {}) => {
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();

    if (!currentSession?.access_token) {
      return { ok: false, error: "Non authentifié" };
    }

    try {
      const res = await fetch(`${API_BASE}/api/wallet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentSession.access_token}`,
        },
        body: JSON.stringify({ action, ...payload }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return { ok: false, error: data.error || "Erreur serveur" };
      }

      return { ok: true, ...data };
    } catch {
      return {
        ok: false,
        error: "Impossible de joindre le serveur",
      };
    }
  }, []);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    (async () => {
      try {
        const localGuestProfile = isAnonymous
          ? readGuestProfile()
          : null;

        if (localGuestProfile && !cancelled) {
          setUserProfile((previous) => ({
            ...previous,
            ...localGuestProfile,
          }));
        }

        let { data: profile } = await supabase
          .from("profiles")
          .select(
            "user_id, display_name, handle, flag, bio, avatar_url, cover_url, country, registered_country, country_changed_at, country_change_available_at, first_name, last_name, birth_date, location, is_verified, created_at"
          )
          .eq("user_id", userId)
          .maybeSingle();

        if (!profile) {
          const metadata = session?.user?.user_metadata || {};

          const profileToCreate = {
            user_id: userId,
            display_name:
              (isAnonymous ? localGuestProfile?.display_name : null) ||
              metadata.display_name ||
              metadata.full_name ||
              "Membre BAARO",
            handle:
              (isAnonymous ? localGuestProfile?.handle : null) ||
              metadata.handle ||
              "@membre",
            flag:
              (isAnonymous ? localGuestProfile?.flag : null) ||
              metadata.flag ||
              "🌍",
            bio:
              (isAnonymous ? localGuestProfile?.bio : null) ??
              metadata.bio ??
              "",
            avatar_url:
              (isAnonymous ? localGuestProfile?.avatar_url : null) ||
              metadata.avatar_url ||
              metadata.picture ||
              null,
            cover_url:
              (isAnonymous ? localGuestProfile?.cover_url : null) ||
              metadata.cover_url ||
              null,
            country:
              (isAnonymous ? localGuestProfile?.country : null) ||
              metadata.country ||
              null,
            first_name:
              (isAnonymous ? localGuestProfile?.first_name : null) ||
              metadata.first_name ||
              "",
            last_name:
              (isAnonymous ? localGuestProfile?.last_name : null) ||
              metadata.last_name ||
              "",
            birth_date:
              (isAnonymous ? localGuestProfile?.birth_date : null) ||
              metadata.birth_date ||
              null,
            location:
              (isAnonymous ? localGuestProfile?.location : null) ||
              metadata.location ||
              "",
          };

          const { data: created, error: createError } = await supabase
            .from("profiles")
            .upsert(profileToCreate, { onConflict: "user_id" })
            .select()
            .single();

          if (!createError) {
            profile = created;
          } else {
            console.warn(
              "[BAARO] Création du profil invité impossible:",
              createError
            );
          }
        }

        if (profile && !cancelled) {
          const normalizedProfile = normalizeProfile(
            profile,
            isAnonymous ? (localGuestProfile || {}) : {}
          );

          setUserProfile(normalizedProfile);

          if (isAnonymous) {
            saveGuestProfile(normalizedProfile);
          }
        }

        const status = await callWallet("status");

        if (!cancelled && status.ok) {
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
        }

        try {
          const {
            data: { session: currentSession },
          } = await supabase.auth.getSession();

          if (currentSession?.access_token) {
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
          }
        } catch (error) {
          console.warn(
            "[BAARO] register-device failed",
            error
          );
        }
      } catch (error) {
        console.error(
          "[BAARO] Erreur chargement données utilisateur:",
          error
        );

        if (isAnonymous && !cancelled) {
          const fallbackGuestProfile = readGuestProfile();

          if (fallbackGuestProfile) {
            setUserProfile((previous) => ({
              ...previous,
              ...fallbackGuestProfile,
            }));
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, isAnonymous, callWallet, session]);

  const earnPoints = useCallback(
    async (actionKey, detail = "", referenceId = null) => {
      const result = await callWallet("earn", {
        actionKey,
        detail,
        referenceId,
      });

      if (result.ok) {
        if (typeof result.balance === "number") {
          setPointsBalance(result.balance);
        }

        if (typeof result.earnedToday === "number") {
          setEarnedToday(result.earnedToday);
        }

        if (typeof result.remainingToday === "number") {
          setRemainingToday(result.remainingToday);
        }

        if (typeof result.dailyCap === "number") {
          setDailyCap(result.dailyCap);
        }
      }

      return result;
    },
    [callWallet]
  );

  const redeemReward = useCallback(
    async (optionId) => {
      const result = await callWallet("redeem", { optionId });

      if (
        result.ok &&
        typeof result.balance === "number"
      ) {
        setPointsBalance(result.balance);
      }

      return result;
    },
    [callWallet]
  );

  const convertToBaro = useCallback(
    async (pts) => {
      const result = await callWallet("convert", { pts });

      if (result.ok) {
        if (typeof result.balance === "number") {
          setPointsBalance(result.balance);
        }

        if (typeof result.holdings === "number") {
          setBaroBalance(result.holdings);
        }
      }

      return result;
    },
    [callWallet]
  );

  const refreshWalletStatus = useCallback(async () => {
    const status = await callWallet("status");

    if (status.ok) {
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
    }

    return status;
  }, [callWallet]);

  const updateProfile = useCallback(
    async (updates) => {
      if (!userId) {
        return {
          ok: false,
          error: "Non authentifié",
        };
      }

      const nextProfile = {
        ...userProfile,
        ...updates,
      };

      const payload = {
        ...updates,
        user_id: userId,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("profiles")
        .upsert(payload, { onConflict: "user_id" })
        .select(
          "user_id, display_name, handle, flag, bio, avatar_url, cover_url, country, registered_country, country_changed_at, country_change_available_at, first_name, last_name, birth_date, location, is_verified, created_at, updated_at"
        )
        .single();

      if (error) {
        if (isAnonymous) {
          saveGuestProfile(nextProfile);
          setUserProfile(nextProfile);
        }

        return {
          ok: false,
          error,
        };
      }

      const mergedProfile = normalizeProfile(
        data,
        nextProfile
      );

      setUserProfile(mergedProfile);

      if (isAnonymous) {
        saveGuestProfile(mergedProfile);
      }

      return {
        ok: true,
      };
    },
    [userId, userProfile, isAnonymous]
  );

  const resetGuestProfile = useCallback(() => {
    clearGuestProfile();

    setUserProfile({
      display_name: "Membre BAARO",
      handle: "@membre",
      flag: "🌍",
      bio: "",
      first_name: "",
      last_name: "",
      birth_date: null,
      location: "",
      country: null,
      registered_country: null,
      country_changed_at: null,
      country_change_available_at: null,
      avatar_url: null,
      cover_url: null,
      is_verified: false,
    });
  }, []);

  const value = {
    session,
    userId,
    userProfile,
    setUserProfile,
    pointsBalance,
    setPointsBalance,
    baroBalance,
    setBaroBalance,
    loading,
    isAnonymous,
    earnedToday,
    remainingToday,
    dailyCap,
    earnPoints,
    redeemReward,
    convertToBaro,
    refreshWalletStatus,
    updateProfile,
    resetGuestProfile,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);

  if (!ctx) {
    throw new Error("useApp must be used within an AppProvider");
  }

  return ctx;
}
