#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const lobster = require('../src/lobster/lobster-core.cjs');

const pair = lobster.createLobsterPair({
  child: {
    displayName: '小龙虾老师',
    gradeBand: 'G5-G8',
    subjectFocus: ['math', 'reading']
  },
  parent: {
    displayName: '家长龙虾顾问',
    gradeBand: 'G5-G8',
    subjectFocus: ['math', 'english']
  }
});

assert.strictEqual(pair.child.audience, 'child', 'child lobster is a child-facing agent');
assert.strictEqual(pair.parent.audience, 'parent', 'parent lobster is a parent-facing agent');
assert(pair.child.tools.includes('socratic_teacher_reply'), 'child lobster has teacher reply capability');
assert(pair.parent.tools.includes('parent_decision_report'), 'parent lobster has report capability');
assert(pair.sharedBoundaries.noFinalAnswerForChild, 'pair keeps child no-final-answer boundary');
assert(pair.openSourceReferenceNotes.some((item) => item.id === 'openclaw'), 'product plan records OpenClaw-style reference');
assert(pair.openSourceReferenceNotes.some((item) => item.id === 'hermes-style-agent'), 'product plan records Hermes-style reference');
assert(pair.openSourceReferenceNotes.some((item) => item.id === 'open-maic-style-classroom'), 'product plan records Open MAIC-style reference');

const configured = lobster.configureLobsterPair({
  child: { tools: ['mini_lesson_bridge', 'parent_decision_report'] },
  parent: { tools: ['weekly_trend_brief', 'socratic_teacher_reply'] }
});
assert(configured.child.tools.includes('mini_lesson_bridge'), 'child lobster can enable child mini lesson bridge');
assert(!configured.child.tools.includes('parent_decision_report'), 'child lobster cannot enable parent-only report tool');
assert(configured.parent.tools.includes('weekly_trend_brief'), 'parent lobster can enable weekly trend brief');
assert(!configured.parent.tools.includes('socratic_teacher_reply'), 'parent lobster cannot enable child-only teacher tool');
assert(configured.warnings.includes('child:parent_decision_report:not_allowed_for_role'), 'invalid child tool emits warning');
assert(configured.warnings.includes('parent:socratic_teacher_reply:not_allowed_for_role'), 'invalid parent tool emits warning');
assert(configured.capabilityDeck.child.some((item) => item.id === 'homework_first_step_coach'), 'child capability deck includes first-step coaching');
assert(configured.capabilityDeck.parent.some((item) => item.id === 'evidence_gap_planner'), 'parent capability deck includes evidence gap planning');

const childReply = lobster.buildChildLobsterReply({
  config: pair.child,
  message: '这道应用题我不会，直接告诉我答案吧',
  taskType: 'math_word_problem',
  selected: { weakPoint: '应用题第一步' }
});

assert.strictEqual(childReply.audience, 'child', 'child reply stays child-facing');
assert(childReply.reply, 'child lobster returns a reply');
assert(childReply.teacherMode.noFinalAnswer, 'child lobster keeps no-final-answer mode');
assert(childReply.capabilitiesUsed.includes('socratic_teacher_reply'), 'child reply records used Socratic capability');
assert(!/答案是\s*42|最终答案|完整解法/.test(childReply.reply), 'child lobster does not leak direct answer language');
assert(childReply.safety.answerBoundaryEvidence, 'answer-seeking child message creates answer-boundary evidence');
assert(childReply.reviewSeed, 'answer-boundary evidence can seed short revisit');
assert.strictEqual(childReply.memoryUpdate.privacy.rawDialogueStored, false, 'child memory summary does not store raw dialogue');
assert(childReply.raw.contract.aiMustNotDecide.includes('final_answer'), 'child AI/local contract blocks final answer decisions');

const parentReport = lobster.buildParentLobsterReport({
  config: pair.parent,
  materialText: [
    '最近三次数学成绩：82、88、84。',
    '英语阅读从 78 到 85，但完形错 4 个。',
    '家长观察：孩子遇到应用题会急，说不知道第一步。'
  ].join('\n'),
  parentObservation: '晚上作业遇到应用题容易急，需要一个今晚能执行的低压动作。'
});

assert.strictEqual(parentReport.audience, 'parent', 'parent report stays parent-facing');
assert.strictEqual(parentReport.materialType, 'score_sheet', 'parent lobster detects score input');
assert(parentReport.summary.oneSentenceDecision, 'parent lobster produces a decision summary');
assert(parentReport.capabilitiesUsed.includes('parent_decision_report'), 'parent report records used parent report capability');
assert(Array.isArray(parentReport.summary.parsedScoreSubjects), 'parent lobster exposes parsed score subjects');
assert(parentReport.report.parentDecisionBook, 'parent lobster returns parent decision book');
assert(parentReport.safety.noGuaranteedImprovement, 'parent lobster blocks guaranteed improvement claims');
assert(parentReport.safety.requiresParentConfirmation, 'parent lobster requires parent confirmation');
assert.strictEqual(parentReport.memoryUpdate.privacy.rawDialogueStored, false, 'parent memory summary does not store raw transcript');
assert(!parentReport.memoryUpdate.facts.some((fact) => /phone|wechat|full_dialogue/i.test(fact.key)), 'parent memory drops unsafe private fields');

