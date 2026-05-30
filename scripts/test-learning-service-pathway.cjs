#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

function loadCommonJs(filePath) {
  const full = path.join(root, filePath);
  const sandbox = {
    module: { exports: {} },
    exports: {},
    require,
    console,
    String,
    Number,
    Array,
    Object,
    Set
  };
  vm.runInNewContext(fs.readFileSync(full, 'utf8'), sandbox, { filename: full });
  return sandbox.module.exports;
}

const pathway = loadCommonJs(path.join('miniprogram', 'utils', 'learning-service-pathway.js'));

const assessmentOnly = pathway.buildLearningServicePathway({
  sourceSchemaId: 'talent_assessment',
  sourceText: '测评报告显示孩子偏视觉学习，听讲容易走神，家长想知道适合什么学习方式。'
});
assert.strictEqual(assessmentOnly.status, 'needs_real_task_validation', 'assessment-only material must require real task validation');
assert(assessmentOnly.modeRecommendations.some((item) => item.id === 'online_method_course'), 'assessment can recommend method-course candidates');
assert(assessmentOnly.productTiers.some((item) => item.id === 'assessment_upgrade'), 'assessment creates an upgrade package tier');
assert(!assessmentOnly.productTiers.some((item) => item.id === 'thirty_day_camp'), 'assessment-only material does not jump straight into 30-day camp');
assert.strictEqual(assessmentOnly.safetyBoundary.releaseGate, 'assessment_requires_real_homework_evidence', 'assessment path keeps a hard evidence gate');
assert(assessmentOnly.safetyBoundary.blocked.includes('天赋定论') && assessmentOnly.safetyBoundary.blocked.includes('结果承诺'), 'assessment path blocks risky claims');
assert(assessmentOnly.safetyBoundary.blocked.includes('固定分数预期') && assessmentOnly.safetyBoundary.blocked.includes('固定成绩提升预期'), 'commercial safety boundary blocks score-improvement guarantees');
assert(assessmentOnly.productTiers.every((tier) => tier.blockedClaims.includes('固定分数预期') && tier.blockedClaims.includes('固定成绩提升预期')), 'every product tier inherits commercial claim blocklist');
assert(assessmentOnly.partnerHandoffPolicy && assessmentOnly.partnerHandoffPolicy.visibleToPartner.includes('service_candidate'), 'partner handoff exposes only service candidate fields');
assert(assessmentOnly.partnerHandoffPolicy.blockedFields.includes('talent_label') && assessmentOnly.partnerHandoffPolicy.blockedFields.includes('full_answer') && assessmentOnly.partnerHandoffPolicy.blockedFields.includes('photo'), 'partner handoff blocks talent labels, answers, and photos');
assert(['child_name', 'parent_phone', 'parent_wechat', 'contact_info'].every((field) => assessmentOnly.partnerHandoffPolicy.blockedFields.includes(field)), 'partner handoff blocks child identity and parent contact fields');
assert(assessmentOnly.partnerServiceDeliveryLedger && assessmentOnly.partnerServiceDeliveryLedger.id === 'partner_service_delivery_ledger', 'service pathway builds a partner service delivery ledger');
assert.strictEqual(assessmentOnly.partnerServiceDeliveryLedger.status, 'pre_sale_needs_real_task_evidence', 'assessment-only partner ledger blocks commercial push before real task evidence');
assert(assessmentOnly.partnerServiceDeliveryLedger.packageCards.length === 3, 'partner service ledger carries three package cards');
assert(assessmentOnly.partnerServiceDeliveryLedger.crmFields.some((item) => item.id === 'talent_label' && item.allowed === false), 'partner service ledger blocks talent labels from CRM fields');
assert(assessmentOnly.partnerServiceDeliveryLedger.revenueLoop.map((item) => item.id).join('|') === 'lead|diagnose|execute|convert|renew', 'partner service ledger closes lead, diagnose, execute, convert, renew');
assert(assessmentOnly.partnerServiceDeliveryLedger.blockedClaims.includes('score_ranking'), 'partner service ledger blocks score/ranking sales claims');
assert(assessmentOnly.postPilotRetentionLoop && assessmentOnly.postPilotRetentionLoop.id === 'post_pilot_retention_loop', 'service pathway builds a post-pilot retention loop');
assert.strictEqual(assessmentOnly.postPilotRetentionLoop.status, 'locked_until_evidence_and_parent_confirmation', 'assessment-only post-pilot loop stays locked before evidence and consent');
assert(assessmentOnly.postPilotRetentionLoop.stages.some((item) => item.id === 'downgrade_to_parent_script'), 'post-pilot loop includes downgrade path when pressure rises');
assert(assessmentOnly.postPilotRetentionLoop.safetyRules.includes('no upgrade before day-7 evidence'), 'post-pilot loop blocks upgrades before day-7 evidence');
assert.strictEqual(assessmentOnly.postPilotRetentionLoop.crmFollowup.day, 1, 'assessment-only CRM follow-up stays at day 1 until evidence is ready');
assert(assessmentOnly.personalizedClosureBridge && assessmentOnly.personalizedClosureBridge.id === 'personalized_upload_score_closure_bridge', 'service pathway builds the uploaded-material personalized closure bridge');
assert.strictEqual(assessmentOnly.personalizedClosureBridge.status, 'blocked_until_real_task_evidence', 'assessment-only closure bridge blocks execution before real task evidence');
assert(assessmentOnly.personalizedClosureBridge.contentScalePlan && assessmentOnly.personalizedClosureBridge.socraticStressFallback && assessmentOnly.personalizedClosureBridge.gameRetentionPlan, 'closure bridge connects content scale, Socratic fallback, and game retention');
assert(assessmentOnly.personalizedClosureBridge.scoreReportBridge && assessmentOnly.personalizedClosureBridge.uploadMaterialBridge, 'closure bridge connects score report and uploaded material analysis');
assert.strictEqual(assessmentOnly.personalizedClosureBridge.gameRetentionPlan.openedGameRecall, false, 'assessment-only bridge keeps game recall locked');
assert(assessmentOnly.personalizedClosureBridge.scoreReportBridge.neverUseScoreFor.includes('xp') && assessmentOnly.personalizedClosureBridge.scoreReportBridge.neverUseScoreFor.includes('ranking') && assessmentOnly.personalizedClosureBridge.scoreReportBridge.neverUseScoreFor.includes('share_payload'), 'score report bridge never uses score for rewards, ranking, or sharing');
assert(assessmentOnly.personalizedClosureBridge.releaseGates.includes('real_task_evidence_before_game') && assessmentOnly.personalizedClosureBridge.releaseGates.includes('day7_variant_before_method_claim'), 'closure bridge carries release gates for game and method claims');
assert(assessmentOnly.personalizedClosureBridge.lockedBecause.includes('real_task_evidence_missing'), 'assessment-only closure bridge names the missing evidence');
assert(assessmentOnly.modeChoiceProtocol && assessmentOnly.modeChoiceProtocol.id === 'family_learning_mode_choice_protocol', 'service pathway exposes a family mode choice protocol');
assert.strictEqual(assessmentOnly.modeChoiceProtocol.recommendedModeId, assessmentOnly.primaryMode.id, 'mode choice protocol stays tied to the primary recommendation');
assert(assessmentOnly.modeChoiceProtocol.choiceCards.some((item) => item.id === 'socratic_private_tutor' && item.choiceRole === 'default_private_tutor'), 'Socratic tutor remains the default role in the choice protocol');
assert(!assessmentOnly.modeRecommendations.some((item) => item.id === 'three_minute_mini_lesson'), 'assessment-only material does not recommend mini lesson before real homework evidence');
assert(assessmentOnly.modeChoiceProtocol.blockedModeCards.some((item) => item.id === 'three_minute_mini_lesson' && item.choiceRole === 'locked_rescue_bridge' && item.childCanChoose === false), 'mini lesson is locked as a rescue bridge until repeated real homework stuck evidence exists');
assert(assessmentOnly.modeChoiceProtocol.blockedModeCards.some((item) => item.id === 'game_recall' && item.choiceRole === 'locked_memory_loop' && item.childCanChoose === false), 'game recall is locked until first-step or wrong-cause evidence exists');
assert(assessmentOnly.modeChoiceProtocol.guardrails.some((item) => item.id === 'socratic_stays_default'), 'mode choice guardrails preserve product positioning');

