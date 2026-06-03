export function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*'
  };

  if (res && typeof res.setHeader === 'function') {
    Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(status).json(body);
    }
    if (typeof res.writeHead === 'function') {
      res.writeHead(status, headers);
      res.end(payload);
      return undefined;
    }
  }

  return new Response(payload, { status, headers });
}

export function sendOptions(res) {
  const headers = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type'
  };

  if (res && typeof res.setHeader === 'function') {
    Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
    if (typeof res.status === 'function' && typeof res.end === 'function') {
      return res.status(204).end();
    }
    if (typeof res.writeHead === 'function') {
      res.writeHead(204, headers);
      res.end();
      return undefined;
    }
  }

  return new Response(null, { status: 204, headers });
}

export async function readJsonBody(req) {
  if (req && typeof req.json === 'function') {
    try {
      return await req.json();
    } catch (_) {
      return {};
    }
  }

  if (req && req.body != null) {
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body);
      } catch (_) {
        return {};
      }
    }
    if (typeof req.body === 'object') return req.body;
  }

  if (!req || typeof req.on !== 'function') return {};

  const chunks = [];
  await new Promise((resolve) => {
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', resolve);
    req.on('error', resolve);
  });

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch (_) {
    return {};
  }
}

export function requestUrl(req, fallback = 'https://yuandianzhixue.com/') {
  const raw = req && req.url ? String(req.url) : fallback;
  try {
    return new URL(raw);
  } catch (_) {
    const host = req && req.headers && (req.headers.host || req.headers.Host)
      ? (req.headers.host || req.headers.Host)
      : 'yuandianzhixue.com';
    return new URL(raw, `https://${host}`);
  }
}
