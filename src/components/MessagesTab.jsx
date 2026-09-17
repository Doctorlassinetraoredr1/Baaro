import { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowLeft,
  Send,
  MessageCircle,
  Plus,
  X,
  Search,
  Users,
  UserPlus,
  Paperclip,
  Mic,
  MicOff,
  Phone,
  Video,
  FileText,
  Download,
  Image as ImageIcon,
  Check,
  CheckCheck,
  Pencil,
  Trash2,
  SmilePlus,
} from "lucide-react";
import { COLORS } from "../theme.js";
import { supabase } from "../supabaseClient.js";
import {
  getFriends,
  getFollowing,
  getFollowers,
} from "../supabaseClient.js";
import {
  uploadChatFile,
  uploadVoiceBlob,
  mimeToMessageType,
  formatFileSize,
  formatDuration,
  getBestAudioMime,
  getReadableUrl,
} from "../lib/chatMedia.js";
import {
  createCallRoom,
  createCallRecord,
  joinCallRoom,
  updateCallStatus,
} from "../lib/chatCalls.js";
import { ChatCallModal } from "./ChatCallModal.jsx";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const ONLINE_WINDOW_MS = 70 * 1000; // considéré "en ligne" si vu il y a < 70s
const HEARTBEAT_MS = 25 * 1000;
const TYPING_IDLE_MS = 3000;
const TYPING_SEND_THROTTLE_MS = 1500;

/**
 * Messages + liste d'amis + recherche + vocaux + fichiers + appels
 * + statut en ligne/vu, "en train d'écrire…", édition/suppression,
 * réactions, recherche dans la conversation.
 */
