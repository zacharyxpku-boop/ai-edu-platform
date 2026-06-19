#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

async function call(rel, body = {}, method = 'POST') {
  const mod = await import(pathToFileURL(path.join(root, rel)).href);
  const req = new Request(`https://qa.local/${rel}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(body)
  });
  const res = await mod.default(req);
  const text = await res.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch (_) {}
  return { status: res.status, body: json, text };
}

function assertRetired(res, rel) {
  assert.strictEqual(res.status, 410, `${rel} must be retired by default`);
  assert.strictEqual(res.body.error, 'legacy_endpoint_retired', `${rel} exposes retired error code`);
  assert.strictEqual(res.body.inventory_status, 'retired_by_default', `${rel} exposes retired inventory status`);
  assert.strictEqual(res.body.inventory_decision || 'retire_do_not_expose', 'retire_do_not_expose', `${rel} exposes retire inventory decision`);
  assert(res.body.replacement_endpoint, `${rel} exposes the replacement endpoint`);
}

function assertRetained(res, label) {
  assert.strictEqual(res.status, 200, `${label} compatibility endpoint stays available`);
  assert.strictEqual(res.body.inventory_status, 'compatibility_retained_safe_copy', `${label} is retained only as safe-copy compatibility`);
  assert.strictEqual(res.body.inventory_decision, 'retain_reword_safe_copy', `${label} exposes retained inventory decision`);
}

function assertNoPublicLegacyTerms(label, payload) {
  const text = JSON.stringify(payload);
  const banned = [
    '私教老师',
    'AI 私教',
    '闯关',
    '挑战',
    '成就',
    '勋章',
    '复习岛',
    '商店',
    '购买',
    '充值',
    '排行榜',
    '好友榜',
    '奖励',
    '提分 +',
    '提分+',
    '包提分',
    '保证提分',
    '人民幣',
    '人民币',
    '私教老师',
    'AI 私教',
    '闯关',
    '挑战',
    '成就',
    '勋章',
    '复习岛',
    '商店',
    '购买',
    '充值',
    '排行榜',
    '好友榜',
    '奖励',
    '提分 +',
    '提分+',
    '包提分',
    '保证提分',
    '提分减负',
    'gameRecallRoute',
    'game_recall_route',
    'game recall',
    'mini-game-',
    'arcade',
    'legacy mini achievements endpoint',
    'legacy mini leaderboard endpoint',
    'legacy mini shop endpoint',
    'achievement, badge, or honor',
    'ranks, peers, XP boards',
    'shop or exchange systems'
  ];
  for (const term of banned) {
    assert(!text.includes(term), `${label} public response must not expose legacy term: ${term}`);
  }
}

(async () => {
  process.env.LEGACY_TUTOR_CHAT_ENABLED = '1';
  process.env.LEGACY_ACHIEVEMENT_QUOTE_ENABLED = '1';

  for (const rel of ['api/tutor-chat.js', 'api/achievement-quote.js']) {
    assertRetired(await call(rel, { topic: 'qa probe', message: 'hello' }), rel);
  }

  for (const rel of ['api/leaderboard.js', 'api/achievements.js', 'api/shop/items.js', 'api/shop/purchase.js']) {
    assertRetired(await call(rel, {}), rel);
  }

  for (const rel of ['api/mini/shop.js', 'api/mini/leaderboard.js', 'api/mini/achievements.js']) {
    const retired = await call(rel, {});
    assertRetired(retired, rel);
    assertNoPublicLegacyTerms(rel, retired.body);
  }

  const report = await call('api/mini/report.js', {});
  assert.strictEqual(report.status, 200, 'mini report compatibility endpoint stays available');
  assert(report.body.weekly.progress_band, 'mini report exposes progress_band');
  assertNoPublicLegacyTerms('mini report', report.body);

  const childStats = await call('api/parent/child-stats.js', {});
  assert.strictEqual(childStats.status, 200, 'parent child-stats compatibility endpoint stays available');
  assert(childStats.body.stats.progress_band, 'parent child-stats exposes progress_band');
  assertNoPublicLegacyTerms('parent child-stats', childStats.body);

  const reviewToday = await call('api/mini/review-today.js', { cards: [], events: [], profile: {} });
  assert.strictEqual(reviewToday.status, 200, 'mini review-today compatibility endpoint stays available');
  assert(reviewToday.body.progress_band, 'mini review-today exposes progress_band');
  assert(reviewToday.body.learning_record_stage, 'mini review-today exposes learning_record_stage as the safe stage alias');
  assert.strictEqual(reviewToday.body.local_record_points, reviewToday.body.coins, 'mini review-today keeps coins only as compatibility alias');
  assert.strictEqual(reviewToday.body.local_session_remaining_checks, reviewToday.body.lives, 'mini review-today keeps lives only as compatibility alias');
  assert.strictEqual(reviewToday.body.engine_version, 'mini-review-records-today-v1', 'mini review-today engine is not game-branded');
  assertNoPublicLegacyTerms('mini review-today', reviewToday.body);

  const quizSubmit = await call('api/mini/quiz-submit.js', { answers: [{ correct: true }] });
  assert.strictEqual(quizSubmit.status, 200, 'mini quiz-submit compatibility endpoint stays available');
  assert.strictEqual(quizSubmit.body.learning_record_delta, quizSubmit.body.xp_delta, 'quiz submit exposes learning record alias');
  assert(quizSubmit.body.learning_record_stage, 'quiz submit exposes learning_record_stage as the safe stage alias');
  assert.strictEqual(quizSubmit.body.engine_version, 'mini-quiz-evidence-submit-v1', 'mini quiz-submit engine is not game-branded');
  assertNoPublicLegacyTerms('mini quiz-submit', quizSubmit.body);

  const reviewGrade = await call('api/mini/review-grade.js', { card_id: 'card_1', grade: 'remembered' });
  assert.strictEqual(reviewGrade.status, 200, 'mini review-grade compatibility endpoint stays available');
  assert.strictEqual(reviewGrade.body.learning_record_delta, reviewGrade.body.xp_delta, 'review grade exposes learning record alias');
  assert(reviewGrade.body.learning_record_stage, 'review grade exposes learning_record_stage as the safe stage alias');
  assert.strictEqual(reviewGrade.body.engine_version, 'mini-review-evidence-grade-v1', 'mini review-grade engine is not game-branded');
  assertNoPublicLegacyTerms('mini review-grade', reviewGrade.body);

  const miniClientApi = read('miniprogram/utils/api.js');
  assert(miniClientApi.includes('retiredMiniappInventoryClient'), 'miniapp client has a local retired-inventory guard');
  assert(miniClientApi.includes("feature,") && miniClientApi.includes("replacement_routes"), 'miniapp client retired-inventory guard exposes safe replacement routes');
  [
    'function fetchAchievements(payload)',
    'function fetchShop(payload)',
    'function purchaseShopItem(payload)',
    'function fetchLeaderboard(payload)'
  ].forEach((signature) => {
    const start = miniClientApi.indexOf(signature);
    const end = miniClientApi.indexOf('\n}', start);
    const block = miniClientApi.slice(start, end > start ? end : start + 260);
    assert(block.includes('retiredMiniappInventoryClient'), `${signature} does not call the retired public endpoint`);
    assert(!block.includes("request('/api/mini/"), `${signature} must not issue a legacy miniapp network request`);
  });

  const feedback = await call('api/mini/feedback.js', {
    target_id: 'priority_1',
    rating: 'accurate',
    calibration_key: 'first_step_order'
  });
  assert.strictEqual(feedback.status, 200, 'mini feedback compatibility endpoint stays available');
  assert.strictEqual(feedback.body.learning_signal.usable_for_calibration, true, 'mini feedback exposes calibration-safe signal');
  const retiredRankingSignal = ['usable', 'for', 'ranking'].join('_');
  assert(!Object.prototype.hasOwnProperty.call(feedback.body.learning_signal, retiredRankingSignal), 'mini feedback does not expose ranking language');
  assertNoPublicLegacyTerms('mini feedback', feedback.body);

  const legacyRevisitEvent = ['challenge', 'started'].join('_');
  const event = await call('api/mini/event.js', { event: legacyRevisitEvent, payload: { card_id: 'card_1' } });
  assert.strictEqual(event.status, 200, 'mini event compatibility endpoint stays available');
  assert.strictEqual(event.body.event.event, 'revisit_started', 'legacy challenge event is normalized to revisit');
  assert.strictEqual(event.body.event.original_event, legacyRevisitEvent, 'legacy event is only retained as compatibility evidence');
  assert.strictEqual(event.body.funnel, 'active_recall_revisit', 'legacy challenge event maps to revisit funnel');
  assertNoPublicLegacyTerms('mini event', event.body);

  const retainedSource = [
    'api/mini/_game.js',
    'api/mini/report.js',
    'api/parent/child-stats.js',
    'api/mini/review-today.js',
    'api/mini/quiz-submit.js',
    'api/mini/review-grade.js',
    'api/mini/quiz-generate.js',
    'api/review/due-cards.js',
    'api/mini/feedback.js',
    'api/mini/event.js'
  ].map(read).join('\n');

  const retiredSource = [
    'api/tutor-chat.js',
    'api/achievement-quote.js',
    'api/leaderboard.js',
    'api/achievements.js',
    'api/shop/items.js',
    'api/shop/purchase.js'
  ].map(read).join('\n');
  const semiPublicPromptSource = [
    'api/retrieve.js',
    'api/extract-dialogue-signals.js',
    'api/mini/content-engine.js',
    'api/miniapp-material-analysis.js',
    'api/escalate.js',
    'api/standard-info.js'
  ].map(read).join('\n');

  assert(retiredSource.includes('retired_by_default'), 'retired legacy endpoints carry machine-readable retired inventory status');
  assert(retiredSource.includes('LEGACY_TUTOR_CHAT_ENABLED = false'), 'legacy tutor env flag cannot revive old endpoint');
  assert(retiredSource.includes('LEGACY_ACHIEVEMENT_QUOTE_ENABLED = false'), 'legacy quote env flag cannot revive old endpoint');
  assert(retiredSource.includes('inventory_decision'), 'retired aliases expose machine-readable inventory decisions');
  assert(retainedSource.includes('compatibility_retained_safe_copy'), 'remaining retained mini compatibility endpoints carry machine-readable safe-copy inventory status');
  assert(retainedSource.includes('retain_reword_safe_copy'), 'retained mini compatibility endpoints expose machine-readable inventory decisions');
  assert(['api/mini/shop.js', 'api/mini/leaderboard.js', 'api/mini/achievements.js'].map(read).join('\n').includes('retired_by_default'), 'mini shop/leaderboard/achievements are retired instead of safe-copy retained');
  assertNoPublicLegacyTerms('retained source', retainedSource);
  assertNoPublicLegacyTerms('semi-public prompt source', semiPublicPromptSource);

  [
    'LEARNING_RECORD_DELTAS',
    'STAGE_RECORDS',
    'LOCAL_VISUAL_RECORD_ITEMS',
    'calculateLearningRecordDelta',
    'getLearningRecordStage',
    'learningStageRecordState',
    'localSelfSnapshotRows',
    'reserveLocalVisualRecord'
  ].forEach((marker) => {
    assert(retainedSource.includes(marker), `mini game compatibility module must expose safe primary marker: ${marker}`);
  });

  assert(retainedSource.includes('usable_for_calibration') && !retainedSource.includes(retiredRankingSignal), 'feedback compatibility source uses calibration language instead of ranking');
  assert(retainedSource.includes('revisit_started') && retainedSource.includes('LEGACY_EVENT_ALIASES'), 'event compatibility source maps old event names to revisit events');

  const fullcheck = read('scripts/miniapp-fullcheck.cjs');
  assert(fullcheck.includes('scripts/test-legacy-api-inventory-risk.cjs'), 'miniapp fullcheck runs legacy API inventory risk contract');

  console.log('Legacy API inventory risk checks passed.');
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
