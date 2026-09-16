import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "../../contexts/AppContext";
import { supabase } from "../../supabaseClient";

const FollowButton = ({ targetId, onRequireAuth }) => {
  const { user, isGuest } = useApp(); // user.id = ton id du profil
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  const myId = user?.id;
  const isSelf = myId === targetId;

  const check = useCallback(async () => {
    if (!myId || isGuest ||!targetId || isSelf) {
      setIsFollowing(false); setLoading(false); return;
    }
    const { data } = await supabase
     .from("follows")
     .select("follower_id")
     .eq("follower_id", myId)
     .eq("followed_id", targetId)
     .limit(1)
     .maybeSingle();
    setIsFollowing(!!data);
    setLoading(false);
  }, [myId, targetId, isGuest, isSelf]);

  useEffect(() => { check(); }, [check]);

  const toggle = async (e) => {
    e.stopPropagation();
    if (isGuest ||!myId) return onRequireAuth?.();
    if (!targetId || isSelf || loading) return;

    const prev = isFollowing;
    setIsFollowing(!prev);
    setLoading(true);
    try {
      if (prev) {
        await supabase.from("follows").delete()
         .eq("follower_id", myId).eq("followed_id", targetId).throwOnError();
      } else {
        await supabase.from("follows").upsert(
          { follower_id: myId, followed_id: targetId },
          { onConflict: 'follower_id,followed_id' }
        ).throwOnError();

        // notif avec receiver_id, pas user_id
        await supabase.from("notifications").insert({
          receiver_id: targetId,
          actor_id: myId,
          type: 'follow'
        });
      }
    } catch (err) {
      console.error(err.message);
      setIsFollowing(prev);
    } finally {
      setLoading(false);
    }
  };

  if (isSelf) return null;

  return (
    <button onClick={toggle} disabled={loading}
      className={`px-4 py-1.5 rounded-full text-sm font-bold transition
        ${isFollowing? "bg-zinc-200 text-black" : "bg-[#FF6B00] text-white"}`}>
      {loading? "..." : isFollowing? "Abonné(e)" : "S'abonner"}
    </button>
  );
};

export default FollowButton;
