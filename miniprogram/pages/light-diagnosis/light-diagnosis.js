const lightFeatures = require('../../utils/light-features');
const storage = require('../../utils/storage');
const navigation = require('../../utils/navigation');

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
      { id: 'english', label: '英语' },
      { id: 'physics', label: '物理' },
      { id: 'chemistry', label: '化学' },
      { id: 'biology', label: '生物' },
      { id: 'geography', label: '地理' }
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
    result: null,
    surfaceDepthPack: null,
    lightSeedBank: null,
    subjectSeedLibrary: null,
    courseUnitMap: null,
    courseUnitQuestionBank: null,
    courseUnitDepthExpansionAtlas: null,
    commercialDepthRunway: null,
    sevenSubjectMasterySprint: null
  },

  onLoad() {
    const subjectSeedLibrary = storage.buildSubjectSeedLibrary ? storage.buildSubjectSeedLibrary({ subject: this.data.subject }) : null;
    const courseUnitMap = storage.buildCourseUnitMap ? storage.buildCourseUnitMap({ subject: this.data.subject }) : null;
    const courseUnitQuestionBank = storage.buildCourseUnitQuestionBank ? storage.buildCourseUnitQuestionBank({ courseUnitMap }) : null;
    const courseUnitDepthExpansionAtlas = storage.buildCourseUnitDepthExpansionAtlas ? storage.buildCourseUnitDepthExpansionAtlas({ courseUnitMap, courseUnitQuestionBank }) : null;
    const commercialDepthRunway = storage.buildCommercialDepthRunway ? storage.buildCommercialDepthRunway({ courseUnitMap, courseUnitQuestionBank, courseUnitDepthExpansionAtlas }) : null;
    this.setData({
      surfaceDepthPack: storage.buildSurfaceDepthPack ? storage.buildSurfaceDepthPack('light_diagnosis') : null,
      lightSeedBank: storage.buildLightEntrySeedBank ? storage.buildLightEntrySeedBank('light_diagnosis') : null,
      subjectSeedLibrary,
      courseUnitMap,
      courseUnitQuestionBank,
      courseUnitDepthExpansionAtlas,
      commercialDepthRunway,
      sevenSubjectMasterySprint: storage.buildSevenSubjectMasterySprint ? storage.buildSevenSubjectMasterySprint({ courseUnitMap, courseUnitQuestionBank, commercialDepthRunway }) : null
    });
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
    const subject = event.currentTarget.dataset.id;
    const subjectSeedLibrary = storage.buildSubjectSeedLibrary ? storage.buildSubjectSeedLibrary({ subject }) : this.data.subjectSeedLibrary;
    const courseUnitMap = storage.buildCourseUnitMap ? storage.buildCourseUnitMap({ subject }) : this.data.courseUnitMap;
    const courseUnitQuestionBank = storage.buildCourseUnitQuestionBank ? storage.buildCourseUnitQuestionBank({ courseUnitMap }) : this.data.courseUnitQuestionBank;
    const courseUnitDepthExpansionAtlas = storage.buildCourseUnitDepthExpansionAtlas ? storage.buildCourseUnitDepthExpansionAtlas({ courseUnitMap, courseUnitQuestionBank }) : this.data.courseUnitDepthExpansionAtlas;
    const commercialDepthRunway = storage.buildCommercialDepthRunway ? storage.buildCommercialDepthRunway({ courseUnitMap, courseUnitQuestionBank, courseUnitDepthExpansionAtlas }) : this.data.commercialDepthRunway;
    this.setData({
      subject,
      diagnosis: null,
      result: null,
      subjectSeedLibrary,
      courseUnitMap,
      courseUnitQuestionBank,
      courseUnitDepthExpansionAtlas,
      commercialDepthRunway,
      sevenSubjectMasterySprint: storage.buildSevenSubjectMasterySprint ? storage.buildSevenSubjectMasterySprint({ courseUnitMap, courseUnitQuestionBank, commercialDepthRunway }) : this.data.sevenSubjectMasterySprint
    });
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
    navigation.navigateLearningRoute('/pages/focus/focus?from=light_diagnosis');
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

  runSubjectSeedAction(event) {
    const dataset = event.currentTarget.dataset || {};
    const library = this.data.subjectSeedLibrary || {};
    const active = library.active || {};
    const seeds = active.seeds || [];
    const seed = seeds.find((item) => item.id === dataset.seedId) || seeds[0] || {};
    const route = seed.route || active.route || '/pages/tutor/tutor';
    if (storage.recordUnifiedNextAction) {
      storage.recordUnifiedNextAction({
        source: 'subject_seed_library',
        sourceLabel: `${seed.subjectLabel || active.label || '七科'}第一步种子`,
        actionLabel: seed.firstStep || seed.label || '先做第一步',
        route,
        reasonLine: seed.wrongCauseModel || seed.wrongCause || '',
        evidenceLine: seed.evidenceContractLine || '',
        surface: 'light_diagnosis',
        candidateCount: library.seedCount || seeds.length
      });
    }
    if (storage.recordSurfaceDepthAction) {
      storage.recordSurfaceDepthAction({
        surface: 'light_diagnosis',
        dimensionId: 'subject_seed_library',
        label: seed.label || active.label || '七科第一步种子',
        route,
        readiness: seed.loopLine || active.progressionLine || '',
        source: 'subject_seed_card',
        capabilityId: seed.id || '',
        capabilityLabel: seed.tier || '',
        capabilityRoute: seed.recallRoute || route,
        capabilityEvidenceLine: seed.evidenceContractLine || '',
        capabilityNextAction: seed.transferPrompt || seed.firstStep || ''
      });
    }
    wx.showToast({
      title: '已记录这张第一步种子',
      icon: 'none'
    });
    navigation.navigateLearningRoute(route);
  },

  runCourseUnitAction(event) {
    const dataset = event.currentTarget.dataset || {};
    const map = this.data.courseUnitMap || {};
    const active = map.active || {};
    const units = active.units || [];
    const unit = units.find((item) => item.id === dataset.unitId) || units[0] || {};
    const route = unit.route || active.route || '/pages/tutor/tutor';
    if (storage.recordUnifiedNextAction) {
      storage.recordUnifiedNextAction({
        source: 'course_unit_map',
        sourceLabel: `${unit.subjectLabel || active.label || '七科'}课程单元`,
        actionLabel: unit.blackboardBlueprint && unit.blackboardBlueprint.title ? unit.blackboardBlueprint.title : unit.unitLabel,
        route,
        reasonLine: unit.reportContract || '',
        evidenceLine: unit.practiceLoop && unit.practiceLoop.nextDay ? unit.practiceLoop.nextDay : '',
        surface: 'light_diagnosis',
        candidateCount: map.unitCount || units.length
      });
    }
    if (storage.recordSurfaceDepthAction) {
      storage.recordSurfaceDepthAction({
        surface: 'light_diagnosis',
        dimensionId: 'course_unit_map',
        label: unit.unitLabel || active.label || '课程单元',
        route,
        readiness: unit.reportContract || '',
        source: 'course_unit_card',
        capabilityId: unit.id || '',
        capabilityLabel: unit.tier || '',
        capabilityRoute: unit.gameRoute || route,
        capabilityEvidenceLine: unit.shareContract || '',
        capabilityNextAction: unit.parentAction || ''
      });
    }
    wx.showToast({
      title: '已记录课程单元',
      icon: 'none'
    });
    navigation.navigateLearningRoute(route);
  },

});
