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
  const feedbackHandler = await loadApi('api/mini/feedback.js');
  const eventHandler = await loadApi('api/mini/event.js');
  const leadHandler = await loadApi('api/lead.js');

  const session = await post(sessionHandler, { code: 'local', profile: { grade: '五年级' } });
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
  assert.ok(Array.isArray(priority.json.misconception_profile), 'misconception profile generated');
  assert.ok(priority.json.homework_plan.must_do[0].priority_vector, 'priority vector generated');
  assert.ok(priority.json.homework_plan.must_do[0].evidence.calibration_key, 'calibration key generated');
  assert.ok(priority.json.weekly_review && priority.json.weekly_review.ai_notice, 'weekly review generated');
  assert.ok(priority.json.ai_notice, 'ai notice generated');
  assert.strictEqual(priority.json.source, 'local_priority_rules', 'priority uses honest local rules source');
  assert.strictEqual(priority.json.persisted, false, 'priority does not imply persistence');
  assert.ok(priority.json.service_contract, 'priority exposes service contract');
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
  assert.strictEqual(weekly.json.source, 'local_weekly_rules', 'weekly uses honest local rules source');
  assert.strictEqual(weekly.json.persisted, false, 'weekly does not imply persistence');
  assert.ok(weekly.json.service_contract, 'weekly exposes service contract');

  const feedback = await post(feedbackHandler, {
    kind: 'homework_priority',
    target_id: priority.json.homework_plan.must_do[0].id,
    rating: 'off',
    bucket: 'must_do',
    reason: 'family_marked_off',
    item_text: priority.json.homework_plan.must_do[0].text,
    calibration_key: priority.json.homework_plan.must_do[0].evidence.calibration_key,
    priority_vector: priority.json.homework_plan.must_do[0].priority_vector,
    misconception_tags: priority.json.homework_plan.must_do[0].evidence.misconception_tags,
    state_summary: {
      grade: priority.json.grade,
      subject: priority.json.subject,
      weak_points: priority.json.weak_points
    }
  }, { 'x-mini-session': session.json.session_id });
  assert.strictEqual(feedback.status, 200, 'feedback status');
  assert.strictEqual(feedback.json.ok, true, 'feedback ok');
  assert.ok(feedback.json.feedback_id, 'feedback id');
  assert.strictEqual(feedback.json.feedback.rating, 'off', 'feedback rating normalized');
  assert.ok(feedback.json.learning_signal, 'feedback learning signal');
  assert.ok(feedback.json.learning_signal.usable_for_calibration, 'feedback usable for calibration');
  assert.strictEqual(feedback.json.source, 'local_feedback_receipt', 'feedback returns local receipt source');
  assert.strictEqual(feedback.json.persisted, false, 'feedback does not pretend to persist without service configuration');
  assert.ok(feedback.json.service_contract, 'feedback service contract');

  const learningEvent = await post(eventHandler, {
    event: 'share_card_generated',
    client_id: 'local_test_client',
    source: 'profile_share_card',
    entity_id: 'share_test',
    payload: {
      share_code: 'abcd1234',
      title: '今天修复了一个错因',
      phone: '13800000000'
    }
  }, { 'x-mini-session': session.json.session_id, 'x-mini-client': 'local_test_client' });
  assert.strictEqual(learningEvent.status, 200, 'mini event status');
  assert.strictEqual(learningEvent.json.ok, true, 'mini event ok');
  assert.strictEqual(learningEvent.json.event.event, 'share_card_generated', 'mini event normalized');
  assert.strictEqual(learningEvent.json.funnel, 'share_to_activation', 'share event maps to growth funnel');
  assert.strictEqual(learningEvent.json.mode, 'local_receipt', 'mini event reports local receipt mode when persistence is not configured');
  assert.strictEqual(learningEvent.json.persisted, false, 'mini event does not pretend to persist without cloud config');
  assert.strictEqual(learningEvent.json.event.payload.phone, '[redacted]', 'mini event scrubs sensitive fields');
  assert.ok(learningEvent.json.service_contract, 'mini event service contract');

  const revisitStarted = await post(eventHandler, {
    event: 'revisit_started',
    client_id: 'local_test_client',
    source: 'daily_card',
    entity_id: 'share_test',
    payload: {
      share_code: 'abcd1234',
      mode: 'same_identity'
    }
  }, { 'x-mini-session': session.json.session_id, 'x-mini-client': 'local_test_client' });
  assert.strictEqual(revisitStarted.status, 200, 'revisit started event status');
  assert.strictEqual(revisitStarted.json.event.event, 'revisit_started', 'revisit event allowed');
  assert.strictEqual(revisitStarted.json.funnel, 'active_recall_revisit', 'revisit event maps to active recall funnel');

  const legacyChallengeStarted = await post(eventHandler, {
    event: ['challenge', 'started'].join('_'),
    client_id: 'local_test_client',
    source: 'daily_card',
    entity_id: 'share_test',
    payload: {
      share_code: 'abcd1234',
      mode: 'same_identity'
    }
  }, { 'x-mini-session': session.json.session_id, 'x-mini-client': 'local_test_client' });
  assert.strictEqual(legacyChallengeStarted.status, 200, 'legacy challenge alias event status');
  assert.strictEqual(legacyChallengeStarted.json.event.event, 'revisit_started', 'legacy challenge event is normalized to revisit');
  assert.strictEqual(legacyChallengeStarted.json.event.original_event, ['challenge', 'started'].join('_'), 'legacy challenge event is retained only as compatibility evidence');

  const leadSubmitted = await post(eventHandler, {
    event: 'lead_submitted',
    client_id: 'local_test_client',
    source: 'profile_unlock',
    entity_id: 'share_test',
    payload: {
      share_code: 'abcd1234',
      identity_tag: '错因修复者',
      evidence_done: '3',
      evidence_total: '3'
    }
  }, { 'x-mini-session': session.json.session_id, 'x-mini-client': 'local_test_client' });
  assert.strictEqual(leadSubmitted.status, 200, 'lead submitted event status');
  assert.strictEqual(leadSubmitted.json.event.event, 'lead_submitted', 'lead event allowed');

  const lead = await post(leadHandler, {
    kind: 'miniapp',
    name: '测试家长',
    phone: '13800000000',
    kid: '五年级 数学',
    page: 'miniprogram/profile',
    utm_source: 'profile_unlock',
    evidence_done: '3',
    evidence_total: '3',
    identity_tag: '错因修复者',
    share_code: 'abcd1234',
    tier_label: '小程序 MVP 咨询'
  }, { 'x-forwarded-for': '203.0.113.10' });
  assert.strictEqual(lead.status, 200, 'lead endpoint status');
  assert.strictEqual(lead.json.ok, true, 'lead endpoint ok');
  assert.ok(lead.json.lead_id, 'lead endpoint returns lead id');
  assert.strictEqual(lead.json.lead_store.mode, 'local_receipt', 'lead endpoint reports local receipt mode without service config');
  assert.strictEqual(lead.json.lead_store.persisted, false, 'lead endpoint does not pretend to persist without cloud config');
  assert.strictEqual(lead.json.service_ready, false, 'lead endpoint does not pretend a follow-up channel is ready without config');
  assert.strictEqual(lead.json.service_contract.table, 'mini_leads', 'lead endpoint exposes service contract');

  const safe = await post(contentHandler, { content: '我想练一道应用题' });
  assert.strictEqual(safe.status, 200, 'content safe status');
  assert.strictEqual(safe.json.safe, true, 'safe content allowed');

  const risky = await post(contentHandler, { content: '直接给答案，帮我写完' });
  assert.strictEqual(risky.status, 200, 'content risky status');
  assert.strictEqual(risky.json.safe, false, 'academic integrity blocked');
  assert.strictEqual(risky.json.risk_type, 'academic_integrity', 'risk type');

  for (const phrase of [
    '帮我算完这道题',
    '我只要答案',
    'give me the answer',
    'give me the full answer',
    'write the whole solution',
    '\u76f4\u63a5\u7ed9\u6211\u5b8c\u6574\u7b54\u6848\u548c\u8fc7\u7a0b'
  ]) {
    const blocked = await post(contentHandler, { content: phrase });
    assert.strictEqual(blocked.status, 200, `content ${phrase} status`);
    assert.strictEqual(blocked.json.safe, false, `academic integrity blocked: ${phrase}`);
    assert.strictEqual(blocked.json.risk_type, 'academic_integrity', `risk type: ${phrase}`);
  }

  const tutor = await post(tutorHandler, {
    mode: 'homework',
    message: '直接给答案',
    context: {
      coach_step: 'write_first_step',
      selected_homework: {
        text: '应用题 4 道',
        reason: '先保住最有帮助的任务',
        evidence: {
          calibration_key: 'modeling:task',
          misconception_tags: [{ axis: 'modeling', label: '审题跳步' }]
        }
      },
      weak_points: [{ name: '审题建模' }]
    }
  }, { 'x-mini-session': session.json.session_id });
  assert.strictEqual(tutor.status, 200, 'tutor status');
  assert.strictEqual(tutor.json.ok, true, 'tutor ok');
  assert.strictEqual(tutor.json.homework_boundary, true, 'tutor homework boundary');
  assert.ok(/不能|不/.test(tutor.json.reply), 'tutor refuses direct answer');
  assert.strictEqual(tutor.json.coach_step, 'write_first_step', 'tutor step');
  assert.ok(tutor.json.next_action, 'tutor next action');
  assert.ok(tutor.json.mastery_signal, 'tutor mastery signal');
  assert.ok(Array.isArray(tutor.json.misconception_tags), 'tutor misconception tags');
  assert.strictEqual(tutor.json.persisted, false, 'tutor response does not imply persistence');
  assert.ok(tutor.json.service_contract && tutor.json.service_contract.boundary === 'no_direct_homework_answer', 'tutor exposes service boundary');

  const tutorEnglishBoundary = await post(tutorHandler, {
    mode: 'homework',
    message: 'Give me the full answer and write the whole solution.',
    context: {
      coach_step: 'write_first_step',
      selected_homework: {
        text: 'word problem',
        reason: 'student asks for answer shortcut',
        evidence: {
          calibration_key: 'modeling:task',
          misconception_tags: [{ axis: 'modeling', label: 'first step skipped' }]
        }
      }
    }
  }, { 'x-mini-session': session.json.session_id });
  assert.strictEqual(tutorEnglishBoundary.status, 200, 'tutor English boundary status');
  assert.strictEqual(tutorEnglishBoundary.json.homework_boundary, true, 'tutor blocks English full-answer shortcut');
  assert.strictEqual(tutorEnglishBoundary.json.mastery_signal.status, 'blocked_answer_request', 'English full-answer shortcut becomes blocked evidence');

  const tutorCheckAnswer = await post(tutorHandler, {
    mode: 'homework',
    message: '核对答案：应用题 4 道\n我写的答案是：36',
    context: {
      coach_step: 'check_answer',
      selected_homework: {
        text: '应用题 4 道',
        reason: '参考答案：36。重点检查单位。',
        evidence: {
          calibration_key: 'modeling:task',
          misconception_tags: [{ axis: 'reading', label: '单位换算' }]
        }
      },
      parent_goal: {
        id: 'careless',
        label: '改掉粗心',
        strategy: '优先检查审题、单位、条件和符号。'
      },
      weak_points: [{ name: '单位换算' }]
    }
  }, { 'x-mini-session': session.json.session_id });
  assert.strictEqual(tutorCheckAnswer.status, 200, 'tutor check answer status');
  assert.strictEqual(tutorCheckAnswer.json.ok, true, 'tutor check answer ok');
  assert.strictEqual(tutorCheckAnswer.json.homework_boundary, false, 'answer check is not blocked as homework cheating');
  assert.strictEqual(tutorCheckAnswer.json.coach_step, 'check_answer', 'answer check keeps requested step');
  assert.strictEqual(tutorCheckAnswer.json.mastery_signal.status, 'answer_check_allowed', 'answer check mastery status');
  assert.ok(/核对|答案|对不对|检查/.test(tutorCheckAnswer.json.reply), 'answer check reply is direct');

  const tutorFast = await post(tutorHandler, {
    mode: 'homework',
    message: '我赶时间，按三句帮我看：对不对、错在哪、下一题先检查什么。',
    context: {
      coach_step: 'fast_mode',
      parent_goal: {
        id: 'speed',
        label: '减少磨蹭',
        strategy: '把任务压成 15 分钟，先做必须做。'
      },
      weak_points: [{ name: '审题建模' }]
    }
  }, { 'x-mini-session': session.json.session_id });
  assert.strictEqual(tutorFast.status, 200, 'tutor fast mode status');
  assert.strictEqual(tutorFast.json.coach_step, 'fast_mode', 'fast mode keeps requested step');
  assert.strictEqual(tutorFast.json.mastery_signal.status, 'fast_check', 'fast mode mastery status');

  const entryDetail = fs.readFileSync(path.join(ROOT, 'miniprogram/pages/entry-detail/entry-detail.js'), 'utf8');
  const upload = fs.readFileSync(path.join(ROOT, 'miniprogram/pages/upload/upload.js'), 'utf8');
  const homePage = fs.readFileSync(path.join(ROOT, 'miniprogram/pages/home/home.js'), 'utf8');
  const miniApi = fs.readFileSync(path.join(ROOT, 'miniprogram/utils/api.js'), 'utf8');
  const appidAssistant = fs.readFileSync(path.join(ROOT, 'scripts/miniapp-launch-assistant.cjs'), 'utf8');
  const profileWxml = fs.readFileSync(path.join(ROOT, 'miniprogram/pages/profile/profile.wxml'), 'utf8');
  const reviewPage = fs.readFileSync(path.join(ROOT, 'miniprogram/pages/review/review.js'), 'utf8');
  const tutorPage = fs.readFileSync(path.join(ROOT, 'miniprogram/pages/tutor/tutor.js'), 'utf8');
  const tutorWxml = fs.readFileSync(path.join(ROOT, 'miniprogram/pages/tutor/tutor.wxml'), 'utf8');
  const radarPage = fs.readFileSync(path.join(ROOT, 'miniprogram/pages/profile/profile.js'), 'utf8');
  const radarWxml = fs.readFileSync(path.join(ROOT, 'miniprogram/pages/profile/profile.wxml'), 'utf8');
  assert.ok(entryDetail.includes('const SCENES') && entryDetail.includes("primaryRoute: '/pages/upload/upload"), 'entry-detail replaces retired diagnosis with upload scene routing');
  assert.ok(upload.includes('api.buildPriority'), 'upload uses server priority');
  assert.ok(upload.includes('mini-upload-wrong-question'), 'upload imports detected wrong questions into review deck');
  assert.ok(appidAssistant.includes('--dry-run') && appidAssistant.includes('looksLikePlaceholderAppId'), 'AppID replacement supports safe dry-run and rejects placeholder values');
  assert.ok(appidAssistant.includes('existingPrivateConfig') && appidAssistant.includes('Object.assign({}, existingPrivateConfig'), 'AppID replacement preserves existing private config fields');
  assert.ok(miniApi.includes("request('/api/mini/event'"), 'miniapp learning/share events use dedicated event endpoint');
  assert.ok(!miniApi.includes("Object.assign({ kind: 'learning_event' }"), 'miniapp events are not sent through feedback calibration contract');
  assert.ok(upload.includes('buildSubmitLabel'), 'upload changes primary CTA when wrong questions are detected');
  assert.ok(homePage.includes('buildWrongbookEntry'), 'home page exposes one clear wrongbook entry');
  assert.ok(homePage.includes("event: 'share_clicked'"), 'home page records incoming share clicks for growth attribution');
  assert.ok(homePage.includes("navigation.navigateLearningRoute(url)") && homePage.includes("'/pages/tutor/tutor?from=home'"), 'home primary AI input opens Xiaodian tutor through tab-safe navigation');
  assert.ok(homePage.includes('trackShareActivation') && homePage.includes("event,") && homePage.includes('share_code: incoming.share_code') && homePage.includes("'revisit_started'"), 'home attaches share attribution to revisit activation events');
  assert.ok(
    profileWxml.includes('yd-parent-hero growth')
    && profileWxml.includes('growth-choice-grid')
    && profileWxml.includes('growth-report-preview')
    && profileWxml.includes('growth-report-preview-card')
    && (
      profileWxml.includes('/assets/reference/report-radar-card-illustration.png')
      || profileWxml.includes('/assets/reference/family-avatar-group-transparent.png')
    ),
    'profile promotes visual Growth Report input and keeps evidence preview in the report subpage'
  );
  const tutorApi = fs.readFileSync(path.join(ROOT, 'api/mini/tutor-message.js'), 'utf8');
  assert.ok(tutorPage.includes("safety_check: extraContext.safety_check || 'server_guard'") && tutorApi.includes('riskyContent(message)'), 'tutor uses server-side content guard without serial precheck');
  const profilePage = fs.readFileSync(path.join(ROOT, 'miniprogram/pages/profile/profile.js'), 'utf8');
  const leadApi = fs.readFileSync(path.join(ROOT, 'api/lead.js'), 'utf8');
  assert.ok(profilePage.includes("event: 'share_app_message'") && profilePage.includes("event: 'share_timeline'"), 'profile distinguishes real share actions from card generation');
  assert.ok(profilePage.includes("event: 'share_card_generated'") && profilePage.includes("event: 'lead_submitted'"), 'profile records share card generation and lead conversion');
  assert.ok(profilePage.includes('mode=same_identity'), 'profile share links invite same-identity revisit without fake leaderboard');
  assert.ok(profilePage.includes('shareIntent') && profilePage.includes('parent_card') && profilePage.includes('peer_challenge'), 'profile keeps legacy share intent ids while copy is framed as parent recap and peer revisit paths');
  assert.ok(profileWxml.includes('growth-main-cta') && profileWxml.includes('growth-report-actions') && profileWxml.includes('growth-parent-bottom-actions'), 'profile exposes clear growth-report input, preview, and action-card next actions without the retired share panel');
  assert.ok(profilePage.includes('share_code') && profilePage.includes('evidence_done') && profilePage.includes('identity_tag'), 'profile lead/share payload carries evidence context');
  assert.ok(leadApi.includes('evidence_done') && leadApi.includes('identity_tag') && leadApi.includes('share_code'), 'lead endpoint accepts learning evidence fields');
  assert.ok(reviewPage.includes('lastWrongCard'), 'review page routes just-missed card back to tutor');
  assert.ok(tutorPage.includes('coach_step'), 'tutor consumes structured coach step');
  assert.ok(tutorPage.includes('QUICK_ACTIONS'), 'tutor has mastery quick actions');
  assert.ok(tutorWxml.includes('tutor-socratic-panel') && tutorWxml.includes('tutor-mode-grid'), 'tutor renders the focused Socratic prompt workspace');
  assert.ok(tutorWxml.includes('tutor-mode-grid') && tutorWxml.includes('tutor-start-cta') && tutorWxml.includes('launchFirstStep') && !tutorWxml.includes('tutor-action-row'), 'tutor exposes reference quick entries plus a focused first-step CTA without duplicate bottom CTA');
  assert.ok(tutorWxml.includes('tutor-feedback-row') && tutorWxml.includes('recordSocraticEffectivenessFeedback'), 'tutor exposes real Socratic feedback actions after a prompt');
  assert.ok(radarPage.includes('buildParentReport') && radarPage.includes('buildWeeklyGrowthMemory'), 'profile replaces retired radar with parent weekly evidence');
  assert.ok(radarPage.includes('saveLocalFeedback'), 'profile records family feedback locally');
  assert.ok(
    !radarWxml.includes('yd-parent-task-head')
    && radarWxml.includes('growth-choice-grid')
    && radarWxml.includes('growth-questionnaire-panel')
    && radarWxml.includes('growth-upload-panel')
    && radarWxml.includes('growth-report-preview')
    && radarWxml.includes('growth-parent-action-card')
    && !radarWxml.includes('yd-parent-loop-card')
    && !radarWxml.includes('growth-signal-grid')
    && !radarWxml.includes('growth-next-row')
    && radarWxml.includes('startGrowthQuestionnaire')
    && radarWxml.includes('data-action="upload" bindtap="runParentReportAction"')
    && radarWxml.includes('data-action="tutor" bindtap="runParentReportAction"')
    && radarWxml.includes('data-action="review" bindtap="runParentReportAction"')
    && radarWxml.includes('completeParentActionCard'),
    'profile exposes Growth Report evidence, questionnaire/upload input, and next execution controls without repeating the removed instruction block'
  );

  console.log('All miniapp production hardening checks pass.');
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
