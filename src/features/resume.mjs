/**
 * Resume-last-item module.
 * Provides one-tap restoration of the most recently saved or drafted item.
 */

/**
 * Load the most recent saved item or draft into the scanner flow.
 * Calls window.loadDraft which is defined in index.html.
 */
export function resumeLastItem(S, setStatus) {
  const last = S.savedItems?.[0] || S.drafts?.[0];
  if (!last) { setStatus('stSave', 'No previous item to resume', 'warn'); return false; }
  if (typeof window.loadDraft === 'function') {
    window.loadDraft({ ...last });
    setStatus('stSave', '✓ Resumed last item', 'ok');
    navigator.vibrate?.([30, 20, 30]);
    return true;
  }
  return false;
}

/** Peek at what the resume button would restore without applying it. */
export function peekLastItem(S) {
  return S.savedItems?.[0] || S.drafts?.[0] || null;
}
