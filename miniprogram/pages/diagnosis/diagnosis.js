const api = require('../../utils/api');
const priority = require('../../utils/learning-priority');
const storage = require('../../utils/storage');
const navigation = require('../../utils/navigation');

function buildQuickSnap(form) {
  const prerequisite = String(form.snapPrerequisite || '').trim();
  const method = String(form.snapMethod || '').trim();
  const transfer = String(form.snapTransfer || '').trim();
  const signals = [];
  let axis = 'concept';
  let score = 72;
  let headline = '这三问在帮你找今晚第一步。';
  let nextMove = '回答这三个小问题，我会先判断今晚先从哪里开始。';

  if (!prerequisite) {
    signals.push('前置知识不清');
    axis = 'concept';
    score = 48;
    headline = '孩子可能还没把前置知识说清。';
    nextMove = '先补一条旧知识，再继续今晚这一步。';
  } else if (/不会|忘|不懂|没学|记不住|模糊/.test(prerequisite)) {
    signals.push('前置知识缺口');
    axis = 'concept';
    score = 52;
    headline = '孩子知道题目名字，但说不清前置规则。';
    nextMove = '先用一句话把旧知识补回来，再继续往下做。';
  }

  if (!method) {
    signals.push('缺第一步');
    axis = 'reading';
    score = Math.min(score, 46);
    headline = '孩子还说不出有用的第一步。';
    nextMove = '进入作业点拨，先把第一步说出来。';
  } else if (/看答案|直接算|乱写|不知道先/.test(method)) {
    signals.push('方法不稳');
    axis = 'reading';
    score = Math.min(score, 50);
    headline = '孩子在跳步骤，直接往答案冲。';
    nextMove = '先把方法搭起来，再开始算。';
  }

  if (!transfer) {
    signals.push('缺迁移证据');
    axis = axis === 'reading' ? 'reading' : 'transfer';
    score = Math.min(score, 54);
    headline = '还没有看到举一反三的证据。';
    nextMove = '再补一个小变式，看看能不能迁移。';
  } else if (/不会|不确定|换了就|一变就|类似题也错/.test(transfer)) {
    signals.push('迁移偏弱');
    axis = 'transfer';
    score = Math.min(score, 49);
    headline = '孩子会做例题，但一变式就容易卡住。';
    nextMove = '今晚先补一个小变式，再进复习包。';
  }

  const map = {
    concept: '概念理解',
    reading: '审题建模',
    transfer: '迁移应用'
  };
  const contexts = [
    prerequisite ? `前置知识：${prerequisite}` : '',
    method ? `第一步：${method}` : '',
    transfer ? `迁移反应：${transfer}` : ''
  ].filter(Boolean);

  return {
    axis,
    axisName: map[axis] || '概念理解',
    score,
    headline,
    nextMove,
    signals,
    context: contexts.join('\n')
  };
}

