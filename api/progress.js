// api/progress.js — MMD · Upstash Redis progress tracker
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!REDIS_URL || !REDIS_TOKEN) return res.status(500).json({ error: 'Redis non configuré' });

  // GET /api/progress?hash=xxx  →  { bc1: {status:'available'}, ... }
  if (req.method === 'GET') {
    const { hash } = req.query;
    if (!hash) return res.status(400).json({ error: 'hash requis' });
    const key = `mmd:student:${hash}:progress`;
    try {
      const r = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
      });
      const json = await r.json();
      const data = json.result ? JSON.parse(json.result) : {};
      return res.status(200).json(data);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // POST /api/progress  body: { hash, bloc, status }
  if (req.method === 'POST') {
    const { hash, bloc, status } = req.body || {};
    if (!hash || !bloc || !status) return res.status(400).json({ error: 'hash, bloc, status requis' });
    const key = `mmd:student:${hash}:progress`;
    try {
      // Lire l'existant
      const r = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${REDIS_TOKEN}` }
      });
      const json = await r.json();
      const current = json.result ? JSON.parse(json.result) : {};
      current[bloc] = { status, updatedAt: new Date().toISOString() };
      // Écrire avec TTL 90 jours
      await fetch(`${REDIS_URL}/set/${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: JSON.stringify(current), ex: 7776000 })
      });
      return res.status(200).json({ ok: true, key, data: current });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
