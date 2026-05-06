const api = require('../../utils/api');
const priority = require('../../utils/learning-priority');
const storage = require('../../utils/storage');
const privacy = require('../../utils/privacy');
const reviewCards = require('../../utils/review-cards');

const REVIEW_SAMPLE = [
  '数学方程基础题 8 道，孩子移项总忘记变号',
  '应用题 4 道，主要卡在等量关系和单位',
  '整理今天错题 2 道，说清错因',
  '英语单词抄写 3 遍'
].join('\n');

Page({
  data: {
    imagePaths: [],
    homeworkText: '',
    materialText: '',
    materialType: 'class_notes',
    minutes: 35,
    previewPlan: null,
    materialPreview: null,
    uploadPlaybook: null,
    examples: [
      '数学方程基础题 8 道，孩子移项总忘记变号',
      '应用题 4 道，主要卡在等量关系和单位',
      '整理今天错题 2 道，说清错因',
      '英语单词抄写 3 遍'
    ],
    submitting: false
  },

  onLoad(query = {}) {
    const state = storage.loadState();
    const profile = storage.loadProfile();
    const homeworkText = query.sample === 'review' ? REVIEW_SAMPLE : this.data.homeworkText;
    this.setData({
      minutes: (state.homework_plan && state.homework_plan.minutes_available) || profile.minutes || 35,
      homeworkText
    });
    this.updatePreview(homeworkText, (state.homework_plan && state.homework_plan.minutes_available) || profile.minutes || 35);
    this.updateMaterialPreview('', this.data.materialType);
  },

  buildUploadPlaybook(plan, state, minutes) {
    const weak = ((state && state.weak_points) || [])[0] || null;
    const summary = (plan && plan.summary) || {};
    return {
      title: 'UPLOAD TO TRIAGE LOOP',
      label: 'Paste homework once, then get tonight must-do, optional work and low-value tasks before the child starts.',
      stats: [
        { label: 'must', value: plan ? plan.must_do.length : 0 },
        { label: 'saved', value: `${summary.saved_minutes || 0} min` },
        { label: 'time', value: `${minutes || 35} min` }
      ],
      cards: [
        {
          id: 'weak',
          title: 'Weak-point target',
          body: weak ? `${weak.name} ${weak.score}` : 'No weak point loaded yet',
          tone: 'focus'
        },
        {
          id: 'preview',
          title: 'What happens next',
          body: plan && plan.must_do[0]
            ? `The first must-do task becomes the tutor starting point: ${plan.must_do[0].text}`
            : 'Enter at least one task to preview the first must-do item.',
          tone: 'next'
        },
        {
          id: 'memory',
          title: 'Why this matters',
          body: 'Must-do work and wrong causes will flow into radar, tutor and spaced review instead of staying as one-night effort.',
          tone: 'moat'
        }
      ]
    };
  },

  buildMaterialPreview(text, type) {
    const value = String(text || '').trim();
    const labels = {
      class_notes: 'Class notes',
      ppt: 'PPT outline',
      video: 'Video notes',
      handwriting: 'Handwriting cleanup'
    };
    if (!value) {
      return {
        title: 'MATERIAL TO MEMORY ENGINE',
        label: 'Paste any study material to preview review cards before real OCR/PDF/video APIs are connected.',
        type: labels[type] || 'Class notes',
        cards: [],
        readiness: 0,
        nextAction: 'Paste notes, PPT outline, video transcript or handwritten cleanup.'
      };
    }
    const profile = storage.loadProfile();
    const cards = reviewCards.previewImport(value, {
      subject: profile.subject || '',
      source: `material_${type || 'class_notes'}`
    }).slice(0, 6);
    const coreTypes = ['concept', 'step', 'trap', 'cloze'];
    const covered = coreTypes.filter((cardType) => cards.some((item) => item.cardType === cardType)).length;
    return {
      title: 'MATERIAL TO MEMORY ENGINE',
      label: 'Convert raw study material into concept, step, trap and cloze cards. This is the local version of a full AI content engine.',
      type: labels[type] || 'Class notes',
      cards,
      readiness: Math.min(100, Math.round((covered / coreTypes.length) * 80) + Math.min(20, cards.length * 3)),
      nextAction: cards.length
        ? `Ready to import ${cards.length} preview cards into long-term review.`
        : 'Add more concrete steps, traps, or examples to create useful cards.'
    };
  },

  updatePreview(text, minutes) {
    const state = storage.loadState();
    const trimmed = String(text || '').trim();
    const previewPlan = trimmed
      ? priority.classifyHomework(trimmed, state.weak_points || [], Number(minutes || 35))
      : null;
    this.setData({
      previewPlan,
      uploadPlaybook: this.buildUploadPlaybook(previewPlan, state, Number(minutes || 35))
    });
  },

  updateMaterialPreview(text, type) {
    this.setData({
      materialPreview: this.buildMaterialPreview(text, type)
    });
  },

  chooseImage() {
    privacy.requirePrivacy('照片本地留存').then(() => {
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
    const homeworkText = event.detail.value;
    this.setData({ homeworkText });
    this.updatePreview(homeworkText, this.data.minutes);
  },

  onMaterialInput(event) {
    const materialText = event.detail.value;
    this.setData({ materialText });
    this.updateMaterialPreview(materialText, this.data.materialType);
  },

  setMaterialType(event) {
    const materialType = event.currentTarget.dataset.type || 'class_notes';
    this.setData({ materialType });
    this.updateMaterialPreview(this.data.materialText, materialType);
  },

  fillMaterialSample() {
    const materialText = [
      '应用题步骤：先圈已知和未知，再写等量关系，最后检查单位。',
      '常见陷阱：不要直接算答案，先确认题目问什么。',
      '变式检查：如果把人数或单价换掉，仍然先找同一个关系。'
    ].join('\n');
    this.setData({ materialText, materialType: 'class_notes' });
    this.updateMaterialPreview(materialText, 'class_notes');
  },

  importMaterialPack() {
    const text = String(this.data.materialText || '').trim();
    if (!text) {
      wx.showToast({ title: '先粘贴学习材料', icon: 'none' });
      return;
    }
    const profile = storage.loadProfile();
    const result = reviewCards.importTextToDeck(text, {
      subject: profile.subject || '',
      weakPoint: this.data.materialType,
      calibrationKey: `material:${this.data.materialType}`,
      source: `material_${this.data.materialType}`
    });
    wx.showToast({
      title: result.imported ? `已导入 ${result.imported} 张` : '已在复习库中',
      icon: 'success'
    });
    this.updateMaterialPreview(text, this.data.materialType);
  },

  onMinutes(event) {
    const minutes = event.detail.value;
    this.setData({ minutes });
    this.updatePreview(this.data.homeworkText, minutes);
  },

  useExample(event) {
    const index = Number(event.currentTarget.dataset.index);
    const text = this.data.examples[index];
    if (!text) return;
    const current = String(this.data.homeworkText || '').trim();
    const homeworkText = current ? `${current}\n${text}` : text;
    this.setData({ homeworkText });
    this.updatePreview(homeworkText, this.data.minutes);
  },

  fillReviewSample() {
    this.setData({ homeworkText: REVIEW_SAMPLE });
    this.updatePreview(REVIEW_SAMPLE, this.data.minutes);
  },

  submit() {
    if (this.data.submitting) return;
    const text = String(this.data.homeworkText || '').trim();
    if (!text) {
      wx.showToast({ title: '先填作业清单', icon: 'none' });
      return;
    }
    const current = storage.loadState();
    const payload = {
      source: 'mini-upload',
      grade: current.grade,
      subject: current.subject,
      score: current.score,
      totalScore: current.total_score,
      minutes: Number(this.data.minutes),
      examText: (current.weak_points || []).map((item) => `${item.name} ${item.reason || ''}`).join('\n'),
      homeworkText: text
    };

    this.setData({ submitting: true });
    wx.showLoading({ title: '分类中' });

    api.buildPriority(payload).then((state) => {
      const nextState = Object.assign({}, current, state, {
        source: 'mini-upload-server',
        homework_text: text,
        image_count: this.data.imagePaths.length,
        updated_at: new Date().toISOString()
      });
      storage.saveState(nextState);
      wx.showToast({ title: '已完成三分类', icon: 'success' });
      setTimeout(() => wx.switchTab({ url: '/pages/radar/radar' }), 500);
    }).catch(() => {
      const plan = priority.classifyHomework(text, current.weak_points || [], Number(this.data.minutes));
      const nextState = Object.assign({}, current, {
        source: 'mini-upload-local-fallback',
        homework_text: text,
        image_count: this.data.imagePaths.length,
        homework_plan: plan,
        updated_at: new Date().toISOString()
      });
      storage.saveState(nextState);
      wx.showToast({ title: '本地完成分类', icon: 'success' });
      setTimeout(() => wx.switchTab({ url: '/pages/radar/radar' }), 500);
    }).finally(() => {
      wx.hideLoading();
      this.setData({ submitting: false });
    });
  }
});
