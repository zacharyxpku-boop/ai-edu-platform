#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadCommonJsMiniappModule(relativePath, requireMap = {}) {
  const file = path.join(__dirname, '..', relativePath);
  const code = fs.readFileSync(file, 'utf8');
  const sandbox = {
    module: { exports: {} },
    exports: {},
    require(request) {
      if (Object.prototype.hasOwnProperty.call(requireMap, request)) return requireMap[request];
      if (request.startsWith('./') || request.startsWith('../')) return {};
      return require(request);
    },
    console,
    wx: global.wx,
    Date,
    Math,
    Number,
    String,
    RegExp,
    Array,
    Object
  };
  vm.runInNewContext(code, sandbox, { filename: file });
  return sandbox.module.exports;
}

const planModule = loadCommonJsMiniappModule('miniprogram/utils/openmaic-inspired-plan.js');
const storageState = {};
global.wx = {
  getStorageSync(key) {
    return storageState[key];
  },
  setStorageSync(key, value) {
    storageState[key] = value;
  },
  removeStorageSync(key) {
    delete storageState[key];
  }
};
const storageModule = loadCommonJsMiniappModule('miniprogram/utils/storage.js');

const plan = planModule.buildOpenMaicInspiredTaskPlan({
  taskType: 'physics_diagram',
  pressureSignal: {
    taskType: 'physics_diagram',
    firstStep: '先圈研究对象，再标方向和决定量。',
    wrongCause: '只看现象，没有先定决定量。',
    parentCheck: '你先比较哪一个量？方向和单位定了吗？',
    reviewMove: '明天换图，仍先复述对象、方向和决定量。'
  }
});
const audit = planModule.evaluateOpenMaicInspiredTaskPlan(plan);
const miniLesson = plan.miniLesson;
const miniLessonAudit = planModule.evaluateThreeMinuteMiniLesson(miniLesson);
const forcedMiniLesson = planModule.buildThreeMinuteMiniLesson({
  taskType: 'math_word_problem',
  subject: '数学',
  sourceText: '我连续两轮还是不会，能不能直接给答案',
  firstStep: '先圈题目问什么，再设未知量。',
  wrongCause: '急着套公式，没有先找等量关系。',
  parentCheck: '你先说未知量是谁，不用算完整题。',
  revisit: '明天换数字，只复述等量关系。',
  userTurnCount: 2,
  stillBlockedCount: 1,
  hintLevel: 4,
  hasChildFirstStep: false,
  answerRisk: true
});
const forcedMiniLessonAudit = planModule.evaluateThreeMinuteMiniLesson(forcedMiniLesson);
const oneVagueTurnMiniLesson = planModule.buildThreeMinuteMiniLesson({
  taskType: 'math_word_problem',
  subject: '数学',
  sourceText: '我不会，没思路',
  firstStep: '先圈题目问什么，再找等量关系。',
  wrongCause: '还没把题目问什么说清楚。',
  parentCheck: '你先说这题问什么，不用算答案。',
  revisit: '明天换一题只复述题目目标。',
  userTurnCount: 1,
  stillBlockedCount: 1,
  hintLevel: 2,
  hasChildFirstStep: false,
  answerRisk: false
});
const firstAnswerRiskMiniLesson = planModule.buildThreeMinuteMiniLesson({
  taskType: 'math_word_problem',
  subject: 'math',
  sourceText: '孩子第一轮就说想看答案，但还没有经历追问和修复。',
  firstStep: '先圈题目问什么，再找等量关系。',
  wrongCause: '还没把题目目标说清楚。',
  parentCheck: '先问这题问什么，不看最终答案。',
  revisit: '明天换一题仍先说题目目标。',
  userTurnCount: 1,
  stillBlockedCount: 0,
  hintLevel: 1,
  hasChildFirstStep: false,
  answerRisk: true
});
const quietMiniLesson = planModule.buildThreeMinuteMiniLesson({
  taskType: 'english_sentence_structure',
  subject: 'english',
  sourceText: '孩子已经能说出主语和动作，只需要继续苏格拉底追问',
  firstStep: '先圈主语和动作',
  wrongCause: '只翻译单词，没有看句子骨架',
  parentCheck: '先问谁在做、做了什么',
  revisit: '明天换一句只圈主语和动作',
  userTurnCount: 1,
  stillBlockedCount: 0,
  hintLevel: 1,
  hasChildFirstStep: true,
  answerRisk: false
});
const parentHandoffMiniLesson = planModule.buildThreeMinuteMiniLesson({
  taskType: 'math_word_problem',
  subject: 'math',
  sourceText: '连续三轮仍说不出第一步，家长需要接住今晚',
  firstStep: '先圈题目问什么',
  wrongCause: '没有找到题目目标',
  parentCheck: '今晚只问题目问什么',
  revisit: '明天只复查题目目标',
  userTurnCount: 4,
  stillBlockedCount: 3,
  hintLevel: 4,
  hasChildFirstStep: false,
  exitGateStatus: 'needs_support'
});
const exitPassedMiniLesson = planModule.buildThreeMinuteMiniLesson({
  taskType: 'physics_diagram',
  subject: 'physics',
  sourceText: '孩子已经写出第一步退出票据',
  firstStep: '先圈研究对象',
  wrongCause: '研究对象不清',
  parentCheck: '你研究的是哪个物体',
  revisit: '明天换图仍先圈研究对象',
  childExitTicketText: '我先圈研究对象，再看方向',
  exitGateStatus: 'passed',
  hasChildFirstStep: true
});
const decisionBridge = planModule.buildOpenMaicInspiredDecisionBridge(plan, {
  familyDecisionHomepageHeadline: '\u4eca\u665a\u5148\u505a\u7b2c\u4e00\u6b65\u56de\u5fc6',
  familyDecisionHomepageNextLocalAction: '\u5148\u8bf4\u7814\u7a76\u5bf9\u8c61\u548c\u65b9\u5411',
  familyDecisionHomepageShareBoundary: '\u4e0d\u5206\u4eab\u539f\u9898\u3001\u5b8c\u6574\u7b54\u6848\u3001\u6392\u540d'
}, {
  nextStep: '\u660e\u5929\u6362\u56fe\u56de\u8bbf'
}, {
  summary: '\u5b8c\u6210\u7b2c\u4e00\u6b65\u548c\u56de\u8bbf\u540e\u518d\u7ed9\u5956\u52b1'
});

