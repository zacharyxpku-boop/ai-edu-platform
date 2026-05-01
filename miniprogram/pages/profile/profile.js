const api = require('../../utils/api');
const storage = require('../../utils/storage');

Page({
  data: {
    consent: false,
    profile: {
      name: '',
      grade: '五年级',
      subject: '数学',
      minutes: 35
    },
    lead: {
      name: '',
      phone: '',
      kid: ''
    },
    sending: false
  },

  onShow() {
    this.setData({
      profile: storage.loadProfile(),
      consent: !!storage.get(storage.KEYS.consent, false)
    });
  },

  onProfileInput(event) {
    const field = event.currentTarget.dataset.field;
    const profile = Object.assign({}, this.data.profile, {
      [field]: event.detail.value
    });
    storage.saveProfile(profile);
    this.setData({ profile });
  },

  onLeadInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      lead: Object.assign({}, this.data.lead, {
        [field]: event.detail.value
      })
    });
  },

  onConsent(event) {
    const consent = !!event.detail.value;
    storage.set(storage.KEYS.consent, consent);
    this.setData({ consent });
  },

  submitLead() {
    if (this.data.sending) return;
    this.setData({ sending: true });
    api.submitLead({
      name: this.data.lead.name,
      phone: this.data.lead.phone,
      kid: this.data.lead.kid || `${this.data.profile.grade} ${this.data.profile.subject}`,
      tier_label: '小程序 MVP 咨询'
    }).then(() => {
      wx.showToast({ title: '已提交', icon: 'success' });
    }).catch((error) => {
      wx.showToast({ title: error.message || '提交失败', icon: 'none' });
    }).finally(() => {
      this.setData({ sending: false });
    });
  },

  openLegal(event) {
    const type = event.currentTarget.dataset.type || 'privacy';
    wx.navigateTo({ url: `/pages/legal/legal?type=${type}` });
  },

  clearLocalData() {
    wx.showModal({
      title: '清除本地学习数据',
      content: '将清除本机的雷达、作业分类、会话和临时选择，不影响已主动提交的咨询信息。',
      confirmText: '清除',
      confirmColor: '#B85C2E',
      success: (res) => {
        if (!res.confirm) return;
        storage.clearLearningData();
        this.setData({ consent: false });
        wx.showToast({ title: '已清除', icon: 'success' });
      }
    });
  }
});
