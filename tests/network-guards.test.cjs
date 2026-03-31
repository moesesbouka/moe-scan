const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeUrl, validatePublicHttpUrl, isHtmlContentType } = require('../netlify/functions/lib/network-guards.cjs');

test('normalizeUrl adds https to bare hostnames', () => {
  const url = normalizeUrl('example.com/widget');
  assert.equal(url.toString(), 'https://example.com/widget');
});

test('validatePublicHttpUrl blocks private and localhost addresses', () => {
  for (const raw of ['http://127.0.0.1/test', 'http://192.168.1.5', 'http://printer.local', 'ftp://example.com']) {
    const result = validatePublicHttpUrl(raw);
    assert.equal(result.ok, false, raw);
  }
});

test('validatePublicHttpUrl allows public https URLs', () => {
  const result = validatePublicHttpUrl('shop.example.com/item');
  assert.equal(result.ok, true);
  assert.equal(result.url.toString(), 'https://shop.example.com/item');
});

test('isHtmlContentType accepts html and xhtml but rejects json', () => {
  assert.equal(isHtmlContentType('text/html; charset=utf-8'), true);
  assert.equal(isHtmlContentType('application/xhtml+xml'), true);
  assert.equal(isHtmlContentType('application/json'), false);
});
