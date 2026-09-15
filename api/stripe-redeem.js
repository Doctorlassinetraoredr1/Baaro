import { applyCors } from './_cors.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method === 'OPTIONS') return res.status(204).end();
  return res.status(503).json({ ok: false, error: 'Le rachat cash n’est pas encore activé.' });
}
