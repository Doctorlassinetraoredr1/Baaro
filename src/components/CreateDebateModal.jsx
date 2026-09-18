import { useState, useMemo } from "react";
import {
  X, Mic, Video, MessageSquare, Sparkles, Zap, Paperclip, Layers,
} from "lucide-react";
import { COLORS } from "../theme.js";
import { randomCode } from "../lib/id.js";
import { supabase } from "../supabaseClient.js";
import { API_BASE } from "../config.js";

const TOPIC_SUGGESTIONS = ["Tech & IA", "Afrique", "Économie", "Culture", "Sport", "Société"];

const MODES = [
  { id: "hybrid", icon: Layers, label: "Tout", hint: "Texte · Voix · Vidéo · Fichiers" },
  { id: "video", icon: Video, label: "Vidéo", hint: "Caméra + chat" },
  { id: "audio", icon: Mic, label: "Audio", hint: "Voix + chat" },
  { id: "text", icon: MessageSquare, label: "Texte", hint: "Chat + fichiers" },
];

export function CreateDebateModal({ isOpen, onClose, id, onSuccess }) {
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [mode, setMode] = useState("hybrid");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // AMÉLIORATION : Identifiant unique sécurisé (fallback si la prop 'id' est manquante)
  const safeId = useMemo(() => id || `guest_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, [id]);

  if (!isOpen) return null;

  const generateInviteCode = () => randomCode(6).toLowerCase();
  const needsDaily = (m) => m === "audio" || m === "video" || m === "hybrid";
  const dbMode = (m) => (m === "hybrid" ? "video" : m);

  const handleCreate = async (e) => {
    if (e) {
      try { e.preventDefault(); e.stopPropagation(); } catch (_) {}
    }

    const titleVal = title.trim();
    const topicVal = topic.trim();
    if (!titleVal || !topicVal) {
      setError("Indique un titre et un thème.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // On garde la session uniquement pour le token d'autorisation de l'API Daily
      const { data: { session }, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) throw sessErr;
      
      // Note : Si vos politiques RLS utilisent auth.uid()::TEXT, safeId DOIT correspondre à session.user.id.
      // Si vous utilisez un ID totalement personnalisé, assurez-vous que la RLS est adaptée (voir note en bas de réponse).
      const authId = session?.user?.id || safeId;

      let room = null;
      const finalMode = dbMode(mode);
      const topicWithHybrid = mode === "hybrid" ? `${topicVal} · ⚡ Tout-en-un` : topicVal;

      if (needsDaily(mode)) {
        const res = await fetch(`${API_BASE}/api/create-room`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || ''}`,
          },
          body: JSON.stringify({
            action: "create-room",
            userName: "Hôte",
            enableHLS: false,
            title: titleVal,
            topic: topicWithHybrid,
            mode: finalMode,
          }),
        });

        let dailyData = {};
        try { dailyData = await res.json(); } catch { throw new Error(`Réponse serveur invalide (${res.status}).`); }
        
        if (!res.ok) throw new Error(dailyData.error || `Création salle impossible (${res.status}).`);

        const inviteCode = String(dailyData.inviteCode || "").toLowerCase();
        const dailyRoomName = dailyData.roomName;

        let updatedRoom = null;
        if (inviteCode) {
          const { data: upd } = await supabase
            .from("debate_rooms")
            .update({ title: titleVal, topic: topicWithHybrid, mode: finalMode, max_participants: 12, status: "active" })
            .eq("invite_code", inviteCode)
            .select()
            .maybeSingle();
          updatedRoom = upd;
        }
        
        if (!updatedRoom && dailyData.roomId) {
          const { data: fetched } = await supabase.from("debate_rooms").select("*").eq("id", dailyData.roomId).maybeSingle();
          updatedRoom = fetched;
        }
        
        room = updatedRoom || {
          id: dailyData.roomId,
          invite_code: inviteCode,
          daily_room_name: dailyRoomName,
          title: titleVal,
          topic: topicWithHybrid,
          mode: finalMode,
          status: "active",
          host_id: authId, // Utilisation de l'ID unique
        };
      } else {
        // Mode texte — insert direct
        const inviteCode = generateInviteCode();
        const { data: newRoom, error: roomError } = await supabase
          .from("debate_rooms")
          .insert({
            title: titleVal,
            topic: topicVal,
            mode: "text",
            invite_code: inviteCode,
            host_id: authId, // Utilisation de l'ID unique
            status: "active",
            max_participants: 12,
          })
          .select("id, title, topic, mode, invite_code, status, host_id")
          .single();

        if (roomError) throw new Error(roomError.message + (roomError.details ? ` (${roomError.details})` : ""));
        room = newRoom;

        // Enregistrement du participant (hôte) avec l'ID unique
        const { error: partErr } = await supabase
          .from("debate_participants")
          .upsert({ room_id: room.id, user_id: authId, role: "host" }, { onConflict: "room_id,user_id" });
        
        if (partErr) console.warn("participant:", partErr.message);
      }

      if (!room?.invite_code && !room?.id) throw new Error("Salle créée mais réponse incomplète.");

      onSuccess?.(room);
      onClose?.();
      setTitle("");
      setTopic("");
      setMode("hybrid");
    } catch (err) {
      console.error("Création débat:", err);
      setError(String(err?.message || err?.error_description || (typeof err === "string" ? err : "Impossible de créer le débat")));
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = title.trim().length > 0 && topic.trim().length > 0 && !loading;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 border shadow-2xl flex flex-col gap-5 max-h-[92vh] overflow-y-auto" style={{ background: COLORS.surface, borderColor: COLORS.borderGold }}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: COLORS.ivory }}>
            <Zap size={20} style={{ color: COLORS.gold }} /> Nouveau live
          </h2>
          <button onClick={onClose} className="p-2 rounded-full transition" style={{ color: COLORS.muted }} aria-label="Fermer">
            <X size={20} />
          </button>
        </div>

        {error && <div className="p-3 rounded-xl text-xs border border-red-500/40 bg-red-500/10 text-red-300">{error}</div>}

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: COLORS.muted }}>Titre</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex : L'avenir de l'IA en Afrique" maxLength={80} autoFocus className="w-full px-4 py-3 rounded-xl border text-sm outline-none" style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }} />
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: COLORS.muted }}>Thème</label>
          <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ex : #Tech" maxLength={40} className="w-full px-4 py-3 rounded-xl border text-sm outline-none mb-2" style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }} />
          <div className="flex flex-wrap gap-1.5">
            {TOPIC_SUGGESTIONS.map((t) => (
              <button key={t} type="button" onClick={() => setTopic(t)} className="text-[10px] px-2.5 py-1 rounded-full border font-medium transition" style={{ background: topic === t ? `${COLORS.teal}22` : COLORS.surface2, borderColor: topic === t ? COLORS.teal : COLORS.border, color: topic === t ? COLORS.teal : COLORS.muted }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider mb-2 block" style={{ color: COLORS.muted }}>Format</label>
          <div className="grid grid-cols-2 gap-2">
            {MODES.map((m) => {
              const Icon = m.icon;
              const active = mode === m.id;
              return (
                <button key={m.id} type="button" onClick={() => setMode(m.id)} className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl border transition" style={{ background: active ? `${COLORS.gold}18` : COLORS.surface2, borderColor: active ? COLORS.gold : COLORS.border, color: active ? COLORS.gold : COLORS.muted }}>
                  <Icon size={20} />
                  <span className="text-xs font-bold">{m.label}</span>
                  <span className="text-[9px] opacity-70 text-center leading-tight">{m.hint}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] mt-2 flex items-center gap-1" style={{ color: COLORS.muted }}>
            <Paperclip size={12} /> Fichiers (image, PDF, audio) disponibles dans tous les formats
          </p>
        </div>

        <button type="button" onClick={handleCreate} disabled={!canSubmit} className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-40 active:scale-[0.98]" style={{ background: COLORS.gold, color: COLORS.bg }}>
          {loading ? <span className="animate-pulse">Création…</span> : <><Sparkles size={16} /> Lancer le live</>}
        </button>

        <p className="text-[10px] text-center" style={{ color: COLORS.muted }}>
          Un code d&apos;invitation sera généré pour partager la salle.<br />
          L&apos;hôte peut mettre en pause, reprendre ou terminer le débat.
        </p>
      </div>
    </div>
  );
}
