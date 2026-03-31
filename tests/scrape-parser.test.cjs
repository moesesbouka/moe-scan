const test = require('node:test');
const assert = require('node:assert/strict');
const { extractProduct, cleanPriceRange, extractMeta } = require('../netlify/functions/lib/scrape-parser.cjs');

test('extractProduct prefers JSON-LD product fields and resolves relative image URLs', () => {
  const html = `
    <html><head>
      <script type="application/ld+json">{
        "@context":"https://schema.org",
        "@type":"Product",
        "name":"Acme Vacuum 3000",
        "brand":{"@type":"Brand","name":"Acme"},
        "model":"VAC-3000",
        "gtin13":"1234567890123",
        "image":["/img/product.jpg"],
        "offers":{"price":"149.99"}
      }</script>
      <meta property="og:description" content="Powerful vacuum cleaner">
    </head><body></body></html>
  `;
  const product = extractProduct(html, 'https://shop.example.com/item/1');
  assert.equal(product.title, 'Acme Vacuum 3000');
  assert.equal(product.brand, 'Acme');
  assert.equal(product.model, 'VAC-3000');
  assert.equal(product.upc, '1234567890123');
  assert.equal(product.price, '149.99');
  assert.equal(product.thumbnail, 'https://shop.example.com/img/product.jpg');
  assert.match(product.source, /shop\.example\.com/);
});

test('extractMeta safely handles colon-prefixed names', () => {
  const html = '<meta property="product:price:amount" content="88.50">';
  assert.equal(extractMeta(html, 'product:price:amount'), '88.50');
});

test('cleanPriceRange returns lowest number from a range', () => {
  assert.equal(cleanPriceRange('$49.99 - $79.99'), '49.99');
});
