import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const followup = require('../src/lobster/lobster-followup.cjs');

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

function publicScan(scan, meta = {}) {
  return Object.assign({}, scan, {
    cron: {
      callable: true,
      source: meta.source || 'api',
      dispatchSideEffects: false,
      note: 'This endpoint scans due follow-ups only. Delivery adapters should record dispatch results separately.'
    }
  });
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
    const url = new URL(req.url);
    const scan = followup.scanDueFollowUps({
      now: url.searchParams.get('now') || undefined
    });
    return json(200, publicScan(scan, { source: 'api_get' }));
  }

  if (req.method !== 'POST') {
    return json(405, { ok: false, error: 'method_not_allowed' });
  }

  const body = await readBody(req);
  const scan = followup.scanDueFollowUps({
    now: body.now || undefined
  });
  return json(200, publicScan(scan, { source: 'api_post' }));
}
