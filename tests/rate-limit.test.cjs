const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isRateLimited, getClientIp } = require('../netlify/functions/lib/rate-limit.cjs');

test('isRateLimited allows first N requests', () => {
  const ip = `test-${Date.now()}-a`;
  for (let i = 0; i < 5; i++) {
    assert.equal(isRateLimited(ip, 5), false, `request ${i+1} should be allowed`);
  }
  // 6th should be blocked
  assert.equal(isRateLimited(ip, 5), true, '6th request should be rate limited');
});

test('getClientIp extracts from headers correctly', () => {
  assert.equal(getClientIp({ headers: { 'client-ip': '1.2.3.4' } }), '1.2.3.4');
  assert.equal(getClientIp({ headers: { 'x-forwarded-for': '5.6.7.8, 9.10.11.12' } }), '5.6.7.8');
  assert.equal(getClientIp({}), 'unknown');
});

test('isRateLimited resets after window expires', () => {
  const ip = `test-${Date.now()}-b`;
  // Use max 1 to make it easy to hit limit
  assert.equal(isRateLimited(ip, 1), false);
  assert.equal(isRateLimited(ip, 1), true);
});
