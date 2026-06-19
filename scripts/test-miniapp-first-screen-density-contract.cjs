const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const pageBudgets = [
  { id: 'upload', file: 'miniprogram/pages/upload/upload.wxml', maxLines: 95, maxViews: 40, maxWxFor: 1, scrollY: 1, scrollX: 0, shell: 'yd-upload-screen' },
  { id: 'tutor', file: 'miniprogram/pages/tutor/tutor.wxml', maxLines: 115, maxViews: 84, maxWxFor: 2, scrollY: 1, scrollX: 0, shell: 'yd-tutor-screen' }, // views budget raised: text cannot act as grid/flex layout container in WeChat, converted to view for correct rendering
  { id: 'review', file: 'miniprogram/pages/review/review.wxml', maxLines: 118, maxViews: 82, maxWxFor: 8, scrollY: 1, scrollX: 0, shell: 'yd-review-screen' }, // budgets raised for Blooket-style settlement replay + saved-template reuse rows (real subpage features, not first-screen box stacking)
  { id: 'profile', file: 'miniprogram/pages/profile/profile.wxml', maxLines: 125, maxViews: 92, maxWxFor: 3, scrollY: 1, scrollX: 0, shell: 'yd-parent-screen' },
  { id: 'entry-detail', file: 'miniprogram/pages/entry-detail/entry-detail.wxml', maxLines: 70, maxViews: 28, maxWxFor: 3, scrollY: 0, scrollX: 0, shell: 'entry-detail-page', focus: 'entry-focus-card' }
];

const forbiddenVisibleTerms = [
  'arcade',
  'ux-kit',
  'ux-entry',
  'module-v1',
  'v1-',
  'mole-',
  'subcheck',
  '挑战',
  '闯关',
  '复习岛',
  '勋章',
  '奖励',
  '排行榜',
  '商店'
];

function count(pattern, source) {
  return (source.match(pattern) || []).length;
}

function nonEmptyLineCount(source) {
  return source.split(/\r?\n/).filter((line) => line.trim()).length;
}

