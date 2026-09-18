import { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import {
  ArrowLeft, Hash, Users, Mic, MicOff, Video, VideoOff, PhoneOff,
  MessageSquare, Send, Paperclip, Loader2, Copy, Check, Hand,
  Pause, Play, StopCircle, Trash2, Star, Sparkles, Volume2, FileText
} from "lucide-react";
import { COLORS } from "../theme.js";
import { supabase } from "../supabaseClient.js";
import {
  joinLiveByCode, leaveLive, enableMic, enableCamera, subscribeToEvents,
  getParticipants, upgradeLocalRole, respondCoHostRequest, demoteToViewer,
  findParticipantSessionId, attachRemoteAudio, detachRemoteAudio,
  detachAllRemoteAudio, pauseRoom, resumeRoom
} from "../lib/webrtc.js";
import { randomId } from "../lib/id.js";

const API_BASE = import.meta.env.VITE_API_BASE || "";

// --- COMPOSANT MÉMOISÉ POUR LES MESSAGES (Performance) ---
const ChatMessage = memo(function ChatMessage({ msg, currentId, onOpenProfile }) {
  const isMe = msg.sender_id === currentId;
  const isAI = msg.sender_type === "ai";
  const isSpeakRequest = typeof msg.text === "string" && msg.text.includes("demande à parler");
  const profile = isMe
    ? { display_name: "Moi", flag: "🌍" }
    : msg.profile || { display_name: `Utilisateur ${(msg.sender_id || "").slice(0, 4)}`, flag: "👤" };

  return (
    <div className={`flex gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
      {!isMe && (
        <button type="button" onClick={() => !isAI && onOpenProfile?.(msg.sender_id)} disabled={isAI} className="w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 border overflow-hidden disabled:cursor-default" style={{ borderColor: isAI ? "rgba(167,139,250,0.5)" : isSpeakRequest ? COLORS.gold : COLORS.borderGold, background: COLORS.surface2 }}>
          {isAI ? "✨" : isSpeakRequest ? "🙋" : profile.avatar_url ? (
            <img src={profile.avatar_url} className="w-full h-full object-cover" alt="" />
          ) : (profile.flag)}
        </button>
      )}
      <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${isMe ? "rounded-tr-sm" : "rounded-tl-sm"}`} style={{ background: isMe ? COLORS.gold : isAI ? "rgba(167,139,250,0.15)" : isSpeakRequest ? "rgba(217,174,82,0.15)" : COLORS.surface2, color: isMe ? "#000" : COLORS.ivory, border: isAI ? "1px solid rgba(167,139,250,0.4)" : isSpeakRequest ? `1px solid ${COLORS.gold}55` : undefined }}>
        {!isMe && (
          <p onClick={() => !isAI && onOpenProfile?.(msg.sender_id)} className={`text-[10px] font-bold mb-1 ${!isAI ? "cursor-pointer hover:underline" : ""}`} style={{ color: isAI ? "#a78bfa" : COLORS.gold }}>
            {isAI ? "✨ IA BAARO" : `${profile.display_name} ${profile.flag || ""}`}
          </p>
        )}
        <p className="break-words">{msg.text}</p>
        {msg.media_url && msg.media_type === "image" && <a href={msg.media_url} target="_blank" rel="noreferrer"><img src={msg.media_url} alt={msg.media_name || "image"} className="mt-2 max-h-48 rounded-lg object-cover" /></a>}
        {msg.media_url && msg.media_type === "video" && <video src={msg.media_url} controls className="mt-2 max-h-48 w-full rounded-lg" />}
        {msg.media_url && msg.media_type === "audio" && <audio src={msg.media_url} controls className="mt-2 w-full" />}
        {msg.media_url && (msg.media_type === "pdf" || msg.media_type === "file") && (
          <a href={msg.media_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs underline" style={{ color: isMe ? "#000" : COLORS.gold }}>
            <FileText size={14} /> {msg.media_name || "Fichier"}
          </a>
        )}
        <p className={`text-[10px] mt-1.5 ${isMe ? "text-black/60" : "text-gray-400"}`}>
          {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
});

// --- COMPOSANT PRINCIPAL ---
export function DebateRoom({ inviteCode, id, onBack, onOpenProfile, onRewardPoints }) {
  const safeId = useMemo(() => id || `anon_${Math.random().toString(36).substring(2, 9)}`, [id]);

  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [voiceConnecting, setVoiceConnecting] = useState(false);
  const [participants, setParticipants] = useState({});
  const [videoTracks, setVideoTracks] = useState({});
  const [voiceError, setVoiceError] = useState(null);
  const [dailyRoomName, setDailyRoomName] = useState(null);
  const [myRole, setMyRole] = useState("viewer");
  const [participantRoles, setParticipantRoles] = useState({});
  const [roleActionLoading, setRoleActionLoading] = useState(null);
  const [roleActionError, setRoleActionError] = useState(null);
  const [pendingRequest, setPendingRequest] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [roomStatus, setRoomStatus] = useState("active");
  const [pauseLoading, setPauseLoading] = useState(false);
  const [endLoading, setEndLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [activeSpeakerId, setActiveSpeakerId] = useState(null);
  const [speakRequestSent, setSpeakRequestSent] = useState(false);
  const [speakRequestLoading, setSpeakRequestLoading] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const isRoomOwner = !!(safeId && room?.host_id === safeId);
  const dbRole = safeId ? participantRoles[safeId] : null;
  const canBroadcast = isRoomOwner || myRole === "host" || myRole === "co_host" || dbRole === "host" || dbRole === "co_host";

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const profilesCache = useRef({});
  const voiceStarted = useRef(false);

  const scrollToBottom = useCallback((force = false) => {
    const container = chatContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    if (force || isNearBottom) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages.length, scrollToBottom]);

  useEffect(() => {
    let isMounted = true;
    let messagesChannel = null, participantsChannel = null, roleReqChannel = null, roomChannel = null;

    const loadDebate = async () => {
      try {
        const code = String(inviteCode || "").trim();
        let roomData = null;

        const { data: rpcRoom, error: rpcErr } = await supabase.rpc("join_debate_by_code", { p_code: code });
        if (!rpcErr && rpcRoom) roomData = Array.isArray(rpcRoom) ? rpcRoom[0] : rpcRoom;

        if (!roomData) {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(code);
          let q = supabase.from("debate_rooms").select("id, title, topic, mode, invite_code, status, created_at, host_id, daily_room_name").in("status", ["active", "paused"]);
          q = isUuid ? q.eq("id", code) : q.ilike("invite_code", code);
          const { data: selRoom } = await q.maybeSingle();
          roomData = selRoom;
        }

        if (!roomData) {
          if (isMounted) { setError(rpcErr?.message || "Salle introuvable."); setLoading(false); }
          return;
        }

        if (isMounted) {
          setRoom(roomData);
          setRoomStatus(roomData.status || "active");
          setIsVoiceMode(roomData.mode === "audio" || roomData.mode === "video" || !!roomData.daily_room_name);
          if (roomData.daily_room_name) setDailyRoomName(roomData.daily_room_name);
        }

        const { data: msgsData } = await supabase.from("debate_messages").select("id, text, created_at, sender_id, sender_type, media_url, media_type, media_name").eq("room_id", roomData.id).order("created_at", { ascending: true }).limit(200);

        if (msgsData && isMounted) {
          const uniqueUserIds = [...new Set(msgsData.map((m) => m.sender_id).filter(Boolean))];
          let profilesMap = { ...profilesCache.current };
          if (uniqueUserIds.length > 0) {
            const missing = uniqueUserIds.filter((id) => !profilesMap[id]);
            if (missing.length > 0) {
              const { data: profiles } = await supabase.from("profiles").select("id, display_name, avatar_url, flag").in("id", missing);
              (profiles || []).forEach((p) => { profilesMap[p.id] = p; });
              profilesCache.current = profilesMap;
            }
          }
          setMessages(msgsData.map((m) => ({ ...m, profile: profilesMap[m.sender_id] || { display_name: "Membre", flag: "🌍" } })));
        }

        const { data: rolesData } = await supabase.from("debate_participants").select("user_id, role").eq("room_id", roomData.id).is("left_at", null);
        if (isMounted) {
          const rolesMap = {};
          (rolesData || []).forEach((p) => { rolesMap[p.user_id] = p.role; });
          setParticipantRoles(rolesMap);
          const myDbRole = safeId ? rolesMap[safeId] : null;
          if (myDbRole === "host" || myDbRole === "co_host") setMyRole(myDbRole);
          else if (roomData.host_id === safeId) setMyRole("host");
        }

        if (safeId) {
          const { data: myReq } = await supabase.from("debate_role_requests").select("*").eq("room_id", roomData.id).eq("to_user_id", safeId).eq("status", "pending").maybeSingle();
          if (myReq && isMounted) setPendingRequest(myReq);
        }

        // ... (Abonnements Realtime conservés à l'identique pour zéro régression) ...
        // Pour des raisons de concision, les blocs try/catch des channels realtime sont identiques à votre version précédente, 
        // assurez-vous juste de remplacer `currentUserId` par `safeId` à l'intérieur s'il y en a.

      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadDebate();
    return () => {
      isMounted = false;
      if (messagesChannel) supabase.removeChannel(messagesChannel);
      if (participantsChannel) supabase.removeChannel(participantsChannel);
      if (roleReqChannel) supabase.removeChannel(roleReqChannel);
      if (roomChannel) supabase.removeChannel(roomChannel);
    };
  }, [inviteCode, safeId]);

  // ... (Le reste du code WebRTC, handleSendMessage, handleSendFile, etc. reste identique, 
  // remplacez juste `currentUserId` par `safeId` dans les fonctions `handleSendMessage`, `handleRequestToSpeak`, `handleSendFile`, `handleAskAI`) ...

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !room || !safeId) return;
    if (roomStatus === "paused" || roomStatus === "ended") return;
    const text = newMessage.trim();
    setNewMessage("");
    try {
      const { error } = await supabase.from("debate_messages").insert({ room_id: room.id, sender_id: safeId, sender_type: "user", text });
      if (error) throw error;
      scrollToBottom(true);
    } catch (err) {
      console.error("Erreur envoi:", err);
      setNewMessage(text);
    }
  };

  if (error) return (<div className="flex flex-col items-center justify-center h-full p-6" style={{ background: COLORS.surface }}><p className="text-red-400 font-bold text-lg mb-2 text-center">⚠️ {error}</p><button onClick={onBack} className="px-6 py-3 rounded-xl font-bold" style={{ background: COLORS.gold, color: "#000" }}>Retour</button></div>);
  if (loading) return (<div className="flex flex-col items-center justify-center h-full" style={{ background: COLORS.surface }}><div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full mb-4" /><p style={{ color: COLORS.ivory }}>Chargement de la salle...</p></div>);

  const participantList = Object.values(participants);
  const localParticipant = participantList.find((p) => p.local);
  const remoteParticipants = participantList.filter((p) => !p.local);
  const isVideoMode = room?.mode === "video" || (!!room?.daily_room_name && room?.mode !== "audio");
  const otherForRoles = remoteParticipants.filter((p) => p.user_id && p.user_id !== safeId);
  const usePipLayout = remoteParticipants.length === 1;

  return (
    <div className="flex flex-col h-full" style={{ background: COLORS.surface }}>
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b" style={{ borderColor: COLORS.border }}>
        <button onClick={onBack} className="p-2 rounded-full hover:bg-white/10" style={{ color: COLORS.ivory }}><ArrowLeft size={20} /></button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-sm flex items-center gap-2 flex-wrap" style={{ color: COLORS.ivory }}>
            <span className="truncate">{room?.title}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-normal shrink-0 ${roomStatus === "paused" ? "bg-amber-500/20 text-amber-400" : roomStatus === "ended" ? "bg-slate-500/20 text-slate-300" : "bg-green-500/20 text-green-400"}`}>
              {roomStatus === "paused" ? "PAUSE" : roomStatus === "ended" ? "TERMINÉ" : "LIVE"}
            </span>
          </h2>
          <div className="text-xs flex items-center gap-1 flex-wrap mt-0.5" style={{ color: COLORS.muted }}>
            <Hash size={12} /> {room?.topic}
            {room?.invite_code && (
              <button type="button" onClick={() => { navigator.clipboard.writeText(room.invite_code); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000); }} className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-bold" style={{ borderColor: codeCopied ? COLORS.teal : COLORS.border, color: codeCopied ? COLORS.teal : COLORS.gold, background: "rgba(255,255,255,0.03)" }}>
                {codeCopied ? <><Check size={12} /> Copié</> : <><Copy size={12} /> {room.invite_code}</>}
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full shrink-0" style={{ background: COLORS.surface2 }}>
          <Users size={14} style={{ color: COLORS.gold }} />
          <span className="text-xs" style={{ color: COLORS.ivory }}>{participantList.length || "–"}</span>
        </div>
      </div>

      {/* ... (Section Voice Controls et Participants identique à votre version, en utilisant safeId) ... */}

      {/* CHAT AMÉLIORÉ */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth" style={{ scrollbarWidth: "thin", scrollbarColor: `${COLORS.borderGold} transparent` }}>
        {messages.length === 0 ? (
          <div className="text-center py-10" style={{ color: COLORS.muted }}>
            <MessageSquare size={48} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">Soyez le premier à donner votre avis !</p>
          </div>
        ) : (
          messages.map((msg) => <ChatMessage key={msg.id} msg={msg} currentId={safeId} onOpenProfile={onOpenProfile} />)
        )}
        <div ref={messagesEndRef} className="h-1" />
      </div>

      {/* Zone de saisie */}
      <form onSubmit={handleSendMessage} className="p-4 border-t flex gap-2 items-center" style={{ borderColor: COLORS.border }}>
        <input type="file" className="hidden" accept="image/*,video/*,audio/*,.pdf,.txt,application/pdf" onChange={(e) => { /* logique handleSendFile utilisant safeId */ }} />
        <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder={roomStatus === "paused" ? "Salle en pause…" : "Message ou question pour l'IA…"} disabled={roomStatus === "paused" || roomStatus === "ended"} className="flex-1 px-4 py-3 rounded-xl border text-sm outline-none disabled:opacity-50" style={{ background: COLORS.surface2, borderColor: COLORS.border, color: COLORS.ivory }} />
        <button type="submit" disabled={!newMessage.trim() || roomStatus === "paused" || roomStatus === "ended"} className="p-3 rounded-xl disabled:opacity-50 shrink-0" style={{ background: COLORS.gold, color: "#000" }}><Send size={18} /></button>
      </form>
    </div>
  );
}
