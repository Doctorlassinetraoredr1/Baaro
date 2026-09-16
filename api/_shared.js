/**
 * CORS partagé pour les routes /api/*
 *
 * Production : uniquement les origines listées dans ALLOWED_ORIGINS.
 * Dev : localhost autorisé par défaut.
 * Origine interdite en prod → 403 explicite.
 */

const DEFAULT_ALLOWED = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
];

function getAllowedOrigins() {
  const fromEnv = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ALLOWED, ...fromEnv])];
}

function isProduction() {
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  );
}

/**
 * Applique les headers CORS et gère OPTIONS.
 * @returns {boolean} true si la requête a déjà été répondue (OPTIONS ou 403)
 */
export function applyCors(req, res) {
  const origin = req.headers.origin || "";
  const allowed = getAllowedOrigins();

  if (allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (origin && isProduction()) {
    // Origine non autorisée en production → refus explicite
    res.setHeader("Vary", "Origin");
    res.status(403).json({ error: "Origin not allowed" });
    return true;
  } else if (!origin) {
    // Requêtes serveur / clients natifs sans header Origin
  } else {
    // Dev : origine inconnue → pas d'Allow-Origin
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Session-Id, X-BAARO-Country"
  );
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}


/**
 * Logging structuré pour les API BAARO (Vercel / logs JSON).
 * Sentry retiré des dépendances pour accélérer npm install sur Vercel
 * (évite le timeout require-in-the-middle / OpenTelemetry).
 * Les erreurs restent dans les logs Vercel via console.*.
 */

export function logInfo(context, message, extra = {}) {
  console.log(
    JSON.stringify({
      level: "info",
      service: "baaro-api",
      context,
      message,
      ...extra,
      ts: new Date().toISOString(),
    })
  );
}

export function logWarn(context, message, extra = {}) {
  console.warn(
    JSON.stringify({
      level: "warn",
      service: "baaro-api",
      context,
      message,
      ...extra,
      ts: new Date().toISOString(),
    })
  );
}

export function logError(context, err, extra = {}) {
  console.error(
    JSON.stringify({
      level: "error",
      service: "baaro-api",
      context,
      message: err?.message || String(err),
      stack: err?.stack?.slice?.(0, 800) || undefined,
      ...extra,
      ts: new Date().toISOString(),
    })
  );
}

/** Compat serverless — no-op sans @sentry/node */
export async function flushLogs(_timeoutMs = 1500) {
  /* no-op */
}


/**
 * Rate limiter par IP + clé métier.
 * - Si UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN → Redis distribué (prod multi-instance)
 * - Sinon → Map mémoire (dev / single instance)
 *
 * Usage synchrone pour compatibilité handlers existants :
 *   export function rateLimit(...)  → mémoire
 *   export async function rateLimitAsync(...) → Redis si dispo, sinon mémoire
 *
 * Les routes peuvent migrer vers rateLimitAsync progressivement.
 */

const store = new Map();

function clientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    "unknown"
  );
}

function memoryLimit(req, { key, max = 20, windowMs = 60_000 }) {
  const ip = clientIp(req);
  const bucketKey = `${key}:${ip}`;
  const now = Date.now();
  let bucket = store.get(bucketKey);

  if (!bucket || now - bucket.start >= windowMs) {
    bucket = { start: now, count: 0 };
    store.set(bucketKey, bucket);
  }

  bucket.count += 1;

  if (store.size > 5000) {
    for (const [k, value] of store) {
      if (now - value.start >= windowMs) store.delete(k);
    }
  }

  if (bucket.count > max) {
    const retryAfter = Math.ceil((windowMs - (now - bucket.start)) / 1000);
    return {
      ok: false,
      status: 429,
      body: { error: "Trop de requêtes", retryAfter },
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(max),
        "X-RateLimit-Remaining": "0",
      },
    };
  }

  return { ok: true, remaining: max - bucket.count };
}