assert.strictEqual(plan.sourcePolicy.decision, 'reference_workflow_only', 'OpenMAIC is used as workflow reference only');
assert.strictEqual(plan.sourcePolicy.license, 'AGPL-3.0', 'OpenMAIC license signal is explicit');
assert(plan.sourcePolicy.forbiddenUses.includes('copy_openmaic_code'), 'plan forbids copying OpenMAIC code');
assert(plan.sourcePolicy.forbiddenUses.includes('ship_agpl_server_as_closed_backend'), 'plan forbids closed backend AGPL deployment');
assert.strictEqual(plan.outline.stage, 'outline_generation', 'stage 1 is an outline task plan');
assert(plan.scenes.length >= 6, 'stage 2 has enough miniapp scenes');
assert(plan.scenes.some((item) => item.id === 'first_step_blackboard'), 'plan keeps a first-step blackboard scene');
assert(plan.scenes.some((item) => item.id === 'parent_receipt'), 'plan includes parent receipt');
assert(plan.scenes.some((item) => item.id === 'safe_share'), 'plan includes safe share scene');
assert.strictEqual(plan.eventFlow.length, plan.scenes.length, 'event flow covers every scene');
assert(plan.eventFlow.every((item) => item.localGate), 'every event has a local evidence gate');
assert(plan.localAiBoundary.localCodeOwns.includes('reward_release'), 'local code owns rewards');
assert(plan.localAiBoundary.localCodeOwns.includes('share_privacy_fields'), 'local code owns share privacy fields');
assert(plan.localAiBoundary.aiBetterFor.includes('child_friendly_socratic_wording'), 'AI is limited to Socratic wording');
assert(plan.localAiBoundary.aiMustNotDecide.includes('final_answer'), 'AI cannot decide final answer');
assert(plan.localAiBoundary.aiMustNotDecide.includes('talent_label'), 'AI cannot decide talent label');
assert(plan.publicK12ResourceDecisions.some((item) => item.id === 'official_curriculum_standards'), 'public curriculum standards are treated as source metadata');
assert(plan.publicK12ResourceDecisions.some((item) => item.id === 'family_uploaded_material'), 'family uploads are private report material only');
assert(plan.shareBoundary.includes('不分享原题') && plan.shareBoundary.includes('完整答案'), 'share boundary blocks raw questions and answers');
assert(plan.publicK12ResourceDecisions.every((item) => item.directUse && item.directUse.length && item.localCodeOwns && item.localCodeOwns.length && item.aiBetterFor && item.aiBetterFor.length && item.mustNotUse && item.mustNotUse.length), 'every public K12 resource decision has direct-use, local-code, AI, and blocked-use lanes');
assert.strictEqual(audit.ok, true, 'OpenMAIC-inspired task plan passes deterministic audit');
assert(audit.gateCount >= 6 && audit.sceneCount >= 6 && audit.eventCount >= 6, 'audit reports gates, scenes, and events');
assert.strictEqual(decisionBridge.id, 'openmaic_inspired_decision_bridge', 'OpenMAIC-inspired module builds a lightweight decision bridge');
assert(decisionBridge.reportDecisionCard.length >= 4, 'decision bridge gives report/profile flows a compact decision card');
assert(decisionBridge.shareRelayPayload.blockedFields.includes('original_question'), 'decision bridge keeps share relay safe');
assert(decisionBridge.gameReturnEvidence.blockedFields.includes('final_answer'), 'decision bridge blocks answer leakage in game return evidence');
assert(decisionBridge.localAiBoundary.localCodeOwns.includes('share_privacy_fields'), 'decision bridge preserves local-code share ownership');
assert(decisionBridge.miniLessonReport && decisionBridge.miniLessonReport.exitGate, 'decision bridge exposes mini-lesson report card');
assert(decisionBridge.miniLessonReport.topicLabel && decisionBridge.miniLessonReport.topicLocalGate, 'decision bridge exposes topic-level mini-lesson evidence');
assert(decisionBridge.miniLessonReport.teacherSchoolBridge && decisionBridge.miniLessonReport.topicPractice, 'decision bridge carries teacher bridge and topic practice');
assert(plan.evidenceThread && plan.evidenceThread.topicCardId && plan.evidenceThread.releaseGates.includes('day7_variant_first_step_evidence'), 'task plan carries a stable evidence thread across modules');
assert(decisionBridge.evidenceThread && decisionBridge.miniLessonReport.evidenceThread && decisionBridge.gameReturnEvidence.evidenceThread && decisionBridge.shareRelayPayload.evidenceThread, 'decision bridge propagates evidence thread into report, game, and share payloads');
assert(decisionBridge.evidenceThread.aiMustNotOwn.includes('final_answer') && decisionBridge.evidenceThread.blockedFields.includes('talent_label'), 'evidence thread keeps AI/local ownership and privacy fields explicit');
assert(Array.isArray(decisionBridge.miniLessonReport.activeRecallRevisitLadder) && decisionBridge.miniLessonReport.activeRecallRevisitLadder.length === 3, 'mini-lesson report carries tonight/tomorrow/day-7 active recall ladder');
assert(Array.isArray(decisionBridge.miniLessonReport.blackboardFrames) && decisionBridge.miniLessonReport.blackboardFrames.length === 3, 'mini-lesson report carries renderable board frames');
assert(decisionBridge.homeSchoolMiniLessonPacket.blackboardFrames && decisionBridge.gameReturnEvidence.blackboardFrames, 'board frames flow into home-school packet and game return evidence');
assert(decisionBridge.sourceUseDecision && decisionBridge.sourceUseDecision.decision === 'structure_only_clean_room_rewrite', 'decision bridge carries clean-room source use decision');
assert(decisionBridge.sourceUseDecision.blockedUses.includes('copy_openmaic_code'), 'source use decision forbids copying OpenMAIC code');
assert(decisionBridge.sourceUseDecision.blockedUses.includes('copy_public_source_text'), 'source use decision forbids copying public source text');
assert(decisionBridge.sourceUseDecision.blockedUses.includes('full_answer'), 'source use decision blocks full-answer release');
assert(decisionBridge.sourceUseDecision.blockedUses.includes('talent_label') && decisionBridge.sourceUseDecision.blockedUses.includes('ranking'), 'source use decision blocks talent labels and ranking');
assert(decisionBridge.sourceUseDecision.localCodeOwns.includes('exit_gate') && decisionBridge.sourceUseDecision.localCodeOwns.includes('share_fields'), 'local code owns exit gate and share fields');
assert(decisionBridge.miniLessonReport.sourceUseDecision && decisionBridge.gameReturnEvidence.sourceUseDecision && decisionBridge.shareRelayPayload.sourceUseDecision, 'source use decision flows into report, game return, and share relay');
assert(decisionBridge.homeSchoolMiniLessonPacket && decisionBridge.homeSchoolMiniLessonPacket.blockedFields.includes('talent_label'), 'home-school mini-lesson packet blocks talent labels');
['original_question', 'full_answer', 'full_dialogue', 'score', 'ranking', 'talent_label'].forEach((field) => {
  assert(decisionBridge.homeSchoolMiniLessonPacket.blockedFields.includes(field), `home-school mini-lesson packet blocks ${field}`);
});
['child_name', 'parent_phone', 'parent_wechat', 'contact_info'].forEach((field) => {
  assert(decisionBridge.homeSchoolMiniLessonPacket.blockedFields.includes(field), `home-school mini-lesson packet blocks identity/contact field ${field}`);
  assert(decisionBridge.gameReturnEvidence.blockedFields.includes(field), `game return evidence blocks identity/contact field ${field}`);
  assert(decisionBridge.shareRelayPayload.blockedFields.includes(field), `share relay payload blocks identity/contact field ${field}`);
});
assert(decisionBridge.homeSchoolMiniLessonPacket.topicLocalGate, 'home-school packet carries local topic gate instead of raw answer');
assert(decisionBridge.gameReturnEvidence.activeRecallRevisitLadder[0].rewardPolicy.includes('最终答案'), 'game return ladder does not reward final answers');
assert(miniLesson, 'task plan exposes a bounded 3-minute mini-lesson');
assert.strictEqual(miniLesson.id, 'three_minute_mini_lesson', 'mini-lesson has a distinct bounded id');
assert.strictEqual(miniLesson.positioning.includes('不是 AI 课堂平台'), true, 'mini-lesson positioning prevents classroom drift');
assert.strictEqual(miniLesson.blackboard.noFullSolution, true, 'mini-lesson blackboard blocks full solution');
assert(Array.isArray(miniLesson.blackboard.layers) && miniLesson.blackboard.layers.length >= 3, 'mini-lesson blackboard has layered first-step drawing');
assert(Array.isArray(miniLesson.blackboard.frames) && miniLesson.blackboard.frames.length === 3, 'mini-lesson blackboard has renderable board frames');
assert(miniLesson.blackboard.frames.every((frame) => frame.draw && frame.say && frame.evidence && frame.localGate), 'mini-lesson board frames carry draw/say/evidence/local gate');
assert(miniLesson.blackboard.renderPrompt.includes('按帧画'), 'mini-lesson blackboard exposes a render prompt');
assert(miniLesson.blackboard.frames.every((frame) => frame.primitiveId && frame.primitiveLabel && frame.primitiveClass && frame.renderInstruction), 'mini-lesson board frames carry primitive render metadata');
assert(miniLesson.executionContract && miniLesson.executionContract.positioning.includes('苏格拉底') && miniLesson.executionContract.localCodeOwns.includes('portrait_release_gate'), 'mini-lesson has an execution contract that keeps release gates in local code');
assert(miniLesson.executionContract.aiMustNotDecide.includes('portrait_update') && miniLesson.executionContract.visualSchema.noFullSolution === true, 'mini-lesson execution contract blocks AI portrait updates and full-solution boards');
assert(Array.isArray(miniLesson.recoveryBranches) && miniLesson.recoveryBranches.length >= 4, 'mini-lesson carries stuck-state recovery branches');
assert(miniLesson.recoveryBranches.some((item) => item.id === 'asks_for_answer' && item.requiredEvidence === miniLesson.topicCard.localGate), 'answer-request branch falls back to first-step evidence instead of final answer');
assert(miniLesson.roles.some((item) => item.id === 'misconception_classmate'), 'mini-lesson includes misconception classmate role');
assert(miniLesson.misconception && miniLesson.checkQuestion && miniLesson.parentLine, 'mini-lesson carries misconception, check question, and parent line');
assert(planModule.MINI_LESSON_TOPIC_CARDS.length >= 35, 'mini-lesson has five high-frequency topic cards per subject');
const miniLessonSubjects = ['math', 'physics', 'chemistry', 'english', 'chinese', 'biology', 'geography'];
miniLessonSubjects.forEach((subject) => {
  const cardsForSubject = planModule.MINI_LESSON_TOPIC_CARDS.filter((item) => item.subject === subject);
  assert(cardsForSubject.length >= 5, `mini-lesson subject ${subject} has at least five topic cards`);
  assert(new Set(cardsForSubject.map((item) => item.clusterId)).size >= 2, `mini-lesson subject ${subject} spans at least two clusters`);
});
assert(new Set(planModule.MINI_LESSON_TOPIC_CARDS.map((item) => item.clusterId)).size >= 3, 'mini-lesson topic cards cover visual, symbol, and process clusters');
assert(planModule.MINI_LESSON_TOPIC_CARDS.every((item) => item.clusterId && item.distractorType && Array.isArray(item.exitEvidence) && item.exitEvidence.includes('next_day_revisit_card')), 'mini-lesson topic cards carry cluster, distractor, and exit evidence');
assert(miniLesson.topicCard && miniLesson.topicCard.localGate, 'mini-lesson selects a topic-level card with local gate');
assert(miniLesson.topicCard.clusterId && miniLesson.topicCard.distractorType && miniLesson.topicTrack.clusterId === miniLesson.topicCard.clusterId, 'selected mini-lesson card exposes its cluster into the topic track');
assert(miniLesson.topicPractice && miniLesson.topicPractice.rewardPolicy.includes('not_speed_or_final_answer'), 'topic practice rewards evidence, not speed or final answer');
assert(miniLesson.teacherSchoolBridge && miniLesson.teacherSchoolBridge.blockedClaims.includes('天赋定论'), 'teacher bridge blocks talent conclusions from one lesson');
assert(Array.isArray(miniLesson.minutePlan) && miniLesson.minutePlan.length === 3, 'mini-lesson is capped to three minute actions');
assert(miniLesson.nearTransfer && miniLesson.nearTransfer.gate.includes('最终答案'), 'mini-lesson near transfer blocks final-answer checks');
assert(miniLesson.exitGate.passEvidence.includes('child_can_say_first_step'), 'mini-lesson exit requires child first-step evidence');
assert(miniLesson.localAiBoundary.localCodeOwns.includes('trigger'), 'local code owns mini-lesson trigger');
assert(miniLesson.localAiBoundary.localCodeOwns.includes('exit_gate'), 'local code owns mini-lesson exit gate');
assert(miniLesson.localAiBoundary.aiMustNotDecide.includes('final_answer'), 'AI cannot decide final answer in mini-lesson');
assert(miniLesson.localAiBoundary.aiMustNotDecide.includes('talent_label'), 'AI cannot decide talent label in mini-lesson');
assert.strictEqual(miniLessonAudit.ok, true, 'default mini-lesson passes deterministic audit');
assert.strictEqual(forcedMiniLesson.trigger.mode, 'mini_lesson', 'repeated stuck / answer risk triggers mini-lesson');
assert.strictEqual(forcedMiniLesson.trigger.blockedMode, 'full_ai_classroom', 'mini-lesson explicitly blocks full classroom mode');
assert.strictEqual(forcedMiniLessonAudit.ok, true, 'forced mini-lesson passes deterministic audit');
assert.strictEqual(oneVagueTurnMiniLesson.trigger.shouldTrigger, false, 'one vague stuck turn stays in Socratic mode instead of jumping to mini-lesson');
assert.strictEqual(oneVagueTurnMiniLesson.trigger.mode, 'socratic_first', 'single vague turn preserves Socratic-first positioning');
assert.strictEqual(firstAnswerRiskMiniLesson.trigger.shouldTrigger, false, 'first answer-risk turn still gets Socratic recovery before mini-lesson');
assert.strictEqual(firstAnswerRiskMiniLesson.trigger.triggerEvidence.answerRiskAfterRecovery, false, 'answer-risk requires recovery attempts before triggering mini-lesson');
assert.strictEqual(quietMiniLesson.trigger.mode, 'socratic_first', 'mini-lesson stays off when the child already has a first step');
assert.strictEqual(quietMiniLesson.trigger.shouldTrigger, false, 'mini-lesson does not trigger during normal Socratic progress');
assert.strictEqual(forcedMiniLesson.modeRouter.nextMode, 'three_minute_mini_lesson', 'private tutor router routes repeated stuck work into mini-lesson');
assert.strictEqual(quietMiniLesson.modeRouter.nextMode, 'socratic_private_tutor', 'private tutor router keeps normal progress in Socratic mode');
assert.strictEqual(parentHandoffMiniLesson.modeRouter.nextMode, 'parent_handoff', 'private tutor router downgrades persistent stuck state to parent handoff');
assert.strictEqual(exitPassedMiniLesson.modeRouter.nextMode, 'game_recall', 'private tutor router unlocks game recall only after child exit evidence');
assert.strictEqual(forcedMiniLesson.renderGate.canRender, true, 'mini-lesson panel renders only when router releases three-minute mini-lesson mode');
assert.strictEqual(parentHandoffMiniLesson.renderGate.canRender, false, 'parent handoff route must not still render the mini-lesson panel');
assert.strictEqual(exitPassedMiniLesson.renderGate.canRender, false, 'game recall route must not still render the mini-lesson panel');
assert.strictEqual(forcedMiniLesson.modeRouter.childSelectableMode, false, 'child cannot choose a broad classroom mode');
assert(forcedMiniLesson.modeRouter.blockedModes.includes('free_classroom_mode_picker') && forcedMiniLesson.modeRouter.blockedModes.includes('full_ai_classroom'), 'router blocks classroom picker and full AI classroom drift');
assert(forcedMiniLesson.modeRouter.localCodeOwns.includes('mode_route') && forcedMiniLesson.modeRouter.aiMustNotOwn.includes('mode_release'), 'local code owns mode release while AI only helps wording');
assert(planModule.MINI_LESSON_VISUAL_TEMPLATES.length >= 7, 'mini-lesson has seven-subject visual templates');
assert(planModule.MINI_LESSON_VISUAL_TEMPLATES.every((item) => Array.isArray(item.visualPrimitives) && item.visualPrimitives.length >= 3), 'every subject visual template carries subject-specific drawing primitives');
assert(miniLesson.executionContract.visualSchema.primitives.every((item) => !['circle_target', 'mark_known', 'draw_relation_or_direction'].includes(item)), 'mini-lesson uses subject-specific primitives instead of only generic board moves');
const primitiveIds = new Set(planModule.MINI_LESSON_VISUAL_PRIMITIVE_RENDER_CONTRACT.map((item) => item.id));
const templatePrimitiveIds = planModule.MINI_LESSON_VISUAL_TEMPLATES.flatMap((item) => item.visualPrimitives || []);
assert(templatePrimitiveIds.every((id) => primitiveIds.has(id)), 'every visual primitive has a local render contract');
assert(planModule.MINI_LESSON_VISUAL_PRIMITIVE_RENDER_CONTRACT.every((item) => item.owner === 'local_code' && item.aiAllowed === 'rewrite_short_hint_only'), 'primitive rendering stays owned by local code');
assert(planModule.MINI_LESSON_VISUAL_PRIMITIVE_RENDER_CONTRACT.every((item) => Array.isArray(item.allowedSurfaces) && item.allowedSurfaces.includes('tutor_mini_lesson')), 'primitive contracts declare allowed child-facing surface');
assert(planModule.MINI_LESSON_VISUAL_PRIMITIVE_RENDER_CONTRACT.every((item) => item.blockedFields.includes('full_answer') && item.blockedFields.includes('talent_label')), 'primitive contracts block answer and talent-label leakage');
assert(planModule.MINI_LESSON_VISUAL_PRIMITIVE_RENDER_CONTRACT.every((item) => item.blockedFields.includes('child_name') && item.blockedFields.includes('parent_phone')), 'primitive contracts block child identity and parent contact leakage');
assert(miniLesson.executionContract.visualSchema.renderContractReady, 'mini-lesson execution contract proves primitive render contract is complete');
assert(miniLesson.blackboard.primitiveRenderContract.length === miniLesson.executionContract.visualSchema.primitives.length, 'blackboard carries the render contract needed by WXML');

const tutorJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram/pages/tutor/tutor.js'), 'utf8');
const tutorWxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram/pages/tutor/tutor.wxml'), 'utf8');
assert(tutorJs.includes("require('../../utils/openmaic-inspired-plan')"), 'tutor page imports OpenMAIC-inspired plan');
assert(tutorJs.includes('openMaicInspiredTaskPlan') && tutorJs.includes('openMaicInspiredTaskPlanAudit'), 'tutor receipt carries plan and audit');
assert(tutorJs.includes('sourceText: latestUserText') && tutorJs.includes('subject: selected && selected.subject'), 'OpenMAIC-inspired task plan receives runtime subject and source text');
assert(tutorJs.includes("appendValidationEvent('openmaic_inspired_task_plan_ready'"), 'tutor records OpenMAIC-inspired task plan readiness into validation events');
assert(tutorJs.includes("source: 'openmaic_inspired_task_plan'") && tutorJs.includes("capabilityId: 'openmaic_inspired_homework_loop'"), 'tutor records OpenMAIC-inspired plan into unified next-action flow');
assert(tutorJs.includes('openMaicInspiredTaskPlan') && tutorWxml.includes('tutor-flow-card') && tutorWxml.includes('tutor-ladder'), 'tutor keeps miniapp task-plan logic while exposing a compact child-facing flow shell');

