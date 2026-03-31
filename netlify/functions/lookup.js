const { rankAndDedupe } = require('./lib/lookup-ranking.cjs');
const { getCors } = require('./lib/cors.cjs');
const { jsonResponse, methodNotAllowed, optionsResponse } = require('./lib/response.cjs');
const { isRateLimited, getClientIp } = require('./lib/rate-limit.cjs');

// CrazyMoe Scanner – server-side product lookup
// Sources: UPCitemDB, Open*Facts family, eBay RSS, Google HTML, optional BarcodeLookup API

exports.handler = async function (event) {
  const CORS = getCors(event);

  if (isRateLimited(getClientIp(event), 30)) {
    return jsonResponse({ error: 'Rate limit exceeded' }, 429, CORS);
  }

  if (event.httpMethod === 'OPTIONS') return optionsResponse(CORS);
  if (event.httpMethod !== 'POST') return methodNotAllowed(CORS);
  if ((event.body || '').length > 64_000) {
    return jsonResponse({ error: 'Request too large' }, 413, CORS);
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const query = String(body.query || '').trim();
    if (!query) {
      return jsonResponse({ results: [], message: 'Empty query', checked: [] }, 200, CORS);
    }

    const checked = [];
    const isUPC = /^\d{8,14}$/.test(query);
    const all = [];

    if (isUPC) {
      // Exact UPC lookups only.
      const exactResults = await Promise.allSettled([
        upcItemDbLookup(query, checked),
        barcodeLookupApi(query, checked),
        bestBuySearch(query, checked),
        openFactsLookup(query, 'food', checked),
        openFactsLookup(query, 'product', checked),
        openFactsLookup(query, 'beauty', checked),
        openFactsLookup(query, 'petfood', checked),
      ]);

      exactResults.forEach((r) => {
        if (r.status === 'fulfilled' && r.value) all.push(...r.value);
      });

      const queryUpc = String(query).replace(/-/g, '');
      const exactOnly = all.filter((item) => {
        const itemUpc = String(item.upc || '').replace(/-/g, '');
        return itemUpc && itemUpc === queryUpc;
      });

      const rankedExact = rankAndDedupe(exactOnly, query, true).slice(0, 8);
      if (rankedExact.length) {
        return jsonResponse({
          checked: [...new Set(checked)],
          results: rankedExact,
          message: `Found ${rankedExact.length} match${rankedExact.length === 1 ? '' : 'es'}`
        }, 200, CORS);
      }

            return jsonResponse({
        checked: [...new Set(checked)],
        results: [],
        message: 'No exact UPC match found'
      }, 200, CORS);
    }

    // Non-UPC search path
    const searchResults = await Promise.allSettled([
      upcItemDbSearch(query, checked),
      ebayRssSearch(query, checked),
      googleHtmlSearch(query, checked),
    ]);

    searchResults.forEach((r) => {
      if (r.status === 'fulfilled' && r.value) all.push(...r.value);
    });

    const ranked = rankAndDedupe(all, query, false).slice(0, 8);

    return jsonResponse({
      checked: [...new Set(checked)],
      results: ranked,
      message: ranked.length ? `Found ${ranked.length} match${ranked.length === 1 ? '' : 'es'}` : 'No matches found'
    }, 200, CORS);
  } catch (e) {
    return jsonResponse({ results: [], checked: [], message: e.message || 'Lookup error' }, 500, CORS);
  }
};

async function safeFetch(url, init = {}, timeoutMs = 8000) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CrazyMoeScanner/2.0)',
          ...(init.headers || {})
        }
      });
      clearTimeout(timer);
      if (res.ok) return res;
    } catch (_) {
      clearTimeout(timer);
    }

    if (attempt === 0) {
      await new Promise(r => setTimeout(r, 600));
    }
  }

  return null;
}

