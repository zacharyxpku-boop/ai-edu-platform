#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function listJsFiles(dir) {
  const absolute = path.join(root, dir);
  if (!fs.existsSync(absolute)) return [];
  const result = [];
  const stack = [absolute];
  while (stack.length) {
    const current = stack.pop();
    fs.readdirSync(current, { withFileTypes: true }).forEach((entry) => {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && entry.name.endsWith('.js')) result.push(full);
    });
  }
  return result;
}

const profileJs = read('miniprogram/pages/profile/profile.js');
const profileWxml = read('miniprogram/pages/profile/profile.wxml');
const profileWxss = read('miniprogram/pages/profile/profile.wxss');
const homeJs = read('miniprogram/pages/home/home.js');
const homeWxml = read('miniprogram/pages/home/home.wxml');
const homeWxss = read('miniprogram/pages/home/home.wxss');
const progressHtml = read('progress.html');
const studyToolsHtml = read('study-tools.html');
const toolsNav = read('src/tools-nav.js');
const reviewJs = read('miniprogram/pages/review/review.js');
const reviewWxml = read('miniprogram/pages/review/review.wxml');
const toolsJs = read('miniprogram/pages/tools/tools.js');
const toolsWxml = read('miniprogram/pages/tools/tools.wxml');
const arcadeJs = read('miniprogram/pages/arcade/arcade.js');
const arcadeWxml = read('miniprogram/pages/arcade/arcade.wxml');
const tutorJs = read('miniprogram/pages/tutor/tutor.js');
const tutorWxml = read('miniprogram/pages/tutor/tutor.wxml');
const tutorWxss = read('miniprogram/pages/tutor/tutor.wxss');
const uploadJs = read('miniprogram/pages/upload/upload.js');
const uploadWxml = read('miniprogram/pages/upload/upload.wxml');
const lightDiagnosisWxml = read('miniprogram/pages/light-diagnosis/light-diagnosis.wxml');
const tutorLadder = read('miniprogram/utils/tutor-ladder.js');
const importIntake = read('miniprogram/utils/import-intake.js');
const legalJs = read('miniprogram/pages/legal/legal.js');
const legalWxml = read('miniprogram/pages/legal/legal.wxml');
const legalWxss = read('miniprogram/pages/legal/legal.wxss');
const storageJs = read('miniprogram/utils/storage.js');
const navigationJs = read('miniprogram/utils/navigation.js');
const productReadiness = read('miniprogram/utils/product-readiness.js');
const learningPriority = read('miniprogram/utils/learning-priority.js');
const arcadeEngine = read('miniprogram/utils/arcade-engine.js');
const reviewCards = read('miniprogram/utils/review-cards.js');
const gameLogic = read('miniprogram/utils/game-logic.js');
const reviewPack = read('scripts/miniapp-review-pack.cjs');
const learningReport = read('miniprogram/utils/learning-report.js');
const realHomeworkCoverage = read('miniprogram/utils/real-homework-coverage.js');
const learningReportRecognition = read('miniprogram/utils/learning-report-recognition.js');
const apiRecognition = read('api/mini/learning-report-recognize.js');
const miniApi = read('miniprogram/utils/api.js');
const miniSession = read('api/mini/session.js');
const miniShared = read('api/mini/_shared.js');
const miniLeaderboard = read('api/mini/leaderboard.js');
const miniGame = read('api/mini/_game.js');
const miniShop = read('api/mini/shop.js');
const miniAchievements = read('api/mini/achievements.js');
const miniFeedback = read('api/mini/feedback.js');
const miniEventApi = read('api/mini/event.js');
const miniTutor = read('api/mini/tutor-message.js');
const miniPriority = read('api/mini/priority.js');
const miniWeekly = read('api/mini/weekly.js');
const miniContentCheck = read('api/mini/content-check.js');
const miniContentEngine = read('api/mini/content-engine.js');
const miniReport = read('api/mini/report.js');
const miniQuizGenerate = read('api/mini/quiz-generate.js');
const miniQuizSubmit = read('api/mini/quiz-submit.js');
const miniReviewToday = read('api/mini/review-today.js');
const miniReviewGrade = read('api/mini/review-grade.js');
const decksApi = read('api/decks.js');
const deckCards = read('api/decks/[id]/cards.js');
const parentBind = read('api/parent/bind.js');
const reviewDueCards = read('api/review/due-cards.js');
const leadApi = read('api/lead.js');
const miniEvent = read('api/mini/event.js');
const miniSync = read('api/mini/sync.js');
const parentChildStats = read('api/parent/child-stats.js');
const serviceAccess = read('miniprogram/utils/service-access.js');
const reportGenerator = read('src/report-generator.js');
const learningStore = read('src/learning-store.js');
const shareKit = read('src/share-kit.js');
const syncMiniappRepo = read('scripts/sync-miniapp-repo.cjs');
const miniappDepthAudit = read('scripts/miniapp-depth-audit.cjs');
const verifyScript = read('scripts/verify.ps1');
const packageJson = read('package.json');

assert(realHomeworkCoverage.includes('FALLBACK_PRESSURE_SAMPLE_ATLAS') && realHomeworkCoverage.includes('getRealHomeworkPressureSamples'), 'Real-homework coverage exposes a miniapp-runtime pressure sample atlas when script fixtures are unavailable');
assert(arcadeJs.includes('realHomeworkCoverage.getRealHomeworkPressureSamples') && arcadeJs.includes('real_homework_pressure_samples') && arcadeJs.includes('real_homework_pressure_sample_specific'), 'Arcade injects runtime pressure samples into the high-frequency memory loop and persists sample-specific evidence');
assert(arcadeWxml.includes('highFrequencyPracticeLoop.realHomeworkPressureMemoryPrescription') && arcadeWxml.includes('真实样本') && arcadeWxml.includes('分享边界'), 'Arcade visibly exposes the real-homework pressure memory prescription instead of leaving it in tests only');
assert(importIntake.includes('buildUploadIntakePacket') && uploadJs.includes('buildUploadIntakePacket') && uploadWxml.includes('uploadIntakePacket') && uploadWxml.includes('结构化入口'), 'Upload turns text/photo/material entry into a visible structured intake packet');
assert(importIntake.includes('photo_ocr_claim') && importIntake.includes('auto_link_crawl') && importIntake.includes('auto_pdf_parse'), 'Upload packet explicitly blocks fake OCR, link crawling, and PDF parsing claims');
assert(uploadJs.includes('upload_intake_packet') && importIntake.includes('reportSeed') && importIntake.includes('reviewSeed'), 'Upload packet seeds report and review loops instead of stopping at local file paths');
assert(importIntake.includes('AI 只负责改写提示和追问') && importIntake.includes('本地规则决定'), 'Upload packet keeps AI usage bounded by local deterministic routing rules');
assert(importIntake.includes('buildNextActionQueue') && uploadWxml.includes('下一步动作队列') && uploadJs.includes('goIntakeAction'), 'Upload exposes a routeable next-action queue after Chinese material intake');
assert(importIntake.includes('ai_with_local_guardrail') && importIntake.includes('local_rule') && importIntake.includes('不带原题、答案、分数或排名'), 'Upload next-action queue separates Socratic AI wording from local gates and privacy-safe challenges');
assert(uploadJs.includes('normalizeMaterialType(query') && uploadJs.includes('showMaterialPanel: shouldOpenMaterialPanel') && uploadJs.includes('updateMaterialPreview(routeMaterialText, routeMaterialType)'), 'Upload consumes routed material types such as talent assessment, school material, and wrong-paper entry instead of defaulting to class notes');
assert(uploadJs.includes('buildUploadEntryDeck') && uploadJs.includes('setUploadEntryMode') && uploadWxml.includes('upload-three-step-card') && uploadWxml.includes('data-mode="{{item.id}}"'), 'Upload first screen has a three-choice intake deck before homework/material flows');
assert(uploadJs.includes("['homework', 'stuck', 'material']") && uploadWxml.includes('placeholder="{{homeworkPlaceholder}}"') && uploadJs.includes('patch.showMaterialPanel = true'), 'Upload entry modes route homework, stuck-point, and material intake without a hidden setup step');
assert(uploadJs.includes('aiLocalBoundary') && uploadJs.includes('talent_assessment_requires_real_wrong_question_before_practice') && uploadJs.includes('补真实错题验证'), 'Upload report CTA keeps AI to copy/questioning and forces talent reports into real wrong-question validation');
assert(uploadWxml.includes('AI 只做改写和追问') && uploadWxml.includes('wx:if="{{lastReportCta.gameRoute}}"') && uploadJs.includes('先补真实证据'), 'Upload visibly explains AI/local ownership and blocks talent-assessment game release');
assert(uploadJs.includes('from=upload_material_ready') && uploadJs.includes('latestReportCta && latestReportCta.route'), 'Material import flows directly into the parent report instead of stopping at an upload-page preview');
assert(uploadJs.includes("require('../../utils/openmaic-inspired-plan')") && uploadJs.includes('openMaicDecisionBridge') && uploadJs.includes('safeRelayPayload') && uploadJs.includes('buildTonightTaskCard') && uploadWxml.includes('小讲堂任务单') && uploadWxml.includes('今晚任务卡'), 'Upload now turns intake into a mini-lesson decision bridge, safe relay payload, and tonight task card');
assert(reviewJs.includes('openMaicBridgeStatus') && reviewWxml.includes('小讲堂回流') && arcadeJs.includes('openMaicBridgeStatus') && arcadeWxml.includes('小讲堂回流'), 'Review and arcade preserve upload decision-bridge status and return-route context while the UI stays user-facing');
assert(uploadJs.includes('requiresStructuredEvidenceGate') && uploadJs.includes('blocked_until_structured_evidence') && uploadJs.includes('hasGameReleaseEvidence') && uploadJs.includes('servicePathwayAllowsGame'), 'Upload blocks report/game/share release until structured evidence is complete, and game routes require service-pathway approval plus real evidence');
assert(uploadJs.includes('methodValidationChallengeChain') && learningReport.includes('methodValidationStages') && profileJs.includes('uploadedMaterialDecisionDossierMethodValidationStages'), 'Uploaded material preserves the method-validation chain into the parent report surface');
assert(profileWxml.includes('uploadedMaterialDecisionDossierMethodValidationStages') && profileWxml.includes('uploadedMaterialDecisionDossierMethodValidationReleaseRule'), 'Parent report visibly exposes the uploaded-material method-validation chain and release rule');
assert(learningReport.includes('methodCandidateCards') && profileJs.includes('uploadedMaterialDecisionDossierMethodCandidateCards') && profileWxml.includes('方法候选卡'), 'Uploaded material produces parent-visible method candidate cards with tonight/tomorrow/day-7 validation');
assert(uploadJs.includes('buildMaterialTypeGuide') && uploadJs.includes('examplePlaceholder') && uploadWxml.includes('placeholder="{{materialPreview.examplePlaceholder}}"'), 'Upload material textarea switches examples by material type instead of using one generic prompt');
assert(uploadJs.includes('当前只生成方法候选') && uploadJs.includes('不生成复习卡') && uploadJs.includes('不贴天赋标签'), 'Talent-assessment intake clearly stays in method-candidate mode');
assert(uploadJs.includes('当前生成错因报告') && uploadJs.includes('不自动判分') && uploadJs.includes('不给整卷答案'), 'Wrong-paper intake clearly releases repair reports without auto grading or whole-paper answers');
assert(uploadWxml.includes('materialPreview.statusLine') && uploadWxml.includes('materialPreview.modeLine') && uploadWxml.includes('materialPreview.blockedClaimsLine'), 'Upload material preview visibly surfaces status, mode, and blocked-claim guidance');
assert(uploadJs.includes("sourceSchemaId: 'wrong_question_paper'") && uploadJs.includes('requiredNextEvidence') && uploadJs.includes('upload_wrong_question'), 'Plain wrong-question uploads bind review cards back to the wrong-paper evidence chain');
assert(uploadJs.includes('expiresAt') && uploadJs.includes('consumedAt') && reviewJs.includes('matchesQuery') && reviewJs.includes('expired') && reviewJs.includes('consumedAt'), 'Upload handoff expires and review only consumes matching report/card/source context');
assert(realHomeworkCoverage.includes('/pages/tutor/tutor?from=public_k12_intake') && realHomeworkCoverage.includes('arcadeRoute') && tutorJs.includes('findPublicK12Challenge') && tutorJs.includes('buildPublicK12SelectedHomework') && tutorJs.includes('publicK12TutorIntro'), 'Public K12 challenge cards route into Tutor as a real Socratic first-step entry while preserving arcade/review bridges');

assert(toolsJs.includes('buildPublicK12ContentOps') && toolsJs.includes('K12公开资料处理台') && toolsWxml.includes('publicK12ContentOps'), 'Tools exposes a public-K12 content ops surface instead of hiding source triage in reports only');
assert(toolsJs.includes('本地代码负责题型、错因、回访窗口、XP、解锁、报告放行和分享字段') && toolsJs.includes('AI 负责把已通过本地门槛的追问'), 'Tools makes local-rule vs AI-expression ownership visible in the practice workflow');
assert(storageJs.includes('buildCompetitiveMoatWorkbench') && storageJs.includes('竞品级加厚工作台') && storageJs.includes('只借机制，不接代码'), 'Storage builds a competitive moat workbench for OpenMAIC/K12/Gizmo/Khanmigo borrowing boundaries');
assert(toolsJs.includes('competitiveMoatWorkbench') && toolsWxml.includes('competitiveMoatWorkbench.highLeverageLanes') && toolsWxml.includes('competitiveMoatWorkbench.aiLocalDecision'), 'Tools exposes the competitive moat workbench across content, AI/local, game, report, and share lanes');
assert(storageJs.includes('sourceLicenseGateRows') && storageJs.includes('commercial_blocked_until_license') && toolsWxml.includes('competitiveMoatWorkbench.sourceLicenseGateRows'), 'Competitive workbench exposes a license gate for public-domain, CC-BY, share-alike, NC, unknown, and proprietary sources');
assert(storageJs.includes('openMaicScenePack') && storageJs.includes('competitiveExecutionBoard') && storageJs.includes('reportInputLanes') && toolsWxml.includes('competitiveMoatWorkbench.competitiveExecutionBoard'), 'Competitive workbench turns OpenMAIC, Gizmo, Khanmigo, and parent-report borrowing into executable local lanes');
assert(storageJs.includes('拍题自动出答案') && storageJs.includes('完整AI课堂生成') && storageJs.includes('天赋定性') && storageJs.includes('复制开源或公开题库内容'), 'Competitive workbench blocks fake board, answer, talent-label, and copied-content claims');
assert(toolsWxml.includes('贴自己的材料') && toolsWxml.includes('玩第一步挑战') && toolsWxml.includes('来源先过门槛'), 'Tools routes public-K12 material into own-material intake and first-step challenges');
assert(toolsJs.includes('runPublicK12ChallengeSeed') && toolsJs.includes('public_k12_seed_selected') && toolsWxml.includes('bindtap="runPublicK12ChallengeSeed"'), 'Tools public-K12 seed cards are executable and write a source challenge review event');

