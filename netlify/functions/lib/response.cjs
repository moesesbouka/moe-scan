function jsonResponse(payload, statusCode = 200, headers = {}) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(payload),
  };
}

function textResponse(body = '', statusCode = 200, headers = {}) {
  return {
    statusCode,
    headers,
    body,
  };
}

function methodNotAllowed(headers = {}, message = 'POST only') {
  return jsonResponse({ error: message }, 405, headers);
}

function optionsResponse(headers = {}) {
  return textResponse('', 200, headers);
}

module.exports = {
  jsonResponse,
  textResponse,
  methodNotAllowed,
  optionsResponse,
};
