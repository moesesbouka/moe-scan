import test from 'node:test';
import assert from 'node:assert/strict';
import { S, B } from '../src/core/context.mjs';
import { isUPC, checkDigitOK, isValidProductCode, cleanOcrText, extractBestIdentifier, buildFBPayload, parseBulkInput, filterDashItems } from '../src/core/helpers.mjs';

test('isUPC accepts 8 to 14 digit codes', ()=>{
  assert.equal(isUPC('012345678905'), true);
  assert.equal(isUPC('1234567'), false);
});

test('checkDigitOK validates UPC-A checksum', ()=>{
  assert.equal(checkDigitOK('036000291452'), true);
  assert.equal(checkDigitOK('036000291453'), false);
});

test('isValidProductCode accepts UPC and EAN style identifiers', ()=>{
  assert.equal(isValidProductCode('036000291452'), true);
  assert.equal(isValidProductCode('4006381333931'), true);
  assert.equal(isValidProductCode('not-a-code'), false);
});

test('cleanOcrText removes punctuation and collapses whitespace', ()=>{
  assert.equal(cleanOcrText(`UPC:
O36O0O291452 `), 'UPC O36O0O291452');
});

test('extractBestIdentifier prefers valid product codes', ()=>{
  const out=extractBestIdentifier('model abc 036000291452 extra');
  assert.equal(out, '036000291452');
});

test('buildFBPayload uses current settings and photos', ()=>{
  S.settings.city='Buffalo, NY';
  S.settings.storeName='CrazyMoe';
  const payload=buildFBPayload({title:'Widget',price:'19.99',condition:'Used – Good',brand:'Acme',upc:'12345678'}, ['a.jpg','b.jpg']);
  assert.equal(payload.title, 'Widget');
  assert.equal(payload.price, '19.99');
  assert.equal(payload.photos.length, 2);
  assert.match(payload.description, /Buffalo/);
});

test('parseBulkInput splits text into identifiers', ()=>{
  assert.deepEqual(parseBulkInput(`12345
abc, xyz

987`), ['12345','abc','xyz','987']);
});

test('filterDashItems matches title and upc from shared dash search', ()=>{
  const items=[{title:'Sony Camera',upc:'111',description:'mirrorless'},{title:'Mixer',upc:'222',description:'kitchen aid'}];
  S.dashSearch='sony';
  assert.equal(filterDashItems(items).length,1);
  S.dashSearch='222';
  assert.equal(filterDashItems(items).length,1);
  S.dashSearch='';
});
