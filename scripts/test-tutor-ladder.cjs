#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadCommonJsMiniappModule(relativePath, sandboxPatch = {}) {
  const file = path.join(__dirname, '..', relativePath);
  const code = fs.readFileSync(file, 'utf8');
  const sandbox = Object.assign({
    module: { exports: {} },
    exports: {},
    require,
    console,
    Date,
    Math,
    Number,
    String,
    RegExp,
    Array,
    Object
  }, sandboxPatch);
  vm.runInNewContext(code, sandbox, { filename: file });
  return sandbox.module.exports;
}

const storageMap = {};
global.wx = {
  getStorageSync(key) {
    return storageMap[key];
  },
  setStorageSync(key, value) {
    storageMap[key] = value;
  },
  removeStorageSync(key) {
    delete storageMap[key];
  }
};

const ladder = loadCommonJsMiniappModule('miniprogram/utils/tutor-ladder.js');
const storage = loadCommonJsMiniappModule('miniprogram/utils/storage.js', {
  wx: global.wx,
  require(request) {
    if (request === './learning-priority') return {};
    return require(request);
  }
});

assert.strictEqual(ladder.HINT_LADDER.length, 5, 'hint ladder has five levels');

[
  '直接告诉我答案',
  '求答案',
  '不想写过程',
  '拍照出答案',
  '直接给结果'
].forEach((text) => {
  const result = ladder.buildTutorReply(text);
  assert.strictEqual(result.mastery_signal.status, 'blocked_answer_request', `blocks answer request: ${text}`);
  assert(result.answer_boundary_evidence, 'blocked answer request carries answer-boundary evidence');
  assert.strictEqual(result.answer_boundary_evidence.eventType, 'answer_request_blocked', 'answer-boundary evidence names the blocked event');
  assert(result.answer_boundary_evidence.reviewSeed && result.answer_boundary_evidence.reviewSeed.source === 'tutor_answer_boundary', 'blocked answer request becomes a review seed');
  assert(result.answer_boundary_evidence.reportSeed && result.answer_boundary_evidence.reportSeed.evidenceRequired.includes('next_day_revisit'), 'blocked answer request carries report and revisit evidence');
  assert(result.answer_boundary_evidence.releaseGate.aiMustNotDecide.includes('final_answer'), 'answer-boundary evidence keeps final answer under local guard');
  assert(result.reply.includes('我不能直接替你写答案'), 'blocked reply keeps no-answer boundary');
  assert(result.reply.includes('第 1 步'), 'blocked reply still shows the current Socratic step');
  assert(!/最终答案是|答案是|结果是/.test(result.reply), 'blocked reply does not leak direct answer wording');
});

const nextStep = ladder.buildTutorReply('我不会下一步怎么写', { currentHintLevel: 1 });
assert(nextStep.hint_level === 2 || nextStep.hint_level === 3, 'next-step stuck input enters level 2 or 3');
assert(nextStep.reply.includes('第一步'), 'next-step stuck input asks for first step');
assert(/^第 \d 步：/.test(nextStep.reply), 'local tutor reply starts with an explicit step label');

const repeated = ladder.buildTutorReply('我还是不会', {
  currentHintLevel: 2,
  messages: [
    { role: 'user', text: '我不会下一步怎么写' },
    { role: 'assistant', text: '提示 2/5：你觉得第一步应该做什么？' },
    { role: 'user', text: '还是卡住了' }
  ],
  selected: { text: '分数应用题' }
});
assert(repeated.hint_level >= 4, 'three stuck turns lower the threshold to level 4');
assert(repeated.reply.includes('A') && repeated.reply.includes('B') && repeated.reply.includes('相似例子'), 'repeated stuck reply gives two-choice low-threshold prompt');
assert(repeated.socratic_fallback_plan && repeated.socratic_fallback_plan.mode === 'low_threshold', 'repeated stuck state exposes a low-threshold Socratic fallback plan');
assert(repeated.socratic_fallback_plan.microChoices.length === 2, 'Socratic fallback gives two micro choices');
assert(repeated.socratic_fallback_plan.parentScript.includes('A') || repeated.socratic_fallback_plan.parentScript.includes('B'), 'Socratic fallback gives a parent-safe A/B script');
assert(repeated.runtime_socratic_state && repeated.runtime_socratic_state.branch === 'parent_handoff', 'repeated stuck state drives the actual runtime reply into parent handoff');
assert(repeated.runtime_socratic_state.childFriendlyLine.includes('A') && repeated.runtime_socratic_state.childFriendlyLine.includes('B'), 'runtime handoff uses child-friendly A/B wording');
assert(repeated.reply.includes('先停在这里') && repeated.reply.includes('小黑板只画'), 'runtime reply stops repeated prompting and shows only the blackboard entry move');
assert(repeated.visual_socratic_recovery && repeated.visual_socratic_recovery.boardLayers.length === 3, 'repeated stuck state exposes a visual Socratic recovery board');
assert(repeated.visual_socratic_recovery.failureBranches.length === 3, 'visual Socratic recovery has three failure branches');
assert(repeated.visual_socratic_recovery.parentHandoff.shareBoundary.includes('原题照片'), 'visual Socratic recovery keeps privacy-safe share boundary');

