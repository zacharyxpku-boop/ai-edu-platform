export const config = { runtime: 'edge' };

const REPLACEMENTS = {
  'tutor-chat': '/api/mini/tutor-message',
  'achievement-quote': '/api/mini/report',
  leaderboard: '/api/mini/review-today',
  achievements: '/api/mini/review-today',
  'shop/items': '/api/mini/report',
  'shop/purchase': '/api/mini/report',
  'mini/shop': '/api/mini/report',
  'mini/leaderboard': '/api/mini/review-today',
  'mini/achievements': '/api/mini/review-today'
};

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

export default async function handler(req) {
  const url = new URL(req.url || 'https://yuandianzhixue.com/api/retired');
  const endpoint = String(url.searchParams.get('endpoint') || '')
    .replace(/^\/?api\//, '')
    .replace(/^\/+/, '');

  return json(410, {
    ok: false,
    error: 'legacy_endpoint_retired',
    inventory_status: 'retired_by_default',
    inventory_decision: 'retire_do_not_expose',
    endpoint: endpoint || 'legacy',
    replacement_endpoint: REPLACEMENTS[endpoint] || '/api/mini/tutor-message'
  });
}
