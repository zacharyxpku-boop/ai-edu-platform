import { createRequire } from 'module';
import { readJsonBody, sendJson, sendOptions } from './lobster-http.js';

const require = createRequire(import.meta.url);
const teacher = require('../src/lobster/lobster-teacher.cjs');

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

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendOptions(res);

  if (req.method === 'GET') {
    return sendJson(res, 200, stripRaw(teacher.buildUnifiedTeacherWorkspace({
      familyName: 'Demo family',
      childAlias: 'Child',
      subjects: ['math'],
      parentObservation: 'The child gets stuck on word problems and needs a first step.',
      childMessage: 'I do not know the first step.'
    })));
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const body = await readJsonBody(req);
  if (!String(body.familyName || '').trim()) {
    return sendJson(res, 400, { ok: false, error: 'family_name_required' });
  }

  return sendJson(res, 200, stripRaw(teacher.buildUnifiedTeacherWorkspace(body)));
}
