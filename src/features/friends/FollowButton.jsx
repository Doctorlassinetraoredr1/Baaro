import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../supabaseClient";
import { COLORS } from "../../theme.js";

const FollowButton = ({ targetId, onRequireAuth, currentUserId }) => {
  const myId = currentUserId; 
  const isGuest = !myId;
  
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [debugMsg, setDebugMsg] = useState(""); // ✅ Pour afficher le debug à l'écran
  
  const isSelf = myId === targetId;

  const check = useCallback(async () => {
    setDebugMsg(`myId: ${myId?.substring(0, 8) || "null"}`);
    
    if (!myId || isGuest) {
      setDebugMsg("❌ Pas d'ID utilisateur");
      setIsFollowing(false); 
      setLoading(false); 
      return;
    }
    
    if (!targetId || isSelf) {
      setDebugMsg("❌ Pas de cible ou soi-même");
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
      setDebugMsg(`❌ Erreur: ${error.message.substring(0, 30)}`);
      console.error("Erreur check:", error);
    } else {
      setDebugMsg(`✅ Vérifié`);
    }
      
    setIsFollowing(!!data);
    setLoading(false);
  }, [myId, targetId, isGuest, isSelf]);

  useEffect(() => { check(); }, [check]);

  const toggle = async (e) => {
    e.stopPropagation();
    
    // ✅ AFFICHAGE MOBILES : Alerte pour voir ce qui se passe
    if (!myId) {
      alert("❌ PROBLÈME: myId est undefined\n\nLe composant parent ne transmet pas l'ID de l'utilisateur connecté.");
      return;
    }
    
    if (!targetId) {
      alert("❌ PROBLÈME: targetId est undefined\n\nL'ID de la cible n'est pas transmis.");
      return;
    }
    
    if (isSelf) {
      alert("ℹ️ Vous ne pouvez pas vous suivre vous-même.");
      return;
    }

    const prev = isFollowing;
    setIsFollowing(!prev);
    setLoading(true);
    setDebugMsg("⏳ Envoi...");
    
    try {
      if (prev) {
        setDebugMsg("🗑️ Suppression...");
        const { error } = await supabase.from("follows").delete()
          .eq("follower_id", myId)
          .eq("followed_id", targetId);
        
        if (error) {
          alert(`❌ Erreur désabonnement:\n${error.message}`);
          throw error;
        }
        setDebugMsg("✅ Désabonné");
      } else {
        setDebugMsg("➕ Insertion...");
        const { error } = await supabase.from("follows").upsert(
          { follower_id: myId, followed_id: targetId, status: 'accepted', is_friend: false },
          { onConflict: 'follower_id,followed_id' }
        );
        
        if (error) {
          alert(`❌ Erreur abonnement:\n${error.message}\n\nCela signifie souvent que les politiques RLS bloquent l'insertion.`);
          throw error;
        }
        setDebugMsg("✅ Abonné");
      }
    } catch (err) {
      console.error("ERREUR:", err);
      setIsFollowing(prev);
    } finally {
      setLoading(false);
    }
  };

  if (isSelf) return null;

  return (
    <div className="flex flex-col items-center gap-1">
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
      {/* ✅ AFFICHAGE DU DEBUG SOUS LE BOUTON */}
      <span className="text-[9px] text-gray-400 max-w-[120px] truncate">
        {debugMsg}
      </span>
    </div>
  );
};

export default FollowButton;
