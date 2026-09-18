import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../supabaseClient";
import { COLORS } from "../../theme.js";

function useCurrentUser() {
  const [id, setId] = useState(null);
  useEffect(() => {
    const get = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) setId(user.id);
        else {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user?.id) setId(session.user.id);
        }
      } catch {}
    };
    get();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setId(session?.user?.id || null);
    });
    return () => sub?.subscription?.unsubscribe();
  }, []);
  return id;
}

const FollowButton = ({ targetId }) => {
  const id = useCurrentUser();
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const isSelf = id === targetId;

  const check = useCallback(async () => {
    if (!id || !targetId || isSelf) {
      setIsFollowing(false); 
      setLoading(false); 
      return;
    }
    const { data, error } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", id)
      .eq("followed_id", targetId)
      .eq("status", "accepted")
      .maybeSingle();
    if (error && error.code !== 'PGRST116') console.error("check", error);
    setIsFollowing(!!data);
    setLoading(false);
  }, [id, targetId, isSelf]);

  useEffect(() => { check(); }, [check]);

  const toggle = async (e) => {
    e.stopPropagation();
    if (!id || !targetId || isSelf) return;
    const prev = isFollowing;
    setIsFollowing(!prev);
    setLoading(true);
    try {
      if (prev) {
        const { error } = await supabase.from("follows").delete()
          .eq("follower_id", id)
          .eq("followed_id", targetId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("follows").insert(
          { follower_id: id, followed_id: targetId, status: 'accepted', is_friend: false }
        );
        if (error) throw error;
      }
    } catch (err) {
      console.error(err);
      setIsFollowing(prev);
    } finally {
      setLoading(false);
    }
  };

  if (isSelf) return null;

  return (
    <button 
      onClick={toggle} 
      disabled={loading}
      className="px-4 py-1.5 rounded-full text-xs font-black transition-all active:scale-95 disabled:opacity-50 hover:scale-105 shadow-lg"
      style={{ 
        background: isFollowing ? "rgba(255,255,255,0.08)" : `linear-gradient(135deg, ${COLORS.gold}, #ff8c42)`,
        color: isFollowing ? COLORS.ivory : COLORS.bg,
      }}
    >
      {loading ? "..." : isFollowing ? "Abonné" : "Suivre"}
    </button>
  );
};

export default FollowButton;