assert(assessmentOnly.quickAssessmentBridge && assessmentOnly.quickAssessmentBridge.label.includes('15'), 'assessment path exposes an in-app 15-question bridge');
assert(/7|真实|鐪熷疄|错题|閿欓/.test(assessmentOnly.quickAssessmentBridge.releaseRule), 'quick assessment bridge stays gated by real homework and day-7 validation');
assert(Array.isArray(assessmentOnly.aiLocalDeliverySplit) && assessmentOnly.aiLocalDeliverySplit.length === 3, 'service pathway separates AI, local rules, and hybrid validation');
assert(assessmentOnly.aiLocalDeliverySplit.some((item) => /AI/.test(item.label) && /苏格拉底|鑻忔牸/.test((item.owns || []).join(','))), 'AI split owns expression and Socratic prompting');
assert(assessmentOnly.aiLocalDeliverySplit.some((item) => /本地|鏈湴/.test(item.label) && /隐私|闅愮/.test((item.owns || []).join(','))), 'local split owns privacy field blocking');
assert(Array.isArray(assessmentOnly.publicK12BorrowPlaybook) && assessmentOnly.publicK12BorrowPlaybook.length >= 5, 'service pathway exposes a public K12 borrow playbook');
assert(assessmentOnly.publicK12BorrowPlaybook.some((item) => item.id === 'official_curriculum_standards' && item.localCodeOwns.includes('课程骨架')), 'public K12 playbook uses curriculum standards for structure under local-code ownership');
assert(assessmentOnly.publicK12BorrowPlaybook.some((item) => item.id === 'family_uploaded_material' && item.mustNotUse.includes('天赋定性')), 'public K12 playbook blocks talent labeling for family uploads');
assert(assessmentOnly.publicK12BorrowPlaybook.every((item) => item.bestUse && item.localCodeOwns.length && item.aiBetterFor.length && item.mustNotUse.length && item.route), 'every K12 borrow lane has use, local, AI, blocked, and route fields');
assert(Array.isArray(assessmentOnly.validationPlan) && assessmentOnly.validationPlan.length >= 5, 'service pathway exposes a 7-day validation plan');
assert(assessmentOnly.validationPlan.some((item) => item.evidence === 'near_transfer'), 'validation plan requires near-transfer evidence');
assert(/家庭|瀹跺涵/.test(assessmentOnly.moatLine || ''), 'service pathway names the family evidence ledger as moat');