const rounds = ladder.simulateThreeRoundSocratic([
  '我不会下一步怎么写',
  '还是卡住了',
  '直接告诉我答案'
], { selected: { text: '应用题' } });
assert.strictEqual(rounds.length, 3, 'three-round simulation returns three turns');
assert(rounds.every((item) => item.noFinalAnswer), 'three-round simulation never produces final answer phrasing');
assert(rounds.every((item) => item.asksForStudentStep), 'three-round simulation keeps asking for the learner first step');
assert(rounds.every((item) => /^第 \d 步：/.test(item.reply)), 'three-round simulation shows current step each round');
assert(ladder.nextTutorTurnState('我不会下一步怎么写', [], 1, { text: '应用题' }).roundIndex >= 1, 'nextTutorTurnState exposes a round index');
assert(ladder.nextTutorTurnState('还是卡住了', [
  { role: 'user', text: '我不会下一步怎么写' },
  { role: 'assistant', text: '提示 2/5：你觉得第一步应该做什么？' },
  { role: 'user', text: '还是卡住了' }
], 2, { text: '应用题' }).shouldHandoff, 'nextTutorTurnState enters parent handoff after repeated stuck turns');

const mathPrompt = ladder.buildTutorReply('应用题不会列式', {
  selected: { text: '分数应用题' }
});
assert.strictEqual(mathPrompt.task_type, 'math_word_problem', 'math word problem is detected');
assert(
  mathPrompt.first_prompt.includes('已知条件')
    || mathPrompt.first_prompt.includes('题干')
    || mathPrompt.first_prompt.includes('对应')
    || mathPrompt.first_prompt.includes('全书'),
  'math prompt starts with known conditions or a sample-specific first-step relation'
);

const paraphrasePressure = ladder.inferHomeworkPressureSignal('孩子总把分率和剩余页数对应关系混在一起，只知道还剩 24 页，不知道第一步。', 'math_word_problem');
assert.strictEqual(paraphrasePressure.id, 'g5_math_fraction_share', 'paraphrased wrong-cause text maps back to the specific public homework pressure sample');
assert.strictEqual(paraphrasePressure.source, 'real_homework_pressure_approximate_match', 'paraphrased homework pressure uses approximate local matching instead of generic fallback');
assert(paraphrasePressure.matchConfidence >= 0.52 && paraphrasePressure.matchEvidence.length > 0, 'approximate pressure match exposes confidence and evidence tokens');
const paraphraseTutor = ladder.buildTutorReply('剩余页数和全书分率对应不上，不知道从哪一步开始', {
  selected: { text: '数学应用题 全书页数' }
});
assert.strictEqual(paraphraseTutor.real_homework_pressure_signal.id, 'g5_math_fraction_share', 'Socratic tutor uses approximate pressure match in runtime reply');
assert(paraphraseTutor.real_homework_pressure_signal.parentCheck.includes('24') || paraphraseTutor.real_homework_pressure_signal.firstStep.includes('24'), 'approximate match keeps sample-specific first-step evidence');

const englishPrompt = ladder.buildTutorReply('英语阅读题看不懂', {
  selected: { text: '英语阅读' }
});
assert.strictEqual(englishPrompt.task_type, 'reading_question', 'english reading gets reading_question type');
assert(englishPrompt.first_prompt.includes('细节') || englishPrompt.first_prompt.includes('主旨') || englishPrompt.first_prompt.includes('原因'), 'reading prompt keeps question-type orientation');

