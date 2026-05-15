const arcade = require('../../utils/arcade-engine');
const reviewCards = require('../../utils/review-cards');
const storage = require('../../utils/storage');
const api = require('../../utils/api');

Page({
  data: {
    summary: null,
    cards: [],
    classifications: [],
    recommendations: [],
    visibleRecommendations: [],
    selectedGame: 'whack',
    gameMode: 'whack',
    round: null,
    currentIndex: 0,
    currentQuestion: null,
    revealed: false,
    snakeTrack: null,
    snakeTiles: [],
    snakeNextOrder: 0,
    matchTiles: [],
    matchSelectedTile: null,
    matchPairsDone: 0,
    activeGame: null,
    moleHoles: [],
    lives: 3,
    combo: 0,
    bestCombo: 0,
    score: 0,
    startXp: 0,
    xpGained: 0,
    answers: [],
    reviewedCardIds: {},
    wrongAnswers: [],
    repairFocus: null,
    result: null,
    resultAdvice: null,
    emptyGuide: null,
    feedbackText: '',
    expandedMatrix: false,
    recentTaskType: 'unknown',
    learningBoundLine: '',
    gameBlocked: false
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const summary = reviewCards.reviewSummary();
    const limit = (summary.deck && summary.deck.dailyLimit) || 8;
    const dueCards = reviewCards.sessionCards('smart', limit);
    const fallbackCards = reviewCards.cardBrowser({ status: 'all', limit: 12 });
    const todaySession = storage.getTodaySession ? storage.getTodaySession() : null;
    const todayFocus = storage.loadTodayFocus ? storage.loadTodayFocus() : null;
    const loopFocus = todaySession && todaySession.childArticulatedStep ? todaySession : todayFocus;
    const recentTaskType = (loopFocus && loopFocus.taskType) || 'unknown';
    const taskBoundCards = this.cardsForRecentTaskType(recentTaskType, loopFocus);
    const loopBoundCards = this.loopBoundCards(dueCards.concat(fallbackCards), taskBoundCards, loopFocus);
    const cards = loopBoundCards.length ? loopBoundCards : (dueCards.length ? dueCards : (fallbackCards.length ? fallbackCards : taskBoundCards));
    const recommendations = arcade.recommendGames(cards);
    const selectedGame = (recommendations.find((item) => item.available) || recommendations[0] || {}).id || 'whack';
    const round = this.buildRoundForGame(selectedGame, cards);
    const profile = storage.loadGameProfile ? storage.loadGameProfile() : {};
    this.setData({
      summary,
      cards,
      startXp: Number(profile.xp || 0),
      classifications: arcade.classifyCards(cards),
      recommendations,
      visibleRecommendations: this.visibleRecommendations(recommendations, false),
      selectedGame,
      gameMode: selectedGame,
      activeGame: recommendations.find((item) => item.id === selectedGame) || null,
      round,
      currentIndex: 0,
      currentQuestion: this.firstQuestionForRound(round, selectedGame),
      revealed: false,
      snakeTrack: selectedGame === 'snake' ? this.firstQuestionForRound(round, selectedGame) : null,
      snakeTiles: selectedGame === 'snake' && round.tracks && round.tracks[0] ? round.tracks[0].tiles : [],
      snakeNextOrder: 0,
      matchTiles: selectedGame === 'match' && round.tiles ? round.tiles : [],
      matchSelectedTile: null,
      matchPairsDone: 0,
      moleHoles: this.buildHoles(round.questions && round.questions[0], round.holes),
      lives: 3,
      combo: 0,
      bestCombo: 0,
      score: 0,
      xpGained: 0,
      answers: [],
      reviewedCardIds: {},
      wrongAnswers: [],
      repairFocus: null,
      result: null,
      resultAdvice: null,
      emptyGuide: this.emptyGuide(selectedGame, round),
      feedbackText: (round.questions || round.tracks || round.pairs || []).length ? this.openingHint(selectedGame) : '还没有适合游戏化的真实学习卡。'
      ,
      recentTaskType,
      learningBoundLine: todaySession && todaySession.gamePlayed
        ? '今天已经练过了，先去专注或复习吧'
        : this.learningBoundLine(recentTaskType, loopFocus),
      gameBlocked: !!(todaySession && todaySession.gamePlayed)
    });
  },

  wrongCauseForLoop(todayFocus = {}) {
    const plan = todayFocus && todayFocus.nextPracticePlan;
    if (plan && plan.wrongCauseBucket) return plan;
    if (todayFocus && todayFocus.wrongCauseBucket) {
      return {
        wrongCauseBucket: todayFocus.wrongCauseBucket,
        wrongCauseLabel: todayFocus.wrongCauseLabel || '第一步确认',
        checkpoint: todayFocus.checkpoint || '先说自己准备从哪里开始。',
        parentPrompt: todayFocus.parentPrompt || '你第一步先做了什么？',
        nextPracticeText: todayFocus.repairPlan || '把第一步写成一句话，再进入专注。'
      };
    }
    if (storage.wrongCauseFromFirstStep) {
      const cause = storage.wrongCauseFromFirstStep(
        todayFocus && (todayFocus.childArticulatedStep || todayFocus.systemSuggestedStep || todayFocus.title),
        todayFocus && todayFocus.taskType
      );
      return {
        wrongCauseBucket: cause.id,
        wrongCauseLabel: cause.label,
        checkpoint: cause.checkpoint,
        parentPrompt: cause.parentPrompt,
        nextPracticeText: cause.nextPracticeText
      };
    }
    return {
      wrongCauseBucket: 'first_step',
      wrongCauseLabel: '第一步确认',
      checkpoint: '先说自己准备从哪里开始。',
      parentPrompt: '你第一步先做了什么？',
      nextPracticeText: '把第一步写成一句话，再进入专注。'
    };
  },

  loopBoundCards(reviewList = [], taskBoundCards = [], todayFocus = {}) {
    const cause = this.wrongCauseForLoop(todayFocus);
    const taskType = todayFocus && todayFocus.taskType;
    const seen = {};
    const matched = (reviewList || []).filter((card) => {
      if (!card || !card.id) return false;
      if (cause.wrongCauseBucket && card.wrongCauseBucket === cause.wrongCauseBucket) return true;
      if (taskType && taskType !== 'unknown' && card.taskType === taskType) return true;
      const text = [card.question, card.answer, card.weakPoint, card.checkpoint].join(' ');
      return cause.wrongCauseLabel && text.indexOf(cause.wrongCauseLabel) >= 0;
    });
    return (taskBoundCards || []).concat(matched).filter((card) => {
      const id = card && card.id;
      if (!id || seen[id]) return false;
      seen[id] = true;
      return true;
    }).slice(0, 12);
  },

  cardsForRecentTaskType(taskType, todayFocus = {}) {
    const target = String((todayFocus && (todayFocus.childArticulatedStep || todayFocus.systemSuggestedStep || todayFocus.title)) || '').trim();
    const cause = this.wrongCauseForLoop(todayFocus);
    const map = {
      math_word_problem: [
        { question: '应用题第一眼先找什么？', answer: '数字', hint: '先圈数字和问题句。' },
        { question: '题目问什么要先标哪里？', answer: '问号', hint: '先把问题句读慢一点。' }
      ],
      equation_setup: [
        { question: '列方程前先写什么？', answer: '未知数', hint: '先把未知量写成 x。' },
        { question: '方程中间要找什么？', answer: '等量关系', hint: '先问两边什么相等。' }
      ],
      reading_question: [
        { question: '阅读题先看什么？', answer: '题目问法', hint: '先看细节、主旨还是原因。' },
        { question: '回文定位先找什么？', answer: '关键词', hint: '先圈关键词再回原文。' }
      ],
      english_sentence: [
        { question: '英语句子先找什么？', answer: '主语', hint: '先找谁做动作。' },
        { question: '看时态前先找什么？', answer: '谓语', hint: '先找动作或 be 动词。' }
      ],
      writing_process: [
        { question: '写作开头先写什么？', answer: '一句话', hint: '先写最简单的一句。' },
        { question: '展开前先列什么？', answer: '要点', hint: '先列两个要点。' }
      ],
      unknown: [
        { question: '卡住时先说什么？', answer: '第一步', hint: '先说准备从哪里开始。' }
      ]
    };
    return (map[taskType] || map.unknown).map((item, index) => ({
      id: `task_${taskType}_${index}`,
      question: target ? `${target}：${item.question}` : item.question,
      answer: item.answer,
      hint: `${item.hint} ${cause.checkpoint}`,
      subject: taskType.indexOf('math') >= 0 || taskType.indexOf('equation') >= 0 ? '数学' : '',
      source: 'recent_task_type',
      taskType,
      wrongCauseBucket: cause.wrongCauseBucket,
      wrongCauseLabel: cause.wrongCauseLabel,
      checkpoint: cause.checkpoint,
      parentPrompt: cause.parentPrompt,
      nextPracticePlan: cause
    }));
  },

  learningBoundLine(taskType, todayFocus = {}) {
    const step = todayFocus && (todayFocus.childArticulatedStep || todayFocus.systemSuggestedStep || todayFocus.title);
    const cause = this.wrongCauseForLoop(todayFocus);
    if (step) return `本局跟着最近这一步练：${step}。重点回访：${cause.wrongCauseLabel}`;
    if (taskType && taskType !== 'unknown') return `本局跟着最近题型练：${taskType}`;
    return '先完成一次点拨或错题修复，小游戏会跟着最近题型走。';
  },

  buildRoundForGame(gameId, cards) {
    if (gameId === 'quiz') return arcade.buildQuestRound(cards, { limit: 5 });
    if (gameId === 'snake') return arcade.buildSnakeRound(cards, { limit: 4 });
    if (gameId === 'match') return arcade.buildMatchRound(cards, { limit: 5 });
    return arcade.buildWhackRound(cards, { limit: 8 });
  },

  openingHint(gameId) {
    if (gameId === 'quiz') return '先在心里说一遍，再核对思路自评。不会的卡会回到复习队列。';
    if (gameId === 'snake') return '按正确顺序吃掉步骤块，吃错的步骤会回到复习队列。';
    if (gameId === 'match') return '先点一个题泡泡，再点对应泡泡。错配会回到复习队列。';
    return '今天只开一小局，答错的卡会回到复习队列。';
  },

  emptyGuide(gameId, round) {
    const total = Number((round && round.total) || 0);
    if (total > 0) return null;
    const guides = {
      whack: {
        title: '缺少短回忆卡',
        body: '打地鼠适合口算、单词、年代、符号这类能快速回答的卡。',
        cta: '去生成短卡',
        action: 'goTools'
      },
      quiz: {
        title: '缺少概念轻练卡',
        body: '轻练答题适合原因、定义、关系、应用题思路这类需要先回忆再解释的卡。',
        cta: '去生成概念卡',
        action: 'goTools'
      },
      snake: {
        title: '缺少顺序步骤卡',
        body: '贪吃蛇适合解题步骤、实验流程、历史时间线和操作顺序。',
        cta: '去生成步骤卡',
        action: 'goTools'
      },
      match: {
        title: '缺少短对应卡',
        body: '泡泡消适合单词-释义、年代-事件、符号-含义这类一问一答的短卡。',
        cta: '去生成对应卡',
        action: 'goTools'
      }
    };
    return guides[gameId] || {
      title: '还没有可玩的真实卡片',
      body: '先从作业、错题或教材章节生成学习卡，再回来轻回访。',
      cta: '去生成学习卡',
      action: 'goTools'
    };
  },

  firstQuestionForRound(round, gameId) {
    if (gameId === 'snake') return (round.tracks && round.tracks[0]) || null;
    if (gameId === 'match') return (round.pairs && round.pairs[0]) || null;
    return (round.questions && round.questions[0]) || null;
  },

  visibleRecommendations(recommendations, expanded) {
    const limit = expanded ? 9 : 4;
    const list = recommendations || [];
    const ready = list.filter((item) => item.status === 'ready');
    return ready.slice(0, limit);
  },

  buildHoles(question, holeCount = 9) {
    const total = Math.max(4, Math.min(9, Number(holeCount || 9)));
    if (!question) {
      return Array.from({ length: total }, (_, index) => ({ id: `empty_${index}`, label: '', active: false }));
    }
    const choices = (question.choices || []).slice(0, Math.min(4, total));
    const holeTargets = Array.isArray(question.holeTargets) && question.holeTargets.length >= choices.length
      ? question.holeTargets
      : arcade.buildHoleTargets(question.cardId || question.id, choices.length, total);
    const holes = Array.from({ length: total }, (_, index) => ({
      id: `hole_${question.id}_${index}`,
      label: '',
      active: false,
      correct: false,
      cardId: question.cardId
    }));
    choices.forEach((choice, idx) => {
      const target = Number(holeTargets[idx]);
      holes[target] = Object.assign({}, holes[target], {
        label: choice,
        active: true,
        correct: choice === question.answer
      });
    });
    return holes;
  },

  selectGame(event) {
    const gameId = event.currentTarget.dataset.id || 'whack';
    const game = this.data.recommendations.find((item) => item.id === gameId);
    if (!game || !game.available) {
      this.setData({ feedbackText: (game && game.lockedReason) || '先生成真实学习卡后再玩这个玩法。' });
      return;
    }
    const round = this.buildRoundForGame(gameId, this.data.cards);
    this.setData({
      selectedGame: gameId,
      gameMode: gameId,
      activeGame: game,
      round,
      currentIndex: 0,
      currentQuestion: this.firstQuestionForRound(round, gameId),
      revealed: false,
      snakeTrack: gameId === 'snake' ? this.firstQuestionForRound(round, gameId) : null,
      snakeTiles: gameId === 'snake' && round.tracks && round.tracks[0] ? round.tracks[0].tiles : [],
      snakeNextOrder: 0,
      matchTiles: gameId === 'match' && round.tiles ? round.tiles : [],
      matchSelectedTile: null,
      matchPairsDone: 0,
      moleHoles: this.buildHoles(round.questions && round.questions[0], round.holes),
      lives: 3,
      combo: 0,
      bestCombo: 0,
      score: 0,
      xpGained: 0,
      answers: [],
      reviewedCardIds: {},
      wrongAnswers: [],
      repairFocus: null,
      result: null,
      resultAdvice: null,
      emptyGuide: this.emptyGuide(gameId, round),
      feedbackText: this.openingHint(gameId)
    });
  },

  toggleMatrix() {
    const expandedMatrix = !this.data.expandedMatrix;
    this.setData({
      expandedMatrix,
      visibleRecommendations: this.visibleRecommendations(this.data.recommendations, expandedMatrix)
    });
  },

  tapMatchTile(event) {
    if (this.data.result || this.data.gameMode !== 'match') return;
    const tileId = event.currentTarget.dataset.id;
    const tile = (this.data.matchTiles || []).find((item) => item.id === tileId);
    if (!tile || tile.matched) return;
    const selected = this.data.matchSelectedTile;
    if (!selected) {
      this.setData({
        matchSelectedTile: tile,
        matchTiles: this.data.matchTiles.map((item) => Object.assign({}, item, {
          selected: item.id === tile.id,
          missed: false
        })),
        feedbackText: `泡泡发光了：${tile.text}。再点它的另一半。`
      });
      return;
    }
    if (selected.id === tile.id) {
      this.setData({
        matchSelectedTile: null,
        matchTiles: this.data.matchTiles.map((item) => Object.assign({}, item, { selected: false })),
        feedbackText: '已取消选择。'
      });
      return;
    }
    if (selected.side === tile.side) {
      this.setData({
        matchSelectedTile: tile,
        matchTiles: this.data.matchTiles.map((item) => Object.assign({}, item, {
          selected: item.id === tile.id,
          missed: false
        })),
        feedbackText: `已换成：${tile.text}。再点它的另一半。`
      });
      return;
    }
    const correct = selected.pairId === tile.pairId && selected.side !== tile.side;
    const combo = correct ? this.data.combo + 1 : 0;
    const bestCombo = Math.max(this.data.bestCombo, combo);
    const lives = correct ? this.data.lives : Math.max(0, this.data.lives - 1);
    const score = this.data.score + (correct ? 16 + Math.max(0, combo - 1) * 2 : 0);
    const answerRecord = arcade.buildMatchAnswerRecord(
      selected,
      tile,
      (this.data.round && this.data.round.pairs) || []
    );
    if (answerRecord.recordable === false) {
      this.setData({ matchSelectedTile: null });
      return;
    }
    const answers = this.data.answers.concat([answerRecord]);
    const xpAccepted = this.recordCardResult(answerRecord.cardId, correct, correct ? 'good' : 'again', 'match');
    const matchPairsDone = this.data.matchPairsDone + (correct ? 1 : 0);
    const nextTiles = this.data.matchTiles.map((item) => {
      const isPair = correct && item.pairId === tile.pairId;
      return Object.assign({}, item, {
        matched: item.matched || isPair,
        selected: false,
        missed: !correct && (item.id === tile.id || item.id === selected.id)
      });
    });

    if (lives <= 0 || matchPairsDone >= this.data.round.total) {
      this.setData({
        matchTiles: nextTiles,
        matchSelectedTile: null,
        matchPairsDone,
        answers
      });
      this.finishRound(answers, bestCombo, score, lives);
      return;
    }

    this.setData({
      matchTiles: nextTiles,
      matchSelectedTile: null,
      matchPairsDone,
      lives,
      combo,
      bestCombo,
      score,
      xpGained: Number(this.data.xpGained || 0) + Number(xpAccepted || 0),
      answers,
      feedbackText: correct ? `啵，消掉一对！Combo ${combo}` : `这对没有粘住。正确关系：${answerRecord.answer}`
    });
  },

  revealAnswer() {
    if (!this.data.currentQuestion || this.data.result) return;
    this.setData({
      revealed: true,
      feedbackText: '核对思路后，按真实掌握程度选择。'
    });
  },

  gradeQuest(event) {
    if (this.data.result || !this.data.currentQuestion || !this.data.revealed) return;
    const rating = event.currentTarget.dataset.rating || 'again';
    const current = this.data.currentQuestion;
    const correct = rating !== 'again';
    const combo = correct ? this.data.combo + 1 : 0;
    const bestCombo = Math.max(this.data.bestCombo, combo);
    const lives = correct ? this.data.lives : Math.max(0, this.data.lives - 1);
    const score = this.data.score + (rating === 'easy' ? 18 : rating === 'good' ? 14 : 0);
    const answers = this.data.answers.concat([{
      cardId: current.cardId,
      correct,
      selected: rating === 'easy' ? '记得' : rating === 'good' ? '模糊' : '忘记',
      answer: current.answer,
      rating,
      gameType: 'quiz'
    }]);
    const xpAccepted = this.recordCardResult(current.cardId, correct, rating, 'quiz');
    const nextIndex = this.data.currentIndex + 1;
    if (lives <= 0 || nextIndex >= this.data.round.questions.length) {
      this.finishRound(answers, bestCombo, score, lives);
      return;
    }
    const nextQuestion = this.data.round.questions[nextIndex];
    this.setData({
      currentIndex: nextIndex,
      currentQuestion: nextQuestion,
      revealed: false,
      lives,
      combo,
      bestCombo,
      score,
      xpGained: Number(this.data.xpGained || 0) + Number(xpAccepted || 0),
      answers,
      feedbackText: correct ? '继续下一关。先回忆，再核对思路。' : `参考思路：${current.answer}。这张卡会回到复习队列。`
    });
  },

  tapSnakeTile(event) {
    if (this.data.result || !this.data.snakeTrack) return;
    const tileId = event.currentTarget.dataset.id;
    const tile = (this.data.snakeTiles || []).find((item) => item.id === tileId);
    if (!tile || tile.eaten) return;
    const current = this.data.snakeTrack;
    const correct = Number(tile.order) === Number(this.data.snakeNextOrder || 0);
    const combo = correct ? this.data.combo + 1 : 0;
    const bestCombo = Math.max(this.data.bestCombo, combo);
    const lives = correct ? this.data.lives : Math.max(0, this.data.lives - 1);
    const score = this.data.score + (correct ? 12 + Math.max(0, combo - 1) : 0);
    const nextTiles = this.data.snakeTiles.map((item) => item.id === tile.id ? Object.assign({}, item, {
      eaten: correct,
      missed: !correct
    }) : item);
    const completedTrack = correct && Number(this.data.snakeNextOrder || 0) + 1 >= current.correctOrder.length;
    const answers = completedTrack || !correct
      ? this.data.answers.concat([{
        cardId: current.cardId,
        correct,
        selected: tile.text,
        answer: current.correctOrder.join(' -> '),
        gameType: 'snake'
      }])
      : this.data.answers;
    const xpAccepted = completedTrack || !correct
      ? this.recordCardResult(current.cardId, correct, correct ? 'good' : 'again', 'snake')
      : 0;

    if (!correct) {
      this.setData({ snakeTiles: nextTiles });
      this.finishRound(answers, bestCombo, score, lives);
      return;
    }

    if (completedTrack) {
      const nextIndex = this.data.currentIndex + 1;
      if (nextIndex >= this.data.round.tracks.length) {
        this.finishRound(answers, bestCombo, score, lives);
        return;
      }
      const nextTrack = this.data.round.tracks[nextIndex];
      this.setData({
        currentIndex: nextIndex,
        currentQuestion: nextTrack,
        snakeTrack: nextTrack,
        snakeTiles: nextTrack.tiles,
        snakeNextOrder: 0,
        lives,
        combo,
        bestCombo,
        score,
        xpGained: Number(this.data.xpGained || 0) + Number(xpAccepted || 0),
        answers,
        feedbackText: '小藤吃完整条顺序了，继续下一条。'
      });
      return;
    }

    this.setData({
      snakeTiles: nextTiles,
      snakeNextOrder: Number(this.data.snakeNextOrder || 0) + 1,
      lives,
      combo,
      bestCombo,
      score,
      answers,
      feedbackText: `小藤吃对了：${tile.text}`
    });
  },

  tapHole(event) {
    if (this.data.result || !this.data.currentQuestion) return;
    const index = Number(event.currentTarget.dataset.index || 0);
    const hole = this.data.moleHoles[index];
    if (!hole || !hole.active) return;

    const current = this.data.currentQuestion;
    const correct = !!hole.correct;
    const combo = correct ? this.data.combo + 1 : 0;
    const bestCombo = Math.max(this.data.bestCombo, combo);
    const lives = correct ? this.data.lives : Math.max(0, this.data.lives - 1);
    const score = this.data.score + (correct ? 10 + Math.max(0, combo - 1) * 2 : 0);
    const answers = this.data.answers.concat([{
      cardId: current.cardId,
      correct,
      selected: hole.label,
      answer: current.answer,
      gameType: 'whack'
    }]);

    const xpAccepted = this.recordCardResult(current.cardId, correct, correct ? 'good' : 'again', 'whack');

    const nextIndex = this.data.currentIndex + 1;
    if (lives <= 0 || nextIndex >= this.data.round.questions.length) {
      this.finishRound(answers, bestCombo, score, lives);
      return;
    }

    const nextQuestion = this.data.round.questions[nextIndex];
    this.setData({
      currentIndex: nextIndex,
      currentQuestion: nextQuestion,
      moleHoles: this.buildHoles(nextQuestion, this.data.round.holes),
      lives,
      combo,
      bestCombo,
      score,
      xpGained: Number(this.data.xpGained || 0) + Number(xpAccepted || 0),
      answers,
      feedbackText: correct ? `芽锤敲中！Combo ${combo}` : `参考思路：${current.answer}。这张卡会回到复习队列。`
    });
  },

  recordCardResult(cardId, correct, rating, gameType) {
    if (!cardId) return 0;
    const reviewedCardIds = this.data.reviewedCardIds || {};
    if (reviewedCardIds[cardId]) {
      storage.appendReviewEvent({
        kind: 'arcade_attempt_duplicate',
        game_type: gameType || this.data.selectedGame || 'whack',
        card_id: cardId,
        review_rating: rating || (correct ? 'good' : 'again'),
        result: correct ? 'correct' : 'wrong',
        xp: 0
      });
      return 0;
    }
    const reviewRating = rating || (correct ? 'good' : 'again');
    const before = storage.loadGameProfile ? storage.loadGameProfile() : {};
    reviewCards.reviewCard(cardId, reviewRating);
    const after = storage.loadGameProfile ? storage.loadGameProfile() : before;
    const xpAccepted = Math.max(0, Number(after.xp || 0) - Number(before.xp || 0));
    storage.appendReviewEvent({
      kind: 'arcade_attempt',
      game_type: gameType || this.data.selectedGame || 'whack',
      card_id: cardId,
      review_rating: reviewRating,
      result: correct ? 'correct' : 'wrong',
      xp: xpAccepted
    });
    this.setData({
      reviewedCardIds: Object.assign({}, reviewedCardIds, {
        [cardId]: true
      })
    });
    return xpAccepted;
  },

  finishRound(answers, bestCombo, score, lives) {
    const result = arcade.summarizeAttempt({
      gameType: this.data.selectedGame || 'whack',
      expectedTotal: this.data.round.total,
      bestCombo,
      answers
    });
    const profile = storage.loadGameProfile ? storage.loadGameProfile() : {};
    const xpGained = Math.max(0, Number(profile.xp || 0) - Number(this.data.startXp || 0));
    const savedResult = Object.assign({}, result, { xp: xpGained });
    const wrongAnswers = arcade.uniqueWrongAnswers(answers);
    const repairFocus = wrongAnswers.length ? arcade.buildRepairFocus(wrongAnswers[0], this.data.cards) : null;
    const gameRetention = storage.recordGameSessionResult
      ? storage.recordGameSessionResult(savedResult, { gameType: savedResult.gameType })
      : null;
    const incomingShare = storage.loadIncomingShare ? storage.loadIncomingShare() : null;
    storage.appendSyncMutation('arcade_attempt', {
      game_type: savedResult.gameType,
      total: savedResult.total,
      correct: savedResult.correct,
      wrong: savedResult.wrong,
      accuracy: savedResult.accuracy,
      xp: savedResult.xp,
      best_combo: savedResult.bestCombo,
      share_code: incomingShare && incomingShare.share_code ? incomingShare.share_code : ''
    });
    if (storage.saveTodaySession) {
      const session = storage.getTodaySession ? storage.getTodaySession() : {};
      const cause = this.wrongCauseForLoop(session);
      const rewardLine = savedResult.passed
        ? `完成一次${cause.wrongCauseLabel}轻练，学习记录已写回。`
        : `${cause.wrongCauseLabel}会回到下次复习，不算失败。`;
      storage.saveTodaySession({
        gamePlayed: true,
        gameEvidence: {
          taskType: session.taskType || this.data.recentTaskType || 'unknown',
          firstStep: session.childArticulatedStep || '',
          wrongCauseBucket: cause.wrongCauseBucket,
          wrongCauseLabel: cause.wrongCauseLabel,
          nextPracticePlan: cause,
          score: Number(savedResult.accuracy || 0),
          completed: true,
          streak: gameRetention && gameRetention.profile ? Number(gameRetention.profile.streak || 0) : 0,
          newlyUnlocked: gameRetention && gameRetention.newlyUnlocked ? gameRetention.newlyUnlocked.map((item) => item.id) : [],
          rewardLine
        }
      });
    }
    api.submitEvent({
      event: 'arcade_completed',
      source: 'arcade',
      entity_id: savedResult.gameType,
      page: 'arcade',
      payload: {
        game_type: savedResult.gameType,
        total: savedResult.total,
        correct: savedResult.correct,
        wrong: savedResult.wrong,
        accuracy: savedResult.accuracy,
        xp: savedResult.xp,
        best_combo: savedResult.bestCombo,
        wrong_count: wrongAnswers.length,
        share_code: incomingShare && incomingShare.share_code ? incomingShare.share_code : '',
        share_mode: incomingShare && incomingShare.mode ? incomingShare.mode : '',
        identity_tag: incomingShare && incomingShare.identity_tag ? incomingShare.identity_tag : ''
      }
    }).catch(() => {});
    api.submitQuiz({
      answers: arcade.uniqueReviewAnswers(answers),
      attempt_answers: answers,
      mode: `arcade_${savedResult.gameType}`,
      profile: storage.loadGameProfile ? storage.loadGameProfile() : {}
    }).catch(() => {});
    this.setData({
      result: savedResult,
      resultAdvice: arcade.buildRoundAdvice(savedResult, savedResult.gameType),
      lives,
      score,
      bestCombo,
      xpGained,
      wrongAnswers,
      repairFocus,
      feedbackText: result.passed ? '通关了，错因会按间隔复习继续回访。' : '没关系，错因卡已经回到复习队列。'
    });
  },

  restartRound() {
    const round = this.buildRoundForGame(this.data.selectedGame, this.data.cards);
    const next = this.firstQuestionForRound(round, this.data.selectedGame);
    this.setData({
      round,
      currentIndex: 0,
      currentQuestion: next,
      revealed: false,
      snakeTrack: this.data.selectedGame === 'snake' ? next : null,
      snakeTiles: this.data.selectedGame === 'snake' && next ? next.tiles : [],
      snakeNextOrder: 0,
      matchTiles: this.data.selectedGame === 'match' && round.tiles ? round.tiles : [],
      matchSelectedTile: null,
      matchPairsDone: 0,
      activeGame: this.data.recommendations.find((item) => item.id === this.data.selectedGame) || null,
      moleHoles: this.buildHoles(round.questions && round.questions[0], round.holes),
      lives: 3,
      combo: 0,
      bestCombo: 0,
      score: 0,
      xpGained: 0,
      answers: [],
      reviewedCardIds: {},
      wrongAnswers: [],
      repairFocus: null,
      result: null,
      resultAdvice: null,
      emptyGuide: this.emptyGuide(this.data.selectedGame, round),
      feedbackText: '新一局开始。'
    });
  },

  runGuideAction(event) {
    const action = event.currentTarget.dataset.action || 'goTools';
    if (action && typeof this[action] === 'function') this[action]();
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack();
      return;
    }
    wx.switchTab({ url: '/pages/home/home' });
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' });
  },

  goTools() {
    wx.switchTab({ url: '/pages/tools/tools' });
  },

  goReview() {
    wx.switchTab({ url: '/pages/review/review' });
  },

  runResultSecondary() {
    if (this.data.repairFocus) {
      this.repairWrongCard();
      return;
    }
    this.goReview();
  },

  repairWrongCard() {
    const focus = this.data.repairFocus;
    if (!focus || !focus.cardId) {
      this.goReview();
      return;
    }
    storage.set(storage.KEYS.selectedHomework, {
      id: focus.id,
      text: focus.text,
      reason: focus.reason,
      minutes: focus.minutes,
      evidence: {
        tags: focus.tags,
        decision: focus.decision,
        calibration_key: focus.calibrationKey,
        misconception_tags: [
          {
            id: focus.cardId,
            name: focus.knowledgeType,
            axis: focus.gameName,
            suggested_drill: focus.correctAnswer
          }
        ],
        arcade: {
          game_type: focus.gameType,
          selected: focus.selected,
          correct_answer: focus.correctAnswer
        }
      }
    });
    storage.set(storage.KEYS.selectedHomeworkSource, `arcade:${focus.gameType}:${focus.cardId}`);
    storage.appendReviewEvent({
      kind: 'arcade_repair_started',
      game_type: focus.gameType,
      card_id: focus.cardId,
      selected: focus.selected,
      answer: focus.correctAnswer
    });
    wx.navigateTo({ url: '/pages/tutor/tutor?from=arcade' });
  }
});
