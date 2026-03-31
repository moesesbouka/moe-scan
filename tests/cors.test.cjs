const test = require('node:test');
const assert = require('node:assert/strict');
const { getCors, getAllowedOrigin } = require('../netlify/functions/lib/cors.cjs');

test('getAllowedOrigin returns matching allowed origin', () => {
  assert.equal(getAllowedOrigin('http://localhost:8888/page'), 'http://localhost:8888');
});

test('getCors falls back to primary origin for unknown domains', () => {
  const cors = getCors({ headers: { origin: 'https://evil.example.com' } });
  assert.equal(cors['Access-Control-Allow-Origin'], 'https://crazymoe.netlify.app');
  assert.equal(cors['Vary'], 'Origin');
});
