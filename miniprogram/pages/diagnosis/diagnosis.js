const api = require('../../utils/api');
const priority = require('../../utils/learning-priority');
const storage = require('../../utils/storage');

function buildQuickSnap(form) {
  const prerequisite = String(form.snapPrerequisite || '').trim();
  const method = String(form.snapMethod || '').trim();
  const transfer = String(form.snapTransfer || '').trim();
  const signals = [];
  let axis = 'concept';
  let score = 72;
  let headline = 'Quick snap is collecting learning signals.';
  let nextMove = 'Answer the three prompts to produce a first weak-point guess.';

  if (!prerequisite) {
    signals.push('missing prerequisite explanation');
    axis = 'concept';
    score = 48;
    headline = 'The learner may be missing prerequisite knowledge.';
    nextMove = 'Route to prerequisite check before adding more practice.';
  } else if (/不会|忘|不懂|没学|记不住|模糊/.test(prerequisite)) {
    signals.push('prerequisite gap');
    axis = 'concept';
    score = 52;
    headline = 'The learner knows the topic name but cannot explain the prior rule.';
    nextMove = 'Rebuild the old knowledge in one sentence, then test again.';
  }

  if (!method) {
    signals.push('missing first step');
    axis = 'reading';
    score = Math.min(score, 46);
    headline = 'The learner cannot name the first useful step yet.';
    nextMove = 'Send this to tutor and force a first-step explanation before solving.';
  } else if (/看答案|直接算|乱写|不知道先/.test(method)) {
    signals.push('method breakdown');
    axis = 'reading';
    score = Math.min(score, 50);
    headline = 'The learner is skipping the route and jumping toward the answer.';
    nextMove = 'Use tutor only for route-building and wrong-cause repair.';
  }

  if (!transfer) {
    signals.push('missing transfer proof');
    axis = axis === 'reading' ? 'reading' : 'transfer';
    score = Math.min(score, 54);
    headline = 'There is no transfer proof yet, so mastery is still shallow.';
    nextMove = 'Add one small transfer check before calling this mastered.';
  } else if (/不会|不确定|换了就|一变就|类似题也错/.test(transfer)) {
    signals.push('transfer weak');
    axis = 'transfer';
    score = Math.min(score, 49);
    headline = 'The learner can follow one example but breaks on a small variation.';
    nextMove = 'Generate one transfer drill and one review card pack tonight.';
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
      score: 78,
      totalScore: 100,
      minutes: 35,
      examText: '',
      homeworkText: '',
      snapPrerequisite: '',
      snapMethod: '',
      snapTransfer: ''
    },
    quickSnap: null
  },

  onLoad() {
    const profile = storage.loadProfile();
    this.setData({
      form: Object.assign({}, this.data.form, {
        grade: profile.grade || '五年级',
        subject: profile.subject || '数学',
        minutes: profile.minutes || 35
      }),
      quickSnap: buildQuickSnap(this.data.form)
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

  submit() {
    if (this.data.submitting) return;
    const form = this.data.form;
    const quickSnap = buildQuickSnap(form);
    const snapContext = quickSnap.context ? `3-question snap\n${quickSnap.context}\n快诊结论：${quickSnap.axisName} ${quickSnap.score}` : '';
    const payload = {
      source: 'mini-diagnosis',
      grade: form.grade,
      subject: form.subject,
      score: Number(form.score),
      totalScore: Number(form.totalScore),
      minutes: Number(form.minutes),
      examText: [form.examText, snapContext].filter(Boolean).join('\n'),
      homeworkText: form.homeworkText
    };

    storage.saveProfile({
      grade: form.grade,
      subject: form.subject,
      minutes: Number(form.minutes) || 35
    });

    this.setData({ submitting: true });
    wx.showLoading({ title: '生成中' });

    api.buildPriority(payload).then((state) => {
      storage.saveState(Object.assign({}, state, {
        source: 'mini-diagnosis-server',
        quick_snap: quickSnap
      }));
      wx.showToast({ title: '已生成雷达', icon: 'success' });
      setTimeout(() => wx.switchTab({ url: '/pages/radar/radar' }), 500);
    }).catch(() => {
      const state = priority.buildAssessment(payload);
      storage.saveState(Object.assign({}, state, {
        source: 'mini-diagnosis-local-fallback',
        quick_snap: quickSnap
      }));
      wx.showToast({ title: '本地生成雷达', icon: 'success' });
      setTimeout(() => wx.switchTab({ url: '/pages/radar/radar' }), 500);
    }).finally(() => {
      wx.hideLoading();
      this.setData({ submitting: false });
    });
  }
});
