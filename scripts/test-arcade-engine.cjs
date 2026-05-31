#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadArcadeEngine() {
  const file = path.join(__dirname, '..', 'miniprogram', 'utils', 'arcade-engine.js');
  const code = fs.readFileSync(file, 'utf8');
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    console
  }, { filename: file });
  return module.exports;
}

const arcade = loadArcadeEngine();
const arcadePageCode = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'arcade', 'arcade.js'), 'utf8');
const arcadePageWxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'arcade', 'arcade.wxml'), 'utf8');
assert(arcadePageCode.includes("wx.switchTab({ url: '/pages/review/review' })"), 'legacy arcade page immediately redirects into the current review island');
assert(arcadePageCode.includes('legacy_arcade_redirect') && arcadePageWxml.includes('已为你打开复习岛'), 'legacy arcade deep links keep a product-native redirect state');
assert(arcadePageWxml.includes('data-scene="review"') && arcadePageWxml.includes('data-scene="tutor"') && arcadePageWxml.includes('data-scene="parent"'), 'legacy arcade redirect shell exposes current review, tutor, and parent exits');
assert(!/Combo|生命|本局得分|正确率|最稳连续|healthyCommercialReturnGuard|dailyComebackDecisionEngine/.test(arcadePageWxml), 'legacy arcade redirect shell does not render retired game UI');

const cards = [
  { id: 'c1', question: '8×7=?', answer: '56', subject: '数学', weakPoint: '口算' },
  { id: 'c2', question: '唐朝建立时间', answer: '618年', subject: '历史', weakPoint: '年代' },
  { id: 'c3', question: '水土流失的主要影响因素是什么？', answer: '降雨、坡度、植被覆盖率', subject: '地理', weakPoint: '原因' },
  { id: 'c4', question: '请解释水土流失和植被覆盖率之间的关系，并结合坡度说明。', answer: '植被覆盖率越低，坡度越大时地表径流越强，土壤越容易被冲刷。', subject: '地理', weakPoint: '概念理解' },
  { id: 'c5', question: '应用题解题顺序', answer: '先圈已知条件；再列等量关系；最后检查单位', subject: '数学', weakPoint: '步骤' }
];
cards.push({ id: 'c6', question: 'NaCl', answer: 'salt', subject: 'Science', weakPoint: 'symbol' });

const type = arcade.detectKnowledgeType(cards[0]);
assert(['skill', 'fact'].includes(type.id), '口算卡应归入事实记忆或技能操练');

const games = arcade.recommendGames(cards);
assert(games[0].id === 'whack' || games.some((item) => item.id === 'whack' && item.available), '打地鼠应可推荐');

const round = arcade.buildWhackRound(cards, { limit: 2 });
assert.equal(round.gameType, 'whack');
assert(round.questions.length >= 1, '打地鼠关卡应使用真实卡片');
assert(round.questions[0].choices.includes(round.questions[0].answer), '选项应包含可核对项目');
assert(!round.questions.some((item) => item.cardId === 'c4'), '打地鼠不应塞入长概念解释卡');
assert.equal(arcade.isQuickRecallCard(cards[0]), true, '短回忆口算卡可进入快选游戏');
assert.equal(arcade.isQuickRecallCard(cards[3]), false, '长概念卡应留给轻练或实验室');
assert.equal(arcade.isQuestCard(cards[3]), true, '长概念卡可进入轻回忆');

const duplicateChoiceRound = arcade.buildWhackRound([
  { id: 'dup1', question: '6脳7=?', answer: '42', subject: '鏁板', weakPoint: '鍙ｇ畻' },
  { id: 'dup2', question: '7脳6=?', answer: '42', subject: '鏁板', weakPoint: '鍙ｇ畻' },
  { id: 'dup3', question: '8脳8=?', answer: '64', subject: '鏁板', weakPoint: '鍙ｇ畻' }
], { limit: 3 });
duplicateChoiceRound.questions.forEach((item) => {
  assert.equal(new Set(item.choices).size, item.choices.length, 'whack choices should not repeat identical answers');
});

