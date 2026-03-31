function extractProduct(html, url) {
  const result = {
    title: '',
    price: '',
    thumbnail: '',
    description: '',
    brand: '',
    model: '',
    upc: '',
    url,
    source: 'url-scrape',
    chips: [],
    confidence: 0.7
  };

  const jsonLdMatches = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const m of jsonLdMatches) {
    try {
      const data = JSON.parse(m[1]);
      const products = [];
      collectProducts(data, products);
      if (products.length) {
        const p = products[0];
        if (p.name) result.title = cleanText(p.name);
        if (p.description) result.description = cleanText(p.description).slice(0, 400);
        if (p.brand?.name) result.brand = cleanText(p.brand.name);
        else if (typeof p.brand === 'string') result.brand = cleanText(p.brand);
        if (p.model) result.model = cleanText(p.model);
        if (p.mpn) result.model = result.model || cleanText(p.mpn);
        for (const k of ['gtin13', 'gtin12', 'gtin8', 'gtin', 'isbn']) {
          if (p[k]) {
            result.upc = String(p[k]).trim();
            break;
          }
        }
        const offer = Array.isArray(p.offers) ? p.offers[0] : p.offers;
        if (offer?.price) result.price = cleanPriceValue(offer.price);
        else if (offer?.lowPrice) result.price = cleanPriceValue(offer.lowPrice);
        if (Array.isArray(p.image)) result.thumbnail = String(p.image[0]);
        else if (typeof p.image === 'string') result.thumbnail = p.image;
        else if (p.image?.url) result.thumbnail = p.image.url;
        result.confidence = 0.88;
        break;
      }
    } catch (_) {}
  }

  const og = extractOG(html);
  if (!result.title && og['og:title']) result.title = og['og:title'];
  if (!result.description && og['og:description']) result.description = og['og:description'].slice(0, 400);
  if (!result.thumbnail && og['og:image']) result.thumbnail = og['og:image'];
  if (!result.price && og['product:price:amount']) result.price = cleanPriceValue(og['product:price:amount']);
  if (!result.price && og['og:price:amount']) result.price = cleanPriceValue(og['og:price:amount']);
  if (!result.price) {
    const retailerPrice =
      extractItemProp(html, 'price') ||
      extractMeta(html, 'price') ||
      extractMeta(html, 'twitter:data1') ||
      extractMeta(html, 'og:price:standard_amount') ||
      extractMeta(html, 'product:price:amount') ||
      extractMeta(html, 'twitter:data1') ||
      extractMeta(html, 'sale_price') ||
      extractMeta(html, 'product:price:current_price') ||
      extractMeta(html, 'product:price:price');
    if (retailerPrice) result.price = cleanPriceValue(retailerPrice);
  }

  if (!result.title) {
    const tc = extractMeta(html, 'twitter:title') || extractMeta(html, 'twitter:text:title');
    if (tc) result.title = tc;
  }
  if (!result.thumbnail) {
    const ti = extractMeta(html, 'twitter:image') || extractMeta(html, 'twitter:image:src');
    if (ti) result.thumbnail = ti;
  }
  if (!result.brand) result.brand = extractItemProp(html, 'brand') || extractMeta(html, 'brand') || extractMeta(html, 'product:brand') || extractMeta(html, 'twitter:label1') || '';
  if (!result.model) result.model = extractItemProp(html, 'mpn') || extractItemProp(html, 'model') || extractMeta(html, 'model') || extractMeta(html, 'product:model') || '';
  if (!result.upc) result.upc = extractItemProp(html, 'gtin13') || extractItemProp(html, 'gtin12') || extractItemProp(html, 'gtin') || extractItemProp(html, 'sku') || extractMeta(html, 'product:retailer_item_id') || '';

  if (!result.title) {
    const h1 = (html.match(/<h1[^>]*>([^<]{3,200})<\/h1>/i) || [])[1];
    const titleTag = (html.match(/<title[^>]*>([^<]{3,200})<\/title>/i) || [])[1];
    result.title = cleanText(h1 || titleTag || '');
  }
  if (!result.description) {
    const metaDesc = extractMeta(html, 'description');
    if (metaDesc) result.description = metaDesc.slice(0, 400);
  }

  if (result.thumbnail && !result.thumbnail.startsWith('http')) {
    try {
      const base = new URL(url);
      result.thumbnail = new URL(result.thumbnail, base).toString();
    } catch (_) {}
  }

  const hostname = (() => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch (_) {
      return '';
    }
  })();
  result.chips = [
    result.brand && `Brand: ${result.brand}`,
    result.model && `Model: ${result.model}`,
    result.upc && `UPC: ${result.upc}`,
    result.price && `Price: $${result.price}`,
    hostname && `Source: ${hostname}`
  ].filter(Boolean);
  result.source = hostname ? `url-scrape (${hostname})` : 'url-scrape';

  return result;
}

function collectProducts(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach(n => collectProducts(n, out));
    return;
  }
  const t = node['@type'];
  if (t === 'Product' || t === 'IndividualProduct' || (Array.isArray(t) && t.includes('Product'))) {
    out.push(node);
  }
  for (const val of Object.values(node)) {
    if (typeof val === 'object') collectProducts(val, out);
  }
}

function extractOG(html) {
  const result = {};
  const matches = html.matchAll(/<meta[^>]+(?:property|name)=["']([^"']+)["'][^>]+content=["']([^"']*?)["'][^>]*>/gi);
  for (const m of matches) result[m[1].toLowerCase()] = cleanText(m[2]);
  const matches2 = html.matchAll(/<meta[^>]+content=["']([^"']*?)["'][^>]+(?:property|name)=["']([^"']+)["'][^>]*>/gi);
  for (const m of matches2) {
    const k = m[2].toLowerCase();
    if (!result[k]) result[k] = cleanText(m[1]);
  }
  return result;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractMeta(html, name) {
  const safeName = escapeRegex(name);
  const r = html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${safeName}["'][^>]+content=["']([^"']+)["']`, 'i')) ||
    html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${safeName}["']`, 'i'));
  return r ? cleanText(r[1]) : '';
}

function cleanText(s = '') {
  return String(s)
    .replace(/\s+/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&quot;/g, '"')
    .trim();
}

function cleanPriceRange(v = '') {
  const nums = String(v || '').match(/\$?\d+[\d,.]*/g);
  if (!nums || !nums.length) return String(v || '').trim();
  const vals = nums.map(x => parseFloat(x.replace(/[^\d.]/g, ''))).filter(n => isFinite(n));
  if (!vals.length) return String(v || '').trim();
  return String(Math.min(...vals).toFixed(2));
}

function extractItemProp(html, prop) {
  const safeProp = escapeRegex(prop);
  const patterns = [
    new RegExp(`<[^>]+itemprop=["']${safeProp}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<[^>]+content=["']([^"']+)["'][^>]+itemprop=["']${safeProp}["']`, 'i'),
    new RegExp(`<[^>]+itemprop=["']${safeProp}["'][^>]*>([^<]{1,200})<`, 'i')
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return cleanText(m[1]);
  }
  return '';
}

function cleanPriceValue(v) {
  if (!v) return '';
  const s = String(v).replace(/,/g, ' ').trim();
  const nums = [...s.matchAll(/([0-9]+(?:\.[0-9]{1,2})?)/g)].map(m => parseFloat(m[1])).filter(n => isFinite(n));
  return nums.length ? String(Math.min(...nums)) : s;
}

module.exports = {
  extractProduct,
  collectProducts,
  extractOG,
  extractMeta,
  cleanText,
  cleanPriceRange,
  extractItemProp,
  cleanPriceValue,
};