assert(tutorJs.includes('miniLesson') && tutorJs.includes('evaluateThreeMinuteMiniLesson'), 'tutor receipt carries mini-lesson and audit');
assert(tutorJs.includes('buildEvidenceThread') && tutorJs.includes('evidenceThread'), 'tutor receipt carries the same evidence thread as mini-lesson state');
assert(tutorJs.includes('runtimePressureSignal') && tutorJs.includes('real_homework_pressure_signal: pressureSignal'), 'tutor receipt prioritizes the runtime pressure signal from Socratic tutor');
assert(tutorJs.includes('result && result.real_homework_pressure_signal') && tutorJs.includes('recentUserMessages = userMessages.slice(-3)'), 'mini-lesson trigger uses runtime pressure signal and recent first-step evidence window');
assert(!tutorJs.includes('stillBlockedCount: blockedAnswer ? Math.max(2, recentStuckCount) : recentStuckCount'), 'tutor page must not inflate answer-risk into repeated stuck evidence');
assert(!tutorJs.includes('forceMiniLesson: blockedAnswer ||'), 'tutor page must not bypass Socratic recovery on first answer-risk turn');
assert(tutorJs.includes('miniLesson') && tutorJs.includes('renderGate') && tutorWxml.includes('tutor-entry-grid'), 'tutor keeps mini-lesson render-gate logic behind compact first-screen action cards');
assert(tutorJs.includes('conceptGap') && tutorJs.includes('blackboard') && tutorWxml.includes('tutor-entry-card'), 'tutor keeps mini-lesson concept and board logic while rendering focused child-flow cards');
assert(tutorJs.includes('miniLessonActiveFrameIndex') && tutorWxml.includes('tutor-action-row'), 'mini-lesson frame state remains executable while the tab shows one focused next action');
assert(tutorJs.includes('miniLessonActiveFrameIndex') && tutorJs.includes('setMiniLessonActiveFrame') && tutorJs.includes('advanceMiniLessonFrame') && tutorJs.includes('replayMiniLessonFrame'), 'mini-lesson frame navigation is executable in local code');
assert(tutorWxml.includes('tutor-hero-shell') && tutorWxml.includes('tutor-entry-grid'), 'tutor UI has a focused child-facing compact panel');
assert(tutorWxml.includes('tutor-ladder') && tutorWxml.includes('tutor-action-row'), 'tutor compact panel shows first-step and handoff choices without dumping the long mini-lesson panel');
assert(tutorJs.includes('recordMiniLessonExitGate') && tutorWxml.includes('openEntryDetail'), 'mini-lesson exit-gate logic remains executable and the compact UI routes through child-flow actions');
assert(tutorJs.includes("'passed'") && tutorJs.includes("'needs_support'") && tutorWxml.includes('data-scene="review"'), 'mini-lesson exit gate keeps passed and needs-support outcomes while review is a child flow');
assert(tutorJs.includes('tutor_mini_lesson_exit_gate') && tutorJs.includes('miniLessonExitGateStatus'), 'tutor writes mini-lesson exit-gate evidence back into local state');
assert(tutorJs.includes('continueMiniLessonExitGateAction') && tutorJs.includes('miniLessonExitGateAction') && tutorJs.includes('miniLessonParentAssistCard'), 'tutor exposes an executable exit-gate next action and parent assist card');
assert(tutorJs.includes('navigation.navigateLearningRoute(route)'), 'tutor exit-gate next action uses the local route navigator');
assert(tutorJs.includes('childExitTicketText') && tutorJs.includes('passedWithChildTicket'), 'tutor exit gate requires child-authored exit-ticket text before pass');
assert(tutorJs.includes("exitGateRecord.status === 'passed'"), 'tutor exit gate visible verdict comes from the storage record status');
assert(!tutorJs.includes("miniLessonExitGateStatus: passedWithChildTicket"), 'tutor exit gate UI must not show pass directly from button plus text');
assert(tutorJs.includes('childExitTicketText') && tutorJs.includes('passedWithChildTicket') && tutorWxml.includes('tutor-action-row'), 'mini-lesson exit gate keeps explicit child-authored ticket logic while the tab shows compact next actions');
assert(tutorJs.includes('miniLessonParentAssistCard') && tutorJs.includes('continueMiniLessonExitGateAction') && tutorWxml.includes('data-scene="parent"'), 'tutor keeps parent assist details in logic and routes parent handoff through compact UI');
assert(planModule.MINI_LESSON_VISUAL_PRIMITIVE_RENDER_CONTRACT.length >= 3 && tutorWxml.includes('tutor-entry-card'), 'tutor keeps primitive render contracts in logic while tab renders focused cards');
assert(!tutorJs.includes("this.data.messages.filter((item) => item && item.role === 'user')\n      : [];\n    const childExitTicketText"), 'mini-lesson exit gate must not mine old chat messages as exit-ticket proof');
assert(miniLesson.executionContract && Array.isArray(miniLesson.recoveryBranches) && tutorWxml.includes('tutor-entry-grid'), 'mini-lesson local release gates and recovery branches stay in logic behind compact UI');
const profileJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram/pages/profile/profile.js'), 'utf8');
const profileWxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram/pages/profile/profile.wxml'), 'utf8');
assert(profileJs.includes('openMaicMiniLessonReport') && profileJs.includes('openMaicHomeSchoolMiniLessonPacket'), 'profile summary carries mini-lesson report and home-school packet');
assert(profileJs.includes('openMaicMiniLessonReport') && profileWxml.includes('parent-dash-evidence'), 'profile keeps mini-lesson family decision evidence behind the new parent evidence panel');
assert(profileJs.includes('openMaicMiniLessonTopicLabel') && profileWxml.includes('parent-report-preview'), 'profile keeps topic-card evidence behind the new report preview');
assert(profileJs.includes('openMaicMiniLessonActiveRecallLadder') && profileWxml.includes('parent-dash-route'), 'profile keeps active-recall ladder in logic and shows the compact parent route');

