const lightFeatures = require('../../utils/light-features');
const storage = require('../../utils/storage');

let diagnosisTimer = null;

Page({
  data: {
    inputText: '',
    childStepText: '',
    subject: 'math',
    stuckStep: 'read',
    subjectOptions: [
      { id: 'math', label: '数学' },
      { id: 'chinese', label: '语文' },
      { id: 'english', label: '英语' }
    ],
    stuckOptions: [
      { id: 'read', label: '看不懂题' },
      { id: 'formula', label: '列不出式子' },
      { id: 'writing', label: '不知道写什么' },
      { id: 'other', label: '其他' }
    ],
    loadingStage: '',
    showRetryGuide: false,
    diagnosis: null,
    result: null
  },

  onUnload() {
    if (diagnosisTimer) clearTimeout(diagnosisTimer);
    diagnosisTimer = null;
  },

  onInput(event) {
    this.setData({ inputText: event.detail.value });
  },

  onChildStepInput(event) {
    this.setData({ childStepText: event.detail.value });
  },

  chooseLocalImage() {
    wx.showToast({
      title: '图片只做本地参考，请手动确认科目和卡点',
      icon: 'none'
    });
  },

  chooseSubject(event) {
    this.setData({ subject: event.currentTarget.dataset.id, diagnosis: null, result: null });
  },

  chooseStuckStep(event) {
    this.setData({ stuckStep: event.currentTarget.dataset.id, diagnosis: null, result: null });
  },

  analyze() {
    if (diagnosisTimer) clearTimeout(diagnosisTimer);
    this.setData({
      loadingStage: '正在看清题目类型…',
      showRetryGuide: false,
      diagnosis: null,
      result: null,
      childStepText: ''
    });
    diagnosisTimer = setTimeout(() => {
      this.setData({ loadingStage: '正在找第一步…' });
      diagnosisTimer = setTimeout(() => {
        this.setData({
          loadingStage: '',
          diagnosis: lightFeatures.buildLightDiagnosis(this.data.inputText, {
            subject: this.data.subject,
            stuckStep: this.data.stuckStep
          })
        });
        diagnosisTimer = null;
      }, 1500);
    }, 1500);
  },

  confirm() {
    this.setData({
      result: lightFeatures.confirmLightDiagnosis(this.data.inputText, this.data.childStepText, {
        subject: this.data.subject,
        stuckStep: this.data.stuckStep
      })
    });
  },

  retryChoice() {
    if (diagnosisTimer) clearTimeout(diagnosisTimer);
    diagnosisTimer = null;
    this.setData({
      showRetryGuide: true,
      loadingStage: '',
      diagnosis: null,
      result: null,
      childStepText: ''
    });
  },

  retakePhoto() {
    if (diagnosisTimer) clearTimeout(diagnosisTimer);
    diagnosisTimer = null;
    this.setData({
      inputText: '',
      childStepText: '',
      loadingStage: '',
      showRetryGuide: false,
      diagnosis: null,
      result: null
    });
  },

  startFocusFromDiagnosis() {
    storage.recordCoreLoopEntry && storage.recordCoreLoopEntry('light_diagnosis_focus', {
      feature: 'light_diagnosis'
    });
    const result = this.data.result || lightFeatures.confirmLightDiagnosis(this.data.inputText, this.data.childStepText, {
      subject: this.data.subject,
      stuckStep: this.data.stuckStep
    });
    const focus = storage.saveTodayFocusFromThought ? storage.saveTodayFocusFromThought(result.event.stuckPointText || this.data.inputText || result.suggestedFirstStep, {
      source: 'light_diagnosis',
      taskType: result.taskType,
      systemSuggestedStep: result.suggestedFirstStep,
      childArticulatedStep: result.childStep,
      childStepSentence: result.childStep,
      childStepQuality: result.event.childStepQuality,
      firstStepStatus: 'child_confirmed',
      firstStepSource: 'child_articulated'
    }) : null;
    if (storage.saveChildArticulatedStep && result.childStep) storage.saveChildArticulatedStep(result.childStep);
    this.setData({ result: Object.assign({}, result, { focus }) });
    wx.switchTab({ url: '/pages/focus/focus' });
  }
});
