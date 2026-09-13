import { useEffect, useMemo, useState } from "react";
import { Compass, Play, Store, Users, Radio, Hash, Sparkles } from "lucide-react";
import { supabase } from "../supabaseClient.js";
import { COLORS } from "../theme.js";

/**
 * Standalone BAARO discovery hub.
 * It intentionally uses existing social tables and degrades gracefully
 * when optional tables are not yet migrated.
 */
export function DiscoverHub({ userId, onOpenPost, onOpenLive, onOpenProfile }) {
  const [videos, setVideos] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);

      const [{ data: videoRows }, { data: suggestionRows }] = await Promise.all([
        supabase
          .from("posts")
          .select("id,author_id,text,media_url,media_type,created_at,likes_count,comments_count")
          .eq("media_type", "video")
          .order("created_at", { ascending: false })
          .limit(20),
        userId
          ? supabase.rpc("get_social_suggestions", { p_user_id: userId, p_limit: 12 })
          : Promise.resolve({ data: [] }),
      ]);

      if (!active) return;
      setVideos(videoRows || []);
      setSuggestions(suggestionRows || []);
      setLoading(false);
    };

    load();
    return () => { active = false; };
  }, [userId]);

  const sections = useMemo(() => ([
    { icon: Play, title: "Vidéos", count: videos.length },
    { icon: Users, title: "Personnes", count: suggestions.length },
    { icon: Radio, title: "Lives", count: 0 },
    { icon: Store, title: "Boutiques & services", count: 0 },
    { icon: Hash, title: "Tendances", count: 0 },
  ]), [videos.length, suggestions.length]);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Compass size={20} style={{ color: COLORS.gold }} />
        <div>
          <h2 className="text-white font-bold text-lg">Découvrir</h2>
          <p className="text-xs text-white/50">Le contenu et les personnes qui comptent pour toi.</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2 overflow-x-auto">
        {sections.map(({ icon: Icon, title, count }) => (
          <button key={title} className="min-w-[92px] rounded-xl border border-white/10 p-3 text-left">
            <Icon size={17} className="mb-2" />
            <div className="text-[11px] text-white/70">{title}</div>
            <div className="text-xs text-white/40">{count}</div>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-40 rounded-2xl bg-white/5 animate-pulse" />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {videos.map((post) => (
            <button key={post.id} onClick={() => onOpenPost?.(post)}
              className="relative aspect-[9/13] overflow-hidden rounded-2xl bg-black text-left">
              {post.media_url && <video src={post.media_url} muted playsInline preload="metadata"
                className="absolute inset-0 w-full h-full object-cover" />}
              <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/90 to-transparent">
                <div className="text-white text-xs line-clamp-2">{post.text || "Vidéo BAARO"}</div>
                <div className="text-white/60 text-[10px] mt-1">♥ {post.likes_count || 0} · 💬 {post.comments_count || 0}</div>
              </div>
              <Sparkles size={15} className="absolute top-2 right-2 text-white/80" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
