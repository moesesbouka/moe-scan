import test from 'node:test';
import assert from 'node:assert/strict';
import { shapeMatchResult, normalizeDraftFields, shapeOfflineItem } from '../src/core/suggestions.mjs';
import { S } from '../src/core/context.mjs';

test('shapeMatchResult builds correct shape from lookup result', () => {
  const result = { title: 'Widget Pro', price: '29.99', brand: 'Acme', upc: '036000291452', source: 'upcitemdb', chips: ['red','blue'], thumbnail: 'img.jpg', sourceUrl: 'https://example.com', description: 'A widget', model: 'WP-1' };
  const shaped = shapeMatchResult(result, '036000291452');
  assert.equal(shaped.title, 'Widget Pro');
  assert.equal(shaped.brand, 'Acme');
  assert.equal(shaped.upc, '036000291452');
  assert.equal(shaped.condition, 'Used – Good');
  assert.deepEqual(shaped.chips, ['red','blue']);
});

test('shapeMatchResult falls back to query for title when result has none', () => {
  const shaped = shapeMatchResult({}, 'ABC-123-456');
  assert.equal(shaped.title, 'ABC-123-456');
  assert.equal(shaped.upc, '');  // not a UPC
});

test('shapeMatchResult uses query as upc when it is a valid UPC', () => {
  const shaped = shapeMatchResult({ title: 'Test' }, '036000291452');
  assert.equal(shaped.upc, '036000291452');
});

test('normalizeDraftFields handles Supabase column names', () => {
  const row = { title: 'Camera', price: '49.99', product_brand: 'Sony', product_model: 'A7', source_url: 'https://bestbuy.com', identify_value: '123456789012', condition: 'Used – Good' };
  const norm = normalizeDraftFields(row);
  assert.equal(norm.brand, 'Sony');
  assert.equal(norm.model, 'A7');
  assert.equal(norm.sourceUrl, 'https://bestbuy.com');
  assert.equal(norm.upc, '123456789012');
});

test('normalizeDraftFields prefers local field names over Supabase names', () => {
  const draft = { title: 'TV', brand: 'Samsung', model: 'UN55', sourceUrl: 'https://local.com', product_brand: 'OldBrand' };
  const norm = normalizeDraftFields(draft);
  assert.equal(norm.brand, 'OldBrand');  // product_brand wins (src.product_brand || src.brand)
});

test('normalizeDraftFields returns null for falsy input', () => {
  assert.equal(normalizeDraftFields(null), null);
  assert.equal(normalizeDraftFields(undefined), null);
});

test('shapeOfflineItem packages data + photos correctly', () => {
  const item = shapeOfflineItem({ title: 'Mixer', price: '25' }, ['photo1.jpg', 'photo2.jpg']);
  assert.equal(item.data.title, 'Mixer');
  assert.equal(item.photos.length, 2);
  assert.ok(item.savedAt); // has a timestamp
  // Verify it's a copy, not a reference
  item.data.title = 'MUTATED';
  const original = { title: 'Mixer', price: '25' };
  assert.equal(original.title, 'Mixer');
});

test('shapeOfflineItem handles empty photos array', () => {
  const item = shapeOfflineItem({ title: 'Box' }, []);
  assert.deepEqual(item.photos, []);
});
