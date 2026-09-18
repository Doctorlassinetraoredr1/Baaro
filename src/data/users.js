/**
 * Cache local léger des profils publics.
 *
 * IMPORTANT :
 * `id` est l'identifiant unique canonique de l'utilisateur.
 *
 * Aucun `user_id` secondaire n'est créé ici.
 */

const CACHE_KEY = "baaro:users-cache";
const MAX_USERS = 100;

function normalizeUser(user) {
  if (!user?.id) return null;

  return {
    id: user.id,
    display_name: user.display_name || "Membre BAARO",
    handle: user.handle || "@utilisateur",
    flag: user.flag || "🌍",
    country: user.country || "🌍",
    avatar_url: user.avatar_url || user.avatar || "",
    bio: user.bio || "",
    points: Number.isFinite(Number(user.points))
      ? Number(user.points)
      : 0,
    is_verified: Boolean(
      user.is_verified ?? user.isVerified
    ),
  };
}

/**
 * Récupère les utilisateurs du cache local.
 */
export function getCachedUsers() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(CACHE_KEY);

    if (!raw) return [];

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(normalizeUser)
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Enregistre uniquement des informations publiques
 * nécessaires à la recherche.
 */
export function setCachedUsers(users = []) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const normalized = users
      .map(normalizeUser)
      .filter(Boolean);

    const uniqueUsers = new Map();

    for (const user of normalized) {
      uniqueUsers.set(user.id, user);
    }

    const limitedUsers = Array.from(uniqueUsers.values()).slice(
      0,
      MAX_USERS
    );

    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify(limitedUsers)
    );
  } catch {
    // Le cache ne doit jamais bloquer l'application.
  }
}

/**
 * Recherche locale d'un utilisateur par son `id`.
 *
 * `id` reste la seule clé d'identification.
 */
export function getUserById(id) {
  if (!id) return null;

  return (
    getCachedUsers().find((user) => user.id === id) ||
    null
  );
}

/**
 * Compatibilité avec l'ancien code.
 *
 * Le tableau reste vide volontairement :
 * les utilisateurs réels viennent de Supabase
 * ou du cache local.
 */
export const STABLE_USERS = [];
