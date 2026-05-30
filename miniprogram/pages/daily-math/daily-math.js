const lightFeatures = require('../../utils/light-features');
const storage = require('../../utils/storage');
const navigation = require('../../utils/navigation');
const shareRelaySchema = require('../../utils/share-relay-schema');

Page({
  data: {
    session: lightFeatures.buildDailyMath(),
    answers: [],
    result: null,
    transitionPrompt: null,
    surfaceDepthPack: null,
    lightSeedBank: null
  },

  onLoad() {
    this.setData({
      session: lightFeatures.buildDailyMath(),
      surfaceDepthPack: storage.buildSurfaceDepthPack ? storage.buildSurfaceDepthPack('daily_math') : null,
      lightSeedBank: storage.buildLightEntrySeedBank ? storage.buildLightEntrySeedBank('daily_math') : null
    });
  },

  regenerate() {
    this.setData({
      session: lightFeatures.buildDailyMath(),
      answers: [],
      result: null,
      transitionPrompt: null,
      surfaceDepthPack: storage.buildSurfaceDepthPack ? storage.buildSurfaceDepthPack('daily_math') : null,
      lightSeedBank: storage.buildLightEntrySeedBank ? storage.buildLightEntrySeedBank('daily_math') : null
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

  buildDailyMathSharePayload() {
    const result = this.data.result || {};
    const shareCode = `daily_math_${Date.now()}`;
    return shareRelaySchema.buildSafeSharePayload({
      code: shareCode,
      payload: {}
    }, 'daily_math_first_step', {
      from: 'daily_math',
      mode: 'safe_relay',
      relay_first_step: (result.shareCard && result.shareCard.body) || '先看清符号和进位',
      relay_receiver_action: '接收者只做 1 道同类口算，并说出自己的第一步。',
      relay_parent_check: '家长只问：你先看符号、进位、退位还是小数点？',
      relay_next_revisit: '明天回访同一类第一步，不晒分数、不排名。',
      safe_relay_blocked_fields: 'original_question,full_answer,photo,score,ranking,full_dialogue',
      share_privacy_boundary: '只分享第一步方法，不分享答案、分数、排名、照片或完整对话。'
    });
  },

  shareFirstStep() {
    const payload = this.buildDailyMathSharePayload();
    if (storage.appendShareRun) {
      storage.appendShareRun({
        type: 'daily_math_safe_share_ready',
        source: 'daily_math',
        share_code: payload.share_code,
        payload,
        blockedFields: payload.blocked_fields
      });
    }
    this.setData({ safeSharePayload: payload });
    wx.showToast({ title: '已生成安全分享卡', icon: 'none' });
  },

  onShareAppMessage() {
    const profile = storage.loadProfile ? storage.loadProfile() : {};
    const name = profile.name || '我家孩子';
    const result = this.data.result || {};
    const count = Math.max(0, 10 - Number(result.mistakeCount || 0));
    const payload = this.data.safeSharePayload || this.buildDailyMathSharePayload();
    const path = shareRelaySchema.buildShareRelayQuery('/pages/home/home', payload, { forceCompact: true });
    if (storage.appendShareRun) {
      storage.appendShareRun({
        type: 'daily_math_share_sent',
        source: 'daily_math',
        share_code: payload.share_code,
        path,
        payload,
        blockedFields: payload.blocked_fields
      });
    }
    return {
      title: `${name} 今天口算先看清了 ${count} 道第一步`,
      path
    };
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
