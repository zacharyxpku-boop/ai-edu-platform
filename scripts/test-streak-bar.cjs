/**
 * scripts/test-streak-bar.cjs
 *
 * 沙箱 src/streak-bar.js, 验 STREAK_BAR.computeStats 在多种 localStorage 输入下返回正确字段.
 * 不渲染 DOM, 只测数据计算.
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const sbSrc = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'streak-bar.js'), 'utf8');

let failed = 0;
function pass(l) { console.log('  ✓ ' + l); }
function fail(l, e) { failed++; console.error('  ✗ ' + l + ' — ' + (e && e.message || e)); }

function makeSandbox(initialStore) {
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
  const win = { localStorage: ls, document: docMock };
  win.window = win;
  return win;
}

function load(sandbox) {
  const wrapped = `
    var localStorage = sandbox.localStorage;
    var document = sandbox.document;
    var window = sandbox.window;
    ${sbSrc}
    return sandbox.window.STREAK_BAR;
  `;
  return new Function('sandbox', wrapped)(sandbox);
}

function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// ─── case 1: 空状态返回零 ───
console.log('case 1: empty profile');
try {
  const sb = makeSandbox();
  const s = load(sb).computeStats();
  assert.equal(s.streak, 0);
  assert.equal(s.streakBest, 0);
  assert.equal(s.todayActions, 0);
  assert.equal(s.chToday, 0);
  assert.equal(s.qToday, 0);
  assert.equal(s.qAcc, null);
  pass('空状态全 0 / qAcc null');
} catch (e) { fail('empty', e); }

// ─── case 2: lastActiveDay = 今日 → streak 维持 ───
console.log('case 2: lastActiveDay today preserves streak');
try {
  const today = todayKey();
  const sb = makeSandbox({
    'ydzx_game_profile_v1': JSON.stringify({
      streak: 5, streakBest: 7, lastActiveDay: today,
      daily: { [today]: { xp: 12, actions: 3, tools: ['quiz'] } }
    })
  });
  const s = load(sb).computeStats();
  assert.equal(s.streak, 5);
  assert.equal(s.streakBest, 7);
  assert.equal(s.todayActions, 3);
  assert.equal(s.todayXP, 12);
  pass('streak 5 持久化');
} catch (e) { fail('today active', e); }

// ─── case 3: lastActiveDay > 1 天前 → 显示用 streak 归零 ───
console.log('case 3: lastActiveDay 3 days ago resets display streak');
try {
  const d = new Date(); d.setDate(d.getDate() - 3);
  const stale = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const sb = makeSandbox({
    'ydzx_game_profile_v1': JSON.stringify({ streak: 5, streakBest: 7, lastActiveDay: stale, daily: {} })
  });
  const s = load(sb).computeStats();
  assert.equal(s.streak, 0, '断签后 displayed streak 归零');
  assert.equal(s.streakBest, 7, 'streakBest 仍保留');
  pass('断 3 天 streak 归零, best 不变');
} catch (e) { fail('stale day', e); }

// ─── case 4: 今日新读 2 章 / 本周共 5 章 ───
console.log('case 4: chToday + chWeek');
try {
  const now = Date.now();
  const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
  const wd = todayMidnight.getDay();
  const offset = wd === 0 ? 6 : wd - 1;
  const weekStart = todayMidnight.getTime() - offset * 86400000;
  // 构造: 2 条今天 + 3 条上周内但非今天 + 1 条 8 天前(不算本周)
  // 用 todayMidnight - 1ms 当昨天的最后一刻, 减天数确保非今日
  const yesterdayLate = todayMidnight.getTime() - 1;
  const fixture = { 'a::ch1': now, 'a::ch2': now };
  // weekStart 一定 ≤ yesterdayLate(除非今天就是周一, 那时 weekStart === todayMidnight.getTime())
  // 把 3 条本周非今日 timestamp 落到 [weekStart, todayMidnight) 区间; 周一时 fallback 到 0 条
  if (weekStart < todayMidnight.getTime()) {
    fixture['b::ch1'] = weekStart;
    fixture['b::ch2'] = weekStart + 1000;
    fixture['b::ch3'] = yesterdayLate;
  } else {
    // 今天是周一, 本周内除今天之外没空间, 跳过这 3 条
  }
  fixture['old::ch1'] = weekStart - 86400000 * 8;   // 8 天前
  const sb = makeSandbox({ 'ydzx_textbook_read': JSON.stringify(fixture) });
  const s = load(sb).computeStats();
  assert.equal(s.chToday, 2, '今日 2 章');
  // 周一时 chWeek = 2(只有今天的 2 条); 其他天 chWeek = 5
  const expectedWeek = weekStart < todayMidnight.getTime() ? 5 : 2;
  assert.equal(s.chWeek, expectedWeek);
  pass('chToday 2 / chWeek ' + expectedWeek);
} catch (e) { fail('ch today/week', e); }

// ─── case 5: quiz 正确率 ───
console.log('case 5: qAcc');
try {
  const today = todayKey();
  const sb = makeSandbox({
    'ydzx_quiz_outcome_v1': JSON.stringify({
      a: { r: 'right', d: today },
      b: { r: 'correct', d: today },
      c: { r: 'wrong', d: today },
      d: { r: 'right', d: '1999-01-01' }   // 老题不算
    })
  });
  const s = load(sb).computeStats();
  assert.equal(s.qToday, 3);
  assert.equal(s.qAcc, 67, '2/3 ≈ 67%');
  pass('qToday 3, qAcc 67%');
} catch (e) { fail('qAcc', e); }

if (failed) { console.error('\nFAIL: ' + failed); process.exit(1); }
console.log('\nAll src/streak-bar.js unit tests pass.');
process.exit(0);
