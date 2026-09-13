import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "../supabaseClient";
import { COLORS } from "../theme.js";

export function StoriesBar({ onOpenStory, onCreateStory, refreshKey = 0 }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("stories")
      .select("id,author_id,story_type,media_url,media_type,text,text_overlay,background,created_at,expires_at,duration_seconds")
      .gt("expires_at", now)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("stories:", error);
      setGroups([]);
      setLoading(false);
      return;
    }

    const rows = data || [];
    const ids = [...new Set(rows.map((s) => s.author_id).filter(Boolean))];
    let profileMap = {};
    if (ids.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id,display_name,handle,flag,avatar_url")
        .in("user_id", ids);
      (profiles || []).forEach((p) => { profileMap[p.user_id] = p; });
    }

    const map = {};
    rows.forEach((story) => {
      if (!map[story.author_id]) {
        map[story.author_id] = {
          authorId: story.author_id,
          author: profileMap[story.author_id] || { display_name: "Membre", handle: "membre", flag: "🌍" },
          stories: [],
        };
      }
      map[story.author_id].stories.push(story);
    });
    setGroups(Object.values(map));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("stories-bar-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "stories" }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [load, refreshKey]);

  return (
    <div className="flex gap-3 overflow-x-auto px-3 py-3 min-h-[100px] no-scrollbar">
      <button onClick={onCreateStory} className="flex-shrink-0 flex flex-col items-center gap-1.5">
        <div className="w-16 h-16 rounded-full border-2 border-dashed flex items-center justify-center"
             style={{ borderColor: COLORS.gold }}>
          <Plus size={22} style={{ color: COLORS.gold }} />
        </div>
        <span className="text-[11px] font-semibold text-yellow-400">Ta story</span>
      </button>

      {loading ? [1,2,3].map((i) => (
        <div key={i} className="w-16 h-16 rounded-full bg-white/10 animate-pulse shrink-0" />
      )) : groups.map((g) => (
        <button key={g.authorId} onClick={() => onOpenStory?.(g)}
          className="flex-shrink-0 flex flex-col items-center gap-1.5">
          <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500">
            <div className="w-full h-full rounded-full overflow-hidden border-2 border-black bg-gray-800 flex items-center justify-center text-xl">
              {g.author?.avatar_url ? <img src={g.author.avatar_url} className="w-full h-full object-cover" alt="" /> :
                g.author?.flag || "🌍"}
            </div>
          </div>
          <span className="text-[10px] text-gray-300 max-w-[64px] truncate">
            {g.author?.handle || g.author?.display_name || "membre"}
          </span>
        </button>
      ))}
    </div>
  );
}
