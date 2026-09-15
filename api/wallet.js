import { getAdminClient, requireUser } from './_shared.js';
import { rateLimitAsync } from './_shared.js';
import { applyCors } from './_shared.js';

const DAILY_CAP = 100;
const REWARD_POINTS = {
  publish_post: 5,
  publish_post_media: 5,
  like_post: 2,
  comment: 1,
  like_video: 2,
  comment_video: 1,
  publish_video: 5,
  repost_video: 2,
  publish_story: 2,
};
const REDEEM_OPTIONS = {
  r3: { cost: 300, label: 'Badge Créateur Premium' },
  r4: { cost: 150, label: 'Boost de visibilité 48h' },
};

function jsonError(res, status, error) {
  return res.status(status).json({ ok: false, error });
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  const limit = await rateLimitAsync(req, { key: 'wallet', max: 30, windowMs: 60_000 });
  if (!limit.ok) {
    Object.entries(limit.headers || {}).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(limit.status).json(limit.body);
  }

  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return jsonError(res, 405, 'Méthode non autorisée');
  }

  try {
    const admin = getAdminClient();
    const user = await requireUser(req, admin);

    if (req.method === 'GET') {
      return handleStatus(res, admin, user.id);
    }

    const body = req.body || {};
    const action = body.action;

    if (action === 'status' || action === 'get_balance') return handleStatus(res, admin, user.id);

    if (action === 'earn') {
      const actionKey = String(body.actionKey || '').trim();
      const isDaily = actionKey === 'daily_bonus';
      const pts = isDaily ? 10 : REWARD_POINTS[actionKey];
      if (!pts) return jsonError(res, 400, 'Action de récompense invalide');
      if (!isDaily && !body.referenceId) return jsonError(res, 400, 'Référence de l’action manquante');

      const { data, error } = await admin.rpc('wallet_earn', {
        p_user_id: user.id,
        p_pts: pts,
        p_label: String(body.detail || actionKey).slice(0, 120),
        p_action_key: actionKey,
        p_daily_cap: DAILY_CAP,
        p_daily_bonus: isDaily,
        p_reference_id: body.referenceId || null,
      });
      if (error) return jsonError(res, 400, normalizeWalletError(error));
      return res.status(200).json({ ok: true, ...data, dailyCap: DAILY_CAP });
    }

    if (action === 'redeem') {
      const option = REDEEM_OPTIONS[String(body.optionId || '')];
      if (!option) return jsonError(res, 400, 'Récompense non disponible');
      const { data, error } = await admin.rpc('wallet_redeem', {
        p_user_id: user.id,
        p_cost: option.cost,
        p_label: option.label,
        p_action_key: `redeem_${body.optionId}`,
      });
      if (error) return jsonError(res, 400, normalizeWalletError(error));
      return res.status(200).json({ ok: true, ...data });
    }

    if (action === 'convert') {
      const pts = Number(body.pts);
      if (!Number.isInteger(pts) || pts <= 0) return jsonError(res, 400, 'Nombre de points invalide');
      const { data, error } = await admin.rpc('wallet_convert', {
        p_user_id: user.id,
        p_pts: pts,
        p_points_per_baro: 100,
      });
      if (error) return jsonError(res, 400, normalizeWalletError(error));
      return res.status(200).json({ ok: true, ...data });
    }

    // Gift transfers are only available in an active live room. The canonical
    // database RPC takes room_id, not receiver_id, so do not silently invent a
    // receiver-only transfer path.
    if (action === 'send_gift') {
      const roomId = body.roomId || body.pkBattleId;
      const giftId = body.giftId;
      if (!roomId || !giftId) return jsonError(res, 400, 'roomId et giftId sont obligatoires');
      const { data, error } = await admin.rpc('wallet_send_gift', {
        p_sender_id: user.id,
        p_room_id: roomId,
        p_gift_type_id: String(giftId),
      });
      if (error) return jsonError(res, 400, normalizeWalletError(error));
      return res.status(200).json({ ok: true, ...data });
    }

    // Cash payout remains explicitly disabled until a verified provider flow is
    // configured. Never debit the wallet for this action.
    if (action === 'withdraw' || action === 'topup') {
      return jsonError(res, 503, 'Cette opération financière n’est pas encore activée.');
    }

    return jsonError(res, 400, 'Action non valide');
  } catch (error) {
    const status = error?.status || 500;
    console.error('[wallet]', error);
    return jsonError(res, status, status >= 500 ? 'Erreur serveur' : error.message);
  }
}

async function handleStatus(res, admin, userId) {
  const { data, error } = await admin.rpc('wallet_ensure', {
    p_user_id: userId,
    p_welcome_bonus: 50,
  });
  if (error) return jsonError(res, 500, normalizeWalletError(error));

  const [{ data: holdings, error: holdingsError }, { data: dailyRows, error: dailyError }] = await Promise.all([
    admin.from('crypto_holdings').select('holdings').eq('user_id', userId).maybeSingle(),
    admin.from('transactions').select('action_key,day_key,pts,created_at').eq('user_id', userId).gte('created_at', new Date(new Date().setHours(0,0,0,0)).toISOString()).gt('pts', 0),
  ]);
  if (holdingsError) return jsonError(res, 500, normalizeWalletError(holdingsError));
  if (dailyError) return jsonError(res, 500, normalizeWalletError(dailyError));

  const earnedToday = (dailyRows || []).reduce((sum, row) => sum + Number(row.pts || 0), 0);
  const dailyClaimed = (dailyRows || []).some((row) => row.action_key === 'daily_bonus');
  return res.status(200).json({
    ok: true,
    balance: Number(data?.balance || 0),
    holdings: Number(holdings?.holdings || 0),
    earnedToday,
    remainingToday: Math.max(0, DAILY_CAP - earnedToday),
    dailyCap: DAILY_CAP,
    dailyClaimed,
  });
}

function normalizeWalletError(error) {
  const message = error?.message || 'Opération wallet impossible';
  const known = {
    DAILY_BONUS_ALREADY_CLAIMED: 'Bonus quotidien déjà réclamé',
    DAILY_CAP_REACHED: 'Plafond quotidien atteint',
    REWARD_ALREADY_CLAIMED: 'Récompense déjà attribuée',
    REWARD_EVENT_NOT_FOUND: 'Événement de récompense introuvable',
    REWARD_REFERENCE_REQUIRED: 'Référence de l’événement requise',
    INSUFFICIENT_BALANCE: 'Solde insuffisant',
  };
  return known[message] || message;
}
