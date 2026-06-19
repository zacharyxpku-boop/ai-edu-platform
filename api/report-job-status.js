import fs from 'fs';
import path from 'path';
import { env } from '../lib/env.js';

export const config = { runtime: 'nodejs' };

// Supabase report job reads use SUPABASE_SERVICE_ROLE_KEY through env.supabaseServiceRoleKey().
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

function pgHeaders() {
  const serviceKey = env.supabaseServiceRoleKey();
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`
  };
}

function supabaseConfigured() {
  return Boolean(env.supabaseUrl() && env.supabaseServiceRoleKey());
}

async function readReportJob(jobId) {
  if (!supabaseConfigured() || !jobId || jobId === 'default') return null;
  const base = env.supabaseUrl().replace(/\/$/, '');
  const query = [
    `job_id=eq.${encodeURIComponent(jobId)}`,
    'select=job_id,child_id,status,source,result,error_code,created_at,updated_at',
    'limit=1'
  ].join('&');
  const response = await fetch(`${base}/rest/v1/mini_report_jobs?${query}`, {
    method: 'GET',
    headers: pgHeaders()
  });
  if (!response.ok) return null;
  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? rows[0] || null : null;
}

function publicSupabaseJobPayload(job, caseId) {
  const result = job.result && typeof job.result === 'object' ? job.result : {};
  return {
    ok: true,
    schema_id: 'report_job_status_v1',
    source: 'supabase',
    caseId,
    jobId: job.job_id,
    status: job.status || 'unknown',
    localWorkCompleteUntilProvider: ['draft_ready', 'needs_parent_confirmation', 'completed'].includes(job.status),
    externalProviderRequired: ['queued', 'needs_parent_confirmation'].includes(job.status),
    evidence: {
      child_id: job.child_id || '',
      source: job.source || '',
      updated_at: job.updated_at || job.created_at || ''
    },
    pipeline: result.pipeline || {},
    productRoutes: Array.isArray(result.productRoutes) ? result.productRoutes : [],
    nextBestAction: result.next_action || result.parent_summary || '',
    externalBlockers: job.error_code ? [job.error_code] : [],
    safetyPolicy: {
      no_ranking: true,
      no_score_promise: true,
      parent_confirmation_required: job.status === 'needs_parent_confirmation'
    }
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
    const jobId = sanitizeCaseId(url.searchParams.get('job_id') || url.searchParams.get('jobId') || caseId) || caseId;
    const dbJob = await readReportJob(jobId);
    if (dbJob) {
      return sendJson(res, 200, publicSupabaseJobPayload(dbJob, caseId));
    }

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
