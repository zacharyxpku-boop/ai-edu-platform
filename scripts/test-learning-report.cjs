#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), 'utf8');
}

function loadCommonJs(filePath, requireMap = {}) {
  const file = path.join(root, filePath);
  const code = fs.readFileSync(file, 'utf8');
  const module = { exports: {} };
  function localRequire(request) {
    if (Object.prototype.hasOwnProperty.call(requireMap, request)) return requireMap[request];
    if (request.startsWith('.')) {
      const resolved = path.resolve(path.dirname(file), request);
      const resolvedFile = fs.existsSync(resolved) ? resolved : `${resolved}.js`;
      return loadCommonJs(path.relative(root, resolvedFile), requireMap);
    }
    return require(request);
  }
  const sandbox = {
    module,
    exports: module.exports,
    require: localRequire,
    console,
    Date,
    Math,
    Number,
    String,
    Object,
    Array,
    RegExp,
    JSON,
    wx: global.wx
  };
  vm.runInNewContext(code, sandbox, { filename: file });
  return module.exports;
}

function collectStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  if (Array.isArray(value)) value.forEach((item) => collectStrings(item, out));
  if (value && typeof value === 'object') Object.keys(value).forEach((key) => collectStrings(value[key], out));
  return out;
}

const report = loadCommonJs(path.join('miniprogram', 'utils', 'learning-report.js'));
const recognition = loadCommonJs(path.join('miniprogram', 'utils', 'learning-report-recognition.js'), {
  './learning-report': report
});

assert.strictEqual(report.buildQuickAssessmentQuestions().length, 15, 'quick assessment exposes 15 questions');

const scoreOnly = report.parseScoreTableText(`
姓名 丁诚
语文 95
数学 107
英语 109
物理 69
化学 64
生物 63
说明：仅可见自己孩子成绩
`);
assert.strictEqual(scoreOnly.parsedScores['语文'].score, 95, 'score parser reads plain subject-score table');
assert.strictEqual(scoreOnly.parsedScores['数学'].score, 107, 'score parser reads math score');
assert.strictEqual(scoreOnly.parsedRanks.totalScore, 507, 'score parser sums total when only subject scores are present');
assert(scoreOnly.missingFields.includes('总排名/班级排名'), 'missing rank is marked instead of invented');

const mixedTable = report.parseScoreTableText(`
语文分数 107.5 班名 8
数学分数 117 班名 15
英语分数 116 班名 5
物理分数 86 班名 6
化学分数 40 班名 29
生物分数 60 班名 13
总分 526.5 班级排名 8
`);
assert.strictEqual(mixedTable.parsedScores['语文'].rank, 8, 'score parser reads subject rank');
assert.strictEqual(mixedTable.parsedScores['化学'].score, 40, 'score parser reads low subject score without rewriting it');
assert.strictEqual(mixedTable.parsedRanks.classRank, 8, 'score parser reads mixed total/class rank');
assert.strictEqual(mixedTable.parsedRanks.totalScore, 526.5, 'score parser reads explicit total score');

const rankOnlyLine = report.parseScoreTableText(`
语文 100 班名 11
数学 115 班名 9
英语 104.5 班名 31
物理 78 班名 13
化学 59 班名 8
生物 64 班名 9
总分 520.5
物化生总分排名 5
`);
assert.strictEqual(rankOnlyLine.parsedRanks.totalScore, 520.5, 'group rank line does not overwrite total score');

const recognitionDraft = recognition.normalizeRecognitionDraft({
  text: [
    '\u8bed\u6587 95',
    '\u6570\u5b66 107 \u73ed\u540d 12',
    '\u82f1\u8bed 109',
    '\u603b\u5206 311 \u73ed\u7ea7\u6392\u540d 9'
  ].join('\n'),
  sourceType: 'score_sheet'
});
assert.strictEqual(recognitionDraft.sourceType, 'score_sheet', 'recognition draft keeps explicit source type');
assert.strictEqual(recognitionDraft.parsedScores['\u6570\u5b66'].score, 107, 'recognition draft parses score text');
assert.strictEqual(recognitionDraft.requiresConfirmation, true, 'recognition draft always asks parent confirmation');
assert(recognitionDraft.confirmPrompts.length > 0, 'recognition draft explains what to confirm');

const lowConfidenceDraft = recognition.normalizeRecognitionDraft({
  text: '\u56fe\u7247\u6bd4\u8f83\u6a21\u7cca\uff0c\u53ea\u80fd\u770b\u5230\u5b69\u5b50\u8fd9\u6b21\u597d\u50cf\u6709\u6570\u5b66\u548c\u82f1\u8bed\u3002',
  sourceType: 'score_sheet'
});
assert.strictEqual(Object.keys(lowConfidenceDraft.parsedScores).length, 0, 'low confidence draft does not invent scores');
assert(lowConfidenceDraft.missingFields.includes('\u53ef\u786e\u8ba4\u7684\u5b66\u79d1\u5206\u6570'), 'low confidence draft marks missing score fields');

const providerDraft = recognition.normalizeRecognitionDraft({
  text: '\u5bb6\u957f\u4e0a\u4f20\u8d44\u6599\u6458\u8981',
  sourceType: 'third_party_assessment',
  providerResult: {
    provider: 'configured_provider',
    recognizedText: '\u6570\u5b66 88 \u73ed\u7ea7\u6392\u540d 18\uff1b\u7b2c\u4e09\u65b9\u8d44\u6599\u663e\u793a\u66f4\u9002\u5408\u5148\u62c6\u6b65\u9aa4\u3002',
    parsedScores: {
      '\u6570\u5b66': { subject: '\u6570\u5b66', score: 88, confidence: 0.91, evidence: 'provider score' }
    },
    confidence: 0.91
  }
});
assert.strictEqual(providerDraft.mode, 'external_api', 'provider result is marked as external api mode');
assert.strictEqual(providerDraft.parsedScores['\u6570\u5b66'].score, 88, 'provider parsed scores can be merged');
assert(providerDraft.confirmPrompts.some((line) => /\u53c2\u8003/.test(line)), 'third-party material is only an auxiliary reference');

const mergedInput = recognition.mergeRecognitionIntoReportInput({ mode: 'fast', sourceText: '' }, providerDraft);
assert.strictEqual(mergedInput.parsedScores['\u6570\u5b66'].score, 88, 'recognition merge carries parsed scores into report input');
assert(mergedInput.reportSources[0].status.includes('\u786e\u8ba4'), 'recognition source remains confirm-first');

