import test from 'node:test';
import assert from 'node:assert/strict';
import { peekLastItem } from '../src/features/resume.mjs';

// Note: resumeLastItem() calls window.loadDraft which is browser-only.
// We test the pure helper peekLastItem() here.

test('peekLastItem returns first savedItem when present', () => {
  const S = { savedItems: [{ title: 'Camera', price: '50' }], drafts: [] };
  assert.equal(peekLastItem(S).title, 'Camera');
});

test('peekLastItem falls back to drafts when no savedItems', () => {
  const S = { savedItems: [], drafts: [{ title: 'Draft Widget' }] };
  assert.equal(peekLastItem(S).title, 'Draft Widget');
});

test('peekLastItem returns null when both empty', () => {
  const S = { savedItems: [], drafts: [] };
  assert.equal(peekLastItem(S), null);
});

test('peekLastItem handles undefined arrays gracefully', () => {
  const S = {};
  assert.equal(peekLastItem(S), null);
});
