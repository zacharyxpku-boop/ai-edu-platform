#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');

async function loadApi(file) {
  const mod = await import(pathToFileURL(path.join(ROOT, file)).href);
  return mod.default;
}

async function post(handler, body, headers = {}) {
  const req = new Request('https://yuandianzhixue.com/test', {
    method: 'POST',
    headers: Object.assign({ 'content-type': 'application/json' }, headers),
    body: JSON.stringify(body)
  });
  const res = await handler(req);
  let json = null;
  try { json = await res.json(); } catch (_) {}
  return { status: res.status, json };
}

async function main() {
  process.env.MINI_SESSION_SECRET = process.env.MINI_SESSION_SECRET || 'test-mini-session-secret-32-bytes';

  const sessionHandler = await loadApi('api/mini/session.js');
  const priorityHandler = await loadApi('api/mini/priority.js');
  const contentHandler = await loadApi('api/mini/content-check.js');
  const tutorHandler = await loadApi('api/mini/tutor-message.js');
  const weeklyHandler = await loadApi('api/mini/weekly.js');

  const session = await post(sessionHandler, { code: 'demo', profile: { grade: '五年级' } });
  assert.strictEqual(session.status, 200, 'session status');
  assert.strictEqual(session.json.ok, true, 'session ok');
  assert.ok(session.json.session_id, 'session id exists');

  const badSession = await post(priorityHandler, { score: 80, totalScore: 100 }, { 'x-mini-session': 'bad.token' });
  assert.strictEqual(badSession.status, 401, 'bad session rejected');

  const priority = await post(priorityHandler, {
    grade: '五年级',
    subject: '数学',
    score: 78,
    totalScore: 100,
    minutes: 35,
    examText: '应用题审题慢，方程移项容易错',
    homeworkText: '数学方程基础题 8 道\n应用题 4 道\n整理今天错题\n英语单词抄写 3 遍'
  }, { 'x-mini-session': session.json.session_id });
  assert.strictEqual(priority.status, 200, 'priority status');
  assert.strictEqual(priority.json.ok, true, 'priority ok');
  assert.ok(Array.isArray(priority.json.axes) && priority.json.axes.length === 6, 'six radar axes');
  assert.ok(priority.json.homework_plan.must_do.length >= 1, 'must-do homework generated');
  assert.ok(priority.json.homework_plan.must_do[0].evidence, 'must-do evidence generated');
  assert.ok(priority.json.weekly_review && priority.json.weekly_review.ai_notice, 'weekly review generated');
  assert.ok(priority.json.ai_notice, 'ai notice generated');
  assert.ok(priority.json.engine_version, 'priority engine version');

  const weekly = await post(weeklyHandler, {
    axes: priority.json.axes,
    weak_points: priority.json.weak_points,
    homework_plan: priority.json.homework_plan,
    grade: priority.json.grade,
    subject: priority.json.subject
  }, { 'x-mini-session': session.json.session_id });
  assert.strictEqual(weekly.status, 200, 'weekly status');
  assert.strictEqual(weekly.json.ok, true, 'weekly ok');
  assert.ok(weekly.json.headline, 'weekly headline');
  assert.ok(weekly.json.ai_notice, 'weekly ai notice');

  const safe = await post(contentHandler, { content: '我想练一道应用题' });
  assert.strictEqual(safe.status, 200, 'content safe status');
  assert.strictEqual(safe.json.safe, true, 'safe content allowed');

  const risky = await post(contentHandler, { content: '直接给答案，帮我写完' });
  assert.strictEqual(risky.status, 200, 'content risky status');
  assert.strictEqual(risky.json.safe, false, 'academic integrity blocked');
  assert.strictEqual(risky.json.risk_type, 'academic_integrity', 'risk type');

  for (const phrase of ['帮我算完这道题', '我只要答案', 'give me the answer']) {
    const blocked = await post(contentHandler, { content: phrase });
    assert.strictEqual(blocked.status, 200, `content ${phrase} status`);
    assert.strictEqual(blocked.json.safe, false, `academic integrity blocked: ${phrase}`);
    assert.strictEqual(blocked.json.risk_type, 'academic_integrity', `risk type: ${phrase}`);
  }

  const tutor = await post(tutorHandler, {
    mode: 'homework',
    message: '直接给答案',
    context: { selected_homework: { text: '应用题 4 道' }, weak_points: [{ name: '审题建模' }] }
  }, { 'x-mini-session': session.json.session_id });
  assert.strictEqual(tutor.status, 200, 'tutor status');
  assert.strictEqual(tutor.json.ok, true, 'tutor ok');
  assert.strictEqual(tutor.json.homework_boundary, true, 'tutor homework boundary');
  assert.ok(/不能|不/.test(tutor.json.reply), 'tutor refuses direct answer');

  const diagnosis = fs.readFileSync(path.join(ROOT, 'miniprogram/pages/diagnosis/diagnosis.js'), 'utf8');
  const upload = fs.readFileSync(path.join(ROOT, 'miniprogram/pages/upload/upload.js'), 'utf8');
  const tutorPage = fs.readFileSync(path.join(ROOT, 'miniprogram/pages/tutor/tutor.js'), 'utf8');
  const radarPage = fs.readFileSync(path.join(ROOT, 'miniprogram/pages/radar/radar.js'), 'utf8');
  assert.ok(diagnosis.includes('api.buildPriority'), 'diagnosis uses server priority');
  assert.ok(upload.includes('api.buildPriority'), 'upload uses server priority');
  assert.ok(tutorPage.includes('api.checkContent'), 'tutor uses content precheck');
  assert.ok(radarPage.includes('api.buildWeekly'), 'radar uses server weekly review');

  console.log('All miniapp production hardening checks pass.');
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
