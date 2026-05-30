#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const apiFile = path.join(root, 'api', 'report-job-status.js');
const miniappApiFile = path.join(root, 'miniprogram', 'utils', 'api.js');
const caseId = 'codex_status_api_probe';
const caseDir = path.join(root, 'outputs', 'cases', caseId);
const statusDir = path.join(caseDir, 'status');
const statusFile = path.join(statusDir, 'report_job_status.json');

function removeUnderRoot(target) {
  const resolved = path.resolve(target);
  if (!resolved.startsWith(root + path.sep)) throw new Error(`Refusing to remove outside repo: ${resolved}`);
  if (fs.existsSync(resolved)) fs.rmSync(resolved, { recursive: true, force: true });
}

async function main() {
  removeUnderRoot(caseDir);
  fs.mkdirSync(statusDir, { recursive: true });
  fs.writeFileSync(statusFile, JSON.stringify({
    jobId: `report:${caseId}`,
    caseId,
    status: 'waiting_for_image_generation',
    localWorkCompleteUntilProvider: true,
    externalProviderRequired: true,
    evidence: { evidenceReady: true },
    pipeline: {
      images: {
        count: 0,
        providerConfigured: false,
        providerEnvKey: 'OPENAI_API_KEY'
      }
    },
    productRoutes: [
      { id: 'upload', state: 'has_parsed_real_evidence', routeHint: '/pages/upload/upload' },
      { id: 'report', state: 'prompts_ready', routeHint: '/pages/radar/radar' }
    ],
    nextBestAction: 'Provide an Image 2/OpenAI image provider.',
    externalBlockers: [{ id: 'image_provider_missing', env: 'OPENAI_API_KEY' }],
    safetyPolicy: { noExternalAgentAsCoreShell: true }
  }, null, 2));

  const mod = await import(`file:///${apiFile.replace(/\\/g, '/')}`);
  const response = await mod.default(new Request(`https://yuandianzhixue.com/api/report-job-status?case_id=${caseId}`, { method: 'GET' }));
  assert.strictEqual(response.status, 200, 'status API returns 200 for existing case');
  const body = await response.json();
  assert.strictEqual(body.schema_id, 'report_job_status_v1', 'status API returns stable schema id');
  assert.strictEqual(body.caseId, caseId, 'status API returns requested case id');
  assert.strictEqual(body.status, 'waiting_for_image_generation', 'status API returns job status');
  assert.strictEqual(body.externalProviderRequired, true, 'status API exposes provider blocker');
  assert(body.externalBlockers.some((item) => item.id === 'image_provider_missing'), 'status API exposes missing provider blocker');
  assert(body.productRoutes.some((route) => route.id === 'upload'), 'status API exposes product routes');
  assert(!JSON.stringify(body).includes(root), 'status API does not expose absolute filesystem paths');

  const missing = await mod.default(new Request('https://yuandianzhixue.com/api/report-job-status?case_id=missing_case_probe', { method: 'GET' }));
  assert.strictEqual(missing.status, 404, 'status API returns 404 for missing case status');
  const missingBody = await missing.json();
  assert.strictEqual(missingBody.error, 'report_job_status_missing', 'status API gives actionable missing status error');

  const apiCode = fs.readFileSync(apiFile, 'utf8');
  const miniappApiCode = fs.readFileSync(miniappApiFile, 'utf8');
  assert(apiCode.includes('sanitizeCaseId') && apiCode.includes('publicStatusPayload'), 'status API sanitizes and returns public payload only');
  assert(!/OPENAI_API_KEY\\s*=/.test(apiCode), 'status API must not set provider keys');
  assert(miniappApiCode.includes('function fetchReportJobStatus') && miniappApiCode.includes('/api/report-job-status?case_id='), 'miniapp client exposes report job status fetcher');

  removeUnderRoot(caseDir);
  console.log('Report job status API tests pass.');
}

main().catch((error) => {
  removeUnderRoot(caseDir);
  console.error(error);
  process.exit(1);
});

