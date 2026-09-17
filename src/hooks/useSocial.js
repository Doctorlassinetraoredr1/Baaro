import { useState, useCallback } from "react";
import { supabase } from "../supabaseClient";

export const useSocial = (id) => {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchFriends = useCallback(async () => {
    if (!id) {
      setFriends([]);
      return;
    }
    setLoading(true);
    try {
      // Appel de la fonction RPC (nécessite la migration SQL fournie précédemment)
      const { data, error } = await supabase.rpc("get_user_friends", {
        id_param: id,
      });

      if (error) throw error;

      if (!data || data.length === 0) {
        setFriends([]);
        return;
      }

      const friendIds = data.map(f => f.friend_id).filter(Boolean);

      if (friendIds.length === 0) {
        setFriends([]);
        return;
      }

      // ✅ CORRECTION 1 : Utiliser les VRAIS noms de colonnes de votre table 'profiles'
      // (display_name, handle, avatar_url, flag) au lieu de username/full_name qui n'existent pas.
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, display_name, handle, avatar_url, flag")
        .in("id", friendIds);

      if (profilesError) throw profilesError;

      // ✅ CORRECTION 2 : Mapper les données pour qu'elles correspondent exactement 
      // à ce qu'attend votre composant FriendsTab (friend.username, friend.avatar_url, etc.)
      const mappedFriends = (profiles || []).map(profile => ({
        id: profile.id,
        username: profile.display_name || profile.handle || "Membre",
        avatar_url: profile.avatar_url,
        full_name: profile.display_name, // Rétrocompatibilité
        handle: profile.handle,
        flag: profile.flag,
      }));

      setFriends(mappedFriends);
    } catch (err) {
      console.error("Erreur chargement amis :", err.message);
      setFriends([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  return { friends, fetchFriends, loading };
};
