/**
 * BAARO Live — Daily.co + debate_rooms
 * Routes (via vercel rewrite, max 12 endpoints) :
 *   POST /api/live
 *   POST /api/create-room  → /api/live
 *   POST /api/live-roles   → /api/live
 *
 * Env : DAILY_API_KEY, DAILY_DOMAIN (optionnel), SUPABASE_*
 * Actions : create-room | join-room | resolve-code | pause-room | resume-room | delete-room
 *           request | respond | set-role  (rôles)
 */
import { applyCors, getAdminClient, requireUser } from "./_shared.js";

const DAILY_API = "https://api.daily.co/v1";

function dailyKey() {
  const key = process.env.DAILY_API_KEY;
  if (!key) {
    const err = new Error(
      "DAILY_API_KEY manquante sur Vercel. Configurez la clé Daily.co."
    );
    err.status = 503;
    throw err;
  }
  return key;
}

function dailyDomain() {
  return (process.env.DAILY_DOMAIN || "baaro").replace(/\.daily\.co$/i, "");
}

async function dailyFetch(path, options = {}) {
  const res = await fetch(`${DAILY_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${dailyKey()}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      data?.info || data?.error || data?.message || `Daily HTTP ${res.status}`;
    const err = new Error(String(msg));
    err.status = res.status >= 400 && res.status < 600 ? res.status : 502;
    throw err;
  }
  return data;
}

function inviteCode() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function roomUrl(name) {
  return `https://${dailyDomain()}.daily.co/${name}`;
}

async function createMeetingToken(roomName, { isOwner = false, userName = "BAARO", userId } = {}) {
  const body = {
    properties: {
      room_name: roomName,
      is_owner: !!isOwner,
      enable_screenshare: true,
      start_audio_off: !isOwner,
      start_video_off: true,
      user_name: String(userName || "BAARO").slice(0, 40),
    },
  };
  if (userId) body.properties.user_id = String(userId);
  const tok = await dailyFetch("/meeting-tokens", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return tok.token;
}

async function handleCreateRoom(admin, user, body, res) {
  const title = String(body.title || "Live BAARO").slice(0, 120);
  const topic = String(body.topic || "").slice(0, 500);
  const mode = ["audio", "video", "text", "hybrid"].includes(body.mode)
    ? body.mode === "hybrid"
      ? "video"
      : body.mode
    : "audio";
  const userName = String(body.userName || "Hôte").slice(0, 40);
  const enableHLS = !!body.enableHLS;

  const code = inviteCode();
  const roomName = `baaro-${code}-${Date.now().toString(36)}`;

  // Room Daily
  const properties = {
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 6, // 6h
    enable_chat: false,
    start_audio_off: false,
    start_video_off: mode !== "video",
    max_participants: 20,
  };
  if (enableHLS) {
    properties.enable_recording = "cloud";
  }

  await dailyFetch("/rooms", {
    method: "POST",
    body: JSON.stringify({ name: roomName, properties }),
  });

  const token = await createMeetingToken(roomName, {
    isOwner: true,
    userName,
    userId: user.id,
  });

  // debate_rooms
  const { data: room, error } = await admin
    .from("debate_rooms")
    .insert({
      title,
      topic,
      mode,
      invite_code: code,
      status: "active",
      host_id: user.id,
      daily_room_name: roomName,
      max_participants: 12,
    })
    .select("id, title, topic, mode, invite_code, status, host_id, daily_room_name")
    .single();

  if (error) {
    console.error("[live] debate_rooms insert", error);
    // tente cleanup Daily
    try {
      await dailyFetch(`/rooms/${roomName}`, { method: "DELETE" });
    } catch (_) {}
    return res.status(500).json({ error: error.message || "Création salle DB échouée" });
  }

  // host participant
  try {
    await admin.from("debate_participants").upsert(
      {
        room_id: room.id,
        user_id: user.id,
        role: "host",
      },
      { onConflict: "room_id,user_id" }
    );
  } catch (e) {
    console.warn("[live] participant host", e);
  }

  return res.status(200).json({
    ok: true,
    roomId: room.id,
    roomName,
    roomUrl: roomUrl(roomName),
    token,
    inviteCode: code,
    hlsEnabled: enableHLS,
    title: room.title,
    mode: room.mode,
  });
}

async function handleJoinRoom(admin, user, body, res) {
  const roomId = body.roomId;
  const roomName = body.roomName;
  const userName = String(body.userName || "BAARO").slice(0, 40);

  let room;
  if (roomId) {
    const { data } = await admin
      .from("debate_rooms")
      .select("id, status, daily_room_name, host_id, mode, invite_code")
      .eq("id", roomId)
      .maybeSingle();
    room = data;
  } else if (roomName) {
    const { data } = await admin
      .from("debate_rooms")
      .select("id, status, daily_room_name, host_id, mode, invite_code")
      .eq("daily_room_name", roomName)
      .maybeSingle();
    room = data;
  }

  if (!room?.daily_room_name) {
    return res.status(404).json({ error: "Salle introuvable" });
  }
  if (room.status === "ended") {
    return res.status(410).json({ error: "Live terminé" });
  }

  const isHost = room.host_id === user.id;
  let role = "viewer";
  if (isHost) role = "host";
  else {
    const { data: part } = await admin
      .from("debate_participants")
      .select("role")
      .eq("room_id", room.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (part?.role === "co_host" || part?.role === "host") role = part.role;
  }

  if (!isHost) {
    await admin.from("debate_participants").upsert(
      {
        room_id: room.id,
        user_id: user.id,
        role: role === "host" ? "host" : role === "co_host" ? "co_host" : "viewer",
      },
      { onConflict: "room_id,user_id" }
    );
  }

  const token = await createMeetingToken(room.daily_room_name, {
    isOwner: isHost,
    userName,
    userId: user.id,
  });

  return res.status(200).json({
    ok: true,
    roomId: room.id,
    roomName: room.daily_room_name,
    roomUrl: roomUrl(room.daily_room_name),
    token,
    role,
    status: room.status,
  });
}

async function handleResolveCode(admin, body, res) {
  const code = String(body.inviteCode || body.code || "")
    .trim()
    .toLowerCase();
  if (!code) return res.status(400).json({ error: "Code manquant" });

  const { data: room } = await admin
    .from("debate_rooms")
    .select("id, daily_room_name, status, invite_code")
    .ilike("invite_code", code)
    .in("status", ["active", "paused"])
    .maybeSingle();

  if (!room) return res.status(404).json({ error: "Code invalide" });

  return res.status(200).json({
    ok: true,
    roomId: room.id,
    roomName: room.daily_room_name,
    status: room.status,
    inviteCode: room.invite_code,
  });
}

async function handlePauseResume(admin, user, body, res, status) {
  const roomId = body.roomId;
  if (!roomId) return res.status(400).json({ error: "roomId requis" });

  const { data: room } = await admin
    .from("debate_rooms")
    .select("id, host_id")
    .eq("id", roomId)
    .maybeSingle();

  if (!room) return res.status(404).json({ error: "Salle introuvable" });
  if (room.host_id !== user.id) {
    return res.status(403).json({ error: "Réservé à l'hôte" });
  }

  const { error } = await admin
    .from("debate_rooms")
    .update({ status })
    .eq("id", roomId);
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ ok: true, status });
}

async function handleDeleteRoom(admin, user, body, res) {
  const roomName = body.roomName;
  if (!roomName) return res.status(400).json({ error: "roomName requis" });

  const { data: room } = await admin
    .from("debate_rooms")
    .select("id, host_id, daily_room_name")
    .eq("daily_room_name", roomName)
    .maybeSingle();

  if (room && room.host_id !== user.id) {
    return res.status(403).json({ error: "Réservé à l'hôte" });
  }

  if (room) {
    await admin
      .from("debate_rooms")
      .update({ status: "ended" })
      .eq("id", room.id);
  }

  try {
    await dailyFetch(`/rooms/${encodeURIComponent(roomName)}`, {
      method: "DELETE",
    });
  } catch (e) {
    console.warn("[live] delete daily room", e.message);
  }

  return res.status(200).json({ ok: true });
}

/** Rôles : request / respond / set-role */
async function handleRoles(admin, user, body, res) {
  const action = body.action;

  if (action === "request") {
    const roomId = body.roomId;
    const targetUserId = body.targetUserId || user.id;
    if (!roomId) return res.status(400).json({ error: "roomId requis" });

    const { data: room } = await admin
      .from("debate_rooms")
      .select("id, host_id")
      .eq("id", roomId)
      .maybeSingle();
    if (!room) return res.status(404).json({ error: "Salle introuvable" });

    // Table optionnelle debate_role_requests
    const { data: reqRow, error } = await admin
      .from("debate_role_requests")
      .insert({
        room_id: roomId,
        user_id: targetUserId,
        requested_role: "co_host",
        status: "pending",
      })
      .select("id")
      .maybeSingle();

    if (error) {
      // fallback sans table dédiée
      console.warn("[live] role request table", error.message);
      return res.status(200).json({
        ok: true,
        requestId: null,
        message: "Demande enregistrée (hôte notifié via realtime si dispo)",
      });
    }

    return res.status(200).json({ ok: true, requestId: reqRow?.id });
  }

  if (action === "respond") {
    const { requestId, accept } = body;
    if (!requestId) return res.status(400).json({ error: "requestId requis" });

    const { data: reqRow } = await admin
      .from("debate_role_requests")
      .select("id, room_id, user_id, status")
      .eq("id", requestId)
      .maybeSingle();

    if (!reqRow) return res.status(404).json({ error: "Demande introuvable" });

    const { data: room } = await admin
      .from("debate_rooms")
      .select("host_id")
      .eq("id", reqRow.room_id)
      .maybeSingle();

    if (room?.host_id !== user.id) {
      return res.status(403).json({ error: "Réservé à l'hôte" });
    }

    const newStatus = accept ? "accepted" : "rejected";
    await admin
      .from("debate_role_requests")
      .update({ status: newStatus })
      .eq("id", requestId);

    if (accept) {
      await admin.from("debate_participants").upsert(
        {
          room_id: reqRow.room_id,
          user_id: reqRow.user_id,
          role: "co_host",
        },
        { onConflict: "room_id,user_id" }
      );
    }

    return res.status(200).json({ ok: true, status: newStatus });
  }

  if (action === "set-role") {
    const { roomId, targetUserId, role } = body;
    if (!roomId || !targetUserId || !role) {
      return res.status(400).json({ error: "roomId, targetUserId, role requis" });
    }

    const { data: room } = await admin
      .from("debate_rooms")
      .select("host_id")
      .eq("id", roomId)
      .maybeSingle();

    if (room?.host_id !== user.id) {
      return res.status(403).json({ error: "Réservé à l'hôte" });
    }

    const safeRole = ["viewer", "co_host", "host"].includes(role)
      ? role
      : "viewer";

    await admin.from("debate_participants").upsert(
      {
        room_id: roomId,
        user_id: targetUserId,
        role: safeRole,
      },
      { onConflict: "room_id,user_id" }
    );

    return res.status(200).json({ ok: true, role: safeRole });
  }

  return res.status(400).json({ error: "Action rôles inconnue" });
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  let admin;
  try {
    admin = getAdminClient();
  } catch (e) {
    return res.status(500).json({ error: e.message || "Config serveur" });
  }

  let user;
  try {
    user = await requireUser(req, admin);
  } catch (e) {
    return res.status(e.status || 401).json({
      error: e.message || "Non autorisé",
    });
  }

  const body = req.method === "GET" ? req.query || {} : req.body || {};
  const action = body.action || (req.method === "GET" ? "list" : null);

  try {
    // Rôles (aussi via /api/live-roles rewrite)
    if (
      action === "request" ||
      action === "respond" ||
      action === "set-role"
    ) {
      return await handleRoles(admin, user, body, res);
    }

    if (action === "create-room") {
      return await handleCreateRoom(admin, user, body, res);
    }
    if (action === "join-room") {
      return await handleJoinRoom(admin, user, body, res);
    }
    if (action === "resolve-code") {
      return await handleResolveCode(admin, body, res);
    }
    if (action === "pause-room") {
      return await handlePauseResume(admin, user, body, res, "paused");
    }
    if (action === "resume-room") {
      return await handlePauseResume(admin, user, body, res, "active");
    }
    if (action === "delete-room") {
      return await handleDeleteRoom(admin, user, body, res);
    }

    // GET list battles legacy (pk_battles optionnel)
    if (req.method === "GET" || action === "list") {
      const { data: battles } = await admin
        .from("pk_battles")
        .select("id, status, created_at")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(10);
      return res.status(200).json({ success: true, battles: battles || [] });
    }

    return res.status(400).json({
      error:
        "Action inconnue (create-room | join-room | resolve-code | pause-room | resume-room | delete-room | request | respond | set-role)",
    });
  } catch (e) {
    console.error("[api/live]", e);
    const status = e.status || 500;
    return res.status(status).json({
      error: e.message || "Erreur live",
    });
  }
}