export function MessagesTab({ onRewardPoints, id: propId, onOpenProfile }) {
  const [id, setId] = useState(propId || null);
  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [showNewChat, setShowNewChat] = useState(false);
  const [pickerTab, setPickerTab] = useState("friends");
  const [friends, setFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  // Appels
  const [callState, setCallState] = useState(null); // { mode, callType, callRecord, roomUrl, token, otherUser, isCaller }

  // --- Nouveautés messagerie ---
  const [otherLastSeen, setOtherLastSeen] = useState(null);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [messageReactions, setMessageReactions] = useState({}); // { [messageId]: [{user_id, emoji}] }
  const [reactionPickerFor, setReactionPickerFor] = useState(null);
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");

  const messagesEndRef = useRef(null);
  const profilesCache = useRef({});
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordChunksRef = useRef([]);
  const recordTimerRef = useRef(null);
  const recordStartRef = useRef(null);
  const typingChannelRef = useRef(null);
  const typingClearTimeoutRef = useRef(null);
  const lastTypingSentRef = useRef(0);

  useEffect(() => {
    if (propId) {
      setId(propId);
      return;
    }
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setId(user.id);
    });
  }, [propId]);

  const fetchProfiles = useCallback(async (ids) => {
    const missing = ids.filter((id) => id && !profilesCache.current[id]);
    if (missing.length === 0) return profilesCache.current;
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, handle, avatar_url, flag")
      .in("id", missing);
    (data || []).forEach((p) => {
      profilesCache.current[p.id] = p;
    });
    return profilesCache.current;
  }, []);

  const fetchConversations = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("conversations")
        .select("id, user1_id, user2_id, created_at")
        .or(`user1_id.eq.${id},user2_id.eq.${id}`)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const rows = data || [];
      const otherIds = rows.map((c) =>
        c.user1_id === id ? c.user2_id : c.user1_id
      );
      await fetchProfiles(otherIds);

      const enriched = await Promise.all(
        rows.map(async (c) => {
          const otherId =
            c.user1_id === id ? c.user2_id : c.user1_id;
          const profile = profilesCache.current[otherId] || {
            display_name: "Membre",
            flag: "🌍",
            handle: "membre",
          };
          const { data: msgs } = await supabase
            .from("messages")
            .select("text, created_at, sender_id, type, file_name, deleted_at")
            .eq("conversation_id", c.id)
            .order("created_at", { ascending: false })
            .limit(1);
          const lastMsg = msgs?.[0] || null;
          return {
            id: c.id,
            otherUserId: otherId,
            otherUserName: profile.display_name || profile.handle || "Membre",
            otherUserHandle: profile.handle,
            otherUserAvatar: profile.avatar_url,
            otherUserFlag: profile.flag || "🌍",
            lastMsg,
            created_at: c.created_at,
          };
        })
      );

      enriched.sort((a, b) => {
        const ta = a.lastMsg?.created_at || a.created_at || "";
        const tb = b.lastMsg?.created_at || b.created_at || "";
        return tb.localeCompare(ta);
      });

      setConversations(enriched);
    } catch (err) {
      console.error("Erreur conversations:", err);
    } finally {
      setLoading(false);
    }
  }, [id, fetchProfiles]);

  useEffect(() => {
    if (!id) return;
    fetchConversations();
    const channel = supabase
      .channel("public:messages-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => fetchConversations()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, fetchConversations]);

  // Écoute appels entrants
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`calls-incoming-${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "calls",
          filter: `callee_id=eq.${id}`,
        },
        async (payload) => {
          const call = payload.new;
          if (call.status !== "ringing") return;
          // Récupérer token + room
          try {
            const profile = profilesCache.current[call.caller_id] || {};
            if (!profilesCache.current[call.caller_id]) {
              await fetchProfiles([call.caller_id]);
            }
            const p = profilesCache.current[call.caller_id] || profile;
            const { token, url } = await joinCallRoom({
              roomName: call.daily_room_name,
              callId: call.id,
              userName: p.display_name || "BAARO",
            });
            setCallState({
              mode: "incoming",
              callType: call.type,
              callRecord: call,
              roomUrl: url,
              token,
              otherUser: {
                name: p.display_name || "Membre",
                avatar: p.avatar_url,
                flag: p.flag || "🌍",
              },
              isCaller: false,
            });
          } catch (e) {
            console.error("Incoming call error:", e);
          }
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [id, fetchProfiles]);

  // Heartbeat "en ligne" — met à jour profiles.last_seen_at régulièrement
  useEffect(() => {
    if (!id) return;
    const ping = () => {
      supabase
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", id)
        .then(() => {}, () => {});
    };
    ping();
    const iv = setInterval(ping, HEARTBEAT_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [id]);

  // Statut en ligne / "vu" de l'autre personne dans la conversation active
  useEffect(() => {
    if (!activeChat?.otherUserId) {
      setOtherLastSeen(null);
      return;
    }
    let active = true;
    const fetchLastSeen = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("last_seen_at")
        .eq("id", activeChat.otherUserId)
        .single();
      if (active) setOtherLastSeen(data?.last_seen_at || null);
    };
    fetchLastSeen();
    const iv = setInterval(fetchLastSeen, 20000);
    const channel = supabase
      .channel(`presence_${activeChat.otherUserId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${activeChat.otherUserId}`,
        },
        (payload) => {
          if (active) setOtherLastSeen(payload.new.last_seen_at);
        }
      )
      .subscribe();
    return () => {
      active = false;
      clearInterval(iv);
      supabase.removeChannel(channel);
    };
  }, [activeChat?.otherUserId]);

  // "En train d'écrire…" — canal broadcast par conversation
  useEffect(() => {
    if (!activeChat?.id) {
      typingChannelRef.current = null;
      return;
    }
    setIsOtherTyping(false);
    const channel = supabase
      .channel(`typing_${activeChat.id}`, {
        config: { broadcast: { self: false } },
      })
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload?.userId !== activeChat.otherUserId) return;
        setIsOtherTyping(true);
        clearTimeout(typingClearTimeoutRef.current);
        typingClearTimeoutRef.current = setTimeout(
          () => setIsOtherTyping(false),
          TYPING_IDLE_MS
        );
      })
      .subscribe();
    typingChannelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      clearTimeout(typingClearTimeoutRef.current);
      typingChannelRef.current = null;
    };
  }, [activeChat?.id, activeChat?.otherUserId]);

  const handleTypingInput = (value) => {
    setNewMessage(value);
    if (!typingChannelRef.current || !id) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < TYPING_SEND_THROTTLE_MS) return;
    lastTypingSentRef.current = now;
    typingChannelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: id },
    });
  };

  // Messages de la conversation active (+ réactions) et Realtime INSERT/UPDATE/DELETE
  useEffect(() => {
    if (!activeChat?.id) return;
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select(
          "id, text, created_at, sender_id, type, media_url, media_mime, media_size, media_duration, file_name, thumbnail_url, read_at, edited_at, deleted_at"
        )
        .eq("conversation_id", activeChat.id)
        .order("created_at", { ascending: true })
        .limit(200);
      if (!error) setMessages(data || []);

      const { data: reacts } = await supabase
        .from("message_reactions")
        .select("message_id, user_id, emoji")
        .eq("conversation_id", activeChat.id);
      const grouped = {};
      (reacts || []).forEach((r) => {
        grouped[r.message_id] = grouped[r.message_id] || [];
        grouped[r.message_id].push(r);
      });
      setMessageReactions(grouped);
    };
    fetchMessages();

    const channel = supabase
      .channel(`room_${activeChat.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${activeChat.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setMessages((prev) => {
              if (prev.some((m) => m.id === payload.new.id)) return prev;
              return [...prev, payload.new];
            });
          } else if (payload.eventType === "UPDATE") {
            setMessages((prev) =>
              prev.map((m) => (m.id === payload.new.id ? payload.new : m))
            );
          } else if (payload.eventType === "DELETE") {
            setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_reactions",
          filter: `conversation_id=eq.${activeChat.id}`,
        },
        (payload) => {
          setMessageReactions((prev) => {
            const next = { ...prev };
            if (payload.eventType === "INSERT") {
              const r = payload.new;
              next[r.message_id] = [...(next[r.message_id] || []), r];
            } else if (payload.eventType === "DELETE") {
              const r = payload.old;
              next[r.message_id] = (next[r.message_id] || []).filter(
                (x) =>
                  !(x.user_id === r.user_id && x.emoji === r.emoji)
              );
            }
            return next;
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChat]);

  // Marquer comme "vu" les messages reçus non lus
  useEffect(() => {
    if (!activeChat?.id || !id) return;
    const unread = messages.filter(
      (m) => m.sender_id !== id && !m.read_at && !m.deleted_at
    );
    if (unread.length === 0) return;
    const ids = unread.map((m) => m.id);
    supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", ids)
      .then(() => {}, () => {});
  }, [messages, activeChat?.id, id]);

  useEffect(() => {
    if (showChatSearch) return; // ne pas auto-scroll pendant une recherche
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, showChatSearch]);

  // ---- Amis ----
  const loadFriends = useCallback(async () => {
    if (!id) return;
    setLoadingFriends(true);
    try {
      const [{ data: friendIds }, { data: followingIds }, { data: followerIds }] =
        await Promise.all([getFriends(), getFollowing(), getFollowers()]);

      const ids = [
        ...new Set([
          ...(friendIds || []),
          ...(followingIds || []),
          ...(followerIds || []),
        ]),
      ].filter((uid) => uid && uid !== id);

      if (ids.length === 0) {
        setFriends([]);
        return;
      }

      await fetchProfiles(ids);
      setFriends(
        ids.map((id) => {
          const p = profilesCache.current[id] || {};
          return {
            id,
            display_name: p.display_name || "Membre",
            handle: p.handle || `@user_${String(id).slice(0, 8)}`,
            avatar_url: p.avatar_url,
            flag: p.flag || "🌍",
            isFriend: (friendIds || []).includes(id),
          };
        })
      );
    } catch (e) {
      console.error(e);
      setFriends([]);
    } finally {
      setLoadingFriends(false);
    }
  }, [id, fetchProfiles]);

  useEffect(() => {
    if (showNewChat && pickerTab === "friends") loadFriends();
  }, [showNewChat, pickerTab, loadFriends]);

  // ---- Recherche membres ----
  useEffect(() => {
    if (!showNewChat || pickerTab !== "search") return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const pattern = `%${q}%`;
        const { data, error } = await supabase
          .from("profiles")
          .select("id, display_name, handle, avatar_url, flag")
          .or(`display_name.ilike.${pattern},handle.ilike.${pattern}`)
          .neq("id", id)
          .limit(25);
        if (error) throw error;
        setSearchResults(data || []);
      } catch (e) {
        console.error(e);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, showNewChat, pickerTab, id]);

  const createOrOpenConversation = async (otherUserId, name, avatar, flag) => {
    if (!id || !otherUserId) {
      alert("Tu n'es pas connecté");
      return;
    }
    if (otherUserId === id) {
      alert("Tu ne peux pas discuter avec toi-même");
      return;
    }

    const chatData = {
      otherUserId,
      otherUserName: name || "Membre",
      otherUserAvatar: avatar,
      otherUserFlag: flag || "🌍",
    };

    try {
      const { data: existingList, error: findErr } = await supabase
        .from("conversations")
        .select("id, user1_id, user2_id")
        .or(
          `and(user1_id.eq.${id},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${id})`
        )
        .limit(1);

      if (findErr) {
        console.error("find conversation:", findErr);
        if (/relation .*conversations.* does not exist/i.test(findErr.message)) {
          alert(
            "Table conversations absente. Exécute supabase-fix-conversations.sql dans Supabase."
          );
          return;
        }
      }

      const existing = existingList?.[0];
      if (existing) {
        setActiveChat({ id: existing.id, ...chatData });
        setShowNewChat(false);
        return;
      }

      const u1 = id < otherUserId ? id : otherUserId;
      const u2 = id < otherUserId ? otherUserId : id;

      const { data: newConv, error } = await supabase
        .from("conversations")
        .insert({ user1_id: u1, user2_id: u2 })
        .select("id")
        .single();

      if (error) {
        console.error("create conversation:", error);
        if (error.code === "23505") {
          const { data: again } = await supabase
            .from("conversations")
            .select("id")
            .or(
              `and(user1_id.eq.${u1},user2_id.eq.${u2}),and(user1_id.eq.${u2},user2_id.eq.${u1})`
            )
            .limit(1);
          if (again?.[0]) {
            setActiveChat({ id: again[0].id, ...chatData });
            setShowNewChat(false);
            return;
          }
        }
        alert(
          "Impossible de créer la conversation\n\n" +
            (error.message || error.code || "Erreur inconnue")
        );
        return;
      }

      setActiveChat({ id: newConv.id, ...chatData });
      setShowNewChat(false);
      fetchConversations();
    } catch (e) {
      console.error(e);
      alert("Erreur : " + (e.message || String(e)));
    }
  };

  // ---- Envoi texte ----
  const handleSendMessage = async (e) => {
    e?.preventDefault?.();
    if (!newMessage.trim() || !activeChat || !id) return;
    const text = newMessage.trim();
    setNewMessage("");
    try {
      const { error } = await supabase.from("messages").insert({
        conversation_id: activeChat.id,
        sender_id: id,
        recipient_id: activeChat.otherUserId,
        text,
        type: "text",
      });
      if (error) throw error;
    } catch (err) {
      console.error("Erreur envoi:", err);
      setNewMessage(text);
    }
  };

  // ---- Envoi fichier ----
  const handleFileSelect = async (e) => {
    const files = e.target?.files;
    const file = files?.[0];
    // Reset pour pouvoir resélectionner le même fichier
    try {
      e.target.value = "";
    } catch (_) {}

    if (!file) {
      console.warn("Aucun fichier sélectionné");
      return;
    }
    if (!activeChat) {
      alert("Ouvre une conversation d'abord");
      return;
    }
    if (!id) {
      alert("Tu n'es pas connecté");
      return;
    }

    setUploading(true);
    try {
      const uploaded = await uploadChatFile(file, id);
      const msgType = mimeToMessageType(uploaded.mime);

      const { error } = await supabase.from("messages").insert({
        conversation_id: activeChat.id,
        sender_id: id,
        recipient_id: activeChat.otherUserId,
        text: uploaded.fileName || "Fichier",
        type: msgType === "voice" ? "audio" : msgType,
        media_url: uploaded.url,
        media_mime: uploaded.mime,
        media_size: uploaded.size,
        file_name: uploaded.fileName,
      });
      if (error) throw error;
    } catch (err) {
      console.error("Upload fichier:", err);
      alert(
        "Échec envoi fichier :\n" +
          (err?.message || String(err)) +
          "\n\nVérifie le bucket chat-media et les policies Storage."
      );
    } finally {
      setUploading(false);
    }
  };

  const openFilePicker = () => {
    if (uploading || recording) return;
    const input = fileInputRef.current;
    if (!input) {
      alert("Sélecteur de fichiers indisponible");
      return;
    }
    // Astuce mobile : certains navigateurs ignorent .click() sur input hidden
    input.style.display = "block";
    input.style.position = "fixed";
    input.style.left = "0";
    input.style.top = "0";
    input.style.opacity = "0.01";
    input.style.width = "1px";
    input.style.height = "1px";
    input.style.zIndex = "9999";
    try {
      input.click();
    } catch (err) {
      console.error(err);
      alert("Impossible d'ouvrir le sélecteur de fichiers");
    }
    setTimeout(() => {
      if (input) {
        input.style.display = "none";
        input.style.opacity = "";
        input.style.position = "";
      }
    }, 1000);
  };

  // ---- Message vocal ----
  const startRecording = async () => {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      const mime = getBestAudioMime();
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      recordChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(recordTimerRef.current);
        const duration = Math.round(
          (Date.now() - (recordStartRef.current || Date.now())) / 1000
        );
        const blob = new Blob(recordChunksRef.current, { type: mime });
        if (blob.size < 500) {
          setRecording(false);
          setRecordSeconds(0);
          return;
        }
        setUploading(true);
        try {
          const uploaded = await uploadVoiceBlob(blob, id, duration);
          const { error } = await supabase.from("messages").insert({
            conversation_id: activeChat.id,
            sender_id: id,
            recipient_id: activeChat.otherUserId,
            text: "🎤 Message vocal",
            type: "voice",
            media_url: uploaded.url,
            media_mime: uploaded.mime,
            media_size: uploaded.size,
            media_duration: uploaded.duration,
            file_name: uploaded.fileName || "voice.m4a",
          });
          if (error) throw error;
        } catch (err) {
          console.error(err);
          alert(err.message || "Échec envoi vocal");
        } finally {
          setUploading(false);
          setRecording(false);
          setRecordSeconds(0);
        }
      };
      mediaRecorderRef.current = recorder;
      recordStartRef.current = Date.now();
      recorder.start(250);
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      console.error(err);
      alert(
        "Micro inaccessible. Autorise le micro dans les paramètres du navigateur / de l'app."
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
    }
  };

  // ---- Appels ----
  const startOutgoingCall = async (type = "voice") => {
    if (!activeChat || !id) return;
    try {
      const res = await createCallRoom({
        userName: activeChat.otherUserName || "BAARO",
      });
      const roomName = res.roomName;
      const url = res.url || res.roomUrl;
      const token = res.token;
      if (!roomName || !url || !token) {
        throw new Error(
          "Réponse Daily incomplète. Vérifie DAILY_API_KEY et DAILY_DOMAIN sur Vercel."
        );
      }
      let record = null;
      try {
        record = await createCallRecord({
          conversationId: activeChat.id,
          callerId: id,
          calleeId: activeChat.otherUserId,
          type,
          dailyRoomName: roomName,
        });
      } catch (dbErr) {
        console.warn("Table calls absente ou RLS :", dbErr.message);
        // On continue quand même l'appel même si l'historique échoue
        record = { id: null, daily_room_name: roomName };
      }
      setCallState({
        mode: "outgoing",
        callType: type,
        callRecord: record,
        roomUrl: url,
        token,
        otherUser: {
          name: activeChat.otherUserName,
          avatar: activeChat.otherUserAvatar,
          flag: activeChat.otherUserFlag,
        },
        isCaller: true,
      });
    } catch (err) {
      console.error(err);
      const msg = err.message || String(err);
      if (/DAILY_API_KEY/i.test(msg) || /non configurés/i.test(msg)) {
        alert(
          "Appels non configurés.\n\nAjoute DAILY_API_KEY (et DAILY_DOMAIN) dans les variables d'environnement Vercel, puis redéploie."
        );
      } else {
        alert("Impossible de démarrer l'appel :\n" + msg);
      }
    }
  };

  // ---- Édition / suppression de message ----
  const startEditMessage = (msg) => {
    setReactionPickerFor(null);
    setEditingMessageId(msg.id);
    setEditingText(msg.text || "");
  };

  const cancelEditMessage = () => {
    setEditingMessageId(null);
    setEditingText("");
  };

  const submitEditMessage = async (e) => {
    e?.preventDefault?.();
    if (!editingMessageId) return;
    const text = editingText.trim();
    if (!text) return;
    try {
      const { error } = await supabase
        .from("messages")
        .update({ text, edited_at: new Date().toISOString() })
        .eq("id", editingMessageId)
        .eq("sender_id", id);
      if (error) throw error;
    } catch (err) {
      console.error("Erreur édition:", err);
      alert("Impossible de modifier ce message.");
    } finally {
      setEditingMessageId(null);
      setEditingText("");
    }
  };

  const deleteMessage = async (msg) => {
    if (!window.confirm("Supprimer ce message ?")) return;
    try {
      const { error } = await supabase
        .from("messages")
        .update({
          deleted_at: new Date().toISOString(),
          text: null,
          media_url: null,
        })
        .eq("id", msg.id)
        .eq("sender_id", id);
      if (error) throw error;
    } catch (err) {
      console.error("Erreur suppression:", err);
      alert("Impossible de supprimer ce message.");
    }
  };

  // ---- Réactions ----
  const toggleReaction = async (messageId, emoji) => {
    setReactionPickerFor(null);
    const already = (messageReactions[messageId] || []).some(
      (r) => r.user_id === id && r.emoji === emoji
    );
    try {
      if (already) {
        await supabase
          .from("message_reactions")
          .delete()
          .eq("message_id", messageId)
          .eq("user_id", id)
          .eq("emoji", emoji);
      } else {
        await supabase.from("message_reactions").insert({
          message_id: messageId,
          conversation_id: activeChat.id,
          user_id: id,
          emoji,
        });
      }
    } catch (err) {
      console.error("Erreur réaction:", err);
    }
  };

  // ---- Rendu d'un message ----
  const renderMessageContent = (msg, isMe) => {
    const type = msg.type || "text";
    const url = msg.media_url;

    if ((type === "voice" || type === "audio") && url) {
      return (
        <div className="flex flex-col gap-1.5 min-w-[180px]">
          <audio
            controls
            playsInline
            preload="metadata"
            src={url}
            className="w-full max-w-[240px]"
            style={{ minHeight: 36 }}
            onError={async (e) => {
              // Tente de régénérer une signed URL si lecture échoue
              try {
                const pathMatch = url.match(/chat-media\/(.+?)(?:\?|$)/);
                if (pathMatch) {
                  const fresh = await getReadableUrl(decodeURIComponent(pathMatch[1]));
                  if (fresh && e.currentTarget) e.currentTarget.src = fresh;
                }
              } catch (_) {}
            }}
          />
          <div className="flex items-center justify-between gap-2">
            {msg.media_duration != null && (
              <span className={`text-[10px] ${isMe ? "text-black/60" : "text-gray-400"}`}>
                🎤 {formatDuration(msg.media_duration)}
              </span>
            )}
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              download={msg.file_name || "vocal"}
              className={`text-[10px] underline ${isMe ? "text-black/50" : "text-gray-400"}`}
            >
              Télécharger
            </a>
          </div>
        </div>
      );
    }

    if (type === "image" && url) {
      return (
        <a href={url} target="_blank" rel="noreferrer">
          <img
            src={url}
            alt={msg.file_name || "image"}
            className="max-w-[220px] max-h-[280px] rounded-xl object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </a>
      );
    }

    if (type === "video" && url) {
      return (
        <video
          controls
          playsInline
          src={url}
          className="max-w-[240px] max-h-[280px] rounded-xl"
          preload="metadata"
        />
      );
    }

    if (type === "file" && url) {
      return (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          download={msg.file_name}
          className="flex items-center gap-2 underline-offset-2 hover:underline"
        >
          <FileText size={18} />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate max-w-[160px]">
              {msg.file_name || "Fichier"}
            </p>
            {msg.media_size != null && (
              <p className={`text-[10px] ${isMe ? "text-black/60" : "text-gray-400"}`}>
                {formatFileSize(msg.media_size)}
              </p>
            )}
          </div>
          <Download size={14} />
        </a>
      );
    }

    return <p className="whitespace-pre-wrap break-words">{msg.text}</p>;
  };

  const renderUserRow = (user, badge) => (
    <button
      key={user.id}
      type="button"
      onClick={() =>
        createOrOpenConversation(
          user.id,
          user.display_name,
          user.avatar_url,
          user.flag
        )
      }
      className="w-full p-3 rounded-2xl border text-left hover:border-amber-400/50 transition flex items-center gap-3"
      style={{ background: COLORS.surface, borderColor: COLORS.border }}
    >
      <div
        className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center overflow-hidden text-lg shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          onOpenProfile?.(user.id);
        }}
      >
        {user.avatar_url ? (
          <img src={user.avatar_url} className="w-full h-full object-cover" alt="" />
        ) : (
          user.flag || "🌍"
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="font-semibold text-sm truncate hover:underline"
          style={{ color: COLORS.ivory }}
          onClick={(e) => {
            e.stopPropagation();
            onOpenProfile?.(user.id);
          }}
        >
          {user.display_name || "Membre"}
        </p>
        <p className="text-xs truncate" style={{ color: COLORS.muted }}>
          {user.handle || ""}
        </p>
      </div>
      {badge && (
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0"
          style={{ background: "rgba(217,174,82,0.2)", color: COLORS.gold }}
        >
          {badge}
        </span>
      )}
      <MessageCircle size={16} style={{ color: COLORS.gold }} />
    </button>
  );

  // --- Nouvelle conversation ---
  if (showNewChat) {
    return (
      <div
        className="flex flex-col h-full max-w-2xl mx-auto w-full"
        style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-lg font-bold" style={{ color: COLORS.ivory }}>
            Nouvelle conversation
          </h2>
          <button
            onClick={() => setShowNewChat(false)}
            className="p-2 rounded-full hover:bg-white/10"
            style={{ color: COLORS.muted }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setPickerTab("friends")}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold border"
            style={{
              background:
                pickerTab === "friends" ? "rgba(217,174,82,0.2)" : "rgba(255,255,255,0.03)",
              borderColor: pickerTab === "friends" ? COLORS.borderGold : COLORS.border,
              color: pickerTab === "friends" ? COLORS.gold : COLORS.muted,
            }}
          >
            <Users size={16} />
            Amis
          </button>
          <button
            onClick={() => setPickerTab("search")}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold border"
            style={{
              background:
                pickerTab === "search" ? "rgba(217,174,82,0.2)" : "rgba(255,255,255,0.03)",
              borderColor: pickerTab === "search" ? COLORS.borderGold : COLORS.border,
              color: pickerTab === "search" ? COLORS.gold : COLORS.muted,
            }}
          >
            <Search size={16} />
            Recherche
          </button>
        </div>

        {pickerTab === "search" && (
          <div className="relative mb-4">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: COLORS.muted }}
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Nom ou @handle…"
              className="w-full pl-10 pr-4 py-3 rounded-xl border text-sm outline-none"
              style={{
                background: COLORS.surface2,
                borderColor: COLORS.border,
                color: COLORS.ivory,
              }}
              autoFocus
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-2">
          {pickerTab === "friends" && (
            <>
              {loadingFriends && (
                <p className="text-center text-sm py-8" style={{ color: COLORS.muted }}>
                  Chargement des amis…
                </p>
              )}
              {!loadingFriends && friends.length === 0 && (
                <div className="text-center py-12" style={{ color: COLORS.muted }}>
                  <UserPlus size={36} className="mx-auto mb-3 opacity-40" />
                  <p className="text-sm mb-1">Aucun ami pour l’instant</p>
                  <p className="text-xs opacity-70">
                    Suis des membres dans Communauté, ou utilise Recherche
                  </p>
                </div>
              )}
              {friends.map((u) => renderUserRow(u, u.isFriend ? "Ami" : "Suivi"))}
            </>
          )}

          {pickerTab === "search" && (
            <>
              {searchQuery.trim().length < 2 && (
                <p className="text-center text-sm py-8" style={{ color: COLORS.muted }}>
                  Tape au moins 2 caractères
                </p>
              )}
              {searching && (
                <p className="text-center text-sm py-4" style={{ color: COLORS.muted }}>
                  Recherche…
                </p>
              )}
              {!searching &&
                searchQuery.trim().length >= 2 &&
                searchResults.length === 0 && (
                  <p className="text-center text-sm py-8" style={{ color: COLORS.muted }}>
                    Aucun membre trouvé
                  </p>
                )}
              {searchResults.map((u) => renderUserRow(u))}
            </>
          )}
        </div>
      </div>
    );
  }

  // --- Conversation active ---
  if (activeChat) {
    const isOtherOnline =
      otherLastSeen &&
      Date.now() - new Date(otherLastSeen).getTime() < ONLINE_WINDOW_MS;

    let statusLabel = "";
    if (isOtherTyping) statusLabel = "en train d'écrire…";
    else if (isOtherOnline) statusLabel = "En ligne";
    else if (otherLastSeen)
      statusLabel = `Vu à ${new Date(otherLastSeen).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`;

    const visibleMessages =
      showChatSearch && chatSearchQuery.trim()
        ? messages.filter(
            (m) =>
              !m.deleted_at &&
              (m.text || "")
                .toLowerCase()
                .includes(chatSearchQuery.trim().toLowerCase())
          )
        : messages;

    return (
      <>
        {callState && (
          <ChatCallModal
            mode={callState.mode}
            callType={callState.callType}
            callRecord={callState.callRecord}
            roomUrl={callState.roomUrl}
            token={callState.token}
            otherUser={callState.otherUser}
            isCaller={callState.isCaller}
            onClose={() => setCallState(null)}
          />
        )}

        <div
          className="flex flex-col max-w-2xl mx-auto w-full"
          style={{ height: "calc(100dvh - 130px)", maxHeight: "calc(100dvh - 130px)" }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-2 p-3 border-b"
            style={{ borderColor: COLORS.border }}
          >
            <button
              onClick={() => {
                setActiveChat(null);
                setMessages([]);
                setShowChatSearch(false);
                setChatSearchQuery("");
                fetchConversations();
              }}
              className="p-2 rounded-full hover:bg-white/10"
              style={{ color: COLORS.ivory }}
            >
              <ArrowLeft size={20} />
            </button>
            <div
              className="relative w-9 h-9 shrink-0"
              onClick={() => onOpenProfile?.(activeChat.otherUserId)}
            >
              <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center overflow-hidden text-sm cursor-pointer">
                {activeChat.otherUserAvatar ? (
                  <img
                    src={activeChat.otherUserAvatar}
                    className="w-full h-full object-cover"
                    alt=""
                  />
                ) : (
                  activeChat.otherUserFlag || "🌍"
                )}
              </div>
              {isOtherOnline && (
                <span
                  className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
                  style={{ background: "#22c55e", borderColor: COLORS.bg || "#0B1220" }}
                />
              )}
            </div>
            <div
              className="min-w-0 flex-1 cursor-pointer"
              onClick={() => onOpenProfile?.(activeChat.otherUserId)}
            >
              <p className="font-bold text-sm truncate" style={{ color: COLORS.ivory }}>
                {activeChat.otherUserName}
              </p>
              {statusLabel && (
                <p
                  className={`text-[11px] truncate ${
                    isOtherTyping ? "italic" : ""
                  }`}
                  style={{ color: isOtherOnline ? "#22c55e" : COLORS.muted }}
                >
                  {statusLabel}
                </p>
              )}
            </div>
            {/* Recherche dans la conversation */}
            <button
              onClick={() => {
                setShowChatSearch((v) => !v);
                if (showChatSearch) setChatSearchQuery("");
              }}
              className="p-2 rounded-full hover:bg-white/10"
              style={{ color: showChatSearch ? COLORS.gold : COLORS.muted }}
              title="Rechercher dans la conversation"
            >
              <Search size={18} />
            </button>
            {/* Boutons appel */}
            <button
              onClick={() => startOutgoingCall("voice")}
              className="p-2 rounded-full hover:bg-white/10"
              style={{ color: COLORS.teal }}
              title="Appel vocal"
            >
              <Phone size={18} />
            </button>
            <button
              onClick={() => startOutgoingCall("video")}
              className="p-2 rounded-full hover:bg-white/10"
              style={{ color: COLORS.gold }}
              title="Appel vidéo"
            >
              <Video size={18} />
            </button>
          </div>

          {showChatSearch && (
            <div
              className="px-3 py-2 border-b"
              style={{ borderColor: COLORS.border }}
            >
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: COLORS.muted }}
                />
                <input
                  type="search"
                  autoFocus
                  value={chatSearchQuery}
                  onChange={(e) => setChatSearchQuery(e.target.value)}
                  placeholder="Rechercher dans cette conversation…"
                  className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm outline-none"
                  style={{
                    background: COLORS.surface2,
                    borderColor: COLORS.border,
                    color: COLORS.ivory,
                  }}
                />
              </div>
              {chatSearchQuery.trim() && (
                <p className="text-[11px] mt-1" style={{ color: COLORS.muted }}>
                  {visibleMessages.length} résultat
                  {visibleMessages.length > 1 ? "s" : ""}
                </p>
              )}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {visibleMessages.length === 0 && !showChatSearch && (
              <p className="text-center text-sm py-10" style={{ color: COLORS.muted }}>
                Début de la conversation — dis bonjour 👋
              </p>
            )}
            {visibleMessages.length === 0 &&
              showChatSearch &&
              chatSearchQuery.trim() && (
                <p className="text-center text-sm py-10" style={{ color: COLORS.muted }}>
                  Aucun message ne correspond à « {chatSearchQuery.trim()} »
                </p>
              )}
            {visibleMessages.map((msg) => {
              const isMe = msg.sender_id === id;
              const isDeleted = !!msg.deleted_at;
              const isEditing = editingMessageId === msg.id;
              const reactions = messageReactions[msg.id] || [];
              const groupedReactions = {};
              reactions.forEach((r) => {
                groupedReactions[r.emoji] = groupedReactions[r.emoji] || [];
                groupedReactions[r.emoji].push(r.user_id);
              });

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`flex items-end gap-1 max-w-[85%] ${
                      isMe ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    <div
                      className={`max-w-full px-3 py-2.5 rounded-2xl text-sm ${
                        isMe ? "rounded-tr-sm" : "rounded-tl-sm"
                      }`}
                      style={{
                        background: isMe ? COLORS.gold : COLORS.surface2,
                        color: isMe ? "#000" : COLORS.ivory,
                        opacity: isDeleted ? 0.6 : 1,
                      }}
                    >
                      {isDeleted ? (
                        <p className="italic text-sm">🚫 Message supprimé</p>
                      ) : isEditing ? (
                        <form onSubmit={submitEditMessage} className="flex flex-col gap-1.5">
                          <input
                            autoFocus
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            className="px-2 py-1 rounded-lg text-sm outline-none border"
                            style={{
                              background: "rgba(255,255,255,0.15)",
                              borderColor: "rgba(0,0,0,0.2)",
                              color: isMe ? "#000" : COLORS.ivory,
                            }}
                          />
                          <div className="flex gap-2 justify-end text-[11px] font-bold">
                            <button
                              type="button"
                              onClick={cancelEditMessage}
                              className="opacity-70"
                            >
                              Annuler
                            </button>
                            <button type="submit">Enregistrer</button>
                          </div>
                        </form>
                      ) : (
                        renderMessageContent(msg, isMe)
                      )}
                      {!isDeleted && !isEditing && (
                        <p
                          className={`text-[10px] mt-1 flex items-center gap-1 ${
                            isMe ? "text-black/60 justify-end" : "text-gray-400"
                          }`}
                        >
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {msg.edited_at && <span>· modifié</span>}
                          {isMe &&
                            (msg.read_at ? (
                              <CheckCheck size={12} style={{ color: "#2563eb" }} />
                            ) : (
                              <Check size={12} className="opacity-60" />
                            ))}
                        </p>
                      )}
                    </div>

                    {/* Actions : réagir, modifier, supprimer */}
                    {!isDeleted && !isEditing && (
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setReactionPickerFor(
                              reactionPickerFor === msg.id ? null : msg.id
                            )
                          }
                          className="p-1 rounded-full hover:bg-white/10"
                          style={{ color: COLORS.muted }}
                          title="Réagir"
                        >
                          <SmilePlus size={14} />
                        </button>
                        {isMe && (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditMessage(msg)}
                              className="p-1 rounded-full hover:bg-white/10"
                              style={{ color: COLORS.muted }}
                              title="Modifier"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteMessage(msg)}
                              className="p-1 rounded-full hover:bg-white/10"
                              style={{ color: "#EF4444" }}
                              title="Supprimer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Sélecteur d'emoji */}
                  {reactionPickerFor === msg.id && (
                    <div
                      className="flex gap-1 mt-1 p-1.5 rounded-full border"
                      style={{ background: COLORS.surface, borderColor: COLORS.border }}
                    >
                      {QUICK_REACTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => toggleReaction(msg.id, emoji)}
                          className="text-lg leading-none px-1 hover:scale-125 transition-transform"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Réactions affichées */}
                  {Object.keys(groupedReactions).length > 0 && (
                    <div
                      className={`flex flex-wrap gap-1 mt-1 ${
                        isMe ? "justify-end" : "justify-start"
                      }`}
                    >
                      {Object.entries(groupedReactions).map(([emoji, userIds]) => {
                        const mine = userIds.includes(id);
                        return (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => toggleReaction(msg.id, emoji)}
                            className="text-xs px-2 py-0.5 rounded-full border flex items-center gap-1"
                            style={{
                              background: mine
                                ? "rgba(217,174,82,0.2)"
                                : COLORS.surface2,
                              borderColor: mine ? COLORS.borderGold : COLORS.border,
                              color: mine ? COLORS.gold : COLORS.muted,
                            }}
                          >
                            <span>{emoji}</span>
                            <span>{userIds.length}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Barre d'envoi */}
          <div
            className="p-3 border-t shrink-0"
            style={{
              borderColor: COLORS.border,
              paddingBottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px))",
              background: COLORS.bg || "#0B1220",
            }}
          >
            {recording && (
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-bold animate-pulse" style={{ color: "#EF4444" }}>
                  ● Enregistrement {formatDuration(recordSeconds)}
                </span>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="text-xs font-bold px-3 py-1 rounded-full"
                  style={{ background: "#EF4444", color: "#fff" }}
                >
                  Envoyer
                </button>
              </div>
            )}

            <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.csv"
                onChange={handleFileSelect}
                style={{
                  display: "none",
                  position: "absolute",
                  width: 1,
                  height: 1,
                  opacity: 0,
                }}
              />
              <button
                type="button"
                onClick={openFilePicker}
                disabled={uploading || recording}
                className="p-2.5 rounded-xl border disabled:opacity-40 relative"
                style={{
                  borderColor: COLORS.border,
                  color: uploading ? COLORS.gold : COLORS.muted,
                }}
                title="Joindre un fichier"
              >
                {uploading ? (
                  <span className="text-[10px] font-bold animate-pulse">…</span>
                ) : (
                  <Paperclip size={18} />
                )}
              </button>

              <button
                type="button"
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                disabled={uploading}
                className="p-2.5 rounded-xl border disabled:opacity-40"
                style={{
                  borderColor: recording ? "#EF4444" : COLORS.border,
                  color: recording ? "#EF4444" : COLORS.muted,
                  background: recording ? "rgba(239,68,68,0.15)" : "transparent",
                }}
                title="Maintenir pour enregistrer un vocal"
              >
                {recording ? <MicOff size={18} /> : <Mic size={18} />}
              </button>

              <input
                type="text"
                value={newMessage}
                onChange={(e) => handleTypingInput(e.target.value)}
                placeholder={uploading ? "Envoi…" : "Votre message…"}
                disabled={uploading || recording}
                className="flex-1 px-4 py-3 rounded-xl border text-sm outline-none disabled:opacity-50"
                style={{
                  background: COLORS.surface2,
                  borderColor: COLORS.border,
                  color: COLORS.ivory,
                }}
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || uploading || recording}
                className="p-3 rounded-xl disabled:opacity-50"
                style={{ background: COLORS.gold, color: "#000" }}
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      </>
    );
  }

  // --- Liste des conversations ---
  return (
    <>
      {callState && (
        <ChatCallModal
          mode={callState.mode}
          callType={callState.callType}
          callRecord={callState.callRecord}
          roomUrl={callState.roomUrl}
          token={callState.token}
          otherUser={callState.otherUser}
          isCaller={callState.isCaller}
          onClose={() => setCallState(null)}
        />
      )}

      <div
        className="flex flex-col h-full max-w-2xl mx-auto w-full p-4"
        style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2
            className="text-xl font-bold flex items-center gap-2"
            style={{ color: COLORS.ivory }}
          >
            <MessageCircle size={24} style={{ color: COLORS.gold }} />
            Messages
          </h2>
          <button
            onClick={() => {
              setShowNewChat(true);
              setPickerTab("friends");
              setSearchQuery("");
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-bold"
            style={{ background: "rgba(217,174,82,0.2)", color: COLORS.gold }}
          >
            <Plus size={16} />
            Nouveau
          </button>
        </div>

        <button
          onClick={() => {
            setShowNewChat(true);
            setPickerTab("friends");
          }}
          className="mb-4 w-full flex items-center gap-3 p-3 rounded-2xl border text-left"
          style={{ background: "rgba(255,255,255,0.03)", borderColor: COLORS.border }}
        >
          <Users size={18} style={{ color: COLORS.gold }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: COLORS.ivory }}>
              Écrire à un ami
            </p>
            <p className="text-xs" style={{ color: COLORS.muted }}>
              Liste d’amis ou recherche par nom / @handle
            </p>
          </div>
        </button>

        {loading && (
          <p className="text-center py-10 text-sm" style={{ color: COLORS.muted }}>
            Chargement…
          </p>
        )}

        {!loading && conversations.length === 0 && (
          <div className="text-center py-16" style={{ color: COLORS.muted }}>
            <MessageCircle size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm mb-2">Aucune conversation</p>
            <button
              onClick={() => setShowNewChat(true)}
              className="text-sm font-bold"
              style={{ color: COLORS.gold }}
            >
              Commencer un chat
            </button>
          </div>
        )}

        <div className="space-y-2">
          {conversations.map((c) => {
            let preview = "Nouvelle conversation";
            if (c.lastMsg) {
              if (c.lastMsg.deleted_at) preview = "🚫 Message supprimé";
              else if (c.lastMsg.type === "voice") preview = "🎤 Message vocal";
              else if (c.lastMsg.type === "image") preview = "📷 Photo";
              else if (c.lastMsg.type === "video") preview = "🎬 Vidéo";
              else if (c.lastMsg.type === "file") preview = `📎 ${c.lastMsg.file_name || "Fichier"}`;
              else preview = c.lastMsg.text || preview;
            }
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveChat(c)}
                className="w-full p-3 rounded-2xl border text-left hover:border-amber-400/40 transition flex items-center gap-3"
                style={{ background: COLORS.surface, borderColor: COLORS.border }}
              >
                <div
                  className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center overflow-hidden text-lg shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenProfile?.(c.otherUserId);
                  }}
                >
                  {c.otherUserAvatar ? (
                    <img
                      src={c.otherUserAvatar}
                      className="w-full h-full object-cover"
                      alt=""
                    />
                  ) : (
                    c.otherUserFlag
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="font-semibold text-sm truncate hover:underline"
                    style={{ color: COLORS.ivory }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenProfile?.(c.otherUserId);
                    }}
                  >
                    {c.otherUserName}
                  </p>
                  <p className="text-xs truncate" style={{ color: COLORS.muted }}>
                    {preview}
                  </p>
                </div>
                {c.lastMsg?.created_at && (
                  <span className="text-[10px] shrink-0" style={{ color: COLORS.muted }}>
                    {new Date(c.lastMsg.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