[
  ['物理电路图不会画', 'physics_diagram', '研究对象'],
  ['化学实验为什么有沉淀', 'chemistry_experiment', '反应前后'],
  ['生物过程顺序记不住', 'biology_process', '结构'],
  ['地理地图题看不懂图例', 'geography_map', '方向']
].forEach(([text, taskType, promptTerm]) => {
  const result = ladder.buildTutorReply(text, { selected: { text } });
  assert.strictEqual(result.task_type, taskType, `${taskType} is detected`);
  assert(
    result.first_prompt.includes(promptTerm)
      || (result.real_homework_pressure_signal && /^real_homework_pressure_/.test(result.real_homework_pressure_signal.source || '') && result.real_homework_pressure_signal.firstStep),
    `${taskType} keeps subject-specific or sample-specific first prompt`
  );
  assert(result.socratic_contract.noFinalAnswer, `${taskType} keeps no-answer contract`);
  assert(result.question_type_socratic_path && result.question_type_socratic_path.probeBank.length >= 5, `${taskType} exposes a large question-type Socratic probe bank`);
  assert(result.question_type_socratic_path.visualMoves.length >= 3, `${taskType} exposes visual first-step moves`);
  assert(result.question_type_socratic_path.fallbackLadder.length >= 3, `${taskType} exposes failure fallback ladder`);
  assert(result.question_bank_visual_board_bridge && result.question_bank_visual_board_bridge.boardLayers.length === 3, `${taskType} exposes a layered first-step blackboard bridge`);
  assert(result.question_bank_visual_board_bridge.failureBranches.length >= 3 && result.question_bank_visual_board_bridge.exitCriteria.length >= 3, `${taskType} exposes visual board fallback branches and exit criteria`);
  assert(result.question_bank_visual_board_bridge.noFullAnswerBoundary.includes('完整答案'), `${taskType} keeps the visual board no-answer boundary`);
});

const focus = storage.saveTodayFocusFromThought('我不知道下一步怎么写', {
  source: 'tutor_ladder_test'
});
assert(focus && focus.issueType, 'todayFocus still records issue type while tutor ladder exists');
const blocked = storage.updateTodayFocusRepair({ repairStatus: 'completed' });
assert.strictEqual(blocked.repairStatus, 'in_progress', 'todayFocus mini-action gate still blocks direct completion');
const confirmedFirstStep = storage.saveChildArticulatedStep('先写清谁是未知数，再找等量关系。', {
  tutorCompleted: true,
  firstStepQuality: 'actionable',
  firstStepSource: 'child_articulated'
});
const firstStepNextDaySeed = storage.loadReviewCards().find((card) => card.source === 'tutor_first_step' && card.sourceFocusId === confirmedFirstStep.id);
assert(firstStepNextDaySeed, 'child first step immediately creates a next-day review seed');
assert(firstStepNextDaySeed.dueDate && firstStepNextDaySeed.recallEvidence && firstStepNextDaySeed.recallEvidence.next_day_revisit_locked, 'first-step seed carries due date and XP evidence gate');
assert(firstStepNextDaySeed.recallEvidence.student_first_step && firstStepNextDaySeed.recallEvidence.wrong_cause_named, 'first-step seed carries first-step and wrong-cause evidence');

