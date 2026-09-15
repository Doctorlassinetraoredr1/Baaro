import React, { useState, useEffect } from "react";
import { useApp } from "../../contexts/AppContext";
import { supabase } from "../../supabaseClient";

export const FollowButton = ({ targetUserId, onRequireAuth }) => {
  const { user, isGuest } = useApp();
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || isGuest || !targetUserId) {
      setIsFollowing(false);
      return;
    }

    const checkFollowStatus = async () => {
      const { data, error } = await supabase
        .from("follows")
        .select("follower_id, followed_id")
        .eq("follower_id", user.id)
        .eq("followed_id", targetUserId)
        .maybeSingle();

      if (error) {
        console.error(
          "Erreur lors de la vérification de l'abonnement :",
          error
        );
        setIsFollowing(false);
        return;
      }

      setIsFollowing(Boolean(data));
    };

    checkFollowStatus();
  }, [user, isGuest, targetUserId]);

  const handleFollowToggle = async (e) => {
    e.stopPropagation();

    if (isGuest || !user) {
      if (onRequireAuth) {
        onRequireAuth();
      }
      return;
    }

    if (!targetUserId || targetUserId === user.id) {
      return;
    }

    const previousState = isFollowing;

    setIsFollowing(!previousState);
    setLoading(true);

    try {
      if (previousState) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("followed_id", targetUserId);

        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase
          .from("follows")
          .insert([
            {
              follower_id: user.id,
              followed_id: targetUserId,
            },
          ]);

        if (error) {
          throw error;
        }
      }
    } catch (error) {
      console.error(
        "Erreur lors de la mise à jour de l'abonnement :",
        error
      );

      setIsFollowing(previousState);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleFollowToggle}
      disabled={loading}
      className={`btn-follow ${isFollowing ? "following" : ""}`}
      aria-pressed={isFollowing}
    >
      {isFollowing ? "Abonné(e)" : "S'abonner"}
    </button>
  );
};
