import { useCallback, useEffect, useMemo, useState } from "react";
import { Bookmark, Check, Share2, UserPlus, X, Zap } from "lucide-react";
import { COLORS } from "../../theme.js";
import { supabase } from "../../supabaseClient.js";
import { useToast } from "../../components/ToastContext.jsx";

const REACTIONS = [
  { id: "love", label: "❤️", title: "J’adore" },
  { id: "laugh", label: "😂", title: "Drôle" },
  { id: "wow", label: "😮", title: "Waouh" },
  { id: "sad", label: "😢", title: "Triste" },
  { id: "angry", label: "😡", title: "En colère" },
  { id: "support", label: "🤝", title: "Soutien" },
];

// ==========================================
// 1. COMPOSANT POLL CARD (avec stats votants)
// ==========================================
export function PollCard({ postId, userId }) {
  const { showToast } = useToast();
  const [poll, setPoll] = useState(null);
  const [rows, setRows] = useState([]);
  const [myVote, setMyVote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showVoters, setShowVoters] = useState(false);
  const [votersData, setVotersData] = useState([]);
  const [loadingVoters, setLoadingVoters] = useState(false);

  const load = useCallback(async () => {
    if (!postId) return;
    const { data: pollRow } = await supabase.from("polls").select("id,question").eq("post_id", postId).maybeSingle();
    if (!pollRow) { setPoll(null); return; }
    
    const [{ data: resultRows }, { data: mine }] = await Promise.all([
      supabase.from("poll_results").select("option_id,option_text,position,vote_count").eq("poll_id", pollRow.id).order("position"),
      userId ? supabase.from("poll_votes").select("option_id").eq("poll_id", pollRow.id).eq("id", userId).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    
    setPoll(pollRow);
    setRows(resultRows || []);
    setMyVote(mine?.option_id || null);
  }, [postId, userId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!poll?.id) return;
    const channel = supabase
      .channel(`poll-${poll.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "poll_votes", filter: `poll_id=eq.${poll.id}` }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [poll?.id, load]);

  if (!poll) return null;
  const total = rows.reduce((n, r) => n + Number(r.vote_count || 0), 0);

  const vote = async (optionId) => {
    if (!userId) return showToast("Connectez-vous pour voter", "info");
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("vote_poll", { p_poll_id: poll.id, p_option_id: optionId });
      if (error) throw error;
      setMyVote(optionId);
      await load();
    } catch (error) {
      showToast(error?.message === "SOCIAL_RATE_LIMIT" ? "Trop d'actions, réessayez." : "Vote impossible", "error");
    } finally { setBusy(false); }
  };

  const openVoters = async () => {
    if (!userId) return showToast("Connectez-vous pour voir les votants", "info");
    setShowVoters(true);
    setLoadingVoters(true);
    try {
      const { data, error } = await supabase.rpc("get_poll_voters", { p_poll_id: poll.id });
      if (error) throw error;
      setVotersData(data || []);
    } catch (error) {
      showToast(error?.message === "ACCESS_DENIED" ? "Accès refusé" : "Impossible de charger les votants", "error");
      setShowVoters(false);
    } finally { setLoadingVoters(false); }
  };

  return (
    <>
      <div className="rounded-xl border p-3" style={{ borderColor: COLORS.borderTeal, background: COLORS.surface }}>
        <p className="font-semibold text-sm mb-3" style={{ color: COLORS.ivory }}>{poll.question}</p>
        <div className="space-y-2">
          {rows.map((row) => {
            const active = myVote === row.option_id;
            const p = total ? Math.round((Number(row.vote_count || 0) / total) * 100) : 0;
            return (
              <button 
                key={row.option_id} type="button" disabled={busy} onClick={() => vote(row.option_id)}
                className="relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-xs transition disabled:opacity-60"
                style={{ borderColor: active ? COLORS.borderTeal : COLORS.border, color: COLORS.ivory }}
              >
                <span className="absolute inset-y-0 left-0 opacity-20" style={{ width: `${p}%`, background: COLORS.teal }} />
                <span className="relative flex items-center justify-between gap-3">
                  <span>{row.option_text}{active ? " ✓" : ""}</span>
                  <span className="font-bold">{p}% · {row.vote_count}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-[10px]" style={{ color: COLORS.muted }}>{total} vote{total > 1 ? "s" : ""} · Vous pouvez changer votre vote</p>
          {total > 0 && userId && (
            <button type="button" onClick={openVoters} className="text-[10px] font-bold hover:underline" style={{ color: COLORS.teal }}>
              Voir les votants 👥
            </button>
          )}
        </div>
      </div>

      {showVoters && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowVoters(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md max-h-[80vh] overflow-hidden rounded-2xl border shadow-2xl flex flex-col" style={{ background: COLORS.surface, borderColor: COLORS.borderGold }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: COLORS.border }}>
              <h3 className="font-bold text-sm" style={{ color: COLORS.ivory }}>Qui a voté ?</h3>
              <button type="button" onClick={() => setShowVoters(false)} className="p-1 rounded-lg hover:bg-white/5" style={{ color: COLORS.muted }}><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loadingVoters ? (
                <div className="text-center py-8 text-xs" style={{ color: COLORS.muted }}>Chargement...</div>
              ) : votersData.length === 0 ? (
                <div className="text-center py-8 text-xs" style={{ color: COLORS.muted }}>Aucun votant</div>
              ) : (
                votersData.map((option) => (
                  <div key={option.option_id}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-bold text-xs" style={{ color: COLORS.ivory }}>{option.option_text}</p>
                      <span className="text-[10px]" style={{ color: COLORS.muted }}>{option.voters.length} vote{option.voters.length > 1 ? "s" : ""}</span>
                    </div>
                    {option.voters.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {option.voters.map((voter) => (
                          <div key={voter.id} className="flex items-center gap-2 px-2 py-1 rounded-lg border" style={{ borderColor: COLORS.border, background: COLORS.surface2 }}>
                            <div className="w-6 h-6 rounded-full overflow-hidden border flex items-center justify-center text-[10px] font-bold" style={{ borderColor: COLORS.borderGold }}>
                              {voter.avatar_url ? <img src={voter.avatar_url} alt="" className="w-full h-full object-cover" /> : <span style={{ color: COLORS.gold }}>{voter.display_name?.charAt(0) || "?"}</span>}
                            </div>
                            <span className="text-[10px]" style={{ color: COLORS.ivory }}>{voter.display_name || "Membre"}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] italic" style={{ color: COLORS.muted }}>Aucun vote pour cette option</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ==========================================
// 2. COMPOSANT SOCIAL POST ENHANCEMENTS
// ==========================================
export function SocialPostEnhancements({ post, userId }) {
  const { showToast } = useToast();
  const [reaction, setReaction] = useState(null);
  const [reactionCount, setReactionCount] = useState(0);
  const [picker, setPicker] = useState(false);
  const [saved, setSaved] = useState(false);
  const [shareCount, setShareCount] = useState(0);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!post?.id) return;
    const [r, s, b, f] = await Promise.all([
      supabase.from("post_reactions").select("reaction,id").eq("post_id", post.id),
      supabase.from("post_shares").select("post_id", { count: "exact", head: true }).eq("post_id", post.id),
      userId ? supabase.from("post_bookmarks").select("post_id").eq("post_id", post.id).eq("id", userId).maybeSingle() : Promise.resolve({ data: null }),
      userId && post.author_id !== userId ? supabase.from("follows").select("followed_id").eq("follower_id", userId).eq("followed_id", post.author_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const reactionRows = r.data || [];
    setReactionCount(reactionRows.length);
    setReaction(reactionRows.find(x => x.id === userId)?.reaction || null);
    setSaved(!!b.data); setShareCount(s.count || 0); setFollowing(!!f.data);
  }, [post?.id, post?.author_id, userId]);

  useEffect(() => { load(); }, [load]);
  const current = useMemo(() => REACTIONS.find(x => x.id === reaction), [reaction]);

  const chooseReaction = async (value) => {
    if (!userId) return showToast("Connectez-vous pour réagir", "info");
    if (busy) return; setBusy(true);
    try {
      if (reaction === value) {
        const { error } = await supabase.from("post_reactions").delete().eq("post_id", post.id).eq("id", userId);
        if (error) throw error; setReaction(null); setReactionCount(n => Math.max(0, n - 1));
      } else {
        const { error } = await supabase.from("post_reactions").upsert({ post_id: post.id, id: userId, reaction: value }, { onConflict: "post_id,id" });
        if (error) throw error; setReaction(value); if (!reaction) setReactionCount(n => n + 1);
      }
      setPicker(false);
    } catch { showToast("Impossible d’enregistrer la réaction", "error"); }
    finally { setBusy(false); }
  };

  const bookmark = async () => {
    if (!userId) return showToast("Connectez-vous pour enregistrer", "info");
    if (busy) return; setBusy(true);
    try {
      if (saved) {
        const { error } = await supabase.from("post_bookmarks").delete().eq("post_id", post.id).eq("id", userId);
        if (error) throw error; setSaved(false);
      } else {
        const { error } = await supabase.from("post_bookmarks").insert({ post_id: post.id, id: userId });
        if (error) throw error; setSaved(true);
      }
    } catch { showToast("Impossible de modifier les favoris", "error"); }
    finally { setBusy(false); }
  };

  const share = async () => {
    const url = `${window.location.origin}/?post=${post.id}`;
    let channel = "copy";
    try {
      if (navigator.share) { await navigator.share({ title: "BAARO", text: post.text?.slice(0, 120) || "Publication BAARO", url }); channel = "native"; }
      else { await navigator.clipboard.writeText(url); showToast("Lien copié", "success"); }
      if (userId) {
        const { error } = await supabase.from("post_shares").insert({ post_id: post.id, id: userId, channel });
        if (error) throw error;
      }
      setShareCount(n => n + 1);
    } catch (error) { if (error?.name !== "AbortError") showToast("Partage non enregistré", "error"); }
  };

  const follow = async () => {
    if (!userId) return showToast("Connectez-vous pour suivre", "info");
    if (userId === post.author_id || busy) return; setBusy(true);
    try {
      const { data, error } = await supabase.rpc("toggle_follow", { p_target: post.author_id });
      if (error) throw error; setFollowing(!!data);
      if (data) showToast("Vous suivez maintenant ce compte", "success");
    } catch { showToast("Impossible de modifier l’abonnement", "error"); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {post.author_id !== userId && (
        <button type="button" onClick={follow} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold border" style={{ borderColor: following ? COLORS.borderTeal : COLORS.border, color: following ? COLORS.teal : COLORS.muted }}>
          {following ? <Check size={13} /> : <UserPlus size={13} />} {following ? "Abonné" : "Suivre"}
        </button>
      )}
      <div className="relative">
        <button type="button" onClick={() => setPicker(v => !v)} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs border" style={{ borderColor: COLORS.border, color: current ? COLORS.ivory : COLORS.muted }}>
          <span>{current?.label || "🙂"}</span><span>{reactionCount || "Réagir"}</span>
        </button>
        {picker && <div className="absolute bottom-full left-0 z-30 mb-1 flex gap-1 rounded-xl border p-2 shadow-xl" style={{ background: COLORS.surface, borderColor: COLORS.borderGold }}>
          {REACTIONS.map(x => <button key={x.id} type="button" title={x.title} onClick={() => chooseReaction(x.id)} className="rounded-lg p-1.5 text-lg hover:bg-white/10">{x.label}</button>)}
        </div>}
      </div>
      <button type="button" onClick={bookmark} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs" style={{ color: saved ? COLORS.gold : COLORS.muted }}>
        <Bookmark size={15} fill={saved ? "currentColor" : "none"} />{saved ? "Enregistré" : "Enregistrer"}
      </button>
      <button type="button" onClick={share} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ml-auto" style={{ color: COLORS.muted }}>
        <Share2 size={15} />{shareCount || "Partager"}
      </button>
    </div>
  );
}

// ==========================================
// 3. COMPOSANT SOCIAL SUGGESTIONS (L'EXPORT MANQUANT)
// ==========================================
export function SocialSuggestions({ userId, onOpenProfile }) {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [busyId, setBusyId] = useState(null);
  
  useEffect(() => {
    if (!userId) return;
    supabase.rpc("get_social_suggestions", { p_limit: 6 }).then(({ data }) => setItems(data || []));
  }, [userId]);

  const follow = async (item) => {
    const target = item?.id;
    if (!target) return;
    setBusyId(target);
    try {
      const { data, error } = await supabase.rpc("toggle_follow", { p_target: target });
      if (error) throw error;
      if (data) {
        setItems(prev => prev.filter(x => x.id !== target));
        showToast("Abonnement ajouté", "success");
      }
    } catch {
      showToast("Impossible de suivre ce compte", "error");
    } finally {
      setBusyId(null);
    }
  };

  if (!items.length) return null;
  return (
    <section className="glass-card rounded-2xl p-4 border" style={{ borderColor: COLORS.border }}>
      <div className="flex items-center gap-2 mb-3">
        <Zap size={16} style={{ color: COLORS.gold }} />
        <h3 className="font-bold text-sm" style={{ color: COLORS.ivory }}>Comptes à découvrir</h3>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {items.map(item => {
          return (
            <div key={item.id} className="min-w-[160px] rounded-xl border p-3" style={{ borderColor: COLORS.border, background: COLORS.surface }}>
              <button type="button" onClick={() => onOpenProfile?.(item.id)} className="flex items-center gap-2 text-left w-full">
                <div className="w-9 h-9 rounded-full overflow-hidden border flex items-center justify-center" style={{ borderColor: COLORS.borderGold }}>
                  {item.avatar_url ? <img src={item.avatar_url} alt="" className="w-full h-full object-cover" /> : <span style={{ color: COLORS.gold }}>{item.full_name?.charAt(0) || "?"}</span>}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-xs truncate" style={{ color: COLORS.ivory }}>{item.full_name || "Membre"}</p>
                  <p className="text-[10px] truncate" style={{ color: COLORS.muted }}>{item.handle || ""}</p>
                </div>
              </button>
              <button type="button" onClick={() => follow(item)} disabled={busyId === item.id} className="mt-2 w-full rounded-lg py-1.5 text-[11px] font-bold" style={{ background: COLORS.gold, color: COLORS.bg }}>
                {busyId === item.id ? "…" : "Suivre"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
