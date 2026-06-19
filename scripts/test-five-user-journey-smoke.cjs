#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function includes(rel, text, note) {
  assert(read(rel).includes(text), `${rel}: ${note || `missing ${text}`}`);
}

function matches(rel, pattern, note) {
  assert(pattern.test(read(rel)), `${rel}: ${note || `missing ${pattern}`}`);
}

const uploadWxml = 'miniprogram/pages/upload/upload.wxml';
const uploadJs = 'miniprogram/pages/upload/upload.js';
const tutorWxml = 'miniprogram/pages/tutor/tutor.wxml';
const tutorJs = 'miniprogram/pages/tutor/tutor.js';
const reviewWxml = 'miniprogram/pages/review/review.wxml';
const reviewJs = 'miniprogram/pages/review/review.js';
const profileWxml = 'miniprogram/pages/profile/profile.wxml';
const profileJs = 'miniprogram/pages/profile/profile.js';
const entryDetailJs = 'miniprogram/pages/entry-detail/entry-detail.js';

// 1. Parent first upload: main visual submits material, then the generated report opens the parent lane.
assert(!read(uploadWxml).includes('class="yd-upload-hero" bindtap="submit"'), `${uploadWxml}: upload hero stays visual instead of becoming a duplicate submit action`);
includes(uploadWxml, 'class="yd-upload-primary" bindtap="submit"', 'upload primary CTA submits');
includes(uploadWxml, 'viewLatestReport', 'upload exposes report viewing after generation');
includes(uploadWxml, 'openMaterialReportPanel', 'upload can collect parent observation evidence without adding a secondary explainer card');
assert(!read(uploadWxml).includes('upload-material-card'), `${uploadWxml}: upload no longer stacks secondary explainer cards below the hero`);
assert(!read(uploadWxml).includes('data-scene="today" bindtap="openEntryDetail"'), `${uploadWxml}: upload does not expose retired tonight route entry`);
includes(uploadJs, "afterPrioritySaved(text, nextState, nextState.homework_plan, 'server')", 'submit handles server priority result');
includes(uploadJs, "afterPrioritySaved(text, nextState, plan, 'local')", 'submit has local fallback for first upload');
includes(uploadJs, "navigation.navigateLearningRoute((latestReportCta && latestReportCta.route) || '/pages/profile/profile?from=upload')", 'first upload leads to parent report with fallback route');
includes(uploadJs, "navigation.navigateLearningRoute((latestReportCta && latestReportCta.route) || '/pages/profile/profile?from=upload_material_ready')", 'material import leads to parent report with fallback route');
includes(uploadJs, 'requestAiMaterialAnalysis(uploadIntakePacket, structuredEvidenceSignals', 'upload calls material analysis when evidence exists');
includes(entryDetailJs, 'upload: {', 'entry-detail has upload scene');
includes(entryDetailJs, "primaryRoute: '/pages/upload/upload?from=entry_upload_file&open=flow'", 'entry upload primary route opens material flow');
includes(entryDetailJs, "secondaryRoute: '/pages/profile/profile?from=entry_upload_quiz&panel=assessment&quick_assessment=1'", 'entry upload secondary route opens parent assessment/report');