assert(!profileJs.includes("require('../../utils/subscription-mock')"), 'Profile does not load mock subscription module');
assert(!fs.existsSync(path.join(root, 'miniprogram/utils/subscription-mock.js')), 'Miniapp bundle no longer keeps a mock subscription module');
assert(!/toggleMockSubscription|confirmMockPayment|closeMockPaymentSheet/.test(profileJs), 'Profile has no mock payment handlers');
assert(!/subscriptionState|subscriptionGate|subscriptionWeeklySummary/.test(profileJs + profileWxml), 'Profile has no subscription state or paywall preview');
assert(!/mock-payment/.test(profileWxss), 'Profile stylesheet has no mock payment shell');
assert(!/API Key|服务端环境变量|云同步/.test(profileJs + profileWxml), 'Profile copy avoids internal setup terms');
assert(!/commercializationPlan|buildCommercializationPlan|pilotSop|buildPilotSop|launchChecklist|buildLaunchChecklist/.test(profileJs + profileWxml), 'Profile does not keep internal commercialization or launch checklists in page state');
[
  'Supabase/API',
  'AppSecret',
  'API 环境变量',
  '后端环境变量',
  '模型 Key',
  'Supabase 环境变量',
  'AppID 和环境变量',
  '留存假设',
  '假好友榜',
  '假挑战'
].forEach((term) => {
  assert(!(profileJs + profileWxml + reviewJs + learningPriority).includes(term), `Commercial shell removes internal or fake-social term: ${term}`);
});
assert(!learningPriority.includes('makeDemoState'), 'Learning priority uses local sample naming instead of demo state naming');
assert(!/source:\s*['"]demo['"]/.test(learningPriority), 'Learning priority does not tag local samples as demo source');

['内测说明', '正在内测', '完整功能稍后开放', '20 家庭试用检查', '试用看板', '开发者漏斗看板'].forEach((term) => {
  assert(!profileWxml.includes(term), `Profile visible shell removes test wording: ${term}`);
});
assert(profileWxml.includes('服务状态'), 'Profile replaces test wording with a commercial service status block');
assert(profileWxml.includes('作业点拨、专注舱、错题修复、轻回访和家长复盘已经连成闭环'), 'Profile service block states what is commercially usable');

assert(!toolsJs.includes('demo=1'), 'Tools never opens arcade through a demo query');
assert(!toolsJs.includes('可试玩'), 'Tools does not advertise unavailable game modes as playable trials');
assert(toolsJs.includes('先补一条真实材料，再开始轻练习'), 'Tools honestly routes unavailable games to real material input');
assert(arcadeJs.includes("const ready = list.filter((item) => item.status === 'ready')"), 'Arcade only shows ready recommendations');
assert(!arcadeJs.includes('ready.concat(planned)'), 'Arcade does not merge planned modes into visible recommendations');
assert(!/plannedGameModes/.test(toolsJs), 'Tools uses setup/material wording instead of planned game wording');

assert(storageJs.includes('serviceIntentRate'), 'Internal dashboard exposes serviceIntentRate for commercial wording');
assert(storageJs.includes('service_intent_clicked'), 'Local analytics uses service intent wording');
assert(storageJs.includes('buildProductReadiness') && productReadiness.includes('buildProductReadiness'), 'Product has a structured readiness evaluator for final acceptance');
assert(storageJs.includes('buildAcceptanceReport') && productReadiness.includes('buildAcceptanceReport'), 'Product has a structured acceptance report for final validation');
assert(productReadiness.includes('guided_tutor') && productReadiness.includes('report_to_solution') && productReadiness.includes('spaced_recall'), 'Readiness evaluator covers tutor, report-to-solution, and recall capabilities');
assert(productReadiness.includes('competitiveGapSummary') && productReadiness.includes('functionalityChecklist') && productReadiness.includes('workflowBreakpoints'), 'Acceptance report exposes benchmark, functionality, and workflow sections');
assert(productReadiness.includes('userTrialSimulation') && productReadiness.includes('moduleFlowMap') && productReadiness.includes('pseudoFunctionScan'), 'Acceptance report exposes friend-trial, module-flow, and pseudo-function scans');
assert(productReadiness.includes('zeroHelpReady') && productReadiness.includes('report_to_plan') && productReadiness.includes('weak_network_return_visit'), 'Acceptance report covers zero-help trial and hard user scenarios');
assert(productReadiness.includes('light_entry_evidence') && productReadiness.includes('light_entry_to_profile') && productReadiness.includes('child_light_entry_to_core'), 'Readiness model treats light entries as first-class evidence, not side tools');
assert(productReadiness.includes('share_return') && productReadiness.includes('share_to_landing_next_action') && productReadiness.includes('shared_family_card_return'), 'Readiness model treats share return as a first-class workflow and trial scenario');
assert(productReadiness.includes('competitiveMaturityDelta') && productReadiness.includes('readinessGateChecklist') && productReadiness.includes('iterationBoundary'), 'Acceptance report exposes maturity deltas, launch gates, and local stop condition');
assert(productReadiness.includes('external_launch_config_clear') && productReadiness.includes('local_acceptance_exhausted_external_config_required'), 'Acceptance report separates final external blockers from local optimization');
assert(productReadiness.includes('externalBlockers') && productReadiness.includes('real_appid') && productReadiness.includes('production_ai_provider'), 'Readiness evaluator separates code readiness from external launch blockers');
assert(productReadiness.includes('buildFinalTargetGapMeter') && productReadiness.includes('FINAL_TARGET_REQUIREMENTS') && productReadiness.includes('中文材料导入') && productReadiness.includes('高频记忆与主动回忆') && productReadiness.includes('微信安全分享接力'), 'Readiness evaluator tracks distance to the final competitor-grade commercial target');
assert(productReadiness.includes('/pages/upload/upload?from=final_target_gap') && productReadiness.includes('/pages/review/review?from=final_target_gap') && productReadiness.includes('/pages/tutor/tutor?from=final_target_gap') && productReadiness.includes('/pages/home/home?from=final_target_gap'), 'Final target rows route to real miniapp surfaces instead of staying as static advice');
assert(productReadiness.includes('边际收益已低') && productReadiness.includes('每完成一轮本地加厚或同步上传后') && productReadiness.includes('停止堆代码'), 'Final target meter includes reporting cadence and marginal-benefit stop rule');
assert(productReadiness.includes('buildAiUsageDecisionMatrix') && productReadiness.includes('AI 使用分级矩阵'), 'Readiness evaluator exposes an AI usage decision matrix');
assert(productReadiness.includes('ai_required_with_local_guardrail') && productReadiness.includes('ai_enhanced_not_required') && productReadiness.includes('local_rule_required'), 'AI usage matrix separates required, enhanced, and local-rule-only work');
assert(productReadiness.includes('socratic_hint_generation') && productReadiness.includes('report_draft_interpretation') && productReadiness.includes('visual_blackboard_explanation'), 'AI usage matrix identifies high-entropy explanation work');
assert(productReadiness.includes('spaced_recall_scheduler') && productReadiness.includes('share_privacy_and_return') && productReadiness.includes('safety_content_boundary'), 'AI usage matrix keeps recall, share/privacy, and safety deterministic');
assert(productReadiness.includes('AI 增强不等于 AI 依赖') && productReadiness.includes('没有生产模型时'), 'AI usage matrix protects local fallback and avoids provider dependency');
assert(storageJs.includes('sevenDayParentPlan') && storageJs.includes('cannotAnswerFallback') && storageJs.includes('child_explains_back'), 'Parent guide has a real seven-day coaching script with fallback and transfer evidence');
assert(profileWxml.includes('今晚话术') && profileWxml.includes('答不上来') && profileWxml.includes('第 {{item.day}} 晚'), 'Profile surfaces parent coaching depth instead of hiding it in data');
assert(!storageJs.includes('unlockedBySubscription: true'), 'Parent coaching guide is locally usable and not a fake locked feature');
assert(storageJs.includes('buildTransferPracticeSet') && storageJs.includes('recordParentReflectionReceipt'), 'Product has local transfer practice and parent reflection receipts');
assert(reviewJs.includes('buildTransferPracticePanel') && reviewJs.includes('recordTransferPractice') && reviewWxml.includes('transferPractice.prompts'), 'Review page turns transfer practice into a visible, recordable learner flow');
assert(reviewJs.includes('buildOutcomeCheckPanel') && reviewJs.includes('recordOutcomeCheck') && reviewWxml.includes('outcomeCheck.actions'), 'Review page turns outcome review into a visible parent/child check flow');
assert(storageJs.includes('FIRST_STEP_PROMPT_CARDS') && storageJs.includes('buildFirstStepPromptCard') && storageJs.includes('physics') && storageJs.includes('chemistry') && storageJs.includes('geography'), 'Product borrows multi-subject visual-learning expectations as first-step prompt cards, not full answer generation');
assert(storageJs.includes('FIRST_STEP_CARD_VARIANTS') && storageJs.includes('物理受力第一步卡') && storageJs.includes('化学方程式第一步卡') && storageJs.includes('地理读图第一步卡'), 'First-step prompt cards include subject-plus-stuck-point variants instead of one thin generic card');
assert(storageJs.includes('LOCAL_SCENARIO_LOOP_CASES') && storageJs.includes('applyLocalScenarioLoopCase') && storageJs.includes('local_scenario_loop'), 'Product has local scenario loop cases for zero-help friend trials');
assert(storageJs.includes('math_relation_apples') && storageJs.includes('physics_circuit_path') && storageJs.includes('biology_control_group'), 'Scenario loop cases cover multiple subject examples');
assert(storageJs.includes('recordTransferPracticeAttempt') && storageJs.includes('recordOutcomeCheck') && storageJs.includes('recordParentReflectionReceipt'), 'Scenario loop applies transfer practice, outcome check, and parent reflection evidence');
assert(homeJs.includes('localScenarioCases') && homeJs.includes('applyLocalScenarioCase'), 'Home page exposes local scenario loop cases as a usable entry');
assert(homeWxml.includes('localScenarioCases') && homeWxml.includes('不知道填什么，先用一题走通') && homeWxml.includes('用这题走一遍'), 'Home page lets a non-technical user start from a real example without blank-input friction');
assert(homeJs.includes('openScenarioReview') && homeJs.includes('openScenarioProfile'), 'Scenario loop has explicit next-route actions after a case is applied');
assert(homeWxml.includes('activeScenarioResult.flowSteps') && homeWxml.includes('去修这张卡') && homeWxml.includes('看家长复盘'), 'Scenario result explains completed loop steps and offers review/profile routes');
assert(homeWxss.includes('scenario-loop-pack') && homeWxss.includes('scenario-loop-card'), 'Home page styles the scenario loop pack as a compact usable surface');
assert(reviewWxml.includes('blackboard-first-step') && reviewWxml.includes('reviewViewModel.blackboard.firstMove'), 'Review page exposes first-step prompt cards inside the existing blackboard surface');
assert(reviewWxml.includes('blackboard-parent-prompt') && reviewWxml.includes('blackboard-avoid'), 'Review page exposes parent one-question and avoid guidance for first-step cards');
assert(!/AI板书讲题|板书生成|拍题出答案|七科全能讲解/.test(reviewWxml + storageJs), 'First-step prompt cards avoid overclaiming board generation or full-solution tutoring');
assert(profileWxml.includes('追问回执'), 'Profile exposes parent reflection evidence');
assert(storageJs.includes('recordTransferPracticeAttempt') && storageJs.includes('buildWeeklyPatternSynthesis') && storageJs.includes('buildLearningDecisionPath'), 'Product has transfer attempt state, weekly synthesis, and next-action decisioning');
assert(profileWxml.includes('一周归因') && profileWxml.includes('下一步'), 'Profile exposes pattern synthesis and next-action decisioning');
assert(storageJs.includes('buildMasteryRubric') && storageJs.includes('buildInterventionPlaybook') && storageJs.includes('recordOutcomeCheck'), 'Product has mastery rubric, intervention playbook, and outcome review');
assert(profileWxml.includes('掌握度') && profileWxml.includes('干预打法') && profileWxml.includes('结果复核'), 'Profile exposes mastery, intervention, and outcome review depth');
assert(storageJs.includes('buildLearningDepthMap') && productReadiness.includes('depth_compounding'), 'Product has a multi-layer learning depth map and readiness dimension');
assert(profileJs.includes('learningDepthMap') && profileWxml.includes('厚度进度') && profileWxml.includes('learningDepthMap.dimensions'), 'Profile exposes learning depth as a user-facing capability map');
assert(storageJs.includes('buildLearningQuestArc') && storageJs.includes('学习剧情线') && storageJs.includes('苏格拉底'), 'Product has a story-like learning quest arc across tutor, repair, transfer, parent, and next-day review');
assert(homeJs.includes('learningQuestArc') && homeWxml.includes('learningQuestArc.stages') && homeWxml.includes('runQuestArcAction'), 'Home exposes the learning quest arc as an actionable flow');
assert(profileJs.includes('learningQuestArc') && profileWxml.includes('当前剧情') && profileWxml.includes('learningQuestArc.parentHook'), 'Profile exposes the quest arc for parent-readable story closure');
assert(storageJs.includes('buildModuleFlowCompass') && storageJs.includes('transfer') && storageJs.includes('share'), 'Product has a cross-module flow compass covering the end-to-end module chain');
assert(homeJs.includes('moduleFlowCompass') && homeWxml.includes('module-flow-card') && homeWxml.includes('runModuleFlowCompassAction'), 'Home exposes a cross-module flow compass with a routeable next action');
assert(profileJs.includes('moduleFlowCompass') && profileWxml.includes('模块流转罗盘') && profileWxml.includes('moduleFlowCompass.summary'), 'Profile exposes the module flow compass for parent-readable closure inspection');
assert(storageJs.includes('buildSurfaceDepthPack') && storageJs.includes("home:") && storageJs.includes("tutor:") && storageJs.includes("review:") && storageJs.includes("arcade:") && storageJs.includes("profile:"), 'Product has board-specific depth packs instead of only a global flow surface');
assert(['tools', 'upload', 'diagnosis', 'focus', 'module', 'radar', 'daily_math', 'dictation', 'light_diagnosis'].every((surface) => storageJs.includes(`${surface}:`)), 'Second-circle pages have their own depth packs instead of borrowing one generic card');
assert(storageJs.includes('legal:') && legalJs.includes("buildSurfaceDepthPack('legal')") && legalWxml.includes('surfaceDepthPack.cards') && legalWxml.includes('bindtap="runSurfaceDepthAction"') && legalWxss.includes('.legal-depth-card'), 'Legal page has a trust and boundary depth pack with routeable actions');
assert(storageJs.includes('routeMap') && storageJs.includes('primaryRoute') && navigationJs.includes('navigateLearningRoute'), 'Surface depth packs expose real page routes and share a safe miniapp navigator');
assert(navigationJs.includes('rememberTabRouteContext') && navigationJs.includes('navigation.pendingTabRoute.v1') && navigationJs.includes('routeQuery'), 'Navigator preserves tab-route query context before switchTab drops it');
assert(storageJs.includes('surfaceDepthEvents') && storageJs.includes('recordSurfaceDepthAction') && storageJs.includes('buildSurfaceDepthActionSummary') && storageJs.includes("appendSyncMutation('surface_depth_action'"), 'Surface depth actions are persisted as evidence and queued for sync');
assert(storageJs.includes('inferSurfaceDepthCapability') && storageJs.includes('capability_id') && storageJs.includes('capabilityCounts') && storageJs.includes('topCapability'), 'Surface depth actions infer and persist capability-level evidence');
assert(storageJs.includes('buildGlobalEvidenceBrief') && storageJs.includes('socratic') && storageJs.includes('surface_action') && storageJs.includes('reportLine') && storageJs.includes('shareLine'), 'Product has a global evidence brief across Socratic, game, module action, share, and report signals');
assert(storageJs.includes('buildCapabilityEvidenceLedger') && ['socratic', 'game', 'report', 'share', 'light_entry', 'module_flow', 'parent_action', 'surface_action', 'next_action'].every((id) => storageJs.includes(id)), 'Product has a capability evidence ledger across Socratic, game, report, share, light entry, module flow, parent action, surface action, and next action');
assert(storageJs.includes('buildCapabilityMaturityQueue') && storageJs.includes('socratic_depth') && storageJs.includes('game_retention') && storageJs.includes('report_decision') && storageJs.includes('light_entry_scale') && storageJs.includes('share_return_loop'), 'Product has a global capability maturity queue across tutor, game, report, light entry, and share loops');
assert(homeJs.includes('capabilityMaturityQueue') && homeWxml.includes('runCapabilityMaturityAction') && profileJs.includes('capabilityMaturityQueue') && profileWxml.includes('runCapabilityMaturityAction'), 'Home and Profile expose the global capability maturity queue as executable routed actions');
assert(storageJs.includes('acceptanceCriteria') && storageJs.includes('fallbackPlan') && storageJs.includes('evidenceContractLine') && storageJs.includes('parentCheckLine'), 'Capability maturity queue has acceptance criteria, fallback plans, evidence contracts, and parent checks');
assert(homeWxml.includes('item.evidenceContractLine') && homeWxml.includes('item.fallbackLine') && profileWxml.includes('capabilityMaturityQueue.next.acceptanceLine') && profileWxml.includes('capabilityMaturityQueue.next.parentCheckLine'), 'Home and Profile expose maturity acceptance, fallback, and evidence lines');
assert(storageJs.includes('对标 Khanmigo') && storageJs.includes('对标 Gizmo') && storageJs.includes('不承诺全科自动板书讲题'), 'Capability maturity queue borrows competitor mechanics while preserving product boundary');
assert(storageJs.includes('capabilityLine') && storageJs.includes('ledgerPrimaryRoute') && storageJs.includes('capabilityLedgerSummary') && storageJs.includes('capabilityEvidenceLedger'), 'Every surface depth pack carries capability-ledger summary and route context');
assert(storageJs.includes('surfaceCapabilityMap') && storageJs.includes('capabilityCards') && storageJs.includes("home: ['socratic'") && storageJs.includes("profile: ['report'") && storageJs.includes("daily_math: ['light_entry'"), 'Every surface maps to concrete capability ledger cards instead of a generic global ledger');
assert(storageJs.includes('functionCards') && storageJs.includes('visibleCards') && storageJs.includes("cardType: 'capability'") && storageJs.includes('能力·'), 'Surface depth strips merge function cards with visible capability-ledger cards across modules');
assert(storageJs.includes('surfaceLoop') && storageJs.includes('loopLine') && storageJs.includes('入口闭环') && storageJs.includes('留下证据') && storageJs.includes('家长看'), 'Every surface depth pack has an entry-action-evidence-parent-next loop, not just isolated cards');
assert(profileJs.includes('capabilityEvidenceLedger') && profileWxml.includes('capability-ledger-card') && profileWxml.includes('capabilityEvidenceLedger.rows') && profileWxml.includes('goCapabilityLedgerRoute'), 'Profile exposes the capability evidence ledger by default with an executable next route');
assert(!/capabilityEvidenceLedger[^"]*showAdvancedProfile|showAdvancedProfile[^"]*capabilityEvidenceLedger/.test(profileWxml), 'Capability evidence ledger is not hidden behind advanced mode');
assert(profileJs.includes('capabilityGap') && profileJs.includes('capability_gap_id') && profileJs.includes('capability_gap_route') && profileJs.includes('capability_label'), 'Daily share card carries the next capability gap in payload and share route query');
assert(profileWxml.includes('dailyShareCard.capabilityGap') && profileWxml.includes('dailyShareCard.familyActionCard.capabilityLine'), 'Daily share card visibly explains the next capability gap and evidence line');
assert(profileJs.includes('capabilityNextLine') && profileJs.includes('capabilityEvidenceLine') && profileJs.includes('capabilityProgressLine'), 'Learning report summary folds capability-ledger progress into the report loop');
assert(profileWxml.includes('learningReportSummary.capabilityNextLine') && profileWxml.includes('learningReportSummary.capabilityEvidenceLine') && profileWxml.includes('learningReportSummary.capabilityProgressLine'), 'Learning report UI exposes capability-ledger next action and evidence');
assert(learningReport.includes('buildLongTermLearningPortrait') && learningReport.includes('buildClassroomDecisionBoard') && learningReport.includes('nextConferenceQuestion'), 'Learning report has long-term portrait and classroom decision board depth');
assert(profileJs.includes('longTermPortrait') && profileJs.includes('classroomDecisionBoard') && profileWxml.includes('长期画像') && profileWxml.includes('课堂级决策板'), 'Profile report exposes long-term portrait and classroom-grade decision guidance');
assert(learningReport.includes('portraitDimensions') && learningReport.includes('observationRubric') && learningReport.includes('interventionLadder') && learningReport.includes('decisionCard') && learningReport.includes('weeklyReviewAgenda'), 'Learning report carries Khanmigo-grade portrait dimensions, classroom rubric, intervention ladder, and family decision card');
assert(profileJs.includes('longTermPortraitDimensions') && profileJs.includes('classroomObservationRubric') && profileJs.includes('familyDecisionWeeklyReviewAgenda') && profileWxml.includes('画像维度') && profileWxml.includes('课堂量表') && profileWxml.includes('周复盘'), 'Profile exposes report depth as parent-readable decision guidance');
assert(learningReport.includes('buildPortraitConfidenceSystem') && learningReport.includes('evidenceLedger') && learningReport.includes('decisionThresholds') && learningReport.includes('parentTrustContract'), 'Learning report has a long-term portrait confidence system');
assert(profileJs.includes('portraitConfidenceSystem') && profileJs.includes('portraitConfidenceLedger') && profileWxml.includes('长期画像可信度账本') && profileWxml.includes('决策阈值') && profileWxml.includes('观察周期'), 'Profile exposes portrait confidence, thresholds, and observation cadence');
assert(learningReport.includes('buildParentDecisionTrustSystem') && learningReport.includes('decisionDeck') && learningReport.includes('weeklyDecisionReview') && learningReport.includes('shareBoundary'), 'Learning report has a parent decision trust system with decision cards and share boundaries');
assert(profileJs.includes('parentDecisionTrustSystem') && profileJs.includes('parentDecisionTrustDeck') && profileWxml.includes('家长决策可信度') && profileWxml.includes('决策卡') && profileWxml.includes('护栏'), 'Profile exposes parent decision trust cards, guardrails, and review cadence');
assert(learningReport.includes('buildLongitudinalPortraitTimeline') && learningReport.includes('longitudinal_portrait_timeline') && learningReport.includes('riskTransitions') && learningReport.includes('updateGates'), 'Learning report has a longitudinal portrait timeline with update gates and risk transitions');
assert(profileJs.includes('longitudinalPortraitTimeline') && profileJs.includes('longitudinalPortraitUpdateGates') && profileWxml.includes('长期画像时间轴') && profileWxml.includes('画像门槛') && profileWxml.includes('转向规则'), 'Profile exposes longitudinal portrait timeline, update gates, and transition rules');
assert(learningReport.includes('two_week_stability_check') && profileWxml.includes('learningReportSummary.longitudinalPortraitShareBoundary'), 'Longitudinal portrait preserves two-week stability and privacy-safe sharing boundaries');
assert(learningReport.includes('homeworkPressureContext') && learningReport.includes('真实作业卡点') && learningReport.includes('本次报告绑定真实作业卡点'), 'Learning report binds real-homework pressure wrong cause and first step into report evidence instead of staying generic');
assert(miniappDepthAudit.includes('Cross-module consistency radar') && miniappDepthAudit.includes('realHomeworkCrossModuleConsistent'), 'Depth audit blocks thick-but-inaccurate drift across tutor, game, report, and share');
assert(learningReport.includes('buildPortraitEvidenceMaturitySystem') && learningReport.includes('portrait_evidence_maturity_system') && learningReport.includes('decisionLocks') && learningReport.includes('maturityLanes'), 'Learning report has a portrait evidence maturity system');
assert(profileJs.includes('portraitEvidenceMaturitySystem') && profileJs.includes('portraitEvidenceDecisionLocks') && profileWxml.includes('长期画像证据成熟度') && profileWxml.includes('决策锁'), 'Profile exposes portrait maturity lanes and decision locks');
assert(learningReport.includes('buildPortraitDecisionReleaseSystem') && learningReport.includes('portrait_decision_release_system') && learningReport.includes('long_term_portrait_gate') && learningReport.includes('adaptive_recall_scheduler'), 'Learning report has a portrait decision release system gated by recall scheduler evidence');
assert(profileJs.includes('portraitDecisionReleaseSystem') && profileJs.includes('portraitDecisionReleaseLanes') && profileWxml.includes('长期画像放行建议') && profileWxml.includes('画像锁'), 'Profile exposes portrait release lanes, locks, and parent decision line');
assert(learningReport.includes('buildReportEvidenceReleaseGate') && learningReport.includes('report_evidence_release_gate') && learningReport.includes('singleSampleLock') && learningReport.includes('twoWeekStabilityGate'), 'Learning report has a deterministic evidence release gate against single-sample overdiagnosis');
assert(profileJs.includes('reportEvidenceReleaseGate') && profileJs.includes('reportEvidenceBlockedFields') && profileWxml.includes('报告证据放行闸') && profileWxml.includes('单题锁') && profileWxml.includes('两周稳定闸'), 'Profile exposes report evidence release gate, locks, and blocked fields');
assert(reportGenerator.includes('buildParentDecisionShareData') && reportGenerator.includes('parentDecisionBook') && reportGenerator.includes('gameReturnEvidence') && reportGenerator.includes('blockedFields') && reportGenerator.includes('已屏蔽'), 'Report generator renders parent decision book and safe-share blocked fields instead of a thin generic card');
assert(profileJs.includes('reportEvidenceTopLine') && profileJs.includes('nextEvidenceTopLine') && profileJs.includes('howToLearnBetter') && profileWxml.includes('报告一口径') && profileWxml.includes('怎么学更好'), 'Profile lifts report evidence decision and how-to-learn guidance into parent-visible report surfaces');
assert(realHomeworkCoverage.includes('PUBLIC_K12_OPEN_SOURCE_RESOURCE_LEDGER') && realHomeworkCoverage.includes('phet_simulation_oer') && realHomeworkCoverage.includes('ck12_flexbook_practice') && realHomeworkCoverage.includes('openstax_high_school_reference'), 'Real homework coverage includes an open-source/OER resource ledger');
assert(realHomeworkCoverage.includes('sourceUrl') && realHomeworkCoverage.includes('licenseSignal') && realHomeworkCoverage.includes('commercialDecision'), 'Open-source/OER ledger carries source links, license signals, and commercial-use decisions');
assert(realHomeworkCoverage.includes('buildK12PublicResourceTriageBoard') && realHomeworkCoverage.includes('k12_public_resource_triage_board') && realHomeworkCoverage.includes('sourceBackedChallengeSeeds'), 'Real homework coverage has a public-resource triage board and source-backed challenge seeds');
assert(profileJs.includes('realHomeworkPublicResourceTriageBoard') && profileWxml.includes('资料决策') && profileWxml.includes('来源挑战种子'), 'Profile exposes public-resource triage decisions and source-backed challenge seeds');
assert(realHomeworkCoverage.includes('buildPressureSampleFailureTypeAudit') && realHomeworkCoverage.includes('pressure_sample_failure_type_audit') && realHomeworkCoverage.includes('first_step_generic'), 'Real homework coverage has a reverse failure-type audit for pressure samples');
assert(profileJs.includes('pressureFailureTypeAudit') && profileWxml.includes('反向抽检') && profileWxml.includes('待查类型') && profileWxml.includes('待修样本'), 'Profile exposes reverse pressure-sample audit results to parents/operators');
assert(profileJs.includes('realHomeworkOpenSourceResources') && profileWxml.includes('开源资料') && profileWxml.includes('openSourceResourceLine') && profileWxml.includes('许可提醒') && profileWxml.includes('使用判断'), 'Profile exposes open-source/OER use decisions to parents');
assert(realHomeworkCoverage.includes('PUBLIC_K12_HOMEWORK_INTAKE_QUEUE') && profileJs.includes('realHomeworkIntakeQueue') && profileWxml.includes('采集队列') && profileWxml.includes('homeworkIntakeQueueLine'), 'Profile exposes public K12 homework intake queue across local pressure, Socratic, game, report, and share uses');
assert(realHomeworkCoverage.includes('buildPublicK12IntakeChallengeDeck') && storageJs.includes('publicK12IntakeChallengeDeck') && profileJs.includes('realHomeworkIntakeChallengeDeck') && profileWxml.includes('可玩采集卡') && profileWxml.includes('公开作业挑战'), 'Public K12 intake rows become playable challenge cards in report and community share surfaces');
assert(learningReport.includes('buildSocraticMemoryReportBridge') && learningReport.includes('socratic_memory_report_bridge') && learningReport.includes('noIncreaseRule'), 'Learning report consumes Socratic quality memory evidence as a report trust bridge');
assert(profileJs.includes('socraticMemoryReportBridge') && profileJs.includes('socraticMemoryReportActions') && profileWxml.includes('点拨质量到长期画像') && profileWxml.includes('不加题规则'), 'Profile exposes Socratic memory evidence inside the parent report');
assert(tutorLadder.includes('buildSocraticPromptQualityJudge') && tutorLadder.includes('effectivePrompts') && tutorLadder.includes('misleadingPrompts') && tutorLadder.includes('stopConditions'), 'Tutor ladder has a Socratic prompt quality judge for effective, misleading, and stop-condition rules');
assert(tutorJs.includes('socraticPromptQualityJudge') && tutorWxml.includes('thinkingReceipt.socraticPromptQualityJudge') && tutorWxml.includes('有效追问') && tutorWxml.includes('误导追问'), 'Tutor exposes Socratic prompt quality judge in the thinking receipt');
assert(tutorLadder.includes('buildAnswerBoundaryEvidence') && tutorLadder.includes('answer_boundary_evidence') && tutorLadder.includes('answer_request_blocked'), 'Tutor ladder turns direct-answer requests into explicit answer-boundary evidence');
assert(tutorJs.includes('recordAnswerBoundaryEvidence') && tutorJs.includes('answer_boundary_evidence'), 'Tutor page persists answer-boundary evidence instead of only showing a blocked reply');
assert(storageJs.includes('recordAnswerBoundaryEvidence') && storageJs.includes('answer_boundary_evidence') && storageJs.includes('answer_boundary_review_seeded') && storageJs.includes('tutor_answer_boundary'), 'Storage converts answer-boundary evidence into review, report, and sync assets');
assert(profileJs.includes('socraticPromptQualityJudge') && profileWxml.includes('learningReportSummary.socraticPromptQualityJudge') && profileWxml.includes('家长判断'), 'Profile report carries Socratic prompt quality evidence into parent decisions');
assert(storageJs.includes('SUBJECT_SKILL_DEPTH') && storageJs.includes('buildSubjectSkillDepth') && ['math_word_problem', 'equation_setup', 'reading_question', 'english_sentence', 'physics_diagram', 'chemistry_experiment', 'biology_process', 'geography_map', 'writing_process', 'unknown'].every((id) => storageJs.includes(id)), 'Product has task-type depth packs for core subject/stuck-point patterns');
assert(tutorJs.includes('subjectSkillDepth') && tutorWxml.includes('thinkingReceipt.subjectSkillDepth.blackboard'), 'Tutor receipt exposes task-type blackboard depth inside the Socratic flow');
assert(storageJs.includes('SOCRATIC_ASSESSMENT_MATRIX') && storageJs.includes('buildSocraticAssessmentMatrix') && storageJs.includes('misconceptionChecks') && storageJs.includes('recoveryMoves'), 'Socratic layer has reusable task-type assessment, misconception, and recovery matrices');
assert(tutorWxml.includes('thinkingReceipt.subjectSkillDepth.socraticAssessment') && tutorWxml.includes('迁移检查'), 'Tutor receipt exposes task-type Socratic assessment and transfer check');
assert(arcadeJs.includes('subjectSkillDepth') && arcadeJs.includes('subjectDepthGameLine') && arcadeWxml.includes('challengeBrief.subjectDepthLine'), 'Arcade adapts each round to the current task-type depth and visible drills');
assert(gameLogic.includes('buildHighFrequencyPracticeLoop') && arcadeJs.includes('highFrequencyPracticeLoop') && arcadeWxml.includes('高频回忆计划') && arcadeWxml.includes('highFrequencyPracticeLoop.spacedReviewPlan'), 'Arcade has a visible high-frequency active-recall and spaced-review loop');
assert(gameLogic.includes('buildReviewReturnSeed') && gameLogic.includes('spacedRecallPolicy') && arcadeJs.includes('reviewReturnSeed') && arcadeJs.includes('spacedRecallPolicy') && arcadeJs.includes('review_return_seed_next_route'), 'Arcade persists a compact review-return seed for Gizmo-style recall loops');
assert(arcadeJs.includes('buildNinetySecondRecallState') && arcadeJs.includes('startNinetySecondRecall') && arcadeJs.includes('completeNinetySecondRecallStep') && arcadeJs.includes('finishNinetySecondRecall') && arcadeJs.includes('persistNinetySecondRecallEvidence'), 'Arcade page exposes a runnable 90-second recall state machine');
assert(arcadeJs.includes('ninety_second_first_step_challenge') && arcadeWxml.includes('first-step-sprint-card') && arcadeWxml.includes('开始 90 秒第一步'), 'Arcade exposes a default 90-second same-type first-step challenge instead of burying the game loop');
assert(arcadeJs.includes('说出第一步') && arcadeJs.includes('指出错因') && arcadeJs.includes('同类换壳能开口') && arcadeJs.includes('不奖励速度、分数、排行或抄答案'), 'Arcade 90-second challenge rewards first-step evidence, wrong-cause naming, and near transfer without score/rank incentives');
assert(arcadeJs.includes('decorateNinetySecondRecallState') && arcadeJs.includes('failureDowngradeLine') && arcadeWxml.includes('item.uiClass') && arcadeWxml.includes('当前只做这一步'), 'Arcade 90-second recall exposes current/completed/timeout downgrade UI state');
assert(arcadeWxml.includes('开始 90 秒') && arcadeWxml.includes('data-step-id') && arcadeWxml.includes('重来一轮') && arcadeWxml.includes('ninetySecondRecallState.interactions'), 'Arcade page exposes the 90-second recall deck as clickable steps');
assert(reviewCards.includes('buildImportMemoryMetadata') && reviewCards.includes('materialMemoryBridge') && reviewCards.includes('sourceMaterialType') && reviewCards.includes('nextRevisitWindow'), 'Review cards turn Chinese material imports into high-frequency memory metadata and a review bridge');
assert(reviewCards.includes('不抓链接、不解析文件、不生成原题答案库') && reviewCards.includes('不奖励速度、分数或排名'), 'Material memory bridge keeps import and game incentives safe');
assert(gameLogic.includes('buildMemoryFeedbackController') && arcadeWxml.includes('memoryFeedbackController') && arcadeJs.includes('memory_feedback_severity'), 'Arcade has a visible memory feedback controller and records its severity');
assert(arcadeJs.includes('buildArcadeResultActionBridge') && arcadeJs.includes('runArcadeResultBridgeAction') && arcadeWxml.includes('arcadeResultActionBridge.actions') && arcadeJs.includes('arcade_result_bridge_action'), 'Arcade result screen routes into review, parent report, and Socratic next action with persisted evidence');
assert(arcadeJs.includes('primaryShareLabel') && arcadeJs.includes('peer_90s_relay') && arcadeWxml.includes('arcadeResultActionBridge.shareChallengeTitle'), 'Arcade result screen exposes a 90-second peer relay challenge instead of ending at a score report');
assert(reviewJs.includes('buildPostRepairBridge') && reviewJs.includes('runPostRepairBridgeAction') && reviewWxml.includes('postRepairBridge.actions') && reviewJs.includes('review_post_repair_bridge_action'), 'Review repair flow routes into game, parent report, and Socratic next action with persisted evidence');
assert(profileJs.includes('subjectSkillDepthLine') && profileJs.includes('subject_depth_task_type') && profileWxml.includes('learningReportSummary.subjectSkillDepthLine') && profileWxml.includes('dailyShareCard.subjectSkillDepth'), 'Profile report and share card carry task-type depth evidence and share payload');
assert(storageJs.includes('CURRICULUM_SPINE') && storageJs.includes('buildCurriculumSpine') && ['math', 'chinese', 'english', 'physics', 'chemistry', 'biology', 'geography'].every((id) => storageJs.includes(`${id}:`)), 'Product has a seven-subject curriculum spine instead of one-off prompt cards');
assert(storageJs.includes('visualBoardLine') && storageJs.includes('不直接给完整答案') && storageJs.includes('scaleLine'), 'Curriculum spine keeps visual explanation honest as first-step board, not full auto blackboard tutoring');
assert(arcadeJs.includes('curriculumSpine') && arcadeWxml.includes('challengeBrief.curriculumLine') && arcadeWxml.includes('challengeBrief.curriculumProgression'), 'Arcade rounds consume the curriculum spine as visible progression');
assert(profileJs.includes('curriculumReportLine') && profileJs.includes('curriculum_subject') && profileWxml.includes('learningReportSummary.curriculumReportLine') && profileWxml.includes('dailyShareCard.curriculumSpine'), 'Profile report and share cards carry curriculum-spine evidence and payload');
assert(storageJs.includes('buildVisualSocraticMatrix') && storageJs.includes('boardMoves') && storageJs.includes('socraticQuestions') && storageJs.includes('第一步小黑板，不是全科自动板书讲题'), 'Product has a visual Socratic matrix with explicit first-step-board boundary');
assert(tutorJs.includes('visualSocraticMatrix') && tutorWxml.includes('thinkingReceipt.visualSocraticMatrix.boardMoves') && tutorWxml.includes('thinkingReceipt.visualSocraticMatrix.socraticQuestions'), 'Tutor exposes visual Socratic board moves and probes');
assert(profileJs.includes('visualSocraticReportLine') && profileJs.includes('visual_socratic_subject') && profileWxml.includes('dailyShareCard.visualSocraticMatrix'), 'Profile report and share cards carry visual Socratic evidence');
assert(homeJs.includes('capability_gap') && homeJs.includes('capability_next_action') && homeWxml.includes('incomingShare.capability_label') && storageJs.includes('incomingShare.capability_gap'), 'Incoming share return preserves and displays capability-gap context for downstream route bias');
assert(profileJs.includes('courseUnitDecision') && profileJs.includes('course_unit_parent_decision') && profileJs.includes('course_unit_game_route'), 'Daily share card carries course-unit decision context and routes');
assert(homeJs.includes('course_unit_parent_decision') && homeWxml.includes('incomingShare.course_unit_label') && storageJs.includes('course_unit_share_contract'), 'Incoming share return preserves visible course-unit decision context');
assert(profileJs.includes('learning_report_cta') && profileJs.includes('summary.capabilityLedger') && profileJs.includes('recordSurfaceDepthAction'), 'Learning report CTA writes capability-level surface evidence before navigation');
assert(profileJs.includes('familyDecisionActionBridge') && profileWxml.includes('learningReportSummary.familyDecisionActionBridge') && profileWxml.includes('runFamilyDecisionBridgeAction'), 'Learning report turns family decisions into visible executable action-bridge choices');
assert(profileJs.includes('family_decision_bridge') && profileJs.includes('family_decision_bridge_action') && profileJs.includes('recordUnifiedNextAction') && profileJs.includes('recordSurfaceDepthAction'), 'Family decision bridge writes unified next-action and surface-depth evidence before navigation');
assert(profileWxml.includes('family-decision-bridge-grid') && profileWxml.includes('data-share-intent') && profileWxss.includes('family-decision-bridge-action'), 'Family decision bridge has compact routed actions including share intent');
assert(learningReport.includes('buildTonightDecisionBrief') && learningReport.includes('tonight_decision_brief') && learningReport.includes('今晚决策书'), 'Learning report has a concrete tonight decision brief instead of only a data dashboard');
assert(profileJs.includes('tonightDecisionBrief') && profileJs.includes('tonight_decision_headline') && profileJs.includes('tonight_blocked_fields'), 'Profile summary and share payload carry tonight decision brief safely');
assert(profileWxml.includes('learningReportSummary.tonightDecisionBrief') && profileWxml.includes('今晚做') && profileWxml.includes('今晚不做') && profileWxml.includes('放行门槛'), 'Profile visibly exposes the parent tonight decision brief');
assert(storageJs.includes('buildLightFeatureEvidenceSummary') && storageJs.includes('light_entry') && storageJs.includes('轻入口证据') && profileJs.includes('lightFeatureEvidence') && profileWxml.includes('轻入口'), 'Light entries roll up into global evidence and parent-visible profile evidence');
assert(storageJs.includes('LIGHT_ENTRY_SEED_BANK') && storageJs.includes('buildLightEntrySeedBank') && storageJs.includes('symbol_scan') && storageJs.includes('unit_place') && storageJs.includes('sound_shape') && storageJs.includes('shape_part') && storageJs.includes('type_confirm') && storageJs.includes('known_unknown'), 'Light entries have expanded reusable task and wrong-cause seed banks');
assert(storageJs.includes('modelLine') && storageJs.includes('blackboardLine') && storageJs.includes('evidenceLine') && storageJs.includes('loopLine') && storageJs.includes('已沉淀') && storageJs.includes('回流路线'), 'Light-entry seed banks expose model, blackboard, evidence, and loop closure lines');
assert(storageJs.includes('buildSubjectSeedLibrary') && read('miniprogram/pages/light-diagnosis/light-diagnosis.wxml').includes('七科第一步种子库'), 'Light diagnosis exposes a seven-subject first-step seed library');
assert(storageJs.includes('wrongCauseModel') && storageJs.includes('transferPrompt') && storageJs.includes('recallPrompt') && storageJs.includes('evidenceContractLine') && storageJs.includes('progressionLine'), 'Seven-subject seed library carries wrong-cause, transfer, recall, evidence, and progression contracts');
assert(read('miniprogram/pages/light-diagnosis/light-diagnosis.wxml').includes('item.wrongCauseModel') && read('miniprogram/pages/light-diagnosis/light-diagnosis.wxml').includes('item.boardMove') && read('miniprogram/pages/light-diagnosis/light-diagnosis.wxml').includes('item.parentCheckLine') && read('miniprogram/pages/light-diagnosis/light-diagnosis.wxml').includes('item.evidenceContractLine') && read('miniprogram/pages/light-diagnosis/light-diagnosis.wxml').includes('item.loopLine'), 'Light diagnosis visibly exposes subject seed contracts without full-answer promises');
assert(read('miniprogram/pages/light-diagnosis/light-diagnosis.js').includes('runSubjectSeedAction') && read('miniprogram/pages/light-diagnosis/light-diagnosis.js').includes('subject_seed_library') && read('miniprogram/pages/light-diagnosis/light-diagnosis.js').includes('recordUnifiedNextAction') && read('miniprogram/pages/light-diagnosis/light-diagnosis.wxml').includes('bindtap="runSubjectSeedAction"'), 'Seven-subject seed cards are executable and write unified next-action evidence');
assert(storageJs.includes('buildCourseUnitMap') && storageJs.includes('reusableQuestionTypes') && storageJs.includes('wrongCauseAtlas') && storageJs.includes('diagnosticProbes'), 'Product has a course-unit map with reusable question types, wrong-cause atlas, and diagnostic probes');
assert(storageJs.includes('blackboardBlueprint') && storageJs.includes('practiceLoop') && storageJs.includes('reportContract') && storageJs.includes('shareContract'), 'Course units connect first-step blackboard, practice loop, report contract, and share contract');
assert(storageJs.includes('buildCourseUnitMasteryTrajectory') && storageJs.includes('regressionRisk') && storageJs.includes('parentInterventionLevel') && storageJs.includes('nextEvidence'), 'Course units have mastery trajectory, regression risk, next evidence, and parent intervention levels');
assert(storageJs.includes('buildCourseUnitQuestionBank') && storageJs.includes('active_recall') && storageJs.includes('wrong_cause') && storageJs.includes('near_transfer'), 'Course units have a reusable question bank for recall, wrong-cause, and transfer cards');
assert(storageJs.includes('buildQuestionSampleCard') && storageJs.includes('sampleStem') && storageJs.includes('firstStepHint') && storageJs.includes('nearTransferStem') && storageJs.includes('parentCheck') && storageJs.includes('safetyBoundary'), 'Course unit question cards carry realistic sample stems, first-step hints, transfer prompts, parent checks, and safety boundaries');
assert(storageJs.includes('buildRightsBoundaryEnvelope') && storageJs.includes('sourceContentPolicy') && storageJs.includes('originalTextIncluded: false') && storageJs.includes('answer_key'), 'Question sample cards carry a unified source-rights envelope and block source answers');
assert(storageJs.includes('buildQuestionProgressionCard') && storageJs.includes('entryTask') && storageJs.includes('repairTask') && storageJs.includes('nextDayRevisit') && storageJs.includes('masteryGate') && storageJs.includes('parentEvidence'), 'Course unit question cards carry executable progression paths, mastery gates, and parent evidence');
assert(storageJs.includes('buildQuestionTypeTransferLadder') && storageJs.includes('transferLadderRungCount') && storageJs.includes('blockerRules') && storageJs.includes('parentDecisionRule'), 'Course unit question bank has question-type transfer ladders with blockers and parent decision rules');
assert(storageJs.includes('buildCourseUnitDepthExpansionAtlas') && storageJs.includes('misconceptionVariants') && storageJs.includes('visualBoardTemplate') && storageJs.includes('parentCheckScript') && storageJs.includes('shareSafeLine'), 'Course units have a depth expansion atlas for archetypes, misconceptions, visual boards, parent scripts, and safe relay');
assert(storageJs.includes('buildCommercialDepthRunway') && storageJs.includes('question_type_depth') && storageJs.includes('memory_feedback') && storageJs.includes('parent_decision_trust'), 'Miniapp has a three-lane commercial depth runway for content, memory, and parent trust');
assert(storageJs.includes('visualBoardMoves') && storageJs.includes('memoryCadence') && storageJs.includes('parentDecisionRubric'), 'Commercial depth runway carries visual board moves, memory cadence, and parent decision rubric');
assert(storageJs.includes('buildWeeklyEvidenceFlywheel') && storageJs.includes('weekly_evidence_flywheel') && storageJs.includes('blocked_fields'), 'Miniapp has a weekly evidence flywheel with safe share payload boundaries');
assert(storageJs.includes('buildSevenSubjectMasterySprint') && storageJs.includes('seven_subject_mastery_sprint') && storageJs.includes('contentScaleTarget') && storageJs.includes('memoryGameTarget') && storageJs.includes('parentDecisionTarget'), 'Miniapp has a seven-subject mastery sprint across content, game memory, and parent decisions');
assert(storageJs.includes('buildRealHomeworkCoverageMatrix') && read('miniprogram/utils/real-homework-coverage.js').includes('SAMPLE_CLUSTERS') && read('miniprogram/utils/real-homework-coverage.js').includes('不做拍题答案库'), 'Miniapp turns real homework pressure samples into a visible coverage matrix with answer-bank boundary');
assert(read('miniprogram/pages/light-diagnosis/light-diagnosis.js').includes('courseUnitMap') && read('miniprogram/pages/light-diagnosis/light-diagnosis.js').includes('runCourseUnitAction') && read('miniprogram/pages/light-diagnosis/light-diagnosis.js').includes('course_unit_map'), 'Light diagnosis loads and records course-unit actions');
assert(read('miniprogram/pages/light-diagnosis/light-diagnosis.wxml').includes('courseUnitMap.active.units') && read('miniprogram/pages/light-diagnosis/light-diagnosis.wxml').includes('item.reportContract') && read('miniprogram/pages/light-diagnosis/light-diagnosis.wxml').includes('item.shareContract'), 'Light diagnosis visibly exposes course-unit report and share contracts');
assert(read('miniprogram/pages/light-diagnosis/light-diagnosis.wxml').includes('courseUnitQuestionBank.activeCards') && read('miniprogram/pages/light-diagnosis/light-diagnosis.js').includes('courseUnitQuestionBank'), 'Light diagnosis visibly exposes course-unit question bank cards');
assert(read('miniprogram/pages/light-diagnosis/light-diagnosis.js').includes('courseUnitDepthExpansionAtlas') && read('miniprogram/pages/light-diagnosis/light-diagnosis.wxml').includes('courseUnitDepthExpansionAtlas.activeArchetypes'), 'Light diagnosis visibly exposes course-unit depth expansion atlas');
assert(read('miniprogram/pages/light-diagnosis/light-diagnosis.wxml').includes('commercialDepthRunway.lanes') && read('miniprogram/pages/light-diagnosis/light-diagnosis.js').includes('commercialDepthRunway'), 'Light diagnosis exposes the commercial depth runway');
assert(read('miniprogram/pages/light-diagnosis/light-diagnosis.wxml').includes('sevenSubjectMasterySprint.subjects') && read('miniprogram/pages/light-diagnosis/light-diagnosis.js').includes('sevenSubjectMasterySprint'), 'Light diagnosis exposes the seven-subject mastery sprint');
assert(tutorJs.includes('courseUnitMap') && tutorJs.includes('activeCourseUnit') && tutorWxml.includes('thinkingReceipt.activeCourseUnit') && tutorWxml.includes('单元追问') && tutorWxml.includes('错因谱'), 'Tutor consumes course-unit map inside Socratic receipts');
assert(tutorJs.includes('commercialDepthRunway') && tutorWxml.includes('thinkingReceipt.commercialDepthRunway'), 'Tutor receipt consumes the commercial depth runway');
assert(tutorJs.includes('realHomeworkCoverageMatrix') && tutorWxml.includes('thinkingReceipt.realHomeworkCoverageMatrix') && tutorWxml.includes('thinkingReceipt.realHomeworkCoverageClusters'), 'Tutor receipt consumes the real homework coverage matrix');
assert(tutorJs.includes('courseUnitQuestionBankCards') && tutorWxml.includes('thinkingReceipt.courseUnitQuestionBankCards') && tutorWxml.includes('item.sampleStem') && tutorWxml.includes('item.progression.masteryGate'), 'Tutor receipt consumes real course-unit sample cards and progression gates');
assert(tutorJs.includes('courseUnitTransferLadders') && tutorJs.includes('course_unit_transfer_ladders') && tutorWxml.includes('thinkingReceipt.courseUnitTransferLadders') && tutorWxml.includes('迁移路径'), 'Tutor receipt consumes question-type transfer ladders and writes ladder evidence');
assert(tutorJs.includes('courseUnitDepthArchetypes') && tutorWxml.includes('thinkingReceipt.courseUnitDepthExpansionAtlas') && tutorWxml.includes('item.parentCheckScript') && tutorWxml.includes('item.shareSafeLine'), 'Tutor receipt consumes course-unit depth archetypes, parent scripts, and safe relay lines');
assert(tutorLadder.includes('buildQuestionBankVisualBoardBridge') && tutorLadder.includes('question_bank_visual_board_bridge') && tutorWxml.includes('thinkingReceipt.question_bank_visual_board_bridge'), 'Tutor turns question-type paths into layered first-step visual blackboard cards');
assert(tutorJs.includes('sevenSubjectMasterySprint') && tutorWxml.includes('thinkingReceipt.sevenSubjectMasterySprint'), 'Tutor receipt consumes the seven-subject mastery sprint');
assert(tutorJs.includes('course_unit_subject') && tutorJs.includes('course_unit_label') && tutorJs.includes('course_unit_wrong_cause_count'), 'Tutor diagnostic events write course-unit evidence');
assert(arcadeJs.includes('courseUnitMap') && arcadeJs.includes('courseUnitTitle') && arcadeWxml.includes('challengeBrief.courseUnitTitle') && arcadeWxml.includes('challengeBrief.courseUnitQuestionTypes'), 'Arcade challenge brief consumes course-unit map for game rounds');
assert(arcadeJs.includes('course_unit_subject') && arcadeJs.includes('course_unit_count') && arcadeJs.includes('course_unit_question_types'), 'Arcade completion writes course-unit evidence');
assert(arcadeJs.includes('courseUnitMasteryTrajectory') && arcadeWxml.includes('challengeBrief.courseUnitPracticeDeck') && arcadeJs.includes('course_unit_trajectory_rows'), 'Arcade turns course-unit mastery trajectory into a playable practice deck and writes trajectory evidence');
assert(arcadeJs.includes('courseUnitQuestionBank') && arcadeWxml.includes('challengeBrief.courseUnitQuestionBankCards') && arcadeWxml.includes('item.sampleStem') && arcadeWxml.includes('item.progression.nextDayRevisit'), 'Arcade challenge brief consumes course-unit sample cards and progression revisit paths');
assert(arcadeJs.includes('commercialDepthRunway') && arcadeWxml.includes('challengeBrief.commercialDepthRunwayLanes'), 'Arcade challenge brief consumes the commercial depth runway');
assert(arcadeJs.includes('sevenSubjectMasterySprint') && arcadeWxml.includes('challengeBrief.sevenSubjectMasterySprintLanes'), 'Arcade challenge brief consumes the seven-subject mastery sprint');
assert(profileJs.includes('buildCourseUnitDecisionBoard') && profileJs.includes('courseUnitDecisionBoard') && profileWxml.includes('learningReportSummary.courseUnitDecisionBoard'), 'Profile report turns course-unit map into a visible family decision board');
assert(profileWxml.includes('题型动作') && profileWxml.includes('错因谱') && profileWxml.includes('诊断追问') && profileWxml.includes('learningReportSummary.courseUnitClassroomLine'), 'Course-unit decision board exposes question actions, wrong causes, diagnostic probes, and classroom observation line');
assert(profileJs.includes('courseUnitMap') && profileJs.includes('courseUnitSevenDayLine') && profileJs.includes('courseUnitParentDecisionLine'), 'Profile summary carries course-unit seven-day and parent decision lines');
assert(profileJs.includes('courseUnitMasteryTrajectory') && profileWxml.includes('learningReportSummary.courseUnitTrajectoryRows') && profileWxml.includes('下一证据'), 'Profile report exposes course-unit mastery trajectories as parent-readable decisions');
assert(profileJs.includes('courseUnitQuestionBank') && profileWxml.includes('learningReportSummary.courseUnitQuestionBankCards') && profileWxml.includes('item.parentCheck') && profileWxml.includes('item.progression.parentEvidence'), 'Profile report exposes course-unit progression evidence inside the family decision document');
assert(profileJs.includes('courseUnitTransferLadders') && profileJs.includes('courseUnitTransferLadderLine') && profileWxml.includes('learningReportSummary.courseUnitTransferLadders') && profileWxml.includes('路径家长判断'), 'Profile report exposes question-type transfer ladders inside the family decision document');
assert(profileJs.includes('courseUnitDepthExpansionAtlas') && profileWxml.includes('learningReportSummary.courseUnitDepthExpansionArchetypes') && profileWxml.includes('原型题') && profileWxml.includes('安全复习'), 'Profile report exposes course-unit depth expansion as a parent decision layer');
assert(profileJs.includes('commercialDepthRunway') && profileWxml.includes('learningReportSummary.commercialDepthRunwayLanes'), 'Profile report exposes the commercial depth runway');
assert(profileJs.includes('realHomeworkCoverageMatrix') && profileWxml.includes('learningReportSummary.realHomeworkCoverageMatrix') && profileWxml.includes('learningReportSummary.realHomeworkCoverageClusters'), 'Profile report exposes real homework coverage as parent-readable evidence');
assert(profileJs.includes('weeklyEvidenceFlywheel') && profileWxml.includes('learningReportSummary.weeklyEvidenceFlywheelDays') && profileWxml.includes('weeklyEvidenceFlywheelSharePayload'), 'Profile report and share card expose weekly evidence flywheel safely');
assert(profileJs.includes('sevenSubjectMasterySprint') && profileWxml.includes('learningReportSummary.sevenSubjectMasterySprintSubjects'), 'Profile report exposes the seven-subject mastery sprint');
assert(homeJs.includes('sevenSubjectMasterySprint') && homeWxml.includes('sevenSubjectMasterySprint.subjects'), 'Home exposes the seven-subject mastery sprint');
assert(read('miniprogram/utils/game-logic.js').includes('buildRecallIntensityPlan') && read('miniprogram/utils/game-logic.js').includes('buildWrongCauseReplayDeck') && read('miniprogram/utils/game-logic.js').includes('buildXpFeedbackPolicy') && read('miniprogram/utils/game-logic.js').includes('buildQuestArcRunway'), 'Game loop has recall intensity, wrong-cause replay, XP feedback, and quest runway engines');
assert(read('miniprogram/pages/arcade/arcade.wxml').includes('highFrequencyPracticeLoop.recallIntensityPlan') && read('miniprogram/pages/arcade/arcade.wxml').includes('highFrequencyPracticeLoop.wrongCauseReplayDeck') && read('miniprogram/pages/arcade/arcade.wxml').includes('highFrequencyPracticeLoop.xpFeedbackPolicy') && read('miniprogram/pages/arcade/arcade.wxml').includes('highFrequencyPracticeLoop.questArcRunway'), 'Arcade result exposes the full high-frequency memory feedback loop');
assert(read('miniprogram/pages/arcade/arcade.js').includes('recall_intensity_tier') && read('miniprogram/pages/arcade/arcade.js').includes('wrong_cause_replay_count') && read('miniprogram/pages/arcade/arcade.js').includes('xp_feedback_policy') && read('miniprogram/pages/arcade/arcade.js').includes('quest_arc_runway_stages'), 'Arcade completion events persist high-frequency loop evidence');
assert(homeJs.includes('buildDailyMemoryTaskCard') && homeJs.includes('buildHighFrequencyPracticeLoop') && homeWxml.includes('dailyMemoryTask.taskCards') && homeJs.includes('今日 90 秒记忆任务'), 'Home condenses the Gizmo-like memory loop into a visible daily 90-second task card');
assert(homeWxml.includes('先做 3 张回忆卡') && homeWxml.includes('发起 90 秒接力') && homeJs.includes('可分享 90 秒回忆接力'), 'Home daily memory task has review and safe relay actions without ranking or answer sharing');
assert(read('miniprogram/utils/game-logic.js').includes('buildGizmoLikeMemoryProtocol') && read('miniprogram/utils/game-logic.js').includes('anti_cram_throttle') && read('miniprogram/utils/game-logic.js').includes('leech_card_escalation') && read('miniprogram/utils/game-logic.js').includes('share_safe_memory_challenge'), 'Game loop has a Gizmo-like memory protocol without unsafe ranking or score sharing');
assert(read('miniprogram/pages/arcade/arcade.wxml').includes('highFrequencyPracticeLoop.gizmoLikeMemoryProtocol') && read('miniprogram/pages/arcade/arcade.js').includes('gizmo_memory_protocol_tier') && read('miniprogram/pages/arcade/arcade.js').includes('gizmo_memory_return_windows'), 'Arcade exposes and persists the Gizmo-like memory protocol');
assert(read('miniprogram/utils/game-logic.js').includes('buildDailyMemorySeasonPlan') && read('miniprogram/pages/arcade/arcade.wxml').includes('highFrequencyPracticeLoop.dailyMemorySeasonPlan') && read('miniprogram/pages/arcade/arcade.wxml').includes('nonRankingBoard') && read('miniprogram/pages/arcade/arcade.js').includes('daily_memory_season_mode'), 'Arcade exposes a daily memory season with non-ranking retention evidence');
assert(read('miniprogram/utils/game-logic.js').includes('buildSocraticQualityMemoryBridge') && read('miniprogram/utils/game-logic.js').includes('socratic_quality_memory_bridge') && read('miniprogram/utils/game-logic.js').includes('盲刷题量不加分'), 'Game loop bridges Socratic quality scenarios into memory feedback and XP gates');
assert(read('miniprogram/pages/arcade/arcade.js').includes('socraticQualityEvaluationSuite') && read('miniprogram/pages/arcade/arcade.js').includes('socratic_quality_memory_scenarios') && read('miniprogram/pages/arcade/arcade.js').includes('socratic_quality_memory_xp_gate'), 'Arcade completion persists Socratic quality memory evidence');
assert(read('miniprogram/pages/arcade/arcade.wxml').includes('highFrequencyPracticeLoop.socraticQualityMemoryBridge') && read('miniprogram/pages/arcade/arcade.wxml').includes('点拨质量场景') && read('miniprogram/pages/arcade/arcade.wxml').includes('privacyBoundary'), 'Arcade visibly exposes the Socratic quality memory bridge');
assert(gameLogic.includes('buildQuestionBankMemoryBridge') && gameLogic.includes('question_bank_memory_bridge') && arcadeJs.includes('question_bank_memory_cards'), 'Game loop turns course-unit question bank into high-frequency memory evidence');
assert(gameLogic.includes('buildCourseUnitQuestionBankPlayableCards') && arcadeJs.includes('questionBankPlayableCards') && arcadeWxml.includes('challengeBrief.questionBankPlayableLine'), 'Course-unit question bank feeds playable arcade cards, not only display cards');
assert(arcadeWxml.includes('highFrequencyPracticeLoop.questionBankMemoryBridge') && arcadeWxml.includes('questionBankMemoryBridge.activeDeck') && arcadeWxml.includes('questionBankMemoryBridge.reviewWindows'), 'Arcade visibly exposes question-bank memory actions and return windows');
assert(gameLogic.includes('buildQuestionBankRecallWorkout') && gameLogic.includes('question_bank_recall_workout') && gameLogic.includes('noCramRule'), 'Game loop turns question-bank memory into a layered recall workout');
assert(arcadeJs.includes('question_bank_recall_workout_cards') && arcadeWxml.includes('highFrequencyPracticeLoop.questionBankRecallWorkout') && arcadeWxml.includes('questionBankRecallWorkout.workoutCards'), 'Arcade persists and displays the layered question-bank recall workout');
assert(gameLogic.includes('buildDailyMemorySprintDeck') && gameLogic.includes('daily_memory_sprint_deck') && gameLogic.includes('streakMeters'), 'Game loop has a daily memory sprint deck with continuity meters');
assert(arcadeJs.includes('daily_memory_sprint_cards') && arcadeJs.includes('daily_memory_sprint_streak_meters') && arcadeWxml.includes('highFrequencyPracticeLoop.dailyMemorySprintDeck'), 'Arcade persists and displays the daily memory sprint deck');
assert(arcadeWxml.includes('锁定规则') && arcadeWxml.includes('dailyMemorySprintDeck.lockRules') && arcadeWxml.includes('dailyMemorySprintDeck.streakMeters'), 'Daily memory sprint visibly shows lock rules and streak meters');
assert(gameLogic.includes('buildAdaptiveRecallScheduler') && gameLogic.includes('adaptive_recall_scheduler') && arcadeJs.includes('adaptive_recall_scheduler_boxes') && arcadeWxml.includes('highFrequencyPracticeLoop.adaptiveRecallScheduler'), 'Game loop adds an adaptive recall scheduler and arcade exposes its boxes and queue');
assert(gameLogic.includes('buildMemoryRiskReleaseModel') && gameLogic.includes('memory_risk_release_model') && arcadeJs.includes('memory_risk_release_level') && arcadeWxml.includes('highFrequencyPracticeLoop.memoryRiskReleaseModel'), 'Game loop adds memory risk release model and arcade exposes risk, forgetting, and variant gates');
assert(profileJs.includes('memoryRiskReleaseModel') && profileWxml.includes('learningReportSummary.memoryRiskReleaseModel') && profileWxml.includes('遗忘预警') && profileWxml.includes('变式放行'), 'Profile report exposes memory risk release as parent-readable decision evidence');
assert(gameLogic.includes('分享只带行动建议') && gameLogic.includes('孩子隐私') && gameLogic.includes('原始表现'), 'Memory risk release share boundary protects original task and child privacy');
assert(gameLogic.includes('scheduler_boxes') && gameLogic.includes('review_queue') && gameLogic.includes('leechRules') && gameLogic.includes('第7天画像'), 'Adaptive recall scheduler carries spaced boxes, review queue, and leech rules');
assert(learningReport.includes('buildQuestionBankDecisionBridge') && profileJs.includes('questionBankDecisionBridge') && profileWxml.includes('learningReportSummary.questionBankDecisionDeck'), 'Learning report consumes question-bank memory evidence as parent decision support');
assert(learningReport.includes('buildQuestionBankRecallReportBridge') && profileJs.includes('questionBankRecallReportBridge') && profileWxml.includes('learningReportSummary.questionBankRecallReportCards'), 'Learning report consumes question-bank recall workout as long-term portrait evidence');
assert(storageJs.includes('buildQuestionBankShareRelayDeck') && storageJs.includes('question_bank_share_relay_deck') && storageJs.includes('safeSharePayload'), 'Question bank has a privacy-safe share relay deck');
assert(arcadeJs.includes('questionBankShareRelayDeck') && arcadeWxml.includes('challengeBrief.questionBankShareRelayCards'), 'Arcade challenge brief consumes question-bank share relay cards');
assert(profileJs.includes('questionBankShareRelayDeck') && profileWxml.includes('dailyShareCard.questionBankShareRelayDeck') && profileWxml.includes('learningReportSummary.questionBankShareRelayCards'), 'Profile report and share card expose question-bank relay deck');
assert(arcadeJs.includes('buildQuestionProgressionSignal') && arcadeJs.includes('question_progression_status') && arcadeJs.includes('question_progression_mastery_gates') && arcadeWxml.includes('arcadeResultActionBridge.masteryGateLine'), 'Arcade persists question progression signals and exposes mastery gates after each game round');
assert(read('miniprogram/pages/daily-math/daily-math.js').includes('buildLightEntrySeedBank') && read('miniprogram/pages/daily-math/daily-math.wxml').includes('lightSeedBank.seeds') && read('miniprogram/pages/daily-math/daily-math.wxml').includes('lightSeedBank.modelLine') && read('miniprogram/pages/daily-math/daily-math.wxml').includes('item.loopLine'), 'Daily math exposes expanded reusable light-entry seed models');
assert(read('miniprogram/pages/dictation/dictation.js').includes('buildLightEntrySeedBank') && read('miniprogram/pages/dictation/dictation.wxml').includes('lightSeedBank.seeds') && read('miniprogram/pages/dictation/dictation.wxml').includes('lightSeedBank.modelLine') && read('miniprogram/pages/dictation/dictation.wxml').includes('item.loopLine'), 'Dictation exposes expanded reusable light-entry seed models');
assert(read('miniprogram/pages/light-diagnosis/light-diagnosis.js').includes('buildLightEntrySeedBank') && read('miniprogram/pages/light-diagnosis/light-diagnosis.wxml').includes('lightSeedBank.seeds') && read('miniprogram/pages/light-diagnosis/light-diagnosis.wxml').includes('lightSeedBank.modelLine') && read('miniprogram/pages/light-diagnosis/light-diagnosis.wxml').includes('item.loopLine'), 'Light diagnosis exposes expanded reusable light-entry seed models');
assert(storageJs.includes('buildEvidenceRouteBias') && storageJs.includes("source = 'incoming_share'") && storageJs.includes('evidenceBias'), 'Global evidence now produces a route and game bias instead of stopping at a report summary');
assert(storageJs.includes('buildUnifiedNextActionController') && storageJs.includes('report_daily_action') && storageJs.includes('quest_arc') && storageJs.includes('module_flow') && storageJs.includes('surface_depth'), 'Product has a unified next-action controller across report, evidence, quest, module, and surface layers');
assert(homeJs.includes('unifiedNextAction') && homeWxml.includes('runUnifiedNextAction') && homeWxml.includes('unifiedNextAction.candidates'), 'Home exposes the unified next-action controller as one executable next step');
assert(profileJs.includes('unifiedNextAction') && profileWxml.includes('runUnifiedNextAction') && profileWxml.includes('unifiedNextAction.readinessLine'), 'Profile explains the unified next action for parent-readable closure');
assert(tutorJs.includes('unifiedNextAction') && tutorWxml.includes('runUnifiedNextAction') && tutorWxml.includes('unifiedNextAction.candidates'), 'Tutor exposes the same unified next-action controller before local detail cards');
assert(uploadJs.includes('unifiedNextAction') && uploadWxml.includes('runUnifiedNextAction') && uploadWxml.includes('unifiedNextAction.candidates'), 'Upload exposes the same unified next-action controller after intake depth evidence');
assert(reviewJs.includes('unifiedNextAction') && reviewWxml.includes('runUnifiedNextAction') && reviewWxml.includes('unifiedNextAction.candidates'), 'Review exposes the same unified next-action controller inside repair flow');
assert(storageJs.includes('recordUnifiedNextAction') && storageJs.includes("appendSyncMutation('unified_next_action'") && storageJs.includes('latestUnifiedAction'), 'Unified next-action execution is persisted, synced, and folded back into global evidence');
assert(homeJs.includes('recordUnifiedNextAction') && profileJs.includes('recordUnifiedNextAction'), 'Home and Profile write unified next-action execution evidence before navigation');
assert(tutorJs.includes('handoffPlan') && tutorWxml.includes('thinkingReceipt.handoffPlan') && tutorWxml.includes('runTutorHandoffAction'), 'Tutor receipt turns Socratic work into repair, recall, and parent handoff actions');
assert(tutorJs.includes('tutor_handoff') && tutorJs.includes('tutor_handoff_action') && tutorJs.includes('recordUnifiedNextAction') && tutorJs.includes('recordSurfaceDepthAction'), 'Tutor handoff writes unified next-action and surface-depth evidence before navigation');
assert(tutorWxml.includes('tutor-handoff-grid') && tutorWxss.includes('tutor-handoff-action'), 'Tutor handoff has compact mobile-safe action cards');
assert(profileJs.includes('buildProfileReadinessSnapshot') && profileJs.includes('buildAcceptanceReport') && profileJs.includes('launchBlockedByExternalConfig'), 'Profile builds a default parent-readable readiness snapshot from the acceptance gate');
assert(profileWxml.includes('profileReadinessSnapshot') && profileJs.includes('今晚闭环状态') && profileWxml.includes('profileReadinessSnapshot.evidenceLine') && profileWxml.includes('profileReadinessSnapshot.nextActionReason'), 'Profile shows closure status, evidence, and next action without requiring advanced mode');
assert(profileJs.includes('aiUsageDecisionMatrix') && profileJs.includes('aiBoundaryRows') && profileJs.includes('aiBoundaryReleaseRule'), 'Profile turns the AI usage matrix into parent-readable capability boundaries');
assert(profileJs.includes('智能能力边界') && profileWxml.includes('profileReadinessSnapshot.aiBoundaryRows') && profileWxml.includes('profileReadinessSnapshot.aiBoundaryReleaseRule'), 'Profile visibly explains which parts need intelligence and which parts must work by rule');
assert(profileJs.includes('finalTargetGapMeter') && profileJs.includes('距离竞品级商用目标') && profileWxml.includes('profileReadinessSnapshot.finalTargetRows') && profileWxml.includes('边际规则') && profileWxss.includes('.final-target-panel'), 'Profile surfaces final-target distance, cadence, and marginal stop rule');
assert(profileJs.includes('runFinalTargetAction') && profileJs.includes('final_target_gap_meter') && profileWxml.includes('bindtap="runFinalTargetAction"') && profileWxml.includes('data-route="{{item.route}}"'), 'Profile turns every final-target row into a routeable next action');
assert(profileWxss.includes('.ai-boundary-panel') && profileWxss.includes('.ai-boundary-row'), 'Profile AI boundary has compact mobile-safe styling');
assert(!profileWxml.includes('API Key') && !profileWxml.includes('模型 Key') && !profileWxml.includes('生产模型'), 'Profile AI boundary does not expose internal provider or key wording');
assert(!/profileReadinessSnapshot[^"]*showAdvancedProfile|showAdvancedProfile[^"]*profileReadinessSnapshot/.test(profileWxml), 'Profile readiness snapshot is not hidden behind advanced mode');
assert(profileWxss.includes('.profile-readiness-snapshot'), 'Profile readiness snapshot has a distinct compact card style');
assert(homeJs.includes("buildSurfaceDepthPack('home')") && homeWxml.includes('surfaceDepthPack.cards') && homeWxml.includes('surface-depth-card'), 'Home has its own board-specific depth pack');
assert(tutorJs.includes("buildSurfaceDepthPack('tutor')") && read('miniprogram/pages/tutor/tutor.wxml').includes('surfaceDepthPack.cards') && read('miniprogram/pages/tutor/tutor.wxml').includes('tutor-surface-depth'), 'Tutor has its own Socratic depth pack');
assert(reviewJs.includes("buildSurfaceDepthPack('review')") && reviewWxml.includes('surfaceDepthPack.cards') && reviewWxml.includes('review-surface-depth'), 'Review has its own repair and recall depth pack');
assert(arcadeJs.includes("buildSurfaceDepthPack('arcade')") && arcadeWxml.includes('surfaceDepthPack.cards') && arcadeWxml.includes('arcade-surface-depth'), 'Arcade has its own game evidence depth pack');
assert(profileJs.includes("buildSurfaceDepthPack('profile')") && profileWxml.includes('surfaceDepthPack.cards') && profileWxml.includes('surfaceDepthPack.familyLine'), 'Profile has its own parent/report/share depth pack');
assert(toolsJs.includes("buildSurfaceDepthPack('tools')") && read('miniprogram/pages/tools/tools.wxml').includes('global-depth-card') && read('miniprogram/pages/tools/tools.wxml').includes('surfaceDepthPack.cards'), 'Tools page has a depth pack for material-to-practice flow');
assert(read('miniprogram/pages/upload/upload.js').includes("buildSurfaceDepthPack('upload')") && read('miniprogram/pages/upload/upload.wxml').includes('global-depth-card') && read('miniprogram/pages/upload/upload.wxml').includes('surfaceDepthPack.cards'), 'Upload page has a depth pack for material intake closure');
assert(read('miniprogram/pages/diagnosis/diagnosis.js').includes("buildSurfaceDepthPack('diagnosis')") && read('miniprogram/pages/diagnosis/diagnosis.wxml').includes('global-depth-card') && read('miniprogram/pages/diagnosis/diagnosis.wxml').includes('surfaceDepthPack.cards'), 'Diagnosis page has a depth pack for first-step positioning');
assert(read('miniprogram/pages/focus/focus.js').includes("buildSurfaceDepthPack('focus')") && read('miniprogram/pages/focus/focus.wxml').includes('global-depth-card') && read('miniprogram/pages/focus/focus.wxml').includes('surfaceDepthPack.cards'), 'Focus page has a depth pack for session evidence');
assert(read('miniprogram/pages/module/module.js').includes("buildSurfaceDepthPack('module')") && read('miniprogram/pages/module/module.wxml').includes('global-depth-card') && read('miniprogram/pages/module/module.wxml').includes('surfaceDepthPack.cards'), 'Module page has a depth pack for mini-loop closure');
assert(read('miniprogram/pages/radar/radar.js').includes("buildSurfaceDepthPack('radar')") && read('miniprogram/pages/radar/radar.wxml').includes('global-depth-card') && read('miniprogram/pages/radar/radar.wxml').includes('surfaceDepthPack.cards'), 'Radar page has a depth pack for parent decision flow');
assert(read('miniprogram/pages/daily-math/daily-math.js').includes("buildSurfaceDepthPack('daily_math')") && read('miniprogram/pages/daily-math/daily-math.wxml').includes('global-depth-card') && read('miniprogram/pages/daily-math/daily-math.wxml').includes('surfaceDepthPack.cards'), 'Daily math page has an actionable lightweight depth pack');
assert(read('miniprogram/pages/dictation/dictation.js').includes("buildSurfaceDepthPack('dictation')") && read('miniprogram/pages/dictation/dictation.wxml').includes('global-depth-card') && read('miniprogram/pages/dictation/dictation.wxml').includes('surfaceDepthPack.cards'), 'Dictation page has an actionable lightweight depth pack');
assert(read('miniprogram/pages/light-diagnosis/light-diagnosis.js').includes("buildSurfaceDepthPack('light_diagnosis')") && read('miniprogram/pages/light-diagnosis/light-diagnosis.wxml').includes('global-depth-card') && read('miniprogram/pages/light-diagnosis/light-diagnosis.wxml').includes('surfaceDepthPack.cards'), 'Light diagnosis page has an actionable lightweight depth pack');
assert(storageJs.includes("daily_math:") && storageJs.includes("dictation:") && storageJs.includes("light_diagnosis:") && storageJs.includes('light_entry_evidence') && storageJs.includes('share_return'), 'Surface depth model covers every miniapp page family, light-entry evidence, and share return');
assert(productReadiness.includes('focus_to_review_evidence') && productReadiness.includes('upload_to_report_material') && productReadiness.includes('tools_to_practice_asset') && productReadiness.includes('module_to_recall_card') && productReadiness.includes('radar_to_family_action'), 'Readiness module flow contracts cover focus, upload, tools, module, and radar instead of only the core pages');
assert(storageJs.includes('storyLine') && storageJs.includes('evidenceLine') && storageJs.includes('routeLine') && storageJs.includes('buildLearningQuestArc(options)') && storageJs.includes('buildGlobalEvidenceBrief(options)'), 'Every surface depth pack carries global story, evidence, and route context instead of isolated page advice');
assert(['tools', 'focus', 'module', 'radar', 'upload', 'diagnosis', 'daily-math', 'dictation', 'light-diagnosis'].every((page) => {
  const js = read(`miniprogram/pages/${page}/${page}.js`);
  const wxml = read(`miniprogram/pages/${page}/${page}.wxml`);
  return js.includes('runSurfaceDepthAction') && js.includes('recordSurfaceDepthAction') && js.includes('navigateLearningRoute') && wxml.includes('bindtap="runSurfaceDepthAction"') && wxml.includes('data-route="{{surfaceDepthPack.primaryRoute}}"');
}), 'Second-circle surface depth cards are actionable and route to real existing pages');
assert(['home', 'tutor', 'review', 'arcade'].every((page) => {
  const js = read(`miniprogram/pages/${page}/${page}.js`);
  const wxml = read(`miniprogram/pages/${page}/${page}.wxml`);
  return js.includes('runSurfaceDepthAction') && js.includes('recordSurfaceDepthAction') && js.includes('navigateLearningRoute') && wxml.includes('bindtap="runSurfaceDepthAction"') && wxml.includes('data-dimension-id="{{item.id}}"');
}), 'Core surface depth cards are also actionable and write route evidence');
assert(profileJs.includes('surfaceDepthActionSummary') && profileWxml.includes('surfaceDepthActionSummary.label') && profileWxml.includes('surfaceDepthActionSummary.recent'), 'Profile exposes surface-depth action evidence for parent-readable closure');
assert(profileWxml.includes('globalEvidenceBrief.latestUnifiedAction') && profileWxml.includes('建议已执行'), 'Profile exposes executed unified next-action evidence inside the parent-readable evidence area');
assert(profileJs.includes('globalEvidenceBrief') && profileJs.includes('liveEvidenceLine') && profileWxml.includes('learningReportSummary.liveEvidenceLine') && profileWxml.includes('dailyShareCard.globalEvidenceBrief.shareLine'), 'Report summary and share card consume the global evidence brief');
assert(!storageJs.includes("'subscription_clicked'"), 'Local analytics no longer uses subscription click funnel naming');
assert(!reviewPack.includes('内测回访') && !legalJs.includes('内测回访'), 'Review and legal copy use service follow-up wording');
assert(!reviewCards.includes("status: 'planned'") && !reviewCards.includes('Needs parser/API/upload after launch'), 'Review content pipeline avoids launch-placeholder wording');
assert(!/云同步|API Key|服务端环境变量/.test(reviewCards), 'Review cards avoid internal setup terms');
assert(!arcadeEngine.includes("status: 'planned'"), 'Arcade engine uses honest material/setup statuses instead of planned placeholders');
assert(learningReportRecognition.includes('requiresConfirmation'), 'Learning report recognition keeps confirm-first behavior');
assert(apiRecognition.includes('requiresConfirmation: true'), 'Recognition API never treats machine draft as final');
assert(apiRecognition.includes('recognition_service_configuration'), 'Recognition API is explicit when external recognition is not configured');
assert(!/学币兑换/.test(gameLogic + miniShop), 'Learning reward surfaces avoid trade-like coin exchange wording');
assert(!/not_enough_coins|购买|兑换|price:/.test(gameLogic + miniShop + miniGame), 'Decorative catalog avoids transaction semantics');
assert(/catalog_only/.test(gameLogic + miniShop), 'Decorative catalog is explicitly non-transactional');
assert(gameLogic.includes('buildDailyQuestSet') && gameLogic.includes('buildAdaptiveChallenge') && gameLogic.includes('quest_boss_gap'), 'Game layer has quest, adaptive challenge, and boss-gap mechanics');
assert(arcadeJs.includes('buildDailyQuestSet') && arcadeJs.includes('buildAdaptiveChallenge') && arcadeJs.includes('adaptiveMode') && arcadeJs.includes('dailyQuestIds'), 'Arcade page runs adaptive quests and writes them back as learning evidence');
assert(arcadeJs.includes('questActions') && arcadeWxml.includes('bindtap="goQuestRoute"') && arcadeWxml.includes('quest-action-row'), 'Arcade daily quests expose executable completion routes instead of only descriptive text');
assert(arcadeJs.includes('publicK12IntakeChallenge') && arcadeWxml.includes('public-k12-challenge-mission') && arcadeWxml.includes('必须用自己的作业材料说第一步'), 'Arcade visibly turns public K12 challenge cards into executable own-material first-step routes');
assert(arcadeWxml.includes('不带原题、完整答案、分数和同伴比较') && arcadeWxml.includes('challengeBrief.publicK12IntakeChallenge.reviewRoute'), 'Arcade public K12 challenge cards show user-facing safety boundaries and route into review');
assert(arcadeJs.includes('captureQuizFirstStep') && arcadeJs.includes('quizRecallEvidence') && arcadeWxml.includes('我已说出第一步') && arcadeWxml.includes('recall-evidence-strip'), 'Arcade active recall requires local first-step evidence before answer reveal');
assert(gameLogic.includes('quest_evidence_return') && gameLogic.includes('normalizeEvidenceBias') && gameLogic.includes('options.evidenceBias'), 'Game layer can turn global evidence, share, and report signals into quest priority');
assert(arcadeJs.includes('buildEvidenceRouteBias') && arcadeJs.includes('evidenceBias') && arcadeJs.includes('buildChallengeBrief(dailyQuestSet, adaptiveChallenge, questArcMission, evidenceBias'), 'Arcade passes evidence bias through daily quests, adaptive challenge, mission, and visible brief data');
assert(storageJs.includes('buildQuestArcGameBridge') && storageJs.includes('recordQuestArcGameSignal') && storageJs.includes('quest_arc_game_signal'), 'Game layer is bridged to the learning quest arc with evidence writeback');
assert(arcadeJs.includes('questArcMission') && arcadeJs.includes('recordQuestArcGameSignal') && arcadeWxml.includes('story-mission'), 'Arcade visibly binds each round to the story mission and records completion evidence');
assert(arcadeWxml.includes('challengeBrief') && arcadeWxml.includes('本局目标'), 'Arcade page exposes the adaptive challenge goal to the learner');
assert(arcadeJs.includes('resultLine') && arcadeWxml.includes('目标回看'), 'Arcade result compares the round against its goal');
assert(gameLogic.includes('buildGameRetentionLoop') && gameLogic.includes('nextRoundLine') && gameLogic.includes('wrongCauseReturnLine') && gameLogic.includes('tomorrowLine'), 'Game layer turns one round into the next-round, wrong-cause, next-day retention loop');
assert(arcadeJs.includes('gameRetentionLoop') && arcadeJs.includes('retention_next_route') && arcadeWxml.includes('连续练习闭环'), 'Arcade result exposes and records the retention loop instead of ending at score feedback');
assert(tutorJs.includes('diagnostic_probe') && tutorJs.includes('transfer_prompt') && tutorJs.includes('tutor_diagnostic_probe'), 'Tutor page stores diagnostic probes as reviewable evidence');
assert(tutorWxml.includes('这轮怎么追问') && tutorWxml.includes('thinkingReceipt.transfer_prompt'), 'Tutor page exposes diagnostic probes and transfer prompts in the visible receipt');
assert(tutorLadder.includes('buildSocraticContract') && tutorJs.includes('socratic_contract') && tutorWxml.includes('receipt-contract') && tutorWxml.includes('stopRule'), 'Tutor has a visible Socratic contract with stop rule and evidence writeback');
assert(tutorJs.includes('firstStepBoard') && tutorJs.includes('buildFirstStepPromptCard'), 'Tutor thinking receipt consumes the subject-aware first-step board');
assert(tutorWxml.includes('receipt-first-step-board') && tutorWxml.includes('thinkingReceipt.firstStepBoard.parentPrompt') && tutorWxml.includes('第一步：'), 'Tutor visibly carries the small blackboard into the Socratic flow');
assert(tutorLadder.includes('buildQuestionTypeSocraticPath') && tutorLadder.includes('probeBank') && tutorLadder.includes('fallbackLadder') && tutorLadder.includes('noFullAnswerBoundary'), 'Tutor ladder has task-type Socratic paths with probe bank, fallback ladder, and no-full-answer boundary');
assert(tutorLadder.includes('buildQuestionTypeCoverageAtlas') && tutorLadder.includes('totalProbeCount') && tutorLadder.includes('totalFallbackCount'), 'Tutor ladder has full question-type coverage atlas across supported task types');
assert(tutorLadder.includes('buildVisualSocraticRecoveryProtocol') && tutorLadder.includes('visual_socratic_recovery') && tutorLadder.includes('no_full_answer_boundary'), 'Tutor ladder has a visual Socratic recovery protocol with no-full-answer evidence');
assert(storageJs.includes('questionTypeRubric') && storageJs.includes('visualExplanationSteps') && storageJs.includes('evidenceContractLine') && storageJs.includes('parentCheckLine'), 'Storage Socratic assessment has question-type rubric, visual explanation steps, and contracts');
assert(tutorJs.includes('question_type_socratic_path') && tutorJs.includes('question_type_probe_count') && tutorWxml.includes('thinkingReceipt.question_type_socratic_path') && tutorWxml.includes('题型轴') && tutorWxml.includes('失败兜底'), 'Tutor page exposes and tracks task-type Socratic path evidence');
assert(tutorJs.includes('questionTypeCoverageAtlas') && tutorJs.includes('question_type_coverage_count') && tutorWxml.includes('thinkingReceipt.questionTypeCoverageAtlas'), 'Tutor page exposes and records full question-type coverage atlas evidence');
assert(tutorJs.includes('visual_socratic_recovery') && tutorJs.includes('visual_recovery_mode') && tutorWxml.includes('thinkingReceipt.visual_socratic_recovery') && tutorWxml.includes('失败分支'), 'Tutor receipt exposes and persists visual Socratic recovery evidence');
assert(tutorWxss.includes('.receipt-first-step-board') && tutorWxss.includes('#112A23'), 'Tutor first-step board is styled as a compact blackboard surface');
assert(storageJs.includes('diagnosticProbes') && profileWxml.includes('thinkingProbeLine'), 'Parent recap includes diagnostic probe and transfer-prompt evidence');
assert(arcadeJs.includes('rewardLine') && arcadeWxml.includes('challengeBrief.rewardLine'), 'Arcade challenge brief explains the learning-record reward');
assert(arcadeJs.includes('evidenceBiasLine') && arcadeWxml.includes('challengeBrief.evidenceBiasLine'), 'Arcade explains why evidence changed the next round');
assert(profileJs.includes('solutionConfidence') && profileWxml.includes('结论依据'), 'Learning report shows confidence and evidence anchors');
assert(storageJs.includes('buildRealTrialRecoveryLoop') && storageJs.includes('shouldBecomePressureSample') && storageJs.includes('AI 只改写追问语气'), 'Storage has a real-family-trial recovery loop with local pressure promotion and AI wording boundary');
assert(storageJs.includes('ensureRealTrialReviewCard') && storageJs.includes("type: 'real_trial_revisit'") && storageJs.includes('sourceTrialId'), 'Real trial samples become review cards with source trial identity');
assert(profileJs.includes('realTrialRecoveryLoop') && profileWxml.includes('realTrialRecoveryLoop.title') && profileWxml.includes('待转压力样本'), 'Profile report exposes real trial recovery, risks, and pressure-sample promotion queue');
assert(profileWxml.includes('realTrialRecoveryLoop.reviewQueueLine'), 'Profile report tells parents whether real trial samples entered the revisit queue');
assert(storageJs.includes('buildRealTrialGameChallengeBridge') && storageJs.includes('real_trial_game_challenge_bridge') && storageJs.includes('real_trial_challenge'), 'Storage turns real trial revisit cards into game and share challenge bridge payloads');
assert(storageJs.includes('realTrialGameChallengeBridge') && storageJs.includes('realTrialGameChallengeCards') && storageJs.includes('realTrialGameChallengeLine'), 'Share and community relay surfaces carry real trial challenge cards');
assert(profileJs.includes('realTrialGameChallengeCards') && profileWxml.includes('realTrialGameChallengeLine') && profileWxml.includes('真实试用挑战'), 'Profile report exposes real trial game challenge bridge instead of stopping at analytics');
assert(storageJs.includes('buildRealTrialPressureCandidateBoard') && storageJs.includes('real_trial_pressure_candidate_board') && storageJs.includes('real_trial_pressure_candidate'), 'Storage turns real trial failures into pressure-candidate cards for tutor, review, and arcade pressure tests');
assert(profileJs.includes('realTrialPressureCandidateCards') && profileWxml.includes('realTrialPressureCandidateLine') && profileWxml.includes('压力候选'), 'Profile exposes real trial pressure candidates instead of hiding failed trials in analytics');
assert(storageJs.includes('realTrialPressureCandidateBoard') && storageJs.includes('real_trial_pressure_candidate') && storageJs.includes('real_trial_pressure_route'), 'Share and community relay carry real trial pressure candidates back to recovery routes');
assert(storageJs.includes('buildRealTrialSocraticStressAudit') && storageJs.includes('real_trial_socratic_stress_audit') && storageJs.includes('first_step_generic') && storageJs.includes('blackboard_not_actionable'), 'Storage audits real trial candidates for thin Socratic first-step, wrong-cause, blackboard, and revisit failures');
assert(profileJs.includes('realTrialSocraticStressRows') && profileWxml.includes('realTrialSocraticStressLine') && profileWxml.includes('压测结果'), 'Profile exposes real trial Socratic stress results to parents');
assert(storageJs.includes('buildRealTrialStressRepairQueue') && storageJs.includes('real_trial_stress_repair_queue') && storageJs.includes('repair_action') && storageJs.includes('releaseGate'), 'Storage turns Socratic stress failures into local repair actions before release');
assert(profileJs.includes('realTrialStressRepairCards') && profileWxml.includes('realTrialStressRepairLine') && profileWxml.includes('修复队列'), 'Profile exposes stress repair queue instead of stopping at failure analytics');
assert(storageJs.includes('buildRealTrialRuleWritebackPlan') && storageJs.includes('real_trial_rule_writeback_plan') && storageJs.includes('firstStepTemplatesForTaskType') && storageJs.includes('buildBlackboardHint') && storageJs.includes('generateReviewCard'), 'Storage maps stress repairs back to local first-step, blackboard, and review rules');
assert(profileJs.includes('realTrialRuleWritebackPatches') && profileWxml.includes('realTrialRuleWritebackLine') && profileWxml.includes('规则回写') && profileWxml.includes('复测计划'), 'Profile exposes rule writeback and retest plan');
assert(storageJs.includes('buildRealTrialRuleRetestDeck') && storageJs.includes('real_trial_rule_retest_deck') && storageJs.includes('active_recall_no_rank') && storageJs.includes('第 7 天'), 'Storage turns rule writeback into spaced active-recall retest cards');
assert(profileJs.includes('realTrialRuleRetestCards') && profileWxml.includes('realTrialRuleRetestLine') && profileWxml.includes('复测卡'), 'Profile exposes rule retest cards for the next family loop');
assert(storageJs.includes('ensureRealTrialRuleRetestReviewCards') && storageJs.includes('real_trial_rule_retest_review_bridge') && storageJs.includes("type: 'real_trial_rule_retest'"), 'Storage persists rule retest cards into the executable review queue');
assert(profileJs.includes('realTrialRuleRetestReviewCards') && profileWxml.includes('realTrialRuleRetestReviewLine') && profileWxml.includes('复测入队') && profileWxml.includes('复测挑战'), 'Profile exposes executable retest review cards and challenge cards');
assert(reviewJs.includes('buildRuleRetestPanel') && reviewJs.includes('runRuleRetestAction') && reviewJs.includes('规则复测卡') && reviewWxml.includes('rule-retest-card') && reviewWxml.includes('去做复测挑战'), 'Review page gives rule retest cards a dedicated executable panel');
assert(arcadeJs.includes('ruleRetestCards') && arcadeJs.includes('ruleRetestChallengeTitle') && arcadeWxml.includes('ruleRetestChallengeCards') && arcadeWxml.includes('复测卡'), 'Arcade page exposes rule retest challenge context instead of hiding retest cards inside normal play');
assert(profileJs.includes('recordRealTrialSample') && profileJs.includes('appendRealTrialSample') && profileWxml.includes('bindtap="recordRealTrialSample"'), 'Profile has a user-triggered real trial sample capture action instead of only a passive report block');
assert(profileWxml.includes('记录一次零帮助完成') && profileWxml.includes('记录一次卡住样本') && profileWxss.includes('.real-trial-actions'), 'Real trial capture gives parents two compact trial outcomes: zero-help and stuck sample');
assert(storageJs.includes('marginalRule') && profileWxml.includes('边际规则'), 'Real trial recovery includes a marginal-benefit stop rule instead of endless static thickening');
assert(storageJs.includes('original_question') && storageJs.includes('full_answer') && storageJs.includes('full_dialogue'), 'Real trial recovery blocks original question, answer, and full dialogue fields');
assert(profileJs.includes('sevenDayActionBoard') && profileJs.includes('sevenDayPlan') && profileJs.includes('7天行动板') && profileWxml.includes('report-action-board') && profileWxml.includes('第7天'), 'Learning report turns analysis into a visible 7-day action board');
assert(storageJs.includes('buildReportDailyActionQueue') && storageJs.includes("appendSyncMutation('report_daily_action_queue'"), 'Learning report turns the 7-day plan into a synced daily action queue');
assert(storageJs.includes('reportDailyActionId') && storageJs.includes('reportDailyAction: reportDailyActionQueue'), 'Tonight route pulls the report daily action into the task order');
assert(profileJs.includes('reportDailyActionQueue') && profileWxml.includes('learningReportSummary.reportTodayActionLine') && profileWxml.includes('dailyShareCard.reportDailyAction.actionLine'), 'Profile and share card consume the report daily action queue');
assert(profileJs.includes('unified_next_action') && profileWxml.includes('dailyShareCard.unifiedNextAction.actionLabel') && homeJs.includes('safeDecodeShareParam') && storageJs.includes('normalized.action_label || parentNextActionLabel'), 'Share flow carries the unified next action into home activation with safe landing parsing');
assert(profileJs.includes('parentNextAction') && profileJs.includes('action=${parentNextAction}') && homeJs.includes('parent_next_action') && storageJs.includes('parent_next_action'), 'Share flow carries parent next action from profile to incoming home activation');
assert(toolsNav.includes('renderLearningLoopDock') && toolsNav.includes('tool-learning-loop-dock') && toolsNav.includes('buildLearningLoopSnapshot'), 'Tool pages expose a shared loop dock after successful local evidence is available');
assert(learningStore.includes('ydzx:learning-store-updated') && learningStore.includes('emitLearningStoreUpdated') && toolsNav.includes('bindLearningLoopDockRefresh') && toolsNav.includes("addEventListener('ydzx:learning-store-updated'"), 'Tool loop dock refreshes immediately after a tool writes new learning evidence');
assert(shareKit.includes('enrichOptsWithLoopEvidence') && shareKit.includes('buildLearningLoopSnapshot') && shareKit.includes('shareEvidenceLine'), 'Web share cards enrich outgoing shares with real local learning-loop evidence when available');
assert(shareKit.includes('buildLearningEvidenceTimeline') && shareKit.includes('timeline.shareLine'), 'Web share cards can include the parent-readable local evidence timeline');
assert(shareKit.includes("label: '计划'") && shareKit.includes("label: '练习'") && shareKit.includes("label: '错题'"), 'Web share cards add local evidence metrics without claiming cloud-backed data');
assert(studyToolsHtml.includes('learning-loop-bridge') && studyToolsHtml.includes('renderStudyToolsLoopBridge') && studyToolsHtml.includes('buildLearningLoopSnapshot'), 'Study tools page consumes the local learning loop instead of falling back to a generic tool grid');
assert(studyToolsHtml.indexOf('/src/learning-store.js') < studyToolsHtml.indexOf('/src/today-recos.js'), 'Study tools loads LearningStore before TodayRecos so recommendation ranking can use loop evidence');
assert(studyToolsHtml.includes('tools/error-practice.html') && studyToolsHtml.includes('tools/study-plan.html') && studyToolsHtml.includes('tools/feynman-verify.html') && studyToolsHtml.includes('tools/knowledge-explain.html'), 'Study tools loop bridge routes evidence states to real tool pages');
assert(homeJs.includes('action_label') && homeJs.includes('action=${incoming.parent_next_action') && read('miniprogram/pages/home/home.wxml').includes('下一步：{{incomingShare.action_label}}'), 'Incoming share landing page explains the next action and preserves it into arcade');
assert(homeJs.includes('incomingShareRelay') && homeJs.includes('buildIncomingShareRelay') && homeWxml.includes('share-relay-board'), 'Incoming share landing exposes a relay board instead of a single generic challenge button');
assert(homeJs.includes('defaultReceiverAction') && homeJs.includes('用我自己的作业做同类第一步') && homeWxml.includes('receiver-default-action'), 'Incoming share landing defaults to one own-material first-step action before detailed relay evidence');
assert(homeWxml.includes('马上做这一小步') && homeJs.includes('receiver_own_first_step'), 'Incoming share default action is executable and writes receiver-owned first-step evidence');
assert(homeJs.includes('runIncomingShareRelayAction') && homeJs.includes('incoming_share_relay') && homeJs.includes('share_relay_action') && homeJs.includes('recordUnifiedNextAction') && homeJs.includes('recordSurfaceDepthAction'), 'Incoming share relay writes unified action, surface-depth action, and share activation evidence');
assert(homeWxml.includes('data-evidence="{{item.evidence}}"') && homeWxss.includes('share-relay-action'), 'Incoming share relay actions carry evidence and have compact mobile-safe cards');
assert(!/已领取|可领取|可以领取奖励|今日目标奖励|完成今日复习可领取|奖励暂时不可领取|奖励记录已写回/.test(reviewJs + reviewCards + arcadeJs), 'Review and arcade use learning-record wording instead of redeemable reward wording');
assert(/学习记录已写回/.test(arcadeJs), 'Arcade completion writes learning record copy');
assert(!/demo_|code !== 'demo'|code: 'demo'|mode = 'demo'|mode: 'demo'/.test(miniApi + miniSession + miniShared), 'Mini session path uses local mode instead of demo sessions');
assert(!/cloud_sync_not_configured|云同步/.test(miniLeaderboard), 'Leaderboard service gating avoids cloud-sync/internal wording');
assert(!/假社交|假数据/.test(miniLeaderboard), 'Leaderboard fallback avoids fake-social wording');
assert(!/云端持久化|云同步|本地 Storage/.test(parentBind + reviewDueCards), 'Parent/review APIs avoid internal persistence setup wording');
assert(!/云端|云同步|本地 Storage/.test(deckCards + reviewCards + profileJs + profileWxml), 'Deck/review/profile copy avoids internal cloud wording');
assert(!/账号和服务配置|账号服务配置|小程序服务配置|production cloud|cloud-ready|cloud integration|cloud replay|authenticated production sync|production login\/cloud/.test(parentBind + miniSession + miniAchievements + reviewCards), 'Active summaries avoid setup jargon and English production-readiness wording');
assert(/local_learning_rewards/.test(miniShop + miniAchievements), 'Shop and achievement APIs expose local learning reward mode');
assert(/persisted:\s*false/.test(miniShop + miniAchievements + miniFeedback), 'Reward and feedback APIs do not imply real persistence without service configuration');
assert(/local_feedback_receipt/.test(miniFeedback) && !/server-feedback-contract|dataset_contract/.test(miniFeedback), 'Feedback API returns a local receipt instead of pretending to write a server dataset');
assert(!/dataset_contract/.test(miniFeedback + miniEventApi + leadApi), 'Current mini API paths expose service contracts instead of internal dataset contracts');
const commercialApiSurface = miniTutor + miniPriority + miniWeekly + miniReport + miniQuizGenerate + miniQuizSubmit + miniReviewToday + miniReviewGrade + miniContentCheck + miniContentEngine + decksApi + deckCards;
assert(/service_contract/.test(commercialApiSurface), 'Core mini APIs expose service contracts');
assert(/persisted:\s*false/.test(commercialApiSurface), 'Core mini APIs avoid implying persistence');
assert(!/client_storage_or_sync|provider:\s*'server-precheck'/.test(commercialApiSurface), 'Content/deck APIs avoid internal storage or server-precheck wording');
assert(!/source:\s*'server-/.test(miniPriority + miniWeekly + miniReport), 'Priority/weekly/report avoid pretending server-backed intelligence in local mode');
assert(!/Only POST is allowed|Too many (?:requests|quiz requests|review records|quiz submissions|deck requests)|Mini session is invalid|Missing source text|Missing client identity|Missing card id|CONTENT QUALITY GATE|Clear recall prompt|Usable answer|Wrong-cause lens|Transfer check|Core coverage|AI assisted content|已配置的账号服务|未完成账号和多设备连续性配置/.test(commercialApiSurface + decksApi + deckCards + reviewDueCards + miniEventApi + miniSync + miniLeaderboard), 'Active APIs use product-facing Chinese error and empty-state wording');
assert(!/IMPORT READY|IMPORT WITH REPAIR|WAITING FOR CONTENT|repair queue|daily mission|API key|LOCAL GAME ECONOMY|Daily 5-minute recall|Wrong-cause boss battle|Local quiz checkpoint|Weekly season checkpoint|SYNTHETIC COHORT LAB|Synthetic cohorts|Need model-backed|Miniapp production|Blocked only by real AppID/.test(reviewCards), 'Review summary avoids internal readiness labels, API-key copy, and English planning surfaces');
assert(!/stateless_ack/.test(leadApi + miniEvent + miniSync + profileJs), 'Lead/event/sync paths use local receipt wording instead of stateless ack');
assert(/service_ready/.test(leadApi + profileJs), 'Lead submission exposes whether a real follow-up channel is configured');
assert(!/拍照出答案|自动识别答案|保证提分|注定|必然/.test(profileWxml + toolsJs + arcadeJs + learningReportRecognition + apiRecognition), 'Commercial shell avoids unsafe claims');
assert(!/Gizmo|Khan|Khanmigo|Anki|parity|moat|moonshot|BENCHMARK|MOAT|学习证明|购买|兑换/.test(reviewCards + toolsJs + miniGame + parentChildStats), 'Commercial surface avoids competitor, internal strategy, proof, and transaction wording');
assert(!/coins:\s*/.test(parentChildStats), 'Parent stats expose learning record points instead of coin currency');
assert(!/parentReport\.proofScore|parentReport\.proofLabel|proofScore/.test(profileJs + profileWxml), 'Profile uses parent-facing record status instead of proof-score fields');
assert(profileJs.includes('parentConversationPlan') && profileJs.includes('shareOutcome') && profileJs.includes('parent_next_action'), 'Profile share card carries parent conversation and next-action outcome');
assert(profileJs.includes('familyActionCard') && profileJs.includes('tonightAction') && profileJs.includes('家庭行动卡') && profileWxml.includes('share-family-action') && profileWxml.includes('明天复核'), 'Profile share card is a family action card with tonight action and tomorrow check');
assert(homeJs.includes('action_detail') && homeWxml.includes('怎么做：{{incomingShare.action_detail}}') && storageJs.includes('parentNextActionDetail'), 'Incoming share carries actionable family-card detail into the landing page');
assert(storageJs.includes('buildShareChallengePlan') && profileJs.includes('shareChallengePlan') && profileWxml.includes('dailyShareCard.shareChallengePlan') && homeWxml.includes('轻挑战：{{incomingShare.challenge_goal}}'), 'Share card carries a non-ranking challenge plan into profile and home landing surfaces');
assert(storageJs.includes('reviewCadence') && storageJs.includes('parentEvidenceLine') && profileWxml.includes('dailyShareCard.shareChallengePlan.reviewCadence') && profileWxml.includes('parentEvidenceLine'), 'Share challenge links active recall, spaced review, and parent evidence instead of only sharing an invite');
assert(storageJs.includes('buildCommunityShareRelayBoard') && profileJs.includes('communityShareRelayBoard') && profileWxml.includes('communityShareRelayBoard.lanes'), 'Profile exposes privacy-safe community share relay board with sender, receiver, and parent lanes');
assert(storageJs.includes('challengeCompletions') && storageJs.includes('returnRateLabel') && profileWxml.includes('communityShareRelayBoard.challengeCompletions'), 'Community relay board shows receiver completion loops without score/ranking leaderboard');
assert(storageJs.includes('buildSafeRelayChallengePacket') && storageJs.includes('original_answer') && profileJs.includes('relay_receiver_action') && profileWxml.includes('safeRelayChallengePacket.receiverAction'), 'Outgoing share includes a safe relay packet with blocked original answer and receiver action');
assert(storageJs.includes('buildWrongCauseViralChallengePack') && storageJs.includes('wrong_cause_viral_challenge_pack') && profileJs.includes('wrong_cause_pack') && profileJs.includes('wrong_cause_receiver_action'), 'Outgoing share includes a wrong-cause viral challenge packet and encoded receiver action');
assert(storageJs.includes('original_question') && storageJs.includes('full_dialogue') && storageJs.includes('ranking') && profileWxml.includes('dailyShareCard.shareChallengePlan.wrongCauseViralChallengePack') && profileWxml.includes('错因挑战钩子'), 'Wrong-cause viral pack is visible and blocks original question, full dialogue, and ranking fields');
assert(profileWxml.includes('communityShareRelayBoard.wrongCauseViralChallengePack') && profileWxml.includes('错因挑战传播包') && profileWxml.includes('错因传播边界'), 'Community relay board exposes the wrong-cause viral pack with privacy boundary');
assert(storageJs.includes('visualRelayProtocol') && storageJs.includes('visualRelayProofChecklist') && profileWxml.includes('communityShareRelayBoard.visualRelayProtocol') && profileWxml.includes('小黑板接力边界'), 'Community share relay includes a visible visual blackboard relay protocol');
assert(homeJs.includes('relay_allowed_fields') && homeJs.includes('receiverActionLine') && homeWxml.includes('incomingShareRelay.blockedFieldLine'), 'Incoming share preserves safe relay packet fields on the home relay board');
assert(homeJs.includes('receiverCompletionLine') && homeWxml.includes('incomingShareRelay.receiverCompletionLine'), 'Incoming share relay board exposes receiver completion evidence');
assert(storageJs.includes('receiver_material') && storageJs.includes('evidence_contract') && storageJs.includes('receiver_own_first_step_required') && storageJs.includes('receiver_own_wrong_cause_required') && storageJs.includes('receiver_next_revisit_required'), 'Share relay completion stores own-material evidence contract instead of sender payload');
assert(profileJs.includes('question_bank_relay_first_step') && homeJs.includes('question_bank_relay_parent_check') && homeWxml.includes('incomingShareRelay.questionBankRelayLine'), 'Outgoing and incoming share preserve question-bank relay context');
assert(storageJs.includes('buildQuestionBankVisualShareRelayDeck') && profileJs.includes('visualRelayQuery') && profileWxml.includes('dailyShareCard.questionBankVisualShareRelayDeck'), 'Profile turns question-bank visual blackboard into a safe outgoing share relay');
assert(profileJs.includes('visual_board_relay_blocked_fields') && storageJs.includes('visual_board_relay_boundary') && storageJs.includes('original_answer'), 'Visual board share relay blocks original answer, score, ranking, and full dialogue fields');
assert(homeJs.includes('visual_board_relay_student_line') && homeWxml.includes('incomingShareRelay.visualBoardRelayLine') && homeJs.includes('visual_board_relay_route'), 'Home preserves and displays visual blackboard relay context on incoming share');
assert(homeJs.includes('goSharedChallenge') && homeWxml.includes('bindtap="goSharedChallenge"') && homeJs.includes('incoming.challenge_route || incoming.capability_route') && homeJs.includes('challenge_route: incoming.challenge_route'), 'Incoming share challenge starts from its encoded route and keeps challenge evidence in activation events');
assert(storageJs.includes('relayChain') && storageJs.includes('returnPathContract') && storageJs.includes('privacyBoundary') && storageJs.includes('shareRelayActions'), 'Share challenge now has relay-chain, return-path, privacy, and action contracts');
assert(profileJs.includes('relay_privacy') && profileWxml.includes('dailyShareCard.shareChallengePlan.privacyBoundary') && profileWxml.includes('dailyShareCard.shareChallengePlan.returnPathContract'), 'Profile outgoing share card exposes privacy-safe return contracts');
assert(homeJs.includes('relay_first_step') && homeJs.includes('relay_review') && homeWxml.includes('incomingShare.relay_privacy') && homeWxml.includes('incomingShareRelay.returnContractLine'), 'Incoming share landing preserves first-step, seven-day review, privacy, and return-contract payloads');
assert(storageJs.includes('recordShareRelayCompletion') && reviewJs.includes('recordShareRelayCompletion') && arcadeJs.includes('recordShareRelayCompletion') && homeWxml.includes('incomingShareRelay.receiverCompletionLine'), 'Receiver share relay completion writes back into share/review evidence instead of staying as a landing display');
assert(storageJs.includes('naturalSpreadLoop') && storageJs.includes('relay_invite_line') && storageJs.includes('viralGuardrails') && storageJs.includes('proofOfLifeSignal'), 'Share challenge has a privacy-safe natural spread loop, invite line, guardrails, and proof-of-life signal');
assert(profileJs.includes('relay_receiver_prompt') && profileWxml.includes('naturalSpreadLoop.receiverPrompt') && homeJs.includes('naturalSpreadReceiverLine') && homeWxml.includes('incomingShareRelay.naturalSpreadGuardrailLine'), 'Natural spread loop is carried from outgoing profile query into the incoming home relay board');
assert(storageJs.includes('buildShareSpreadReadinessGate') && storageJs.includes('share_spread_readiness_gate') && storageJs.includes('peer_relay_ready') && storageJs.includes('parent_only'), 'Share spread readiness is decided by local deterministic code, not AI copy');
assert(profileJs.includes('relay_spread_status') && profileWxml.includes('spreadReadinessGate.shareModeLine') && homeJs.includes('spreadReadinessGate') && homeWxml.includes('incomingShareRelay.spreadReadinessLine'), 'Share spread readiness gate survives outgoing profile share and incoming home relay board');
assert(storageJs.includes('不晒分、不排名、不传原题照片、不传完整对话、不传最终答案') && storageJs.includes('relay_spread_required'), 'Share spread gate keeps no-ranking, no-answer, no-photo, and evidence-required boundaries');
assert(storageJs.includes('familyRelayGrowthProtocol') && storageJs.includes('receiverOwnMaterialAction') && storageJs.includes('day7_transfer_check') && storageJs.includes('relay_growth_gate'), 'Share challenge carries a local family relay growth protocol with own-material action and day-7 return gate');
assert(storageJs.includes('AI may rewrite the card copy; local code decides share fields'), 'Family relay growth keeps AI out of share field and gate decisions');
assert(storageJs.includes('buildPeerRelayChallengeLadder') && storageJs.includes('peer_ladder_release_gate') && storageJs.includes('full_answer') && storageJs.includes('relay_attraction_hook'), 'Share challenge carries a proof-based peer relay ladder with answer-safe attraction hooks');
assert(profileJs.includes('relay_ladder') && profileWxml.includes('communityShareRelayBoard.peerRelayChallengeLadder.stages') && profileWxml.includes('可复制挑战'), 'Profile exposes peer relay ladder and copyable templates');
assert(storageJs.includes('sourceBackedChallengeDeck') && storageJs.includes('source_challenge_prompt') && profileWxml.includes('communityShareRelayBoard.sourceBackedChallengeDeck') && profileWxml.includes('来源挑战'), 'Community share relay includes source-backed 90-second challenge cards');
assert(profileJs.includes('sourceChallengeQuery') && homeJs.includes('source_challenge_decision') && homeWxml.includes('incomingShareRelay.sourceChallengePromptLine') && homeWxml.includes('incomingShareRelay.sourceChallengeBlockedLine'), 'Source-backed challenge survives share query into incoming home relay with decision and blocked fields');
assert(homeJs.includes('relay_ladder') && homeJs.includes('peerRelayAttractionLine') && homeWxml.includes('incomingShareRelay.peerRelayLadderLine'), 'Incoming share preserves peer relay ladder and attraction hooks');
assert(storageJs.includes('buildPeerRelaySeasonArc') && storageJs.includes('peer_relay_season_arc') && storageJs.includes('season_d7_return_gate') && storageJs.includes('peer_relay_season_local_gate'), 'Share challenge has a deterministic 7-day peer relay season arc');
assert(profileJs.includes('relay_season_status') && profileWxml.includes('dailyShareCard.shareChallengePlan.peerRelaySeasonArc') && profileWxml.includes('communityShareRelayBoard.peerRelaySeasonArc'), 'Profile exposes outgoing and community relay season arcs');
assert(homeJs.includes('relay_season') && homeJs.includes('peerRelaySeasonLine') && homeWxml.includes('incomingShareRelay.peerRelaySeasonLine'), 'Incoming share preserves peer relay season status, days, and local gate');
assert(['relay_spread_status', 'relay_spread_line', 'relay_season', 'relay_season_days', 'source_challenge_prompt', 'socratic_report_action', 'tonight_decision'].every((field) => storageJs.includes(`${field}: normalized.${field}`)), 'Storage persists incoming share spread season source and report fields instead of dropping parsed query context');
assert(homeJs.includes('unitDecisionLine') && homeJs.includes('unitBlackboardLine') && homeWxml.includes('incomingShareRelay.unitDecisionLine'), 'Incoming share relay board turns course-unit context into parent-readable actions');
assert(profileJs.includes('socraticReportQuery') && profileJs.includes('socraticMemoryRelay') && profileWxml.includes('dailyShareCard.socraticMemoryRelay'), 'Profile share card carries Socratic memory report evidence safely');
assert(profileJs.includes('tonightDecisionQuery') && profileWxml.includes('dailyShareCard.tonightDecisionRelay'), 'Profile share card carries tonight decision brief as a safe relay payload');
assert(homeJs.includes('tonight_decision') && homeWxml.includes('incomingShareRelay.tonightDecisionLine'), 'Incoming share landing preserves tonight decision brief safely');
assert(homeJs.includes('socratic_report_status') && homeJs.includes('socratic_report_no_increase') && homeJs.includes('socraticReportNoIncreaseLine'), 'Incoming share persists Socratic report status and no-increase rule');
assert(homeWxml.includes('incomingShareRelay.socraticReportActionLine') && homeWxml.includes('incomingShareRelay.socraticReportBoundaryLine'), 'Incoming share relay board exposes Socratic report action and privacy boundary');
assert(storageJs.includes('parentDecisionPayload') && storageJs.includes('wrongCauseReplayPayload') && storageJs.includes('sevenDayReviewPayload') && storageJs.includes('evidenceContractLine'), 'Share payload carries parent decision, wrong-cause replay, seven-day review, and evidence contract depth');
assert(storageJs.includes('buildFirstStepBlackboardBlueprint') && tutorWxml.includes('visualSocraticMatrix.blackboardBlueprint') && lightDiagnosisWxml.includes('diagnosis.visualBlackboard'), 'First-step blackboard blueprint is surfaced in tutor and light-diagnosis surfaces');
assert(tutorLadder.includes('buildSocraticQualityEvaluationSuite') && tutorJs.includes('socraticQualityEvaluationSuite') && tutorWxml.includes('thinkingReceipt.socraticQualityEvaluationSuite'), 'Tutor exposes a Socratic quality evaluation suite instead of only one-off hints');
assert(tutorLadder.includes('silent_child') && tutorLadder.includes('answer_request') && tutorLadder.includes('transfer_fail'), 'Socratic quality suite covers silent, answer-request, and transfer-fail scenarios');
assert(tutorLadder.includes('buildSocraticFallbackPlan') && tutorJs.includes('socratic_fallback_plan') && tutorWxml.includes('thinkingReceipt.socratic_fallback_plan') && tutorWxml.includes('microChoices'), 'Tutor has a visible Socratic fallback plan for silence and direct-answer requests');
assert(tutorLadder.includes('buildFallbackRecoveryBridge') && tutorJs.includes('fallback_recovery_bridge') && tutorWxml.includes('thinkingReceipt.fallback_recovery_bridge'), 'Tutor turns fallback and visual recovery into one visible recovery bridge');
assert(tutorLadder.includes('buildThreeRoundSocraticProtocol') && tutorJs.includes('three_round_socratic_protocol') && tutorWxml.includes('thinkingReceipt.three_round_socratic_protocol'), 'Tutor has a visible three-round Socratic coaching protocol');
assert(tutorLadder.includes('round_1_axis_probe') && tutorLadder.includes('round_2_micro_choice') && tutorLadder.includes('round_3_parent_handoff') && tutorLadder.includes('safe_share_boundary'), 'Three-round Socratic protocol carries evidence for axis probe, micro choice, parent handoff, and safe sharing');
assert(tutorLadder.includes('buildSocraticAiLocalBoundaryContract') && tutorLadder.includes('localOwns') && tutorLadder.includes('aiMayRewrite') && tutorLadder.includes('aiMustNotDecide'), 'Tutor ladder has an explicit local-rule vs AI rewrite responsibility contract');
assert(tutorJs.includes('socratic_ai_local_boundary_contract') && tutorJs.includes('socratic_ai_local_rows') && tutorJs.includes('socratic_ai_local_local_owns'), 'Tutor persists AI/local responsibility evidence for audit and reports');
assert(tutorWxml.includes('thinkingReceipt.socraticAiLocalReadableRows') && tutorWxml.includes('thinkingReceipt.realHomeworkUseReadableWorkbench') && tutorWxml.includes('thinkingReceipt.openMaicInspiredReadableEventFlow') && tutorWxml.includes('thinkingReceipt.evidenceThreadLine'), 'Tutor visibly exposes readable AI/local, workbench, OpenMAIC-inspired, and evidence-thread lines');
assert(!tutorWxml.includes('runtimeDecisionRows') && !tutorWxml.includes('{{item.localGate}}') && !tutorWxml.includes('thinkingReceipt.evidenceThread.topicCardId') && !tutorWxml.includes('thinkingReceipt.evidenceThread.day7Gate'), 'Tutor does not expose raw runtime fields, local gates, topic ids, or day-7 gate names');
assert(tutorJs.includes('recordMiniLessonExitGate') && storageJs.includes('recordMiniLessonExitGate') && tutorWxml.includes('bindtap="recordMiniLessonExitGate"'), 'Tutor mini-lesson exit gate is executable and persisted locally');
assert(tutorWxml.includes('data-status="passed"') && tutorWxml.includes('data-status="needs_support"') && tutorJs.includes('miniLessonExitGateStatus'), 'Tutor mini-lesson exit gate records pass/support outcomes and updates visible state');
assert(storageJs.includes('recordMiniLessonReviewResult') && reviewJs.includes('recordMiniLessonReviewResult') && reviewJs.includes("current.type === 'three_minute_mini_lesson_return'"), 'Review completion writes mini-lesson return results back to the same evidence thread');
assert(storageJs.includes('next_day_revisit_completed') && storageJs.includes('pending_day7_variant') && storageJs.includes("appendSyncMutation('mini_lesson_review_result'"), 'Mini-lesson review result opens day-7 variant evidence without exposing answers');
assert(profileJs.includes('fallbackRecoveryBridge') && profileWxml.includes('learningReportSummary.fallbackRecoverySequence') && profileWxml.includes('tutorProcessSummary.fallbackRecoveryLine'), 'Profile consumes fallback recovery bridge in parent report and process summary');
assert(learningReport.includes('buildFamilyDecisionMemo') && profileJs.includes('familyDecisionMemo') && profileWxml.includes('learningReportSummary.familyDecisionTitle') && profileWxml.includes('7天降级'), 'Learning report surfaces a family decision memo instead of only a data dashboard');
assert(!/质量\s*\$\{score\s*\|\|\s*0\}\/100|质量\s*\d+\/100/.test(toolsJs + read('miniprogram/pages/tools/tools.wxml')), 'Tools explains generated material with readiness conditions instead of user-facing quality scores');
assert(!/支付入口|账号、存储|服务配置|正式配置/.test(serviceAccess), 'Service access gate uses user-facing scope language instead of setup or payment terms');
assert(packageJson.includes('miniapp:sync:aiedumini') && syncMiniappRepo.includes('zacharyxpku-boop/aiedumini.git'), 'Miniapp has a runnable sync command for the standalone aiedumini repo');
assert(syncMiniappRepo.includes("sourcePath: 'miniprogram'") && syncMiniappRepo.includes('project.private.config.json') && syncMiniappRepo.includes('--push'), 'Miniapp sync exports only the miniapp, excludes private config, and supports push mode');
assert(syncMiniappRepo.includes('miniapp-sync-manifest') && syncMiniappRepo.includes("['clone'") && !syncMiniappRepo.includes('progress.html') && !syncMiniappRepo.includes('study-tools.html'), 'Miniapp sync is manifest-backed and does not upload static web surfaces');
assert(verifyScript.includes('Miniapp Standalone Sync Dry Run') && verifyScript.includes('Invoke-Native "node" @("scripts/sync-miniapp-repo.cjs", "--dry-run")'), 'Verification gate checks standalone miniapp sync before release reporting');
assert(syncMiniappRepo.includes('ensureLocalGitIdentity') && syncMiniappRepo.includes('Codex Miniapp Sync') && syncMiniappRepo.includes('codex-miniapp-sync@users.noreply.github.com'), 'Standalone miniapp sync can commit from a fresh local clone without relying on global git identity');
assert(syncMiniappRepo.includes('fs.chmodSync(target, 0o666)') && syncMiniappRepo.indexOf('fs.chmodSync(target, 0o666)') < syncMiniappRepo.indexOf('fs.copyFileSync(source, target)'), 'Standalone miniapp sync can overwrite its own generated files on Windows read-only clones');
assert(packageJson.includes('miniapp:depth-audit') && verifyScript.includes('Miniapp Depth Audit') && miniappDepthAudit.includes('pageToSurface') && miniappDepthAudit.includes('buildAcceptanceReport'), 'Verification includes a machine-readable miniapp depth audit across pages, surface packs, and acceptance report');

const activeMiniPaths = Array.from(miniApi.matchAll(/request\('([^']+)'/g)).map((match) => match[1]).sort();
const allowedMiniPaths = [
  '/api/lead',
  '/api/mini/achievements',
  '/api/mini/content-check',
  '/api/mini/content-engine',
  '/api/mini/event',
  '/api/mini/feedback',
  '/api/mini/leaderboard',
  '/api/mini/learning-report-recognize',
  '/api/mini/priority',
  '/api/mini/quiz-generate',
  '/api/mini/quiz-submit',
  '/api/mini/report',
  '/api/mini/review-grade',
  '/api/mini/review-today',
  '/api/mini/session',
  '/api/mini/shop',
  '/api/mini/sync',
  '/api/mini/tutor-message',
  '/api/mini/weekly',
  '/api/miniapp-material-analysis'
].sort();
assert.deepStrictEqual(activeMiniPaths, allowedMiniPaths, 'Miniapp client only calls current service-contract API surface');
assert(!/\/api\/(?:log-dialogue|fsrs-|ingest-attempt|mastery-proxy|parent-push|student-init|ai-proxy|mentor-queue)/.test(miniApi), 'Miniapp client does not call legacy demo/server-only APIs');
assert(
  miniApi.includes('localSession')
    && miniApi.includes('recognizeLearningReport')
    && miniApi.includes("mode: 'client_local_draft'")
    && miniApi.includes('confirmation_required: true'),
  'Miniapp client has local fallbacks for session and recognition failures'
);

const activeApiDirs = ['api/mini', 'api/parent', 'api/review', 'api/report', 'api/decks', 'api/shop', 'api/quiz'];
const missingContracts = activeApiDirs
  .flatMap(listJsFiles)
  .filter((file) => !file.endsWith(`${path.sep}_game.js`) && !file.endsWith(`${path.sep}_shared.js`))
  .filter((file) => {
    const code = fs.readFileSync(file, 'utf8');
    if (!/ok:\s*true/.test(code)) return false;
    return !/service_contract|service_ready|mode:\s*'local_receipt'|mode:\s*'empty'|export default handler/.test(code);
  })
  .map((file) => path.relative(root, file));
assert.deepStrictEqual(missingContracts, [], 'Active API ok:true responses must expose service readiness/contract semantics');

assert(reportGenerator.includes('function renderSimpleShareCard') && reportGenerator.includes("renderSimpleShareCard('study_plan'") && reportGenerator.includes("renderSimpleShareCard('progress'"), 'Report generator renders real study-plan and progress share cards instead of empty callbacks');
assert(reportGenerator.includes('enrichReportData') && reportGenerator.includes('buildLearningEvidenceTimeline') && reportGenerator.includes('evidenceLine'), 'Report generator share cards consume the local evidence timeline');
assert(reportGenerator.includes('家庭学习行动卡') && reportGenerator.includes('这张卡只记录学习建议和回访动作') && !/Progress follow-up card|Study plan card|Family learning action card|Next steps/.test(reportGenerator), 'Report generator default share copy is family-facing Chinese instead of generic English');
assert(!/AI精准分析|AI提分教练|提分突破口/.test(reportGenerator), 'Report generator avoids unsafe score-improvement positioning');
assert(!/TODO:[\s\S]*generateStudyPlanCard|TODO:[\s\S]*generateProgressCard/.test(reportGenerator), 'Report generator has no TODO placeholders for study-plan or progress cards');
assert(!/generateStudyPlanCard: function \(data, callback\) \{[\s\S]*?callback\(null\);[\s\S]*?\},/.test(reportGenerator), 'Study-plan share card no longer returns an empty canvas');
assert(!/generateProgressCard: function \(data, callback\) \{[\s\S]*?callback\(null\);[\s\S]*?\n        \}/.test(reportGenerator), 'Progress share card no longer returns an empty canvas');
assert(!/预留|待实现|待开发/.test(reportGenerator), 'Report generator comments do not describe shipped share cards as reserved work');
assert(!homeJs.includes('这题暂时不可用'), 'Home scenario fallback uses action wording instead of unavailable-feature wording');

assert(learningStore.includes('buildLearningLoopSnapshot') && learningStore.includes('local_learning_loop_snapshot'), 'Static learning store exposes a cross-record learning loop snapshot');
assert(learningStore.includes('buildLearningEvidenceTimeline') && learningStore.includes('local_learning_evidence_timeline'), 'Static learning store exposes a parent-readable local evidence timeline');
assert(learningStore.includes('latestPlan') && learningStore.includes('latestPractice') && learningStore.includes('latestProgress') && learningStore.includes('dueErrors'), 'Static learning store snapshot connects plan, practice, progress, and due review evidence');
assert(!new RegExp('\\u9884\\u7559|\\u5f85\\u5b9e\\u73b0|\\u5f85\\u5f00\\u53d1').test(learningStore), 'Static learning store does not describe shipped local records as reserved work');
assert(progressHtml.includes('learning-loop-bridge') && progressHtml.includes('renderLearningLoopBridge') && progressHtml.includes('buildLearningLoopSnapshot'), 'Progress page visibly consumes the local learning loop snapshot');
assert(progressHtml.includes('loop-next-action') && progressHtml.includes('loop-parent-line') && progressHtml.includes('loop-counts'), 'Progress page exposes next action, parent prompt, and evidence counts from the loop snapshot');
assert(progressHtml.includes("cls: 'loop'") && progressHtml.includes("href: 'study-tools.html'"), 'Progress smart-next cards include a routeable local-loop continuation action');
assert(progressHtml.includes('evidence-timeline') && progressHtml.includes('renderLearningEvidenceTimeline') && progressHtml.includes('buildLearningEvidenceTimeline'), 'Progress page renders the local evidence timeline for parent-readable closure');

{
  const backing = new Map();
  const localStorage = {
    getItem(key) {
      return backing.has(key) ? backing.get(key) : null;
    },
    setItem(key, value) {
      backing.set(key, String(value));
    }
  };
  const context = {
    window: { localStorage },
    console: { error() {} },
    alert() {},
    confirm() { return true; },
    Math,
    Date
  };
  vm.runInNewContext(learningStore, context);
  const store = context.window.LearningStore;
  store.saveStudyPlan({ title: 'plan tonight' });
  store.savePractice({ subject: 'math', title: 'first step practice' });
  store.saveProgress({ subject: 'math', mastery: 0.6 });
  store.saveError({ subject: 'math', keyword: 'relation', question: 'word problem' });
  const savedError = store.getErrors()[0];
  store.updateError(savedError.id, { nextReviewAt: Date.now() - 1000 });
  const snapshot = store.buildLearningLoopSnapshot();
  assert.strictEqual(snapshot.id, 'local_learning_loop_snapshot', 'Learning store snapshot has a stable evidence id');
  assert.strictEqual(snapshot.ready, true, 'Learning store snapshot becomes ready after local evidence exists');
  assert(snapshot.counts.plans >= 1 && snapshot.counts.practice >= 1 && snapshot.counts.progress >= 1 && snapshot.counts.dueErrors >= 1, 'Learning store snapshot counts all local evidence streams');
  assert(snapshot.nextAction && snapshot.parentLine && snapshot.shareLine && snapshot.shareLine.indexOf(snapshot.nextAction) >= 0, 'Learning store snapshot produces next action, parent prompt, and share line');
  const timeline = store.buildLearningEvidenceTimeline({ limit: 5 });
  assert.strictEqual(timeline.id, 'local_learning_evidence_timeline', 'Learning evidence timeline has a stable evidence id');
  assert.strictEqual(timeline.ready, true, 'Learning evidence timeline becomes ready after local evidence exists');
  assert(timeline.items.length >= 4, 'Learning evidence timeline combines plan, practice, progress, and error records');
  assert(timeline.parentSummary && timeline.shareLine && timeline.items[0].title, 'Learning evidence timeline produces parent summary, share line, and readable items');
}

console.log('All commercial shell tests pass.');
