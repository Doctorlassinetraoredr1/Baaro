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
      const { data, error } = await supabase.rpc("get_user_friends", {
        user_id_param: id,
      });

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        const friendIds = data
          .map((friend) => friend.friend_id)
          .filter(Boolean);

        if (friendIds.length === 0) {
          setFriends([]);
          return;
        }

        const {
          data: profiles,
          error: profilesError,
        } = await supabase
          .from("profiles")
          .select("*")
          .in("id", friendIds);

        if (profilesError) {
          throw profilesError;
        }

        setFriends(profiles || []);
      } else {
        setFriends([]);
      }
    } catch (error) {
      console.error("Erreur chargement amis :", error);
      setFriends([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  return {
    friends,
    fetchFriends,
    loading,
  };
};
