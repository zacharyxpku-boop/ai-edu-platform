/**
 * scripts/test-today-recos.cjs
 *
 * Sandbox src/today-recos.js, 验 pickUpNext 4 档优先级在不同 localStorage 输入下选对档.
 * 不渲染 DOM, 只测决策算法.
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const recosSrc = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'today-recos.js'), 'utf8');

let failed = 0;
function pass(l) { console.log('  ✓ ' + l); }
function fail(l, e) { failed++; console.error('  ✗ ' + l + ' — ' + (e && e.message || e)); }

function makeSandbox(initialStore, errorsList) {
  const store = Object.assign({}, initialStore || {});
  const ls = {
    getItem: k => Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null,
    setItem: (k, v) => { store[k] = String(v); }
  };
  const docMock = {
    getElementById: () => null,
    head: { appendChild: () => {} },
    createElement: () => ({ id: '', textContent: '', appendChild: () => {} })
  };
  const win = {
    localStorage: ls,
    document: docMock,
    LearningStore: errorsList ? { getErrors: () => errorsList } : undefined,
    GAME: { getLog: () => [] }
  };
  win.window = win;
  return win;
}

function load(sandbox) {
  const wrapped = `
    var localStorage = sandbox.localStorage;
    var document = sandbox.document;
    var window = sandbox.window;
    ${recosSrc}
    return sandbox.window.TodayRecos;
  `;
  return new Function('sandbox', wrapped)(sandbox);
}

// ─── case 1: 错题到期 → A 档 ───
console.log('case 1: due errors → kind A (red)');
try {
  const past = Date.now() - 1000;
  const sb = makeSandbox({}, [
    { id: 'e1', subject: '数学', reviewCount: 0, nextReviewAt: past },
    { id: 'e2', subject: '物理', reviewCount: 1, nextReviewAt: past }
  ]);
  const r = load(sb).pickUpNext();
  assert.equal(r.lvl, 'A', '到期 ≥1 应当 A 档');
  assert.ok(r.t.includes('错题攻克'), '主标题暗示错题');
  pass('A 档 · ' + r.t);
} catch (e) { fail('A due err', e); }

// ─── case 2: 无到期错题 + 学生年级 → B 档 ───
console.log('case 2: grade set → kind B (blue)');
try {
  const sb = makeSandbox({ 'yd:my_grade': 'high_2', 'yd:my_name': '小明' }, []);
  const r = load(sb).pickUpNext();
  assert.equal(r.lvl, 'B', '有 grade 无 due-err 应 B 档');
  assert.ok(r.t.includes('小明') || r.t.includes('该回'), '带学生名或文案');
  pass('B 档 · ' + r.t);
} catch (e) { fail('B grade', e); }

// ─── case 3: 无 grade + readN < 5 → C 档 ───
console.log('case 3: insufficient breadth → kind C (amber)');
try {
  const sb = makeSandbox({ 'ydzx_textbook_read': JSON.stringify({ 'a::ch1': 1, 'a::ch2': 2 }) }, []);
  const r = load(sb).pickUpNext();
  assert.equal(r.lvl, 'C', '读 < 5 章 + 无 grade 应 C 档');
  assert.ok(r.t.includes('5 章') || r.t.includes('地基'));
  pass('C 档 · ' + r.t);
} catch (e) { fail('C breadth', e); }

// ─── case 4: 啥都没有 / 已读 ≥5 → D 档 ───
console.log('case 4: fallback → kind D (green)');
try {
  // 准备 6 章已读, 无 grade, 无 due-err
  const r6 = {};
  for (let i = 1; i <= 6; i++) r6['x::ch' + i] = i;
  const sb = makeSandbox({ 'ydzx_textbook_read': JSON.stringify(r6) }, []);
  const r = load(sb).pickUpNext();
  assert.equal(r.lvl, 'D', 'readN ≥ 5 + 无 grade 应 D 档');
  assert.ok(r.t.includes('每日一题') || r.t.includes('一道'));
  pass('D 档 · ' + r.t);
} catch (e) { fail('D fallback', e); }

// ─── case 5: gather 字段齐全 ───
console.log('case 5: gather() shape');
try {
  const sb = makeSandbox({
    'ydzx_textbook_read': JSON.stringify({ 'a::ch1': 1 })
  }, [{ id: 'e1', reviewCount: 0, nextReviewAt: Date.now() - 1000 }]);
  const stats = load(sb).gather();
  assert.equal(typeof stats.errsAll, 'number');
  assert.equal(typeof stats.errsDue, 'number');
  assert.equal(typeof stats.readN, 'number');
  assert.equal(stats.errsAll, 1);
  assert.equal(stats.errsDue, 1);
  pass('gather() 返回 6 个 number 字段');
} catch (e) { fail('gather shape', e); }

console.log('case 6: local loop snapshot -> next action');
try {
  const loopSnapshot = {
    ready: true,
    nextAction: 'review one local card',
    parentLine: 'parent asks first step',
    shareLine: 'next: review one local card'
  };
  const sb = makeSandbox({ 'ydzx_textbook_read': JSON.stringify({ 'a::ch1': 1 }) }, []);
  sb.LearningStore = {
    getErrors: () => [],
    buildLearningLoopSnapshot: () => loopSnapshot
  };
  const recos = load(sb);
  const stats = recos.gather();
  assert.equal(stats.loopSnapshot, loopSnapshot);
  const cards = recos.buildCards(stats, { max: 1 });
  assert.equal(cards[0].href, '/progress.html');
  assert.equal(cards[0].priority, 95);
  const next = recos.pickUpNext();
  assert.equal(next.href, '/progress.html');
  assert.equal(next.t, loopSnapshot.nextAction);
  pass('local loop snapshot routes to progress next action');
} catch (e) { fail('local loop snapshot', e); }

if (failed) { console.error('\nFAIL: ' + failed); process.exit(1); }
console.log('\nAll src/today-recos.js unit tests pass.');
process.exit(0);
