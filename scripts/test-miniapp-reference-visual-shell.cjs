#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const referenceRoot = path.join(os.homedir(), 'Desktop', '\u5c0f\u7a0b\u5e8f');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function includes(source, term, message) {
  assert(source.includes(term), message || `missing ${term}`);
}

function excludes(source, term, message) {
  assert(!source.includes(term), message || `unexpected ${term}`);
}

const referenceHtml = fs.readdirSync(referenceRoot).filter((name) => name.endsWith('.html'));
assert.strictEqual(referenceHtml.length, 15, 'reference library keeps the 15 designed HTML screens');
referenceHtml.forEach((name) => {
  const target = path.join(referenceRoot, name);
  assert(fs.statSync(target).size > 1000, `reference HTML is non-empty: ${name}`);
});

const tutorWxml = read('miniprogram/pages/tutor/tutor.wxml');
const tutorWxss = read('miniprogram/pages/tutor/tutor.wxss');
const tutorJs = read('miniprogram/pages/tutor/tutor.js');
const reviewWxml = read('miniprogram/pages/review/review.wxml');
const reviewWxss = read('miniprogram/pages/review/review.wxss');
const reviewJs = read('miniprogram/pages/review/review.js');
const profileWxml = read('miniprogram/pages/profile/profile.wxml');
const profileWxss = read('miniprogram/pages/profile/profile.wxss');
const profileJs = read('miniprogram/pages/profile/profile.js');
const uploadWxml = read('miniprogram/pages/upload/upload.wxml');
const uploadWxss = read('miniprogram/pages/upload/upload.wxss');
const tabbarWxss = read('miniprogram/custom-tab-bar/index.wxss');

[
  [tutorWxss, '.yd-tutor-screen', 'transparent'],
  [reviewWxss, '.yd-review-screen', '#f7f8fa'],
  [profileWxss, '.yd-parent-screen', '#f8faf5']
].forEach(([source, selector, color]) => {
  includes(source, selector, `${selector} exists`);
  includes(source, 'border-radius: 0;', `${selector} uses a full-screen app canvas`);
  includes(source, `background: ${color};`, `${selector} keeps the reference app background`);
  assert(!new RegExp(`${selector.replace('.', '\\.')}\\s*\\{[\\s\\S]{0,260}border:\\s*1rpx`).test(source), `${selector} does not keep a framed shell border`);
});

// AI tutor main page and four child reference pages.
includes(tutorWxss, 'background: #f6f8f3;', 'AI tutor main screen uses the reference soft green background');
[
  'yd-tutor-top',
  'yd-tutor-hero',
  'tutor-chat-card',
  'tutor-input-bar',
  'tutor-mode-grid',
  'tutor-start-cta',
  'tutor-usage-note',
  'activeTutorScene === \'dialogue\'',
  'wx:for="{{messages}}"',
  'bindtap="send"',
  'bindtap="openTutorScene"'
].forEach((term) => includes(tutorWxml, term, `AI tutor keeps reference main structure: ${term}`));

[
  'grid-template-columns: 144rpx minmax(0, 1fr)',
  'min-height: 220rpx',
  'border-radius: 40rpx',
  '-webkit-line-clamp: 2',
  'grid-template-columns: repeat(4, minmax(0, 1fr))',
  'background: #14b8a6'
].forEach((term) => includes(tutorWxss, term, `AI tutor main style matches reference: ${term}`));

['dialogue', 'knowledge', 'pointing', 'stuck', 'recap'].forEach((scene) => {
  includes(tutorWxml, `activeTutorScene === '${scene}'`, `AI tutor scene is rendered: ${scene}`);
  includes(tutorWxss, `.tutor-reference-panel.${scene}`, `AI tutor scene has a dedicated visual shell: ${scene}`);
});

[
  'tutor-dialogue-top',
  'tutor-dialogue-composer',
  'tutor-blackboard-hero',
  'tutor-blackboard',
  'tutor-question-box',
  'tutor-question-media-row',
  'bindtap="attachTutorPhoto"',
  'tutor-pointing-mode-row',
  'tutor-stuck-action-grid',
  'tutor-stuck-journal',
  'tutor-stuck-footer',
  'tutor-recap-panel',
  'tutor-recap-card'
].forEach((term) => includes(tutorWxml, term, `AI tutor child reference element exists: ${term}`));

