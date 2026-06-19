const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const appJson = JSON.parse(read('miniprogram/app.json'));
const tabbarJs = read('miniprogram/custom-tab-bar/index.js');
const tabbarWxml = read('miniprogram/custom-tab-bar/index.wxml');
const navigationJs = read('miniprogram/utils/navigation.js');
const upload = read('miniprogram/pages/upload/upload.wxml');
const uploadJs = read('miniprogram/pages/upload/upload.js');
const tutor = read('miniprogram/pages/tutor/tutor.wxml');
const review = read('miniprogram/pages/review/review.wxml');
const reviewJs = read('miniprogram/pages/review/review.js');
const profile = read('miniprogram/pages/profile/profile.wxml');
const profileJs = read('miniprogram/pages/profile/profile.js');

assert.deepStrictEqual(
  appJson.tabBar.list.map((item) => item.pagePath),
  ['pages/tutor/tutor', 'pages/review/review', 'pages/profile/profile'],
  'main tab architecture is AI tutor, Knowledge Park, and Growth Report'
);
assert(!tabbarJs.includes('/pages/upload/upload'), 'upload is not a primary tab route');
assert(tabbarJs.includes("'/pages/tutor/tutor', '/pages/review/review', '/pages/profile/profile'"), 'custom tabbar route table has exactly three tabs');
assert(!navigationJs.includes("'/pages/upload/upload'"), 'upload uses navigateTo as a child flow instead of switchTab');
assert(!tabbarWxml.includes('data-path="/pages/upload/upload"') && !tabbarWxml.includes('>上传<'), 'custom tabbar does not expose upload as a bottom tab');

assert(tutor.includes('tutor-chat-card') && tutor.includes('tutor-input-bar'), 'AI tutor still has a usable chat/input flow');
assert(tutor.includes('bindtap="launchFirstStep"'), 'AI tutor has a runnable primary action');
assert(tutor.includes('咕点在线') && tutor.includes('找第一步'), 'AI tutor presents direct conversation and first-step help');
assert(!tutor.includes('苏格拉底点拨') && !tutor.includes('AI点拨'), 'AI tutor first screen avoids retired/internal naming');

assert(review.includes('知识乐园') && review.includes('selectedPlayableReviewToolStartText') && review.includes('bindtap="startSelectedPlayableReviewTool"'), 'Knowledge Park has a runnable selected-play primary action');
assert(!review.includes('练习单生成器') && !review.includes('课堂互动工具') && !review.includes('自主练习'), 'Knowledge Park does not split core games into abstract categories');
assert(!review.includes('生成练习工具包'), 'Knowledge Park does not use internal tool-pack naming as the primary CTA');
['错因地鼠', '快闪问答', '拼图配对', '路线接龙'].forEach((term) => {
  assert(review.includes(term), `Knowledge Park exposes core game: ${term}`);
});
['排行榜', '商店', '勋章', '闯关', '短回访'].forEach((term) => {
  assert(!review.includes(term), `Knowledge Park avoids retired or overcrowded game wording: ${term}`);
});
assert(reviewJs.includes("const toolIds = ['whack', 'quiz', 'flashcard', 'match', 'snake', 'uno', 'variant', 'print']"), 'Knowledge Park runtime tools match the visible eight core plays');
assert(reviewJs.includes('tool.templateOnly') && reviewJs.includes('runTemplateDeliverable') && review.includes('review-template-workbench'), 'Knowledge Park maps non-live plays into a real practice-pack workbench');
assert(review.includes('selectPlayableReviewTool') && review.includes('startSelectedPlayableReviewTool') && review.includes('bindtap="rate"'), 'Knowledge Park game flow is selectable, runnable, and self-graded');

assert(profile.includes('成长报告'), 'profile tab is repositioned as Growth Report');
assert(profile.includes('上传错题/测评') && profile.includes('错题描述'), 'Growth Report owns wrong-question and material upload as its primary input');
assert(profile.includes('学习偏好线索') && profile.includes('当前卡点证据') && profile.includes('今晚行动建议') && profile.includes('今晚行动已为你准备好'), 'Growth Report explains the child through preview cards and parent action cards');
assert(profile.includes('材料越多，报告越准') && !profile.includes('天赋定论') && !profile.includes('每天涨') && !profile.includes('天赋标签'), 'Growth Report follows evidence copy and avoids deterministic talent claims');
assert(profile.includes('去AI私教') && profile.includes('知识乐园') && profile.includes('data-action="tutor"') && profile.includes('data-action="review"'), 'Growth Report preview routes into the execution tabs');
assert(profile.includes('data-action="uploadPage"') && profileJs.includes('uploadPage'), 'Growth Report material cards can enter the real upload child page');
assert(profile.includes('data-panel="action"') && profileJs.includes("growthActiveScene: 'action'"), 'Growth Report can enter the parent action card without adding it as a fourth preview CTA');
assert(!profile.includes('家长证据看板') && !profile.includes('今晚只做复盘') && !profile.includes('growth-signal-grid') && !profile.includes('growth-next-row'), 'Growth Report no longer reads like the old parent-only recap page or stacked route board');

assert(upload.includes('yd-upload-heading') && upload.includes('upload-evidence-grid') && upload.includes('upload-intake-workbench'), 'upload child page still provides material intake');
assert(upload.includes('生成成长报告'), 'upload child flow remains usable from Growth Report');
assert(upload.includes('收集线索碎片 🧩') && upload.includes('直接拍照或打字都可以') && upload.includes('手动摘录线索'), 'upload child page follows the material-intake copy without promising photo recognition');
assert(uploadJs.includes('submit()') && uploadJs.includes('importMaterialPack'), 'upload child page has real submit and material-pack import handlers');

console.log('Miniapp tab product focus contract passed.');
