import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const onboarding = require('../src/lobster/lobster-onboarding.cjs');

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
    return json(200, onboarding.buildActivationPackage({
      familyName: '试用家庭',
      childAlias: '孩子',
      gradeBand: '小学高年级',
      subjects: ['数学', '语文'],
      parentGoal: '今晚先少吵架，把第一步做出来',
      childNeed: '应用题读完后不知道第一步',
      childChannel: 'web_h5'
    }));
  }

  if (req.method !== 'POST') {
    return json(405, { ok: false, error: 'method_not_allowed' });
  }

  const body = await readBody(req);
  const familyName = String(body.familyName || '').trim();
  if (!familyName) {
    return json(400, { ok: false, error: 'family_name_required' });
  }

  return json(200, onboarding.buildActivationPackage(body));
}