// 2. Child enters tutoring: the first-step controls call the tutor flow and message API.
includes(tutorWxml, 'bindtap="openTutorScene"', 'tutor has tappable AI workspace entry controls');
includes(tutorWxml, 'class="tutor-mode-grid"', 'tutor uses focused Socratic mode controls');
includes(tutorWxml, 'class="tutor-chat-card"', 'tutor keeps the usable chat workspace');
includes(tutorJs, 'openTutorScene(event)', 'tutor can open a scene before sending');
matches(tutorJs, /\blaunchFirstStep\(event\)\s*\{[\s\S]*this\.send\(\);/, 'explicit in-scene launchFirstStep sends the first-step message');
includes(tutorJs, 'api.sendTutorMessage({', 'tutor sends through the tutor API wrapper');
includes(tutorJs, "from === 'entry_tutor_first_step'", 'tutor consumes tutor child-flow route context');
includes(entryDetailJs, 'tutor: {', 'entry-detail has tutor scene');
includes(entryDetailJs, "primaryRoute: '/pages/tutor/tutor?from=entry_tutor_first_step&scene=pointing&open=flow'", 'entry tutor primary route opens tutor flow');
includes(entryDetailJs, "secondaryRoute: '/pages/review/review?from=entry_tutor_card&stage=tool'", 'entry tutor secondary route goes to revisit');

// 3. Knowledge Park: review can start core games or practice-pack deliverables, self-grade it, and consume entry-detail recall-return context.
matches(reviewWxml, /class="review-main-cta"[\s\S]*?wx:if="\{\{reviewFlowStage === 'tool'\}\}"[\s\S]*?bindtap="startSelectedPlayableReviewTool"[\s\S]*?\{\{selectedPlayableReviewToolStartText\}\}<\/view>/, 'review main CTA starts the selected playable Knowledge Park round');
includes(reviewWxml, 'data-id="{{item.id}}" bindtap="selectPlayableReviewTool"', 'review real-card action selects an in-page playable tool');
includes(reviewJs, 'startSelectedPlayableReviewTool()', 'review starts the selected in-page playable tool');
['错因地鼠', '快闪问答', '闪卡翻翻', '拼图配对', '路线接龙', 'UNO错因卡', '变式三连', '打印练习单'].forEach((label) => {
  includes(reviewJs, label, `Knowledge Park exposes core game data: ${label}`);
});
includes(reviewJs, "const toolIds = ['whack', 'quiz', 'flashcard', 'match', 'snake', 'uno', 'variant', 'print'];", 'review keeps the eight core Knowledge Park play ids');
includes(reviewJs, 'tool.templateOnly', 'review routes non-engine plays into practice-pack deliverables');
includes(reviewJs, 'runTemplateDeliverable', 'review has a real handoff for template-only Knowledge Park plays');
includes(reviewWxml, 'review-template-workbench', 'review exposes a compact practice-pack workbench');
['review-whack-board', 'review-match-board', 'review-snake-board'].forEach((term) => {
  assert(!reviewWxml.includes(term), `review journey does not expose demo-like game board: ${term}`);
});
['again', 'hard', 'easy'].forEach((rating) => {
  includes(reviewWxml, `data-rating="${rating}" bindtap="rate"`, `opened review tool exposes self-grade action: ${rating}`);
});
includes(reviewWxml, 'data-result="remembered" bindtap="finishPlayableReviewTool"', 'opened review tool exposes reference first-step completion action');
includes(reviewJs, 'reference_live_first_step_button', 'reference first-step completion writes review evidence');
includes(reviewJs, 'reveal()', 'review keeps reveal behavior in page logic');
includes(reviewJs, 'rate(event)', 'review keeps rating behavior in page logic');
includes(reviewJs, 'buildEntryReviewContext(query = {})', 'review builds entry-detail context');
includes(reviewJs, "mode === 'recall_return'", 'review handles recall-return mode');
includes(reviewJs, 'api.generateQuiz({', 'review reveal path can generate quiz content');
includes(entryDetailJs, 'review: {', 'entry-detail has review scene');
includes(entryDetailJs, "primaryRoute: '/pages/review/review?mode=recall_return&from=entry_review&stage=topic'", 'entry review primary route opens recall-return');
includes(entryDetailJs, "secondaryRoute: '/pages/tutor/tutor?from=entry_review_repair&scene=stuck'", 'entry review secondary route repairs in tutor');

// 4. Growth report: main screen collects evidence; preview/action subpages carry execution and writeback.
includes(profileWxml, 'class="growth-choice-grid" wx:if="{{growthActiveScene === \'main\'}}"', 'growth report main screen starts with questionnaire/upload choices');
includes(profileWxml, 'class="growth-report-preview" wx:if="{{growthActiveScene === \'preview\'}}"', 'growth report preview is a dedicated evidence state');
includes(profileWxml, 'data-action="upload" bindtap="runParentReportAction">补充材料让报告更准', 'growth report preview can add more material');
includes(profileWxml, 'data-action="tutor" bindtap="runParentReportAction">去AI私教', 'growth report preview routes to AI tutor');
includes(profileWxml, 'data-action="review" bindtap="runParentReportAction">知识乐园', 'growth report preview routes to Knowledge Park');
includes(profileWxml, 'class="growth-parent-action-card" wx:if="{{growthActiveScene === \'action\'}}"', 'growth parent action card is a dedicated follow-through state');
includes(profileWxml, 'bindtap="completeParentActionCard"', 'growth parent action completion is tappable');
includes(profileJs, 'completeParentActionCard()', 'profile writes back parent action completion');
includes(profileJs, 'parent_action_card_completed', 'profile records parent action evidence');
includes(profileJs, 'applyRouteOptions(query = {})', 'parent page consumes route options');
includes(profileJs, "from === 'entry_report_evidence'", 'parent opens report evidence from entry-detail');
includes(profileJs, "from === 'entry_upload_quiz'", 'parent opens quick assessment from upload child-flow');
includes(profileJs, "reportPreview: this.buildParentEvidenceRoute(this.data.learningReportSummary || {}, 'parent_report')", 'parent report preview uses contextual evidence routing');
includes(profileJs, "panel: 'report'", 'parent report preview opens the in-tab report panel when evidence context exists');
includes(profileJs, '/pages/entry-detail/entry-detail?scene=parent', 'parent report preview keeps detail only as empty-context fallback');
includes(entryDetailJs, 'parent: {', 'entry-detail has parent scene');
includes(entryDetailJs, "primaryRoute: '/pages/profile/profile?from=entry_parent_report&panel=action&open=flow'", 'entry parent primary route opens parent report flow');
includes(entryDetailJs, "secondaryRoute: '/pages/upload/upload?from=entry_parent_material'", 'entry parent secondary route returns to material upload');

// 5. Core workflow evidence: material input -> prompt workflow -> practice workshop -> parent-safe report preview status.
includes(uploadWxml, 'data-workflow="source"', 'upload workflow exposes material source action');
includes(uploadWxml, 'data-workflow="modules"', 'upload workflow exposes module route action');
includes(uploadWxml, 'data-workflow="preview"', 'upload workflow exposes report preview action');
includes(uploadWxml, 'parentReportWorkflowView.loopLine', 'upload workflow explains report -> tutor -> review -> parent decision loop');
includes(uploadJs, '成长报告 -> AI私教 -> 知识乐园 -> 成长报告', 'upload report CTA stores the closed-loop path for parent-readable follow-through');
includes(uploadJs, '报告预览可先查看，完整图稿稍后自动补齐', 'upload explains report artwork status without provider/key copy');
assert(!read(uploadJs).includes('OPENAI_API_KEY') && !read(profileJs).includes('OPENAI_API_KEY'), 'upload/profile do not expose provider key state');
assert(!read(uploadJs).includes('Image 2') && !read(profileJs).includes('Image 2'), 'upload/profile do not expose internal artwork stage names');
includes(tutorJs, 'socratic_prompt_workflow', 'tutor persists Socratic prompt workflow evidence');
includes(tutorJs, "capabilityId: 'socratic_prompt_to_review'", 'tutor routes prompt workflow into review');
assert(!read(reviewWxml).includes('练习单生成器') && !read(reviewWxml).includes('课堂互动工具') && !read(reviewWxml).includes('自主练习'), 'review visible surface does not reintroduce abstract category lanes');
includes(reviewJs, 'runPlayableReviewTool(event)', 'review starts playable Knowledge Park tools');
includes(reviewJs, 'finishPlayableReviewTool(event)', 'review records one Knowledge Park round');
includes(reviewJs, 'selectWhackChoice(event)', 'review supports the whack-a-wrong-cause interaction');
includes(profileJs, 'resolveReportJobCaseId(reportState = {})', 'profile resolves a report case id for artwork status');
includes(profileJs, 'refreshReportJobStatus(caseId = \'default\')', 'profile refreshes report image status instead of only showing static wait copy');
includes(profileJs, 'api.fetchReportJobStatus(caseId)', 'profile queries the report job status API');
includes(profileJs, 'learningReportSummary.parentReportWorkflowImageLine', 'profile writes status results into the visible report artwork line');
includes(profileJs, 'remote_status_unavailable', 'profile has fallback copy when remote image status is unavailable');

console.log('Five user journey smoke passed: upload, tutor, review, parent recap, and report workflow evidence.');
