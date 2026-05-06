const reviewCards = require('../../utils/review-cards');
const storage = require('../../utils/storage');
const api = require('../../utils/api');

Page({
  data: {
    summary: null,
    cards: [],
    current: null,
    index: 0,
    showAnswer: false,
    done: false,
    progressText: '0/0',
    feedbackText: '',
    importText: '',
    importPreview: [],
    importPlan: null,
    dailyLimit: 5,
    desiredRetention: 90,
    editQuestion: '',
    editAnswer: '',
    editOpen: false,
    suspendedCards: [],
    buriedCards: [],
    browserQuery: '',
    browserStatus: 'all',
    browserSource: 'all',
    browserType: 'all',
    browserTemplate: 'all',
    browserCards: [],
    deckSnapshotText: '',
    sessionMode: 'smart',
    sessionFeedback: null,
    quizRunning: false,
    quizIndex: 0,
    quizCurrent: null,
    quizAnswers: [],
    quizShowAnswer: false,
    quizFeedback: null,
    reviewPlaybook: null,
    challengeCard: null
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const summary = reviewCards.reviewSummary();
    const limit = (summary.deck && summary.deck.dailyLimit) || 5;
    const cards = reviewCards.sessionCards(this.data.sessionMode, limit);
    this.setData({
      summary,
      cards,
      current: cards[0] || null,
      index: 0,
      showAnswer: false,
      done: !cards.length,
      progressText: cards.length ? `1/${cards.length}` : '0/0',
      feedbackText: '',
      editQuestion: cards[0] ? cards[0].question : '',
      editAnswer: cards[0] ? cards[0].answer : '',
      editOpen: false,
      dailyLimit: (summary.deck && summary.deck.dailyLimit) || 5,
      desiredRetention: Math.round(((summary.deck && summary.deck.desiredRetention) || 0.9) * 100),
      suspendedCards: reviewCards.suspendedCards(6),
      buriedCards: reviewCards.buriedCards(6),
      browserCards: reviewCards.cardBrowser(this.browserPayload()),
      quizRunning: false,
      quizIndex: 0,
      quizCurrent: null,
      quizAnswers: [],
      quizShowAnswer: false,
      reviewPlaybook: this.buildReviewPlaybook(summary, cards),
      challengeCard: this.buildChallengeCard(summary)
    });
  },

  buildReviewPlaybook(summary, cards) {
    const safe = summary || {};
    const nextStep = safe.nextStep || { mode: 'smart', message: 'Start with the highest value review queue.' };
    const quiz = safe.quiz || { count: 0, estimatedMinutes: 0 };
    const qualityQueue = safe.qualityQueue || [];
    const sources = safe.sources || [];
    const loop = safe.loop || {};
    return {
      title: 'DAILY REVIEW PLAYBOOK',
      label: 'One screen decides what to do now: review the right cards, quiz once, repair one wrong cause, then send the hard part back to tutor.',
      primary: {
        title: nextStep.message,
        meta: `${nextStep.mode || 'smart'} mode / ${cards.length || safe.due || 0} cards`,
        action: 'review'
      },
      stats: [
        { label: 'due', value: safe.due || 0 },
        { label: 'quiz', value: quiz.count || 0 },
        { label: 'repair', value: qualityQueue.length || 0 },
        { label: 'lives', value: `${loop.lives || 0}/${loop.maxLives || 0}` }
      ],
      actions: [
        {
          id: 'review',
          title: 'Run best queue',
          desc: 'Use the scheduler recommendation instead of reviewing everything.',
          action: 'review',
          cta: 'Review now'
        },
        {
          id: 'quiz',
          title: 'Take one quiz',
          desc: `Active recall check, about ${quiz.estimatedMinutes || 3} minutes.`,
          action: 'quiz',
          cta: 'Start quiz'
        },
        {
          id: 'repair',
          title: 'Repair one wrong cause',
          desc: qualityQueue[0] ? qualityQueue[0].reason : 'No urgent repair item right now.',
          action: 'repair',
          cta: 'Repair'
        },
        {
          id: 'tutor',
          title: 'Back to Yuan Xiao Dian',
          desc: 'If the child misses it again, return to the Socratic tutor before adding more cards.',
          action: 'tutor',
          cta: 'Open tutor'
        }
      ],
      moat: {
        title: 'Memory asset moat',
        label: `${sources.length} sources feeding one deck: radar, homework, tutor, modules and imports become compounding learning assets.`,
        score: safe.assetCompounding ? safe.assetCompounding.score : (safe.maturity ? safe.maturity.overall : 0)
      }
    };
  },

  buildChallengeCard(summary) {
    const safe = summary || {};
    const social = safe.socialChallenge || {};
    const progress = safe.progress || {};
    const season = safe.season || {};
    const quiz = safe.quiz || {};
    const goal = safe.goal || {};
    const firstMission = (social.missions || [])[0] || {};
    const name = (storage.loadProfile() && storage.loadProfile().name) || 'Learner';
    return {
      title: 'LOCAL CHALLENGE CARD',
      label: 'A share-ready local challenge card for parent groups and friend loops, without requiring real cloud social yet.',
      headline: `${name} is running a ${season.tier || 'Bronze'} recall sprint today.`,
      inviteCode: social.inviteCode || 'LOCAL-READY',
      shareCopy: `${name} today: ${goal.completed || 0}/${goal.target || 0} review goal, ${quiz.count || 0} quiz cards, ${progress.xp || 0} XP, invite ${social.inviteCode || 'LOCAL-READY'}.`,
      prompts: [
        `Mission: ${firstMission.title || 'Finish one focused recall sprint'}`,
        `Season checkpoint: ${season.checkpoint || 'Finish the daily mission'}`,
        `Daily prompt: ${social.dailyPrompt || 'Protect one weak point today.'}`
      ],
      stats: [
        { id: 'goal', label: 'goal', value: `${goal.completed || 0}/${goal.target || 0}` },
        { id: 'quiz', label: 'quiz', value: quiz.count || 0 },
        { id: 'xp', label: 'xp', value: progress.xp || 0 },
        { id: 'tier', label: 'tier', value: season.tier || 'Bronze' }
      ]
    };
  },

  runPlaybookAction(event) {
    const action = event.currentTarget.dataset.action;
    if (action === 'quiz') {
      this.startQuiz();
      return;
    }
    if (action === 'repair') {
      this.runMission({ currentTarget: { dataset: { action: 'repair' } } });
      return;
    }
    if (action === 'tutor') {
      this.goTutor();
      return;
    }
    const mode = (this.data.summary && this.data.summary.nextStep && this.data.summary.nextStep.mode) || 'smart';
    this.setData({ sessionMode: mode });
    this.refresh();
  },

  copyChallengeCard() {
    const card = this.data.challengeCard;
    if (!card) return;
    const text = [card.headline, card.shareCopy].concat(card.prompts || []).join('\n');
    wx.setClipboardData({
      data: text,
      success: () => {
        this.setData({ feedbackText: 'Challenge card copied. Share it to a parent group or study buddy.' });
      }
    });
  },

  browserPayload(patch = {}) {
    return {
      query: patch.query !== undefined ? patch.query : this.data.browserQuery,
      status: patch.status !== undefined ? patch.status : this.data.browserStatus,
      source: patch.source !== undefined ? patch.source : this.data.browserSource,
      type: patch.type !== undefined ? patch.type : this.data.browserType,
      template: patch.template !== undefined ? patch.template : this.data.browserTemplate,
      limit: 8
    };
  },

  setSessionMode(event) {
    this.setData({ sessionMode: event.currentTarget.dataset.mode || 'smart' });
    this.refresh();
  },

  runMission(event) {
    const action = event.currentTarget.dataset.action;
    if (action === 'quiz') {
      this.startQuiz();
      return;
    }
    if (action === 'repair') {
      const first = this.data.summary && this.data.summary.qualityQueue && this.data.summary.qualityQueue[0];
      if (first && first.noteId) {
        this.editQueueItem({ currentTarget: { dataset: { noteId: first.noteId } } });
      }
      return;
    }
    if (action === 'maintain') {
      this.setData({
        browserStatus: 'leech',
        browserCards: reviewCards.cardBrowser(this.browserPayload({ status: 'leech' })),
        feedbackText: 'Showing the highest-priority maintenance cards.'
      });
      return;
    }
    this.setData({ sessionMode: 'smart' });
    this.refresh();
  },

  importTemplateDeck(event) {
    const templateId = event.currentTarget.dataset.id;
    const templates = (this.data.summary && this.data.summary.publicDeckTemplates) || [];
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    const result = reviewCards.importTextToDeck(template.text, {
      source: 'public_template_deck',
      subject: template.subject || ''
    });
    this.setData({
      feedbackText: `Imported ${result.imported || 0} cards from ${template.title}.`
    });
    this.syncQuietly();
    this.refresh();
  },

  reveal() {
    if (!this.data.current) return;
    this.setData({ showAnswer: true });
  },

  startQuiz() {
    const quiz = this.data.summary && this.data.summary.quiz;
    if (!quiz || !quiz.questions || !quiz.questions.length) {
      wx.showToast({ title: 'No quiz cards yet', icon: 'none' });
      return;
    }
    this.setData({
      quizRunning: true,
      quizIndex: 0,
      quizCurrent: quiz.questions[0],
      quizAnswers: [],
      quizShowAnswer: false,
      quizFeedback: null
    });
  },

  revealQuizAnswer() {
    if (!this.data.quizRunning) return;
    this.setData({ quizShowAnswer: true });
  },

  answerQuiz(event) {
    const correct = event.currentTarget.dataset.correct === 'true';
    const quiz = this.data.summary && this.data.summary.quiz;
    const questions = (quiz && quiz.questions) || [];
    const question = questions[this.data.quizIndex];
    if (!question) return;
    const nextAnswers = this.data.quizAnswers.concat([{
      cardId: question.cardId,
      correct,
      rating: correct ? 'good' : 'again'
    }]);
    const nextIndex = this.data.quizIndex + 1;
    if (nextIndex >= questions.length) {
      const result = reviewCards.finishQuizAttempt(nextAnswers, { mode: quiz.mode });
      this.setData({
        quizRunning: false,
        quizIndex: 0,
        quizCurrent: null,
        quizAnswers: [],
        quizShowAnswer: false,
        quizFeedback: result,
        feedbackText: `Quiz ${result.correct}/${result.count}, repair +${result.repair_drills || 0}`
      });
      this.syncQuietly();
      this.refresh();
      return;
    }
    this.setData({
      quizIndex: nextIndex,
      quizCurrent: questions[nextIndex],
      quizAnswers: nextAnswers,
      quizShowAnswer: false
    });
  },

  syncQuietly() {
    api.flushLocalSyncQueue().then(() => {
      this.setData({ summary: reviewCards.reviewSummary() });
    });
  },

  claimReward(event) {
    const rewardId = event.currentTarget.dataset.id;
    if (!rewardId) return;
    const result = reviewCards.claimReward(rewardId, this.data.summary);
    if (!result.ok) {
      wx.showToast({ title: '奖励暂时不可领取', icon: 'none' });
      return;
    }
    this.setData({
      feedbackText: `已领取 ${result.reward.xp || 0} XP${result.reward.lives ? `，恢复 ${result.reward.lives} 点生命` : ''}`
    });
    this.syncQuietly();
    this.refresh();
  },

  rate(event) {
    const rating = event.currentTarget.dataset.rating || 'good';
    const current = this.data.current;
    if (!current) return;
    reviewCards.reviewCard(current.id, rating);
    const nextIndex = this.data.index + 1;
    const cards = this.data.cards;
    const done = nextIndex >= cards.length;
    const feedbackText = rating === 'again'
      ? '已安排明天再看，先回原小点拆错因。'
      : rating === 'hard'
        ? '已缩短间隔，后面还会更快出现。'
        : rating === 'easy'
          ? '已拉长间隔。'
          : '已记录掌握。';
    this.setData({
      index: nextIndex,
      current: done ? null : cards[nextIndex],
      showAnswer: false,
      done,
      progressText: done ? `${cards.length}/${cards.length}` : `${nextIndex + 1}/${cards.length}`,
      summary: reviewCards.reviewSummary(),
      feedbackText,
      editQuestion: done ? '' : cards[nextIndex].question,
      editAnswer: done ? '' : cards[nextIndex].answer,
      editOpen: false,
      sessionFeedback: done ? reviewCards.userSessionFeedback(this.data.sessionMode, cards.slice(0, nextIndex)) : this.data.sessionFeedback
    });
    this.syncQuietly();
    if (done) this.refresh();
  },

  onImportInput(event) {
    const importText = event.detail.value;
    const importPlan = reviewCards.contentEnginePlan(importText, {
      subject: (this.data.summary && this.data.summary.deck && this.data.summary.deck.subject) || ''
    });
    this.setData({
      importText,
      importPreview: importPlan.cards.slice(0, 5),
      importPlan
    });
  },

  importCards() {
    const text = String(this.data.importText || '').trim();
    if (!text) {
      wx.showToast({ title: '先粘贴笔记或错因', icon: 'none' });
      return;
    }
    this.setData({ feedbackText: '正在调用内容引擎生成卡片...' });
    api.buildContentCards({
      text,
      subject: (this.data.summary && this.data.summary.deck && this.data.summary.deck.subject) || ''
    }).then((engineResult) => {
      const result = reviewCards.importGeneratedCards(engineResult.cards || [], {
        source: engineResult.provider || 'remote_ai_content_engine_v1'
      });
      this.setData({
        importText: '',
        importPreview: [],
        importPlan: null,
        feedbackText: `AI 内容引擎已导入 ${result.imported || 0} 张，跳过重复 ${result.skipped || 0} 张`
      });
      this.syncQuietly();
      this.refresh();
    }).catch(() => {
      const result = reviewCards.importTextToDeck(text, { source: 'manual_import' });
      this.setData({
        importText: '',
        importPreview: [],
        importPlan: null,
        feedbackText: `本地内容引擎已导入 ${result.imported || 0} 张，跳过重复 ${result.skipped || 0} 张`
      });
      this.syncQuietly();
      this.refresh();
    });
  },

  onSettingInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [field]: event.detail.value });
  },

  onBrowserInput(event) {
    const query = event.detail.value;
    this.setData({
      browserQuery: query,
      browserCards: reviewCards.cardBrowser(this.browserPayload({ query }))
    });
  },

  setBrowserStatus(event) {
    const status = event.currentTarget.dataset.status || 'all';
    this.setData({ browserStatus: status, browserCards: reviewCards.cardBrowser(this.browserPayload({ status })) });
  },

  setBrowserSource(event) {
    const source = event.currentTarget.dataset.source || 'all';
    this.setData({ browserSource: source, browserCards: reviewCards.cardBrowser(this.browserPayload({ source })) });
  },

  setBrowserType(event) {
    const type = event.currentTarget.dataset.type || 'all';
    this.setData({ browserType: type, browserCards: reviewCards.cardBrowser(this.browserPayload({ type })) });
  },

  setBrowserTemplate(event) {
    const template = event.currentTarget.dataset.template || 'all';
    this.setData({ browserTemplate: template, browserCards: reviewCards.cardBrowser(this.browserPayload({ template })) });
  },

  exportDeck() {
    const text = JSON.stringify(reviewCards.exportDeckSnapshot());
    this.setData({
      deckSnapshotText: text,
      feedbackText: `已生成牌组快照，包含 ${reviewCards.reviewSummary().total} 张卡`
    });
  },

  onSnapshotInput(event) {
    this.setData({ deckSnapshotText: event.detail.value });
  },

  importDeckSnapshot() {
    const text = String(this.data.deckSnapshotText || '').trim();
    if (!text) {
      wx.showToast({ title: '先粘贴牌组 JSON', icon: 'none' });
      return;
    }
    try {
      const result = reviewCards.importDeckSnapshot(JSON.parse(text));
      this.setData({ feedbackText: `已合并 ${result.imported || 0} 张卡片` });
      this.syncQuietly();
      this.refresh();
    } catch (error) {
      wx.showToast({ title: 'JSON 格式不对', icon: 'none' });
    }
  },

  saveSettings() {
    const deck = reviewCards.updateDeckSettings({
      dailyLimit: Number(this.data.dailyLimit || 5),
      desiredRetention: Number(this.data.desiredRetention || 90) / 100
    });
    this.setData({
      feedbackText: `已更新：每日 ${deck.dailyLimit} 张，目标记忆率 ${Math.round(deck.desiredRetention * 100)}%`
    });
    this.refresh();
  },

  toggleEdit() {
    const current = this.data.current;
    this.setData({
      editOpen: !this.data.editOpen,
      editQuestion: current ? current.question : '',
      editAnswer: current ? current.answer : ''
    });
  },

  onEditInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [field]: event.detail.value });
  },

  saveEdit() {
    const current = this.data.current;
    if (!current) return;
    reviewCards.updateNote(current.noteId, {
      question: this.data.editQuestion,
      answer: this.data.editAnswer
    });
    this.setData({ feedbackText: '已更新卡片', editOpen: false });
    this.syncQuietly();
    this.refresh();
  },

  suspendCurrent() {
    const current = this.data.current;
    if (!current) return;
    reviewCards.setCardSuspended(current.id, true);
    this.setData({ feedbackText: '已暂停这张卡' });
    this.refresh();
  },

  resumeCard(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    reviewCards.setCardSuspended(id, false);
    this.setData({ feedbackText: '已恢复卡片' });
    this.refresh();
  },

  unburyCard(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    reviewCards.unburyCard(id);
    this.setData({ feedbackText: '已恢复兄弟卡' });
    this.refresh();
  },

  editQueueItem(event) {
    const noteId = event.currentTarget.dataset.noteId;
    if (!noteId) return;
    const result = reviewCards.repairNote(noteId);
    if (result && result.ok) {
      this.setData({
        feedbackText: `Auto repaired card. Quality ${result.updated.quality}, drill +${result.drillImported || 0}`
      });
      this.syncQuietly();
      this.refresh();
      return;
    }
    const card = reviewCards.cardByNote(noteId);
    if (!card) {
      wx.showToast({ title: '未找到对应卡片', icon: 'none' });
      return;
    }
    this.setData({
      current: card,
      showAnswer: true,
      editOpen: true,
      editQuestion: card.question || '',
      editAnswer: card.answer || '',
      feedbackText: '已定位到待修卡片'
    });
  },

  goTutor() {
    const current = this.data.current;
    if (current) {
      storage.set(storage.KEYS.selectedHomework, {
        id: `review_${current.id}`,
        text: current.question,
        reason: current.answer,
        minutes: 8,
        evidence: {
          tags: ['复习', current.type],
          decision: '来自原点复习，先拆错因再继续。',
          calibration_key: current.calibrationKey || `review:${current.id}`,
          misconception_tags: [
            {
              id: current.id,
              name: current.weakPoint || current.type,
              axis: current.subject || '复习',
              suggested_drill: current.answer
            }
          ]
        }
      });
      storage.set(storage.KEYS.selectedHomeworkSource, `review:${current.id}`);
    }
    wx.switchTab({ url: '/pages/tutor/tutor' });
  },

  goUpload() {
    wx.navigateTo({ url: '/pages/upload/upload' });
  }
});
