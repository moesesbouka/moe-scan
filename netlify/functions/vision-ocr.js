const { getCors } = require('./lib/cors.cjs');
const { jsonResponse, methodNotAllowed, optionsResponse } = require('./lib/response.cjs');
const { isRateLimited, getClientIp } = require('./lib/rate-limit.cjs');

// CrazyMoe Scanner — vision-ocr.js
// Proxies image OCR to Anthropic API, keeping the API key server-side
exports.handler = async function(event) {
  const CORS = getCors(event);
  if (isRateLimited(getClientIp(event), 10)) return jsonResponse({ error: 'Rate limit exceeded' }, 429, CORS);
  if (event.httpMethod === 'OPTIONS') return optionsResponse(CORS);
  if (event.httpMethod !== 'POST') return methodNotAllowed(CORS);
  if ((event.body || '').length > 2_750_000) return jsonResponse({ error:'Request too large', query:'', raw:'' }, 413, CORS);

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return jsonResponse({ error:'Vision OCR not configured', query:'', raw:'' }, 503, CORS);

  try {
    const { image, mediaType='image/jpeg' } = JSON.parse(event.body || '{}');
    if (!image) return jsonResponse({ error:'No image provided', query:'', raw:'' }, 400, CORS);

    // Rough size check — reject obviously oversized payloads
    if (image.length > 2_000_000) return jsonResponse({ error:'Image too large', query:'', raw:'' }, 413, CORS);

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            { type: 'text', text: 'Look at this warehouse label/sticker photo. Find and return ONLY the numeric UPC/barcode number (the long number under the barcode stripes, usually 12-13 digits). If you see a product model number instead (like ABC-123), return that. Return ONLY the number/code, nothing else. If you cannot find any barcode or product code, return the word NONE.' }
          ]
        }]
      })
    });

    if (!resp.ok) return jsonResponse({ error:'Vision API error', query:'', raw:'' }, 502, CORS);
    const data = await resp.json();
    const text = (data.content?.[0]?.text || '').trim();

    if (!text || text.toUpperCase() === 'NONE') {
      return jsonResponse({ query: '', raw: '' }, 200, CORS);
    }

    // Extract the best identifier from Claude's response
    const digits = text.match(/\d{8,14}/g)?.sort((a,b)=>b.length-a.length)?.[0] || '';
    const model = text.match(/\b[A-Z0-9]{2,}(?:-[A-Z0-9]{2,})+\b/i)?.[0] || '';
    const query = digits || model || text.replace(/\s+/g,'').slice(0,30);

    return jsonResponse({ query, raw: text }, 200, CORS);
  } catch(e) {
    return jsonResponse({ error: e.message, query: '', raw: '' }, 500, CORS);
  }
};
