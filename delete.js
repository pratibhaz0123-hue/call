const { getRedis } = require('./_lib/redis');
const { isAdminPasswordValid } = require('./_lib/auth');
const { applyCors } = require('./_lib/cors');

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST' && req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { id, password } = req.body || {};
    if (!isAdminPasswordValid(password)) return res.status(401).json({ error: 'Incorrect admin password' });
    if (!id) return res.status(400).json({ error: 'Message id is required' });

    const redis = getRedis();
    const removed = await redis.hdel('messages', String(id));
    if (!removed) return res.status(404).json({ error: 'Message not found' });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('delete error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};
