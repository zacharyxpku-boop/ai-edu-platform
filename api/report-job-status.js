import fs from 'fs';
import path from 'path';

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
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

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, OPTIONS',
        'access-control-allow-headers': 'content-type'
      }
    });
  }
  if (req.method !== 'GET') return json(405, { ok: false, error: 'method_not_allowed' });

  const url = new URL(req.url || 'https://yuandianzhixue.com/api/report-job-status');
  const caseId = sanitizeCaseId(url.searchParams.get('case_id') || url.searchParams.get('caseId') || 'default') || 'default';
  const file = statusPath(caseId);
  if (!fs.existsSync(file)) {
    return json(404, {
      ok: false,
      error: 'report_job_status_missing',
      caseId,
      nextBestAction: 'Run npm.cmd run report:image-pipeline:status for this case before exposing it to product surfaces.'
    });
  }

  try {
    const status = JSON.parse(fs.readFileSync(file, 'utf8'));
    return json(200, publicStatusPayload(status));
  } catch (error) {
    return json(500, {
      ok: false,
      error: 'report_job_status_invalid',
      caseId,
      message: error.message
    });
  }
}