assert(nextStep.diagnostic_probe && nextStep.allowed_moves && nextStep.allowed_moves.includes('ask_student_first_step'), 'tutor reply exposes diagnostic probe and allowed moves');
assert(nextStep.question_type_socratic_path && nextStep.question_type_socratic_path.evidenceContractLine.includes('证据合同'), 'tutor reply exposes question-type Socratic path evidence contract');
assert(nextStep.question_bank_visual_board_bridge && nextStep.question_bank_visual_board_bridge.evidenceRequired.includes('question_type_visual_board'), 'tutor reply exposes question-bank visual board evidence');
assert(nextStep.socratic_contract && nextStep.socratic_contract.noFinalAnswer && nextStep.socratic_contract.stopRule.includes('第一步'), 'tutor reply exposes a no-answer Socratic contract with a stop rule');
assert(nextStep.socratic_fallback_plan && nextStep.socratic_fallback_plan.evidenceRequired.includes('child_micro_choice'), 'tutor reply exposes fallback evidence requirements');
assert(nextStep.visual_socratic_recovery && nextStep.visual_socratic_recovery.evidenceRequired.includes('no_full_answer_boundary'), 'tutor reply exposes visual recovery evidence requirements');
assert(nextStep.fallback_recovery_bridge && nextStep.fallback_recovery_bridge.recoverySequence.length === 4, 'tutor reply exposes fallback recovery bridge sequence');
assert(nextStep.fallback_recovery_bridge.reportLine.includes('小黑板') && nextStep.fallback_recovery_bridge.evidenceRequired.includes('exit_criteria'), 'fallback recovery bridge links blackboard, report, and exit evidence');
assert(nextStep.socratic_quality_evaluation_suite && nextStep.socratic_quality_evaluation_suite.totalScenarioCount >= 40, 'tutor reply exposes a full Socratic quality evaluation suite');
assert(nextStep.socratic_quality_evaluation_suite.gates.includes('不输出完整答案') && nextStep.socratic_quality_evaluation_suite.activeCase.scenarios.length === 4, 'quality suite checks no-answer gate and four stuck scenarios');
assert(nextStep.socratic_turn_quality_scorecard && nextStep.socratic_turn_quality_scorecard.score >= 88, 'tutor reply carries a scored Socratic turn quality card');
assert(nextStep.socratic_turn_quality_scorecard.checks.firstStepOnly && nextStep.socratic_turn_quality_scorecard.checks.noEarlyAnswer, 'Socratic scorecard checks first-step-only and no-early-answer quality');
const badTurnQuality = ladder.evaluateSocraticTurnQuality({
  reply: '完整答案是 42，直接写结果。',
  real_homework_pressure_signal: {}
}, { taskType: 'math_word_problem' });
assert.strictEqual(badTurnQuality.status, 'fail_to_mini_lesson_or_parent_handoff', 'Socratic scorecard fails full-answer style prompts');
assert(badTurnQuality.failed.includes('firstStepOnly') && badTurnQuality.nextAction === 'replace_with_local_first_step_prompt', 'Socratic scorecard gives a concrete recovery action');
assert(nextStep.socratic_prompt_quality_judge && nextStep.socratic_prompt_quality_judge.effectivePrompts.length === 4, 'tutor reply exposes effective Socratic prompt quality rules');
assert(nextStep.socratic_prompt_quality_judge.misleadingPrompts.length === 4 && nextStep.socratic_prompt_quality_judge.stopConditions.length === 4, 'prompt quality judge blocks misleading prompts and defines stop conditions');
assert(nextStep.socratic_prompt_quality_judge.parentDecisionRules.length === 4 && nextStep.socratic_prompt_quality_judge.evidenceRequired.includes('safe_share_boundary'), 'prompt quality judge has parent decision rules and safe share evidence');
assert(nextStep.three_round_socratic_protocol && nextStep.three_round_socratic_protocol.rounds.length === 3, 'tutor reply exposes a three-round Socratic coaching protocol');
assert(nextStep.three_round_socratic_protocol.fallbackBranches.length === 4 && nextStep.three_round_socratic_protocol.evidenceRequired.includes('safe_share_boundary'), 'three-round protocol covers stuck branches and safe share evidence');
assert(nextStep.three_round_socratic_protocol.parentLine.includes('三轮') && nextStep.three_round_socratic_protocol.shareBoundary.includes('完整答案'), 'three-round protocol has parent handoff and no-full-answer share boundary');
assert(repeated.allowed_moves.includes('similar_example'), 'deep stuck state allows a similar-example move');
assert(nextStep.runtime_socratic_state && nextStep.runtime_socratic_state.status === 'normal_step_probe', 'normal tutor reply exposes runtime Socratic state');
assert(nextStep.runtime_socratic_state.releaseRule.includes('不'), 'runtime Socratic state carries a no-final-answer release rule');
const answerBoundaryPlan = ladder.buildSocraticFallbackPlan('math_word_problem', { level: 1 }, nextStep.diagnostic_probe, { answerBlocked: true });
assert.strictEqual(answerBoundaryPlan.mode, 'answer_boundary', 'direct answer requests get an answer-boundary fallback plan');
assert(answerBoundaryPlan.stopRule.includes('不继续讲完整答案'), 'fallback plan keeps the no-full-answer stop rule');
const visualRecovery = ladder.buildVisualSocraticRecoveryProtocol('math_word_problem', { level: 4 }, nextStep.diagnostic_probe, answerBoundaryPlan, { answerBlocked: true });
assert.strictEqual(visualRecovery.recoveryMode, 'answer_boundary_board', 'visual recovery has an answer-boundary board mode');
assert(visualRecovery.exitCriteria.length >= 3 && visualRecovery.evidenceRequired.includes('next_day_revisit'), 'visual recovery has exit criteria and next-day evidence');
const fallbackBridge = ladder.buildFallbackRecoveryBridge('math_word_problem', { level: 4 }, nextStep.diagnostic_probe, answerBoundaryPlan, visualRecovery, { answerBlocked: true });
assert(fallbackBridge.parentDecisionLine && fallbackBridge.shareBoundary.includes('完整对话'), 'fallback recovery bridge keeps parent decision and privacy-safe sharing');
assert.strictEqual(mathPrompt.diagnostic_probe.axis, 'known_conditions', 'math prompt tracks the current diagnostic axis');
assert(mathPrompt.diagnostic_probe.misconception && mathPrompt.diagnostic_probe.evidenceNeeded, 'diagnostic probe names likely misconception and required evidence');
assert(mathPrompt.socratic_contract.nextQuestion.includes('已知条件'), 'Socratic contract gives a subject-specific next question');
const mathPath = ladder.buildQuestionTypeSocraticPath('math_word_problem', { level: 2 }, mathPrompt.diagnostic_probe);
assert(mathPath.probeBank.length >= 5 && mathPath.visualMoves.length >= 3 && mathPath.fallbackLadder.length >= 3, 'question-type Socratic path has probe bank, visual moves, and fallback ladder');
const qualitySuite = ladder.buildSocraticQualityEvaluationSuite('math_word_problem');
assert(qualitySuite.cases.length >= 10 && qualitySuite.totalScenarioCount >= 40, 'quality suite covers every task type with four scenarios');
assert(qualitySuite.activeCase.taskType === 'math_word_problem' && qualitySuite.activeCase.scenarios.some((item) => item.id === 'answer_request'), 'quality suite focuses active task type and includes answer-boundary scenario');
assert(qualitySuite.shareBoundary.includes('原题照片') && qualitySuite.reportLine.includes('质量门槛'), 'quality suite keeps privacy boundary and reportable quality gate');
const promptJudge = ladder.buildSocraticPromptQualityJudge('math_word_problem', qualitySuite, mathPath);
assert(promptJudge.status === 'ready' && promptJudge.effectivePrompts.length === 4, 'prompt judge is ready and names effective prompts');
assert(promptJudge.misleadingPrompts.some((item) => item.id === 'full_answer') && promptJudge.stopConditions.some((item) => item.id === 'transfer_fail'), 'prompt judge catches full-answer and transfer-fail cases');
assert(promptJudge.parentDecisionRules.length === 4 && promptJudge.shareBoundary.includes('原题'), 'prompt judge turns prompt quality into parent decisions and safe relay');
const threeRoundProtocol = ladder.buildThreeRoundSocraticProtocol('math_word_problem', { level: 3 }, mathPrompt.diagnostic_probe, answerBoundaryPlan, visualRecovery, qualitySuite);
assert(threeRoundProtocol.status === 'ready' && threeRoundProtocol.roundCount === 3, 'three-round protocol is ready with exactly three rounds');
assert(threeRoundProtocol.rounds[0].passEvidence && threeRoundProtocol.rounds[1].passEvidence === 'child_micro_choice_with_wrong_cause' && threeRoundProtocol.rounds[2].passEvidence === 'next_day_revisit', 'three-round protocol preserves round evidence');
assert(threeRoundProtocol.fallbackBranches.some((item) => item.id === 'answer_request') && threeRoundProtocol.exitCriteria.length === 3, 'three-round protocol covers answer requests and exit criteria');
const aiLocalContract = ladder.buildSocraticAiLocalBoundaryContract('math_word_problem', mathPrompt.real_homework_pressure_signal || {});
assert(aiLocalContract.localDeterministic === true, 'AI/local boundary contract is deterministic and local-rule owned');
assert(aiLocalContract.localOwns.includes('task_type_axis') && aiLocalContract.localOwns.includes('report_release_gate') && aiLocalContract.localOwns.includes('share_privacy_fields'), 'local rules own axis, report gate, and share privacy fields');
assert(aiLocalContract.aiMayRewrite.includes('child_friendly_prompt_wording') && aiLocalContract.aiMayRewrite.includes('parent_readable_explanation'), 'AI is limited to wording and parent-readable explanation');
assert(aiLocalContract.aiMustNotDecide.includes('final_answer') && aiLocalContract.aiMustNotDecide.includes('reward_release') && aiLocalContract.aiMustNotDecide.includes('mastery_claim'), 'AI must not decide answer, rewards, or mastery claims');
assert(aiLocalContract.runtimeDecisionRows.length >= 5 && aiLocalContract.fallbackLine.includes('AI 不可用'), 'AI/local boundary contract has runtime rows and offline fallback');
assert(nextStep.socratic_ai_local_boundary_contract && nextStep.socratic_ai_local_boundary_contract.evidenceRequired.includes('safe_share_boundary'), 'tutor reply carries the AI/local boundary contract and safe-share evidence');
const acceptedAiRewrite = ladder.guardAiTutorReply({
  reply: '先别急着算。第一步只圈已知条件和题目真正问什么，然后你说一句入口关系。'
}, aiLocalContract, {
  userText: '应用题不会列式',
  currentHintLevel: 2,
  selected: { text: '分数应用题' }
});
assert.strictEqual(acceptedAiRewrite.ai_guard.status, 'accepted_ai_rewrite', 'safe AI wording rewrite is accepted');
assert(acceptedAiRewrite.reply.includes('第一步') && acceptedAiRewrite.mastery_signal, 'accepted AI rewrite keeps local mastery signal and first-step prompt');
const blockedAiAnswer = ladder.guardAiTutorReply({
  reply: '答案是 42，完整解法如下，可以发到家长群，孩子已经完全掌握。'
}, aiLocalContract, {
  userText: '应用题不会列式',
  currentHintLevel: 2,
  selected: { text: '分数应用题' }
});
assert.strictEqual(blockedAiAnswer.ai_guard.status, 'replaced_with_local_socratic_reply', 'unsafe AI answer is replaced by local Socratic reply');
assert(blockedAiAnswer.ai_guard.reasons.includes('unsafe_answer_or_private_claim'), 'unsafe AI answer records the guard reason');
assert(!/答案是 42|发到家长群|完全掌握/.test(blockedAiAnswer.reply), 'guarded AI answer does not leak answer, share, or mastery claim');
assert(blockedAiAnswer.reply.includes('第一步') || blockedAiAnswer.reply.includes('已知条件'), 'guarded AI answer falls back to a first-step prompt');
const guardedWithPressureSignal = ladder.guardAiTutorReply({
  reply: '第一步先圈条件，再说题目真正问什么。'
}, aiLocalContract, {
  userText: '应用题不会列式',
  currentHintLevel: 2,
  selected: { text: '分数应用题' },
  pressureSignal: mathPrompt.real_homework_pressure_signal
});
assert(guardedWithPressureSignal.real_homework_pressure_signal && guardedWithPressureSignal.real_homework_pressure_signal.firstStep, 'guarded AI reply keeps the real pressure signal from the page runtime');
assert(guardedWithPressureSignal.runtime_socratic_state && guardedWithPressureSignal.runtime_socratic_state.childFriendlyLine, 'guarded AI reply keeps local runtime Socratic state');
const recordedBoundary = storage.recordAnswerBoundaryEvidence(blockedAiAnswer.answer_boundary_evidence || ladder.buildAnswerBoundaryEvidence('直接告诉我答案', mathPrompt.real_homework_pressure_signal || {}, { taskType: 'math_word_problem' }), {
  selected_id: 'test_homework',
  selected_text: '应用题卡住'
});
assert(recordedBoundary && recordedBoundary.card && recordedBoundary.event, 'answer-boundary evidence records a review card and event');
assert(storage.loadReviewCards().some((card) => card.source === 'tutor_answer_boundary'), 'answer-boundary evidence creates a tutor-sourced review card');
assert(storage.loadReviewEvents().some((event) => event.type === 'answer_boundary_review_seeded'), 'answer-boundary evidence creates a review event');
assert(storage.loadSyncQueue().some((item) => item.type === 'answer_boundary_evidence'), 'answer-boundary evidence queues sync mutation');
assert(ladder.MISCONCEPTION_MAP.math_word_problem.known_conditions.includes('条件'), 'tutor ladder has a subject-specific misconception map');
assert(ladder.MISCONCEPTION_MAP.physics_diagram.diagram_first.includes('第一根'), 'tutor ladder has a physics visual misconception map');
const blackboardBlueprint = storage.buildFirstStepBlackboardBlueprint({
  taskType: 'physics_diagram',
  subject: 'physics',
  sourceText: '物理电路图不会画',
  firstStep: '先定研究对象'
});
assert(blackboardBlueprint && blackboardBlueprint.layers.length >= 3, 'first-step blackboard blueprint has three layers');
assert(blackboardBlueprint.openingQuestion.includes('第一步'), 'first-step blackboard blueprint keeps the first-step opening question');
assert(blackboardBlueprint.stopRule.includes('第一步'), 'first-step blackboard blueprint keeps the stop rule');
const assessment = storage.buildSocraticAssessmentMatrix({ taskType: 'physics_diagram', subject: 'physics', sourceText: '物理电路图不会画' });
assert(assessment.questionTypeRubric.length >= 3 && assessment.visualExplanationSteps.length >= 3 && assessment.fallbackLadder.length >= 3, 'storage Socratic assessment carries question rubric, visual steps, and fallback ladder');
assert(assessment.evidenceContractLine.includes('next_day_revisit') && assessment.parentCheckLine.includes('家长'), 'storage Socratic assessment carries evidence and parent contracts');