pageBudgets.forEach((page) => {
  const source = fs.readFileSync(path.join(root, page.file), 'utf8');
  const reviewJs = page.id === 'review'
    ? fs.readFileSync(path.join(root, 'miniprogram/pages/review/review.js'), 'utf8')
    : '';
  const lines = nonEmptyLineCount(source);
  const viewCount = count(/<view\b/g, source);
  const wxForCount = count(/\bwx:for\s*=/g, source);
  const scrollYCount = count(/<scroll-view\b[^>]*\bscroll-y\b/g, source);
  const scrollXCount = count(/<scroll-view\b[^>]*\bscroll-x\b/g, source);

  assert(lines <= page.maxLines, `${page.id} WXML stays compact enough for a first-screen shell: ${lines}/${page.maxLines}`);
  assert(viewCount <= page.maxViews, `${page.id} avoids returning to dense box-stacking: ${viewCount}/${page.maxViews}`);
  assert(wxForCount <= page.maxWxFor, `${page.id} avoids long dynamic lists on the primary surface: ${wxForCount}/${page.maxWxFor}`);
  assert.strictEqual(scrollYCount, page.scrollY, `${page.id} keeps the expected vertical scroll shell count`);
  assert.strictEqual(scrollXCount, page.scrollX, `${page.id} keeps the expected horizontal scene switch count`);
  assert(source.includes(page.shell), `${page.id} keeps the new reference-style shell: ${page.shell}`);
  if (page.focus) {
    assert(source.includes(page.focus), `${page.id} keeps the focused current-function card: ${page.focus}`);
  }

  if (page.id === 'review') {
    assert(source.includes('review-main-tool-icon') && source.includes('review-main-tool-time'), 'review added view budget is reserved for the reference icon/time game cards');
    assert(source.includes('review-tool-grid') && source.includes('review-live-tool') && source.includes('review-live-actions'), 'review wx:for budget is reserved for real-card knowledge-park games');
    assert(source.includes('review-game-progress') && source.includes('review-game-bar'), 'review added view budget is reserved for the reference in-game progress state');
    assert(source.includes('review-play-top') && source.includes('review-live-glow top') && source.includes('review-live-brain'), 'review added view budget is reserved for the reference full-screen in-game card');
    assert(source.includes('review-finish-card') && source.includes('这一局探索结束') && source.includes('明天回访什么'), 'review added density is reserved for the reference one-round finish/evidence state');
    assert(source.includes('review-finish-hero') && source.includes('review-finish-section remembered') && source.includes('review-finish-bottom'), 'review added density is reserved for the reference result-page sections and footer actions');
    assert(!source.includes('review-choice-board'), 'review live state does not restore the old choice board');
    assert(source.includes('activeReviewTool.whackChoices') && source.includes('bindtap="selectWhackChoice"'), 'review live state exposes the real whack interaction instead of a dead demo card');
    assert(source.includes('bindtap="selectMatchTile"') && source.includes('bindtap="pickSnakeTile"'), 'review live state exposes real match and route-chain interactions');
    assert(source.includes('review-live-actions grade') && source.includes('data-result="remembered"') && source.includes('bindtap="finishPlayableReviewTool"'), 'review live state lets the child confirm the first step from the reference four-action footer');
    assert(reviewJs.includes('selectWhackChoice') && reviewJs.includes('selectMatchTile') && reviewJs.includes('pickSnakeTile'), 'review keeps core playable board logic in JS for future deeper interactions');
    assert(reviewJs.includes('reference_live_first_step_button'), 'review reference live first-step button writes evidence for the learning loop');
    ['知识乐园', '错因地鼠', '快闪问答', '拼图配对', '路线接龙'].forEach((term) => {
      assert(source.includes(term), `review first screen exposes real-card knowledge-park entry: ${term}`);
    });
    ['review-whack-board', 'review-match-board', 'review-snake-board', '再来一局', '排行榜', '商店', '勋章', '闯关'].forEach((term) => {
      assert(!source.includes(term), `review first screen does not expose old reward/economy game shell: ${term}`);
    });
    assert(source.includes('review-feedback-strip') && source.includes('openReviewRepairFocus'), 'review added view budget is reserved for completion feedback and repair focus');
    assert(!source.includes('review-map-node') && !source.includes('review-action-grid') && !source.includes('gameRunway'), 'review does not spend the added wx:for budget on old route maps or game runway lists');
  }

  if (page.id === 'upload') {
    assert(source.includes('upload-evidence-grid') && source.includes('upload-evidence-card primary'), 'upload added density is reserved for the reference upload-material evidence grid');
    ['错题描述', '成绩/周测', '老师反馈', '家长观察', '测评摘要'].forEach((term) => {
      assert(source.includes(term), `upload evidence grid covers reference material type: ${term}`);
    });
    assert(!source.includes('upload-material-grid') && !source.includes('upload-material-card'), 'upload does not restore the old material card grid');
  }

  if (page.id === 'tutor') {
    assert(source.includes('tutor-chat-head') && source.includes('tutor-message-row') && source.includes('tutor-avatar-dot') && source.includes('tutor-usage-note'), 'tutor added structure is reserved for the reference chat app header, avatar bubble row, and usage note');
    assert(source.includes('tutor-dialogue-top') && source.includes('tutor-chatline') && source.includes('tutor-dialogue-composer'), 'tutor added density is reserved for the reference free-dialogue subpage');
    assert(source.includes('tutor-blackboard-hero') && source.includes('tutor-blackboard') && source.includes('咕点小黑板'), 'tutor added density is reserved for the reference knowledge blackboard subpage');
  }

  if (page.id === 'profile') {
    assert(source.includes('growth-questionnaire-panel') && source.includes('learningReportQuestionnaire') && source.includes('answerLearningQuestion'), 'profile added wx:for budget is reserved for the real one-minute questionnaire');
    assert(source.includes('growth-subpage-nav questionnaire') && source.includes('growth-questionnaire-progress nav') && !source.includes('wx:for="{{growthQuestionProgressDots}}"'), 'profile questionnaire keeps the reference fixed top progress indicator without adding a primary-surface dynamic list');
    assert(source.includes('growth-question-options') && source.includes('growth-question-option-icon') && source.includes('growth-question-option-check'), 'profile added view budget is reserved for the reference large selectable questionnaire cards');
    assert(source.includes('growth-progress-card') && source.includes('报告生成进度') && source.includes('开始了解孩子'), 'profile added density is reserved for the reference growth-report progress card and primary CTA');
    assert((source.match(/class="growth-upload-card/g) || []).length >= 5 && source.includes('growth-upload-card primary') && source.includes('bindtap="startGrowthQuestionnaire"'), 'profile added view budget is reserved for the reference five-card material upload scene');
    assert(source.includes('growth-upload-title-row') && source.includes('growth-upload-added') && source.includes('growth-upload-sample') && source.includes('growth-upload-plus'), 'profile upload-scene density is reserved for the reference primary material card and plus affordances');
    assert(source.includes('growth-report-preview') && source.includes('成长线索初步发现'), 'profile added density is reserved for the reference report-preview state');
    assert(source.includes('growth-report-card-head') && source.includes('growth-report-corner') && source.includes('growth-report-body'), 'profile report-preview density is reserved for the reference icon/tag/source result cards');
    assert(source.includes('growth-parent-action-card') && source.includes('今晚行动已为你准备好'), 'profile added density is reserved for the reference parent-action-card state');
    assert(source.includes('growth-parent-action-item') && source.includes('growth-parent-bottom-actions'), 'profile parent-action density is reserved for the reference checkbox action cards and two-button footer');
  }

  if (page.id === 'entry-detail') {
    assert(source.includes('entry-card-grid') && source.includes('bindtap="openSceneCard"'), 'entry-detail added wx:for budget is reserved for compact functional child cards');
    assert(!source.includes('loopNodes') && !source.includes('proofSteps'), 'entry-detail does not spend the added wx:for budget on repeated proof rails');
  }

  forbiddenVisibleTerms.forEach((term) => {
    assert(!source.includes(term), `${page.id} does not reintroduce old visible UI term/class: ${term}`);
  });
});

const activeTabSources = pageBudgets
  .filter((page) => page.id !== 'entry-detail')
  .map((page) => fs.readFileSync(path.join(root, page.file), 'utf8'))
  .join('\n');

[
  '/assets/reference/brand-house.png',
  '/assets/reference/upload-folder-stack-transparent.png',
  '/assets/reference/family-avatar-group-transparent.png',
  '/assets/reference/tutor-socratic-board-transparent.png',
  '/assets/reference/review-world-map-transparent.png',
  '/assets/reference/report-radar-card-illustration.png'
].forEach((asset) => {
  assert(activeTabSources.includes(asset), `active tab first-screen shells keep shared reference asset: ${asset}`);
});

console.log('Miniapp first-screen density contract passed.');