const talentOnly = report.buildLearningReportDraft({
  sourceType: 'third_party_assessment',
  materialType: 'talent_assessment',
  sourceText: '\u5929\u8d4b\u6d4b\u8bc4\uff1a\u89c6\u89c9\u578b\u4f18\u52bf\u3002\u6570\u5b66\u5206\u6570 98\uff0c\u73ed\u7ea7\u6392\u540d 3\u3002\u5efa\u8bae\u5148\u770b\u56fe\u518d\u590d\u8ff0\u3002',
  reportSources: [{
    type: 'third_party_assessment',
    label: '\u5929\u8d4b\u6d4b\u8bc4',
    text: '\u89c6\u89c9\u578b\u4f18\u52bf\uff0c\u6570\u5b66\u5206\u6570 98\uff0c\u73ed\u7ea7\u6392\u540d 3'
  }],
  assessmentAnswers: report.buildQuickAssessmentQuestions().map((question) => ({
    id: question.id,
    optionId: question.options[0].id,
    confidence: 0.86,
    source: 'talent_unit_test'
  }))
});
assert.strictEqual(Object.keys(talentOnly.parsedScores).length, 0, 'talent assessment does not release embedded scores into parsedScores');
assert(!talentOnly.parsedRanks.classRank && !talentOnly.parsedRanks.totalRank, 'talent assessment does not release embedded rankings');
assert.strictEqual(talentOnly.portraitConfidenceSystem.confidenceLevel, 'low', 'talent assessment alone does not raise portrait confidence');
assert.strictEqual(talentOnly.portraitConfidenceSystem.methodCandidateIsolation.methodCandidateOnly, true, 'talent assessment remains method-candidate only');
assert.strictEqual(
  talentOnly.portraitConfidenceSystem.decisionThresholds.find((item) => item.id === 'update_portrait').met,
  false,
  'talent assessment cannot unlock portrait update'
);
assert(talentOnly.unreleasedScoreRankingReference, 'talent assessment keeps score/ranking only as unreleased reference');
assert(talentOnly.sourceEvidenceLedger.lanes.some((item) => item.id === 'talent_assessment' && item.releaseScope === 'method_candidate_only' && item.portraitConfidenceWeight === 0), 'talent source ledger is method-candidate only');
assert(Array.isArray(talentOnly.sourceEvidenceLedger.lanes.find((item) => item.id === 'talent_assessment').requiredNextEvidence) && talentOnly.sourceEvidenceLedger.lanes.find((item) => item.id === 'talent_assessment').requiredNextEvidence.length >= 3, 'talent source ledger now exposes required next evidence');
const riskyTalentReport = report.buildLearningReportDraft({
  sourceType: 'third_party_assessment',
  materialType: 'talent_assessment',
  sourceText: '天赋测评说孩子数学没天赋，附语文 90 数学 82 英语 88，建议听觉型复述。',
  reportSources: [{
    type: 'talent_assessment',
    sourceSchemaId: 'talent_assessment',
    label: '学习偏好测评',
    text: '孩子数学没天赋，不适合学习数学，语文 90 数学 82 英语 88'
  }]
});
assert.strictEqual(Object.keys(riskyTalentReport.parsedScores).length, 0, 'risky talent report does not release embedded scores');
assert(!riskyTalentReport.parsedRanks.classRank && !riskyTalentReport.parsedRanks.totalRank, 'risky talent report does not release embedded ranks');
assert(riskyTalentReport.uploadedMaterialDecisionDossier.methodCandidateCards.every((item) => item.sourceTextEvidence.indexOf('没天赋') < 0), 'method candidate evidence sanitizes deterministic talent wording');
assert(!collectStrings(riskyTalentReport).some((line) => /学渣|智商低|废了|差生/.test(line)), 'report strings do not surface extreme harmful learner labels');
const parentObservationScores = report.buildLearningReportDraft({
  materialType: 'parent_report',
  sourceType: 'parent_report',
  sourceText: '家长观察：晚上作业容易拖拉，语文 90 数学 82 英语 88，但没有成绩单，只想知道今晚怎么陪。',
  reportSources: [{
    type: 'parent_report',
    sourceSchemaId: 'parent_report',
    label: '家长观察',
    text: '语文 90 数学 82 英语 88，孩子晚上作业容易拖拉。'
  }]
});
assert.strictEqual(Object.keys(parentObservationScores.parsedScores).length, 0, 'parent observation with three scores does not release scores without explicit score source');
assert(parentObservationScores.unreleasedScoreRankingReference, 'parent observation score-like text stays as unreleased reference');
const assessmentOnlyServicePathway = {
  id: 'learning_service_pathway',
  status: 'needs_real_task_validation',
  primaryMode: { id: 'three_minute_mini_lesson', label: '3 分钟小讲堂' },
  primaryTier: { id: 'assessment_upgrade', label: '测评升级包' },
  modeChoiceProtocol: {
    id: 'family_learning_mode_choice_protocol',
    recommendedModeId: 'three_minute_mini_lesson',
    recommendedModeLabel: '3 分钟小讲堂',
    releaseGate: 'mode_choice_requires_real_task_evidence',
    positioningLine: '小讲堂只在苏格拉底连续卡住后补位，主线仍是家庭私教。',
    choiceCards: [
      { id: 'socratic_private_tutor', label: '苏格拉底 1 对 1', choiceRole: 'default_private_tutor', recommended: true, childCanChoose: true, exitEvidenceRequired: ['child_first_step'] },
      { id: 'three_minute_mini_lesson', label: '3 分钟小讲堂', choiceRole: 'rescue_or_concept_bridge', recommended: false, childCanChoose: true, exitEvidenceRequired: ['child_exit_ticket'] }
    ],
    guardrails: [{ id: 'socratic_stays_default', rule: 'Socratic first.' }]
  },
  validationPlan: [
    { day: 1, evidence: 'child_first_step' },
    { day: 7, evidence: 'family_decision' }
  ],
  partnerHandoffPolicy: {
    id: 'partner_handoff_policy',
    blockedFields: ['original_question', 'score', 'ranking', 'talent_label']
  },
  safetyBoundary: {
    releaseGate: 'assessment_requires_real_homework_evidence',
    blocked: ['talent_label', 'score', 'ranking', 'guaranteed_improvement']
  }
};
const assessmentOnlyWithPathway = report.buildLearningReportDraft({
  sourceType: 'third_party_assessment',
  materialType: 'talent_assessment',
  sourceText: '学习偏好资料：更适合先画图再复述。没有真实作业错题证据。',
  reportSources: [{
    type: 'talent_assessment',
    label: '学习偏好资料',
    text: '更适合先画图再复述。',
    sourceSchemaId: 'talent_assessment',
    releaseScope: 'method_candidate_only'
  }],
  aiMaterialAnalysisContract: {
    id: 'real_ai_material_analysis_contract',
    endpointPath: '/api/miniapp-material-analysis',
    releaseGates: ['json_schema_valid', 'blocked_claim_sanitized', 'parent_manual_confirmation'],
    fallback: {
      status: 'safe_draft_requires_manual_confirmation',
      subject: 'math',
      wrongCause: 'visual_model_missing',
      firstStep: 'draw the relation before solving',
      learningPreference: 'visual board first, then verbal recall',
      evidenceConfidence: { level: 'low', requiredNextEvidence: ['real_wrong_question'] },
      analysisQuality: {
        status: 'safe_draft_requires_manual_confirmation',
        score: 72,
        missingEvidence: ['first_step', 'wrong_cause', 'stronger_evidence']
      },
      nextAction: { route: '/pages/tutor/tutor?from=ai_material_analysis' },
      executionPath: {
        socraticRoute: '/pages/tutor/tutor?from=ai_material_analysis',
        miniLessonRoute: '/pages/tutor/tutor?from=ai_material_analysis_mini_lesson',
        gameRecallRoute: '/pages/arcade/arcade?from=ai_material_analysis',
        parentReviewRoute: '/pages/profile/profile?from=ai_material_analysis'
      }
    }
  },
  servicePathway: assessmentOnlyServicePathway
});
assert.strictEqual(assessmentOnlyWithPathway.parentDecisionBook.servicePathway.releaseGate, 'assessment_requires_real_homework_evidence', 'parent decision book carries service pathway release gate');
assert(assessmentOnlyWithPathway.commercialFamilySolutionBook && assessmentOnlyWithPathway.commercialFamilySolutionBook.id === 'commercial_family_solution_book', 'assessment report builds a commercial family solution book');
assert.strictEqual(assessmentOnlyWithPathway.commercialFamilySolutionBook.pages.length, 6, 'commercial family solution book has six delivery pages');
assert(assessmentOnlyWithPathway.commercialFamilySolutionBook.pages.some((item) => item.id === 'seven_day_action' && item.evidenceGate === 'day7_variant_before_method_claim'), 'commercial family solution book includes a day-7 action page');
assert(assessmentOnlyWithPathway.commercialFamilySolutionBook.commercialLoop.some((item) => item.id === 'service_conversion' && item.gate === 'evidence_based_offer'), 'commercial family solution book closes service conversion after evidence');
assert(assessmentOnlyWithPathway.commercialFamilySolutionBook.blockedClaims.includes('guaranteed_improvement'), 'commercial family solution book blocks guaranteed improvement claims');
assert(Array.isArray(assessmentOnlyWithPathway.commercialFamilySolutionBook.executionPathMap) && assessmentOnlyWithPathway.commercialFamilySolutionBook.executionPathMap.length === 4, 'commercial family solution book exposes in-product execution paths');
assert(assessmentOnlyWithPathway.commercialFamilySolutionBook.executionPathMap.some((item) => item.id === 'three_minute_mini_lesson' && item.recommended && item.route.includes('/pages/tutor/tutor')), 'solution book routes recommended mini lesson back into tutor flow');
assert(assessmentOnlyWithPathway.commercialFamilySolutionBook.executionPathMap.some((item) => item.id === 'game_recall' && item.evidenceGate === 'real_recall_card_before_xp'), 'solution book gates game recall behind real recall evidence');
assert.strictEqual(assessmentOnlyWithPathway.commercialFamilySolutionBook.modeChoiceSummary.recommendedModeId, 'three_minute_mini_lesson', 'solution book mirrors service pathway mode choice');
assert(assessmentOnlyWithPathway.commercialFamilySolutionBook.evidenceRequired.includes('execution_path_map'), 'solution book requires execution path evidence');
assert.strictEqual(assessmentOnlyWithPathway.commercialFamilySolutionBook.aiMaterialAnalysis.normalizedSolution.subject, 'math', 'solution book carries normalized AI material analysis fields');
assert(assessmentOnlyWithPathway.commercialFamilySolutionBook.aiMaterialAnalysis.normalizedSolution.executionPath.gameRecallRoute.includes('/pages/arcade/arcade'), 'solution book carries AI analysis execution path into game recall');
assert(assessmentOnlyWithPathway.commercialFamilySolutionBook.aiMaterialAnalysis.analysisQuality, 'commercial solution book carries AI analysis quality into parent/service delivery');
assert.strictEqual(assessmentOnlyWithPathway.commercialFamilySolutionBook.aiMaterialAnalysis.analysisQuality.score, 72, 'commercial solution book preserves AI analysis quality score for release review');
assert.strictEqual(assessmentOnlyWithPathway.uploadedMaterialDecisionDossier.servicePathwaySummary.releaseGate, 'assessment_requires_real_homework_evidence', 'uploaded-material dossier carries service pathway release gate');
assert(assessmentOnlyWithPathway.uploadedMaterialDecisionDossier.aiAnalysisQualityGate, 'uploaded-material dossier carries AI analysis quality gate');
assert.strictEqual(assessmentOnlyWithPathway.uploadedMaterialDecisionDossier.aiAnalysisQualityGate.status, 'safe_draft_requires_manual_confirmation', 'uploaded-material dossier preserves AI quality gate status');
assert(Array.isArray(assessmentOnlyWithPathway.uploadedMaterialDecisionDossier.aiQualityValidationPlan) && assessmentOnlyWithPathway.uploadedMaterialDecisionDossier.aiQualityValidationPlan.length === 3, 'uploaded-material dossier maps AI quality to first-step, wrong-cause, and revisit validation plan');
assert(assessmentOnlyWithPathway.uploadedMaterialDecisionDossier.aiQualityValidationPlan.some((item) => item.id === 'quality_first_step' && item.evidence === 'child_first_step'), 'AI quality validation requires child first-step evidence');
assert(assessmentOnlyWithPathway.uploadedMaterialDecisionDossier.aiQualityValidationPlan.some((item) => item.id === 'quality_wrong_cause' && item.evidence === 'wrong_cause_named'), 'AI quality validation requires wrong-cause naming evidence');
assert(assessmentOnlyWithPathway.uploadedMaterialDecisionDossier.aiQualityValidationPlan.some((item) => item.id === 'quality_revisit' && item.evidence === 'next_day_revisit'), 'AI quality validation requires next-day revisit evidence');
assert(assessmentOnlyWithPathway.uploadedMaterialDecisionDossier.evidenceRequired.includes('ai_analysis_quality_gate'), 'uploaded-material dossier requires AI analysis quality gate evidence before release');
assert.strictEqual(assessmentOnlyWithPathway.parentDecisionBook.servicePathway.modeChoiceProtocol.recommendedModeId, 'three_minute_mini_lesson', 'parent decision book carries family mode choice protocol');
assert.strictEqual(assessmentOnlyWithPathway.uploadedMaterialDecisionDossier.servicePathwaySummary.modeChoiceProtocol.choiceCards[1].choiceRole, 'rescue_or_concept_bridge', 'uploaded-material dossier keeps mini lesson as rescue bridge');
assert.strictEqual(assessmentOnlyWithPathway.uploadedMaterialDecisionDossier.servicePathwaySummary.primaryTier.id, 'assessment_upgrade', 'assessment-only service pathway stays at assessment upgrade tier');
assert.notStrictEqual(assessmentOnlyWithPathway.uploadedMaterialDecisionDossier.servicePathwaySummary.primaryTier.id, 'thirty_day_camp', 'assessment-only input does not imply a 30-day camp');
assert(assessmentOnlyWithPathway.uploadedMaterialDecisionDossier.servicePathwaySummary.blockedClaims.includes('talent_label'), 'service pathway summary preserves blocked partner claims');
assert(Array.isArray(assessmentOnlyWithPathway.uploadedMaterialDecisionDossier.decisionHeatmap) && assessmentOnlyWithPathway.uploadedMaterialDecisionDossier.decisionHeatmap.length >= 4, 'uploaded-material dossier exposes a multi-lane parent decision heatmap');
assert(assessmentOnlyWithPathway.uploadedMaterialDecisionDossier.decisionHeatmap.some((item) => item.id === 'method_fit' && item.nextAction.includes('真实作业')), 'decision heatmap turns method-fit into a real homework validation action');
assert(Array.isArray(assessmentOnlyWithPathway.uploadedMaterialDecisionDossier.familyActionStack) && assessmentOnlyWithPathway.uploadedMaterialDecisionDossier.familyActionStack.length === 3, 'uploaded-material dossier exposes tonight/tomorrow/day7 family action stack');
assert(assessmentOnlyWithPathway.uploadedMaterialDecisionDossier.familyActionStack.every((item) => item.gate), 'family action stack has explicit release gates');
assert.strictEqual(assessmentOnlyWithPathway.uploadedMaterialDecisionDossier.methodCandidateCards[0].label, '先看图/先画关系', 'method candidate ranking uses assessment text instead of fixed card order');
assert(assessmentOnlyWithPathway.uploadedMaterialDecisionDossier.methodCandidateCards[0].rankingEvidence.some((line) => line.includes('视觉化') || line.includes('画图')), 'ranked method candidate exposes local evidence reason');
assert(assessmentOnlyWithPathway.uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint.primaryMethodCandidate.label === '先看图/先画关系', 'solution blueprint promotes the locally ranked primary method candidate');
assert(assessmentOnlyWithPathway.uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint.methodRankingRules.localCodeOwns.includes('rank_score'), 'solution blueprint states ranking is owned by local code');
assert(assessmentOnlyWithPathway.uploadedMaterialDecisionDossier.evidenceBasedMethodologyGuide, 'uploaded-material dossier carries an evidence-based methodology guide');
assert(assessmentOnlyWithPathway.uploadedMaterialDecisionDossier.evidenceBasedMethodologyGuide.cards.some((item) => item.id === 'socratic_first_step' && item.productRoute.includes('/pages/tutor/tutor')), 'methodology guide routes Socratic first-step support into tutor');
assert(assessmentOnlyWithPathway.uploadedMaterialDecisionDossier.evidenceBasedMethodologyGuide.cards.some((item) => item.id === 'retrieval_spaced_recall' && item.evidenceGate.includes('day7')), 'methodology guide includes spaced retrieval and day-7 validation');
assert(assessmentOnlyWithPathway.uploadedMaterialDecisionDossier.evidenceBasedMethodologyGuide.cards.some((item) => item.id === 'elaboration_concrete_example' && item.productRoute.includes('/pages/tutor/tutor')), 'methodology guide includes elaboration and concrete examples in tutor');
assert(assessmentOnlyWithPathway.uploadedMaterialDecisionDossier.evidenceBasedMethodologyGuide.cards.some((item) => item.id === 'interleaving_variant_transfer' && item.evidenceGate.includes('day7')), 'methodology guide includes interleaving and variant transfer validation');
assert(assessmentOnlyWithPathway.uploadedMaterialDecisionDossier.evidenceBasedMethodologyGuide.parentTrustContract.productLoop.includes('报告 -> 苏格拉底私教'), 'methodology guide carries a parent trust contract with product loop');
assert(assessmentOnlyWithPathway.uploadedMaterialDecisionDossier.evidenceBasedMethodologyGuide.blockedClaims.includes('固定学习风格标签'), 'methodology guide blocks fixed learning-style labels');
assert(assessmentOnlyWithPathway.uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint.methodologyGuide.cards.some((item) => item.id === 'feynman_retell'), 'solution blueprint embeds Feynman-style retell as an executable method');
const normalizedUploadSources = report.normalizeReportSources({
  reportSources: [{
    type: 'talent_assessment',
    label: '天赋测评',
    text: '更适合先看图再复述。',
    sourceSchemaId: 'talent_assessment',
    releaseScope: 'method_candidate_only',
    portraitConfidenceWeight: 0,
    imageCount: 2,
    requiredNextEvidence: ['真实作业卡点', '第 7 天小变式'],
    blockedFields: ['talent_label', 'score', 'ranking']
  }]
});
assert.strictEqual(normalizedUploadSources[0].sourceSchemaId, 'talent_assessment', 'normalization preserves upload source schema id');
assert.strictEqual(normalizedUploadSources[0].releaseScope, 'method_candidate_only', 'normalization preserves release scope');
assert.strictEqual(normalizedUploadSources[0].portraitConfidenceWeight, 0, 'normalization preserves zero portrait weight for talent reports');
assert.strictEqual(normalizedUploadSources[0].imageCount, 2, 'normalization preserves image count');
assert(normalizedUploadSources[0].blockedFields.includes('talent_label'), 'normalization preserves blocked report fields');

