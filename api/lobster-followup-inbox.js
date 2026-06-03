import { createRequire } from 'module';
import { readJsonBody, requestUrl, sendJson, sendOptions } from './lobster-http.js';

const require = createRequire(import.meta.url);
const followup = require('../src/lobster/lobster-followup.cjs');

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendOptions(res);

  if (req.method === 'GET') {
    const url = requestUrl(req, 'https://yuandianzhixue.com/api/lobster-followup-inbox');
    const inbox = followup.buildParentDeviceInbox({
      now: url.searchParams.get('now') || undefined
    });
    return sendJson(res, 200, inbox);
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const body = await readJsonBody(req);
  const inbox = followup.materializeParentDeviceInbox({
    now: body.now || undefined,
    adapter: body.adapter || 'parent-device-inbox'
  });
  return sendJson(res, 200, inbox);
}
