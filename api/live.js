/**
 * BAARO Live / PK Battles — handler Node (Vercel)
 * Identité : auth.users.id via Bearer JWT uniquement.
 */
import { createClient } from "@supabase/supabase-js";
import { applyCors, getAdminClient, requireUser } from "./_shared.js";

function adminDb() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Configuration Supabase serveur incomplète");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== "GET" && req.method !== "POST") {
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

  const supabase = adminDb();
  const battleId =
    (req.query && (req.query.battle_id || req.query.battleId)) ||
    (typeof req.url === "string"
      ? new URL(req.url, "http://localhost").searchParams.get("battle_id")
      : null);

  try {
    if (req.method === "GET") {
      if (battleId) {
        const { data: battle, error } = await supabase
          .from("pk_battles")
          .select(
            `
            *,
            streamer_a:profiles!streamer_a_id(display_name, avatar_url),
            streamer_b:profiles!streamer_b_id(display_name, avatar_url)
          `
          )
          .eq("id", battleId)
          .single();
        if (error) throw error;
        return res.status(200).json({ success: true, battle });
      }

      const { data: battles, error } = await supabase
        .from("pk_battles")
        .select(
          `
          *,
          streamer_a:profiles!streamer_a_id(display_name, avatar_url),
          streamer_b:profiles!streamer_b_id(display_name, avatar_url)
        `
        )
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return res.status(200).json({ success: true, battles: battles || [] });
    }

    // POST — actions battle (création / join) si body fourni
    const body = req.body || {};
    const action = body.action || "list";

    if (action === "create") {
      const { data, error } = await supabase
        .from("pk_battles")
        .insert({
          streamer_a_id: user.id,
          status: "active",
          title: String(body.title || "PK Battle").slice(0, 120),
        })
        .select()
        .single();
      if (error) throw error;
      return res.status(201).json({ success: true, battle: data });
    }

    if (action === "join" && body.battle_id) {
      const { data, error } = await supabase
        .from("pk_battles")
        .update({ streamer_b_id: user.id })
        .eq("id", body.battle_id)
        .eq("status", "active")
        .is("streamer_b_id", null)
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json({ success: true, battle: data });
    }

    return res.status(400).json({ error: "Action invalide" });
  } catch (e) {
    console.error("[api/live]", e);
    return res.status(500).json({
      error: e.message || "Erreur live",
    });
  }
}
