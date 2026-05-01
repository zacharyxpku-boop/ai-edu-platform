const api = require('../../utils/api');
const priority = require('../../utils/learning-priority');
const storage = require('../../utils/storage');

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
      homeworkText: ''
    }
  },

  onLoad() {
    const profile = storage.loadProfile();
    this.setData({
      form: Object.assign({}, this.data.form, {
        grade: profile.grade || '五年级',
        subject: profile.subject || '数学',
        minutes: profile.minutes || 35
      })
    });
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field;
    const form = Object.assign({}, this.data.form, {
      [field]: event.detail.value
    });
    this.setData({ form });
  },

  onGradeChange(event) {
    const grade = this.data.gradeOptions[Number(event.detail.value)] || '五年级';
    this.setData({ form: Object.assign({}, this.data.form, { grade }) });
  },

  onSubjectChange(event) {
    const subject = this.data.subjectOptions[Number(event.detail.value)] || '数学';
    this.setData({ form: Object.assign({}, this.data.form, { subject }) });
  },

  submit() {
    if (this.data.submitting) return;
    const form = this.data.form;
    const payload = {
      source: 'mini-diagnosis',
      grade: form.grade,
      subject: form.subject,
      score: Number(form.score),
      totalScore: Number(form.totalScore),
      minutes: Number(form.minutes),
      examText: form.examText,
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
      storage.saveState(Object.assign({}, state, { source: 'mini-diagnosis-server' }));
      wx.showToast({ title: '已生成雷达', icon: 'success' });
      setTimeout(() => wx.switchTab({ url: '/pages/radar/radar' }), 500);
    }).catch(() => {
      const state = priority.buildAssessment(payload);
      storage.saveState(Object.assign({}, state, { source: 'mini-diagnosis-local-fallback' }));
      wx.showToast({ title: '本地生成雷达', icon: 'success' });
      setTimeout(() => wx.switchTab({ url: '/pages/radar/radar' }), 500);
    }).finally(() => {
      wx.hideLoading();
      this.setData({ submitting: false });
    });
  }
});
