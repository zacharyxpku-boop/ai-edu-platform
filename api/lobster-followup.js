import { createRequire } from 'module';
import { readJsonBody, requestUrl, sendJson, sendOptions } from './lobster-http.js';

const require = createRequire(import.meta.url);
const followup = require('../src/lobster/lobster-followup.cjs');

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendOptions(res);

  if (req.method === 'GET') {
    const url = requestUrl(req, 'https://yuandianzhixue.com/api/lobster-followup');
    const familyId = url.searchParams.get('family_id') || url.searchParams.get('familyId') || '';
    if (!familyId) return sendJson(res, 400, { ok: false, error: 'family_id_required' });
    const schedule = followup.loadFollowUpSchedule(familyId);
    return sendJson(res, schedule.ok ? 200 : 404, Object.assign({}, schedule, {
      due: followup.listDueFollowUps(schedule, url.searchParams.get('now') || new Date().toISOString())
    }));
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const body = await readJsonBody(req);
  if (body.action === 'record_event') {
    const familyId = body.familyId || body.family_id || '';
    if (!familyId) return sendJson(res, 400, { ok: false, error: 'family_id_required' });
    const result = followup.recordFollowUpEvent(familyId, body.event || body);
    return sendJson(res, result.ok ? 200 : 404, result);
  }

  if (body.action === 'record_dispatch') {
    const familyId = body.familyId || body.family_id || '';
    if (!familyId) return sendJson(res, 400, { ok: false, error: 'family_id_required' });
    const result = followup.recordDispatchAttempt(familyId, body.dispatch || body);
    return sendJson(res, result.ok ? 200 : 404, result);
  }

  if (!String(body.familyName || body.familyId || '').trim()) {
    return sendJson(res, 400, { ok: false, error: 'family_name_required' });
  }

  const schedule = followup.createFollowUpSchedule(body);
  const receipt = followup.saveFollowUpSchedule(schedule);
  return sendJson(res, 200, Object.assign({}, schedule, {
    persistence: {
      ok: receipt.ok,
      reminderCount: receipt.reminderCount,
      rawDialogueStored: false
    },
    due: followup.listDueFollowUps(schedule, body.now || new Date().toISOString())
  }));
}
