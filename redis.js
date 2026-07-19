const { Redis } = require('@upstash/redis');

let client = null;

/**
 * Returns a singleton Upstash Redis client. Works over plain HTTPS REST
 * calls, so it's a perfect fit for Vercel serverless functions - no
 * persistent connection or local filesystem needed, and data survives
 * cold starts because it actually lives outside the function.
 *
 * When you add the Upstash integration from the Vercel Marketplace, it
 * auto-populates environment variables. Depending on how it was added
 * they may be named UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN,
 * or (older "Vercel KV" style) KV_REST_API_URL / KV_REST_API_TOKEN - this
 * checks both so it works either way.
 */
function getRedis() {
  if (client) return client;

  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    throw new Error(
      'Missing Upstash Redis environment variables. Add the Upstash integration ' +
      'to this project in the Vercel dashboard (Storage tab), or set ' +
      'UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN manually.'
    );
  }

  client = new Redis({ url, token });
  return client;
}

module.exports = { getRedis };