const miniLessonPass = storage.recordMiniLessonExitGate({
  status: 'passed',
  childExitTicketText: '先圈研究对象，再看方向',
  firstStep: '先圈研究对象',
  parentCheck: '你研究的是哪一个物体？',
  nextDayReview: '明天换图仍先圈研究对象。',
  topicCardId: 'physics_force_object',
  blockedFields: ['original_question', 'full_answer', 'full_dialogue', 'score', 'ranking', 'talent_label']
}, { source: 'unit_test_mini_lesson_exit' });
assert.strictEqual(miniLessonPass.status, 'passed', 'mini-lesson exit gate passes only with child-authored first-step ticket');
const miniLessonPassCard = storage.loadReviewCards().find((card) => card.id === miniLessonPass.card.id);
assert.strictEqual(miniLessonPassCard.status, 'exit_gate_passed', 'mini-lesson return card records passed exit gate');
assert.strictEqual(miniLessonPassCard.recallEvidence.child_authored_evidence, true, 'passed exit gate writes child-authored evidence');
assert(miniLessonPass.nextRoute.includes('/pages/review/review'), 'passed exit gate routes back to review');

const miniLessonFail = storage.recordMiniLessonExitGate({
  status: 'passed',
  childExitTicketText: '不会，直接告诉我答案',
  firstStep: '先圈研究对象',
  parentCheck: '你研究的是哪一个物体？',
  nextDayReview: '明天换图仍先圈研究对象。',
  topicCardId: 'physics_force_object'
}, { source: 'unit_test_mini_lesson_exit_fail' });
assert.strictEqual(miniLessonFail.status, 'needs_support', 'answer-seeking exit ticket fails the mini-lesson exit gate');
assert(miniLessonFail.parentAssistCard && miniLessonFail.parentAssistCard.parentCheck, 'failed exit gate creates parent assist card');
assert(miniLessonFail.parentAssistCard.blockedFields.includes('original_question') && miniLessonFail.parentAssistCard.blockedFields.includes('full_answer') && miniLessonFail.parentAssistCard.blockedFields.includes('full_dialogue'), 'parent assist card blocks original question, full answer, and full dialogue');
assert(storage.loadReviewEvents().some((event) => event.event === 'parent_handoff_required'), 'failed exit gate records parent handoff event');

