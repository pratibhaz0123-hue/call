const { getRedis } = require('./_lib/redis');
const { applyCors } = require('./_lib/cors');

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const redis = getRedis();
    const all = (await redis.hgetall('messages')) || {};

    const list = Object.values(all).sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(a.created_at) - new Date(b.created_at);
    });

    return res.status(200).json({ success: true, messages: list });
  } catch (err) {
    console.error('messages error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};