const tightWhackRound = arcade.buildWhackRound([
  { id: 'aa', question: '1+1', answer: '2', subject: 'Math', weakPoint: 'calculation' },
  { id: 'bb', question: '1+2', answer: '3', subject: 'Math', weakPoint: 'calculation' },
  { id: 'cc', question: '1+3', answer: '4', subject: 'Math', weakPoint: 'calculation' },
  { id: 'dd', question: '1+4', answer: '5', subject: 'Math', weakPoint: 'calculation' }
], { limit: 1, holes: 4 });
assert.equal(tightWhackRound.questions[0].choices.length, 4, 'whack should preserve all choices before hole placement');
assert.equal(new Set(tightWhackRound.questions[0].holeTargets).size, tightWhackRound.questions[0].choices.length, 'whack hole targets should not collide and hide choices');

const quest = arcade.buildQuestRound(cards, { limit: 3 });
assert.equal(quest.gameType, 'quiz');
assert(quest.questions.some((item) => item.cardId === 'c4'), '轻回忆应承接概念理解卡');
assert(quest.questions.every((item) => item.checkpoint && item.knowledgeType), '轻练题应给出学习动作提示和知识类型');

const recommended = arcade.recommendGames(cards);
assert(recommended.some((item) => item.id === 'quiz' && item.available), '轻回忆应在有概念卡时可用');
assert(recommended.some((item) => item.id === 'snake' && item.available), '贪吃蛇顺序关应在有步骤卡时可用');
assert(recommended.some((item) => item.id === 'match' && item.available === true), 'bubble match should unlock when at least two real short-pair cards exist');
assert(recommended.every((item) => item.pitch), '每个玩法推荐都应解释认知动作');
assert(recommended.every((item) => item.mascot && item.principleTitle && item.principleBody), '每个玩法应有童趣身份和认知说明');
assert(recommended.every((item) => item.available || item.lockedReason), '不可玩玩法应说明为什么还没解锁');

const thinMatchRecommendation = arcade.recommendGames([
  { id: 'only_pair', question: 'H2O', answer: 'water', subject: 'Science', weakPoint: 'symbol' }
]).find((item) => item.id === 'match');
assert.equal(thinMatchRecommendation.available, false, 'bubble match should require at least two real pairs to feel playable');
assert.equal(arcade.buildMatchRound([{ id: 'only_pair', question: 'H2O', answer: 'water', subject: 'Science', weakPoint: 'symbol' }]).total, 1, 'bubble round builder may preview one real pair even though entry stays locked');

const duplicateOnlyMatchRecommendation = arcade.recommendGames([
  { id: 'dupm1', question: 'term', answer: 'A', subject: 'Science', weakPoint: 'symbol' },
  { id: 'dupm2', question: 'term', answer: 'B', subject: 'Science', weakPoint: 'symbol' }
]).find((item) => item.id === 'match');
assert.equal(duplicateOnlyMatchRecommendation.readyCount, 1, 'bubble recommendation should count only unambiguous playable pairs');
assert.equal(duplicateOnlyMatchRecommendation.available, false, 'bubble match should stay locked when duplicate labels collapse below two pairs');

const whackStillAvailableWithOneCard = arcade.recommendGames([
  { id: 'solo_fact', question: '2+2', answer: '4', subject: 'Math', weakPoint: 'calculation' }
]).find((item) => item.id === 'whack');
assert.equal(whackStillAvailableWithOneCard.available, true, 'whack can still work as a one-card quick recall micro round');

