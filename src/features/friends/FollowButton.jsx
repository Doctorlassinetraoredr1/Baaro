import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../supabaseClient";
import { COLORS } from "../../theme.js";

const FollowButton = ({ targetId, onRequireAuth, currentUserId }) => {
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
    
    const { data, error } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", myId)
      .eq("followed_id", targetId)
      .eq("status", "accepted")
      .maybeSingle();
      
    if (error) {
      console.error("Erreur check:", error);
      alert("Erreur lecture: " + error.message);
    }
    
    setIsFollowing(!!data);
    setLoading(false);
  }, [myId, targetId, isGuest, isSelf]);

  useEffect(() => { check(); }, [check]);

  const toggle = async (e) => {
    e.stopPropagation();
    
    if (!myId) {
      alert("PROBLÈME : myId est vide. L'utilisateur n'est pas connecté ou l'ID n'est pas transmis.");
      return;
    }
    if (!targetId) {
      alert("PROBLÈME : targetId est vide. L'ID du profil à suivre est manquant.");
      return;
    }
    if (isSelf) {
      alert("INFO : Vous ne pouvez pas vous suivre vous-même.");
      return;
    }

    const prev = isFollowing;
    setIsFollowing(!prev);
    setLoading(true);
    
    try {
      if (prev) {
        const { error } = await supabase.from("follows").delete()
          .eq("follower_id", myId)
          .eq("followed_id", targetId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("follows").upsert(
          { 
            follower_id: myId, 
            followed_id: targetId,
            status: 'accepted',
            is_friend: false
          },
          { onConflict: 'follower_id,followed_id' }
        );
        if (error) throw error;
      }
    } catch (err) {
      alert("ERREUR CRITIQUE :\n" + err.message);
      console.error("Erreur follow:", err);
      setIsFollowing(prev); // Annule le changement visuel
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
