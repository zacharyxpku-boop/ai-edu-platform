const focusCabin = require('../../utils/focus-cabin');
const storage = require('../../utils/storage');
const navigation = require('../../utils/navigation');

function formatTime(seconds) {
  const total = Math.max(0, Number(seconds || 0));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

let timer = null;
let parentSurveyTimer = null;
let ambientAudio = null;
let doneAudio = null;

const AMBIENT_AUDIO = {
  rain: '../../assets/focus/rain.mp3',
  cafe: '../../assets/focus/cafe.mp3',
  campfire: '../../assets/focus/campfire.mp3',
  ding: '../../assets/focus/ding.mp3'
};

Page({
  data: {
    cabin: focusCabin.pageState(),
    timeText: '25:00',
    manualTaskDraft: '',
    completionCard: null,
    interruptionCard: null,
    parentPauseCard: null,
    parentPauseSurvey: null,
    secondStepNotice: null,
    volume: 40,
    ambientSoundText: '雨声循环中',
    focusBlocked: false,
    focusBlockedText: '',
    surfaceDepthPack: null
  },

  onLoad() {
    this.refresh();
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    this.refresh();
  },

  onHide() {
    this.stopTicker();
    this.stopParentSurveyTimer();
    this.stopAmbientSound();
  },

  onUnload() {
    this.stopTicker();
    this.stopParentSurveyTimer();
    this.stopAmbientSound();
    this.destroyAudio();
  },

  refresh() {
    const cabin = focusCabin.pageState();
    const todaySession = storage.getTodaySession ? storage.getTodaySession() : null;
    const focusBlocked = !(storage.canStartFocusFromTodaySession ? storage.canStartFocusFromTodaySession(todaySession) : (todaySession && todaySession.childArticulatedStep));
    this.setData({
      cabin,
      timeText: formatTime(cabin.currentSession.remainingSeconds),
      manualTaskDraft: cabin.settings.manualTask || '',
      volume: cabin.settings.volume || 40,
      ambientSoundText: this.ambientSoundText(cabin.selectedAudio),
      focusBlocked,
      focusBlockedText: focusBlocked ? '先回咕点确认今晚第一步，才能进专注舱。' : '',
      surfaceDepthPack: storage.buildSurfaceDepthPack ? storage.buildSurfaceDepthPack('focus') : null
    });
    if (cabin.currentSession.status === 'running') {
      this.startTicker();
      this.startAmbientSound(cabin.selectedAudio, cabin.settings.volume);
    }
  },

  ambientSoundText(audio) {
    const item = audio || {};
    if (item.id === 'mute') return '安静模式';
    return `${item.name || '雨声'}循环中`;
  },

  ensureAudio() {
    if (!ambientAudio && wx.createInnerAudioContext) {
      ambientAudio = wx.createInnerAudioContext();
      ambientAudio.loop = true;
      ambientAudio.obeyMuteSwitch = false;
      if (ambientAudio.onError) {
        ambientAudio.onError(() => {
          wx.showToast({ title: '音频加载中，请重试', icon: 'none' });
        });
      }
    }
    if (!doneAudio && wx.createInnerAudioContext) {
      doneAudio = wx.createInnerAudioContext();
      doneAudio.obeyMuteSwitch = false;
      doneAudio.src = AMBIENT_AUDIO.ding;
      doneAudio.volume = 0.28;
      if (doneAudio.onError) {
        doneAudio.onError(() => {
          wx.showToast({ title: '音频加载中，请重试', icon: 'none' });
        });
      }
    }
  },

  startAmbientSound(audio, volume) {
    const selected = audio || {};
    if (selected.id === 'mute' || Number(volume || 0) <= 0) {
      this.stopAmbientSound();
      return;
    }
    this.ensureAudio();
    if (!ambientAudio) return;
    const src = AMBIENT_AUDIO[selected.id] || selected.asset || AMBIENT_AUDIO.rain;
    if (ambientAudio.src !== src) ambientAudio.src = src;
    ambientAudio.volume = Math.max(0, Math.min(1, Number(volume || 40) / 100));
    if (ambientAudio.play) {
      try {
        ambientAudio.play();
      } catch (error) {
        this.stopAmbientSound();
      }
    }
  },

  stopAmbientSound() {
    if (ambientAudio && ambientAudio.stop) ambientAudio.stop();
  },

  playDoneSound() {
    this.ensureAudio();
    if (doneAudio && doneAudio.play) doneAudio.play();
    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' });
  },

  destroyAudio() {
    if (ambientAudio && ambientAudio.destroy) ambientAudio.destroy();
    if (doneAudio && doneAudio.destroy) doneAudio.destroy();
    ambientAudio = null;
    doneAudio = null;
  },

  startTicker() {
    if (timer) return;
    timer = setInterval(() => {
      const session = focusCabin.tickSession(1);
      if (!session || session.status === 'completed') {
        this.stopTicker();
        this.stopAmbientSound();
        this.playDoneSound();
        this.refresh();
        return;
      }
      this.setData({
        cabin: focusCabin.pageState(),
        timeText: formatTime(session.remainingSeconds)
      });
    }, 1000);
  },

  stopTicker() {
    if (timer) clearInterval(timer);
    timer = null;
  },

  stopParentSurveyTimer() {
    if (parentSurveyTimer) clearTimeout(parentSurveyTimer);
    parentSurveyTimer = null;
  },

  chooseDuration(event) {
    const id = event.currentTarget.dataset.id;
    focusCabin.saveSettings({ selectedDurationId: id });
    focusCabin.resetSession({ durationId: id });
    this.refresh();
  },

  chooseScene(event) {
    focusCabin.selectScene(event.currentTarget.dataset.id);
    this.refresh();
  },

  chooseAudio(event) {
    focusCabin.selectAudio(event.currentTarget.dataset.id);
    this.refresh();
  },

  onVolumeChange(event) {
    focusCabin.setVolume(event.detail.value);
    this.refresh();
  },

  onManualTaskInput(event) {
    this.setData({ manualTaskDraft: event.detail.value });
  },

  saveManualTask() {
    const text = focusCabin.setManualTask(this.data.manualTaskDraft);
    if (!text) {
      wx.showToast({ title: '先写今晚这一小步', icon: 'none' });
      return;
    }
    focusCabin.resetSession({ manualTask: text });
    this.refresh();
  },

  startFocus() {
    const todaySession = storage.getTodaySession ? storage.getTodaySession() : null;
    const canStart = storage.canStartFocusFromTodaySession
      ? storage.canStartFocusFromTodaySession(todaySession)
      : !!(todaySession && todaySession.childArticulatedStep);
    if (!canStart) {
      wx.showToast({ title: '先回咕点确认今晚第一步，才能进专注舱。', icon: 'none' });
      this.setData({ focusBlocked: true, focusBlockedText: '先回咕点确认今晚第一步，才能进专注舱。' });
      return;
    }
    storage.recordLocalAnalytics && storage.recordLocalAnalytics('focus_started', {
      target: this.data.cabin && this.data.cabin.focusTarget && this.data.cabin.focusTarget.title
    });
    const session = focusCabin.startSession({
      durationId: this.data.cabin.selectedDuration.id,
      sceneId: this.data.cabin.selectedScene.id,
      audioId: this.data.cabin.selectedAudio.id,
      manualTask: this.data.manualTaskDraft
    });
    this.setData({
      completionCard: null,
      interruptionCard: null,
      cabin: focusCabin.pageState(),
      timeText: formatTime(session.remainingSeconds)
    });
    this.startTicker();
    this.startAmbientSound(this.data.cabin.selectedAudio, this.data.volume);
  },

  pauseFocus() {
    this.stopTicker();
    this.stopAmbientSound();
    focusCabin.pauseSession();
    this.refresh();
  },

  resumeFocus() {
    focusCabin.resumeSession();
    this.refresh();
  },

  resetFocus() {
    this.stopTicker();
    focusCabin.resetSession({
      durationId: this.data.cabin.selectedDuration.id,
      sceneId: this.data.cabin.selectedScene.id,
      audioId: this.data.cabin.selectedAudio.id,
      manualTask: this.data.manualTaskDraft
    });
    this.setData({ completionCard: null });
    this.refresh();
  },

  completeFocus() {
    this.stopTicker();
    this.stopAmbientSound();
    const record = focusCabin.completeSession();
    storage.recordLocalAnalytics && storage.recordLocalAnalytics('focus_completed', {
      completionType: record && record.completionType
    });
    const chains = storage.loadScaffoldingChains ? storage.loadScaffoldingChains() : [];
    const latestChain = chains[0] || null;
    const secondStepDone = !!(latestChain && (latestChain.steps || []).some((step) => Number(step.order) === 2 && step.completed));
    const reviewCard = storage.ensureFocusReviewCard ? storage.ensureFocusReviewCard(record, {
      nextRoute: '/pages/review/review?from=focus_return'
    }) : null;
    this.setData({
      completionCard: record,
      secondStepNotice: !secondStepDone && latestChain ? {
        title: '第二步轻提示',
        body: '孩子今天第一步完成了，但第二步还没完成。你可以只问：第一步圈的条件，哪两个有关系？',
        cta: '查看下一步提示'
      } : null,
      reviewCard
    });
    this.playDoneSound();
    this.refresh();
  },

  interruptFocus() {
    this.stopTicker();
    this.stopAmbientSound();
    const record = focusCabin.interruptSession('user_interrupt');
    const minutes = Math.max(1, Math.round(Number(record.actualFocusSeconds || 0) / 60));
    this.setData({
      completionCard: null,
      interruptionCard: {
        title: `今天能坐下来一下，也算开始。已专注 ${minutes} 分钟。`,
        body: record.gentleInterruptionRecap || '没关系，这一步我们下次从这里接着来。'
      }
    });
    this.refresh();
  },

  restAfterInterrupt() {
    focusCabin.resetSession({
      durationId: 'short_break',
      sceneId: this.data.cabin.selectedScene.id,
      audioId: this.data.cabin.selectedAudio.id,
      manualTask: this.data.manualTaskDraft
    });
    this.setData({ interruptionCard: null });
    this.refresh();
  },

  closeInterruption() {
    this.setData({ interruptionCard: null });
    this.goProfile();
  },

  parentPause() {
    const card = focusCabin.parentPausePrompt ? focusCabin.parentPausePrompt(3) : {
      title: '先暂停 10 秒',
      body: '你现在想给答案吗？先试试这句。',
      phrase: '你第一步先看了哪里？'
    };
    this.setData({ parentPauseCard: card });
    this.stopParentSurveyTimer();
    parentSurveyTimer = setTimeout(() => {
      this.setData({
        parentPauseSurvey: {
          question: '你刚才给孩子提示了吗？',
          options: [
            { id: 'direct_answer', label: '直接讲了答案' },
            { id: 'asked_one_question', label: '只问了一句' },
            { id: 'let_child_think', label: '让他再想想' },
            { id: 'left_alone', label: '没管他了' }
          ]
        }
      });
      parentSurveyTimer = null;
    }, 300);
  },

  copyParentPhrase() {
    const phrase = this.data.parentPauseCard && this.data.parentPauseCard.phrase;
    if (!phrase) return;
    if (wx.setClipboardData) {
      wx.setClipboardData({ data: phrase });
    } else {
      wx.showToast({ title: '话术已准备好', icon: 'none' });
    }
  },

  chooseParentPauseBehavior(event) {
    const behavior = event.currentTarget.dataset.behavior || 'unknown';
    storage.recordParentPostPauseBehavior && storage.recordParentPostPauseBehavior(behavior, {
      source: 'focus_pause_survey'
    });
    this.setData({ parentPauseSurvey: null });
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' });
  },

  goReview() {
    navigation.navigateLearningRoute('/pages/review/review?from=focus');
  },

  goProfile() {
    wx.switchTab({ url: '/pages/profile/profile' });
  },

  onShareAppMessage() {
    const profile = storage.loadProfile ? storage.loadProfile() : {};
    const name = profile.name || '我家孩子';
    return {
      title: `${name} 今晚围绕第一步坐了一段`,
      path: `/pages/focus/focus?ref=${storage.getLocalUserId ? storage.getLocalUserId() : ''}`
    };
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
