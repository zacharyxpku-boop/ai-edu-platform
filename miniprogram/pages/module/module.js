const modules = require('../../utils/learning-modules');
const storage = require('../../utils/storage');
const api = require('../../utils/api');
const reviewCards = require('../../utils/review-cards');

function buildSessionSteps(item) {
  if (!item) return [];
  return [
    {
      id: 'setup',
      title: 'Set the target',
      desc: item.userInput,
      evidence: 'Write the exact stuck point or task type.'
    },
    {
      id: 'practice',
      title: 'Run the method',
      desc: item.aiTask,
      evidence: 'Save one first step, one trap, and one corrected sentence or relation.'
    },
    {
      id: 'mastery',
      title: 'Check mastery',
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
    reviewStats: null
  },

  onLoad(query = {}) {
    const item = modules.getModule(query.id);
    if (!item) {
      wx.showToast({ title: 'Module not found', icon: 'none' });
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
      reviewStats
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
        text: `Start module: ${item.title}. ${item.tutorPrompt}`
      }
    ]);
    wx.switchTab({ url: '/pages/tutor/tutor' });
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
    const text = rating === 'useful' ? 'Marked useful for current weak point.' : 'Marked not fitting right now.';
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
      feedbackText: 'Module session completed.',
      sessionStatus: {
        completed: true,
        evidence: evidence || 'No written evidence yet',
        next: 'Add a review pack so this method returns in spaced review.'
      }
    });
    wx.showToast({ title: 'Completed', icon: 'success' });
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

  goReview() {
    wx.navigateTo({ url: '/pages/review/review' });
  },

  trackEvent(eventName, item, props = {}) {
    const next = storage.trackModuleEvent(eventName, item, props);
    const event = next[0];
    api.submitEvent(event).catch(() => {});
  }
});
