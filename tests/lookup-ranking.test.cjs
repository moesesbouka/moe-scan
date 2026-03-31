const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreItem, rankAndDedupe } = require('../netlify/functions/lib/lookup-ranking.cjs');

test('scoreItem rewards exact UPC matches', () => {
  const exact = scoreItem({ title: 'Sony Headphones', upc: '12345678', source: 'upcitemdb' }, '12345678', true);
  const mismatch = scoreItem({ title: 'Sony Headphones', upc: '00000000', source: 'upcitemdb' }, '12345678', true);
  assert.ok(exact.confidence > mismatch.confidence);
});

test('rankAndDedupe keeps highest-confidence duplicate', () => {
  const ranked = rankAndDedupe([
    { title: 'Sony WH-1000XM5 Headphones', upc: '123', source: 'ebay', confidence: 0.2 },
    { title: 'Sony WH-1000XM5 Headphones', upc: '123', source: 'upcitemdb', confidence: 0.2 },
  ], 'sony', false);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].source, 'upcitemdb');
});
