import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient.js";

export function useFollow(userId, targetId) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!userId || !targetId || userId === targetId) { setIsFollowing(false); return; }
    const { data, error } = await supabase.from("follows")
      .select("follower_id")
      .eq("follower_id", userId).eq("followed_id", targetId)
      .eq("status", "accepted").eq("is_friend", false).maybeSingle();
    if (!error) setIsFollowing(Boolean(data));
  }, [userId, targetId]);

  useEffect(() => { reload(); }, [reload]);

  const toggleFollow = useCallback(async () => {
    if (!userId || !targetId || userId === targetId || loading) return false;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("toggle_follow", { p_target: targetId });
      if (error) throw error;
      const following = Boolean(data);
      setIsFollowing(following);
      return following;
    } catch (error) {
      console.error("Erreur abonnement:", error);
      return false;
    } finally { setLoading(false); }
  }, [userId, targetId, loading]);

  return { isFollowing, toggleFollow, loading, reload };
}

export function useComments(postId) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    const { data } = await supabase.from("comments").select("id, text, created_at, author_id, profiles(display_name, handle, flag)").eq("post_id", postId).order("created_at", { ascending: true });
    setComments((data || []).map(c => ({ id:c.id, text:c.text, author:c.profiles?.display_name||"Membre", handle:c.profiles?.handle||"", flag:c.profiles?.flag||"🌍", created_at:c.created_at })));
    setLoading(false);
  }, [postId]);
  useEffect(() => { load(); }, [load]);
  const addComment = useCallback(async (userId, text) => {
    if (!userId || !text?.trim()) return false;
    const { error } = await supabase.from("comments").insert({ post_id:postId, author_id:userId, text:text.trim() });
    if (!error) { await load(); return true; }
    return false;
  }, [postId, load]);
  return { comments, loading, addComment, reload:load };
}
