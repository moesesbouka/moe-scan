import { isUPC, applyDisc } from './helpers.mjs';

/**
 * Build the item.suggested shape from a ranked lookup result.
 * Pure function — no DOM, no localStorage, no mutation.
 */
export function shapeMatchResult(result, query) {
  const b = result || {};
  const q = String(query || '').trim();
  return {
    title: b.title || q,
    price: applyDisc(b.price || ''),
    condition: 'Used – Good',
    description: b.description || '',
    source: b.source || 'lookup',
    brand: b.brand || '',
    model: b.model || '',
    upc: b.upc || (isUPC(q) ? q : ''),
    thumbnail: b.thumbnail || '',
    chips: b.chips || [],
    sourceUrl: b.sourceUrl || ''
  };
}

/**
 * Normalize field names from Supabase row shape (product_brand, source_url, etc.)
 * to local draft shape. Pure — returns new object.
 */
export function normalizeDraftFields(src) {
  if (!src) return null;
  return {
    title: src.title || '',
    price: src.price ? String(src.price) : '',
    condition: src.condition || 'Used – Good',
    description: src.description || '',
    source: src.source || '',
    brand: src.product_brand || src.brand || '',
    model: src.product_model || src.model || '',
    upc: src.upc || src.identify_value || '',
    thumbnail: src.thumbnail || '',
    chips: src.chips || [],
    sourceUrl: src.source_url || src.sourceUrl || ''
  };
}

/** Shape an offline queue item from item data + photos. Pure. */
export function shapeOfflineItem(data, photos) {
  return {
    data: { ...data },
    photos: [...(photos || [])],
    savedAt: new Date().toISOString()
  };
}
