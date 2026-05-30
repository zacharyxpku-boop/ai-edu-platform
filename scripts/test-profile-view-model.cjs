#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function loadModule(filePath, requireMap = {}) {
  const file = path.join(root, filePath);
  const code = fs.readFileSync(file, 'utf8');
  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    require(request) {
      if (Object.prototype.hasOwnProperty.call(requireMap, request)) return requireMap[request];
      return require(request);
    },
    console,
    Date,
    Math,
    Number,
    String,
    Object,
    Array,
    RegExp
  };
  vm.runInNewContext(code, sandbox, { filename: file });
  return module.exports;
}

const storageStub = {
  buildCompanionPreference() {
    return { selectedCompanion: 'gudian', selectedLabel: '咕点' };
  }
};

const vmPath = path.join('miniprogram', 'view-models', 'profile-view-model.js');
assert(fs.existsSync(path.join(root, vmPath)), 'profile-view-model.js exists');
const profileVm = loadModule(vmPath, { '../utils/storage': storageStub });
assert.strictEqual(typeof profileVm.buildProfileViewModel, 'function', 'buildProfileViewModel is exported');

const vmWithEvidence = profileVm.buildProfileViewModel({
  companionPreference: { selectedCompanion: 'gudian' },
  todayFocus: {
    title: '写到第二步就乱了',
    issueType: '步骤断点',
    sourceText: '我写到第二步就乱了',
    systemSuggestedStep: '先看题目问的是什么。',
    childArticulatedStep: '我先圈出题干条件',
    repairStatus: 'completed'
  },
  latestFocusSession: {
    id: 'focus_session_1',
    completionType: 'completed',
    taskBound: true,
    linkedChildArticulatedStep: '我先圈出题干条件',
    focusTarget: { title: '我先圈出题干条件' }
  },
  focusHistory: [
    { taskBound: true, linkedChildArticulatedStep: '我先圈出题干条件', completionType: 'completed' }
  ],
  reviewEvents: [{ type: 'today_focus_review_card_created' }],
  recentLearningSummary: {
    latest3: [
      { date: '2026-05-15', firstSteps: 1, completedFocus: 1, interruptedFocus: 0, gamePlayed: 1 },
      { date: '2026-05-14', firstSteps: 1, completedFocus: 0, interruptedFocus: 1, gamePlayed: 0 },
      { date: '2026-05-13', firstSteps: 0, completedFocus: 1, interruptedFocus: 0, gamePlayed: 1 }
    ],
    latest7: [
      { date: '2026-05-15', firstSteps: 1, completedFocus: 1, interruptedFocus: 0, gamePlayed: 1 },
      { date: '2026-05-14', firstSteps: 1, completedFocus: 0, interruptedFocus: 1, gamePlayed: 0 },
      { date: '2026-05-13', firstSteps: 0, completedFocus: 1, interruptedFocus: 0, gamePlayed: 1 },
      { date: '2026-05-12', firstSteps: 1, completedFocus: 1, interruptedFocus: 0, gamePlayed: 0 },
      { date: '2026-05-11', firstSteps: 1, completedFocus: 0, interruptedFocus: 1, gamePlayed: 1 },
      { date: '2026-05-10', firstSteps: 0, completedFocus: 1, interruptedFocus: 0, gamePlayed: 0 },
      { date: '2026-05-09', firstSteps: 1, completedFocus: 1, interruptedFocus: 0, gamePlayed: 1 }
    ],
    firstStepDays: 5,
    focusDays: 7,
    gameDays: 4
  }
});