const tutorPageJs = fs.readFileSync(path.join(__dirname, '..', 'miniprogram/pages/tutor/tutor.js'), 'utf8');
const tutorPageWxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram/pages/tutor/tutor.wxml'), 'utf8');
assert(tutorPageJs.includes('tutorReadableAiLocalRows') && tutorPageJs.includes('tutorReadableWorkbenchRows') && tutorPageJs.includes('tutorReadableEventRows') && tutorPageJs.includes('tutorEvidenceThreadLine'), 'tutor page converts internal AI/local, workbench, event, and evidence fields into readable lines');
assert(tutorPageWxml.includes('tutor-flow-card') && tutorPageWxml.includes('tutor-ladder') && tutorPageWxml.includes('tutor-entry-card'), 'tutor launch shell renders readable compact flow cards instead of the retired long receipt');
assert(!tutorPageWxml.includes('runtimeDecisionRows') && !tutorPageWxml.includes('{{item.localGate}}') && !tutorPageWxml.includes('thinkingReceipt.evidenceThread.topicCardId') && !tutorPageWxml.includes('thinkingReceipt.evidenceThread.day7Gate'), 'tutor launch shell does not expose raw runtime rows, local gates, topic card ids, or day-7 gate fields');
assert(tutorPageWxml.includes('tutor-primary') && tutorPageWxml.includes('tutor-secondary'), 'tutor launch shell exposes clear Socratic next actions');
assert(tutorPageWxml.includes('data-scene="tutor"') && tutorPageWxml.includes('data-scene="review"'), 'tutor launch shell uses safe scene routes for child-flow actions');
assert(tutorPageJs.includes('recordSocraticEffectivenessFeedback') && tutorPageJs.includes("event: 'socratic_effectiveness_feedback'"), 'tutor page records Socratic effectiveness feedback events');
assert(tutorPageJs.includes('createdAt') && tutorPageJs.includes('turnId') && tutorPageJs.includes('fallbackId') && tutorPageJs.includes('blockedFields'), 'Socratic feedback event keeps the required safe fields');
assert(tutorPageJs.includes('buildSocraticFeedbackAdjustment') && tutorPageJs.includes('nextHintLevel') && tutorPageJs.includes('shouldUseTwoChoice'), 'Socratic feedback adjusts the next tutor turn instead of only logging');
assert(tutorPageJs.includes('Math.max(1, currentLevel - 1)'), 'first-step-spoken feedback lowers the next hint level instead of escalating scaffolding');
assert(tutorPageJs.includes('socratic_effectiveness_review_seed') && tutorPageJs.includes('appendReviewEvent'), 'Socratic feedback creates a review seed for report and next-day revisit');
assert(tutorPageJs.includes('tutor_socratic_effectiveness_feedback') && tutorPageJs.includes('recordUnifiedNextAction') && tutorPageJs.includes('recordSurfaceDepthAction'), 'Socratic feedback writes into unified next action and surface depth ledgers');
assert(tutorPageWxml.includes('tutor-action-row'), 'tutor launch shell shows the next action row');
assert(tutorPageJs.includes('buildMiniLessonFeedbackBridge') && tutorPageJs.includes('socratic_feedback_mini_lesson_triggered') && tutorPageJs.includes('ensureMiniLessonReturnReviewCard'), 'still-blocked Socratic feedback can trigger a bounded mini-lesson return card');
assert(tutorPageJs.includes('socratic_feedback_mini_lesson_bridge') && tutorPageJs.includes('socratic_to_mini_lesson_bridge'), 'mini-lesson feedback bridge writes unified action and surface depth evidence');
assert(tutorPageWxml.includes('tutor-subcheck') && tutorPageWxml.includes('subcheck-side'), 'tutor launch shell exposes compact bridge choices after stuck feedback');
assert(tutorPageJs.includes('socratic_feedback_parent_handoff_required') && tutorPageJs.includes("type: 'parent_handoff_required'"), 'tutor feedback records parent handoff when mini-lesson route is blocked by router');
assert(tutorPageWxml.includes('data-scene="parent"') && tutorPageWxml.includes('data-scene="review"'), 'tutor launch shell labels parent handoff and review as distinct child flows');
const feedbackEventBuilder = tutorPageJs.match(/function buildSocraticEffectivenessEvent[\s\S]+?function normalizeTags/);
assert(feedbackEventBuilder, 'tutor page has a dedicated Socratic feedback event builder');
assert(!/selected_text|selected\.text|full_answer_text|original_question_text|reply|messages|input/.test(feedbackEventBuilder[0]), 'Socratic feedback event builder does not persist original question, full answer, or dialogue text');
assert(nextStep.socratic_quality_release_audit && nextStep.socratic_quality_release_audit.releaseGates.length === 6, 'tutor reply exposes a six-gate Socratic release audit');
assert(nextStep.socratic_quality_release_audit.status === 'release_ready' && nextStep.socratic_quality_release_audit.failedGateIds.length === 0, 'release audit passes safe local Socratic turns');
assert(nextStep.socratic_quality_release_audit.evidenceRequired.includes('safe_share_boundary') && nextStep.socratic_quality_release_audit.reportLine.includes('长期掌握'), 'release audit connects safe sharing and report limits');
assert(nextStep.socratic_quality_release_audit && tutorPageWxml.includes('tutor-flow-card'), 'tutor keeps Socratic release audit in logic while rendering the compact tutor flow shell');
const blockedReleaseAudit = ladder.buildSocraticQualityReleaseAudit({
  taskType: 'math_word_problem',
  scorecard: badTurnQuality,
  promptJudge,
  threeRoundProtocol: { roundCount: 0 },
  aiLocalBoundaryContract: { aiMustNotDecide: [] },
  pressureSignal: {}
});
assert.strictEqual(blockedReleaseAudit.status, 'route_to_mini_lesson_or_parent', 'release audit blocks weak Socratic turns');
assert(blockedReleaseAudit.failedGateIds.includes('first_step_only') && blockedReleaseAudit.failedGateIds.includes('fallback_ready'), 'release audit names concrete failed gates');

console.log('All tutor ladder tests pass.');
