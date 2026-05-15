const lightFeatures = require('../../utils/light-features');
const storage = require('../../utils/storage');

Page({
  data: {
    session: lightFeatures.buildDailyMath(),
    answers: [],
    result: null,
    transitionPrompt: null
  },

  onLoad() {
    this.setData({ session: lightFeatures.buildDailyMath() });
  },

  regenerate() {
    this.setData({
      session: lightFeatures.buildDailyMath(),
      answers: [],
      result: null,
      transitionPrompt: null
    });
  },

  onAnswerInput(event) {
    const index = Number(event.currentTarget.dataset.index || 0);
    const answers = (this.data.answers || []).slice();
    answers[index] = event.detail.value;
    this.setData({ answers });
  },

  submit() {
    const result = lightFeatures.submitDailyMath(this.data.answers || [], this.data.session);
    storage.recordLightEntryCompletion && storage.recordLightEntryCompletion('daily_math', {
      mathCompletionTime: new Date().toISOString(),
      mistakeCount: result.mistakeCount
    });
    this.setData({
      result,
      transitionPrompt: {
        title: '今晚作业有卡住的题吗？',
        body: '咕点可以陪你看看第一步。',
        acceptText: '去看看',
        rejectText: '今晚很顺，不用啦'
      }
    });
  },

  goCoreLoopFromMath() {
    storage.recordLightToCoreTransition && storage.recordLightToCoreTransition('daily_math', true, {
      mathToDiagnosisClick: true
    });
    storage.recordCoreLoopEntry && storage.recordCoreLoopEntry('daily_math_transition', {
      feature: 'daily_math'
    });
    wx.navigateTo({ url: '/pages/diagnosis/diagnosis?from=daily_math' });
  },

  dismissMathTransition() {
    storage.recordLightToCoreTransition && storage.recordLightToCoreTransition('daily_math', false, {
      mathToDiagnosisClick: false
    });
    this.setData({ transitionPrompt: null });
  },

  shareFirstStep() {
    wx.showToast({ title: '已生成第一步分享卡', icon: 'none' });
  },

  onShareAppMessage() {
    const profile = storage.loadProfile ? storage.loadProfile() : {};
    const name = profile.name || '我家孩子';
    const result = this.data.result || {};
    const count = Math.max(0, 10 - Number(result.mistakeCount || 0));
    return {
      title: `${name} 今天口算先看清了 ${count} 道第一步`,
      path: '/pages/daily-math/daily-math'
    };
  }
});