const assessmentWithOnlyQuestionType = pathway.buildLearningServicePathway({
  sourceSchemaId: 'talent_assessment',
  sourceText: 'learning preference assessment only',
  structuredEvidenceSignals: { questionType: 'math_word_problem' }
});
assert.strictEqual(assessmentWithOnlyQuestionType.status, 'needs_real_task_validation', 'question type alone is classification, not real task evidence');
assert.strictEqual(assessmentWithOnlyQuestionType.signals.hasTaskClassification, true, 'question type is still retained as classification signal');
assert.strictEqual(assessmentWithOnlyQuestionType.signals.hasRealTaskEvidence, false, 'classification alone must not release the service path');

const wrongQuestionWithoutEvidence = pathway.buildLearningServicePathway({
  sourceSchemaId: 'wrong_question_photo',
  sourceText: 'wrong question photo only, parent has not captured the child first step or wrong cause yet',
  structuredEvidenceSignals: { questionType: 'math_word_problem' }
});
assert.strictEqual(wrongQuestionWithoutEvidence.status, 'ready_for_family_plan', 'wrong-question material can enter a family evidence plan');
assert.strictEqual(wrongQuestionWithoutEvidence.signals.hasWrongQuestion, true, 'wrong-question photo is still classified as wrong-question material');
assert.strictEqual(wrongQuestionWithoutEvidence.signals.hasRealTaskEvidence, false, 'wrong-question photo without first step or wrong cause is not real task evidence');
assert(!wrongQuestionWithoutEvidence.modeRecommendations.some((item) => item.id === 'game_recall'), 'game recall is not recommended before real first-step or wrong-cause evidence');
assert(wrongQuestionWithoutEvidence.modeChoiceProtocol.blockedModeCards.some((item) => item.id === 'game_recall' && item.childCanChoose === false), 'game recall remains visible only as a locked future mode');

