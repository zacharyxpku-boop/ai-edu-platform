const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const homeWxml = read('miniprogram/pages/home/home.wxml');
const homeJs = read('miniprogram/pages/home/home.js');
const homeViewModelJs = read('miniprogram/view-models/home-view-model.js');
const homeWxss = read('miniprogram/pages/home/home.wxss');
const toolsWxml = read('miniprogram/pages/tools/tools.wxml');
const toolsViewModelJs = read('miniprogram/view-models/tools-view-model.js');
const toolsWxss = read('miniprogram/pages/tools/tools.wxss');
const reviewWxml = read('miniprogram/pages/review/review.wxml');
const reviewWxss = read('miniprogram/pages/review/review.wxss');
const reviewViewModelJs = read('miniprogram/view-models/review-view-model.js');
const profileWxml = read('miniprogram/pages/profile/profile.wxml');
const profileWxss = read('miniprogram/pages/profile/profile.wxss');
const profileViewModelJs = read('miniprogram/view-models/profile-view-model.js');

function count(text, needle) {
  return (text.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
}

assert(homeWxml.includes('flow-pill compact'), 'home route hint is compressed into a compact status pill');
assert(homeWxml.includes('{{homeViewModel.routePill}}') && homeViewModelJs.includes('routePill'), 'home route hint uses the unified RC0.7 stage format through homeViewModel');
assert(homeJs.includes("['read_question', 'write_equation', 'review_this']"), 'home keeps only three quick chips on the first screen');
assert(!homeWxml.includes('example-nudge') && !homeWxml.includes('starter-bubble'), 'home removes duplicate first-step examples from the first screen');
assert(homeWxss.includes('.mascot-wrap') && /transform:\s*scale\(0\.(5|6)\d\)/.test(homeWxss), 'home mascot is reduced so it does not dominate the first screen');
assert(homeWxss.includes('.composer-shell') && homeWxss.includes('position: relative'), 'home action composer sits in the content flow instead of floating over the first screen');
assert(homeWxml.includes('weak-verdict-card result-state') && homeWxml.includes('wx:if="{{showWeakVerdict}}"'), 'home stuck-point detail card only appears in a result state');

assert(toolsWxml.includes('rc-focus-review') && !toolsWxml.includes('tools-more-toggle'), 'tools shows repaired-focus recall before game choices');
assert(!toolsWxml.includes('quick-play-panel featured'), 'tools does not duplicate the empty trial CTA below the main recall card');
assert(!toolsWxml.includes('wx:if="{{false}}"') && toolsWxml.includes('tools-secondary-games') && toolsWxml.includes('class="material-panel"'), 'tools secondary practice and material generation are below the main recall card');
assert(toolsWxml.includes('{{toolsViewModel.routePill}}') && toolsViewModelJs.includes('今晚路线 · 第 4 步：明天轻轻回访'), 'tools route hint uses the unified RC0.7 stage format');
assert(toolsWxml.includes('{{toolsViewModel.primaryCard.title}}') && toolsViewModelJs.includes('回看昨天那一步') && toolsViewModelJs.includes('轻轻回看'), 'tools recall entry reads like a concrete revisit object');
assert(toolsWxml.includes('secondary-generate'), 'tools material generation button is visually secondary');
assert(/\.material-textarea[\s\S]*max-height:\s*112rpx/.test(toolsWxss), 'tools material textarea is capped for small screens');
assert(toolsWxss.includes('.secondary-generate') && toolsWxss.includes('box-shadow: none'), 'tools generated-level CTA no longer competes with start trial');

assert(count(reviewWxml, 'review-title') === 1, 'review first screen has one main repair title');
assert(reviewWxml.includes('weakspot-panel rc-sunk') && reviewWxml.includes('showAdvancedReview && mistakeHub.weakSpot'), 'review old green weakspot card is sunk behind advanced state');
assert(reviewWxml.includes('{{reviewViewModel.routePill}}') && reviewViewModelJs.includes('今晚路线 · 第 3 步：修卡点'), 'review route hint uses the unified RC0.7 stage format');
assert(reviewWxml.includes('quest-panel rc-after-repair') && reviewWxml.includes("repairStatus === 'completed'"), 'review 5-minute quest is sunk until repair is completed');
assert(reviewWxml.includes('review-secondary-stats') && reviewWxml.includes('showAdvancedReview'), 'review stats are sunk behind secondary/advanced state');
assert(reviewWxss.includes('env(safe-area-inset-bottom)'), 'review keeps bottom safe-area padding');
assert(reviewWxss.includes('padding-top: calc(44rpx + env(safe-area-inset-top))') && reviewWxss.includes('padding-bottom: calc(260rpx + env(safe-area-inset-bottom))'), 'review strengthens top and bottom safe-area spacing');

const heroStart = profileWxml.indexOf('<view class="parent-hero">');
const heroEnd = profileWxml.indexOf('<view class="family-summary-card teacher-lite profile-subtle-card">');
const profileHero = profileWxml.slice(heroStart, heroEnd);
assert(profileHero.includes('今晚卡住') && profileHero.includes('只问一句') && profileHero.includes('最近小结') && profileViewModelJs.includes('parent-one-question'), 'profile hero highlights the one parent question');
assert(profileHero.includes('{{profileViewModel.title}}') && profileViewModelJs.includes('今晚家长只问这一句'), 'profile title centers the parent one-question job');
assert(profileHero.includes('{{profileViewModel.routePill}}') && profileViewModelJs.includes('今晚路线 · 第 5 步：家长 5 秒复盘'), 'profile route hint uses the unified RC1 stage format');
assert(profileHero.includes('今晚卡住') && profileHero.includes('只问一句') && profileHero.includes('最近小结') && profileViewModelJs.includes('今晚孩子卡在') && profileViewModelJs.includes('家长只问一句') && profileViewModelJs.includes('信任边界'), 'profile hero is compressed into three parent conclusion blocks');
assert(profileWxml.includes('profile-secondary-process') && profileWxml.includes('showAdvancedProfile'), 'profile process summary is folded behind advanced state');
assert(!profileHero.includes('tutorProcessSummary.safetyLine'), 'profile hero does not render the full process-summary line directly');
assert(!profileHero.includes('今晚路线完成情况'), 'profile hero avoids a long route-status report');
assert(profileWxss.includes('.process-summary-items.collapsed') && profileWxss.includes('display: none'), 'profile process details are collapsed by default');
assert(profileWxss.includes('env(safe-area-inset-bottom)'), 'profile keeps bottom safe-area padding');
assert(profileWxss.includes('box-shadow: 0 10rpx 24rpx rgba(154, 115, 0, 0.08)') && profileWxss.includes('font-size: 24rpx'), 'profile one-question block is the visual memory point');

const tabbarWxss = read('miniprogram/custom-tab-bar/index.wxss');
assert(tabbarWxss.includes('height: 110rpx') && tabbarWxss.includes('env(safe-area-inset-bottom)'), 'custom tabbar is lighter while preserving bottom safe area');

const fourTabs = [homeWxml, toolsWxml, reviewWxml, profileWxml].join('\n');
['秒解', '拍照出答案', '答案已生成', '直接答案', '标准答案如下', '看答案', '参考答案', '正确答案'].forEach((term) => {
  assert(!fourTabs.includes(term), `four tab pages avoid unsafe answer wording: ${term}`);
});

console.log('All RC0.6 UI reduction tests pass.');
