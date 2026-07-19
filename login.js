const { getRedis } = require('./_lib/redis');
const { isAdminPasswordValid, isStudentPasswordValid } = require('./_lib/auth');
const { applyCors } = require('./_lib/cors');

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { name, password, role } = req.body || {};

    if (role === 'admin') {
      if (!isAdminPasswordValid(password)) return res.status(401).json({ error: 'Incorrect admin password' });
      return res.status(200).json({ success: true, role: 'admin' });
    }

    if (role === 'student') {
      const cleanName = String(name || '').trim().slice(0, 80);
      if (!cleanName) return res.status(400).json({ error: 'Student name is required' });
      if (!isStudentPasswordValid(password)) return res.status(401).json({ error: 'Incorrect password' });

      const redis = getRedis();
      const id = await redis.incr('users:nextId');
      const now = Date.now();
      const user = {
        id,
        name: cleanName,
        login_time: new Date(now).toISOString(),
        last_seen: new Date(now).toISOString()
      };

      await redis.hset('users', { [id]: user });
      await redis.hset('users:byName', { [cleanName]: id });
      await redis.zadd('online', { score: now, member: cleanName });

      return res.status(200).json({ success: true, role: 'student', name: cleanName });
    }

    return res.status(400).json({ error: 'Invalid role' });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};