const routedChild = lobster.routeLobsterMessage({ role: 'child', message: '我第一步不会写', taskType: 'math_word_problem' });
const routedParent = lobster.routeLobsterMessage({ role: 'parent', message: '数学 82，英语 90，想知道先补什么' });
assert.strictEqual(routedChild.audience, 'child', 'router sends child messages to child lobster');
assert.strictEqual(routedParent.audience, 'parent', 'router sends parent messages to parent lobster');

const productPlan = lobster.buildLobsterProductPlan();
assert(productPlan.phases.some((phase) => phase.id === 'core' && phase.status === 'implemented_here'), 'plan marks this core as implemented');
assert(productPlan.phases.some((phase) => phase.id === 'service-api'), 'plan includes API implementation next phase');

(async () => {
  const unsafeChildModel = await lobster.runLobsterModelAdapter({
    role: 'child',
    message: 'I am stuck. Tell me the answer.',
    taskType: 'math_word_problem'
  }, async () => ({ reply: 'The final answer is 42. Here is the complete solution.' }));
  assert(unsafeChildModel.modelAdapterUsed, 'child model adapter can be used');
  assert.strictEqual(unsafeChildModel.modelGuard.status, 'replaced_with_local_socratic_reply', 'unsafe child model answer is replaced');
  assert(!/final answer is 42|complete solution/i.test(unsafeChildModel.reply), 'guarded child model output strips direct answer');

  const unsafeParentModel = await lobster.runLobsterModelAdapter({
    role: 'parent',
    message: 'Math scores 82, 88, 84. What should we do?'
  }, async () => ({ reply: 'Guaranteed score improvement and top ranking in two weeks.' }));
  assert(unsafeParentModel.modelAdapterUsed, 'parent model adapter can be used');
  assert.strictEqual(unsafeParentModel.modelGuard.status, 'replaced_with_parent_safe_report_line', 'unsafe parent model claim is replaced');
  assert(!/Guaranteed score improvement|top ranking/i.test(unsafeParentModel.reply), 'guarded parent model output strips unsafe claim');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lobster-memory-'));
  const persisted = lobster.persistLobsterMemory('kid-one', childReply.memoryUpdate, { baseDir: tmpDir });
  assert.strictEqual(persisted.ok, true, 'memory persistence succeeds');
  const loaded = lobster.loadLobsterMemory('kid-one', { baseDir: tmpDir });
  assert(loaded.facts.length > 0, 'memory persistence stores safe facts');
  assert.strictEqual(loaded.privacy.rawDialogueStored, false, 'memory persistence does not store raw dialogue');
  assert(!loaded.facts.some((fact) => /full_dialogue|phone|wechat|rank/i.test(fact.key)), 'memory persistence drops unsafe private fact fields');

  const miniLesson = lobster.runLobsterCapability({
    role: 'child',
    capabilityId: 'mini_lesson_bridge',
    message: 'I am stuck and need help.',
    taskType: 'math_word_problem'
  });
  assert.strictEqual(miniLesson.ok, true, 'child mini lesson capability runs');
  assert.strictEqual(miniLesson.capabilityId, 'mini_lesson_bridge', 'child mini lesson returns capability id');
  assert(miniLesson.miniLesson && miniLesson.miniLesson.exitTicket, 'child mini lesson returns exit ticket');

  const weeklyTrend = lobster.runLobsterCapability({
    role: 'parent',
    capabilityId: 'weekly_trend_brief',
    message: 'Math 82, 88, 84. English 78 to 85.',
    scoreRecords: [{ id: 'week1' }, { id: 'week2' }]
  });
  assert.strictEqual(weeklyTrend.ok, true, 'parent weekly trend capability runs');
  assert.strictEqual(weeklyTrend.capabilityId, 'weekly_trend_brief', 'weekly trend returns capability id');
  assert(weeklyTrend.trend && Array.isArray(weeklyTrend.trend.followupQuestions), 'weekly trend returns followup questions');

  const blockedCapability = lobster.runLobsterCapability({
    role: 'child',
    capabilityId: 'parent_decision_report',
    message: 'Try a parent-only tool.'
  });
  assert.strictEqual(blockedCapability.ok, false, 'role-incompatible capability is blocked');
  assert.strictEqual(blockedCapability.error, 'capability_not_enabled', 'blocked capability has stable error');

  console.log('Lobster product core tests pass.');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
