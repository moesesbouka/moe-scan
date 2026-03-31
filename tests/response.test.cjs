const test = require('node:test');
const assert = require('node:assert/strict');
const { jsonResponse, textResponse, methodNotAllowed, optionsResponse } = require('../netlify/functions/lib/response.cjs');

test('jsonResponse serializes payloads with status and headers', () => {
  const res = jsonResponse({ ok: true }, 201, { 'X-Test': '1' });
  assert.equal(res.statusCode, 201);
  assert.equal(res.body, '{"ok":true}');
  assert.equal(res.headers['X-Test'], '1');
});

test('methodNotAllowed returns 405 JSON error', () => {
  const res = methodNotAllowed({ A: 'B' });
  assert.equal(res.statusCode, 405);
  assert.match(res.body, /POST only/);
  assert.equal(res.headers.A, 'B');
});

test('optionsResponse returns empty 200 body', () => {
  const res = optionsResponse({ C: 'D' });
  assert.deepEqual(res, { statusCode: 200, headers: { C: 'D' }, body: '' });
  assert.deepEqual(textResponse('', 200, { C: 'D' }), res);
});
