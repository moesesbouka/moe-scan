const { getCors } = require('./lib/cors.cjs');
const { extractProduct } = require('./lib/scrape-parser.cjs');
const { jsonResponse, methodNotAllowed, optionsResponse } = require('./lib/response.cjs');
const { validatePublicHttpUrl, isHtmlContentType } = require('./lib/network-guards.cjs');
const { isRateLimited, getClientIp } = require('./lib/rate-limit.cjs');

// CrazyMoe Scanner – product URL scraper
// Extracts product data from any URL via JSON-LD, Open Graph, and HTML fallbacks

exports.handler = async function (event) {
  const CORS=getCors(event);
  if (isRateLimited(getClientIp(event), 20)) return jsonResponse({ error: 'Rate limit exceeded' }, 429, CORS);
  if (event.httpMethod === 'OPTIONS') return optionsResponse(CORS);
  if (event.httpMethod !== 'POST') return methodNotAllowed(CORS);
  if ((event.body||'').length > 64_000) return jsonResponse({ error: 'Request too large' }, 413, CORS);

  try {
    const body = JSON.parse(event.body || '{}');
    const rawUrl = String(body.url || '').trim();
    if (!rawUrl) return jsonResponse({ error: 'URL is required' }, 400, CORS);

    const validation = validatePublicHttpUrl(rawUrl);
    if (!validation.ok) return jsonResponse({ error: validation.error }, 400, CORS);

    const html = await fetchPage(validation.url.toString());
    if (!html) return jsonResponse({ error: 'Could not fetch that page. It may block bots or require login.' }, 422, CORS);

    const product = extractProduct(html, validation.url.toString());
    return jsonResponse({ product, url: validation.url.toString() }, 200, CORS);
  } catch (e) {
    return jsonResponse({ error: e.message || 'Scrape failed' }, 500, CORS);
  }
};

async function fetchPage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache'
      }
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!isHtmlContentType(ct)) return null;
    return await res.text();
  } catch (_) {
    clearTimeout(timer);
    return null;
  }
}