assert(tutorJs.includes('renderGate.canRender') && tutorWxml.includes('tutor-hero-shell'), 'tutor keeps render-gate logic while rendering the compact hero shell');
assert(tutorJs.includes('diagnosticReceipt.miniLesson.renderGate') && tutorJs.includes('diagnosticReceipt.miniLesson.renderGate.canRender'), 'tutor only writes mini-lesson review seeds after the same render gate');
assert(tutorJs.includes('buildUploadReportSelectedHomework') && tutorJs.includes("storage.get('upload.report.handoff.v1'"), 'tutor consumes upload report handoff as selected homework');
assert(tutorJs.includes('three_minute_mini_lesson_review_seed') && tutorJs.includes("source: 'three_minute_mini_lesson'"), 'triggered mini-lesson writes review seed and unified next action');
assert(tutorJs.includes('ensureMiniLessonReturnReviewCard'), 'triggered mini-lesson creates an executable next-day review card');
const uploadJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram/pages/upload/upload.js'), 'utf8');
const storageJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram/utils/storage.js'), 'utf8');
const arcadeJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram/pages/arcade/arcade.js'), 'utf8');
const reviewJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram/pages/review/review.js'), 'utf8');
const reviewWxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram/pages/review/review.wxml'), 'utf8');
assert(uploadJs.includes('persistReportCtaToReportState') && uploadJs.includes('openMaicInspiredDecisionBridge') && uploadJs.includes('flowTraceId'), 'upload persists mini-lesson decision bridge back into report state');
assert(storageJs.includes('ensureMiniLessonReturnReviewCard') && storageJs.includes("type: 'three_minute_mini_lesson_return'"), 'storage persists mini-lesson return cards into the review queue');
assert(storageJs.includes('recordMiniLessonExitGate') && storageJs.includes("appendSyncMutation('mini_lesson_exit_gate'"), 'storage persists mini-lesson exit-gate evidence as a syncable local event');
assert(storageJs.includes('recordMiniLessonReviewResult') && storageJs.includes("appendSyncMutation('mini_lesson_review_result'"), 'storage writes mini-lesson review results back to the evidence thread');
assert(storageJs.includes('evidence_thread_') && storageJs.includes('topic_card_id'), 'storage persists mini-lesson evidence thread metadata');
assert(arcadeJs.includes('mini_lesson_review_card_id') && arcadeJs.includes('ensureMiniLessonReturnReviewCard'), 'arcade finish writes review-return seed into a concrete review card');
assert(reviewJs.includes('miniLessonReport') && reviewJs.includes('miniLessonCheckQuestion') && reviewJs.includes('miniLessonBlackboardLine'), 'review consumes mini-lesson report from upload handoff');
assert(
  reviewWxml.includes('review-hero-shell')
    && reviewWxml.includes('data-scene="tutor"')
    && reviewWxml.includes('data-scene="review"'),
  'review keeps mini-lesson details behind the current visual jump shell instead of restoring the old blackboard block on the tab page'
);
assert(reviewJs.includes('buildMiniLessonReturnPanel') && reviewJs.includes("current.type !== 'three_minute_mini_lesson_return'"), 'review has a dedicated mini-lesson return-card panel');
assert(
  reviewWxml.includes('review-challenge-grid')
    && reviewWxml.includes('开始挑战')
    && reviewWxml.includes('卡住先问第一步'),
  'review tab keeps a compact return-card handoff instead of the old long standalone return-card panel'
);
assert(storageJs.includes('setActiveMiniLessonResumeContext') && storageJs.includes('loadActiveMiniLessonResumeContext'), 'storage persists active mini-lesson resume context across tab navigation');
assert(fs.readFileSync(path.join(__dirname, '..', 'miniprogram/pages/home/home.js'), 'utf8').includes('setActiveMiniLessonResumeContext'), 'home writes mini-lesson resume context before switching tabs');
assert(reviewJs.includes('loadActiveMiniLessonResumeContext') && reviewJs.includes('context.flowTraceId && card.flowTraceId === context.flowTraceId'), 'review restores the exact mini-lesson return card by active flow trace');
assert(arcadeJs.includes("storage.set('publicK12.reviewContext.v1'") && reviewJs.includes('consumePublicK12ReviewContext'), 'public K12 challenge context survives tab navigation into review');
assert(reviewJs.includes("type: 'public_k12_review_card_created'") && reviewJs.includes("type: 'public_k12_first_step_revisit'"), 'review converts public K12 intake into an executable first-step revisit card');

