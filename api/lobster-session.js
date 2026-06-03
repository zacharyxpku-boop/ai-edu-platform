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

function stripRaw(value) {
  if (Array.isArray(value)) return value.map(stripRaw);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  Object.keys(value).forEach((key) => {
    if (key === 'raw') {
      out.raw = { included: false, availableForServerDebug: true };
      return;
    }
    out[key] = stripRaw(value[key]);
  });
  return out;
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
  const hasChild = body.childMessage && (body.childMessage.message || body.childMessage.text);
  const hasParent = body.parentMaterial && (body.parentMaterial.message || body.parentMaterial.text || body.parentMaterial.materialText);
  if (!hasChild && !hasParent) {
    return json(400, { ok: false, error: 'session_input_required' });
  }

  try {
    const session = await lobster.runLobsterFamilySession(body);
    return json(200, stripRaw(session));
  } catch (error) {
    return json(500, {
      ok: false,
      error: 'lobster_session_failed',
      message: error && error.message ? error.message : 'unknown_error'
    });
  }
}