/** Sync — mémoire uniquement (rétrocompat). */
export function rateLimit(req, opts) {
  return memoryLimit(req, opts);
}

function upstashConfigured() {
  return !!(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

/**
 * Async — Upstash REST (INCR + EXPIRE) si configuré, sinon mémoire.
 */
export async function rateLimitAsync(req, { key, max = 20, windowMs = 60_000 }) {
  if (!upstashConfigured()) {
    return memoryLimit(req, { key, max, windowMs });
  }

  const ip = clientIp(req);
  const redisKey = `rl:${key}:${ip}`;
  const url = process.env.UPSTASH_REDIS_REST_URL.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));

  try {
    // Pipeline: INCR puis EXPIRE si première fois (TTL)
    const incrRes = await fetch(`${url}/incr/${encodeURIComponent(redisKey)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const incrData = await incrRes.json();
    const count = Number(incrData?.result ?? 0);

    if (count === 1) {
      await fetch(
        `${url}/expire/${encodeURIComponent(redisKey)}/${windowSec}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
    }

    if (count > max) {
      const retryAfter = windowSec;
      return {
        ok: false,
        status: 429,
        body: { error: "Trop de requêtes", retryAfter },
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(max),
          "X-RateLimit-Remaining": "0",
        },
      };
    }

    return { ok: true, remaining: Math.max(0, max - count) };
  } catch (e) {
    console.error("rateLimitAsync Upstash fallback memory:", e?.message || e);
    return memoryLimit(req, { key, max, windowMs });
  }
}


/**
 * Helpers Stripe — erreurs normalisées pour BAARO
 * À placer dans api/_stripe.js (préfixe _ = pas un endpoint)
 */
import Stripe from 'stripe';

let _stripe = null;

export function getStripe() {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY manquante');
  _stripe = new Stripe(key, {
    apiVersion: '2024-11-20.acacia',
    maxNetworkRetries: 2,
  });
  return _stripe;
}

/**
 * Mappe une erreur Stripe vers un message utilisateur + code HTTP stable.
 */
export function mapStripeError(err) {
  const base = {
    ok: false,
    provider: 'stripe',
    type: err?.type || 'unknown',
    code: err?.code || null,
    decline_code: err?.decline_code || null,
    param: err?.param || null,
    requestId: err?.requestId || err?.raw?.requestId || null,
    message: 'Erreur de paiement. Réessaie ou utilise un autre moyen.',
    status: 402,
  };

  switch (err?.type) {
    case 'StripeCardError':
      // Carte refusée / insuffisant / fraud
      return {
        ...base,
        status: 402,
        message: humanCardMessage(err),
      };

    case 'StripeRateLimitError':
      return {
        ...base,
        status: 429,
        message: 'Trop de tentatives. Attends quelques secondes puis réessaie.',
      };

    case 'StripeInvalidRequestError':
      return {
        ...base,
        status: 400,
        message: err.message || 'Requête de paiement invalide.',
      };

    case 'StripeAPIError':
      return {
        ...base,
        status: 502,
        message: 'Service de paiement temporairement indisponible. Réessaie plus tard.',
      };

    case 'StripeConnectionError':
      return {
        ...base,
        status: 503,
        message: 'Impossible de joindre le service de paiement. Vérifie ta connexion.',
      };

    case 'StripeAuthenticationError':
      // Clé API invalide — côté serveur, ne pas exposer le détail
      console.error('[Stripe] Authentication error', err.message);
      return {
        ...base,
        status: 500,
        message: 'Configuration paiement invalide. Contacte le support.',
      };

    case 'StripePermissionError':
      return {
        ...base,
        status: 403,
        message: 'Paiement non autorisé pour ce compte.',
      };

    case 'StripeIdempotencyError':
      return {
        ...base,
        status: 409,
        message: 'Cette opération a déjà été traitée. Rafraîchis la page.',
      };

    default:
      // Erreurs réseau Node, timeouts, etc.
      if (err?.code === 'ETIMEDOUT' || err?.code === 'ECONNRESET') {
        return {
          ...base,
          status: 503,
          message: 'Délai dépassé avec le service de paiement. Réessaie.',
        };
      }
      console.error('[Stripe] Unhandled error', err);
      return {
        ...base,
        status: 500,
        message: err?.message || base.message,
      };
  }
}

