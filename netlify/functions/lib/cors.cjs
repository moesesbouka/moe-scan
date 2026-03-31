const ALLOWED_ORIGINS = [
  'https://crazymoe.netlify.app',
  'http://localhost:8888',
  'http://localhost:3000'
];

function getRequestOrigin(event = {}) {
  return event.headers?.origin || event.headers?.referer || '';
}

function getAllowedOrigin(origin = '') {
  return ALLOWED_ORIGINS.find(o => origin.startsWith(o)) || ALLOWED_ORIGINS[0];
}

function getCors(event = {}, overrides = {}) {
  const allowed = getAllowedOrigin(getRequestOrigin(event));
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
    ...overrides,
  };
}

module.exports = {
  ALLOWED_ORIGINS,
  getCors,
  getAllowedOrigin,
  getRequestOrigin,
};
