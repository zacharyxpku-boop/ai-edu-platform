#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function assertIncludes(rel, text, note) {
  assert(read(rel).includes(text), `${rel}: ${note || `missing ${text}`}`);
}

function assertNotIncludes(rel, text, note) {
  assert(!read(rel).includes(text), `${rel}: ${note || `must not include ${text}`}`);
}

function assertMatch(rel, pattern, note) {
  assert(pattern.test(read(rel)), `${rel}: ${note || `missing ${pattern}`}`);
}

async function callApi(rel, body, extraHeaders = {}) {
  const mod = await import(pathToFileURL(path.join(root, rel)).href);
  const req = new Request(`https://qa.local/${rel}`, {
    method: 'POST',
    headers: Object.assign({ 'content-type': 'application/json' }, extraHeaders),
    body: JSON.stringify(body || {})
  });
  const res = await mod.default(req);
  return { status: res.status, body: await res.json() };
}

async function withProviderEnvCleared(fn) {
  const names = ['DEEPSEEK_KEY', 'DEEPSEEK_API_KEY', 'QWEN_KEY', 'DASHSCOPE_API_KEY'];
  const previous = {};
  for (const name of names) {
    previous[name] = process.env[name];
    delete process.env[name];
  }
  try {
    return await fn();
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
}

(async () => {
  const journeyResults = [];
  const pass = (id, name, evidence) => journeyResults.push({ id, name, status: 'pass', evidence });

  assertIncludes('miniprogram/app.json', '"pages/tutor/tutor"', 'AI tutor page is registered');
  assertIncludes('miniprogram/custom-tab-bar/index.wxml', 'data-path="/pages/tutor/tutor"', 'AI tutor tab is tappable');
  assertIncludes('miniprogram/pages/tutor/tutor.wxml', '原点 · 咕点', 'AI tutor carries the reference Yuandian/Gudian brand');
  assertIncludes('miniprogram/pages/tutor/tutor.wxml', '先问第一步 不代写答案', 'AI tutor keeps the no-answer boundary in the launch brand area');
  assertIncludes('miniprogram/pages/tutor/tutor.wxml', 'tutor-usage-note', 'AI tutor follows the reference usage note instead of a compact care explanation line');
  assertIncludes('miniprogram/pages/tutor/tutor.wxml', 'tutor-chat-head', 'AI tutor uses the reference chat app header instead of old context chips');
  assertIncludes('miniprogram/pages/tutor/tutor.js', 'buildTutorHomeContext', 'AI tutor builds personalized home context');
  assertMatch('miniprogram/pages/tutor/tutor.js', /this\.getTabBar\(\)\.setData\(\{[^}]*selected:\s*0/, 'AI tutor is selected as the first tab');
  assertIncludes('miniprogram/pages/tutor/tutor.js', 'setTutorTabbarHidden', 'AI tutor child scenes can hide the custom tabbar for full-screen reference pages');
  for (const route of ['/pages/tutor/tutor', '/pages/review/review', '/pages/profile/profile']) {
    assertIncludes('miniprogram/custom-tab-bar/index.js', route, `tab route ${route} is registered`);
  }
  assertNotIncludes('miniprogram/custom-tab-bar/index.js', '/pages/upload/upload', 'upload is no longer a primary tab route');
  assertNotIncludes('miniprogram/custom-tab-bar/index.wxml', 'data-path="/pages/home/home"', 'retired today/home tab is not exposed');
  assertNotIncludes('miniprogram/custom-tab-bar/index.wxml', '>今天<', 'custom tabbar does not show today');
  for (const scene of ['upload', 'report', 'tutor', 'review', 'parent']) {
    assertIncludes('miniprogram/pages/entry-detail/entry-detail.js', `${scene}: {`, `entry-detail scene ${scene} is supported`);
  }
  pass('J01', 'AI-first launch and child routes', 'AI tutor is launch tab with brand/context; custom tabbar exposes 3 active tabs; entry-detail supports 5 scenes');

  assertNotIncludes('miniprogram/pages/upload/upload.wxml', 'class="yd-upload-hero" bindtap="submit"', 'upload hero is visual only');
  assertIncludes('miniprogram/pages/upload/upload.wxml', 'class="yd-upload-primary" bindtap="submit"', 'upload primary CTA submits');
  assertIncludes('miniprogram/pages/upload/upload.js', 'const deck = buildUploadEntryDeck(\'material\')', 'empty upload prepares the material intake deck');
  assertIncludes('miniprogram/pages/upload/upload.js', 'showMaterialPanel: true', 'empty upload exposes the input panel instead of dead-ending');
  pass('J02', 'upload empty state', 'upload.submit guides into material input');

  const priority = await callApi('api/mini/priority.js', {
    score: 72,
    totalScore: 100,
    homeworkText: 'Math application problem 4. Sort today wrong questions and explain the first stuck step.',
    minutes: 35,
    grade: 'grade5',
    subject: 'math'
  });
  assert.strictEqual(priority.status, 200, 'priority API returns 200');
  assert(priority.body.ok && priority.body.homework_plan && priority.body.homework_plan.must_do, 'priority API returns homework plan');
  assertIncludes('miniprogram/pages/upload/upload.js', "source: 'mini-upload-local-fallback'", 'upload has local fallback state');
  assertIncludes('miniprogram/pages/upload/upload.js', "afterPrioritySaved(text, nextState, plan, 'local')", 'upload fallback still saves priority');
  pass('J03', 'upload priority fallback', 'priority handler returns plan; upload has local catch fallback');

  const material = await withProviderEnvCleared(() => callApi('api/miniapp-material-analysis.js', {
    source_schema_id: 'parent_report',
    source_text_excerpt: 'Parent note: the child understands the word problem but refuses to write the first step.',
    structured_evidence: { firstStep: 'circle the condition first' }
  }));
  assert.strictEqual(material.status, 503, 'material analysis without provider returns 503');
  assert.strictEqual(material.body.fallback_required, true, 'material analysis explicitly asks for fallback');
  assertIncludes('miniprogram/pages/upload/upload.js', '}).catch(() => fallback);', 'client material analysis catches API failure');
  pass('J04', 'material analysis fallback', 'server returns fallback_required; upload client catches to local fallback');

  assertIncludes('miniprogram/pages/upload/upload.js', 'wx.chooseMedia', 'upload supports chooseMedia');
  assertIncludes('miniprogram/pages/upload/upload.js', 'wx.chooseImage', 'upload supports chooseImage fallback');
  assertIncludes('miniprogram/pages/upload/upload.js', 'if (!wx.chooseMessageFile)', 'upload checks file picker availability');
  assertIncludes('miniprogram/pages/upload/upload.js', '当前微信版本不支持选文件，请先粘贴文字', 'file picker unavailable has text fallback');
  pass('J05', 'upload file permission fallback', 'chooseMedia/chooseImage/chooseMessageFile paths have fallback prompts');

  assertIncludes('miniprogram/pages/tutor/tutor.js', 'tutorLadder.isAnswerRequest(input)', 'tutor front-end detects answer request');
  const directAnswer = await callApi('api/mini/tutor-message.js', {
    mode: 'homework',
    message: 'Give me the direct answer and finish the homework for me.',
    context: { coach_step: 'write_first_step' }
  });
  assert.strictEqual(directAnswer.status, 200, 'tutor API returns safe 200');
  assert.strictEqual(directAnswer.body.homework_boundary, true, 'tutor API blocks direct answer request');
  assert.strictEqual(directAnswer.body.service_contract.boundary, 'no_direct_homework_answer', 'tutor API exposes no-answer boundary');
  const firstStepHelp = await callApi('api/mini/tutor-message.js', {
    mode: 'homework',
    message: 'I am stuck on the first step of the math problem. Please ask me what to look at first.',
    context: { coach_step: 'find_first_step', subject: 'math' }
  });
  assert.strictEqual(firstStepHelp.status, 200, 'tutor API returns safe 200 for first-step help');
  assert.strictEqual(firstStepHelp.body.homework_boundary, false, 'first-step help is not treated as answer cheating');
  assert.strictEqual(firstStepHelp.body.coach_step, 'write_first_step', 'first-step help stays in write_first_step mode');
  pass('J06', 'tutor no-answer boundary', 'front-end detects answer request; mini tutor API returns homework_boundary');

  assertNotIncludes('miniprogram/pages/tutor/tutor.js', 'api.checkContent(input).then', 'tutor no longer waits on a separate content-check request before server tutor');
  assertIncludes('miniprogram/pages/tutor/tutor.js', "safety_check: extraContext.safety_check || 'server_guard'", 'tutor delegates safety guard to the server tutor endpoint for faster first response');
  assertIncludes('miniprogram/utils/api.js', 'timeout: 12000', 'tutor request uses a shorter client timeout before local fallback');
  assertIncludes('miniprogram/pages/tutor/tutor.js', 'tutorFailureReply(error,', 'tutor catches request failure with observable client fallback source');
  assertIncludes('miniprogram/pages/tutor/tutor.js', "fallback_source: source", 'tutor records the mapped session/rate-limit/content-check/network fallback source');
  assertIncludes('miniprogram/pages/tutor/tutor.js', "mode: 'client_local_rules'", 'tutor request failure uses explicit client local-rules service contract');
  assertIncludes('miniprogram/pages/tutor/tutor.js', 'storage.set(storage.KEYS.tutorMessages', 'tutor persists visible conversation state locally');
  assertIncludes('miniprogram/pages/tutor/tutor.js', 'socratic_prompt_workflow', 'tutor writes prompt workflow evidence');
  pass('J07', 'tutor network fallback', 'content/tutor request catch appends fallback and persists messages');

  assertMatch('miniprogram/pages/review/review.js', /if \(!quiz \|\| !quiz\.questions \|\| !quiz\.questions\.length\) \{[\s\S]*wx\.showToast/, 'review startQuiz has empty-state toast');
  const emptyQuiz = await callApi('api/mini/quiz-generate.js', { cards: [], limit: 6 });
  assert.strictEqual(emptyQuiz.status, 200, 'empty quiz API returns 200');
  assert.strictEqual(emptyQuiz.body.source, 'empty', 'empty quiz API marks empty source');
  assert.strictEqual(emptyQuiz.body.count, 0, 'empty quiz API returns zero questions');
  assertIncludes('miniprogram/pages/review/review.js', 'buildPracticeTemplatePack', 'review can generate practice template pack');
  pass('J08', 'review empty state', 'review has empty toast; quiz API returns source=empty');

  assertIncludes('miniprogram/pages/profile/profile.wxml', 'class="growth-choice-grid" wx:if="{{growthActiveScene === \'main\'}}"', 'growth report main screen collects questionnaire/upload input');
  assertIncludes('miniprogram/pages/profile/profile.wxml', 'class="growth-report-preview" wx:if="{{growthActiveScene === \'preview\'}}"', 'growth report preview stays behind generated evidence state');
  assertIncludes('miniprogram/pages/profile/profile.wxml', 'data-action="upload" bindtap="runParentReportAction">补充材料让报告更准', 'growth report preview can collect more material');
  assertIncludes('miniprogram/pages/profile/profile.wxml', 'data-action="tutor" bindtap="runParentReportAction">去AI私教', 'growth report preview routes to tutor execution');
  assertIncludes('miniprogram/pages/profile/profile.wxml', 'data-action="review" bindtap="runParentReportAction">知识乐园', 'growth report preview routes to knowledge execution');
  assertIncludes('miniprogram/pages/profile/profile.wxml', 'bindtap="completeParentActionCard"', 'growth action card completion is connected');
  assertIncludes('miniprogram/pages/profile/profile.js', 'parent_action_card_completed', 'growth action card writes follow-through evidence');
  assertIncludes('miniprogram/pages/entry-detail/entry-detail.js', "primaryRoute: '/pages/profile/profile?from=entry_parent_report&panel=action&open=flow'", 'entry parent primary route opens profile flow');
  assertIncludes('miniprogram/pages/profile/profile.js', "from === 'entry_report_evidence'", 'parent consumes report evidence route');
  assertIncludes('miniprogram/pages/profile/profile.js', "from === 'entry_upload_quiz'", 'parent consumes quick assessment route');
  assertIncludes('miniprogram/pages/profile/profile.js', "growthActiveScene: 'preview'", 'parent preview stays inside the Growth Report tab');
  assertIncludes('miniprogram/pages/profile/profile.js', 'resolveReportJobCaseId(reportState = {})', 'parent report resolves a case id for report artwork status');
  assertIncludes('miniprogram/pages/profile/profile.js', "refreshReportJobStatus(caseId = 'default')", 'parent report refreshes report artwork status');
  assertIncludes('miniprogram/pages/profile/profile.js', 'api.fetchReportJobStatus(caseId)', 'parent report queries the report job status API');
  assertIncludes('miniprogram/pages/profile/profile.js', 'learningReportSummary.parentReportWorkflowImageLine', 'parent report writes status into the visible report artwork line');
  assertIncludes('miniprogram/pages/profile/profile.js', 'remote_status_unavailable', 'parent report has a remote status fallback');
  pass('J09', 'growth report and report fallback', 'profile preview, action card writeback, and report fallback are wired');

  const visibleWxml = [
    'miniprogram/pages/home/home.wxml',
    'miniprogram/pages/upload/upload.wxml',
    'miniprogram/pages/tutor/tutor.wxml',
    'miniprogram/pages/review/review.wxml',
    'miniprogram/pages/profile/profile.wxml',
    'miniprogram/pages/entry-detail/entry-detail.wxml'
  ].map(read).join('\n');
  for (const term of ['arcade', 'mole', 'subcheck', '闯关', '勋章', '排行榜', '复习岛']) {
    assert(!visibleWxml.includes(term), `visible miniapp WXML must not include retired term: ${term}`);
  }
  for (const term of ['同伴接力', '闯关接力', '挑战入口']) {
    assert(!visibleWxml.includes(term), `visible miniapp WXML must not expose old growth-game wording: ${term}`);
  }
  const visibleJourneySources = [
    'miniprogram/pages/home/home.js',
    'miniprogram/pages/profile/profile.js',
    'miniprogram/utils/storage.js'
  ].map(read).join('\n');
  for (const term of ['同伴接力', '闯关接力', '挑战入口', '社区轻接力', '题型接力', '题型题库接力', '安全分享接力', '接力赛季', '点拨质量接力', '明天验证']) {
    assert(!visibleJourneySources.includes(term), `visible journey copy must not expose retired growth wording: ${term}`);
  }
  for (const term of ['家庭回访卡', '明天回访', '题型回访']) {
    assert(visibleJourneySources.includes(term), `visible journey copy should use current revisit/report wording: ${term}`);
  }
  for (const term of ['练习单', '打印练习', '生成器', '课堂互动工具', '学生自主练习', '共创社区']) {
    assert(!visibleWxml.includes(term), `visible miniapp WXML must not promise unavailable workshop feature: ${term}`);
  }
  assertIncludes('miniprogram/pages/upload/upload.wxml', 'data-workflow="source"', 'upload workflow source action is tappable');
  assertIncludes('miniprogram/pages/upload/upload.wxml', 'data-workflow="modules"', 'upload workflow module action is tappable');
  assertIncludes('miniprogram/pages/upload/upload.wxml', 'data-workflow="preview"', 'upload workflow preview action is tappable');
  assertIncludes('miniprogram/pages/upload/upload.js', '报告预览可先查看，完整图稿稍后自动补齐', 'upload hides provider/key state behind parent-safe report language');
  assert(!read('miniprogram/pages/upload/upload.js').includes('OPENAI_API_KEY'), 'upload page must not expose provider key state in parent-visible copy');
  assert(!read('miniprogram/pages/profile/profile.js').includes('OPENAI_API_KEY'), 'profile page must not expose provider key state in parent-visible copy');
  assertIncludes('miniprogram/pages/tutor/tutor.js', "capabilityId: 'socratic_prompt_to_review'", 'tutor routes prompt workflow to review');
  assertIncludes('miniprogram/pages/review/review.js', "const toolIds = ['whack', 'quiz', 'flashcard', 'match', 'snake', 'uno', 'variant', 'print']", 'review pack keeps the eight core Knowledge Park plays');
  assertIncludes('miniprogram/pages/review/review.js', 'tool.templateOnly', 'review routes non-engine plays through practice-pack deliverables');
  assertIncludes('miniprogram/pages/review/review.js', 'runTemplateDeliverable', 'review has a real handoff for template-only Knowledge Park plays');
  assertIncludes('miniprogram/pages/review/review.wxml', 'review-template-workbench', 'review shows the compact practice-pack workbench');
  ['worksheet_generator', 'classroom_interactive', 'student_assignment', 'local_structure_card'].forEach((term) => {
    assert(!read('miniprogram/pages/review/review.js').includes(term), `review pack must not expose abstract workshop lane: ${term}`);
  });
  pass('J10', 'workflow evidence and retired UI guard', 'upload/tutor/review/profile expose workflow evidence without API key or abstract workshop lanes');

  console.log('Miniapp user journey risk smoke passed.');
  for (const item of journeyResults) {
    console.log(`${item.id} ${item.status.toUpperCase()} ${item.name} - ${item.evidence}`);
  }
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