function makeItem(source, data = {}) {
  return {
    source,
    title: data.title || '',
    brand: data.brand || '',
    model: data.model || '',
    upc: data.upc || '',
    price: data.price || '',
    thumbnail: data.thumbnail || '',
    description: data.description || '',
    chips: (data.chips || []).filter(Boolean),
    url: data.url || '',
    confidence: data.confidence || 0.3
  };
}

async function upcItemDbLookup(upc, checked) {
  checked.push('upcitemdb');
  const res = await safeFetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(upc)}`);
  if (!res) return [];

  const data = await res.json().catch(() => ({}));

  return (data.items || []).map(item => makeItem('upcitemdb', {
    title: item.title || item.product_name || '',
    brand: item.brand || '',
    model: item.model || '',
    upc,
    price: item.lowest_recorded_price || '',
    thumbnail: item.images?.[0] || '',
    description: item.description || '',
    chips: [
      item.brand && `Brand: ${item.brand}`,
      item.model && `Model: ${item.model}`,
      `UPC: ${upc}`
    ],
    url: item.offers?.[0]?.link || ''
  }));
}

async function upcItemDbSearch(query, checked) {
  checked.push('upcitemdb-search');
  const res = await safeFetch(`https://api.upcitemdb.com/prod/trial/search?s=${encodeURIComponent(query)}&type=product`);
  if (!res) return [];

  const data = await res.json().catch(() => ({}));

  return (data.items || []).map(item => makeItem('upcitemdb-search', {
    title: item.title || item.product_name || '',
    brand: item.brand || '',
    model: item.model || '',
    upc: item.upc || '',
    price: item.lowest_recorded_price || '',
    thumbnail: item.images?.[0] || '',
    description: item.description || '',
    chips: [
      item.brand && `Brand: ${item.brand}`,
      item.model && `Model: ${item.model}`,
      item.upc && `UPC: ${item.upc}`
    ],
    url: item.offers?.[0]?.link || ''
  }));
}

async function barcodeLookupApi(upc, checked) {
  const key = process.env.BARCODE_LOOKUP_KEY;
  if (!key) return [];

  checked.push('barcodelookup');
  const res = await safeFetch(`https://api.barcodelookup.com/v3/products?barcode=${encodeURIComponent(upc)}&formatted=y&key=${key}`);
  if (!res) return [];

  const data = await res.json().catch(() => ({}));

  return (data.products || []).map(p => makeItem('barcodelookup', {
    title: p.title || p.product_name || '',
    brand: p.brand || '',
    model: p.model || '',
    upc: p.barcode_number || upc,
    price: p.stores?.[0]?.price || '',
    thumbnail: p.images?.[0] || '',
    description: p.description || '',
    chips: [
      p.brand && `Brand: ${p.brand}`,
      p.model && `Model: ${p.model}`,
      p.category && `Category: ${p.category}`,
      `UPC: ${upc}`
    ],
    url: p.stores?.[0]?.store_url || '',
    confidence: 0.75
  }));
}

async function openFactsLookup(code, kind, checked) {
  const map = {
    food: { host: 'https://world.openfoodfacts.org', tag: 'openfoodfacts' },
    product: { host: 'https://world.openproductsfacts.org', tag: 'openproductsfacts' },
    beauty: { host: 'https://world.openbeautyfacts.org', tag: 'openbeautyfacts' },
    petfood: { host: 'https://world.openpetfoodfacts.org', tag: 'openpetfoodfacts' }
  };

  const info = map[kind];
  if (!info) return [];

  checked.push(info.tag);
  const res = await safeFetch(`${info.host}/api/v2/product/${encodeURIComponent(code)}.json`);
  if (!res) return [];

  const data = await res.json().catch(() => ({}));
  if (data.status !== 1 || !data.product) return [];

  const p = data.product;
  const title = p.product_name || p.abbreviated_product_name || p.generic_name || '';
  if (!title) return [];

  return [makeItem(info.tag, {
    title,
    brand: p.brands || '',
    upc: code,
    thumbnail: p.image_front_small_url || p.image_front_url || '',
    description: [p.quantity, p.categories, p.generic_name].filter(Boolean).join(' • '),
    chips: [
      p.brands && `Brand: ${p.brands}`,
      `UPC: ${code}`,
      p.quantity && p.quantity
    ],
    url: `${info.host}/product/${encodeURIComponent(code)}`
  })];
}

