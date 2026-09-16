import React, { useState, useEffect, useCallback } from "react";
// import { useApp } from "../../contexts/AppContext"; // Décommente si tu utilises ce contexte
import { supabase } from "../../supabaseClient";
import { COLORS } from "../../theme.js"; // Pour garder la cohérence visuelle

const FollowButton = ({ targetId, onRequireAuth, currentUserId }) => {
  // Si tu utilises un contexte, remplace la ligne ci-dessous par :
  // const { user, isGuest } = useApp();
  // const myId = user?.id;
  const myId = currentUserId; 
  const isGuest = !myId;
  
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  const isSelf = myId === targetId;

  const check = useCallback(async () => {
    if (!myId || isGuest || !targetId || isSelf) {
      setIsFollowing(false); 
      setLoading(false); 
      return;
    }
    
    const { data } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", myId)
      .eq("followed_id", targetId)
      .maybeSingle();
      
    setIsFollowing(!!data);
    setLoading(false);
  }, [myId, targetId, isGuest, isSelf]);

  useEffect(() => { check(); }, [check]);

  const toggle = async (e) => {
    e.stopPropagation();
    if (isGuest || !myId) return onRequireAuth?.();
    if (!targetId || isSelf || loading) return;

    const prev = isFollowing;
    setIsFollowing(!prev);
    setLoading(true);
    
    try {
      if (prev) {
        // Désabonnement
        await supabase.from("follows").delete()
          .eq("follower_id", myId)
          .eq("followed_id", targetId)
          .throwOnError();
      } else {
        // Abonnement
        await supabase.from("follows").upsert(
          { follower_id: myId, followed_id: targetId },
          { onConflict: 'follower_id,followed_id' }
        ).throwOnError();

        // ⚠️ CORRECTION CRITIQUE : La colonne s'appelle 'id', pas 'receiver_id' ni 'user_id'
        // 💡 NOTE : Si tu as appliqué la migration SQL "042_notifications_realtime.sql", 
        // le trigger crée cette notification AUTOMATIQUEMENT. Tu peux donc supprimer 
        // ce bloc 'notifications.insert' pour éviter les doublons.
        await supabase.from("notifications").insert({
          id: targetId,          // <-- C'est ici que ça change
          actor_id: myId,
          type: 'follow',
          message: 'Vous suit maintenant'
        }).throwOnError();
      }
    } catch (err) {
      console.error("Erreur follow:", err.message);
      setIsFollowing(prev); // Rollback visuel en cas d'erreur
    } finally {
      setLoading(false);
    }
  };

  if (isSelf) return null;

  return (
    <button 
      onClick={toggle} 
      disabled={loading}
      className="px-4 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
      style={{ 
        background: isFollowing ? "rgba(255, 255, 255, 0.1)" : COLORS.gold,
        color: isFollowing ? COLORS.ivory : COLORS.bg
      }}
    >
      {loading ? "..." : isFollowing ? "Abonné" : "Suivre"}
    </button>
  );
};

export default FollowButton;
