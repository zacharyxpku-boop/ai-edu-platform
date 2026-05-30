#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function includesAll(text, terms, label) {
  const missing = terms.filter((term) => !text.includes(term));
  assert.strictEqual(missing.length, 0, `${label} missing: ${missing.join(', ')}`);
}

const pages = {
  homeJs: read('miniprogram/pages/home/home.js'),
  homeWxml: read('miniprogram/pages/home/home.wxml'),
  tutorJs: read('miniprogram/pages/tutor/tutor.js'),
  tutorWxml: read('miniprogram/pages/tutor/tutor.wxml'),
  uploadJs: read('miniprogram/pages/upload/upload.js'),
  uploadWxml: read('miniprogram/pages/upload/upload.wxml'),
  reviewWxml: read('miniprogram/pages/review/review.wxml'),
  focusWxml: read('miniprogram/pages/focus/focus.wxml'),
  toolsWxml: read('miniprogram/pages/tools/tools.wxml'),
  arcadeJs: read('miniprogram/pages/arcade/arcade.js'),
  arcadeWxml: read('miniprogram/pages/arcade/arcade.wxml'),
  profileJs: read('miniprogram/pages/profile/profile.js'),
  profileWxml: read('miniprogram/pages/profile/profile.wxml'),
  focusJs: read('miniprogram/pages/focus/focus.js'),
  reviewJs: read('miniprogram/pages/review/review.js'),
  toolsJs: read('miniprogram/pages/tools/tools.js'),
  homeViewModelJs: read('miniprogram/view-models/home-view-model.js'),
  storageJs: read('miniprogram/utils/storage.js'),
  focusCabinJs: read('miniprogram/utils/focus-cabin.js'),
  reviewCardsJs: read('miniprogram/utils/review-cards.js'),
  reportJs: read('miniprogram/utils/learning-report.js'),
  reportRecognitionJs: read('miniprogram/utils/learning-report-recognition.js')
};

assert(pages.homeJs.includes('learningLoopCards'), 'Home defines the core product capability map');
includesAll(
  pages.homeWxml + pages.homeJs,
  ['咕点能陪你的四件事', '今晚作业没思路', '坐不住，想分心', '之前错题又卡了', '想练一小会'],
  'Home core capability map'
);
const homeLoopCardsBlock = pages.homeJs.slice(
  pages.homeJs.indexOf('learningLoopCards'),
  pages.homeJs.indexOf('parentClassroom')
);
assert(!homeLoopCardsBlock.includes('goUpload'), 'Home core capability map does not make upload/material the main entry');
assert(pages.homeJs.includes('showLightTools: false'), 'Home keeps daily light tools closed by default');
assert(pages.homeJs.includes('toggleLightTools'), 'Home can reveal lightweight tools only on demand');
assert(pages.homeWxml.includes('light-entry-grid" wx:if="{{showLightTools}}"'), 'Home gates light tool matrix behind explicit toggle');
assert(pages.homeWxml.includes('有空再做轻练习'), 'Home copy treats light tools as secondary');
includesAll(
  pages.homeViewModelJs,
  [
    'buildPrimaryHomeNextAction',
    "type: 'report_action'",
    "type: 'mini_lesson'",
    "type: 'review_return'",
    "type: 'share_return'",
    "type: 'first_step'",
    'priority'
  ],
  'Home view model owns the unified next-step priority'
);
assert(
  pages.homeWxml.includes('homeViewModel.primaryNextAction')
  && pages.homeJs.includes('primaryNextAction'),
  'Home first screen renders the single primary next action from the view model'
);
assert(
  pages.homeWxml.indexOf('homeViewModel.primaryNextAction') < pages.homeWxml.indexOf('learningLoopCards'),
  'Home primary next action appears before capability cards'
);

includesAll(
  pages.tutorWxml,
  ['作业点拨', '咕点用追问陪你说第一步', '不直接讲答案', '带着这一小步去专注', '把卡点整理成错题卡'],
  'Tutor positioning'
);
includesAll(pages.tutorJs, ['goFocus()', "navigation.navigateLearningRoute('/pages/focus/focus')", 'goReview()'], 'Tutor flow methods');

includesAll(
  pages.uploadWxml,
  ['材料入口', '把作业、错题、材料变成今晚路线和可回访卡', '生成今晚路线', '去修卡点', '生成轻练习'],
  'Upload positioning'
);
assert(pages.uploadJs.includes('/pages/tutor/tutor?from=upload'), 'Upload routes normal homework into Socratic tutor');
assert(pages.uploadJs.includes('/pages/review/review'), 'Upload routes wrong questions into review');

includesAll(
  pages.reviewWxml,
  ['错题修复', '错题不是抄进本子', '下次先检查什么', '修完进入轻回访或小游戏'],
  'Review positioning'
);
assert(pages.reviewWxml.includes('goTools'), 'Review can route repaired card into light revisit');
assert(pages.reviewWxml.includes('goFocus'), 'Review can route first-step confirmation into focus cabin');

