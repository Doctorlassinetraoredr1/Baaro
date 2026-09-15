import { supabase } from "../supabaseClient.js";

/**
 * Canonical BAARO identity: the UUID issued by Supabase Auth.
 * Never use email, handle, display_name or a locally generated id as a DB user id.
 */
export async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const id = data?.user?.id;
  if (!id) throw new Error("Utilisateur non connecté");
  return id;
}

export function assertUserId(userId, currentUserId) {
  if (!userId || !currentUserId || userId !== currentUserId) {
    throw new Error("Identifiant utilisateur invalide");
  }
  return currentUserId;
}
