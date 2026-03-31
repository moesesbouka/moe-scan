/**
 * Voice dictation module — button-triggered only, never ambient.
 * Drop-in companion to the voice dictation button already in index.html.
 */
let _voiceRec = null;

export function startVoiceDictation(fieldId, stId, onResult) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    if (stId && window.setStatus) window.setStatus(stId, 'Voice not supported on this browser', 'warn');
    return;
  }
  // Toggle: calling again while active stops the session
  if (_voiceRec) { _voiceRec.stop(); _voiceRec = null; return; }

  _voiceRec = new SR();
  _voiceRec.lang = 'en-US'; _voiceRec.interimResults = false; _voiceRec.maxAlternatives = 1;

  _voiceRec.onresult = e => {
    const txt = e.results[0][0].transcript;
    const field = document.getElementById(fieldId);
    if (field) {
      field.value = (field.value ? field.value + ' ' : '') + txt;
      field.dispatchEvent(new Event('input'));
    }
    if (stId && window.setStatus) window.setStatus(stId, `🎤 "${txt.slice(0,40)}${txt.length>40?'…':''}"`, 'ok');
    if (onResult) onResult(txt);
    navigator.vibrate?.([20]);
    _voiceRec = null;
  };
  _voiceRec.onerror = e => {
    if (stId && window.setStatus) window.setStatus(stId, 'Voice error: ' + e.error, 'warn');
    _voiceRec = null;
  };
  _voiceRec.onend = () => { _voiceRec = null; };
  _voiceRec.start();
  if (stId && window.setStatus) window.setStatus(stId, '🎤 Listening… speak the title or description', 'ok');
}

/** Returns true if a dictation session is currently active */
export function isVoiceActive() { return _voiceRec !== null; }
