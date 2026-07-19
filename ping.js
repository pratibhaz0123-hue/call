const { getRedis } = require('./_lib/redis');
const { applyCors } = require('./_lib/cors');

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { name } = req.body || {};
    const cleanName = String(name || '').trim().slice(0, 80);
    if (!cleanName) return res.status(400).json({ error: 'Name is required' });

    const redis = getRedis();
    const now = Date.now();

    await redis.zadd('online', { score: now, member: cleanName });

    const id = await redis.hget('users:byName', cleanName);
    if (id) {
      const user = await redis.hget('users', String(id));
      if (user) {
        user.last_seen = new Date(now).toISOString();
        await redis.hset('users', { [id]: user });
      }
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('ping error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};
