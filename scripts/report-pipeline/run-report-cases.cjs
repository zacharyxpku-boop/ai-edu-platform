#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..', '..');
const casesRoot = path.join(root, 'inputs', 'cases');
const runner = path.join(root, 'scripts', 'report-pipeline', 'run-report-pipeline.cjs');

function sanitizeCaseId(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

function discoverCases() {
  const explicit = process.env.REPORT_CASES;
  if (explicit) {
    return explicit.split(',').map(sanitizeCaseId).filter(Boolean);
  }
  if (!fs.existsSync(casesRoot)) return [];
  return fs.readdirSync(casesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => sanitizeCaseId(entry.name))
    .filter(Boolean);
}

function runCase(caseId, command) {
  execFileSync(process.execPath, [runner, command], {
    cwd: root,
    stdio: 'pipe',
    env: Object.assign({}, process.env, {
      REPORT_CASE: caseId,
      OPENAI_API_KEY: process.env.REPORT_BATCH_GENERATE === '1' ? process.env.OPENAI_API_KEY : ''
    })
  });
}

const command = process.argv[2] || 'all';
const cases = discoverCases();
const results = [];

if (!cases.length) {
  console.log('No report cases found. Create folders under inputs/cases/<case_id>/ or set REPORT_CASES=case1,case2.');
  process.exit(0);
}

cases.forEach((caseId) => {
  try {
    runCase(caseId, command);
    const readinessFile = path.join(root, 'outputs', 'cases', caseId, 'review', 'readiness_report.json');
    const readiness = fs.existsSync(readinessFile)
      ? JSON.parse(fs.readFileSync(readinessFile, 'utf8'))
      : { status: 'unknown', nextStep: 'readiness report not found' };
    results.push({ caseId, ok: true, status: readiness.status, nextStep: readiness.nextStep });
  } catch (error) {
    results.push({ caseId, ok: false, status: 'failed', nextStep: error.message });
  }
});

const summaryDir = path.join(root, 'outputs', 'case_batch');
fs.mkdirSync(summaryDir, { recursive: true });
fs.writeFileSync(path.join(summaryDir, 'summary.json'), `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  command,
  cases: results
}, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(summaryDir, 'summary.md'), `# Report Case Batch Summary

Generated: ${new Date().toISOString()}
Command: \`${command}\`

| Case | Run | Status | Next Step |
| --- | --- | --- | --- |
${results.map((item) => `| ${item.caseId} | ${item.ok ? 'PASS' : 'FAIL'} | ${item.status} | ${String(item.nextStep || '').replace(/\|/g, '/')} |`).join('\n')}
`, 'utf8');

console.log(`Processed ${results.length} case(s). Summary: outputs/case_batch/summary.md`);

