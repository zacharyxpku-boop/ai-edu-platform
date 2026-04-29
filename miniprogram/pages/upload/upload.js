const priority = require('../../utils/learning-priority');
const storage = require('../../utils/storage');
const privacy = require('../../utils/privacy');

Page({
  data: {
    imagePaths: [],
    homeworkText: '',
    minutes: 35
  },

  onLoad() {
    const state = storage.loadState();
    const profile = storage.loadProfile();
    this.setData({
      minutes: (state.homework_plan && state.homework_plan.minutes_available) || profile.minutes || 35
    });
  },

  chooseImage() {
    privacy.requirePrivacy('照片留档').then(() => {
      const onSuccess = (res) => {
        const files = res.tempFiles || (res.tempFilePaths || []).map((path) => ({ tempFilePath: path }));
        this.setData({
          imagePaths: files.map((item) => item.tempFilePath).filter(Boolean).slice(0, 4)
        });
      };
      if (wx.chooseMedia) {
        wx.chooseMedia({
          count: 4,
          mediaType: ['image'],
          sourceType: ['album', 'camera'],
          success: onSuccess
        });
      } else {
        wx.chooseImage({
          count: 4,
          sourceType: ['album', 'camera'],
          success: onSuccess
        });
      }
    }).catch(() => {});
  },

  onInput(event) {
    this.setData({ homeworkText: event.detail.value });
  },

  onMinutes(event) {
    this.setData({ minutes: event.detail.value });
  },

  submit() {
    const state = storage.loadState();
    const plan = priority.classifyHomework(this.data.homeworkText, state.weak_points || [], Number(this.data.minutes));
    const nextState = Object.assign({}, state, {
      source: 'mini-upload',
      homework_text: this.data.homeworkText,
      image_count: this.data.imagePaths.length,
      homework_plan: plan,
      updated_at: new Date().toISOString()
    });
    storage.saveState(nextState);
    wx.showToast({ title: '已完成三分类', icon: 'success' });
    setTimeout(() => wx.switchTab({ url: '/pages/radar/radar' }), 500);
  }
});