[
  '.yd-tutor-screen.detail-on .tutor-reference-panel.knowledge',
  '.yd-tutor-screen.detail-on .tutor-reference-panel.pointing',
  '.yd-tutor-screen.detail-on .tutor-reference-panel.stuck',
  '.tutor-reference-panel.knowledge > .tutor-reference-head',
  '.tutor-reference-panel.pointing > .tutor-reference-head',
  '.tutor-reference-panel.stuck > .tutor-reference-head',
  'min-height: calc(100vh - 292rpx',
  'padding: 0 8rpx 220rpx',
  'height: 108rpx',
  'padding: 0 0 214rpx',
  'padding: 0 0 216rpx',
  '.tutor-reference-panel.recap .tutor-recap-panel',
  '.tutor-reference-panel.recap .tutor-dialogue-actions'
].forEach((term) => includes(tutorWxss, term, `AI tutor child page is full-screen/reference-like: ${term}`));

[
  'send()',
  'launchFirstStep(event)',
  'runTutorReferenceAction(event)',
  'attachTutorPhoto()',
  'prepareTutorReviewHandoff(options = {})',
  "type: 'tutor_to_knowledge_park'",
  'storage.saveReviewCards([card].concat',
  'navigation.navigateLearningRoute(handoff.route)'
].forEach((term) => includes(tutorJs, term, `AI tutor capability is wired: ${term}`));

// Knowledge Park main and child pages.
includes(reviewWxss, '.review-page', 'Knowledge Park page root exists');
includes(reviewWxss, 'background: #f7f8fa;', 'Knowledge Park outer page uses the reference main background');
[
  'yd-review-screen',
  'wx:if="{{reviewFlowStage === \'main\'}}"><text wx:for="{{knowledgeChipTopics}}"',
  'review-main-tool-grid',
  'review-main-tool-card',
  'review-main-cta',
  'review-topic-toolbar',
  'review-tool-grid',
  'review-live-tool stage-{{reviewFlowStage}}',
  'review-finish-hero',
  'review-finish-bottom'
].forEach((term) => includes(reviewWxml, term, `Knowledge Park reference element exists: ${term}`));
['review-route-map'].forEach((term) => excludes(reviewWxml + reviewWxss, term, `Knowledge Park removes non-reference visible layer: ${term}`));
includes(reviewWxml, 'review-topic-search', 'Knowledge Park topic page keeps the reference search field');
assert(
  reviewWxml.indexOf('class="yd-review-hero"') < reviewWxml.indexOf('class="review-chip-row" wx:if="{{reviewFlowStage === \'main\'}}"')
    && reviewWxml.indexOf('class="review-chip-row" wx:if="{{reviewFlowStage === \'main\'}}"') < reviewWxml.indexOf('class="review-main-tool-grid"'),
  'Knowledge Park main chips sit between the hero and the 2x2 tool grid like the reference HTML'
);

[
  'border-radius: 0 0 48rpx 48rpx',
  'min-height: 330rpx',
  'grid-template-columns: repeat(2, minmax(0, 1fr))',
  'overflow-x: auto',
  '.yd-review-screen.stage-main > .review-main-cta',
  'bottom: calc(148rpx + env(safe-area-inset-bottom))',
  '.yd-review-screen.stage-topic .review-subpage-top text:nth-child(2)',
  'color: transparent',
  '.yd-review-screen.stage-topic .review-subpage-top text:last-child',
  'background: #ffe4d6',
  '.yd-review-screen.stage-topic .review-topic-cta',
  'display: none',
  '.yd-review-screen.stage-topic > .review-main-cta',
  'bottom: calc(112rpx + env(safe-area-inset-bottom))',
  '.yd-review-screen.stage-topic::after',
  '.yd-review-screen.stage-tool .review-flow-tabs',
  'display: none',
  '.yd-review-screen.stage-tool > .review-main-cta',
  'border-radius: 16rpx',
  '.yd-review-screen.stage-tool::after',
  '.yd-review-screen.stage-tool .review-target-card::before',
  '.yd-review-screen.stage-tool .review-template-workbench',
  '.yd-review-screen.stage-live .review-subpage-top',
  '.yd-review-screen.stage-live .review-record-panel',
  '.yd-review-screen:not(.stage-main) .review-flow-tabs text',
  '.review-live-tool.stage-live',
  '.review-finish-bottom'
].forEach((term) => includes(reviewWxss, term, `Knowledge Park style matches reference: ${term}`));

[
  'bindtap="closeReviewSubpage">×</text>',
  '{{activeReviewTool.itemCount || 3}}',
  '{{activeReviewTool.primary.label ||',
  '{{activeReviewTool.primary.prompt ||',
  '{{activeReviewTool.primary.check ||'
].forEach((term) => includes(reviewWxml, term, `Knowledge Park live game uses real active card data: ${term}`));

