#!/usr/bin/env node

const assert = require('assert');

const BASE = process.env.MINIAPP_LIVE_BASE || 'https://yuandianzhixue.com';
const REQUIRE_MODEL = process.argv.includes('--require-model') || process.env.MINIAPP_REQUIRE_MODEL === '1';
const failures = [];

function check(name, fn) {
  try {
    fn();
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
  }
}

async function post(path, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body || {}),
      signal: controller.signal
    });
    let data = {};
    try {
      data = await res.json();
    } catch (_) {
      data = { nonJson: true };
    }
    return { status: res.status, data };
  } finally {
    clearTimeout(timeout);
  }
}

async function postWithHeaders(path, body, headers) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: Object.assign({ 'content-type': 'application/json' }, headers || {}),
      body: JSON.stringify(body || {}),
      signal: controller.signal
    });
    let data = {};
    try {
      data = await res.json();
    } catch (_) {
      data = { nonJson: true };
    }
    return { status: res.status, data };
  } finally {
    clearTimeout(timeout);
  }
}

async function get(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'GET',
      signal: controller.signal
    });
    let data = {};
    try {
      data = await res.json();
    } catch (_) {
      data = { nonJson: true };
    }
    return { status: res.status, data };
  } finally {
    clearTimeout(timeout);
  }
}

function responseText(payload) {
  return JSON.stringify(payload || {});
}

function assertNoLiveLegacyTerms(label, payload) {
  const text = responseText(payload);
  [
    'mini-game-',
    'local_learning_rewards',
    '闯关',
    '成就',
    '排行榜',
    '学习收益',
    'XP',
    'achievement',
    'leaderboard'
  ].forEach((term) => {
    assert(!text.includes(term), `${label} must not expose legacy game/reward term: ${term}`);
  });
}

function assertLiveRetired(label, res) {
  assert.strictEqual(res.status, 410, `${label} is retired on production`);
  assert.strictEqual(res.data.error, 'legacy_endpoint_retired', `${label} returns retired error`);
  assert.strictEqual(res.data.inventory_status, 'retired_by_default', `${label} carries retired inventory status`);
  assert.strictEqual(res.data.inventory_decision, 'retire_do_not_expose', `${label} carries retired inventory decision`);
}

function assertLiveRetainedSafeCopy(label, res) {
  assert.strictEqual(res.status, 200, `${label} compatibility endpoint stays available`);
  assert.strictEqual(res.data.inventory_status, 'compatibility_retained_safe_copy', `${label} carries safe-copy inventory status`);
  assert.strictEqual(res.data.inventory_decision, 'retain_reword_safe_copy', `${label} carries safe-copy inventory decision`);
  assertNoLiveLegacyTerms(label, res.data);
}