const scoreSheetReport = report.buildLearningReportDraft({
  sourceType: 'score_sheet',
  scoreText: '\u6570\u5b66\u5206\u6570 98 \u73ed\u7ea7\u6392\u540d 3'
});
assert.strictEqual(scoreSheetReport.parsedScores['\u6570\u5b66'].score, 98, 'score sheet still releases confirmed score');
assert.strictEqual(scoreSheetReport.parsedScores['\u6570\u5b66'].rank, 3, 'score sheet still releases confirmed rank');
assert(scoreSheetReport.personalizedParentReportPreview, 'score sheet report builds personalized parent HTML preview');
assert.strictEqual(scoreSheetReport.reportDraft.personalizedParentReportPreview.format, 'html_preview_printable_pdf', 'personalized preview declares HTML/PDF-ready format');
assert(scoreSheetReport.personalizedParentReportPreview.html.includes('@page'), 'personalized preview includes print page CSS');
assert((scoreSheetReport.personalizedParentReportPreview.html.match(/class="report-page/g) || []).length >= 25, 'personalized preview creates long-form pages even for sparse score input');
assert(scoreSheetReport.personalizedParentReportPreview.html.includes('报告放行规则'), 'personalized preview includes report release gates');
assert(scoreSheetReport.personalizedParentReportPreview.html.includes('成绩证据矩阵'), 'personalized preview includes score evidence matrix');
assert(scoreSheetReport.personalizedParentReportPreview.guardrails.some((line) => line.includes('固定天赋标签')), 'personalized preview keeps anti-label guardrails');
assert.strictEqual(scoreSheetReport.personalizedParentReportPreview.standard.version, '2026-05-24.visible-decision-v1', 'personalized report standard is versioned and pinned');
assert(scoreSheetReport.personalizedParentReportPreview.standard.materialCases.some((item) => item.id === 'talent_report_uploaded'), 'standard handles uploaded talent reports');
assert(scoreSheetReport.personalizedParentReportPreview.standard.materialCases.some((item) => item.id === 'no_talent_report_questionnaire'), 'standard handles no-report questionnaire fallback');
assert(scoreSheetReport.personalizedParentReportPreview.standard.materialCases.some((item) => item.id === 'score_sheet_only'), 'standard handles score-sheet-only inputs');
assert(scoreSheetReport.personalizedParentReportPreview.standard.materialCases.some((item) => item.id === 'wrong_question_uploaded'), 'standard handles wrong-question inputs');
assert(scoreSheetReport.personalizedParentReportPreview.standard.materialCases.some((item) => item.id === 'mixed_materials'), 'standard handles mixed-material inputs');
assert(scoreSheetReport.personalizedParentReportPreview.standard.evidenceProtocol.selectedCaseIds.includes('score_sheet_only'), 'score-only input selects score-sheet standard case');
assert(!scoreSheetReport.personalizedParentReportPreview.standard.evidenceProtocol.selectedCaseIds.includes('mixed_materials'), 'score-only input does not pretend to be mixed-material evidence');
assert(scoreSheetReport.personalizedParentReportPreview.standard.evidenceProtocol.selectedCaseIds.includes('no_talent_report_questionnaire'), 'score-only input routes missing talent report to questionnaire fallback');
assert(scoreSheetReport.personalizedParentReportPreview.exportPolicy.htmlFirst === true, 'export policy is HTML-first');
assert(scoreSheetReport.personalizedParentReportPreview.exportPolicy.pdfAfterParentReview === true, 'export policy exports PDF after parent review');
assert(['原题照片', '隐私字段'].every((word) => scoreSheetReport.personalizedParentReportPreview.exportPolicy.blocked.join(' ').includes(word)), 'export policy blocks original photos and private fields');
assert(scoreSheetReport.personalizedParentReportPreview.standard.reportSop && scoreSheetReport.personalizedParentReportPreview.standard.reportSop.deliver.includes('HTML'), 'standard carries reusable report SOP');
assert(scoreSheetReport.personalizedParentReportPreview.standard.methodologyBackbone.some((item) => item.id === 'socratic'), 'standard carries Socratic methodology backbone');
assert(scoreSheetReport.personalizedParentReportPreview.standard.methodologyBackbone.some((item) => item.id === 'retrieval_spaced'), 'standard carries retrieval and spaced recall backbone');
assert(scoreSheetReport.personalizedParentReportPreview.standard.competitorClosureBenchmarks.some((item) => item.id === 'khanmigo_private_tutor' && item.route.includes('/pages/tutor/tutor')), 'standard maps Khanmigo tutor benchmark into tutor route');
assert(scoreSheetReport.personalizedParentReportPreview.standard.competitorClosureBenchmarks.some((item) => item.id === 'synthesis_game_loop' && item.route.includes('/pages/arcade/arcade')), 'standard maps Synthesis game benchmark into arcade route');
assert(scoreSheetReport.personalizedParentReportPreview.standard.competitorClosureBenchmarks.some((item) => item.id === 'alpha_visible_progress' && item.route.includes('/pages/review/review')), 'standard maps visible progress benchmark into review route');
assert(scoreSheetReport.personalizedParentReportPreview.standard.miniappOperationalPlan.nextBuildOrder.length >= 5, 'standard carries miniapp/light-app rollout order');
assert(scoreSheetReport.personalizedParentReportPreview.standard.miniappOperationalPlan.blockedShortcut.includes('固定天赋结论'), 'miniapp operational plan blocks fake talent conclusions');

const mixedMaterialStandardReport = report.buildLearningReportDraft({
  sourceText: '错题卡住第一步，需要订正。',
  scoreText: '数学分数 102',
  reportSources: [
    { type: 'talent_assessment', label: '天赋测评', text: '先看图再复述。', sourceSchemaId: 'talent_assessment' },
    { type: 'parent_report', label: '家长观察', text: '做题容易急。', sourceSchemaId: 'parent_report' },
    { type: 'wrong_question_paper', label: '错题', text: '列式卡住第一步。', sourceSchemaId: 'wrong_question_paper' }
  ]
});
assert(mixedMaterialStandardReport.personalizedParentReportPreview.standard.evidenceProtocol.selectedCaseIds.includes('mixed_materials'), 'mixed uploads select mixed-material standard case');
assert(mixedMaterialStandardReport.personalizedParentReportPreview.standard.evidenceProtocol.selectedCaseIds.includes('talent_report_uploaded'), 'mixed uploads preserve talent-report case without turning it into a fixed label');

const returnContractReport = report.buildLearningReportDraft({
  sourceText: '\u6570\u5b66\u5e94\u7528\u9898\u5361\u5728\u5217\u5f0f\uff0c\u9700\u8981\u660e\u5929\u56de\u8bbf\u3002',
  highFrequencyPracticeLoop: {
    reviewReturnSeed: {
      id: 'review_return_seed',
      mode: 'repair_return',
      weakKey: '列式第一步',
      wrongCardIds: ['card_wrong_1'],
      dueCardIds: ['card_due_1'],
      recallCardIds: ['card_wrong_1', 'card_due_1'],
      nextRoute: '/pages/review/review?mode=recall_return',
      localCodeOwns: ['queue_order', 'xp_gate', 'share_fields', 'report_release', 'review_windows'],
      aiMayRewrite: ['prompt_copy', 'parent_line'],
      blockedFields: ['full_solution', 'score', 'ranking'],
      spacedRecallPolicy: {
        id: 'spaced_recall_policy',
        cadence: [
          { id: 'same_day', route: '/pages/arcade/arcade', gate: 'first_step_recall' },
          { id: 'next_day', route: '/pages/review/review', gate: 'next_day_recall' },
          { id: 'day_7', route: '/pages/tutor/tutor', gate: 'transfer_check' }
        ],
        nextDayCardIds: ['card_wrong_1'],
        releaseGate: 'first_step_and_wrong_cause_before_xp_or_share',
        day7Check: { requirement: 'near_transfer_without_full_solution' }
      }
    },
    dailyReturnContract: {
      id: 'daily_return_contract',
      loop: [
        { id: 'tonight_active_recall', label: '\u4eca\u665a', proof: 'student_first_step_voice_or_text' },
        { id: 'tomorrow_revisit', label: '\u660e\u5929', proof: 'next_day_revisit_result' },
        { id: 'day3_wrong_cause_replay', label: '\u7b2c 3 \u5929', proof: 'wrong_cause_replayed_without_full_answer' },
        { id: 'day7_transfer_gate', label: '\u7b2c 7 \u5929', proof: 'near_transfer_gate_passed' }
      ],
      localAiBoundary: {
        localCodeOwns: ['recall_schedule', 'xp_gate', 'portrait_release_gate'],
        aiOwns: ['child_friendly_rewrite'],
        aiMustNotOwn: ['final_answer', 'mastery_claim']
      },
      shareCard: {
        blockedFields: ['original_question', 'full_solution', 'score', 'ranking']
      }
    }
  }
});
assert.strictEqual(returnContractReport.reportDraft.dailyReturnContract.id, 'daily_return_contract', 'learning report carries the daily return contract');
assert(returnContractReport.dailyReturnContract.loop.some((item) => item.id === 'day7_transfer_gate'), 'daily return contract preserves the day-7 portrait gate');
assert(returnContractReport.dailyReturnContract.shareCard.blockedFields.includes('full_solution'), 'daily return contract preserves safe-share blocked fields');
assert.strictEqual(returnContractReport.reportDraft.reviewReturnSeed.id, 'review_return_seed', 'learning report carries the review return seed');
assert.strictEqual(returnContractReport.gameReturnEvidence.status, 'ready', 'learning report builds game return evidence from the arcade/review loop');
assert(returnContractReport.gameReturnEvidence.nextDayCardIds.includes('card_wrong_1'), 'game return evidence preserves next-day recall card ids');
assert(returnContractReport.gameReturnEvidence.blockedFields.includes('full_solution') && returnContractReport.gameReturnEvidence.blockedFields.includes('ranking'), 'game return evidence preserves safe-share blocklist');
assert(returnContractReport.gameReturnEvidence.localCodeOwns.includes('queue_order'), 'game return evidence keeps queue ownership in local code');
assert(returnContractReport.reportDraft.gameReturnEvidence.releaseGate === 'first_step_and_wrong_cause_before_xp_or_share', 'game return evidence keeps XP/share release gate');
assert(returnContractReport.reportDraft.openMaicInspiredDecisionBridge && returnContractReport.reportDraft.openMaicInspiredDecisionBridge.id === 'openmaic_inspired_decision_bridge', 'learning report exposes an OpenMAIC-inspired decision bridge');
assert(returnContractReport.openMaicInspiredDecisionBridge.sourcePolicy.decision === 'reference_workflow_only', 'OpenMAIC-inspired bridge keeps reference-only source policy');
assert(returnContractReport.openMaicInspiredDecisionBridge.localCodeOwns.includes('reward_release'), 'OpenMAIC-inspired bridge keeps reward release in local code');
assert(returnContractReport.openMaicInspiredDecisionBridge.aiMustNotDecide.includes('final_answer'), 'OpenMAIC-inspired bridge blocks AI final-answer decisions');
assert(returnContractReport.openMaicInspiredDecisionBridge.shareRelayPayload.blockedFields.includes('original_question'), 'OpenMAIC-inspired bridge exposes safe share blocked fields');
assert(returnContractReport.openMaicInspiredDecisionBridge.gameReturnEvidence.status === 'openmaic_inspired_revisit_gate', 'OpenMAIC-inspired bridge exposes game revisit gate evidence');
assert(!returnContractReport.openMaicInspiredDecisionBridge.productBoundaryLine.includes('完整课堂'), 'OpenMAIC-inspired bridge avoids promising full classroom generation');
assert(returnContractReport.reportDraft.aiLocalImplementationMatrix && returnContractReport.reportDraft.aiLocalImplementationMatrix.rowCount >= 7, 'learning report builds an AI/local implementation matrix');
assert(returnContractReport.aiLocalImplementationMatrix.rows.some((item) => item.id === 'game_retention' && item.localCodeOwns.includes('xp_gate')), 'AI/local matrix keeps game retention gates in local code');
assert(returnContractReport.aiLocalImplementationMatrix.rows.some((item) => item.id === 'socratic_tutoring' && item.aiBetterFor.some((line) => line.includes('追问'))), 'AI/local matrix assigns Socratic wording to AI');
assert(returnContractReport.aiLocalImplementationMatrix.aiMustNotOwn.includes('最终答案') && returnContractReport.aiLocalImplementationMatrix.blockedFields.includes('ranking'), 'AI/local matrix blocks answers and ranking fields');

const fast = report.buildLearningReportDraft({
  sourceText: '数学 82，应用题总卡在列式，题目一多就不知道先写什么。',
  mode: 'fast'
});
assert.strictEqual(fast.reportDraft.mode, 'fast', 'single input can generate fast report');
assert(fast.reportCompleteness >= 28, 'fast report still has minimum completeness');
assert(fast.reportDraft.overview.evidence.length > 0, 'fast report carries evidence');
assert(fast.recommendationPlan.cta.path, 'fast report ends with an app solution path');

const answers = report.buildQuickAssessmentQuestions().map((question) => ({
  id: question.id,
  optionId: question.options[0].id,
  confidence: 0.86,
  source: 'unit_test'
}));

const full = report.buildLearningReportDraft({
  sourceType: 'score_sheet',
  sourceText: `
语文分数 107.5 班名 8
数学分数 117 班名 15
英语分数 116 班名 5
物理分数 86 班名 6
化学分数 40 班名 29
生物分数 60 班名 13
总分 526.5 班级排名 8
学习类型：听觉型
行为导向：动机型
`,
  profileBasics: { grade: '高三', age: 17, gender: '男', region: '江苏', schoolType: '公办' },
  behaviorSignals: { studyMinutes: 180, homeworkMinutes: 120, sleepHours: 7, focusRating: 3 },
  emotionSignals: { anxiety: '中', communication: '每周 2 次', willingness: '愿意改方法', goalSense: '升学目标明确' },
  interestSignals: { tags: '篮球、科技', strengths: '愿意复述题意', aspiration: '想提升化学' },
  assessmentAnswers: answers,
  gameEvidence: {
    highFrequencyPracticeLoop: {
      socraticQualityMemoryBridge: {
        scenarioCount: 40,
        memoryActions: [
          { id: 'silent_child', title: '沉默时先做 A/B 回忆', memoryAction: '先选方向', evidence: 'child_micro_choice', route: '/pages/tutor/tutor' },
          { id: 'answer_request', title: '要答案时拦完整答案', memoryAction: '回到第一步', evidence: 'blocked_full_answer', route: '/pages/tutor/tutor' },
          { id: 'wrong_axis', title: '答偏时回到误区轴', memoryAction: '错因卡先回放', evidence: 'socratic_axis_evidence', route: '/pages/review/review' },
          { id: 'transfer_fail', title: '迁移失败时做次日回访', memoryAction: '明天换一题', evidence: 'next_day_transfer_check', route: '/pages/review/review' }
        ],
        xpGate: '只有说出第一步、完成错因回放或次日回访，才发放 XP；盲刷题量不加分。',
        parentLine: '家长只看孩子是否说出第一步、是否完成回访。',
        privacyBoundary: '不带原题照片、完整对话、分数、排名、私密评价或原始答案。',
        evidenceRequired: ['socratic_quality_scenario', 'first_step_recall', 'blocked_answer_boundary', 'wrong_axis_replay', 'next_day_transfer_check']
      },
      questionBankMemoryBridge: {
        status: 'ready',
        questionCardCount: 63,
        activeCardCount: 4,
        masteryGateCount: 63,
        progressionStageCount: 378,
        activeDeck: [
          { id: 'qb_1', label: '应用题数量关系', firstStep: '先圈总量和剩余量', masteryGate: '能解释数量关系', parentCheck: '只问第一步', nextDayRevisit: '明天换数字回访' },
          { id: 'qb_2', label: '方程等量关系', firstStep: '先找等量句', masteryGate: '能列出等量关系', parentCheck: '只问等量句', nextDayRevisit: '明天换情境回访' },
          { id: 'qb_3', label: '单位换算', firstStep: '先统一单位', masteryGate: '能说明换算理由', parentCheck: '只问单位', nextDayRevisit: '明天换单位回访' },
          { id: 'qb_4', label: '近迁移变式', firstStep: '先判断条件变化', masteryGate: '能说出变式差异', parentCheck: '只问变化点', nextDayRevisit: '第 7 天回访' }
        ],
        reviewWindows: [
          { id: 'tonight', label: '今晚', action: '主动回忆 3 张题型卡' },
          { id: 'tomorrow', label: '明天', action: '回访最不稳的一张卡' },
          { id: 'day_7', label: '第 7 天', action: '做一个小变式' }
        ],
        xpGate: '题型卡只有通过第一步、错因复述和次日回访，才进入 XP；只刷数量不加分。',
        parentDecisionLine: '家长报告只看题型掌握门槛、错因是否复现和明天回访，不看分数排行。',
        reportLine: '题库已把 4 张题型卡接入高频记忆训练。',
        privacyBoundary: '不分享原题照片、完整答案、分数、排名和孩子私密评价。',
        evidenceRequired: ['course_unit_question_bank', 'mastery_gate', 'active_recall', 'wrong_cause_replay', 'next_day_revisit']
      },
      questionBankRecallWorkout: {
        status: 'ready',
        mode: 'rescue',
        title: '题库分层回忆训练',
        greenWordClozeProtocol: {
          id: 'green_word_cloze_protocol',
          status: 'ready',
          title: '绿色考点挖空',
          clozeCards: [
            { id: 'green_1', label: '数量关系', targetKeyword: '第一步', clozePrompt: '先补出____', nextMode: 'cloze', parentCheck: '明天还能说第一步吗？' },
            { id: 'green_2', label: '等量关系', targetKeyword: '等量句', clozePrompt: '先找____', nextMode: 'typed_recall', parentCheck: '明天还能说等量句吗？' }
          ],
          progressiveQuizModes: [
            { id: 'cloze', label: '挖空', rule: '先补一个关键词或第一步动作。' },
            { id: 'typed_recall', label: '输入回忆', rule: '不看答案，用自己的话写第一步。' },
            { id: 'wrong_cause_choice', label: '错因选择', rule: '从两个错因里选更像自己的那个。' },
            { id: 'near_transfer', label: '近迁移', rule: '换材料后只说哪里没变。' }
          ],
          localCodeOwns: ['keyword_selection', 'cloze_order', 'reward_gate', 'spaced_revisit', 'share_blocked_fields'],
          aiMayRewrite: ['prompt_copy', 'parent_friendly_wording'],
          aiMustNotOwn: ['target_keyword_source', 'final_answer', 'mastery_claim', 'xp_release', 'share_fields'],
          releaseGate: '只有补出关键词、说出第一步并锁定明天回访，才放行 XP 或分享。',
          shareBoundary: '分享只带关键词类别、第一步动作和回访窗口，不带原题、答案、分数、排名或完整对话。'
        },
        workoutCards: [
          { id: 'recall_1', label: '数量关系', action: '先闭眼说第一步', proof: 'first_step_recall', targetKeyword: '第一步', clozePrompt: '先补出____', nextMode: 'cloze' },
          { id: 'recall_2', label: '等量关系', action: '说错因再重做', proof: 'wrong_cause_replay', targetKeyword: '等量句', clozePrompt: '先找____', nextMode: 'typed_recall' },
          { id: 'recall_3', label: '单位换算', action: '明天换数字回访', proof: 'next_day_revisit', targetKeyword: '单位', clozePrompt: '先统一____', nextMode: 'wrong_cause_choice' }
        ],
        phases: [
          { id: 'active_recall', label: '主动回忆', rule: '不看答案先说入口' },
          { id: 'wrong_cause', label: '错因重放', rule: '同错因必须复述' },
          { id: 'spaced_revisit', label: '间隔回访', rule: '明天和第 7 天复核' },
          { id: 'near_transfer', label: '近迁移', rule: '只换一个条件' }
        ],
        parentDecisionLine: '家长只判断是否能说第一步和错因，不看分数排名。',
        noCramRule: '单次正确不升级长期画像；必须有明天回访和第 7 天小变式。',
        shareBoundary: '分享只带训练主题、第一步和回访时间，不带原题、答案、分数、排名或完整对话。',
        intensityLine: '今晚最多 3 张卡，不刷量。',
        returnWindowLine: '今晚、明天、第 7 天三次回访。',
        evidenceRequired: ['question_bank_recall_workout', 'active_recall_phase', 'wrong_cause_phase', 'spaced_revisit_phase', 'parent_decision_line', 'safe_share_boundary']
      },
      adaptiveRecallScheduler: {
        mode: 'leech_rescue_schedule',
        schedulerBoxes: [
          { id: 'box_0_now', label: '现在急救', window: '今晚', unlockRule: '只要孩子能说第一步，不要求完整解法。' },
          { id: 'box_1_tomorrow', label: '明天回访', window: '明天', unlockRule: '隔天仍能说出第一步，才算记住。' },
          { id: 'box_2_day3', label: '第3天变式', window: '第 3 天', unlockRule: '错因稳定后才开放小变式。' },
          { id: 'box_3_day7', label: '第7天画像', window: '第 7 天', unlockRule: '第 7 天仍能迁移，才写入长期画像。' }
        ],
        reviewQueue: [
          { id: 'rq_1', label: '数量关系', dueWindow: '今晚', releaseEvidence: 'child_first_step' },
          { id: 'rq_2', label: '等量关系', dueWindow: '明天', releaseEvidence: 'next_day_revisit' },
          { id: 'rq_3', label: '单位换算', dueWindow: '第 3 天', releaseEvidence: 'near_transfer_attempt' },
          { id: 'rq_4', label: '近迁移变式', dueWindow: '第 7 天', releaseEvidence: 'long_term_portrait_gate' }
        ],
        unlockRules: ['没有第一步证据，不进入明天回访。', '没有明天回访，不进入第 3 天变式。', '没有第 7 天迁移，不写入长期画像。'],
        leechRules: ['同一错因连续 2 次失败，回到现在急救盒。', '急救盒只做旧卡，不加新题量。', '急救通过后仍要等明天回访确认。'],
        xpGate: 'XP 跟随调度盒释放：现在只给行为证据，明天回访后才进入掌握记录。',
        parentLine: '家长只看卡片在哪个盒子：现在急救、明天回访、第3天变式、第7天画像。',
        shareBoundary: '调度分享只带盒子、动作和回访窗口，不带原题照片、完整答案、完整对话、分数或排名。',
        evidenceRequired: ['adaptive_recall_scheduler', 'scheduler_boxes', 'review_queue', 'unlock_rules', 'safe_share_boundary']
      }
    }
  }
});
assert(full.reportCompleteness >= 80, 'full report reaches full completeness with rich inputs');
assert.strictEqual(full.reportDraft.mode, 'full', 'rich inputs produce full mode');
assert(full.reportDraft.familyLearningDecisionReport, 'full report includes the productized family learning decision report');
assert(full.familyLearningDecisionReport && full.familyLearningDecisionReport.engineVersion === 'family-report-engine.v1', 'family learning decision report is returned from the guarded local engine');
assert(full.familyLearningDecisionReport.qualityCheck && full.familyLearningDecisionReport.qualityCheck.score >= 85, 'family learning decision report passes the parent preview quality gate');
assert.strictEqual(full.familyReportQualityCheck.score, full.familyLearningDecisionReport.qualityCheck.score, 'family report quality check is mirrored for UI gating');
assert(Array.isArray(full.familyLearningDecisionReport.sevenDayPlan) && full.familyLearningDecisionReport.sevenDayPlan.length === 7, 'family learning decision report carries a complete 7-day validation plan');
assert(full.familyLearningDecisionReport.parentTonightCard && full.familyLearningDecisionReport.parentTonightCard.dontSay.length >= 2 && full.familyLearningDecisionReport.parentTonightCard.canSay.length >= 2, 'family learning decision report carries parent tonight wording');
assert(full.familyLearningDecisionReport.inputGuard && Array.isArray(full.familyLearningDecisionReport.inputGuard.missingFields), 'family learning decision report exposes fact guard status');
assert(full.reportDraft.capabilityTendencies.length >= 2, 'full report builds capability tendencies');
assert(full.reportDraft.diagnosisMatrix.some((item) => item.subject === '化学' && item.status === '需要支持'), 'full report identifies the weakest available subject as support-needed');
assert(full.reportDraft.rootCauses.every((item) => item.evidence && item.evidence.length && item.confidence && Array.isArray(item.missing)), 'root causes are evidence anchored');
assert(full.reportDraft.longTermPortrait && full.reportDraft.longTermPortrait.evidenceToCollect.length >= 1, 'full report builds a long-term learning portrait with next evidence');
assert(full.reportDraft.classroomDecisionBoard && full.reportDraft.classroomDecisionBoard.decisionLine && full.reportDraft.classroomDecisionBoard.stopRule, 'full report builds a classroom-level decision board');
assert(full.reportDraft.familyDecisionMemo && full.reportDraft.familyDecisionMemo.tonightDecision && full.reportDraft.familyDecisionMemo.sevenDayDecisionGate, 'full report builds a family decision memo');
assert(full.reportDraft.tonightDecisionBrief && full.reportDraft.tonightDecisionBrief.title === '今晚决策书', 'full report builds a parent-readable tonight decision brief');
assert(full.reportDraft.tonightDecisionBrief.tonightDo.length >= 3 && full.reportDraft.tonightDecisionBrief.tonightDoNot.length === 3, 'tonight decision brief names what to do and not do tonight');
assert(full.reportDraft.tonightDecisionBrief.stopConditions.length >= 3 && full.reportDraft.tonightDecisionBrief.evidenceChecklist.includes('safe_share_boundary'), 'tonight decision brief has stop conditions and evidence gates');
assert(full.reportDraft.tonightDecisionBrief.sharePayload.allowed_fields.includes('tonight_action') && full.reportDraft.tonightDecisionBrief.sharePayload.blocked_fields.includes('original_question'), 'tonight decision brief has safe relay allowed and blocked fields');
assert(full.reportDraft.portraitConfidenceSystem && full.reportDraft.portraitConfidenceSystem.evidenceLedger.length >= 4, 'full report builds a portrait confidence evidence ledger');
assert(full.reportDraft.portraitConfidenceSystem.decisionThresholds.length >= 4, 'portrait confidence system carries decision thresholds');
assert(full.reportDraft.portraitConfidenceSystem.observationCadence.length === 4, 'portrait confidence system carries tonight/tomorrow/day-3/day-7 cadence');
assert(full.reportDraft.portraitConfidenceSystem.parentTrustContract && full.reportDraft.portraitConfidenceSystem.parentTrustContract.doNotShow.includes('完整对话'), 'portrait confidence system keeps parent report privacy-safe');
assert(full.reportDraft.parentDecisionTrustSystem && full.reportDraft.parentDecisionTrustSystem.decisionDeck.length >= 4, 'full report builds a parent decision trust system with decision cards');
assert(full.reportDraft.parentDecisionTrustSystem.guardrails.length >= 4 && full.reportDraft.parentDecisionTrustSystem.weeklyDecisionReview.length === 4, 'parent decision trust system carries guardrails and weekly review cadence');
assert(full.parentDecisionTrustSystem && full.parentDecisionTrustSystem.shareBoundary.includes('完整对话'), 'parent decision trust system is returned and keeps sharing privacy-safe');
assert(full.reportDraft.portraitEvidenceMaturitySystem && full.reportDraft.portraitEvidenceMaturitySystem.maturityLanes.length >= 4, 'full report builds a portrait evidence maturity system');
assert(full.reportDraft.portraitEvidenceMaturitySystem.decisionLocks.length >= 4 && full.reportDraft.portraitEvidenceMaturitySystem.updateGateMirror.length >= 4, 'portrait evidence maturity system carries decision locks and update gate mirrors');
assert(full.portraitEvidenceMaturitySystem && full.portraitEvidenceMaturitySystem.shareBoundary.includes('完整对话'), 'portrait evidence maturity system is returned and privacy-safe');
assert(full.reportDraft.socraticMemoryReportBridge && full.reportDraft.socraticMemoryReportBridge.scenarioCount >= 40, 'full report consumes Socratic quality memory evidence');
assert(full.reportDraft.socraticMemoryReportBridge.reportActions.length >= 4, 'Socratic memory report bridge turns game feedback into parent-visible report actions');
assert(full.reportDraft.socraticMemoryReportBridge.noIncreaseRule.includes('盲刷题量不加分'), 'Socratic memory report bridge preserves the no-blind-practice XP gate');
assert(full.socraticMemoryReportBridge && full.socraticMemoryReportBridge.shareBoundary.includes('完整对话'), 'Socratic memory report bridge keeps report sharing privacy-safe');
assert(full.reportDraft.questionBankDecisionBridge && full.reportDraft.questionBankDecisionBridge.questionCardCount >= 63, 'full report consumes question-bank memory evidence');
assert(full.reportDraft.questionBankDecisionBridge.activeDeck.length >= 4, 'question-bank decision bridge turns active cards into parent-visible actions');
assert(full.reportDraft.questionBankDecisionBridge.decisionLine.includes('掌握门槛'), 'question-bank decision bridge gives a parent decision rule');
assert(full.questionBankDecisionBridge && full.questionBankDecisionBridge.privacyBoundary.includes('分数'), 'question-bank decision bridge keeps report sharing privacy-safe');
assert(full.reportDraft.questionBankRecallReportBridge && full.reportDraft.questionBankRecallReportBridge.workoutCardCount >= 3, 'full report consumes question-bank recall workout evidence');
assert(full.reportDraft.questionBankRecallReportBridge.phaseCount >= 4, 'question-bank recall report bridge carries layered recall phases');
assert(full.reportDraft.questionBankRecallReportBridge.greenWordLine.includes('挖空关键词'), 'question-bank recall report bridge carries green-word cloze summary');
assert(full.reportDraft.questionBankRecallReportBridge.greenWordCards.length >= 2, 'question-bank recall report bridge exposes green-word cards');
assert(full.reportDraft.questionBankRecallReportBridge.greenWordModes.some((item) => item.id === 'cloze'), 'question-bank recall report bridge exposes progressive quiz modes');
assert(full.reportDraft.questionBankRecallReportBridge.noCramRule.includes('长期画像'), 'question-bank recall report bridge preserves the no-cram portrait rule');
assert(full.questionBankRecallReportBridge && full.questionBankRecallReportBridge.shareBoundary.includes('完整对话'), 'question-bank recall report bridge keeps sharing privacy-safe');
assert(full.reportDraft.portraitDecisionReleaseSystem && full.reportDraft.portraitDecisionReleaseSystem.releaseLanes.length >= 4, 'full report builds a portrait decision release system');
assert(full.reportDraft.portraitDecisionReleaseSystem.releaseLocks.length >= 4 && full.reportDraft.portraitDecisionReleaseSystem.actionQueue.length >= 4, 'portrait decision release system carries locks and action queue');
assert(full.reportDraft.portraitDecisionReleaseSystem.releaseLanes.some((item) => item.id === 'day7_portrait') && full.reportDraft.portraitDecisionReleaseSystem.evidenceRequired.includes('long_term_portrait_gate'), 'portrait decision release system gates long-term portrait by day-7 evidence');
assert(full.portraitDecisionReleaseSystem && full.portraitDecisionReleaseSystem.shareBoundary.includes('完整答案'), 'portrait decision release system is returned and privacy-safe');
assert(full.reportDraft.reportEvidenceReleaseGate && full.reportDraft.reportEvidenceReleaseGate.localDeterministic === true, 'full report builds a deterministic report evidence release gate');
assert(full.reportEvidenceReleaseGate && full.reportEvidenceReleaseGate.singleSampleLock.status === 'locked', 'report evidence release gate blocks single-question overdiagnosis');
assert(full.reportEvidenceReleaseGate.day7Gate.requiredEvidence.includes('day7_variant_result') && full.reportEvidenceReleaseGate.twoWeekStabilityGate.requiredEvidence.includes('two_week_stability_check'), 'report evidence release gate requires day-7 and two-week stability evidence');
assert(full.reportEvidenceReleaseGate.actualLongitudinalEvidence && typeof full.reportEvidenceReleaseGate.actualLongitudinalEvidence.nextDayRevisitCount === 'number', 'report evidence release gate exposes actual longitudinal evidence');
assert(['original_question', 'photo', 'full_answer', 'full_dialogue', 'score', 'ranking'].every((field) => full.reportEvidenceReleaseGate.homeSchoolSafeHandoff.blockedFields.includes(field)), 'report evidence release gate blocks unsafe home-school fields');
assert(['child_name', 'parent_phone', 'parent_wechat', 'contact_info'].every((field) => full.reportEvidenceReleaseGate.homeSchoolSafeHandoff.blockedFields.includes(field)), 'report evidence release gate blocks identity/contact home-school fields');
assert(full.reportEvidenceReleaseGate.aiBoundary.includes('本地代码决定'), 'report evidence release gate keeps AI limited to expression');
assert(full.reportDraft.parentDecisionBook && full.reportDraft.parentDecisionBook.title === '家长决策书', 'full report builds a parent decision book');
assert(full.parentDecisionBook && full.parentDecisionBook.routeActions.length >= 3, 'parent decision book is returned with concrete route actions');
assert(full.parentDecisionBook.sharePolicy.blockedFields.includes('full_answer') || full.parentDecisionBook.sharePolicy.blockedFields.includes('完整答案'), 'parent decision book blocks unsafe answer sharing');
assert(['child_name', 'parent_phone', 'parent_wechat', 'contact_info'].every((field) => full.parentDecisionBook.sharePolicy.blockedFields.includes(field)), 'parent decision book blocks identity/contact sharing');

assert(full.reportDraft.commercialFamilySolutionBook && full.commercialFamilySolutionBook, 'full report returns a commercial family solution book');
assert(full.commercialFamilySolutionBook.pages.map((item) => item.id).join('|') === 'one_page_diagnosis|method_candidates|seven_day_action|parent_script|review_evidence|next_service', 'commercial family solution book follows diagnosis, methods, 7-day action, script, evidence, next-service page order');
assert(full.commercialFamilySolutionBook.sharePolicy.blockedFields.includes('full_answer') || full.commercialFamilySolutionBook.sharePolicy.blockedFields.includes('瀹屾暣绛旀'), 'commercial family solution book reuses safe share policy');
assert(full.commercialFamilySolutionBook.commercialLoop.length === 5, 'commercial family solution book closes partner upload, AI interpretation, execution, parent report, and service conversion');

const noLongitudinal = report.buildLearningReportDraft({
  sourceText: '数学应用题卡在列式，今晚只记录孩子第一步。',
  behaviorSignals: { wrongCause: '不会列式', firstStep: '待孩子说出第一步' }
});
assert.strictEqual(noLongitudinal.reportEvidenceReleaseGate.day7Gate.status, 'blocked', 'without day-7 evidence report gate blocks day-7 release');
assert.strictEqual(noLongitudinal.reportEvidenceReleaseGate.twoWeekStabilityGate.status, 'blocked', 'without two-week evidence report gate blocks stability release');
assert.notStrictEqual(noLongitudinal.reportEvidenceReleaseGate.releaseDecision, 'home_school_safe_handoff', 'without both longitudinal gates report cannot enter safe handoff');

const onlyDay7 = report.buildLearningReportDraft({
  sourceText: '数学应用题卡在列式，已经做了第 7 天小变式。',
  behaviorSignals: { nextDayRevisitCount: 2, day7VariantStatus: 'passed' }
});
assert.strictEqual(onlyDay7.reportEvidenceReleaseGate.day7Gate.status, 'candidate', 'day-7 evidence can unlock candidate day-7 gate');
assert.strictEqual(onlyDay7.reportEvidenceReleaseGate.twoWeekStabilityGate.status, 'blocked', 'day-7 evidence alone does not unlock two-week gate');
assert.notStrictEqual(onlyDay7.reportEvidenceReleaseGate.releaseDecision, 'home_school_safe_handoff', 'day-7 evidence alone cannot enter safe handoff');

const onlyTwoWeek = report.buildLearningReportDraft({
  sourceText: '数学应用题卡在列式，两周内家长观察到方法比较稳定。',
  behaviorSignals: { twoWeekStabilityStatus: 'stable' }
});
assert.strictEqual(onlyTwoWeek.reportEvidenceReleaseGate.day7Gate.status, 'blocked', 'two-week signal without day-7 variant still blocks day-7 gate');
assert.strictEqual(onlyTwoWeek.reportEvidenceReleaseGate.twoWeekStabilityGate.status, 'candidate', 'two-week stability signal can unlock stability gate');
assert.notStrictEqual(onlyTwoWeek.reportEvidenceReleaseGate.releaseDecision, 'home_school_safe_handoff', 'two-week evidence alone cannot enter safe handoff');
assert(full.reportDraft.sourceEvidenceLedger && full.reportDraft.sourceEvidenceLedger.lanes.length === 5, 'full report builds a five-lane source evidence ledger');
assert(full.sourceEvidenceLedger && full.sourceEvidenceLedger.localRule.includes('本地代码决定'), 'source evidence ledger keeps release decisions local');
assert(full.sourceEvidenceLedger.aiBoundary.includes('不做天赋定性'), 'source evidence ledger blocks AI talent determination');
assert(full.sourceEvidenceLedger.lanes.some((item) => item.id === 'talent_assessment' && item.aiBlocked.includes('天赋定性')), 'source ledger carries talent assessment guardrail');
assert(full.sourceEvidenceLedger.lanes.some((item) => item.id === 'wrong_question_paper' && item.aiBlocked.includes('完整答案')), 'source ledger carries wrong-paper answer boundary');
assert(full.sourceEvidenceLedger.lanes.some((item) => item.id === 'school_material' && item.canProduce.includes('家校沟通摘要')), 'source ledger turns school material into home-school digest');
assert(full.sourceEvidenceLedger.evidenceRequired.includes('safe_handoff_fields'), 'source ledger requires safe handoff fields');
assert(Array.isArray(full.sourceEvidenceLedger.nextEvidenceQueue) && full.sourceEvidenceLedger.nextEvidenceQueue.length > 0, 'source ledger exposes next evidence queue');
assert(typeof full.sourceEvidenceLedger.nextEvidenceLine === 'string' && full.sourceEvidenceLedger.nextEvidenceLine.length > 0, 'source ledger exposes next evidence line');
assert(full.reportDraft.uploadedMaterialDecisionDossier && full.uploadedMaterialDecisionDossier, 'full report builds an uploaded-material decision dossier');
assert(full.uploadedMaterialDecisionDossier.materialLanes.some((item) => item.id === 'talent_assessment' && item.cannotSay.includes('天赋')), 'uploaded-material dossier keeps talent assessment as a non-label method candidate');
assert(full.uploadedMaterialDecisionDossier.materialLanes.some((item) => item.id === 'wrong_question_paper' && item.output.includes('错因卡')), 'uploaded-material dossier turns wrong papers into wrong-cause and first-step actions');
assert(full.uploadedMaterialDecisionDossier.materialLanes.some((item) => item.id === 'score_sheet' && item.cannotSay.includes('保分') && item.output.includes('私密优先级')), 'uploaded-material dossier treats scores as private priority signals');
assert(full.uploadedMaterialDecisionDossier.howToLearnBetter.every((item) => item.method && item.childLine && item.parentCheck), 'uploaded-material dossier explains how each method candidate should be tried by child and parent');
assert(Array.isArray(full.uploadedMaterialDecisionDossier.methodCandidateCards) && full.uploadedMaterialDecisionDossier.methodCandidateCards.length >= 3, 'uploaded-material dossier exposes explicit method candidate cards');
assert(full.uploadedMaterialDecisionDossier.methodCandidateCards.every((item) => item.tonightTry && item.tonightWrongQuestionTest && item.parentQuestionTomorrow && item.day7Evidence), 'method candidate cards carry tonight test, wrong-question validation, tomorrow parent question, and day-7 evidence');
assert(full.uploadedMaterialDecisionDossier.methodCandidateCards.every((item) => item.sourceSchemaId && item.sourceTextEvidence && item.confidenceReason), 'method candidate cards bind back to uploaded source, evidence text, and confidence reason');
assert(full.uploadedMaterialDecisionDossier.methodCandidateCards.every((item) => item.blockedClaims.includes('天赋定性') && item.blockedClaims.includes('完整答案')), 'method candidate cards block talent labels and full answers');
assert(full.uploadedMaterialDecisionDossier.evidenceBasedMethodologyGuide.cards.length >= 7, 'uploaded-material dossier exposes a broad parent-readable methodology guide');
assert(full.uploadedMaterialDecisionDossier.evidenceBasedMethodologyGuide.cards.every((item) => item.principle && item.useWhen && item.reportLine && item.productRoute && item.evidenceGate), 'methodology cards carry principle, fit, report copy, route, and evidence gate');
assert(full.uploadedMaterialDecisionDossier.evidenceBasedMethodologyGuide.reportWritingRules.some((line) => line.includes('方法候选')), 'methodology guide tells the report to write method candidates, not labels');
assert(full.uploadedMaterialDecisionDossier.evidenceBasedMethodologyGuide.reportWritingRules.some((line) => line.includes('迁移验证')), 'methodology guide requires transfer validation coverage');
assert(full.uploadedMaterialDecisionDossier.familyDecisionCalendar && full.uploadedMaterialDecisionDossier.familyDecisionCalendar.weeks.length === 4, 'uploaded-material dossier builds a tonight/tomorrow/day7/day30 family decision calendar');
assert(full.uploadedMaterialDecisionDossier.familyDecisionCalendar.monthlyReview.doNotSay.includes('天赋定性') && full.uploadedMaterialDecisionDossier.familyDecisionCalendar.monthlyReview.nextEvidence.includes('two_week_stability_check'), 'family decision calendar blocks talent labels and requires monthly stability evidence');
assert(full.uploadedMaterialDecisionDossier.familyPrivateTutorSolutionPack, 'uploaded-material dossier builds a family private tutor solution pack');
assert(full.uploadedMaterialDecisionDossier.familyPrivateTutorSolutionPack.positioning.includes('不是 AI 课堂平台'), 'private tutor solution pack preserves non-classroom positioning');
assert(full.uploadedMaterialDecisionDossier.familyPrivateTutorSolutionPack.modeOrchestration.some((item) => item.id === 'three_minute_mini_lesson' && item.localGate === 'child_exit_ticket_before_practice'), 'private tutor solution pack gates mini-lesson exit before practice');
assert(full.uploadedMaterialDecisionDossier.familyPrivateTutorSolutionPack.modeOrchestration.some((item) => item.id === 'active_recall_game' && item.localGate === 'real_recall_source_and_no_answer_leak'), 'private tutor solution pack blocks game recall until real recall source exists');
assert(full.uploadedMaterialDecisionDossier.familyPrivateTutorSolutionPack.deliveryLoop.length === 4, 'private tutor solution pack carries tonight, tomorrow, day7, and day14 delivery loop');
assert(full.uploadedMaterialDecisionDossier.familyPrivateTutorSolutionPack.commercialHandoff.mustNotSellAs.includes('自动判分') && full.uploadedMaterialDecisionDossier.familyPrivateTutorSolutionPack.commercialHandoff.mustNotSellAs.includes('结果承诺'), 'commercial handoff blocks auto grading and guaranteed improvement claims');
assert(full.uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint, 'uploaded-material dossier builds a personalized learning solution blueprint');
assert(full.uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint.recommendedMode && full.uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint.recommendedMode.entryRoute, 'solution blueprint recommends an executable product mode');
assert(full.uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint.modeSequence.length === 4, 'solution blueprint sequences private tutor, mini-lesson, active recall, and parent report');
assert(full.uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint.evidenceFusionRules.length === 5, 'solution blueprint fuses talent, score, wrong-paper, school, and parent materials');
assert(full.uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint.familyLearningPlan, 'solution blueprint builds an executable family learning plan');
assert(full.uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint.familyLearningPlan.sourceWeights.length === 5, 'family learning plan weighs talent, score, wrong-paper, school, and parent materials');
assert(full.uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint.familyLearningPlan.tonightAction && full.uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint.familyLearningPlan.tomorrowRevisit && full.uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint.familyLearningPlan.day7Evidence && full.uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint.familyLearningPlan.parentAssistLine, 'family learning plan contains tonight, tomorrow, day-7, and parent-assist actions');
assert(full.uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint.familyLearningPlan.prohibitedConclusions.includes('天赋定性') && full.uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint.familyLearningPlan.prohibitedConclusions.includes('整卷答案'), 'family learning plan blocks talent determination and full-paper answers');
assert(full.uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint.familyLearningPlan.modeFit.socraticTutor && full.uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint.familyLearningPlan.modeFit.miniLesson && full.uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint.familyLearningPlan.modeFit.gameRecall && full.uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint.familyLearningPlan.modeFit.parentReport, 'family learning plan maps source evidence to Socratic, mini-lesson, game recall, and parent report');
assert(full.uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint.localVsAiOwnership.some((item) => item.id === 'local_code') && full.uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint.localVsAiOwnership.some((item) => item.id === 'ai'), 'solution blueprint separates local-code gates from AI wording');
assert(full.uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint.blockedClaims.includes('固定天赋标签') && full.uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint.blockedClaims.includes('整卷答案'), 'solution blueprint blocks talent labels and full-paper answers');
assert(full.uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint.primaryMethodCandidate && full.uploadedMaterialDecisionDossier.personalizedLearningSolutionBlueprint.primaryMethodCandidate.confidenceReason, 'solution blueprint carries the ranked primary method candidate and evidence reason');
assert(full.uploadedMaterialDecisionDossier.wrongPaperDiagnosisCards.length >= 3 && full.uploadedMaterialDecisionDossier.wrongPaperDiagnosisCards.every((item) => item.rule && item.nextAction), 'uploaded-material dossier turns wrong papers into detailed diagnosis cards');
assert(full.uploadedMaterialDecisionDossier.detailedReportSections.length >= 4 && full.uploadedMaterialDecisionDossier.detailedReportSections.some((item) => item.id === 'evidence_roadmap'), 'uploaded-material dossier includes detailed report sections and a long-term evidence roadmap');
assert(full.uploadedMaterialDecisionDossier.aiLocalSplit.some((item) => item.id === 'local') && full.uploadedMaterialDecisionDossier.aiLocalSplit.some((item) => item.id === 'ai') && full.uploadedMaterialDecisionDossier.aiLocalSplit.some((item) => item.id === 'blocked'), 'uploaded-material dossier separates local rules, AI expression, and blocked decisions');
assert(full.uploadedMaterialDecisionDossier.releaseGate.blockedFields.includes('talent_label') && full.uploadedMaterialDecisionDossier.shareSafePayload.blockedFields.includes('full_answer'), 'uploaded-material dossier blocks labels and full answers from share/report release');
assert(full.reportDraft.crossWeekTrendBoard && full.reportDraft.crossWeekTrendBoard.trendRows.length >= 3, 'full report builds a cross-week trend board');
assert(full.crossWeekTrendBoard && full.crossWeekTrendBoard.evidenceRequired.includes('two_week_stability_check'), 'cross-week trend board is returned and requires two-week stability evidence');
assert(['原题', '答案', '分数', '排名', '完整对话'].every((word) => full.crossWeekTrendBoard.shareBoundary.indexOf(word) >= 0), 'cross-week trend board blocks unsafe share fields');
assert(full.reportDraft.homeSchoolCollaborationDigest && full.reportDraft.homeSchoolCollaborationDigest.evidencePacket.length >= 4, 'full report builds a home-school collaboration digest');
assert(full.homeSchoolCollaborationDigest && full.homeSchoolCollaborationDigest.teacherDo.length >= 3 && full.homeSchoolCollaborationDigest.parentDo.length >= 3, 'home-school digest is returned and carries teacher/parent action lists');
assert(['原题照片', '完整答案', '完整对话', '分数', '排名'].every((word) => full.homeSchoolCollaborationDigest.doNotShare.indexOf(word) >= 0), 'home-school digest blocks unsafe handoff fields');
assert(['孩子姓名', '家长联系方式'].every((word) => full.homeSchoolCollaborationDigest.doNotShare.indexOf(word) >= 0), 'home-school digest blocks identity/contact handoff fields');
assert(full.reportDraft.homeSchoolConferenceKit && full.reportDraft.homeSchoolConferenceKit.localDeterministic === true, 'full report builds a deterministic home-school conference kit');
assert(full.homeSchoolConferenceKit.teacherQuestions.length >= 4, 'home-school conference kit carries teacher question list');
assert(full.homeSchoolConferenceKit.classroomObservationRequest.length >= 3 && full.homeSchoolConferenceKit.parentHomeObservationLog.length >= 3, 'home-school conference kit carries classroom and home observation logs');
assert(full.homeSchoolConferenceKit.sevenDayTeacherFeedbackLoop.length >= 4, 'home-school conference kit carries a seven-day teacher feedback loop');
assert(['full_answer', 'ranking'].every((field) => full.homeSchoolConferenceKit.localReleaseGate.blockedFields.includes(field)), 'home-school conference kit blocks unsafe fields before teacher handoff');
assert(['child_name', 'parent_phone', 'parent_wechat', 'contact_info'].every((field) => full.homeSchoolConferenceKit.localReleaseGate.blockedFields.includes(field)), 'home-school conference kit blocks identity/contact fields before teacher handoff');
assert(full.homeSchoolConferenceKit.aiBoundary.includes('不得替代老师判断'), 'home-school conference kit keeps AI out of teacher decisions');
const profileJsSource = read('miniprogram/pages/profile/profile.js');
const profileWxmlSource = read('miniprogram/pages/profile/profile.wxml');
assert(profileJsSource.includes('crossWeekTrendBoard') && profileWxmlSource.includes('parent-report-preview'), 'Profile keeps cross-week trend logic but exposes it through the compact report preview');
assert(profileJsSource.includes('homeSchoolCollaborationDigest') && profileWxmlSource.includes('证据来源'), 'Profile keeps home-school digest logic but exposes only a compact evidence source section on the tab page');
assert(profileJsSource.includes('homeSchoolConferenceKit') && profileWxmlSource.includes('今晚不用盯全程'), 'Profile keeps conference-kit logic while tab UI stays parent-first and compact');
assert(profileJsSource.includes('familyDecisionIntakeSourcePlan') && profileWxmlSource.includes('补充材料'), 'Profile keeps family input-lane logic and routes extra material through the current upload jump');
assert(profileJsSource.includes('sourceEvidenceLedger') && profileWxmlSource.includes('不靠感觉判断'), 'Profile keeps source evidence ledger logic and shows the evidence boundary without old ledgers');
assert(profileJsSource.includes('uploadedMaterialDecisionDossier') && profileWxmlSource.includes('个性化报告预览'), 'Profile keeps uploaded-material dossier logic behind the compact report preview');
assert(read('miniprogram/pages/upload/upload.js').includes('attachServicePathwayToUploadedDossier') && read('miniprogram/pages/upload/upload.js').includes('servicePathwaySummary'), 'Upload persists service pathway summary into uploaded-material dossier');
assert(profileJsSource.includes('servicePathwayValidationPlan') && profileWxmlSource.includes('补一份材料'), 'Profile keeps service pathway validation logic and routes follow-up through current material upload');
assert(profileJsSource.includes('uploadedMaterialDecisionDossierMethodCandidateCards') && profileWxmlSource.includes('天赋画像'), 'Profile keeps method candidate logic without rendering the old method ledger wall');
assert(profileJsSource.includes('uploadedMaterialDecisionDossierMethodologyGuide') && profileWxmlSource.includes('个性化报告预览'), 'Profile keeps methodology guide logic behind the compact report preview');
assert(profileJsSource.includes('uploadedMaterialDecisionDossierFamilyDecisionCalendar') && profileWxmlSource.includes('明天回访'), 'Profile keeps family decision calendar logic and exposes only the next review milestone');
assert(profileJsSource.includes('uploadedMaterialDecisionDossierDetailedSections') && profileWxmlSource.includes('查看'), 'Profile keeps detailed report sections behind the report preview entry');
assert(profileJsSource.includes('uploadedMaterialDecisionDossierSolutionBlueprint') && profileWxmlSource.includes('下一步'), 'Profile keeps the solution blueprint while tab UI stays one next step');
assert(profileJsSource.includes('uploadedMaterialDecisionDossierPrivateTutorSolutionPack') && profileWxmlSource.includes('第一步'), 'Profile keeps private tutor solution logic and shows the first-step action');
assert(profileJsSource.includes('uploadedMaterialDecisionDossierWrongPaperDiagnosisCards') && profileWxmlSource.includes('错题'), 'Profile keeps wrong-paper diagnosis logic and shows it as a compact evidence source');
assert(profileJsSource.includes('gameReturnEvidence') && profileWxmlSource.includes('复习回访'), 'Profile keeps game-return evidence logic and routes it through review jump cards');
assert(profileJsSource.includes('aiLocalImplementationMatrix') && profileWxmlSource.includes('证据来源'), 'Profile keeps AI/local implementation logic while tab UI states the evidence boundary');
assert(profileJsSource.includes('buildFamilyDecisionHomepage') && profileJsSource.includes('familyDecisionHomepageLocalAiSplitLine'), 'Profile builds a parent-first family decision homepage');
assert(profileJsSource.includes('buildTonightParentDecisionCard') && profileJsSource.includes('tonight_parent_decision_card'), 'Profile still builds the four-line tonight parent card in logic');
assert(profileWxmlSource.includes('yd-parent-route') && profileWxmlSource.includes('yd-parent-action-row'), 'Profile renders a compact route and action row instead of detailed report ledgers');
assert(profileWxmlSource.includes('parent-route-icon') && !profileWxmlSource.includes('parent-route-line'), 'Profile route is a visual evidence loop instead of a text-only line');
assert(full.reportDraft.longTermPortrait.evidenceToCollect.length >= 3, 'long-term portrait asks for multiple evidence items, not a single data point');
assert(Array.isArray(full.reportDraft.longTermPortrait.observationLoop) && full.reportDraft.longTermPortrait.observationLoop.length === 3, 'long-term portrait has day/next-day/seven-day observation loop');
assert(Array.isArray(full.reportDraft.longTermPortrait.portraitDimensions) && full.reportDraft.longTermPortrait.portraitDimensions.length >= 4, 'long-term portrait carries multi-dimensional learner profile dimensions');
assert(Array.isArray(full.reportDraft.longTermPortrait.trajectoryFlags) && full.reportDraft.longTermPortrait.trajectoryFlags.length >= 3, 'long-term portrait carries trajectory flags');
assert(Array.isArray(full.reportDraft.longTermPortrait.evidenceConfidenceRubric) && full.reportDraft.longTermPortrait.evidenceConfidenceRubric.length >= 3, 'long-term portrait explains evidence confidence levels');
assert(full.reportDraft.longTermPortrait.nextTeacherConference, 'long-term portrait prepares a teacher-conference evidence packet');
assert(Array.isArray(full.reportDraft.classroomDecisionBoard.classLikeObservation) && full.reportDraft.classroomDecisionBoard.classLikeObservation.length === 3, 'classroom decision board has observation/intervention/review rules');
assert(Array.isArray(full.reportDraft.classroomDecisionBoard.observationRubric) && full.reportDraft.classroomDecisionBoard.observationRubric.length >= 3, 'classroom decision board carries an observation rubric');
assert(Array.isArray(full.reportDraft.classroomDecisionBoard.interventionLadder) && full.reportDraft.classroomDecisionBoard.interventionLadder.length >= 4, 'classroom decision board carries a graded intervention ladder');
assert(Array.isArray(full.reportDraft.classroomDecisionBoard.classroomEvidencePacket) && full.reportDraft.classroomDecisionBoard.classroomEvidencePacket.length >= 4, 'classroom decision board carries a classroom evidence packet');
assert(full.reportDraft.classroomDecisionBoard.classroomCadence, 'classroom decision board names the observation cadence');
assert(full.reportDraft.classroomDecisionBoard.escalationRule && full.reportDraft.classroomDecisionBoard.successRule, 'classroom decision board has escalation and success rules');
assert(Array.isArray(full.reportDraft.familyDecisionMemo.doNotDo) && full.reportDraft.familyDecisionMemo.doNotDo.length === 3, 'family decision memo names what not to do tonight');
assert(Array.isArray(full.reportDraft.familyDecisionMemo.evidenceChecklist) && full.reportDraft.familyDecisionMemo.evidenceChecklist.length >= 3, 'family decision memo carries an evidence checklist');
assert(Array.isArray(full.reportDraft.familyDecisionMemo.parentMeetingScript) && full.reportDraft.familyDecisionMemo.parentMeetingScript.length >= 3, 'family decision memo carries parent review questions');
assert(Array.isArray(full.reportDraft.familyDecisionMemo.intakeSourcePlan) && full.reportDraft.familyDecisionMemo.intakeSourcePlan.some((item) => item.id === 'talent_assessment') && full.reportDraft.familyDecisionMemo.intakeSourcePlan.some((item) => item.id === 'wrong_question_paper'), 'family decision memo accepts talent assessment and wrong-question paper inputs');
assert(full.reportDraft.familyDecisionMemo.publicK12SourceStrategy && full.reportDraft.familyDecisionMemo.publicK12SourceStrategy.doNotUseAs.includes('不复制'), 'family decision memo has a public K12 source strategy with copyright boundary');
assert(full.reportDraft.familyDecisionMemo.aiLocalWorkSplit.some((item) => item.id === 'local') && full.reportDraft.familyDecisionMemo.aiLocalWorkSplit.some((item) => item.id === 'ai') && full.reportDraft.familyDecisionMemo.aiLocalWorkSplit.some((item) => item.id === 'blocked'), 'family decision memo separates local rules, AI rewrite, and blocked decisions');
assert(full.reportDraft.familyDecisionMemo.decisionCard && full.reportDraft.familyDecisionMemo.decisionCard.shareTitle, 'family decision memo carries a shareable decision card');
assert(Array.isArray(full.reportDraft.familyDecisionMemo.weeklyReviewAgenda) && full.reportDraft.familyDecisionMemo.weeklyReviewAgenda.length >= 4, 'family decision memo carries a weekly review agenda');
assert(Array.isArray(full.reportDraft.familyDecisionMemo.parentActionLadder) && full.reportDraft.familyDecisionMemo.parentActionLadder.length >= 3, 'family decision memo carries a parent action ladder');
assert(full.recommendationPlan.sevenDayPlan.length === 7, 'report creates a 7-day app-linked plan');
assert(full.recommendationPlan.sevenDayPlan.every((item) => item.path && item.minutes), 'each plan day has app route and time budget');
assert(full.recommendationPlan.sevenDayPlan.some((item) => item.day === 7), 'report keeps the seventh-day review checkpoint');
assert(full.solutionMap && full.solutionMap.appHandoff && full.solutionMap.appHandoff.path, 'report exposes a concrete app handoff map');
assert(full.reportDraft.solutionMap.nextEvidenceRequired.includes('next_day_revisit'), 'report names the next evidence required for follow-up');
assert(full.reportDraft.solutionMap.parentScript && full.reportDraft.solutionMap.childScript, 'report includes parent and child execution scripts');

const allVisibleText = collectStrings([fast, full]).join('\n');
[
  ['证', '明'].join(''),
  ['必', '然'].join(''),
  ['注', '定'].join(''),
  ['没', '天', '赋'].join(''),
  ['孩子', '不', '行'].join(''),
  ['保证', '提升'].join(''),
  ['拍照', '出', '答案'].join(''),
  ['自动', '识别', '答案'].join('')
].map((term) => new RegExp(term)).forEach((pattern) => {
  assert(!pattern.test(allVisibleText), `report avoids unsafe deterministic wording: ${pattern}`);
});
const hiddenSpecificTerm = String.fromCharCode(30382, 32441);
assert(!allVisibleText.includes(hiddenSpecificTerm), 'report avoids the explicitly banned assessment term');

const storageMap = {};
global.wx = {
  getStorageSync(key) { return storageMap[key]; },
  setStorageSync(key, value) { storageMap[key] = value; },
  removeStorageSync(key) { delete storageMap[key]; }
};
const storage = loadCommonJs(path.join('miniprogram', 'utils', 'storage.js'), {
  './learning-priority': {},
  './learning-report': report
});
assert.strictEqual(typeof storage.loadLearningReportState, 'function', 'storage exports report loader');
assert.strictEqual(typeof storage.saveLearningReportState, 'function', 'storage exports report saver');
assert.strictEqual(typeof storage.buildReportDailyActionQueue, 'function', 'storage exports report daily action queue builder');

storage.saveLearningReportState(full, { skipBuild: true });
const resumed = storage.loadLearningReportState();
[
  'reportDraft',
  'reportSources',
  'recognitionDraft',
  'reportProgress',
  'parsedScores',
  'parsedRanks',
  'profileBasics',
  'behaviorSignals',
  'emotionSignals',
  'interestSignals',
  'assessmentAnswers',
  'capabilityTendencies',
  'diagnosisMatrix',
  'recommendationPlan',
  'reportCompleteness',
  'reportStatus',
  'lastSavedAt'
].forEach((key) => {
  assert(Object.prototype.hasOwnProperty.call(resumed, key), `resumed report keeps state key: ${key}`);
});
assert.strictEqual(resumed.parsedScores['数学'].score, 117, 'resumed report keeps parsed score data');
assert(resumed.reportDraft.overview.confidence, 'resumed report keeps confidence markers');
assert(resumed.localLoopConnection && resumed.localLoopConnection.reportId, 'saved report records local loop connection');
assert(storage.loadTodayFocus().reportId === resumed.reportDraft.id, 'learning report creates a local focus handoff');
assert(storage.getTodaySession().learningReportId === resumed.reportDraft.id, 'learning report writes into today session');
assert(storage.loadTonightPlan().reportSolution && storage.loadTonightPlan().reportSolution.sevenDayPlan.length === 7, 'learning report writes a 7-day solution into tonight route');
const reportDailyQueue = storage.buildReportDailyActionQueue({ reportState: resumed });
assert(reportDailyQueue.ready && reportDailyQueue.queue.length === 7, 'learning report turns the 7-day plan into a daily action queue');
assert(reportDailyQueue.active && reportDailyQueue.active.route, 'daily action queue exposes the active route');
assert((storage.get(storage.KEYS.syncQueue, []) || []).some((item) => item && item.type === 'report_daily_action_queue'), 'daily action queue is queued for sync after report connection');
const tonightFromReport = storage.createTonightPlanFromInput('数学作业 20 分钟');
assert(tonightFromReport.planItems.some((item) => item && item.reportDailyActionId), 'tonight route pulls the report daily action into the task order');
assert(tonightFromReport.reportDailyAction && tonightFromReport.reportDailyAction.route, 'tonight route keeps the active report action route');
assert(storage.loadReviewCards().some((card) => card.id === resumed.localLoopConnection.reviewCardId), 'learning report creates a review card for follow-up');
assert(storage.loadReviewEvents().some((event) => event.type === 'learning_report_solution_connected'), 'learning report records the solution connection event');
storage.saveLearningReportState({
  reportSources: [{
    type: 'parent_report',
    label: '家长观察',
    text: '先看图再复述。',
    sourceSchemaId: 'parent_report'
  }]
}, { skipBuild: true });
storage.saveLearningReportSource({
  type: 'wrong_question_paper',
  label: '错题试卷',
  text: '列式时先找数量关系。',
  sourceSchemaId: 'wrong_question_paper',
  releaseScope: 'tonight_action_first',
  portraitConfidenceWeight: 1,
  requiredNextEvidence: ['child_first_step']
});
const mergedDraft = storage.buildLearningReportFromInput({
  sourceText: '天赋测评说明：更适合先看图再复述。',
  reportSources: [{
    type: 'talent_assessment',
    label: '天赋测评',
    text: '先看图再复述。',
    sourceSchemaId: 'talent_assessment',
    releaseScope: 'method_candidate_only'
  }]
});
assert(mergedDraft.reportSources.length >= 2, 'learning report preserves and merges multiple source lanes');
assert(mergedDraft.reportSources.some((item) => item.sourceSchemaId === 'parent_report'), 'merged report keeps parent report lane');
assert(mergedDraft.reportSources.some((item) => item.sourceSchemaId === 'wrong_question_paper'), 'merged report keeps wrong paper lane');
assert(mergedDraft.reportSources.some((item) => item.sourceSchemaId === 'talent_assessment'), 'merged report keeps talent assessment lane');

storage.saveLearningReportState(Object.assign({}, full, { recognitionDraft: providerDraft }), { skipBuild: true });
const resumedWithRecognition = storage.loadLearningReportState();
assert.strictEqual(resumedWithRecognition.recognitionDraft.mode, 'external_api', 'resumed report keeps recognition draft metadata');

const apiEndpoint = fs.readFileSync(path.join(root, 'api', 'mini', 'learning-report-recognize.js'), 'utf8');
assert(apiEndpoint.includes('requiresConfirmation: true'), 'recognition api requires parent confirmation');
assert(apiEndpoint.includes('verifySession'), 'recognition api keeps session verification path');
assert(apiEndpoint.includes('recognitionServiceReady'), 'recognition api has an explicit service readiness gate');
assert(apiEndpoint.includes('callRecognitionProvider'), 'recognition api can call a configured external recognition provider');
assert(apiEndpoint.includes('confirmFirst: true'), 'external recognition provider is invoked in confirm-first mode');
assert(apiEndpoint.includes('confirmation_required: true'), 'recognition service contract requires parent confirmation');
assert(apiEndpoint.includes('recognition_service_configuration'), 'recognition api reports setup action when external recognition is not configured');
assert(!/拍照出答案|自动识别答案/.test(apiEndpoint), 'recognition api avoids fake answer-recognition claims');

console.log('All learning report tests pass.');

