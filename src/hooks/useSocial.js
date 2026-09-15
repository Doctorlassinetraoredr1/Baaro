import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient.js";

export function useFollow(userId, targetId) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (!userId || !targetId || userId === targetId) {
      setIsFollowing(false);
      return undefined;
    }
    (async () => {
      const { data } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", userId)
        .eq("followed_id", targetId)
        .eq("status", "accepted")
        .maybeSingle();
      if (active) setIsFollowing(Boolean(data));
    })();
    return () => { active = false; };
  }, [userId, targetId]);

  const toggleFollow = useCallback(async () => {
    if (!userId || !targetId || userId === targetId || loading) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("toggle_follow", { p_target: targetId });
      if (error) throw error;
      setIsFollowing(Boolean(data));
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  }, [userId, targetId, loading]);

  return { isFollowing, toggleFollow, loading };
}

export function useComments(postId) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    const { data } = await supabase
      .from("comments")
      .select("id, text, created_at, author_id, profiles(display_name, handle, flag)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    setComments((data || []).map((c) => ({
      id: c.id, text: c.text, author: c.profiles?.display_name || "Membre",
      handle: c.profiles?.handle || "", flag: c.profiles?.flag || "🌍", created_at: c.created_at,
    })));
    setLoading(false);
  }, [postId]);

  useEffect(() => { load(); }, [load]);

  const addComment = useCallback(async (currentUserId, text) => {
    if (!currentUserId || !text?.trim()) return false;
    const { error } = await supabase.from("comments").insert({
      post_id: postId, author_id: currentUserId, text: text.trim(),
    });
    if (!error) { await load(); return true; }
    return false;
  }, [postId, load]);

  return { comments, loading, addComment, reload: load };
}
