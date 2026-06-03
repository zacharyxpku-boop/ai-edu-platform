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

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'content-type'
      }
    });
  }

  if (req.method === 'GET') {
    return json(200, {
      ok: true,
      schema_id: 'lobster_config_v1',
      capabilities: {
        child: lobster.listLobsterCapabilities('child'),
        parent: lobster.listLobsterCapabilities('parent'),
        shared: lobster.LOBSTER_CAPABILITY_CATALOG.shared
      },
      defaults: lobster.configureLobsterPair({})
    });
  }

  if (req.method !== 'POST') {
    return json(405, { ok: false, error: 'method_not_allowed' });
  }

  const body = await readBody(req);
  const configured = lobster.configureLobsterPair(body || {});
  return json(200, {
    ok: true,
    schema_id: 'lobster_config_v1',
    productId: configured.productId,
    child: configured.child,
    parent: configured.parent,
    capabilityDeck: configured.capabilityDeck,
    warnings: configured.warnings,
    sharedBoundaries: configured.sharedBoundaries,
    openSourceReferenceNotes: configured.openSourceReferenceNotes
  });
}
