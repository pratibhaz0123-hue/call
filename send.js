const { getRedis } = require('./_lib/redis');
const { isAdminPasswordValid, isStudentPasswordValid } = require('./_lib/auth');
const { applyCors } = require('./_lib/cors');

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { sender, message, isAdmin, password } = req.body || {};
    const cleanSender = String(sender || '').trim().slice(0, 80);
    const cleanMessage = String(message || '').trim().slice(0, 2000);

    if (!cleanSender || !cleanMessage) return res.status(400).json({ error: 'Sender and message are required' });

    const admin = !!isAdmin;
    const passwordOk = admin ? isAdminPasswordValid(password) : isStudentPasswordValid(password);
    if (!passwordOk) return res.status(401).json({ error: 'Incorrect password' });

    const redis = getRedis();
    const id = await redis.incr('messages:nextId');
    const msg = {
      id,
      sender: cleanSender,
      message: cleanMessage,
      is_admin: admin,
      pinned: false,
      created_at: new Date().toISOString()
    };

    await redis.hset('messages', { [id]: msg });

    return res.status(200).json({ success: true, message: msg });
  } catch (err) {
    console.error('send error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};
