const storage = require('../../utils/storage');

Page({
  data: {
    state: null,
    weakPoints: [],
    topMust: null,
    isDemo: false,
    stats: {
      must: 0,
      flexible: 0,
      skip: 0
    },
    updatedText: ''
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const state = storage.loadState();
    const plan = state.homework_plan || {};
    const mustDo = plan.must_do || [];
    this.setData({
      state,
      weakPoints: (state.weak_points || []).slice(0, 2),
      topMust: mustDo[0] || null,
      isDemo: state.source === 'demo',
      stats: {
        must: mustDo.length,
        flexible: (plan.flexible || []).length,
        skip: (plan.can_skip || []).length
      },
      updatedText: state.updated_at ? state.updated_at.slice(5, 16).replace('T', ' ') : '刚刚'
    });
  },

  goUpload() {
    wx.navigateTo({ url: '/pages/upload/upload' });
  },

  goDiagnosis() {
    wx.navigateTo({ url: '/pages/diagnosis/diagnosis' });
  },

  goTutor() {
    wx.switchTab({ url: '/pages/tutor/tutor' });
  },

  startTopMust() {
    if (this.data.topMust) {
      storage.set(storage.KEYS.selectedHomework, this.data.topMust);
      storage.set(storage.KEYS.selectedHomeworkSource, 'home_top_must');
    }
    wx.switchTab({ url: '/pages/tutor/tutor' });
  },

  goRadar() {
    wx.switchTab({ url: '/pages/radar/radar' });
  }
});