includesAll(
  pages.focusWxml,
  ['专注舱', '围绕这一小步坐一段', '留下孩子真的开始过的证据', '给家长一行复盘'],
  'Focus positioning'
);
assert(pages.focusWxml.includes('goProfile'), 'Focus completion can route to parent recap');
assert(pages.focusWxml.includes('goReview'), 'Focus empty/manual state can route back to repair');

includesAll(
  pages.toolsWxml,
  ['轻回访与练习', '回看昨天那一步', '错题和材料变成可练的小卡', '小游戏只是激励', '错的卡会回到复习队列'],
  'Tools positioning'
);
assert(!pages.toolsWxml.includes('<block wx:if="{{false}}">'), 'Tools exposes game/material loop instead of hiding it');
assert(pages.toolsWxml.includes('playgroundGames'), 'Tools exposes game cards for motivation');
assert(pages.toolsWxml.includes('class="material-panel"'), 'Tools exposes material/wrong-question practice generation');
assert(pages.toolsWxml.includes('{{toolsViewModel.primaryCard.title}}'), 'Tools first screen stays focused on revisit evidence');

includesAll(
  pages.arcadeWxml,
  ['游戏化轻练习', '玩一小局，错的卡回到复习队列', '错题和模糊点会回到修卡点'],
  'Arcade positioning'
);
assert(pages.arcadeJs.includes('wrongAnswers'), 'Arcade keeps wrong answers as review evidence');
assert(pages.arcadeJs.includes('goReview()'), 'Arcade can send missed cards back to review');
assert(pages.arcadeJs.includes('/pages/tutor/tutor?from=arcade'), 'Arcade can send stuck child back to Socratic tutor');
assert(pages.arcadeWxml.includes('challengeBrief') && pages.arcadeWxml.includes('本局目标'), 'Arcade shows adaptive challenge goals instead of hiding game mechanics');
assert(pages.arcadeWxml.includes('目标回看') && pages.arcadeJs.includes('resultLine'), 'Arcade closes each round with goal feedback');
assert(pages.arcadeWxml.includes('challengeBrief.rewardLine') && pages.arcadeJs.includes('rewardLine'), 'Arcade explains what record the quest writes back');
assert(pages.arcadeJs.includes('dailyReturnContract') && pages.arcadeWxml.includes('dailyReturnContract.loop'), 'Arcade exposes the daily return contract as a visible retention loop');
assert(pages.arcadeJs.includes('daily_return_contract_blocked_fields') && pages.arcadeWxml.includes('本地代码决定回访节奏、奖励放行、画像放行和分享字段'), 'Arcade records and explains the local-code vs AI boundary for daily return');

const firstScreenStart = pages.profileWxml.indexOf('<view class="rc14-profile-first-screen">');
const firstScreenEnd = pages.profileWxml.indexOf('<view class="rc14-profile-after-first-screen">');
const firstScreen = pages.profileWxml.slice(firstScreenStart, firstScreenEnd);
includesAll(
  pages.profileWxml,
  ['家长复盘', '家长今晚只问一句', '刚才你第一步先看了哪里', '5 秒行动卡', '听一句、问一句、明天回访', '今晚卡住', '第一步证据', '明天回访', '最近小结'],
  'Profile positioning'
);
assert(firstScreen.includes('profileSafeSummary'), 'Profile first screen leads with the friend-safe local recap');
assert(firstScreen.includes('parentActionChecklist') && firstScreen.includes('evidenceBoundaryLine'), 'Profile first screen compresses parent recap into action checklist and evidence boundary');
assert(firstScreen.includes('{{profileViewModel.primaryCta}}'), 'Profile first screen keeps one core action');
assert(!pages.profileWxml.includes('subscriptionWeeklySummary'), 'Profile hides subscription pain card in friend-safe shell');
assert(!firstScreen.includes('生成本周小结图'), 'Profile default first screen does not lead with share image generation');
assert(!firstScreen.includes('邀请另一位家长查看'), 'Profile default first screen does not lead with viral invite');
assert(!pages.profileWxml.includes('subscriptionState'), 'Subscription preview is hidden for friend-safe trials');
assert(pages.profileWxml.includes('isDevMode && isBetaTester'), 'Trial checklist is dev-only');
includesAll(
  pages.profileWxml + pages.profileJs,
  ['录入成绩/测评', '孩子测评与学习方法建议', '推荐孩子该先用哪个能力', '用咕点追问', '去修卡点'],
  'Profile assessment and method recommendation entry'
);
assert(pages.profileWxml.includes('parentConversationPlan') && pages.profileWxml.includes('shareOutcome'), 'Profile share card shows parent conversation and next-day outcome');
assert(pages.profileWxml.includes('thinkingProbeLine') && pages.profileJs.includes('diagnosticProbes'), 'Profile parent recap includes tutor diagnostic evidence');
assert(pages.profileJs.includes('parentNextAction') && pages.homeJs.includes('parent_next_action'), 'Share activation carries next parent action into the landing flow');
assert(pages.homeWxml.includes('incomingShare.action_label') && pages.homeJs.includes('action=${incoming.parent_next_action'), 'Incoming share landing keeps the next action visible and routed');
assert(pages.profileWxml.includes('追问回执') && pages.storageJs.includes('buildTransferPracticeSet'), 'Profile depth loop includes transfer practice and parent reflection receipts');
assert(pages.profileWxml.includes('一周归因') && pages.storageJs.includes('buildLearningDecisionPath'), 'Profile depth loop includes weekly pattern and next-action decisioning');
assert(pages.profileWxml.includes('掌握度') && pages.profileWxml.includes('干预打法') && pages.profileWxml.includes('结果复核'), 'Profile depth loop includes mastery, intervention, and outcome review');