const wrongQuestion = pathway.buildLearningServicePathway({
  sourceSchemaId: 'wrong_question_paper',
  sourceText: '错题订正：物理电路图不会判断串并联，孩子卡在电流路径。',
  structuredEvidenceSignals: {
    questionType: 'physics_diagram',
    firstStep: '先沿着电流路径走一遍。',
    wrongCause: '只看灯泡亮不亮，没有先看电路结构。'
  },
  importedCards: 2,
  cardId: 'card_001'
});
assert.strictEqual(wrongQuestion.status, 'ready_for_family_plan', 'wrong-question evidence can enter family plan');
assert(wrongQuestion.modeRecommendations.some((item) => item.id === 'three_minute_mini_lesson'), 'visual science stuck point enters mini lesson');
assert(wrongQuestion.modeRecommendations.some((item) => item.id === 'game_recall'), 'wrong-question evidence enters game recall');
assert(wrongQuestion.modeRecommendations.some((item) => item.id === 'wrong_question_repair_course'), 'wrong-question evidence can enter repair course');
assert.strictEqual(wrongQuestion.personalizedClosureBridge.status, 'ready_for_guided_execution', 'wrong-question bridge opens guided execution with real task evidence');
assert.strictEqual(wrongQuestion.personalizedClosureBridge.gameRetentionPlan.openedGameRecall, true, 'wrong-question bridge opens game recall when the mode is recommended');
assert(wrongQuestion.personalizedClosureBridge.evidenceRequired.includes('day7_variant') && wrongQuestion.personalizedClosureBridge.endToEndRoutes.some((item) => item.id === 'parent'), 'wrong-question bridge keeps day-7 and parent-report closure in the route plan');
assert(wrongQuestion.productTiers.some((item) => item.id === 'thirty_day_camp'), 'validated repeated wrong cause can enter 30-day camp candidate');
assert(wrongQuestion.modeChoiceProtocol.choiceCards.some((item) => item.id === 'game_recall' && item.childCanChoose && item.exitEvidenceRequired.includes('wrong_cause_revisit')), 'game mode opens only with recall and wrong-cause exit evidence');
assert(wrongQuestion.modeChoiceProtocol.choiceCards.some((item) => item.id === 'three_minute_mini_lesson' && item.exitEvidenceRequired.includes('child_exit_ticket')), 'mini lesson requires a child exit ticket');
assert(wrongQuestion.commercialLoop.length === 4, 'service pathway exposes a four-step commercial loop');
assert.strictEqual(wrongQuestion.partnerServiceDeliveryLedger.status, 'needs_parent_confirmation', 'validated wrong-question evidence still requires parent confirmation before partner delivery');
assert.strictEqual(wrongQuestion.partnerServiceDeliveryLedger.releaseGate, 'parent_confirmation_required_before_partner_delivery', 'partner ledger blocks delivery until parent confirmation');
assert(wrongQuestion.partnerServiceDeliveryLedger.packageCards.some((item) => item.id === 'seven_day_execution' && item.entryGate === 'parent_confirmation_required'), 'partner ledger keeps 7-day execution gated by parent confirmation');
assert(wrongQuestion.nextAction.includes(wrongQuestion.primaryMode.label), 'next action is tied to the primary mode');

const wrongQuestionConfirmed = pathway.buildLearningServicePathway(Object.assign({}, {
  sourceSchemaId: 'wrong_question_paper',
  sourceText: '错题订正：物理电路图不会判断串并联，孩子卡在电流路径。',
  structuredEvidenceSignals: {
    questionType: 'physics_diagram',
    firstStep: '先沿着电流路径走一遍。',
    wrongCause: '只看灯泡亮不亮，没有先看电路结构。'
  },
  importedCards: 2,
  cardId: 'card_001',
  parentConfirmed: true
}));
assert.strictEqual(wrongQuestionConfirmed.signals.parentConfirmed, true, 'service pathway records parent confirmation signal');
assert.strictEqual(wrongQuestionConfirmed.partnerServiceDeliveryLedger.status, 'deliverable_after_parent_confirmation', 'confirmed real evidence can enter partner delivery');
assert(wrongQuestionConfirmed.partnerServiceDeliveryLedger.packageCards.some((item) => item.id === 'seven_day_execution' && item.entryGate === 'real_task_evidence_ready_and_parent_confirmed'), 'confirmed partner ledger opens 7-day execution after evidence and parent confirmation');
assert.strictEqual(wrongQuestionConfirmed.postPilotRetentionLoop.status, 'ready_after_day7_evidence', 'confirmed evidence opens day-7 retention decision loop');
assert.strictEqual(wrongQuestionConfirmed.postPilotRetentionLoop.crmFollowup.day, 7, 'confirmed pilot follow-up moves to day-7 evidence review');
assert(wrongQuestionConfirmed.postPilotRetentionLoop.stages.some((item) => item.id === 'upgrade_to_service_pack' && item.gate === 'evidence_based_offer_allowed'), 'post-pilot upgrade is allowed only from evidence');

