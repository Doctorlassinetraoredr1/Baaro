import { useState, useCallback } from "react";
import { supabase } from "../supabaseClient";

export const useSocial = (id) => {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchFriends = useCallback(async () => {
    if (!id) {
      setFriends([]);
      return;
    }
    setLoading(true);
    setError(null);
    
    try {
      console.log('📡 useSocial: Appel RPC avec id =', id);
      
      const { data, error } = await supabase.rpc("get_user_friends", {
        user_id: id,
      });

      if (error) {
        console.error("❌ useSocial: Erreur RPC:", error);
        setError(error.message);
        setFriends([]);
        return;
      }

      console.log("✅ useSocial: Données RPC reçues:", data);

      if (!data || data.length === 0) {
        setFriends([]);
        return;
      }

      const friendIds = data.map(f => f.friend_id).filter(Boolean);
      console.log("🔗 useSocial: friendIds:", friendIds);

      if (friendIds.length === 0) {
        setFriends([]);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, display_name, handle, avatar_url, flag")
        .in("id", friendIds);

      if (profilesError) {
        console.error("❌ useSocial: Erreur profils:", profilesError);
        throw profilesError;
      }

      console.log("👤 useSocial: Profils trouvés:", profiles);

      const mappedFriends = (profiles || []).map(profile => ({
        id: profile.id,
        username: profile.display_name || profile.handle || "Membre",
        avatar_url: profile.avatar_url,
        full_name: profile.display_name,
        handle: profile.handle,
        flag: profile.flag,
      }));

      setFriends(mappedFriends);
    } catch (err) {
      console.error(" useSocial: Erreur chargement amis:", err);
      setError(err.message);
      setFriends([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  return { friends, fetchFriends, loading, error };
};