async function bestBuySearch(upc, checked) {
  checked.push('bestbuy');

  const res = await safeFetch(
    `https://www.bestbuy.com/site/searchpage.jsp?st=${encodeURIComponent(upc)}&format=json`,
    { headers: { Accept: 'application/json, text/html', 'User-Agent': 'Mozilla/5.0 (compatible; CrazyMoeScanner/2.0)' } }
  );
  if (!res) return [];

  const text = await res.text();
  const titleMatch = text.match(/"name"\s*:\s*"([^"]{10,200})"/);
  const priceMatch = text.match(/"currentPrice"\s*:\s*([\d.]+)/);
  const thumbMatch = text.match(/"image"\s*:\s*"(https?:[^"]+)"/);
  const brandMatch = text.match(/"brand"\s*:\s*"([^"]{2,50})"/);
  const modelMatch = text.match(/"modelNumber"\s*:\s*"([^"]{2,30})"/);

  if (!titleMatch) return [];

  return [makeItem('bestbuy', {
    title: titleMatch[1].replace(/\\u[\da-f]{4}/gi, c => String.fromCharCode(parseInt(c.slice(2), 16))),
    price: priceMatch ? priceMatch[1] : '',
    thumbnail: thumbMatch ? thumbMatch[1] : '',
    brand: brandMatch ? brandMatch[1] : '',
    model: modelMatch ? modelMatch[1] : '',
    upc,
    confidence: 0.65
  })];
}

async function ebayRssSearch(query, checked) {
  checked.push('ebay-rss');

  const queries = [
    query,
    query.replace(/[-_]/g, ' ').trim(),
  ].filter((v, i, a) => a.indexOf(v) === i);

  for (const q of queries) {
    const res = await safeFetch(`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}&_rss=1&_ipg=6`);
    if (!res) continue;

    const xml = await res.text();
    const blocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 6).map(m => m[1]);
    if (!blocks.length) continue;

    return blocks.map(block => {
      const title = extractTag(block, 'title');
      const link = extractTag(block, 'link');
      const desc = extractTag(block, 'description');
      const thumb = (desc.match(/<img[^>]+src="([^"]+)"/i) || [])[1] || '';
      const priceMatch = title.match(/\$([0-9,.]+)/);
      const price = priceMatch ? priceMatch[1].replace(/,/g, '') : '';
      const cleanTitle = title.replace(/\s*\$[0-9,.]+.*$/, '').trim();

      return makeItem('ebay-rss', {
        title: cleanTitle,
        price,
        thumbnail: thumb,
        description: stripHtml(desc).slice(0, 200),
        chips: [price && `$${price}`],
        url: link
      });
    }).filter(x => x.title);
  }

  return [];
}

async function googleHtmlSearch(query, checked) {
  checked.push('google-html');

  const res = await safeFetch(`https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en&num=5`, {
    headers: {
      Accept: 'text/html',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36'
    }
  });

  if (!res) return [];
  const html = await res.text();

  const matches = [...html.matchAll(/<a href="\/url\?q=([^"&]+)[^"]*".*?<h3[^>]*>([\s\S]*?)<\/h3>/gi)].slice(0, 5);

  return matches.map(m => {
    const url = decodeURIComponent(m[1]);
    const title = stripHtml(m[2]);
    return makeItem('google-html', {
      title,
      url,
      confidence: 0.34
    });
  }).filter(x => x.title);
}

function extractTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? stripHtml(m[1]) : '';
}

function stripHtml(input = '') {
  return String(input)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}