const singleFactRecommendations = arcade.recommendGames([
  { id: 'solo_fact', question: '2+2', answer: '4', subject: 'Math', weakPoint: 'calculation' }
]);
assert(singleFactRecommendations.findIndex((item) => item.id === 'whack') < singleFactRecommendations.findIndex((item) => item.id === 'match'), 'available whack should rank before locked bubble match');
assert(singleFactRecommendations.every((item) => item.status === 'ready' || item.available === false), 'planned games should never be marked available');
assert.equal(arcade.selectCardsForGame(cards, 'whack', 99).length <= 12, true, 'game card selection should cap large limits');
assert.deepEqual(arcade.classifyCards([]), [], 'empty card classification should be safe');
assert.deepEqual(arcade.selectCardsForGame(null, 'whack', 8), [], 'card selection should tolerate null input');
assert.equal(arcade.buildWhackRound([], { limit: 8 }).total, 0, 'empty whack round should not fabricate cards');
assert.equal(arcade.buildQuestRound([], { limit: 8 }).total, 0, 'empty quest round should not fabricate cards');
assert.equal(arcade.buildSnakeRound([], { limit: 8 }).total, 0, 'empty snake round should not fabricate cards');
assert.equal(arcade.buildMatchRound([], { limit: 8 }).total, 0, 'empty bubble round should not fabricate pairs');

const match = arcade.buildMatchRound(cards, { limit: 3 });
const wrongMatchRecord = arcade.buildMatchAnswerRecord(
  { id: 'pair_c1_0_q', pairId: 'pair_c1_0', cardId: 'c1', side: 'question', text: '8脳7=?' },
  { id: 'pair_c2_1_a', pairId: 'pair_c2_1', cardId: 'c2', side: 'answer', text: '618骞?' },
  match.pairs
);
assert.equal(wrongMatchRecord.cardId, 'c1', 'match wrong pair should repair the first selected card');
assert.equal(wrongMatchRecord.correct, false, 'different bubble pairs should be marked wrong');
assert(wrongMatchRecord.answer.includes(' -> '), 'match repair answer should use an ASCII separator that survives miniapp logs');

const sameSideMatchRecord = arcade.buildMatchAnswerRecord(
  { id: 'pair_c1_0_q', pairId: 'pair_c1_0', cardId: 'c1', side: 'question', text: '8脳7=?' },
  { id: 'pair_c2_1_q', pairId: 'pair_c2_1', cardId: 'c2', side: 'question', text: '618?' },
  match.pairs
);
assert.equal(sameSideMatchRecord.recordable, false, 'same-side bubble taps should switch selection instead of counting as a wrong answer');
assert.equal(match.gameType, 'match');
assert(match.pairs.length >= 1, '泡泡消应使用真实短对应卡');
assert(match.tiles.length === match.pairs.length * 2, '泡泡消每张卡应生成题泡泡和对应泡泡');
assert(match.tiles.every((item) => item.sideLabel && item.pairId), '泡泡消泡泡应保留配对线索');

const ambiguousMatch = arcade.buildMatchRound([
  { id: 'm1', question: 'term', answer: 'A', subject: 'Science', weakPoint: 'symbol' },
  { id: 'm2', question: 'term', answer: 'B', subject: 'Science', weakPoint: 'symbol' },
  { id: 'm3', question: 'other', answer: 'B', subject: 'Science', weakPoint: 'symbol' }
], { limit: 3 });
const tileTexts = ambiguousMatch.tiles.map((item) => `${item.side}:${item.text}`);
assert.equal(new Set(tileTexts).size, tileTexts.length, 'bubble match should skip duplicate same-side labels to avoid ambiguous pairs');
assert.equal(arcade.distinctMatchCards([
  { id: 'm1', question: 'term', answer: 'A', subject: 'Science', weakPoint: 'symbol' },
  { id: 'm2', question: 'term', answer: 'B', subject: 'Science', weakPoint: 'symbol' }
]).length, 1, 'distinct match helper should expose playable pair count for page gating');