assert(pages.storageJs.includes('buildUnifiedNextActionController') && pages.homeJs.includes('unifiedNextAction') && pages.profileJs.includes('unifiedNextAction'), 'Global product depth has one controller that arbitrates the next action across modules');
assert(
  pages.tutorJs.includes('unifiedNextAction') && pages.tutorWxml.includes('runUnifiedNextAction')
  && pages.uploadJs.includes('unifiedNextAction') && pages.uploadWxml.includes('runUnifiedNextAction')
  && pages.reviewJs.includes('unifiedNextAction') && pages.reviewWxml.includes('runUnifiedNextAction'),
  'Tutor, upload, and review expose the same unified next-action controller instead of local-only next steps'
);
assert(
  pages.tutorJs.includes("recordUnifiedNextAction(Object.assign({}, next, { surface: 'tutor' })")
  && pages.uploadJs.includes("recordUnifiedNextAction(Object.assign({}, next, { surface: 'upload' })")
  && pages.reviewJs.includes("recordUnifiedNextAction(Object.assign({}, next, { surface: 'review' })"),
  'Tutor, upload, and review persist unified next-action execution evidence with surface labels'
);
assert(
  pages.uploadJs.includes('saveLearningReportState')
  && pages.homeJs.includes('reportServiceResume')
  && pages.homeViewModelJs.includes("type: 'report_action'"),
  'Uploaded report state returns to Home as a primary report action'
);

[
  {
    name: 'upload intake',
    surface: pages.uploadJs + pages.uploadWxml,
    required: ['homeworkText', 'previewPlan', 'saveTodayFocusFromThought', 'saveLearningReportState', 'goReview', 'goTools']
  },
  {
    name: 'tutor first step',
    surface: pages.tutorJs + pages.tutorWxml,
    required: ['saveChildArticulatedStep', 'goFocus', 'goReview', 'nextAction', 'diagnostic_probe', 'transfer_prompt', '这轮怎么追问']
  },
  {
    name: 'focus cabin',
    surface: pages.focusJs + pages.focusWxml + pages.focusCabinJs,
    required: ['canStartFocusFromTodaySession', 'completeSession', 'recordFocusSessionEvidence', 'goProfile']
  },
  {
    name: 'review repair',
    surface: pages.reviewJs + pages.reviewWxml,
    required: ['updateTodayFocusRepair', 'finishQuizAttempt', 'goTools', 'goFocus']
  },
  {
    name: 'tools practice',
    surface: pages.toolsJs + pages.toolsWxml + pages.reviewCardsJs,
    required: ['previewImport', 'importTextToDeck', 'goArcade', 'goReview']
  },
  {
    name: 'arcade motivation',
    surface: pages.arcadeJs + pages.arcadeWxml,
    required: ['wrongAnswers', 'nextPracticePlan', 'gameEvidence', 'goReview', 'adaptiveChallenge', 'dailyQuestSet']
  },
  {
    name: 'profile report',
    surface: pages.profileJs + pages.profileWxml,
    required: ['recognizeLearningReportInput', 'generateLearningReport', 'goLearningReportCta', 'learningReportSummary', '行动闭环', 'nextEvidenceLine', '结论依据', 'solutionConfidence']
  },
  {
    name: 'report engine',
    surface: pages.reportJs + pages.reportRecognitionJs + pages.storageJs,
    required: ['requiresConfirmation', 'confidence', 'missing', 'recommendationPlan', 'connectLearningReportToLocalLoop', 'localLoopConnection', 'reportSolution', 'learning_report_solution_connected', 'buildAcceptanceReport']
  }
].forEach((contract) => {
  includesAll(contract.surface, contract.required, `${contract.name} capability contract`);
});

const visibleSurface = [
  pages.homeWxml,
  pages.tutorWxml,
  pages.uploadWxml,
  pages.reviewWxml,
  pages.focusWxml,
  pages.toolsWxml,
  pages.arcadeWxml,
  pages.profileWxml
].join('\n');
['保证提分', '拍照出答案', '秒解', '答案已生成', '替代老师', '替代家长', '排名', 'PK', '冲榜', '必须打卡', '付费', '服务方案', '报告墙'].forEach((term) => {
  assert(!visibleSurface.includes(term), `Forbidden visible claim found: ${term}`);
});

console.log('All product convergence tests pass.');
