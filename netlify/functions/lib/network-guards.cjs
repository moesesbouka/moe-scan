const PRIVATE_IPV4_PATTERNS = [
  /^10\./,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
];

function normalizeUrl(rawUrl = '') {
  const value = String(rawUrl || '').trim();
  if (!value) return null;
  try {
    const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
    return new URL(hasScheme ? value : `https://${value}`);
  } catch (_) {
    return null;
  }
}

function isPrivateHostname(hostname = '') {
  const host = String(hostname || '').trim().toLowerCase().replace(/\.$/, '');
  if (!host) return true;
  if (host === 'localhost' || host === '::1') return true;
  if (host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (/^\[(.*)\]$/.test(host)) return isPrivateIp(host.slice(1, -1));
  return isPrivateIp(host);
}

function isPrivateIp(value = '') {
  const host = String(value || '').trim().toLowerCase();
  if (!host) return true;
  if (PRIVATE_IPV4_PATTERNS.some(rx => rx.test(host))) return true;
  if (/^fd[0-9a-f]{2}:/i.test(host) || /^fc[0-9a-f]{2}:/i.test(host)) return true;
  if (/^fe80:/i.test(host)) return true;
  return false;
}

function validatePublicHttpUrl(rawUrl = '') {
  const url = rawUrl instanceof URL ? rawUrl : normalizeUrl(rawUrl);
  if (!url) return { ok: false, error: 'Invalid URL' };
  if (!['http:', 'https:'].includes(url.protocol)) {
    return { ok: false, error: 'Only http/https URLs are allowed' };
  }
  if (isPrivateHostname(url.hostname)) {
    return { ok: false, error: 'Private/internal URLs are not allowed' };
  }
  return { ok: true, url };
}

function isHtmlContentType(contentType = '') {
  return /text\/html|application\/xhtml\+xml/i.test(String(contentType || ''));
}

module.exports = {
  normalizeUrl,
  isPrivateIp,
  isPrivateHostname,
  validatePublicHttpUrl,
  isHtmlContentType,
};
