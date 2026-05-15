#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

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
const reviewJs = read('miniprogram/pages/review/review.js');
const toolsJs = read('miniprogram/pages/tools/tools.js');
const arcadeJs = read('miniprogram/pages/arcade/arcade.js');
const legalJs = read('miniprogram/pages/legal/legal.js');
const storageJs = read('miniprogram/utils/storage.js');
const learningPriority = read('miniprogram/utils/learning-priority.js');
const arcadeEngine = read('miniprogram/utils/arcade-engine.js');
const reviewCards = read('miniprogram/utils/review-cards.js');
const gameLogic = read('miniprogram/utils/game-logic.js');
const reviewPack = read('scripts/miniapp-review-pack.cjs');
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
assert(!/已领取|可领取|可以领取奖励|今日目标奖励|完成今日复习可领取|奖励暂时不可领取|奖励记录已写回/.test(reviewJs + reviewCards + arcadeJs), 'Review and arcade use learning-record wording instead of redeemable reward wording');
assert(/学习记录已写回/.test(arcadeJs), 'Arcade completion writes learning record copy');
assert(!/demo_|code !== 'demo'|code: 'demo'|mode = 'demo'|mode: 'demo'/.test(miniApi + miniSession + miniShared), 'Mini session path uses local mode instead of demo sessions');
assert(!/cloud_sync_not_configured|云同步/.test(miniLeaderboard), 'Leaderboard service gating avoids cloud-sync/internal wording');
assert(!/假社交|假数据/.test(miniLeaderboard), 'Leaderboard fallback avoids fake-social wording');
assert(!/云端持久化|云同步|本地 Storage/.test(parentBind + reviewDueCards), 'Parent/review APIs avoid internal persistence setup wording');
assert(!/云端|云同步|本地 Storage/.test(deckCards + reviewCards + profileJs + profileWxml), 'Deck/review/profile copy avoids internal cloud wording');
assert(/local_learning_rewards/.test(miniShop + miniAchievements), 'Shop and achievement APIs expose local learning reward mode');
assert(/persisted:\s*false/.test(miniShop + miniAchievements + miniFeedback), 'Reward and feedback APIs do not imply real persistence without service configuration');
assert(/local_feedback_receipt/.test(miniFeedback) && !/server-feedback-contract|dataset_contract/.test(miniFeedback), 'Feedback API returns a local receipt instead of pretending to write a server dataset');
assert(!/dataset_contract/.test(miniFeedback + miniEventApi + leadApi), 'Current mini API paths expose service contracts instead of internal dataset contracts');
const commercialApiSurface = miniTutor + miniPriority + miniWeekly + miniReport + miniQuizGenerate + miniQuizSubmit + miniReviewToday + miniReviewGrade + miniContentCheck + miniContentEngine + decksApi + deckCards;
assert(/service_contract/.test(commercialApiSurface), 'Core mini APIs expose service contracts');
assert(/persisted:\s*false/.test(commercialApiSurface), 'Core mini APIs avoid implying persistence');
assert(!/client_storage_or_sync|provider:\s*'server-precheck'/.test(commercialApiSurface), 'Content/deck APIs avoid internal storage or server-precheck wording');
assert(!/source:\s*'server-/.test(miniPriority + miniWeekly + miniReport), 'Priority/weekly/report avoid pretending server-backed intelligence in local mode');
assert(!/stateless_ack/.test(leadApi + miniEvent + miniSync + profileJs), 'Lead/event/sync paths use local receipt wording instead of stateless ack');
assert(/service_ready/.test(leadApi + profileJs), 'Lead submission exposes whether a real follow-up channel is configured');
assert(!/拍照出答案|自动识别答案|保证提分|注定|必然/.test(profileWxml + toolsJs + arcadeJs + learningReportRecognition + apiRecognition), 'Commercial shell avoids unsafe claims');
assert(!/Gizmo|Khan|Khanmigo|Anki|parity|moat|moonshot|BENCHMARK|MOAT|学习证明|购买|兑换/.test(reviewCards + toolsJs + miniGame + parentChildStats), 'Commercial surface avoids competitor, internal strategy, proof, and transaction wording');
assert(!/coins:\s*/.test(parentChildStats), 'Parent stats expose learning record points instead of coin currency');

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
  '/api/mini/weekly'
].sort();
assert.deepStrictEqual(activeMiniPaths, allowedMiniPaths, 'Miniapp client only calls current service-contract API surface');
assert(!/\/api\/(?:log-dialogue|fsrs-|ingest-attempt|mastery-proxy|parent-push|student-init|ai-proxy|mentor-queue)/.test(miniApi), 'Miniapp client does not call legacy demo/server-only APIs');
assert(miniApi.includes('localSession') && miniApi.includes('recognizeLearningReport') && miniApi.includes('catch(() => fallback())'), 'Miniapp client has local fallbacks for session and recognition failures');

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

console.log('All commercial shell tests pass.');
