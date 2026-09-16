import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "../../contexts/AppContext";
import { supabase } from "../../supabaseClient";

const FollowButton = ({ targetUserId, onRequireAuth, onFollowChange }) => {
  const { user, isGuest } = useApp();
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true); // true au début pour éviter le flash "S'abonner"

  const isSelf = user?.id === targetUserId;

  const checkFollowStatus = useCallback(async () => {
    if (!user || isGuest ||!targetUserId || isSelf) {
      setIsFollowing(false);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
       .from("follows")
       .select("follower_id")
       .eq("follower_id", user.id)
       .eq("followed_id", targetUserId)
       .limit(1)
       .maybeSingle();

      if (error) throw error;
      setIsFollowing(!!data);
    } catch (err) {
      console.error("[FollowButton] check error:", err.message);
      setIsFollowing(false);
    } finally {
      setLoading(false);
    }
  }, [user, isGuest, targetUserId, isSelf]);

  useEffect(() => {
    checkFollowStatus();

    // BONUS: écoute en temps réel si quelqu'un d'autre te follow/unfollow
    if (!targetUserId) return;
    const channel = supabase
     .channel(`follow:${user?.id}:${targetUserId}`)
     .on('postgres_changes',
        { event: '*', schema: 'public', table: 'follows', filter: `followed_id=eq.${targetUserId}` },
        () => checkFollowStatus()
      )
     .subscribe();
    return () => { supabase.removeChannel(channel); }
  }, [checkFollowStatus, targetUserId, user?.id]);

  const handleToggle = async (e) => {
    e.stopPropagation();
    if (isGuest ||!user) return onRequireAuth?.();
    if (!targetUserId || isSelf || loading) return;

    const prev = isFollowing;
    setIsFollowing(!prev);
    setLoading(true);

    try {
      if (prev) {
        // Unfollow
        const { error } = await supabase
         .from("follows")
         .delete()
         .eq("follower_id", user.id)
         .eq("followed_id", targetUserId);
        if (error) throw error;
        onFollowChange?.(false);
      } else {
        // Follow avec upsert pour éviter le duplicate key
        const { error } = await supabase
         .from("follows")
         .upsert(
            { follower_id: user.id, followed_id: targetUserId },
            { onConflict: 'follower_id,followed_id', ignoreDuplicates: false }
          );
        if (error) throw error;

        // Crée la notif pour l'autre personne
        await supabase.from("notifications").insert({
          user_id: targetUserId,
          actor_id: user.id,
          type: 'follow',
          entity_id: user.id,
        });
        onFollowChange?.(true);
      }
    } catch (err) {
      console.error("[FollowButton] toggle error:", err.message);
      // Message plus clair pour toi
      if (err.message.includes('row-level security')) {
        alert("ERREUR RLS: Tu dois ajouter les policies dans Supabase! Regarde le SQL ci-dessous.");
      }
      setIsFollowing(prev); // rollback
    } finally {
      setLoading(false);
    }
  };

  if (isSelf) return null;

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all
        ${isFollowing
         ? "bg-zinc-200 text-black hover:bg-red-100 hover:text-red-600"
          : "bg-[#FF6B00] text-white hover:bg-[#e66000]"}
        disabled:opacity-50`}
    >
      {loading? "..." : isFollowing? "Abonné(e)" : "S'abonner"}
    </button>
  );
};

export default FollowButton;
