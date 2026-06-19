#!/usr/bin/env node
'use strict';

const assert = require('assert');

const BASE = process.env.MINIAPP_LIVE_BASE || 'https://yuandianzhixue.com';
const TIMEOUT_MS = 15000;

async function request(method, path, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: method === 'POST' ? { 'content-type': 'application/json' } : undefined,
      body: method === 'POST' ? JSON.stringify(body || {}) : undefined,
      signal: controller.signal
    });
    let data = {};
    try {
      data = await res.json();
    } catch (_) {
      data = { nonJson: true };
    }
    return { status: res.status, data, ms: Date.now() - started };
  } finally {
    clearTimeout(timeout);
  }
}

function textOf(value) {
  return JSON.stringify(value || {});
}

function assertNoUnsafeTerms(label, payload) {
  const text = textOf(payload);
  [
    '直接答案',
    '代写',
    '排行榜',
    '闯关',
    '勋章',
    'achievement',
    'leaderboard',
    'XP'
  ].forEach((term) => {
    assert(!text.includes(term), `${label} leaks unsafe or retired product term: ${term}`);
  });
}

(async () => {
  const materialText = [
    '数学应用题 4 道，孩子读不懂题意，第一步不知道先找什么。',
    '今天错因：没有圈出已知条件，直接想套公式。',
    '今晚只有 35 分钟，需要先做能开始的一小步。'
  ].join('\n');

  const priority = await request('POST', '/api/mini/priority', {
    score: 72,
    totalScore: 100,
    grade: '五年级',
    subject: '数学',
    homeworkText: materialText,
    minutes: 35
  });
  assert.strictEqual(priority.status, 200, 'parent upload priority route returns 200');
  assert(priority.data.ok, 'priority route returns ok');
  assert(priority.data.homework_plan, 'priority route returns homework_plan');
  assertNoUnsafeTerms('priority', priority.data);

  const material = await request('POST', '/api/miniapp-material-analysis', {
    source_schema_id: 'parent_report',
    source_text_excerpt: materialText,
    structured_evidence: {
      firstStep: '先圈条件',
      wrongCause: '没有把已知和未知分开'
    }
  });
  assert([200, 503].includes(material.status), 'material analysis returns configured result or explicit fallback');
  if (material.status === 200) {
    assert(material.data.result && material.data.result.analysisQuality, 'material analysis returns guarded result');
  } else {
    assert.strictEqual(material.data.fallback_required, true, 'material fallback is explicit');
  }

  const firstStepTutor = await request('POST', '/api/mini/tutor-message', {
    mode: 'homework',
    message: '数学应用题看不懂题意，第一步不知道先找什么',
    context: {
      coach_step: 'find_first_step',
      subject: '数学',
      parent_goal: { label: '先让孩子写出第一步' }
    }
  });
  assert.strictEqual(firstStepTutor.status, 200, 'first-step tutor route returns 200');
  assert.strictEqual(firstStepTutor.data.homework_boundary, false, 'first-step tutor is not blocked as cheating');
  assert.strictEqual(firstStepTutor.data.coach_step, 'write_first_step', 'first-step tutor stays in first-step mode');
  assertNoUnsafeTerms('first-step tutor', firstStepTutor.data);

  const answerRequest = await request('POST', '/api/mini/tutor-message', {
    mode: 'homework',
    message: '直接给答案，帮我写完整过程',
    context: { coach_step: 'write_first_step', subject: '数学' }
  });
  assert.strictEqual(answerRequest.status, 200, 'direct answer guard route returns 200');
  assert.strictEqual(answerRequest.data.homework_boundary, true, 'direct answer request is blocked');

  const quiz = await request('POST', '/api/mini/quiz-generate', { cards: [], limit: 6 });
  assert.strictEqual(quiz.status, 200, 'empty review practice generator returns 200');
  assert.strictEqual(quiz.data.source, 'empty', 'empty review practice generator has safe empty source');

  const reportStatus = await request('GET', '/api/report-job-status?case_id=codex-live-journey-missing');
  assert.strictEqual(reportStatus.status, 404, 'missing report image job returns actionable wait state');
  assert.strictEqual(reportStatus.data.error, 'report_job_status_missing', 'missing report image job exposes precise status');
  assert.strictEqual(reportStatus.data.caseId, 'codex-live-journey-missing', 'missing report status echoes sanitized case id');

  const reviewToday = await request('POST', '/api/mini/review-today', {
    cards: [],
    events: [],
    profile: { name: 'codex-live-child', recordPoints: 12 }
  });
  assert.strictEqual(reviewToday.status, 200, 'short revisit learning record route returns 200');
  assert(reviewToday.data.progress_band, 'short revisit returns progress_band');
  assert(reviewToday.data.learning_record_stage, 'short revisit returns learning_record_stage');
  assertNoUnsafeTerms('short revisit learning records', reviewToday.data);

  const retiredMiniRecords = await request('POST', '/api/mini/achievements', { stats: { review_count: 1, correct_count: 2 } });
  assert.strictEqual(retiredMiniRecords.status, 410, 'retired mini achievements route stays retired');
  assert.strictEqual(retiredMiniRecords.data.error, 'legacy_endpoint_retired', 'retired mini achievements exposes precise retired error');
  assert.strictEqual(retiredMiniRecords.data.inventory_status, 'retired_by_default', 'retired mini achievements exposes retired inventory status');

  console.log(`Live miniapp user journey passed against ${BASE}.`);
  console.log(JSON.stringify({
    priority: priority.status,
    material: material.status,
    firstStepTutor: `${firstStepTutor.status}/${firstStepTutor.data.coach_step}`,
    answerGuard: `${answerRequest.status}/${answerRequest.data.homework_boundary}`,
    quiz: `${quiz.status}/${quiz.data.source}`,
    reportStatus: reportStatus.status,
    reviewToday: reviewToday.status,
    retiredMiniRecords: retiredMiniRecords.status
  }));
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