[
  'buildVisiblePlayableReviewTools',
  'selectPlayableReviewTool(event)',
  'startSelectedPlayableReviewTool()',
  'runPlayableReviewTool(event)',
  'finishPlayableReviewTool(event)',
  "reviewFlowStage: 'live'",
  "const toolIds = ['whack', 'quiz', 'flashcard', 'match', 'snake', 'uno', 'variant', 'print'];",
  'this.runTemplateDeliverable'
].forEach((term) => includes(reviewJs, term, `Knowledge Park capability is wired: ${term}`));

// Growth Report main page and four child reference pages.
[
  'yd-parent-screen',
  'class="yd-parent-top" wx:if="{{growthActiveScene === \'main\'}}"',
  '<view class="yd-parent-title"><text>',
  '</text><text>',
  'class="yd-parent-sub"',
  'growth-choice-grid',
  'growth-choice-card',
  'growth-progress-card',
  'growth-questionnaire-panel',
  'growth-subpage-nav questionnaire',
  'growth-questionnaire-progress nav',
  'growth-questionnaire-progress body" wx:if="{{false}}"',
  'growth-upload-panel',
  'growth-report-preview',
  'growth-parent-action-card',
  'growth-main-cta',
  'bindtap="startGrowthQuestionnaire"',
  'bindtap="runParentReportAction"',
  'bindtap="generateLearningReport"'
].forEach((term) => includes(profileWxml, term, `Growth Report reference element exists: ${term}`));

[
  'font-size: 56rpx',
  '.yd-parent-title text',
  'height: 220rpx',
  'min-height: 220rpx',
  'border-radius: 44rpx',
  'padding: 0 0 0 52rpx',
  'left: -52rpx',
  '.yd-parent-screen.scene-main .growth-main-cta',
  'position: fixed',
  'bottom: calc(148rpx + env(safe-area-inset-bottom))',
  '.yd-parent-screen.scene-questionnaire > .growth-flow-tabs',
  'display: none',
  '.growth-questionnaire-progress.nav',
  'background: linear-gradient(180deg, rgba(248, 250, 245, 0), #f8faf5 46%, #f8faf5)',
  '.yd-parent-screen:not(.scene-main) .growth-flow-tabs text',
  '.growth-report-card-head',
  '.growth-parent-bottom-actions'
].forEach((term) => includes(profileWxss, term, `Growth Report style matches reference: ${term}`));

[
  'buildGrowthQuestionUiState',
  'continueGrowthQuestionnaire()',
  'toggleParentActionItem(event)',
  'shareGrowthReportPreview()',
  'remindParentActionLater',
  'uploadPage',
  'generateLearningReport',
  'buildParentEvidenceRoute'
].forEach((term) => includes(profileJs, term, `Growth Report capability is wired: ${term}`));

// Standalone upload remains a real material intake page owned by Growth Report.
includes(uploadWxss, 'background: #f8fafc;', 'Standalone upload uses the reference cool report subpage background');
[
  'upload-evidence-grid',
  'upload-evidence-card primary',
  '/assets/reference/upload-folder-stack-transparent.png',
  'upload-intake-workbench',
  'bindtap="chooseImage"',
  'bindtap="submit"'
].forEach((term) => includes(uploadWxml, term, `Upload reference/capability element exists: ${term}`));
includes(uploadWxss, '.upload-evidence-grid', 'Upload evidence grid has dedicated style');
includes(uploadWxss, 'grid-template-columns: repeat(2, minmax(0, 1fr))', 'Upload grid follows two-column reference layout');

// Shared shell and retired UI guard.
includes(tabbarWxss, 'left: 0;', 'custom tabbar is full-width');
includes(tabbarWxss, 'right: 0;', 'custom tabbar is full-width');
includes(tabbarWxss, 'border-top:', 'custom tabbar keeps reference divider');
excludes(tabbarWxss, 'left: 20rpx', 'custom tabbar does not regress to a floating capsule');
excludes(tabbarWxss, 'right: 20rpx', 'custom tabbar does not regress to a floating capsule');

const activeUi = [
  tutorWxml,
  tutorWxss,
  reviewWxml,
  reviewWxss,
  profileWxml,
  profileWxss,
  uploadWxml,
  uploadWxss
].join('\n');

[
  'ux-kit',
  'ux-entry',
  'module-v1',
  'v1-',
  'arcade',
  'mole-',
  '\u6392\u884c\u699c',
  '\u5546\u5e97',
  '\u52cb\u7ae0',
  '\u95ef\u5173',
  '\u7ec3\u4e60\u5355\u751f\u6210\u5668',
  '\u8bfe\u5802\u4e92\u52a8\u5de5\u5177',
  '\u5b66\u751f\u81ea\u4e3b\u7ec3\u4e60'
].forEach((term) => excludes(activeUi, term, `retired UI/product wording must not return: ${term}`));

console.log('Miniapp reference visual shell contract passed.');
