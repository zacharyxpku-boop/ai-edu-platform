import fs from 'fs';
import path from 'path';

export const config = { runtime: 'nodejs' };

function responseJson(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function sendJson(res, status, body) {
  if (!res) return responseJson(status, body);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
  return undefined;
}

function sendEmpty(res, status, headers = {}) {
  if (!res) {
    return new Response(null, { status, headers });
  }
  res.statusCode = status;
  Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
  res.end();
  return undefined;
}

function sanitizeCaseId(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

function statusPath(caseId) {
  const root = process.cwd();
  if (!caseId || caseId === 'default') {
    return path.join(root, 'outputs', 'status', 'report_job_status.json');
  }
  return path.join(root, 'outputs', 'cases', caseId, 'status', 'report_job_status.json');
}

function publicStatusPayload(status) {
  return {
    ok: true,
    schema_id: 'report_job_status_v1',
    caseId: status.caseId || 'default',
    jobId: status.jobId || `report:${status.caseId || 'default'}`,
    status: status.status || 'unknown',
    localWorkCompleteUntilProvider: Boolean(status.localWorkCompleteUntilProvider),
    externalProviderRequired: Boolean(status.externalProviderRequired),
    evidence: status.evidence || {},
    pipeline: status.pipeline || {},
    productRoutes: Array.isArray(status.productRoutes) ? status.productRoutes : [],
    nextBestAction: status.nextBestAction || '',
    externalBlockers: Array.isArray(status.externalBlockers) ? status.externalBlockers : [],
    safetyPolicy: status.safetyPolicy || {}
  };
}

export default async function handler(req, res) {
  let caseId = 'default';
  try {
    if (req.method === 'OPTIONS') {
      return sendEmpty(res, 204, {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, OPTIONS',
        'access-control-allow-headers': 'content-type'
      });
    }
    if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });

    const url = new URL(req.url || '/api/report-job-status', 'https://yuandianzhixue.com');
    caseId = sanitizeCaseId(url.searchParams.get('case_id') || url.searchParams.get('caseId') || 'default') || 'default';
    const file = statusPath(caseId);
    if (!fs.existsSync(file)) {
      return sendJson(res, 404, {
        ok: false,
        error: 'report_job_status_missing',
        caseId,
        nextBestAction: 'Run npm.cmd run report:image-pipeline:status for this case before exposing it to product surfaces.'
      });
    }

    const status = JSON.parse(fs.readFileSync(file, 'utf8'));
    return sendJson(res, 200, publicStatusPayload(status));
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      error: 'report_job_status_invalid',
      caseId,
      message: error.message
    });
  }
}
