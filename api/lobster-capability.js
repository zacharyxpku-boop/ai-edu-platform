import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const lobster = require('../src/lobster/lobster-core.cjs');

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*'
    }
  });
}

async function readBody(req) {
  try {
    return await req.json();
  } catch (_) {
    return {};
  }
}

function publicPayload(result) {
  if (!result || typeof result !== 'object') return { ok: false, error: 'empty_capability_result' };
  const next = Object.assign({}, result);
  if (next.raw) {
    next.raw = {
      included: false,
      availableForServerDebug: true
    };
  }
  return next;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type'
      }
    });
  }

  if (req.method !== 'POST') {
    return json(405, { ok: false, error: 'method_not_allowed' });
  }

  const body = await readBody(req);
  const capabilityId = body.capabilityId || body.capability || '';
  if (!String(capabilityId || '').trim()) {
    return json(400, { ok: false, error: 'capability_required' });
  }
  const result = lobster.runLobsterCapability(body);
  const status = result && result.ok === false ? 400 : 200;
  return json(status, publicPayload(result));
}