assert.strictEqual(vmWithEvidence.routePill, '今晚路线 · 第 5 步：家长 5 秒复盘', 'viewModel outputs routePill');
assert(vmWithEvidence.companionStrip.includes('咕点'), 'viewModel outputs mascot strip');
assert(vmWithEvidence.title.includes('家长只问这一句'), 'viewModel title contains parent one-question framing');
assert(vmWithEvidence.subtitle.includes('说出第一步'), 'viewModel outputs first-step subtitle');
assert.strictEqual(vmWithEvidence.primaryCta, '完成今日复盘', 'viewModel outputs primary CTA');
assert(vmWithEvidence.parentRecap.tonightRecap.includes('今晚孩子卡在'), 'parent recap includes tonight recap');
assert(vmWithEvidence.parentRecap.parentOneQuestion.includes('刚才你第一步先看了哪里'), 'parent recap includes one question');
assert(vmWithEvidence.parentRecap.trustBoundaryNote.includes('没有直接给结果'), 'parent recap includes no-direct-result trust boundary');
assert.strictEqual(vmWithEvidence.primaryCard.sections[0].id, 'tonightRecap', 'primary card prioritizes tonight recap');
assert(vmWithEvidence.primaryCard.sections.some((item) => item.id === 'trustBoundary'), 'primary card includes trust boundary');
assert(vmWithEvidence.nextStep.includes('今晚看见了'), 'one-night proof is visible without fake trends');
assert(vmWithEvidence.parentRecap.threeNightPattern.includes('最近 3 晚'), 'profile recap uses real 3-night local summary');
assert(vmWithEvidence.parentRecap.sevenNightReadiness.includes('最近 7 晚'), 'profile recap uses real 7-night local summary');
assert.strictEqual(vmWithEvidence.growthMemoryCard.localEvidenceDays, 7, 'growth memory exposes local evidence day count');

const vmWithoutChildStep = profileVm.buildProfileViewModel({
  companionPreference: { selectedCompanion: 'gudian' },
  todayFocus: {
    title: '单位1不确定',
    issueType: '列式关系',
    systemSuggestedStep: '先找等量关系'
  },
  focusHistory: []
});
assert(vmWithoutChildStep.parentRecap.trustBoundaryNote.includes('整理一个可开始的第一步'), 'missing child step keeps safe boundary');
assert(vmWithoutChildStep.parentRecap.threeNightPattern.includes('再用几晚后'), '3-night pattern does not fake data');
assert(vmWithoutChildStep.parentRecap.sevenNightReadiness.includes('再用几晚后'), '7-night readiness does not fake data');

function collectStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  if (Array.isArray(value)) value.forEach((item) => collectStrings(item, out));
  if (value && typeof value === 'object') Object.keys(value).forEach((key) => collectStrings(value[key], out));
  return out;
}

const unsafeText = collectStrings([vmWithEvidence, vmWithoutChildStep]).join('\n');
[
  /系统诊断/,
  /家长应盯着/,
  /孩子问题/,
  /报告墙/,
  /秒解/,
  /答案已生成/,
  /拍照出答案/,
  /保证提升成绩/
].forEach((pattern) => {
  assert(!pattern.test(unsafeText), `profileViewModel avoids unsafe visible text: ${pattern}`);
});

