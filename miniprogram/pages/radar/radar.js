const storage = require('../../utils/storage');
const api = require('../../utils/api');
const priority = require('../../utils/learning-priority');

Page({
  data: {
    state: null,
    axes: [],
    weakPoints: [],
    weekly: null,
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
