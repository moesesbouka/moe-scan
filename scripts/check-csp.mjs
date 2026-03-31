import { readFileSync } from 'fs';

const toml = readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8');
const match = toml.match(/Content-Security-Policy = "([\s\S]*?)"/);
if (!match) {
  console.error('CSP missing from netlify.toml');
  process.exit(1);
}

const csp = match[1];
const connectSrc = csp.match(/connect-src ([^;]+)/)?.[1] || '';
const scriptSrc = csp.match(/script-src ([^;]+)/)?.[1] || '';
const requiredConnect = ['blob:', 'data:', 'https://cdn.jsdelivr.net', 'https://unpkg.com'];
const requiredScript = ["'unsafe-eval'", 'https://cdn.jsdelivr.net', 'https://unpkg.com'];

const missingConnect = requiredConnect.filter(v => !connectSrc.includes(v));
const missingScript = requiredScript.filter(v => !scriptSrc.includes(v));

if (missingConnect.length || missingScript.length) {
  if (missingConnect.length) console.error('CSP connect-src missing:', missingConnect.join(', '));
  if (missingScript.length) console.error('CSP script-src missing:', missingScript.join(', '));
  process.exit(1);
}

console.log('CSP OK');