storageModule.saveReviewCards([]);
storageModule.set(storageModule.KEYS.reviewEvents, []);
const miniLessonCard = storageModule.ensureMiniLessonReturnReviewCard({
  id: 'three_minute_mini_lesson_review_seed',
  flowTraceId: 'flow-test-001',
  firstStep: '先画受力图，再看方向',
  conceptGap: '对象和方向没定清楚',
  blackboardLine: '先定对象，再画方向',
  parentCheck: '家长只问对象和方向',
  nextDayReview: '明天只回访第一步',
  blockedFields: ['full_answer']
}, {
  source: 'test',
  taskType: 'physics'
});
const miniLessonCardAgain = storageModule.ensureMiniLessonReturnReviewCard({
  id: 'three_minute_mini_lesson_review_seed',
  flowTraceId: 'flow-test-001',
  firstStep: '先画受力图，再看方向',
  conceptGap: '对象和方向没定清楚',
  blackboardLine: '先定对象，再画方向',
  parentCheck: '家长只问对象和方向',
  nextDayReview: '明天只回访第一步',
  blockedFields: ['full_answer']
}, {
  source: 'test',
  taskType: 'physics'
});
assert(miniLessonCard && miniLessonCard.id === 'mini_lesson_return_flow-test-001', 'mini-lesson return card gets a stable review-card id');
assert.strictEqual(miniLessonCardAgain.id, miniLessonCard.id, 'mini-lesson return card deduplicates by flow trace');
assert.strictEqual(storageModule.loadReviewCards().filter((card) => card && card.id === miniLessonCard.id).length, 1, 'mini-lesson return card writes exactly one queue entry');
['original_question', 'full_answer', 'full_solution', 'full_dialogue', 'score', 'ranking', 'talent_label'].forEach((field) => {
  assert(miniLessonCard.blockedFields.includes(field), `mini-lesson return card keeps default blocked field ${field}`);
});
assert(miniLessonCard.evidenceThread && miniLessonCard.evidenceThread.releaseGates.includes('next_day_revisit_locked'), 'mini-lesson return card carries cross-module evidence thread');
assert(storageModule.loadReviewEvents().some((event) => event.type === 'three_minute_mini_lesson_review_card_created'), 'mini-lesson return card emits a review event');
const activeResumeContext = storageModule.setActiveMiniLessonResumeContext({
  cardId: miniLessonCard.id,
  flowTraceId: miniLessonCard.flowTraceId,
  evidenceThread: miniLessonCard.evidenceThread,
  topicCardId: miniLessonCard.evidenceThread.topicCardId,
  blockedFields: miniLessonCard.blockedFields
});
assert.strictEqual(activeResumeContext.cardId, miniLessonCard.id, 'active mini-lesson resume context keeps the concrete card id');
assert.strictEqual(storageModule.loadActiveMiniLessonResumeContext().flowTraceId, 'flow-test-001', 'active mini-lesson resume context survives tab switch');
storageModule.clearActiveMiniLessonResumeContext();
assert.strictEqual(storageModule.loadActiveMiniLessonResumeContext(), null, 'active mini-lesson resume context can be cleared after consumption');
const exitGateRecord = storageModule.recordMiniLessonExitGate({
  status: 'passed',
  flowTraceId: 'flow-test-001',
  evidenceThread: miniLessonCard.evidenceThread,
  topicCardId: miniLessonCard.evidenceThread.topicCardId,
  childExitTicketText: '我先画受力图，再看方向',
  firstStepEvidence: '先画受力图，再看方向',
  blockedFields: ['full_answer']
}, {
  source: 'test_exit_gate'
});
assert(exitGateRecord && exitGateRecord.status === 'passed', 'mini-lesson exit gate returns the recorded pass status');
assert(exitGateRecord.event.childAuthoredEvidence === true, 'passed mini-lesson exit gate keeps child-authored evidence flag');
assert(exitGateRecord.nextRoute.includes('mini_lesson_exit_passed'), 'passed mini-lesson exit gate routes into review');
['original_question', 'full_answer', 'full_solution', 'full_dialogue', 'score', 'ranking', 'talent_label'].forEach((field) => {
  assert(exitGateRecord.event.blockedFields.includes(field), `mini-lesson exit gate keeps default blocked field ${field}`);
});
assert(storageModule.loadReviewEvents().some((event) => event.type === 'mini_lesson_exit_gate_recorded' && event.status === 'passed'), 'mini-lesson exit gate emits a review event');
assert(storageModule.loadReviewCards().some((card) => card.id === miniLessonCard.id && card.recallEvidence && card.recallEvidence.student_first_step === true), 'mini-lesson exit gate updates the return-card recall evidence');
const noChildTicketCard = storageModule.ensureMiniLessonReturnReviewCard({
  id: 'three_minute_mini_lesson_review_seed_no_child',
  flowTraceId: 'flow-test-no-child',
  firstStep: '系统提示的第一步',
  conceptGap: '没有孩子退出票',
  blockedFields: ['full_answer']
}, {
  source: 'test',
  taskType: 'physics'
});
const noChildTicketRecord = storageModule.recordMiniLessonExitGate({
  status: 'passed',
  flowTraceId: 'flow-test-no-child',
  evidenceThread: noChildTicketCard.evidenceThread,
  topicCardId: noChildTicketCard.evidenceThread.topicCardId,
  firstStepEvidence: '系统提示的第一步',
  blockedFields: ['full_answer']
}, {
  source: 'test_exit_gate'
});
assert(noChildTicketRecord && noChildTicketRecord.status === 'needs_support', 'mini-lesson exit gate downgrades pass without child-authored ticket');
assert(noChildTicketRecord.nextRoute.includes('mini_lesson_exit_needs_support'), 'missing child exit ticket routes back to support');
assert(noChildTicketRecord.parentAssistCard && noChildTicketRecord.parentAssistCard.type === 'parent_handoff_required', 'failed mini-lesson exit gate creates a parent assist card');
assert(noChildTicketRecord.parentAssistCard.parentCheck && noChildTicketRecord.parentAssistCard.stopRule && noChildTicketRecord.parentAssistCard.nextDayReview, 'parent assist card has one question, stop rule, and next-day review');
['original_question', 'full_answer', 'full_solution', 'full_dialogue', 'score', 'ranking', 'talent_label'].forEach((field) => {
  assert(noChildTicketRecord.parentAssistCard.blockedFields.includes(field), `parent assist card keeps blocked field ${field}`);
});
assert(storageModule.loadReviewEvents().some((event) => event.event === 'parent_handoff_required' && event.type === 'parent_handoff_required'), 'failed mini-lesson exit gate emits parent handoff review event');
assert(storageModule.loadSyncQueue().some((item) => item.type === 'parent_handoff_required'), 'failed mini-lesson exit gate queues parent handoff sync mutation');
const vagueExitTicketRecord = storageModule.recordMiniLessonExitGate({
  status: 'passed',
  flowTraceId: 'flow-test-vague-ticket',
  evidenceThread: noChildTicketCard.evidenceThread,
  topicCardId: noChildTicketCard.evidenceThread.topicCardId,
  childExitTicketText: '我会认真做',
  firstStepEvidence: '先圈题目问什么，再找等量关系',
  blockedFields: ['full_answer']
}, {
  source: 'test_vague_exit_gate'
});
assert(vagueExitTicketRecord && vagueExitTicketRecord.status === 'needs_support', 'mini-lesson exit gate rejects vague child exit tickets');
assert(vagueExitTicketRecord.event.exitTicketQuality !== 'actionable' || vagueExitTicketRecord.event.alignedWithFirstStep === false, 'vague exit ticket cannot satisfy quality and first-step alignment together');
const reviewResult = storageModule.recordMiniLessonReviewResult({
  cardId: miniLessonCard.id,
  rating: 'good',
  evidenceThread: miniLessonCard.evidenceThread,
  source: 'test_review_result'
});
assert(reviewResult && reviewResult.passed === true, 'mini-lesson review result records a passed next-day revisit');
assert(reviewResult.card.recallEvidence && reviewResult.card.recallEvidence.next_day_revisit_completed === true, 'mini-lesson review result marks next-day revisit complete');
assert(reviewResult.card.evidenceThread && reviewResult.card.evidenceThread.completedGates.includes('next_day_revisit_completed'), 'mini-lesson review result writes completed gates into the evidence thread');
assert(reviewResult.card.evidenceThread.day7GateStatus === 'pending_day7_variant', 'mini-lesson review result opens the day-7 variant gate');
assert(storageModule.loadReviewEvents().some((event) => event.type === 'mini_lesson_review_result_recorded' && event.rating === 'good'), 'mini-lesson review result emits a review event');
assert(reviewJs.includes('recordMiniLessonReviewResult') && reviewJs.includes("current.type === 'three_minute_mini_lesson_return'"), 'review page writes mini-lesson completion results only for mini-lesson return cards');

console.log('OpenMAIC-inspired plan tests pass.');
