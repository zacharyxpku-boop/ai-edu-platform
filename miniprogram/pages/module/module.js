const modules = require('../../utils/learning-modules');
const storage = require('../../utils/storage');
const navigation = require('../../utils/navigation');
const api = require('../../utils/api');
const reviewCards = require('../../utils/review-cards');

function buildSessionSteps(item) {
  if (!item) return [];
  return [
    {
      id: 'setup',
      title: '定今晚目标',
      desc: item.userInput,
      evidence: '写下卡住的题型或具体任务。'
    },
    {
      id: 'practice',
      title: '做一小局',
      desc: item.aiTask,
      evidence: '留下一个第一步、一个易错点和一句修正后的表达。'
    },
    {
      id: 'mastery',
      title: '留证据',
      desc: item.mastery,
      evidence: item.parentScript
    }
  ];
}

Page({
  data: {
    module: null,
    source: '',
    feedbackText: '',
    feedbackReason: '',
    reviewPreview: [],
    reviewPackStatus: '',
    importedCount: 0,
    sessionSteps: [],
    activeStep: 'setup',
    evidenceText: '',
    sessionStatus: null,
    reviewStats: null,
    surfaceDepthPack: null
  },

  onLoad(query = {}) {
    const item = modules.getModule(query.id);
    if (!item) {
      wx.showToast({ title: '没有找到这个学习局', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 500);
      return;
    }
    const source = query.source || 'direct';
    this.trackEvent('module_viewed', item, { source });
    const pack = modules.toReviewPack(item);
    const reviewStats = (modules.reviewStatsByModule(storage.loadReviewCards ? storage.loadReviewCards() : [])[item.id]) || {
      cards: 0,
      due: 0,
      leech: 0,
      mastered: 0
    };
    this.setData({
      module: item,
      source,
      sessionSteps: buildSessionSteps(item),
      reviewPreview: pack ? reviewCards.previewImport(pack.text, pack.options).slice(0, 4) : [],
      reviewStats,
      surfaceDepthPack: storage.buildSurfaceDepthPack ? storage.buildSurfaceDepthPack('module') : null
    });
  },

  setStep(event) {
    this.setData({ activeStep: event.currentTarget.dataset.step || 'setup' });
  },

  onEvidenceInput(event) {
    this.setData({ evidenceText: event.detail.value });
  },

  startModule() {
    const item = this.data.module;
    const homework = modules.toHomework(item);
    if (!item || !homework) return;
    this.trackEvent('module_started', item, { source: this.data.source || 'direct' });
    storage.set(storage.KEYS.selectedHomework, homework);
    storage.set(storage.KEYS.selectedHomeworkSource, `module:${item.id}`);
    storage.set(storage.KEYS.tutorMessages, [
      {
        role: 'assistant',
        text: `开始这个学习局：${item.title}。${item.tutorPrompt}`
      }
    ]);
    navigation.navigateLearningRoute('/pages/tutor/tutor?from=module');
  },

  markModule(event) {
    const rating = event.currentTarget.dataset.rating;
    const item = this.data.module;
    if (!item || !rating) return;
    const reason = this.data.feedbackReason || '';
    storage.appendModuleFeedback(item, rating, { source: this.data.source || 'direct', reason });
    this.trackEvent(rating === 'useful' ? 'module_feedback_useful' : 'module_feedback_not_useful', item, {
      source: this.data.source || 'direct',
      reason
    });
    const text = rating === 'useful' ? '已标记：适合当前卡点' : '已标记：暂时不适合';
    this.setData({ feedbackText: text });
    wx.showToast({ title: text, icon: 'none' });
  },

  onReasonInput(event) {
    this.setData({ feedbackReason: event.detail.value });
  },

  completeModule() {
    const item = this.data.module;
    if (!item) return;
    const evidence = String(this.data.evidenceText || '').trim();
    this.trackEvent('module_completed', item, {
      source: this.data.source || 'direct',
      evidence
    });
    this.setData({
      feedbackText: '这个学习局已完成。',
      sessionStatus: {
        completed: true,
        evidence: evidence || '还没有写下证据',
        next: '导入复习包，让这个方法之后继续出现。'
      }
    });
    wx.showToast({ title: '已完成', icon: 'success' });
  },

  addReviewPack() {
    const item = this.data.module;
    const pack = modules.toReviewPack(item);
    if (!item || !pack) return;
    const result = reviewCards.importTextToDeck(pack.text, pack.options);
    const importedCount = result.imported || 0;
    this.trackEvent('module_review_pack_imported', item, {
      source: this.data.source || 'direct',
      imported: importedCount,
      skipped: result.skipped || 0
    });
    const reviewStats = (modules.reviewStatsByModule(storage.loadReviewCards ? storage.loadReviewCards() : [])[item.id]) || {
      cards: 0,
      due: 0,
      leech: 0,
      mastered: 0
    };
    this.setData({
      importedCount,
      reviewStats,
      reviewPackStatus: importedCount
        ? `Imported ${importedCount} review cards.`
        : 'This module already has review cards.'
    });
    wx.showToast({ title: importedCount ? 'Review added' : 'Already exists', icon: 'none' });
  },

  completeAndReview() {
    this.completeModule();
    this.addReviewPack();
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' });
  },

  goReview() {
    navigation.navigateLearningRoute('/pages/review/review?from=module');
  },

  trackEvent(eventName, item, props = {}) {
    const next = storage.trackModuleEvent(eventName, item, props);
    const event = next[0];
    api.submitEvent(event).catch(() => {});
  },

  runSurfaceDepthAction(event) {
    const dataset = event.currentTarget.dataset || {};
    const pack = this.data.surfaceDepthPack || {};
    const route = dataset.route || pack.primaryRoute;
    if (storage.recordSurfaceDepthAction) {
      storage.recordSurfaceDepthAction({
        surface: pack.surface || dataset.surface || '',
        dimensionId: dataset.dimensionId || '',
        label: dataset.label || '',
        route,
        readiness: pack.surfaceReadiness || ''
      });
    }
    navigation.navigateLearningRoute(route);
  },

});