function humanCardMessage(err) {
  const code = err.decline_code || err.code;
  const map = {
    card_declined: 'Carte refusée par ta banque.',
    insufficient_funds: 'Fonds insuffisants.',
    lost_card: 'Carte signalée comme perdue. Contacte ta banque.',
    stolen_card: 'Carte signalée comme volée. Contacte ta banque.',
    expired_card: 'Carte expirée.',
    incorrect_cvc: 'Code de sécurité (CVC) incorrect.',
    incorrect_number: 'Numéro de carte incorrect.',
    invalid_expiry_month: 'Mois d’expiration invalide.',
    invalid_expiry_year: 'Année d’expiration invalide.',
    processing_error: 'Erreur de traitement. Réessaie dans un instant.',
    fraudulent: 'Paiement bloqué pour suspicion de fraude.',
    do_not_honor: 'Banque a refusé le paiement. Contacte ta banque.',
    generic_decline: 'Paiement refusé. Essaie une autre carte.',
  };
  if (code && map[code]) return map[code];
  // Message Stripe déjà en langage naturel (souvent en anglais)
  if (err.message && err.message.length < 120) return err.message;
  return 'Paiement par carte refusé. Vérifie tes informations ou utilise un autre moyen.';
}

/**
 * Crée une Checkout Session Stripe.
 * amount en unité majeure (ex: 10.50 EUR) → converti en centimes sauf devises zéro-décimale.
 */
const ZERO_DECIMAL = new Set(['XOF', 'XAF', 'JPY', 'KRW', 'VND']);

export function toStripeAmount(amount, currency) {
  const cur = String(currency || 'XOF').toUpperCase();
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) throw Object.assign(new Error('Montant invalide'), { type: 'StripeInvalidRequestError' });
  if (ZERO_DECIMAL.has(cur)) return Math.round(n);
  return Math.round(n * 100);
}

export async function createCheckoutSession({
  amount,
  currency,
  paymentRef,
  description,
  customerEmail,
  successUrl,
  cancelUrl,
  metadata = {},
}) {
  const stripe = getStripe();
  const unitAmount = toStripeAmount(amount, currency);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: String(currency).toLowerCase(),
            unit_amount: unitAmount,
            product_data: {
              name: description || 'Paiement BAARO',
            },
          },
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: paymentRef,
      customer_email: customerEmail || undefined,
      metadata: {
        payment_ref: paymentRef,
        ...metadata,
      },
    });

    return {
      ok: true,
      payment_url: session.url,
      session_id: session.id,
      transaction_id: paymentRef,
    };
  } catch (err) {
    throw mapStripeError(err);
  }
}

/**
 * Vérifie la signature du webhook Stripe.
 * rawBody = Buffer ou string brut (pas le JSON parsé).
 */
export function constructStripeEvent(rawBody, signature) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET manquante');
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}


import { createClient } from "@supabase/supabase-js";

// Accepte VITE_SUPABASE_URL ou SUPABASE_URL (alignement create-payment legacy)
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getAdminClient() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error(
      "Configuration serveur incomplète : VITE_SUPABASE_URL (ou SUPABASE_URL) et SUPABASE_SERVICE_ROLE_KEY doivent être définies."
    );
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * JWT Bearer uniquement — jamais de user_id client.
 */
export async function requireUser(req, admin) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    const err = new Error("Authentification manquante");
    err.status = 401;
    throw err;
  }
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) {
    const err = new Error("Session invalide ou expirée");
    err.status = 401;
    throw err;
  }
  return data.user;
}
