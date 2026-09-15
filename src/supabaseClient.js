import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://placeholder-project.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "placeholder-anon-key";

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn(
    "Variables Supabase manquantes : VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Mode démonstration actif."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "baaro-auth",
  },
});

// ========== IDENTITÉ UTILISATEUR UNIQUE ==========
// Règle BAARO : l'identité utilisateur est TOUJOURS auth.users.id.
// PLUS DE user_id comme clé d'identité.
// profiles.id / wallets.id / crypto_holdings.id = auth.users.id
// Les colonnes FK (author_id, sender_id, user_id dans les tables de relation) pointent vers ce même UUID.

const getCurrentUserId = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user?.id) throw new Error("Non connecté");
  return user.id;
};

// ========== ABONNÉS / ABONNEMENTS / AMIS ==========

export const followUser = async (targetUserId) => {
  const userId = await getCurrentUserId();
  if (!targetUserId || targetUserId === userId) throw new Error("Utilisateur cible invalide");
  const { data, error } = await supabase.rpc("toggle_follow", { p_target: targetUserId });
  return { data, error };
};

export const unfollowUser = async (targetUserId) => {
  const userId = await getCurrentUserId();
  if (!targetUserId || targetUserId === userId) throw new Error("Utilisateur cible invalide");
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", userId)
    .eq("followed_id", targetUserId);
  return { error };
};

export const isFollowing = async (targetUserId) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id || !targetUserId || user.id === targetUserId) return false;
  const { data } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", user.id)
    .eq("followed_id", targetUserId)
    .eq("status", "accepted")
    .maybeSingle();
  return Boolean(data);
};

export const sendFriendRequest = async (targetUserId) => {
  const userId = await getCurrentUserId();
  if (!targetUserId || targetUserId === userId) throw new Error("Utilisateur cible invalide");

  const { data: existing, error: existingError } = await supabase
    .from("follows")
    .select("follower_id, followed_id, status, is_friend")
    .eq("follower_id", userId)
    .eq("followed_id", targetUserId)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing?.is_friend && existing.status === "accepted") return { data: existing, error: null };

  const { data, error } = await supabase
    .from("follows")
    .upsert(
      { follower_id: userId, followed_id: targetUserId, status: "pending", is_friend: true },
      { onConflict: "follower_id,followed_id" }
    )
    .select("follower_id, followed_id, status, is_friend, created_at")
    .single();

  return { data, error };
};

export const acceptFriendRequest = async (followerId) => {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("follows")
    .update({ status: "accepted", is_friend: true })
    .eq("follower_id", followerId)
    .eq("followed_id", userId)
    .eq("status", "pending")
    .eq("is_friend", true)
    .select("follower_id, followed_id, status, is_friend, created_at")
    .single();
  return { data, error };
};

export const rejectFriendRequest = async (followerId) => {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("follows")
    .update({ status: "rejected", is_friend: false })
    .eq("follower_id", followerId)
    .eq("followed_id", userId)
    .eq("status", "pending")
    .eq("is_friend", true)
    .select("follower_id, followed_id, status, is_friend")
    .single();
  return { data, error };
};

// ========== RÉCUPÉRATION ==========

export const getFollowing = async () => {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("follows")
    .select("followed_id")
    .eq("follower_id", userId)
    .eq("status", "accepted");
  return { data: (data || []).map((f) => f.followed_id), error };
};

export const getFollowers = async () => {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("followed_id", userId)
    .eq("status", "accepted");
  return { data: (data || []).map((f) => f.follower_id), error };
};

export const getFriends = async () => {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("follows")
    .select("follower_id, followed_id")
    .eq("is_friend", true)
    .eq("status", "accepted")
    .or(`follower_id.eq.${userId},followed_id.eq.${userId}`);

  const ids = (data || []).map((row) =>
    row.follower_id === userId ? row.followed_id : row.follower_id
  );
  return { data: [...new Set(ids)], error };
};

export const getPendingRequests = async () => {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("follows")
    .select("follower_id, followed_id, status, is_friend, created_at")
    .eq("followed_id", userId)
    .eq("is_friend", true)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  return { data: data || [], error };
};

// ========== PROFILS ==========

export const getAllUsers = async () => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  return { data, error };
};

export const getUserById = async (userId) => {
  if (!userId) return { data: null, error: new Error("id requis") };
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return { data, error };
};
