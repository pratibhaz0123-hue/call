const { getRedis } = require('./_lib/redis');
const { isAdminPasswordValid } = require('./_lib/auth');
const { applyCors } = require('./_lib/cors');

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { id, pinned, password } = req.body || {};
    if (!isAdminPasswordValid(password)) return res.status(401).json({ error: 'Incorrect admin password' });
    if (!id) return res.status(400).json({ error: 'Message id is required' });

    const redis = getRedis();
    const existing = await redis.hget('messages', String(id));
    if (!existing) return res.status(404).json({ error: 'Message not found' });

    const updated = { ...existing, pinned: !!pinned };
    await redis.hset('messages', { [id]: updated });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('pin error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};