const profileJs = read('miniprogram/pages/profile/profile.js');
const profileWxml = read('miniprogram/pages/profile/profile.wxml');
assert(profileJs.includes('onLoad(options = {})'), 'profile page accepts deep-link query options safely');
assert(profileJs.includes("const panel = query.panel === 'report' ? 'assessment' : (query.panel || '')"), 'profile report panel deep link maps into assessment panel');
assert(profileJs.includes("query.quick_assessment === '1'") && profileJs.includes("showLearningQuestionnaire: query.quick_assessment === '1' ? true"), 'profile quick assessment deep link opens the questionnaire');
assert(profileJs.includes('const patchAnswers = Array.isArray(input.assessmentAnswers) ? input.assessmentAnswers : []'), 'profile report sync preserves patch assessment answers');
assert(profileJs.includes('assessmentAnswers: selectedAnswers.length ? selectedAnswers : patchAnswers'), 'profile report sync falls back to patch assessment answers when UI map is empty');
assert(profileJs.includes('profile-view-model'), 'profile page imports profile viewModel');
assert(profileJs.includes('partner-delivery-workbench'), 'profile page imports partner delivery workbench');
assert(profileJs.includes('latestFocusSession'), 'profile page passes latest focus evidence');
assert(profileJs.includes('focusHistory'), 'profile page passes focus history');
assert(profileJs.includes('function buildSafeSharePayload'), 'profile page centralizes safe share payload sanitizing');
assert(profileJs.includes('allowed_fields') && profileJs.includes('blocked_fields'), 'share payload exposes explicit allowed and blocked fields');
[
  'original_question',
  'full_answer',
  'full_dialogue',
  'score',
  'ranking',
  'private_comment',
  'raw_text'
].forEach((field) => {
  assert(profileJs.includes(`'${field}'`), `safe share denylist includes ${field}`);
});
assert(profileJs.includes("buildSafeSharePayload(dailyShareCard, 'generated')"), 'share-card generated analytics uses sanitized payload');
assert(profileJs.includes('parentDecisionBook'), 'profile page imports parent decision book into summary state');
assert(profileJs.includes('buildTonightParentDecisionCard') && profileJs.includes("id: 'tonight_parent_decision_card'"), 'profile page builds a compact tonight parent decision card');
assert(profileJs.includes('tonightParentDecisionCardRows') && profileWxml.includes('tonight-parent-decision-card'), 'profile first screen renders the compact tonight decision card rows');
assert(profileJs.includes('今晚先做') && profileJs.includes('孩子第一步') && profileJs.includes('家长只问') && profileJs.includes('明天回访'), 'compact tonight decision card keeps the four-line parent workflow visible');
assert(profileJs.includes('familyDecisionHomepageStatusSteps'), 'profile page exposes status steps in summary state');
assert(profileJs.includes('buildParentReflectionSummary') && profileJs.includes('familyDecisionHomepageParentReceiptLine'), 'profile page feeds parent reflection receipt into the family decision homepage');
assert(profileJs.includes("id: 'parent_receipt'"), 'family decision homepage has a parent receipt status gate');
assert(profileJs.includes('runFamilyDecisionHomepageAction') && profileWxml.includes('familyDecisionHomepageRoute') && profileWxml.includes('runFamilyDecisionHomepageAction'), 'profile first screen exposes an executable family decision homepage CTA');
assert(profileJs.includes('reportEvidenceTopLine') && profileJs.includes('howToLearnBetter') && profileJs.includes('nextActionRoute'), 'profile summary exposes report decision top line, learning prescription, and concrete next route');
assert(profileJs.includes('reportInputPatch') && profileJs.includes('Object.assign({}, this.data.learningReportInput || {}, reportInputPatch'), 'assessment input merges structured evidence into report input instead of only copying source text');
assert(profileJs.includes('talentLearningMethodPlan') && profileWxml.includes('learningAssessment.talentLearningMethodPlan'), 'profile visibly exposes the talent/method plan as a method candidate with evidence gates');
assert(profileJs.includes("storage.get('upload.report.handoff.v1'") && profileJs.includes('runUploadedMaterialDossierAction'), 'profile turns uploaded-material handoff into executable report actions');
assert(profileWxml.includes('uploadedMaterialDecisionDossierHandoff') && profileWxml.includes('uploadedMaterialDecisionDossierRouteActions') && profileWxml.includes('runUploadedMaterialDossierAction'), 'profile visibly bridges uploaded report dossier to review/game/tutor routes');
assert(profileJs.includes('partnerDeliveryWorkbench') && profileJs.includes('partnerWorkbenchAdvisorQueue') && profileJs.includes('partnerWorkbenchCrmExport') && profileJs.includes('partnerWorkbenchPilotReadiness'), 'profile summary exposes partner delivery workbench, advisor queue, safe CRM export, and pilot readiness');
assert(profileWxml.includes('profile-partner-workbench') && profileWxml.includes('partnerWorkbenchSolutionPipeline') && profileWxml.includes('partnerWorkbenchRevenueDisplayRows') && profileWxml.includes('partnerWorkbenchPilotDisplayRows'), 'profile visibly renders partner delivery pipeline, service milestones, and pilot readiness');
assert(profileJs.includes('partnerStatusLine') && profileJs.includes('formatPartnerFieldList') && profileJs.includes('partnerWorkbenchCrmAllowedLine'), 'profile formats partner delivery status and CRM fields into readable lines');
assert(profileWxml.includes('partnerWorkbenchStatusLine') && profileWxml.includes('partnerWorkbenchCrmAllowedLine') && profileWxml.includes('partnerWorkbenchCrmBlockedLine'), 'profile renders readable partner status and CRM safety fields');
assert(profileWxml.includes('partnerWorkbenchPilotDisplayRows') && profileWxml.includes('partnerWorkbenchRevenueDisplayRows'), 'profile renders readable pilot and revenue rows instead of raw internal ids');
assert(!profileWxml.includes('partnerWorkbenchCrmExport.allowedFields') && !profileWxml.includes('partnerWorkbenchCrmExport.blockedFields'), 'profile does not expose raw CRM field keys directly in partner workbench');
assert(profileJs.includes('openMaicBorrowWorkbench') && profileJs.includes('runBorrowWorkbenchAction'), 'profile builds an executable OpenMAIC/K12 borrow workbench');
assert(profileWxml.includes('openMaicBorrowWorkbench') && profileWxml.includes('borrow-workbench-card') && profileWxml.includes('runBorrowWorkbenchAction'), 'profile visibly renders the OpenMAIC/K12 borrow workbench');
assert(profileJs.includes('不复制代码') && profileJs.includes('blockedClaims') && profileJs.includes('openMaicBorrowWorkbenchBlockedClaims'), 'OpenMAIC/K12 workbench blocks license and unsafe claim risks with user-facing wording');
assert(profileJs.includes("id: 'ai'") && profileJs.includes("id: 'local'") && profileJs.includes("id: 'source'"), 'OpenMAIC/K12 workbench separates AI, local-code, and source lanes');
assert(profileJs.includes("type=talent_assessment") && profileJs.includes("type=wrong_question_paper") && profileJs.includes("type=school_material") && profileJs.includes("type=parent_report"), 'OpenMAIC/K12 workbench connects talent, wrong-paper, school-material, and parent-observation report routes');
assert(profileJs.includes('longTermPortraitCanRender') && profileWxml.includes('portraitConfidenceStatusLine') && profileWxml.includes('longTermPortraitLockedLine'), 'profile gates long-term portrait display behind portrait release status');

