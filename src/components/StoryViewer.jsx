import { useEffect, useMemo, useRef, useState } from "react";
import { Heart, X, Send, Pause, Play, BarChart3 } from "lucide-react";
import { supabase } from "../supabaseClient";

const REACTIONS = [
  ["love","❤️"],["laugh","😂"],["wow","😮"],["sad","😢"],["angry","😡"],["support","🤝"]
];

export function StoryViewer({ group, onClose, currentUserId }) {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reaction, setReaction] = useState(null);
  const [poll, setPoll] = useState(null);
  const [pollCounts, setPollCounts] = useState({});
  const [myVote, setMyVote] = useState(null);
  const startedAt = useRef(Date.now());
  const videoRef = useRef(null);
  const story = group?.stories?.[index];

  const duration = useMemo(() => {
    const sec = Number(story?.duration_seconds || (story?.story_type === "video" ? 15 : 5));
    return Math.max(3, Math.min(60, sec)) * 1000;
  }, [story]);

  useEffect(() => {
    if (!story) return;
    startedAt.current = Date.now();
    setProgress(0);
    setPaused(false);
    setReaction(null);
    setPoll(null);
    setPollCounts({});
    setMyVote(null);

    if (currentUserId) {
      supabase.from("story_views")
        .upsert({ story_id: story.id, viewer_id: currentUserId, viewed_at: new Date().toISOString() })
        .then(() => {});
    }

    const loadExtras = async () => {
      const { data: r } = currentUserId
        ? await supabase.from("story_reactions").select("reaction").eq("story_id", story.id).eq("user_id", currentUserId).maybeSingle()
        : { data: null };
      setReaction(r?.reaction || null);

      if (story.story_type === "poll") {
        const { data: p } = await supabase.from("story_polls").select("id,question").eq("story_id", story.id).maybeSingle();
        if (p) {
          const { data: opts } = await supabase.from("story_poll_options").select("id,option_text,position").eq("poll_id", p.id).order("position");
          const { data: votes } = await supabase.from("story_poll_votes").select("option_id,user_id").eq("poll_id", p.id);
          const counts = {};
          (votes || []).forEach(v => { counts[v.option_id] = (counts[v.option_id] || 0) + 1; });
          setPoll({ ...p, options: opts || [] });
          setPollCounts(counts);
          setMyVote((votes || []).find(v => v.user_id === currentUserId)?.option_id || null);
        }
      }
    };
    loadExtras();

    if (story.story_type === "video" && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }

    const tick = () => {
      if (paused || story.story_type === "video") return;
      const p = Math.min(100, ((Date.now() - startedAt.current) / duration) * 100);
      setProgress(p);
      if (p >= 100) next();
    };
    const timer = setInterval(tick, 50);
    return () => clearInterval(timer);
  }, [index, story?.id, paused, duration, currentUserId]);

  const next = () => {
    if (index < (group?.stories?.length || 1) - 1) setIndex(i => i + 1);
    else onClose();
  };
  const previous = () => index > 0 && setIndex(i => i - 1);

  const onVideoTime = (e) => {
    const v = e.currentTarget;
    if (v.duration) setProgress(Math.min(100, (v.currentTime / v.duration) * 100));
  };

  const react = async (value) => {
    if (!currentUserId) return;
    if (reaction === value) {
      await supabase.from("story_reactions").delete().eq("story_id", story.id).eq("user_id", currentUserId);
      setReaction(null);
    } else {
      await supabase.from("story_reactions").upsert({ story_id: story.id, user_id: currentUserId, reaction: value });
      setReaction(value);
    }
  };

  const vote = async (optionId) => {
    if (!currentUserId || !poll) return;
    const { error } = await supabase.rpc("vote_story_poll", { p_poll_id: poll.id, p_option_id: optionId });
    if (error) return;
    setMyVote(optionId);
    setPollCounts(c => ({ ...c, [optionId]: (c[optionId] || 0) + (myVote ? 0 : 1) }));
  };

  if (!story) return null;
  const totalVotes = Object.values(pollCounts).reduce((a,b) => a+b, 0);

  return (
    <div className="fixed inset-0 z-[110] bg-black flex flex-col select-none">
      <div className="absolute top-3 left-3 right-3 flex gap-1 z-30">
        {group.stories.map((_, i) => (
          <div key={i} className="h-1 flex-1 rounded-full bg-white/25 overflow-hidden">
            <div className="h-full bg-white" style={{ width: i < index ? "100%" : i === index ? `${progress}%` : "0%" }} />
          </div>
        ))}
      </div>

      <div className="absolute top-7 left-4 right-4 z-30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-white/10 overflow-hidden flex items-center justify-center">
            {group.author?.avatar_url ? <img src={group.author.avatar_url} className="w-full h-full object-cover" alt="" /> : group.author?.flag || "🌍"}
          </div>
          <div>
            <div className="text-white text-sm font-bold">@{group.author?.handle || "membre"}</div>
            <div className="text-white/60 text-[10px]">{new Date(story.created_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setPaused(p => !p)} className="p-2 text-white">{paused ? <Play size={20}/> : <Pause size={20}/>}</button>
          <button onClick={onClose} className="p-2 text-white"><X size={24}/></button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {story.story_type === "video" ? (
          <video ref={videoRef} src={story.media_url} autoPlay playsInline
            onTimeUpdate={onVideoTime} onEnded={next}
            className="max-h-full max-w-full object-contain" />
        ) : story.story_type === "image" ? (
          <img src={story.media_url} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <div className="w-full max-w-lg mx-auto min-h-[55vh] flex items-center justify-center p-8 text-center rounded-3xl"
               style={{ background: story.background || "#172033" }}>
            {story.story_type === "poll" && !story.text && <BarChart3 className="absolute top-1/3 text-white/20" size={80}/>}
            <div className="relative z-10 w-full">
              {story.text && <p className="text-white text-3xl font-extrabold break-words">{story.text}</p>}
            </div>
          </div>
        )}

        {story.text_overlay && story.story_type !== "text" && (
          <div className="absolute bottom-28 left-5 right-5 text-center">
            <p className="text-white text-xl font-bold drop-shadow-lg break-words">{story.text_overlay}</p>
          </div>
        )}

        {poll && (
          <div className="absolute bottom-24 left-4 right-4 max-w-lg mx-auto rounded-2xl bg-black/70 backdrop-blur p-4">
            <p className="text-white font-bold mb-3">{poll.question}</p>
            <div className="space-y-2">
              {poll.options.map(o => {
                const count = pollCounts[o.id] || 0;
                const pct = totalVotes ? Math.round(count / totalVotes * 100) : 0;
                return (
                  <button key={o.id} onClick={() => vote(o.id)} className="w-full text-left rounded-xl px-3 py-2 border border-white/15 text-white relative overflow-hidden">
                    <span className="absolute inset-y-0 left-0 bg-white/10" style={{width:`${pct}%`}} />
                    <span className="relative z-10 flex justify-between"><span>{o.option_text}</span><span>{pct}%</span></span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-5 left-4 right-4 z-30 flex items-center gap-2">
        <div className="flex gap-1 overflow-x-auto">
          {REACTIONS.map(([value, emoji]) => (
            <button key={value} onClick={() => react(value)}
              className={`w-9 h-9 rounded-full bg-white/10 ${reaction === value ? "ring-2 ring-yellow-400" : ""}`}>{emoji}</button>
          ))}
        </div>
        <button className="ml-auto w-10 h-10 rounded-full bg-white/10 text-white"><Send size={17}/></button>
      </div>

      <div className="absolute inset-0 z-20 flex pointer-events-none">
        <button className="w-1/3 h-full pointer-events-auto" onClick={previous} aria-label="Story précédente" />
        <div className="w-1/3 h-full" />
        <button className="w-1/3 h-full pointer-events-auto" onClick={next} aria-label="Story suivante" />
      </div>
    </div>
  );
}
