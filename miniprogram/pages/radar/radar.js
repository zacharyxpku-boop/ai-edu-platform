const storage = require('../../utils/storage');
const api = require('../../utils/api');
const priority = require('../../utils/learning-priority');
const learningModules = require('../../utils/learning-modules');
const reviewCards = require('../../utils/review-cards');

Page({
  data: {
    state: null,
    axes: [],
    weakPoints: [],
    weekly: null,
    feedbackSummary: null,
    calibrationProfile: null,
    proofSummary: {
      mustMinutes: 0,
      savedMinutes: 0,
      misconceptionCount: 0,
      mustRate: '0%'
    },
    thinkingSummary: null,
    reviewSummary: null,
    weaknessLoop: null,
    feedbackStatus: {},
    feedbackStatusMust: [],
    feedbackStatusFlexible: [],
    feedbackStatusSkip: [],
    aiNotice: 'AI 辅助生成，供家长决策参考，不替代老师判断。',
    plan: {
      must_do: [],
      flexible: [],
      can_skip: []
    },
    decisionBoard: null,
    recommendedModules: [],
    adaptivePath: null
  },

  onShow() {
    const state = storage.loadState();
    const plan = state.homework_plan || { must_do: [], flexible: [], can_skip: [] };
    const moduleEvents = storage.loadModuleEvents();
    const moduleFeedback = storage.moduleFeedbackMap();
    const thinkingSummary = storage.thinkingReceiptSummary ? storage.thinkingReceiptSummary() : null;
    const reviewSummary = reviewCards.reviewSummary();
    const adaptivePath = learningModules.buildAdaptivePath(
      state,
      moduleFeedback,
      moduleEvents,
      5,
      storage.loadReviewCards()
    );
    this.setData({
      state,
      axes: state.axes || [],
      weakPoints: state.weak_points || [],
      weekly: state.weekly_review || priority.buildWeeklyReview(state.axes || [], state.weak_points || [], plan),
      feedbackSummary: storage.feedbackSummary(),
      calibrationProfile: storage.familyCalibrationProfile(),
      proofSummary: this.buildProofSummary(plan),
      thinkingSummary,
      reviewSummary,
      aiNotice: state.ai_notice || 'AI 辅助生成，供家长决策参考，不替代老师判断。',
      plan,
      weaknessLoop: this.buildWeaknessLoop(state, plan, thinkingSummary, reviewSummary),
      decisionBoard: this.buildDecisionBoard(plan, adaptivePath, state),
      adaptivePath,
      recommendedModules: adaptivePath.current
        ? [adaptivePath.current].concat(adaptivePath.next).slice(0, 3)
        : learningModules.recommendModules(state, 3, moduleFeedback, moduleEvents)
    });
    setTimeout(() => this.drawRadar(), 80);
    this.refreshWeekly(state, plan);
  },

  buildProofSummary(plan) {
    const must = plan.must_do || [];
    const flexible = plan.flexible || [];
    const skip = plan.can_skip || [];
    const total = must.length + flexible.length + skip.length;
    const summary = plan.summary || {};
    return {
      mustMinutes: summary.must_minutes || must.reduce((sum, item) => sum + Number(item.minutes || 0), 0),
      savedMinutes: summary.saved_minutes || skip.reduce((sum, item) => sum + Number(item.minutes || 0), 0),
      misconceptionCount: summary.misconception_count || must.concat(flexible, skip).reduce((sum, item) => {
        return sum + (((item.evidence || {}).misconception_tags || []).length);
      }, 0),
      mustRate: total ? `${Math.round((must.length / total) * 100)}%` : '0%'
    };
  },

  buildDecisionBoard(plan, adaptivePath, state) {
    const must = (plan && plan.must_do) || [];
    const firstMust = must[0] || null;
    const currentModule = adaptivePath && adaptivePath.current ? adaptivePath.current : null;
    const weak = ((state && state.weak_points) || [])[0] || null;
    return {
      title: 'TONIGHT DECISION BOARD',
      label: 'This is the parent-facing decision layer: what to do first, what to study next, and what can wait until the child still has energy.',
      cards: [
        {
          id: 'must',
          title: 'Start here',
          body: firstMust ? firstMust.text : 'No must-do item yet. Update homework first.',
          meta: firstMust ? `${firstMust.minutes || 10} min` : 'setup',
          action: firstMust ? 'startFirstMust' : 'goUpload',
          cta: firstMust ? 'Start tutor' : 'Update homework'
        },
        {
          id: 'module',
          title: 'Method after homework',
          body: currentModule ? currentModule.title : 'Open the study module that best matches the weak point.',
          meta: currentModule ? `${currentModule.score} fit` : 'adaptive',
          action: 'goTools',
          cta: 'Open cockpit'
        },
        {
          id: 'proof',
          title: 'Parent proof tonight',
          body: weak
            ? `Ask the child to explain one corrected idea about ${weak.name}.`
            : 'Ask the child to explain one corrected idea before ending tonight.',
          meta: `${(plan && plan.summary && plan.summary.misconception_count) || 0} wrong-cause hits`,
          action: 'goReview',
          cta: 'Open review'
        }
      ]
    };
  },

  buildWeaknessLoop(state, plan, thinkingSummary, reviewSummary) {
    const weak = ((state && state.weak_points) || [])[0] || null;
    const firstMust = ((plan && plan.must_do) || [])[0] || null;
    const thinking = thinkingSummary || {};
    const review = reviewSummary || {};
    return {
      title: 'WEAKNESS PROOF LOOP',
      label: 'One screen for the full story: weak point, must-do task, tutor thinking proof, and memory assets.',
      cards: [
        {
          id: 'weak',
          title: 'Weak point',
          value: weak ? `${weak.score}` : '--',
          note: weak ? weak.name : 'Waiting for diagnosis'
        },
        {
          id: 'must',
          title: 'Must-do first',
          value: firstMust ? `${firstMust.minutes || 10}m` : '--',
          note: firstMust ? firstMust.text : 'Update homework'
        },
        {
          id: 'proof',
          title: 'Thinking proof',
          value: thinking.total ? `${thinking.avgScore}` : '0',
          note: thinking.total ? `${thinking.total} receipts / ${thinking.proofSentence || 0} proof lines` : 'No tutor receipts yet'
        },
        {
          id: 'memory',
          title: 'Memory assets',
          value: review.total ? `${review.total}` : '0',
          note: review.total ? `${review.due || 0} due / ${review.mastered || 0} mastered` : 'No review cards yet'
        }
      ],
      actions: [
        { id: 'upload', label: 'Refresh homework', action: 'goUpload' },
        { id: 'tutor', label: 'Coach must-do', action: 'startFirstMust' },
        { id: 'review', label: 'Open review', action: 'goReview' },
        { id: 'cockpit', label: 'Open tools', action: 'goTools' }
      ]
    };
  },

  refreshWeekly(state, plan) {
    if (!state || !plan) return;
    api.buildWeekly({
      axes: state.axes || [],
      weak_points: state.weak_points || [],
      homework_plan: plan,
      grade: state.grade,
      subject: state.subject
    }).then((weekly) => {
      if (!weekly || weekly.ok === false) return;
      const merged = Object.assign({}, state, { weekly_review: weekly });
      storage.saveState(merged);
      this.setData({ weekly });
    }).catch(() => {});
  },

  drawRadar() {
    const axes = this.data.axes || [];
    if (!axes.length) return;
    const ctx = wx.createCanvasContext('radarCanvas', this);
    const size = 300;
    const center = size / 2;
    const radius = 104;
    const count = axes.length;

    ctx.clearRect(0, 0, size, size);
    ctx.setStrokeStyle('#E4D9C8');
    ctx.setLineWidth(1);
    for (let level = 1; level <= 4; level += 1) {
      ctx.beginPath();
      for (let i = 0; i < count; i += 1) {
        const angle = -Math.PI / 2 + (Math.PI * 2 * i) / count;
        const r = (radius * level) / 4;
        const x = center + Math.cos(angle) * r;
        const y = center + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    axes.forEach((axis, i) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * i) / count;
      const x = center + Math.cos(angle) * radius;
      const y = center + Math.sin(angle) * radius;
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.setFillStyle('#625B50');
      ctx.setFontSize(10);
      ctx.fillText(axis.name.slice(0, 4), center + Math.cos(angle) * (radius + 16) - 18, center + Math.sin(angle) * (radius + 16) + 4);
    });

    ctx.beginPath();
    axes.forEach((axis, i) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * i) / count;
      const r = radius * (Number(axis.score || 0) / 100);
      const x = center + Math.cos(angle) * r;
      const y = center + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.setFillStyle('rgba(15, 79, 61, 0.18)');
    ctx.fill();
    ctx.setStrokeStyle('#0F4F3D');
    ctx.setLineWidth(2);
    ctx.stroke();
    ctx.draw();
  },

  selectHomework(event) {
    const bucket = event.currentTarget.dataset.bucket;
    const index = Number(event.currentTarget.dataset.index);
    const list = (this.data.plan && this.data.plan[bucket]) || [];
    const item = list[index];
    if (!item) return;
    storage.set(storage.KEYS.selectedHomework, item);
    storage.set(storage.KEYS.selectedHomeworkSource, bucket);
    wx.switchTab({ url: '/pages/tutor/tutor' });
  },

  markFeedback(event) {
    const bucket = event.currentTarget.dataset.bucket;
    const index = Number(event.currentTarget.dataset.index);
    const rating = event.currentTarget.dataset.rating;
    const list = (this.data.plan && this.data.plan[bucket]) || [];
    const item = list[index];
    if (!item || !rating) return;

    const feedback = {
      kind: 'homework_priority',
      target_id: item.id || `${bucket}_${index}`,
      rating,
      bucket,
      reason: rating === 'accurate' ? 'family_confirmed' : 'family_marked_off',
      item_text: item.text || '',
      calibration_key: item.evidence && item.evidence.calibration_key,
      priority_vector: item.priority_vector || {},
      misconception_tags: (item.evidence && item.evidence.misconception_tags) || [],
      state_summary: {
        grade: this.data.state && this.data.state.grade,
        subject: this.data.state && this.data.state.subject,
        weak_points: this.data.weakPoints || []
      }
    };
    const nextList = storage.appendFeedback(feedback);
    const key = `${bucket}_${index}`;
    const statusListKey = bucket === 'must_do'
      ? 'feedbackStatusMust'
      : bucket === 'flexible'
        ? 'feedbackStatusFlexible'
        : 'feedbackStatusSkip';
    const localStatus = rating === 'accurate' ? '已记录：判断准' : '已记录：需要校准';
    this.setData({
      [`feedbackStatus.${key}`]: localStatus,
      [`${statusListKey}[${index}]`]: localStatus,
      feedbackSummary: {
        total: nextList.length,
        accurate: nextList.filter((fb) => fb.rating === 'accurate').length,
        off: nextList.filter((fb) => fb.rating === 'off').length,
        label: `已记录 ${nextList.length} 条校准`
      },
      calibrationProfile: storage.familyCalibrationProfile()
    });

    api.submitFeedback(feedback).then((result) => {
      if (!result || result.ok === false) return;
      const syncedStatus = rating === 'accurate' ? '已同步：判断准' : '已同步：需要校准';
      this.setData({
        [`feedbackStatus.${key}`]: syncedStatus,
        [`${statusListKey}[${index}]`]: syncedStatus
      });
    }).catch(() => {
      const offlineStatus = '已本地记录，联网后再同步';
      this.setData({
        [`feedbackStatus.${key}`]: offlineStatus,
        [`${statusListKey}[${index}]`]: offlineStatus
      });
    });
  },

  startFirstMust() {
    const item = (this.data.plan.must_do || [])[0];
    if (!item) {
      wx.navigateTo({ url: '/pages/upload/upload' });
      return;
    }
    storage.set(storage.KEYS.selectedHomework, item);
    storage.set(storage.KEYS.selectedHomeworkSource, 'radar_first_must');
    wx.switchTab({ url: '/pages/tutor/tutor' });
  },

  runDecisionAction(event) {
    const action = event.currentTarget.dataset.action;
    if (action && typeof this[action] === 'function') {
      this[action]();
    }
  },

  openModule(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/module/module?id=${id}&source=radar_recommend` });
  },

  goUpload() {
    wx.navigateTo({ url: '/pages/upload/upload' });
  },

  goReview() {
    wx.navigateTo({ url: '/pages/review/review' });
  },

  goTools() {
    wx.switchTab({ url: '/pages/tools/tools' });
  }
});
