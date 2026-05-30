const storage = require('../../utils/storage');
const navigation = require('../../utils/navigation');
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
    aiNotice: 'AI 辅助生成，供学习决策参考，老师和家长仍需判断。',
    plan: {
      must_do: [],
      flexible: [],
      can_skip: []
    },
    decisionBoard: null,
    parentActionHero: null,
    growthPath: null,
    recommendedModules: [],
    adaptivePath: null,
    surfaceDepthPack: null
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
      aiNotice: state.ai_notice || 'AI 辅助生成，供学习决策参考，老师和家长仍需判断。',
      plan,
      weaknessLoop: this.buildWeaknessLoop(state, plan, thinkingSummary, reviewSummary),
      decisionBoard: this.buildDecisionBoard(plan, adaptivePath, state),
      parentActionHero: this.buildParentActionHero(state, plan, reviewSummary, thinkingSummary),
      growthPath: this.buildGrowthPath(state, plan, reviewSummary, thinkingSummary),
      adaptivePath,
      surfaceDepthPack: storage.buildSurfaceDepthPack ? storage.buildSurfaceDepthPack('radar') : null,
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

  buildParentActionHero(state, plan, reviewSummary, thinkingSummary) {
    const weak = ((state && state.weak_points) || [])[0] || null;
    const firstMust = ((plan && plan.must_do) || [])[0] || null;
    const summary = (plan && plan.summary) || {};
    const thinking = thinkingSummary || {};
    const weakName = weak ? weak.name : '今晚先看这一点';
    return {
      title: firstMust ? '先做这一题型' : '先录入学习任务',
      focusTitle: firstMust ? `优先攻克「${weakName}」` : '先录入学习任务',
      subtitle: firstMust
        ? firstMust.text
        : '先填作业，我会先分出今晚先做和可以后放。',
      weakName,
      weakScore: weak ? weak.score : '--',
      mustMinutes: summary.must_minutes || 0,
      savedMinutes: summary.saved_minutes || 0,
      reviewAssets: reviewSummary.total || 0,
      thinkingProof: thinking.total || 0,
      primaryAction: firstMust ? 'startFirstMust' : 'goUpload',
      primaryLabel: firstMust ? '去作业点拨' : '录入作业',
      secondaryAction: 'goReview',
      secondaryLabel: '看学习证据'
    };
  },

  buildDecisionBoard(plan, adaptivePath, state) {
    const must = (plan && plan.must_do) || [];
    const firstMust = must[0] || null;
    const currentModule = adaptivePath && adaptivePath.current ? adaptivePath.current : null;
    const weak = ((state && state.weak_points) || [])[0] || null;
    return {
      title: '下一步怎么安排',
      label: '不是先问做多少，而是先定第一步、再定余力时做什么、最后定孩子要说出什么。',
      cards: [
        {
          id: 'must',
          title: '先从这里开始',
          body: firstMust ? firstMust.text : '还没有必须做，先更新学习任务。',
          meta: firstMust ? `${firstMust.minutes || 10} 分钟` : '先设置',
          action: firstMust ? 'startFirstMust' : 'goUpload',
          cta: firstMust ? '去点拨' : '录入作业'
        },
        {
          id: 'module',
          title: '作业后补这一块',
          body: currentModule ? currentModule.title : '打开最适合当前卡点的轻练习。',
          meta: currentModule ? `适配 ${currentModule.score}` : '自适应',
          action: 'goTools',
          cta: '去轻练习'
        },
        {
          id: 'proof',
          title: '先看什么',
          body: weak
            ? `让孩子讲清 ${weak.name} 里一个被纠正的点。`
            : '让孩子在结束前讲出一个今天学会的点。',
          meta: `${(plan && plan.summary && plan.summary.misconception_count) || 0} 次错因命中`,
          action: 'goReview',
          cta: '看复习证据'
        }
      ]
    };
  },

  buildGrowthPath(state, plan, reviewSummary, thinkingSummary) {
    const weak = ((state && state.weak_points) || [])[0] || {};
    const firstMust = ((plan && plan.must_do) || [])[0] || {};
    const review = reviewSummary || {};
    const thinking = thinkingSummary || {};
    const weakName = weak.name || '今晚这一步';
    return {
      title: '孩子会怎样变好',
      label: '这页不是用来制造焦虑，而是把今晚这一步变成几天后还能回想起来的进步路径。',
      weakName,
      promise: `${weakName} 从“看见问题”到“能讲清方法”，先留下一个可复述证据。`,
      steps: [
        {
          id: 'tonight',
          day: '现在',
          title: '只攻一个最关键点',
          body: firstMust.text || '先录入学习任务，锁定第一项必须做。',
          proof: '孩子说出第一步和卡住点'
        },
        {
          id: 'day3',
          day: '3 天',
          title: '错因进入轻回访',
          body: `${review.total || 0} 张复习资产会被安排到小测、修复和间隔复习。`,
          proof: '同类题先说方法再动笔'
        },
        {
          id: 'day7',
          day: '7 天',
          title: '留下可复述证据',
          body: `${thinking.total || 0} 条思考凭证会沉淀为周报证据。`,
          proof: '孩子能讲“我以前错在哪，现在先检查什么”'
        }
      ],
      parentQuestion: `收尾只问自己一句：这类题下次我会先检查 ${weakName} 的哪一步？`
    };
  },

  buildWeaknessLoop(state, plan, thinkingSummary, reviewSummary) {
    const weak = ((state && state.weak_points) || [])[0] || null;
    const firstMust = ((plan && plan.must_do) || [])[0] || null;
    const thinking = thinkingSummary || {};
    const review = reviewSummary || {};
    return {
      title: '今晚学习留痕',
      label: '在一页里看清：今晚先修哪、孩子怎么说出第一步、后面怎么轻回访。',
      cards: [
        {
          id: 'weak',
          title: '现在先看这里',
          value: weak ? `${weak.score}` : '--',
          note: weak ? weak.name : '先填今晚作业'
        },
        {
          id: 'must',
          title: '先做这一项',
          value: firstMust ? `${firstMust.minutes || 10}m` : '--',
          note: firstMust ? firstMust.text : '先录入作业'
        },
        {
          id: 'proof',
          title: '思考证据',
          value: thinking.total ? `${thinking.avgScore}` : '0',
          note: thinking.total ? `${thinking.total} 条记录 / ${thinking.proofSentence || 0} 条可复述` : '还没有点拨记录'
        },
        {
          id: 'memory',
          title: '复习资产',
          value: review.total ? `${review.total}` : '0',
          note: review.total ? `${review.due || 0} 张到期 / ${review.mastered || 0} 张掌握` : '还没有复习卡'
        }
      ],
      actions: [
        { id: 'upload', label: '更新作业', action: 'goUpload' },
        { id: 'tutor', label: '带必须做', action: 'startFirstMust' },
        { id: 'review', label: '看复习', action: 'goReview' },
        { id: 'cockpit', label: '去轻练习', action: 'goTools' }
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
    const size = 150;
    const center = size / 2;
    const radius = 52;
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
      ctx.setFontSize(8);
      ctx.fillText(axis.name.slice(0, 3), center + Math.cos(angle) * (radius + 10) - 12, center + Math.sin(angle) * (radius + 10) + 3);
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
    navigation.navigateLearningRoute('/pages/tutor/tutor?from=radar_select_homework');
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
      navigation.navigateLearningRoute('/pages/upload/upload?from=radar_empty');
      return;
    }
    storage.set(storage.KEYS.selectedHomework, item);
    storage.set(storage.KEYS.selectedHomeworkSource, 'radar_first_must');
    navigation.navigateLearningRoute('/pages/tutor/tutor?from=radar_first_must');
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
    navigation.navigateLearningRoute('/pages/upload/upload?from=radar');
  },

  goReview() {
    navigation.navigateLearningRoute('/pages/review/review?from=radar');
  },

  goTools() {
    navigation.navigateLearningRoute('/pages/tools/tools?from=radar');
  },

  goProfile() {
    wx.switchTab({ url: '/pages/profile/profile' });
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' });
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
