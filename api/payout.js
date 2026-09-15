import { applyCors } from './_shared.js';

// Payout endpoint is intentionally disabled until a verified provider and
// settlement flow are configured. It never debits a user's wallet.
export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method === 'OPTIONS') return res.status(204).end();
  res.setHeader('Cache-Control', 'no-store');
  return res.status(503).json({ ok: false, error: 'payout_unavailable' });
}