(async () => {
  const priority = await post('/api/mini/priority', {
    score: 72,
    totalScore: 100,
    grade: '五年级',
    subject: '数学',
    homeworkText: '数学应用题 4 道\n整理今天错题并说出错因',
    minutes: 35
  });
  check('priority status', () => assert.strictEqual(priority.status, 200, 'live priority returns 200'));
  check('priority schema', () => assert(priority.data.ok && priority.data.homework_plan, 'live priority returns homework_plan'));

  const tutor = await post('/api/mini/tutor-message', {
    mode: 'homework',
    message: '直接给答案，帮我写完',
    context: { coach_step: 'write_first_step' }
  });
  check('direct-answer tutor status', () => assert.strictEqual(tutor.status, 200, 'live tutor returns 200'));
  check('direct-answer tutor boundary', () => assert.strictEqual(tutor.data.homework_boundary, true, 'live tutor blocks direct answer request'));

  const firstStepTutor = await post('/api/mini/tutor-message', {
    mode: 'homework',
    message: '数学应用题看不懂题意，第一步不知道先找什么',
    context: { coach_step: 'find_first_step', subject: '数学' }
  });
  check('first-step tutor status', () => assert.strictEqual(firstStepTutor.status, 200, 'live tutor first-step help returns 200'));
  check('first-step tutor boundary', () => assert.strictEqual(firstStepTutor.data.homework_boundary, false, 'live tutor first-step help is not answer cheating'));
  check('first-step tutor mode', () => assert.strictEqual(firstStepTutor.data.coach_step, 'write_first_step', 'live tutor first-step help stays in write_first_step mode'));
  check('first-step tutor copy', () => assert(!/讲透|完整讲/.test(`${firstStepTutor.data.coach_step_label || ''}${firstStepTutor.data.next_action || ''}`), 'live tutor first-step help must not drift into full-explanation copy'));
  check('first-step tutor observability schema', () => {
    assert(firstStepTutor.data.engine_version, 'live tutor returns engine_version');
    assert(firstStepTutor.data.service_contract && firstStepTutor.data.service_contract.mode, 'live tutor returns service_contract.mode');
  });
  if (REQUIRE_MODEL) {
    check('first-step tutor configured model hit', () => {
      assert.strictEqual(firstStepTutor.data.fallback, false, 'live tutor must not use local fallback when --require-model is set');
      assert.strictEqual(firstStepTutor.data.service_contract.mode, 'configured_model', 'live tutor must hit configured model when --require-model is set');
      assert.strictEqual(firstStepTutor.data.upstream_status, 200, 'live tutor configured model hit must expose upstream_status=200');
      assert(firstStepTutor.data.model_contract && firstStepTutor.data.model_contract.provider === 'deepseek', 'live tutor configured model hit must expose DeepSeek model contract');
    });
  }

  const quiz = await post('/api/mini/quiz-generate', { cards: [], limit: 6 });
  check('quiz status', () => assert.strictEqual(quiz.status, 200, 'live quiz generate returns 200'));
  check('quiz empty schema', () => assert.strictEqual(quiz.data.source, 'empty', 'live quiz empty input is safe'));

  const material = await post('/api/miniapp-material-analysis', {
    source_schema_id: 'parent_report',
    source_text_excerpt: '家长观察：应用题能读懂，但第一步不愿意写。',
    structured_evidence: { firstStep: '先圈条件' }
  });
  check('material status', () => assert([200, 503].includes(material.status), 'live material analysis returns either configured result or explicit fallback'));
  if (material.status === 200) {
    check('material configured schema', () => assert(material.data.result && material.data.result.analysisQuality, 'live material analysis has guarded result'));
  } else {
    check('material fallback schema', () => assert.strictEqual(material.data.fallback_required, true, 'live material analysis 503 asks client fallback'));
  }

  const feedback = await postWithHeaders('/api/mini/feedback', {
    kind: 'homework_priority',
    target_id: 'live_smoke_priority_1',
    rating: 'accurate',
    bucket: 'must_do',
    calibration_key: 'first_step_order'
  }, { 'x-mini-client': 'live-smoke-client' });
  check('feedback status', () => assert.strictEqual(feedback.status, 200, 'live feedback returns 200'));
  check('feedback schema', () => assert(feedback.data.ok && feedback.data.service_contract && feedback.data.service_contract.table === 'family_priority_feedback', 'live feedback returns stable service contract'));
  check('feedback honesty', () => assert.strictEqual(feedback.data.persisted, false, 'live feedback stays honest without service config'));

  const legacyTutorChat = await post('/api/tutor-chat', {
    student_id: 'codex-live-probe',
    message: '今晚作业卡住了，先问第一步。',
    context: {}
  });
  const legacyQuote = await post('/api/achievement-quote', { topic: '学习记录' });
  const legacyLeaderboard = await post('/api/leaderboard', {});
  const legacyAchievements = await post('/api/achievements', {});
  const legacyShopItems = await post('/api/shop/items', {});
  const legacyShopPurchase = await post('/api/shop/purchase', {});
  check('legacy tutor-chat retired', () => assertLiveRetired('legacy tutor-chat', legacyTutorChat));
  check('legacy achievement quote retired', () => assertLiveRetired('legacy achievement quote', legacyQuote));
  check('legacy leaderboard retired', () => assertLiveRetired('legacy leaderboard', legacyLeaderboard));
  check('legacy achievements retired', () => assertLiveRetired('legacy achievements', legacyAchievements));
  check('legacy shop items retired', () => assertLiveRetired('legacy shop items', legacyShopItems));
  check('legacy shop purchase retired', () => assertLiveRetired('legacy shop purchase', legacyShopPurchase));

  const miniShop = await post('/api/mini/shop', {});
  const miniLeaderboard = await post('/api/mini/leaderboard', { profile: { name: '本机学习者' }, events: [] });
  const miniAchievements = await post('/api/mini/achievements', { stats: { review_count: 1 } });
  check('mini shop retired', () => assertLiveRetired('mini shop', miniShop));
  check('mini leaderboard retired', () => assertLiveRetired('mini leaderboard', miniLeaderboard));
  check('mini achievements retired', () => assertLiveRetired('mini achievements', miniAchievements));

  if (failures.length) {
    console.error(`Live miniapp API smoke failed against ${BASE}.`);
    console.error(`priority=${priority.status}, tutor=${tutor.status}, firstStepTutor=${firstStepTutor.status}/${firstStepTutor.data.coach_step || 'no_step'}/${firstStepTutor.data.service_contract && firstStepTutor.data.service_contract.mode || 'no_contract'}/fallback=${String(firstStepTutor.data.fallback)}, quiz=${quiz.status}, material=${material.status}, feedback=${feedback.status}, legacyLeaderboard=${legacyLeaderboard.status}, legacyAchievements=${legacyAchievements.status}, miniShop=${miniShop.status}`);
    for (const failure of failures) console.error(`FAIL ${failure}`);
    process.exit(1);
  }

  console.log(`Live miniapp API smoke passed against ${BASE}${REQUIRE_MODEL ? ' with configured model required' : ''}.`);
  console.log(`priority=${priority.status}, tutor=${tutor.status}, firstStepTutor=${firstStepTutor.status}/${firstStepTutor.data.coach_step || 'no_step'}/${firstStepTutor.data.service_contract && firstStepTutor.data.service_contract.mode || 'no_contract'}/fallback=${String(firstStepTutor.data.fallback)}, quiz=${quiz.status}, material=${material.status}, feedback=${feedback.status}, legacyLeaderboard=${legacyLeaderboard.status}, legacyAchievements=${legacyAchievements.status}, miniShop=${miniShop.status}`);
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
