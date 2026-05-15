const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const files = {
  homeWxml: read('miniprogram/pages/home/home.wxml'),
  homeViewModelJs: read('miniprogram/view-models/home-view-model.js'),
  reviewWxml: read('miniprogram/pages/review/review.wxml'),
  reviewViewModelJs: read('miniprogram/view-models/review-view-model.js'),
  toolsWxml: read('miniprogram/pages/tools/tools.wxml'),
  toolsViewModelJs: read('miniprogram/view-models/tools-view-model.js'),
  profileWxml: read('miniprogram/pages/profile/profile.wxml'),
  storageJs: read('miniprogram/utils/storage.js'),
  packageJson: read('package.json')
};

function between(text, start, end) {
  const startIndex = text.indexOf(start);
  assert(startIndex >= 0, `missing start marker ${start}`);
  const endIndex = text.indexOf(end, startIndex + start.length);
  assert(endIndex > startIndex, `missing end marker ${end}`);
  return text.slice(startIndex, endIndex);
}

function count(text, pattern) {
  return (text.match(pattern) || []).length;
}

const firstScreens = {
  home: [
    between(files.homeWxml, 'rc14-home-first-screen-top', 'rc14-home-after-first-screen-top'),
    between(files.homeWxml, 'rc14-home-first-screen-card', 'rc14-home-after-first-screen-card')
  ].join('\n'),
  review: between(files.reviewWxml, 'rc14-review-first-screen', 'rc14-review-after-first-screen'),
  tools: between(files.toolsWxml, 'rc14-tools-first-screen', 'rc14-tools-after-first-screen'),
  profile: between(files.profileWxml, 'rc14-profile-first-screen', 'rc14-profile-after-first-screen')
};

[
  ['home', firstScreens.home, 'homeViewModel.title', 'homeViewModel.primaryCta'],
  ['review', firstScreens.review, 'reviewViewModel.title', /reviewViewModel\.primaryCta\.text|reviewViewModel\.emptyState\.cta/],
  ['tools', firstScreens.tools, 'toolsViewModel.title', /toolsViewModel\.primaryCta\.text/],
  ['profile', firstScreens.profile, 'profileViewModel.title', 'profileViewModel.primaryCta']
].forEach(([name, screen, title, cta]) => {
  assert(screen.includes(title), `${name} first screen keeps the one main question`);
  if (typeof cta === 'string') {
    assert(screen.includes(cta), `${name} first screen keeps the main CTA`);
  } else {
    assert(cta.test(screen), `${name} first screen keeps the main CTA`);
  }
  assert(count(screen, /companion-route-strip/g) <= 1, `${name} first screen has at most one companion strip`);
  assert(count(screen, /今晚路线 ·/g) <= 1, `${name} first screen has at most one route pill`);
  assert(count(screen, /rc14-main-card/g) === 1, `${name} first screen has exactly one main task card`);
});

assert(firstScreens.home.includes('homeViewModel.inputCard.title') && files.homeViewModelJs.includes('inputCard'), 'home main card is the input card through homeViewModel');
assert(firstScreens.home.includes('homeViewModel.teacherPickerLabel') && files.homeViewModelJs.includes('teacherPickerLabel'), 'home keeps mascot cue through homeViewModel');
assert(firstScreens.home.includes('homeViewModel.teacherPickerHint') && files.homeViewModelJs.includes('teacherPickerHint'), 'home keeps light mascot explanation through homeViewModel');
assert(!firstScreens.home.includes('wx:for="{{companionOptions}}"'), 'home no longer renders the six-teacher selector');
assert(!firstScreens.home.includes('{{item.desc}}') && !firstScreens.home.includes('{{item.short}}'), 'home visible first screen avoids companion option cards');
assert(!firstScreens.home.includes('middle-guide'), 'home first screen does not stack the three-step guide');
assert(!firstScreens.home.includes('weak-verdict-card'), 'home result card is below the first screen');
assert(!firstScreens.home.includes('quick-actions'), 'home prompt chips are not in the first screen');

assert(firstScreens.review.includes('reviewViewModel.primaryCard.sections') && files.reviewViewModelJs.includes('今天卡在哪'), 'review main card says where the child is stuck');
assert(files.reviewViewModelJs.includes('咕点建议你先看'), 'review main card says where to look first');
assert(files.reviewViewModelJs.includes('你自己的第一步'), 'review main card asks for the child first step');
assert(!firstScreens.review.includes('todayFocus'), 'review first screen does not bind raw todayFocus');
assert(!firstScreens.review.includes('loop-rail'), 'review progress rail is below the first screen');
assert(!firstScreens.review.includes('review-progress-line'), 'review progress bar is below the first screen');
assert(!firstScreens.review.includes('错题本管理'), 'review management is below the first screen');

assert(firstScreens.tools.includes('toolsViewModel.primaryCard') && files.toolsViewModelJs.includes('回看昨天那一步'), 'tools main card names the repaired stuck point');
assert(!firstScreens.tools.includes('也可以轻松练一下'), 'tools game choices are below the first screen');
assert(!firstScreens.tools.includes('想练自己的内容'), 'tools custom practice is below the first screen');
assert(!firstScreens.tools.includes('提取记忆') && !firstScreens.tools.includes('概念边界'), 'tools first screen avoids cognitive taxonomy');
assert(!files.toolsWxml.includes('tools-below-fold-spacer'), 'tools avoids fake blank space as a layout crutch');
assert(!files.toolsWxml.includes('wx:if="{{false}}"') && files.toolsWxml.includes('tools-secondary-games') && files.toolsWxml.includes('class="material-panel"'), 'tools secondary practice is available below the first screen');

assert(firstScreens.profile.includes('今晚卡住') && firstScreens.profile.includes('只问一句') && firstScreens.profile.includes('最近小结'), 'profile main card renders the friend-safe parent recap sections');
assert(!firstScreens.profile.includes('todayFocus'), 'profile first screen does not bind raw todayFocus');
assert(!firstScreens.profile.includes('tonightPlan'), 'profile first screen does not bind raw tonightPlan');
assert(!firstScreens.profile.includes('本周记得的一小步'), 'profile memory card is below the first screen');
assert(!firstScreens.profile.includes('老师建议'), 'profile avoids teacher advice wording in the first screen');
assert(!firstScreens.profile.includes('今日成长卡'), 'profile growth card is below the first screen');
assert(!files.profileWxml.includes('profile-below-fold-spacer'), 'profile avoids fake blank space as a layout crutch');
assert(!files.reviewWxml.includes('review-below-fold-spacer'), 'review avoids fake blank space as a layout crutch');

[
  '近 7 天错误类型分布',
  '系统诊断',
  '家长应监督',
  '严重薄弱',
  '孩子问题',
  'home_xiaodian_entry',
  'needs_student_step',
  '小满',
  '数学老师',
  '英语老师',
  '语文老师',
  '科学老师',
  '秒解',
  '答案已生成',
  '拍照出答案',
  '排行榜',
  'PK',
  '冲榜'
].forEach((term) => {
  const visibleTabCopy = [files.homeWxml, files.reviewWxml, files.toolsWxml, files.profileWxml].join('\n');
  assert(!visibleTabCopy.includes(term), `RC1.4 visible/product copy avoids ${term}`);
});

assert(files.storageJs.includes('咕点') && files.storageJs.includes('我懂你卡住了，我陪你先迈出第一步。'), 'companion strip uses mascot wording');
assert(files.packageJson.includes('scripts/test-rc14-ui-first-screen.cjs'), 'npm test includes RC1.4 first-screen guard');

console.log('All RC1.4 first-screen UI tests pass.');
