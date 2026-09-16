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

  // Realtime : mise à jour instantanée des résultats
  useEffect(() => {
    if (!poll?.id) return;
    const channel = supabase
      .channel(`poll-${poll.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "poll_votes", filter: `poll_id=eq.${poll.id}` }, () => {
        load();
      })
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
    } finally { 
      setBusy(false); 
    }
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
    } finally {
      setLoadingVoters(false);
    }
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
                key={row.option_id} 
                type="button" 
                disabled={busy} 
                onClick={() => vote(row.option_id)}
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
          <p className="text-[10px]" style={{ color: COLORS.muted }}>
            {total} vote{total > 1 ? "s" : ""} · Vous pouvez changer votre vote
          </p>
          {total > 0 && userId && (
            <button
              type="button"
              onClick={openVoters}
              className="text-[10px] font-bold hover:underline"
              style={{ color: COLORS.teal }}
            >
              Voir les votants 👥
            </button>
          )}
        </div>
      </div>

      {/* Modal des votants */}
      {showVoters && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowVoters(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[80vh] overflow-hidden rounded-2xl border shadow-2xl flex flex-col"
            style={{ background: COLORS.surface, borderColor: COLORS.borderGold }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: COLORS.border }}>
              <h3 className="font-bold text-sm" style={{ color: COLORS.ivory }}>Qui a voté ?</h3>
              <button
                type="button"
                onClick={() => setShowVoters(false)}
                className="p-1 rounded-lg hover:bg-white/5"
                style={{ color: COLORS.muted }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loadingVoters ? (
                <div className="text-center py-8 text-xs" style={{ color: COLORS.muted }}>
                  Chargement...
                </div>
              ) : votersData.length === 0 ? (
                <div className="text-center py-8 text-xs" style={{ color: COLORS.muted }}>
                  Aucun votant
                </div>
              ) : (
                votersData.map((option) => (
                  <div key={option.option_id}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-bold text-xs" style={{ color: COLORS.ivory }}>
                        {option.option_text}
                      </p>
                      <span className="text-[10px]" style={{ color: COLORS.muted }}>
                        {option.voters.length} vote{option.voters.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    {option.voters.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {option.voters.map((voter) => (
                          <div
                            key={voter.id}
                            className="flex items-center gap-2 px-2 py-1 rounded-lg border"
                            style={{ borderColor: COLORS.border, background: COLORS.surface2 }}
                          >
                            <div
                              className="w-6 h-6 rounded-full overflow-hidden border flex items-center justify-center text-[10px] font-bold"
                              style={{ borderColor: COLORS.borderGold }}
                            >
                              {voter.avatar_url ? (
                                <img src={voter.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span style={{ color: COLORS.gold }}>
                                  {voter.display_name?.charAt(0) || "?"}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px]" style={{ color: COLORS.ivory }}>
                              {voter.display_name || "Membre"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] italic" style={{ color: COLORS.muted }}>
                        Aucun vote pour cette option
                      </p>
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
