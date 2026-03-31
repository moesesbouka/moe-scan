// Simple in-memory rate limiter.
// NOTE: Netlify Functions may run across multiple Lambda instances — this Map
// resets per cold start. It prevents single-session abuse but is not a full
// distributed rate limiter. For true rate limiting, use Netlify Blobs or an
// edge KV store.
const RATE_LIMIT = new Map();

/**
 * @param {string} ip
 * @param {number} maxPerMinute
 * @returns {boolean} true if the IP has exceeded the limit
 */
function isRateLimited(ip = 'unknown', maxPerMinute = 30) {
  const now = Date.now();
  const entry = RATE_LIMIT.get(ip);
  if (!entry || entry.resetTime < now) {
    RATE_LIMIT.set(ip, { count: 1, resetTime: now + 60_000 });
    return false;
  }
  if (entry.count >= maxPerMinute) return true;
  entry.count++;
  return false;
}

function getClientIp(event = {}) {
  return (
    event.headers?.['client-ip'] ||
    event.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
    event.headers?.['x-real-ip'] ||
    'unknown'
  );
}

module.exports = { isRateLimited, getClientIp };
