const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const homeWxml = read('miniprogram/pages/home/home.wxml');
const homeViewModelJs = read('miniprogram/view-models/home-view-model.js');
const reviewWxml = read('miniprogram/pages/review/review.wxml');
const reviewViewModelJs = read('miniprogram/view-models/review-view-model.js');
const toolsWxml = read('miniprogram/pages/tools/tools.wxml');
const toolsViewModelJs = read('miniprogram/view-models/tools-view-model.js');
const profileWxml = read('miniprogram/pages/profile/profile.wxml');
const profileViewModelJs = read('miniprogram/view-models/profile-view-model.js');
const pilotTemplate = read('docs/pilot-observation-template.md');
const packageJson = read('package.json');

assert(homeWxml.includes('placeholder="{{homeViewModel.inputCard.placeholder}}"') && homeViewModelJs.includes('placeholder'), 'home input placeholder explains how to start through homeViewModel');
assert(homeWxml.includes('homeViewModel.emptyState') && homeViewModelJs.includes('emptyState'), 'home first-run empty state gives a warm first action through homeViewModel');
assert(homeWxml.includes('homeViewModel.teacherPickerHint') && homeViewModelJs.includes('teacherPickerHint'), 'home companion entry has a light explanation through homeViewModel');
assert(homeWxml.includes('homeViewModel.nextStep.text') && homeViewModelJs.includes('buildNextStep'), 'home shows next step after tonightPlan exists through homeViewModel');
assert(homeWxml.includes('homeViewModel.nextStep.cta') && homeViewModelJs.includes("action: 'review'"), 'home links to review tab after route/focus exists through homeViewModel');
assert(homeViewModelJs.includes('todayFocus'), 'home confirms todayFocus and points to review through homeViewModel');

assert(reviewWxml.includes('reviewViewModel.emptyState') && reviewViewModelJs.includes('还没有要修的卡点。先回到作业点拨，说一句你卡在哪里。'), 'review first-run empty state does not look broken');
assert(reviewWxml.includes('reviewViewModel.emptyState.cta') && reviewViewModelJs.includes('去说第一步'), 'review first-run empty state links back to first-step flow');
assert(reviewWxml.includes('已生成明天回访卡。下一步：去轻轻回访。'), 'review completion points to tools tab');
assert(reviewWxml.includes('去轻回访'), 'review completion has a light tools entry');

assert(toolsWxml.includes('{{toolsViewModel.primaryCard.body}}') && toolsViewModelJs.includes('先完成一次“说出第一步 + 围绕它坐一段”'), 'tools first-run empty state explains revisit timing');
assert(toolsWxml.includes('{{toolsViewModel.nextStep.text}}') && toolsViewModelJs.includes('下一步：让家长 5 秒看懂今晚问哪一句。'), 'tools points to profile after review card is available');
assert(toolsWxml.includes('{{toolsViewModel.nextStep.cta}}') && toolsViewModelJs.includes('去我的页'), 'tools has a light profile next-step entry');
assert(toolsWxml.includes('{{toolsViewModel.primaryCta.text}}') && toolsViewModelJs.includes('先去说第一步'), 'tools main CTA routes back to a real stuck point before revisit');

assert(profileWxml.includes('再用两晚后，咕点会帮你看见模式') && profileViewModelJs.includes('今天还没有第一步记录。'), 'profile first-run empty state is mascot-led and child-friendly');
assert(profileWxml.includes('profileViewModel.nextStep') && profileViewModelJs.includes('oneNightProof'), 'profile completion tells the family what was proven tonight');
assert(profileViewModelJs.includes('咕点帮你整理'), 'profile uses child-friendly companion framing');

['selectedCompanion', 'createdTonightPlan', 'createdTodayFocus', 'startedRepair', 'completedMiniAction', 'completedRepair', 'createdReviewCard', 'visitedToolsAfterRepair', 'visitedProfileAfterReview'].forEach((field) => {
  assert(pilotTemplate.includes(field), `pilot observation template includes ${field}`);
});

const tabCopy = [homeWxml, homeViewModelJs, reviewWxml, reviewViewModelJs, toolsWxml, toolsViewModelJs, profileWxml, profileViewModelJs].join('\n');
['家长应监督', '系统诊断', '严重薄弱', '小满', '秒解', '答案已生成', '拍照出答案', '数学老师', '英语老师', '语文老师', '科学老师'].forEach((term) => {
  assert(!tabCopy.includes(term), `RC1.1 tab copy avoids forbidden wording: ${term}`);
});

['帮我安排今晚学习', '去说第一步', '去修卡点', '去轻回访', '去我的页', '开始 5 分钟修复', '先去说第一步', '完成今日复盘'].forEach((cta) => {
  assert(tabCopy.includes(cta), `main CTA remains visible: ${cta}`);
});

assert(packageJson.includes('scripts/test-rc11-first-day.cjs'), 'npm test includes RC1.1 first-day usability guard');

console.log('All RC1.1 first-day usability tests pass.');
