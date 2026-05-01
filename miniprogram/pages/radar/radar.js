const storage = require('../../utils/storage');
const api = require('../../utils/api');
const priority = require('../../utils/learning-priority');

Page({
  data: {
    state: null,
    axes: [],
    weakPoints: [],
    weekly: null,
    feedbackSummary: null,
    feedbackStatus: {},
    feedbackStatusMust: [],
    feedbackStatusFlexible: [],
    feedbackStatusSkip: [],
    aiNotice: 'AI 辅助生成，供家长决策参考，不替代老师判断。',
    plan: {
      must_do: [],
      flexible: [],
      can_skip: []
    }
  },

  onShow() {
    const state = storage.loadState();
    const plan = state.homework_plan || { must_do: [], flexible: [], can_skip: [] };
    this.setData({
      state,
      axes: state.axes || [],
      weakPoints: state.weak_points || [],
      weekly: state.weekly_review || priority.buildWeeklyReview(state.axes || [], state.weak_points || [], plan),
      feedbackSummary: storage.feedbackSummary(),
      aiNotice: state.ai_notice || 'AI 辅助生成，供家长决策参考，不替代老师判断。',
      plan
    });
    setTimeout(() => this.drawRadar(), 80);
    this.refreshWeekly(state, plan);
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
      }
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

  goUpload() {
    wx.navigateTo({ url: '/pages/upload/upload' });
  }
});
