import React, { useState, useEffect } from "react";
import { useApp } from "../../contexts/AppContext";
import { supabase } from "../../supabaseClient";

const FollowButton = ({ targetUserId, onRequireAuth }) => {
  const { user, isGuest } = useApp();

  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || isGuest || !targetUserId) {
      setIsFollowing(false);
      return;
    }

    // Impossible de se suivre soi-même.
    if (targetUserId === user.id) {
      setIsFollowing(false);
      return;
    }

    let cancelled = false;

    const checkFollowStatus = async () => {
      try {
        const { data, error } = await supabase
          .from("follows")
          .select("follower_id, followed_id")
          .eq("follower_id", user.id)
          .eq("followed_id", targetUserId)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          console.error(
            "Erreur lors de la vérification de l'abonnement :",
            error
          );
          setIsFollowing(false);
          return;
        }

        setIsFollowing(Boolean(data));
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Erreur lors de la vérification de l'abonnement :",
            error
          );
          setIsFollowing(false);
        }
      }
    };

    checkFollowStatus();

    return () => {
      cancelled = true;
    };
  }, [user, isGuest, targetUserId]);

  const handleFollowToggle = async (event) => {
    event.stopPropagation();

    if (isGuest || !user) {
      if (onRequireAuth) {
        onRequireAuth();
      }
      return;
    }

    if (!targetUserId || targetUserId === user.id || loading) {
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

      // Retour à l'état précédent si Supabase échoue.
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
      aria-label={
        isFollowing
          ? "Se désabonner"
          : "S'abonner"
      }
    >
      {loading
        ? "..."
        : isFollowing
          ? "Abonné(e)"
          : "S'abonner"}
    </button>
  );
};

export default FollowButton;
