const { getRedis } = require('./_lib/redis');
const { isAdminPasswordValid } = require('./_lib/auth');
const { applyCors } = require('./_lib/cors');

const ONLINE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!isAdminPasswordValid(req.query.password)) return res.status(401).json({ error: 'Incorrect admin password' });

    const redis = getRedis();
    const cutoff = Date.now() - ONLINE_WINDOW_MS;

    // Drop stale entries, then count what's left.
    await redis.zremrangebyscore('online', 0, cutoff);
    const onlineCount = await redis.zcard('online');
    const totalLogins = await redis.hlen('users');

    return res.status(200).json({ success: true, onlineCount, totalLogins });
  } catch (err) {
    console.error('online error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};
