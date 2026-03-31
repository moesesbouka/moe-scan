function normTitle(value = '') {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function isLikelyElectronicsQuery(query = '') {
  return /^\d{8,14}$/.test(String(query || '')) ||
    /tv|monitor|keyboard|mouse|tablet|iphone|ipad|galaxy|speaker|headphone|roku|insignia|logitech|sony|samsung/i.test(String(query || ''));
}

function scoreItem(item, query, upcMode) {
  let score = Number(item.confidence || 0.3);
  const normalizedQuery = String(query).toLowerCase();
  const title = String(item.title || '').toLowerCase();
  const itemUpc = String(item.upc || '').replace(/-/g, '');
  const queryUpc = String(query || '').replace(/-/g, '');

  if (upcMode && itemUpc && itemUpc === queryUpc) score += 0.5;
  else if (upcMode && itemUpc && itemUpc !== queryUpc) score -= 0.25;
  if (title.includes(normalizedQuery)) score += 0.22;
  if (/decal|sticker|flag|vinyl|poster|banner/i.test(title) && isLikelyElectronicsQuery(normalizedQuery)) score -= 0.35;
  if (item.source && item.source.includes('upcitemdb')) score += 0.2;
  if (item.source && item.source.includes('barcodelookup')) score += 0.18;
  if (item.source && item.source.includes('bestbuy')) score += 0.16;
  if (item.source && item.source.includes('open')) score += 0.12;
  if (item.source && item.source.includes('ebay')) score += 0.08;
  if (item.thumbnail) score += 0.05;
  if (String(item.title || '').length < 18) score -= 0.04;

  return { ...item, confidence: Math.min(0.99, Math.max(0, score)) };
}

function rankAndDedupe(items, query, upcMode) {
  const seen = new Map();
  for (const item of items) {
    if (!item || !item.title) continue;
    const key = [item.upc || '', normTitle(item.title).slice(0, 80)].join('|');
    const scored = scoreItem(item, query, upcMode);
    const previous = seen.get(key);
    if (!previous || scored.confidence > previous.confidence) seen.set(key, scored);
  }
  return [...seen.values()].sort((a, b) => b.confidence - a.confidence);
}

module.exports = { normTitle, isLikelyElectronicsQuery, scoreItem, rankAndDedupe };