assert.equal(arcade.isSequenceCard(cards[4]), true, '步骤卡可进入贪吃蛇顺序关');
assert.deepEqual(
  arcade.sequenceParts({ answer: 'first -> second -> third' }),
  ['first', 'second', 'third'],
  'snake sequence parser should support ASCII arrows'
);
const snake = arcade.buildSnakeRound(cards, { limit: 2 });
assert.equal(snake.gameType, 'snake');
assert(snake.tracks.some((item) => item.cardId === 'c5'), '贪吃蛇顺序关应承接步骤型知识');
assert(snake.tracks[0].tiles.every((item) => typeof item.order === 'number'), '贪吃蛇步骤块保留正确顺序');
assert(snake.tracks[0].tiles.length >= 3, '贪吃蛇至少需要三个步骤块');

const summary = arcade.summarizeAttempt({
  gameType: 'whack',
  expectedTotal: 2,
  bestCombo: 2,
  answers: [
    { cardId: 'c1', correct: true },
    { cardId: 'c2', correct: false }
  ]
});
assert.equal(summary.accuracy, 50);
assert.equal(summary.xp, 10);
assert.equal(summary.skipped, 0);

const skippedSummary = arcade.summarizeAttempt({
  gameType: 'whack',
  expectedTotal: 4,
  answers: [{ cardId: 'c1', correct: true }]
});
assert.equal(skippedSummary.skipped, 3, 'summary should retain skipped count for unfinished rounds');

const unique = arcade.uniqueReviewAnswers([
  { cardId: 'c1', correct: false },
  { cardId: 'c1', correct: true },
  { cardId: 'c2', correct: true },
  { cardId: 'c3', correct: false, recordable: false },
  { correct: true }
]);
assert.equal(unique.length, 2, '同一局同一张卡只应进入一次复习调度');
assert.equal(unique[0].correct, false, '去重应保留首次学习证据，避免错后立刻改写为会了');

const uniqueWrong = arcade.uniqueWrongAnswers([
  { cardId: 'c1', correct: false },
  { cardId: 'c1', correct: false },
  { cardId: 'c2', correct: true },
  { cardId: 'c3', correct: false }
]);
assert.deepEqual(uniqueWrong.map((item) => item.cardId), ['c1', 'c3'], 'wrong-answer review should show each missed card once');

const entry = arcade.buildHomeArcadeEntry({ due: 3 }, cards);
assert.equal(entry.title, '轻练习');
assert(entry.action === 'goArcade' || entry.action === 'goLearningMap');

const whackAdvice = arcade.buildRoundAdvice(summary, 'whack');
assert(whackAdvice.title && whackAdvice.primary && whackAdvice.secondary, '局后建议应给出明确下一步');

const snakeAdvice = arcade.buildRoundAdvice({ passed: false, wrong: 1 }, 'snake');
assert(/顺序/.test(snakeAdvice.title + snakeAdvice.body + snakeAdvice.primary), '顺序玩法失败后应引导修复步骤断点');

const matchAdvice = arcade.buildRoundAdvice({ passed: false, wrong: 1 }, 'match');
assert(/泡泡|对应|错配/.test(matchAdvice.title + matchAdvice.body + matchAdvice.primary), '泡泡消失败后应引导修复对应关系');

const repairFocus = arcade.buildRepairFocus({
  cardId: 'c5',
  gameType: 'snake',
  selected: '最后检查单位',
  answer: '先圈已知条件 → 再列等量关系 → 最后检查单位',
  correct: false
}, cards);
assert.equal(repairFocus.cardId, 'c5');
assert(repairFocus.decision.includes('贪吃蛇'), '错题修复应保留游戏来源');
assert(repairFocus.tags.includes('轻回访'), '错题修复应进入真实学习证据链');

const repairFocusPayload = JSON.stringify(repairFocus);
assert(!/original_question|full_answer|full_solution|score|ranking|talent_label|完整答案|排名|分数/.test(repairFocusPayload), 'wrong-answer repair focus must not leak raw question, full answer, score, ranking, or talent fields');

console.log('All arcade engine tests pass.');