const uploadJs = fs.readFileSync(path.join(root, 'miniprogram', 'pages', 'upload', 'upload.js'), 'utf8');
const uploadWxml = fs.readFileSync(path.join(root, 'miniprogram', 'pages', 'upload', 'upload.wxml'), 'utf8');
assert(uploadJs.includes("require('../../utils/learning-service-pathway')"), 'upload page imports the service pathway engine');
assert(uploadJs.includes('servicePathway') && uploadJs.includes('buildLearningServicePathway'), 'upload report CTA carries service pathway data');
assert(uploadJs.includes('servicePathway: cta.servicePathway'), 'service pathway persists into learning report state');
assert(uploadWxml.includes('upload-material-grid') && uploadWxml.includes('家长报告'), 'upload compact UI routes service pathway output into the parent report entry');
assert(uploadWxml.includes('upload-dash-pipeline') && uploadWxml.includes('进入原小点'), 'upload compact UI shows the service path as classify-report-gudian progression');
assert(uploadWxml.includes('upload-pipeline-node') && uploadWxml.includes('upload-pipeline-icon'), 'upload service path is a visual route rail instead of number-only boxes');
['entry-upload.png', 'entry-report.png', 'entry-parent.png', 'entry-tutor.png'].forEach((asset) => {
  assert(uploadWxml.includes(asset), `upload route rail uses reference asset: ${asset}`);
});
assert(uploadWxml.includes('不公开分享') && uploadWxml.includes('先分类再分析'), 'upload compact UI keeps release boundary visible without raw service ledgers');
assert(!uploadWxml.includes('lastReportCta.servicePathway.partnerServiceDeliveryLedger.packageCards[0]'), 'upload UI does not expose raw partner internals');
assert(!uploadWxml.includes('lastReportCta.servicePathway.modeRecommendations') && !uploadWxml.includes('{{item.localGate}}'), 'upload UI does not expose raw mode routes or local gates');
assert(!uploadWxml.includes('lastReportCta.servicePathway.modeChoiceProtocol') && !uploadWxml.includes('{{item.choiceRole}}') && !uploadWxml.includes('{{item.exitEvidenceRequired}}'), 'upload UI does not expose raw mode-choice protocol fields');
assert(!uploadWxml.includes('partnerServiceDeliveryLedger.status') && !uploadWxml.includes('partnerServiceDeliveryLedger.releaseGate'), 'upload UI does not expose raw partner ledger status keys');
assert(!uploadWxml.includes('partnerServiceDeliveryLedger.partnerVisibleFields') && !uploadWxml.includes('partnerServiceDeliveryLedger.partnerBlockedFields'), 'upload UI does not expose raw partner field ids directly');
assert(!uploadWxml.includes('lastReportCta.servicePathway.postPilotRetentionLoop.stages') && !uploadWxml.includes('{{item.gate}}'), 'upload UI does not expose raw post-pilot gates');
assert(!uploadWxml.includes('lastReportCta.servicePathway.personalizedClosureBridge.endToEndRoutes') && !uploadWxml.includes('personalizedClosureBridge.blockedFields'), 'upload UI does not expose raw personalized closure internals');
assert(uploadJs.includes('confirmReportParentConsent'), 'upload keeps parent confirmation action in logic');
assert(uploadWxml.includes('学习偏好/测评资料') && !uploadWxml.includes('>天赋测评<'), 'upload UI softens talent-assessment entry wording');
assert(!uploadWxml.includes('lastReportCta.servicePathway.validationPlan') && !uploadWxml.includes('{{item.evidence}}') && !uploadWxml.includes('{{item.unlockRule}}'), 'upload UI does not expose raw validation plan keys');
assert(!uploadWxml.includes('lastReportCta.servicePathway.productTiers') && !uploadWxml.includes('{{item.entryGate}}'), 'upload UI does not expose raw product tier ids or entry gates');
assert(!uploadWxml.includes('lastReportCta.servicePathway.quickAssessmentBridge') && !uploadWxml.includes('quickAssessmentBridge.route') && !uploadWxml.includes('quickAssessmentBridge.releaseRule'), 'upload UI does not expose raw quick assessment route or release rule');
assert(!uploadWxml.includes('lastReportCta.servicePathway.aiLocalDeliverySplit') && !uploadWxml.includes('{{item.owns}}'), 'upload UI does not expose raw AI/local split fields');
assert(!uploadWxml.includes('lastReportCta.servicePathway.publicK12BorrowPlaybook') && !uploadWxml.includes('{{item.localCodeOwns}}') && !uploadWxml.includes('{{item.aiBetterFor}}') && !uploadWxml.includes('{{item.mustNotUse}}'), 'upload UI does not expose raw public K12 borrow fields');
console.log('All learning service pathway tests pass.');
