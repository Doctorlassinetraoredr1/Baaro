import { applyCors } from "./_shared.js";

/**
 * Payout / rachat cash — désactivé tant qu'aucun provider n'est configuré.
 * Ne débite jamais le wallet.
 * Couvre aussi l'ancien chemin /api/stripe-redeem (rewrite).
 */
export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method === "OPTIONS") return res.status(204).end();
  res.setHeader("Cache-Control", "no-store");
  return res.status(503).json({
    ok: false,
    error: "payout_unavailable",
    message: "Le rachat cash n’est pas encore activé.",
  });
}