Page({
  data: {
    gradeOptions: ['三年级', '四年级', '五年级', '六年级', '初一', '初二'],
    subjectOptions: ['数学', '语文', '英语', '科学'],
    submitting: false,
    form: {
      grade: '五年级',
      subject: '数学',
      score: '',
      totalScore: '',
      minutes: 35,
      examText: '',
      homeworkText: '',
      snapPrerequisite: '',
      snapMethod: '',
      snapTransfer: ''
    },
    quickSnap: null,
    showDiagnosisDetails: false,
    surfaceDepthPack: null
  },

  onLoad() {
    const profile = storage.loadProfile();
    this.setData({
      form: Object.assign({}, this.data.form, {
        grade: profile.grade || '五年级',
        subject: profile.subject || '数学',
        minutes: profile.minutes || 35
      }),
      quickSnap: buildQuickSnap(this.data.form),
      surfaceDepthPack: storage.buildSurfaceDepthPack ? storage.buildSurfaceDepthPack('diagnosis') : null
    });
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field;
    const form = Object.assign({}, this.data.form, {
      [field]: event.detail.value
    });
    this.setData({
      form,
      quickSnap: buildQuickSnap(form)
    });
  },

  onGradeChange(event) {
    const grade = this.data.gradeOptions[Number(event.detail.value)] || '五年级';
    const form = Object.assign({}, this.data.form, { grade });
    this.setData({ form, quickSnap: buildQuickSnap(form) });
  },

  onSubjectChange(event) {
    const subject = this.data.subjectOptions[Number(event.detail.value)] || '数学';
    const form = Object.assign({}, this.data.form, { subject });
    this.setData({ form, quickSnap: buildQuickSnap(form) });
  },

  toggleDiagnosisDetails() {
    this.setData({ showDiagnosisDetails: !this.data.showDiagnosisDetails });
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' });
  },

  issueTypeFromQuickSnap(quickSnap) {
    const axis = quickSnap && quickSnap.axis;
    if (axis === 'concept') return '概念公式';
    if (axis === 'transfer') return '步骤断点';
    return '读题审题';
  },

  saveDiagnosisFocus(form, quickSnap, state) {
    if (!storage.saveTodayFocusFromThought) return null;
    const method = String(form.snapMethod || '').trim();
    const prerequisite = String(form.snapPrerequisite || '').trim();
    const transfer = String(form.snapTransfer || '').trim();
    const focusText = [
      method ? `我的第一步：${method}` : '',
      prerequisite ? `我先要看懂：${prerequisite}` : '',
      transfer ? `换条件时我可能卡在：${transfer}` : '',
      form.examText ? `补充卡点：${form.examText}` : ''
    ].filter(Boolean).join('\n');
    if (!focusText) return null;
    const focus = storage.saveTodayFocusFromThought(focusText, {
      source: 'mini-diagnosis',
      subject: form.subject || ((state && state.subject) || ''),
      title: method || prerequisite || '今晚第一步',
      issueType: this.issueTypeFromQuickSnap(quickSnap),
      isStuck: true,
      repairStatus: 'not_started',
      progress: 24,
      miniActionText: method,
      hasMiniActionDone: false,
      recommendation: quickSnap && quickSnap.nextMove ? quickSnap.nextMove : '先把第一步说清楚，再做一道小变式。'
    });
    if (storage.saveTodaySession) {
      storage.saveTodaySession({
        stuckPointText: focusText,
        taskType: storage.detectTaskType ? storage.detectTaskType(focusText, `${form.subject || ''} ${this.issueTypeFromQuickSnap(quickSnap)}`) : 'unknown',
        taskTypeConfirmed: true
      });
    }
    if (focus && storage.updateTonightRouteStatus) {
      storage.updateTonightRouteStatus('focus_created', { focusId: focus.id });
    }
    return focus;
  },

  submit() {
    if (this.data.submitting) return;
    const form = this.data.form;
    const quickSnap = buildQuickSnap(form);
    const snapContext = quickSnap.context ? `3-question snap\n${quickSnap.context}\n三问先看：${quickSnap.axisName} ${quickSnap.score}` : '';
    const payload = {
      source: 'mini-diagnosis',
      grade: form.grade,
      subject: form.subject,
      score: Number(form.score) || 0,
      totalScore: Number(form.totalScore) || 0,
      minutes: Number(form.minutes),
      examText: [form.examText, snapContext].filter(Boolean).join('\n'),
      homeworkText: form.homeworkText
    };

    storage.saveProfile({
      grade: form.grade,
      subject: form.subject,
      minutes: Number(form.minutes) || 35
    });
    if (storage.saveLearningReportState) {
      const reportInput = {
        mode: 'standard',
        sourceText: [
          form.examText,
          form.homeworkText,
          form.snapPrerequisite,
          form.snapMethod,
          form.snapTransfer,
          `年级：${form.grade}`,
          `学科：${form.subject}`,
          form.score ? `${form.subject} 分数 ${form.score}` : '',
          form.totalScore ? `总分：${form.totalScore}` : ''
        ].filter(Boolean).join('\n'),
        profileBasics: {
          grade: form.grade,
          age: '',
          gender: '',
          region: '',
          schoolType: ''
        },
        behaviorSignals: {
          studyMinutes: Number(form.minutes) || '',
          homeworkMinutes: '',
          classesCount: '',
          sleepHours: '',
          focusRating: ''
        },
        emotionSignals: {},
        interestSignals: {},
        assessmentAnswers: []
      };
      const reportState = storage.buildLearningReportFromInput
        ? storage.buildLearningReportFromInput(reportInput)
        : null;
      if (reportState) storage.saveLearningReportState(reportState, { skipBuild: true });
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '生成中' });

    api.buildPriority(payload).then((state) => {
      const savedState = Object.assign({}, state, {
        source: 'mini-diagnosis-server',
        quick_snap: quickSnap
      });
      storage.saveState(savedState);
      this.saveDiagnosisFocus(form, quickSnap, savedState);
      wx.showToast({ title: '已排好今晚安排', icon: 'success' });
      setTimeout(() => wx.navigateTo({ url: '/pages/radar/radar' }), 500);
    }).catch(() => {
      const state = priority.buildAssessment(payload);
      const savedState = Object.assign({}, state, {
        source: 'mini-diagnosis-local-fallback',
        quick_snap: quickSnap
      });
      storage.saveState(savedState);
      this.saveDiagnosisFocus(form, quickSnap, savedState);
      wx.showToast({ title: '已生成本地安排', icon: 'success' });
      setTimeout(() => wx.navigateTo({ url: '/pages/radar/radar' }), 500);
    }).finally(() => {
      wx.hideLoading();
      this.setData({ submitting: false });
    });
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