const firstScreen = profileWxml.slice(
  profileWxml.indexOf('rc14-profile-first-screen'),
  profileWxml.indexOf('rc14-profile-after-first-screen')
);
assert(firstScreen.includes('profileViewModel.routePill'), 'first screen reads routePill from profileViewModel');
assert(firstScreen.includes('tonightParentDecisionCard') && firstScreen.includes('tonightParentDecisionCardRows'), 'first screen prioritizes the compact tonight parent decision card before detailed report sections');
assert(firstScreen.includes('reportEvidenceTopLine') && firstScreen.includes('nextEvidenceTopLine'), 'first screen surfaces report release top line without exposing unsafe detailed evidence');
assert(firstScreen.includes('今晚卡住') && firstScreen.includes('只问一句') && firstScreen.includes('最近小结'), 'first screen renders friend-safe recap sections');
assert(firstScreen.includes('证据状态条'), 'first screen renders evidence status strip');
assert(firstScreen.includes('当前缺口') || firstScreen.includes('下一步'), 'first screen renders blocker or next action');
assert(firstScreen.includes('profile-material-decision-snapshot') && firstScreen.includes('测评/错题资料决策卡'), 'first screen surfaces the assessment and uploaded-material decision card');
assert(firstScreen.includes('uploadedMaterialDecisionDossierHowToLearnBetter') && firstScreen.includes('uploadedMaterialDecisionDossierMaterialLanes'), 'first screen shows method candidates and material lanes');
assert(firstScreen.includes('uploadedMaterialDecisionDossierTalentRule') && firstScreen.includes('uploadedMaterialDecisionDossierWrongPaperRule'), 'first screen keeps talent and wrong-paper safety rules visible');
assert(firstScreen.includes('uploadedMaterialDecisionDossierMethodCandidateCards') && firstScreen.includes('方法候选卡'), 'first screen shows explicit method candidate cards with validation windows');
assert(firstScreen.includes('uploadedMaterialDecisionDossierDecisionHeatmap') && firstScreen.includes('决策热区'), 'first screen shows uploaded-material parent decision heatmap');
assert(firstScreen.includes('uploadedMaterialDecisionDossierFamilyActionStack') && firstScreen.includes('家庭行动栈'), 'first screen shows tonight/tomorrow/day7 family action stack');
assert(profileJs.includes('buildProfileDossierDeliveryView') && profileJs.includes('profileReadableGate'), 'profile builds a readable uploaded-material delivery view');
assert(profileWxml.includes('uploadedMaterialDeliveryView.modeCards') && profileWxml.includes('uploadedMaterialDeliveryView.solutionCards'), 'profile renders uploaded-material modes through readable delivery cards');
assert(profileWxml.includes('uploadedMaterialDeliveryView.aiLocalCards') && profileWxml.includes('uploadedMaterialDeliveryView.releaseLine'), 'profile renders AI/local and release gates as readable lines');
assert(profileJs.includes('normalizeProfileServiceHandoffPack') && profileJs.includes('uploadedMaterialServiceHandoffPack'), 'profile consumes the uploaded-material family solution handoff pack');
assert(firstScreen.includes('uploadedMaterialServiceHandoffCards') && firstScreen.includes('uploadedMaterialServiceHandoffReleaseLine') && firstScreen.includes('uploadedMaterialServiceHandoffBlockedLine'), 'first screen renders uploaded-material service handoff cards with release and blocked lines');
assert(profileJs.includes('buildProfileServiceHandoffActions') && profileJs.includes('service_handoff_day7') && profileJs.includes('type=parent_report'), 'profile turns the service handoff pack into tonight, day-7, and parent-confirmation actions');
assert(firstScreen.includes('uploadedMaterialServiceHandoffActions') && firstScreen.includes('runUploadedMaterialDossierAction'), 'first screen renders executable service handoff actions instead of a static report only');
assert(profileJs.includes('uploadedMaterialDecisionDossierAiQualityGate') && profileJs.includes('uploadedMaterialDecisionDossierAiQualityPlan'), 'profile summary exposes uploaded-material AI quality gate and validation plan');
assert(profileWxml.includes('uploadedMaterialDecisionDossierAiQualityGate') && profileWxml.includes('uploadedMaterialDecisionDossierAiQualityPlan'), 'profile renders uploaded-material AI quality gate and validation plan');
assert(profileWxml.includes('AI解析质量门控') || profileWxml.includes('AI瑙ｆ瀽璐ㄩ噺'), 'profile names the uploaded-material AI quality gate for parent/service review');
assert(profileJs.includes('reportScoreReturnCard') && profileJs.includes('reportScoreReturnXpGate'), 'profile summary exposes score-report return card and XP gate');
assert(profileWxml.includes('成绩回访卡') && profileWxml.includes('reportScoreReturnLine') && profileWxml.includes('reportScoreReturnXpGate'), 'profile renders score-report return card without exposing raw score/ranking as a reward hook');
assert(profileJs.includes('buildPartnerServiceReviewCard') && profileJs.includes('partner_service_review_primary') && profileJs.includes('course_or_counselor_upgrade'), 'profile builds a guarded partner service review card from day-7 evidence and revenue gates');
assert(firstScreen.includes('partnerServiceReviewCard') && firstScreen.includes('partnerServiceReviewActions') && firstScreen.includes('partnerServiceReviewReleaseLine'), 'first screen renders partner service review decision, actions, and release boundary');
assert(profileJs.includes('formatPartnerDeliveryRows') && profileJs.includes('partnerPilotDeliveryPacket') && profileJs.includes('partnerPilotTalkTrack'), 'profile summary exposes the partner pilot delivery packet and talk track');
assert(firstScreen.includes('partnerPilotDeliveryPacket') && firstScreen.includes('partnerPilotDeliveryRows') && firstScreen.includes('partnerPilotBlockedPromises'), 'first screen renders partner pilot delivery rows and blocked promises');
assert(!profileWxml.includes('uploadedMaterialDecisionDossierSolutionModeSequence}}"') && !profileWxml.includes('{{item.localGate}}') && !profileWxml.includes('{{item.owns}}'), 'profile UI does not expose raw uploaded-material local gates or ownership arrays');
assert(firstScreen.includes('profile-partner-workbench') && firstScreen.includes('CRM 安全字段') && firstScreen.includes('试点就绪'), 'first screen shows partner workbench, CRM safety gate, and pilot readiness');
assert(profileJs.includes('competitiveMoatBoard') && profileJs.includes('competitiveMoatBoardRows'), 'profile readiness snapshot exposes the competitive moat board');
assert(firstScreen.includes('competitiveMoatBoardRows') && firstScreen.includes('competitiveMoatBoardNextAction'), 'profile first screen renders competitive moat progress and next action');

console.log('All profile view model tests pass.');
