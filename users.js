const { getRedis } = require('./_lib/redis');
const { isAdminPasswordValid } = require('./_lib/auth');
const { applyCors } = require('./_lib/cors');

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!isAdminPasswordValid(req.query.password)) return res.status(401).json({ error: 'Incorrect admin password' });

    const redis = getRedis();
    const all = (await redis.hgetall('users')) || {};
    const list = Object.values(all).sort((a, b) => new Date(b.login_time) - new Date(a.login_time));

    return res.status(200).json({ success: true, users: list });
  } catch (err) {
    console.error('users error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};
