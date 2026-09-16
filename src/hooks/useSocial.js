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
      // On appelle avec id_param, pas user_id_param
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

      const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, full_name")
      .in("id", friendIds);

      if (profilesError) throw profilesError;

      setFriends(profiles || []);
    } catch (err) {
      console.error("Erreur chargement amis :", err.message);
      setFriends([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  return { friends, fetchFriends, loading };
};
