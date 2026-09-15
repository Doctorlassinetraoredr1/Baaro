import { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient.js";
import { useToast } from "../../components/ToastContext.jsx";

export default function FollowButton({ targetUserId, currentUserId }) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    let active = true;
    if (!currentUserId || !targetUserId || currentUserId === targetUserId) return undefined;
    (async () => {
      const { data, error } = await supabase.from("follows").select("follower_id")
        .eq("follower_id", currentUserId).eq("followed_id", targetUserId)
        .eq("status", "accepted").maybeSingle();
      if (!error && active) setIsFollowing(Boolean(data));
    })();
    return () => { active = false; };
  }, [currentUserId, targetUserId]);

  const handleToggle = async () => {
    if (!currentUserId || !targetUserId || currentUserId === targetUserId || loading) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("toggle_follow", { p_target: targetUserId });
      if (error) throw error;
      const following = Boolean(data);
      setIsFollowing(following);
      showToast(following ? "Abonnement réussi !" : "Désabonné", following ? "success" : "info");
    } catch (error) {
      console.error("Erreur follow:", error);
      showToast(error?.message || "Erreur lors de l'abonnement", "error");
    } finally { setLoading(false); }
  };

  if (currentUserId === targetUserId) return null;
  return <button onClick={handleToggle} disabled={loading} className={`px-4 py-2 rounded-full font-medium transition-all ${isFollowing ? "bg-gray-200 text-gray-800" : "bg-blue-600 text-white"} ${loading ? "opacity-70" : ""}`}>
    {loading ? "..." : isFollowing ? "✓ Abonné" : "+ S'abonner"}
  </button>;
}
