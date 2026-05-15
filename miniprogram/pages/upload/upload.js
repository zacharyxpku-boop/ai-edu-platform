const api = require('../../utils/api');
const priority = require('../../utils/learning-priority');
const storage = require('../../utils/storage');
const privacy = require('../../utils/privacy');
const reviewCards = require('../../utils/review-cards');

const WRONG_QUESTION_RE = /错题|订正|错因|卡住|不会|总错|做错|漏|粗心|单位|条件|等量关系|建模|符号|公式|审题/;

Page({
  data: {
    imagePaths: [],
    homeworkText: '',
    materialText: '',
    materialType: 'class_notes',
    minutes: 35,
    previewPlan: null,
    materialPreview: null,
    showMaterialPanel: false,
    showPlanDetails: false,
    uploadPlaybook: null,
    inputCoach: null,
    submitLabel: '生成今晚作业三分类',
    quickChips: [
      { label: '语文背诵', text: '语文背诵 1 篇，孩子容易卡在开头。' },
      { label: '整理错题', text: '错题订正：题目写这里；我错在审题/等量关系/单位换算；想要举一反三。' },
      { label: '数学试卷', text: '数学试卷订正，应用题卡在等量关系。' },
      { label: '英语听写', text: '英语听写 20 个单词，需要先过易错词。' }
    ],
    submitting: false
  },

  toggleMaterialPanel() {
    this.setData({ showMaterialPanel: !this.data.showMaterialPanel });
  },

  togglePlanDetails() {
    this.setData({ showPlanDetails: !this.data.showPlanDetails });
  },

  onLoad(query = {}) {
    const state = storage.loadState();
    const profile = storage.loadProfile();
    const draft = storage.get ? storage.get(storage.KEYS.taskDraft, null) : null;
    const homeworkText = draft && draft.text ? draft.text : this.data.homeworkText;
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
      title: '今晚作业先分流',
      label: '把作业清单粘进来，先看哪些必须做、哪些有余力再做、哪些今晚可以放过。',
      stats: [
        { label: '必须做', value: plan ? plan.must_do.length : 0 },
        { label: '可省时间', value: `${summary.saved_minutes || 0} 分钟` },
        { label: '今晚时间', value: `${minutes || 35} 分钟` }
      ],
      cards: [
        {
          id: 'weak',
          title: '优先照顾的卡点',
          body: weak ? `${weak.name} ${weak.score} 分` : '还没有卡点数据，先录入一次作业。',
          tone: 'focus'
        },
        {
          id: 'preview',
          title: '下一步会发生什么',
          body: plan && plan.must_do[0]
            ? `第一项必须做会自动进入作业点拨：${plan.must_do[0].text}`
            : '至少写一项作业，就能预览今晚第一件该做的事。',
          tone: 'next'
        },
        {
          id: 'memory',
          title: '为什么不是白做',
          body: '必须做和关键错因会进入今晚安排、作业点拨和轻回访，变成后面还能用的学习资产。',
          tone: 'record'
        }
      ]
    };
  },

  buildMaterialPreview(text, type) {
    const value = String(text || '').trim();
    const labels = {
      class_notes: '课堂笔记',
      ppt: 'PPT 要点',
      video: '视频笔记',
      handwriting: '手写整理'
    };
    if (!value) {
      return {
        title: '学习材料变复习卡',
        label: '先粘贴课堂笔记、PPT 要点、视频文字或手写整理，预览能不能变成可复习的知识卡。',
        type: labels[type] || '课堂笔记',
        cards: [],
        readiness: 0,
        nextAction: '粘贴一段材料，咕点会先生成概念卡、步骤卡、陷阱卡和填空卡。'
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
      title: '材料预览',
      label: '把零散材料拆成概念、步骤、陷阱和填空卡，先形成一套本地可用的复习包。',
      type: labels[type] || '课堂笔记',
      cards,
      readiness: Math.min(100, Math.round((covered / coreTypes.length) * 80) + Math.min(20, cards.length * 3)),
      nextAction: cards.length
        ? `已预览 ${cards.length} 张卡，可以导入长期复习。`
        : '再补一点具体步骤、易错陷阱或例题，卡片会更有用。'
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
      uploadPlaybook: this.buildUploadPlaybook(previewPlan, state, Number(minutes || 35)),
      inputCoach: this.buildInputCoach(trimmed, previewPlan),
      submitLabel: this.buildSubmitLabel(trimmed)
    });
  },

  buildSubmitLabel(text) {
    return this.extractWrongQuestionLines(text).length
      ? '整理错题本并规划今晚'
      : '生成今晚作业三分类';
  },

  buildInputCoach(text, plan) {
    const lines = String(text || '').split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const hasStuckPoint = /卡|错|不会|忘|慢|不懂|总|粗心|陷阱|单位|步骤|关系/.test(text);
    const wrongLines = this.extractWrongQuestionLines(text);
    const hasCount = /\d/.test(text);
    const score = Math.min(100,
      (lines.length ? 34 : 0)
      + (lines.length >= 3 ? 22 : 0)
      + (hasCount ? 20 : 0)
      + (hasStuckPoint ? 24 : 0));
    const next = !lines.length
      ? '先写 3 行：题型、数量、卡住点。'
      : !hasStuckPoint
        ? '再补一句孩子卡在哪里，分类会更可信。'
        : !hasCount
          ? '再补题目数量或预计时间，咕点才能算减负。'
          : '可以生成三分类了。';
    return {
      score,
      next,
      wrongCount: wrongLines.length,
      wrongbookLabel: wrongLines.length
        ? `已识别 ${wrongLines.length} 条错题，会整理进错题本`
        : '写“错题/订正/错因”，可自动生成错题本和举一反三',
      checks: [
        { id: 'lines', label: '至少 3 行任务', ready: lines.length >= 3 },
        { id: 'count', label: '有题量/时间', ready: hasCount },
        { id: 'stuck', label: '写出卡住点', ready: hasStuckPoint },
        { id: 'wrongbook', label: '错题可回访', ready: wrongLines.length > 0 },
        { id: 'preview', label: '已生成预览', ready: !!plan }
      ]
    };
  },

  extractWrongQuestionLines(text) {
    return String(text || '')
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.length >= 6 && WRONG_QUESTION_RE.test(line))
      .slice(0, 8);
  },

  buildWrongQuestionText(lines, state, plan) {
    const firstMust = plan && plan.must_do && plan.must_do[0];
    const evidence = (firstMust && firstMust.evidence) || {};
    const weak = evidence.weak_point || ((state && state.weak_points) || [])[0] || {};
    return lines.map((line, index) => [
      `错题 ${index + 1}: ${line}`,
      `错因: ${weak.name || '先定位审题、概念、步骤或计算中的具体卡点'}`,
      '举一反三: 换一个条件时，先说第一步和最容易错的检查点。'
    ].join('\n')).join('\n\n');
  },

  importWrongQuestionsToReview(text, state, plan) {
    const lines = this.extractWrongQuestionLines(text);
    if (!lines.length) return { imported: 0, skipped: 0, detected: 0 };
    const firstMust = plan && plan.must_do && plan.must_do[0];
    const evidence = (firstMust && firstMust.evidence) || {};
    const weak = evidence.weak_point || ((state && state.weak_points) || [])[0] || {};
    const profile = storage.loadProfile();
    return reviewCards.importTextToDeck(this.buildWrongQuestionText(lines, state, plan), {
      subject: (state && state.subject) || profile.subject || '',
      weakPoint: weak.name || '错题本',
      calibrationKey: evidence.calibration_key || `wrongbook:${Date.now()}`,
      source: 'mini-upload-wrong-question'
    });
  },

  saveFocusFromUploadText(text, state, plan) {
    if (!storage.saveTodayFocusFromThought) return null;
    const wrongLines = this.extractWrongQuestionLines(text);
    const firstMust = plan && plan.must_do && plan.must_do[0];
    const evidence = (firstMust && firstMust.evidence) || {};
    const weak = evidence.weak_point || ((state && state.weak_points) || [])[0] || {};
    const focusText = wrongLines[0] || text;
    if (!focusText || !/卡住|卡在|不会|不懂|错因|错题|审题|列式|单位|步骤|关系|公式/.test(focusText)) {
      return null;
    }
    const focus = storage.saveTodayFocusFromThought(focusText, {
      source: 'mini-upload',
      subject: (state && state.subject) || '',
      issueType: weak.name || evidence.relatedIssueType || undefined
    });
    if (focus && focus.isStuck && storage.updateTonightRouteStatus) {
      storage.updateTonightRouteStatus('focus_created', { focusId: focus.id });
    }
    return focus;
  },

  afterPrioritySaved(text, state, plan, mode) {
    const wrongbook = this.importWrongQuestionsToReview(text, state, plan);
    this.saveFocusFromUploadText(text, state, plan);
    if (storage.buildLearningReportFromInput && storage.saveLearningReportState) {
      const profile = storage.loadProfile ? storage.loadProfile() : {};
      const reportState = storage.buildLearningReportFromInput({
        mode: wrongbook.imported ? 'full' : 'fast',
        sourceText: text,
        reportSources: [{
          type: wrongbook.imported ? 'wrong_question_text' : 'homework_text',
          label: wrongbook.imported ? '错题/订正资料' : '作业与学习状态',
          text,
          confidence: wrongbook.imported ? 0.78 : 0.58,
          status: '待家长确认'
        }],
        profileBasics: {
          grade: profile.grade || state.grade || '',
          age: '',
          gender: '',
          region: '',
          schoolType: ''
        },
        behaviorSignals: {
          studyMinutes: Number(this.data.minutes || 0) || '',
          homeworkMinutes: Number(this.data.minutes || 0) || ''
        },
        emotionSignals: {},
        interestSignals: {},
        assessmentAnswers: []
      });
      storage.saveLearningReportState(reportState, { skipBuild: true });
    }
    const toastTitle = wrongbook.imported
      ? `已整理 ${wrongbook.imported} 张错题卡`
      : (mode === 'server' ? '已完成三分类' : '本地完成分类');
    wx.showToast({ title: toastTitle, icon: 'success' });
    setTimeout(() => {
      if (wrongbook.imported) {
        wx.switchTab({ url: '/pages/review/review' });
        return;
      }
      wx.navigateTo({ url: '/pages/tutor/tutor?from=upload' });
    }, 500);
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

  adjustMinutes(event) {
    const delta = Number(event.currentTarget.dataset.delta || 0);
    const minutes = Math.max(10, Math.min(120, Number(this.data.minutes || 35) + delta));
    this.setData({ minutes });
    this.updatePreview(this.data.homeworkText, minutes);
  },

  useQuickChip(event) {
    const index = Number(event.currentTarget.dataset.index);
    const item = this.data.quickChips[index];
    if (!item) return;
    const current = String(this.data.homeworkText || '').trim();
    const homeworkText = current ? `${current}\n${item.text}` : item.text;
    this.setData({ homeworkText });
    this.updatePreview(homeworkText, this.data.minutes);
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
      this.afterPrioritySaved(text, nextState, nextState.homework_plan, 'server');
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
      this.afterPrioritySaved(text, nextState, plan, 'local');
    }).finally(() => {
      wx.hideLoading();
      this.setData({ submitting: false });
    });
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' });
  },

  goReview() {
    wx.switchTab({ url: '/pages/review/review' });
  },

  goTools() {
    wx.switchTab({ url: '/pages/tools/tools' });
  }
});
