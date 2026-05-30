const lightFeatures = require('../../utils/light-features');
const storage = require('../../utils/storage');
const navigation = require('../../utils/navigation');

let wordAudio = null;

Page({
  data: {
    wordsText: '',
    firstStepText: '',
    mistakeText: '',
    session: null,
    result: null,
    transitionPrompt: null,
    currentIndex: 0,
    voiceState: 'idle',
    voiceLine: '先输入今晚要听写的词语。',
    surfaceDepthPack: null,
    lightSeedBank: null
  },

  onLoad() {
    this.setData({
      surfaceDepthPack: storage.buildSurfaceDepthPack ? storage.buildSurfaceDepthPack('dictation') : null,
      lightSeedBank: storage.buildLightEntrySeedBank ? storage.buildLightEntrySeedBank('dictation') : null
    });
  },

  onUnload() {
    if (wordAudio && wordAudio.destroy) wordAudio.destroy();
    wordAudio = null;
  },

  onWordsInput(event) {
    this.setData({ wordsText: event.detail.value });
  },

  onFirstStepInput(event) {
    this.setData({ firstStepText: event.detail.value });
  },

  onMistakeInput(event) {
    this.setData({ mistakeText: event.detail.value });
  },

  build() {
    const session = lightFeatures.buildDictation(this.data.wordsText);
    this.setData({
      session,
      currentIndex: 0,
      result: null,
      transitionPrompt: null,
      voiceState: session.words.length ? 'ready' : 'empty',
      voiceLine: session.words.length ? `准备报第 1 个词：${session.currentWord}` : '还没有词语。先输入 3-8 个今晚要听写的词。'
    });
  },

  ensureAudio() {
    if (!wordAudio && wx.createInnerAudioContext) {
      wordAudio = wx.createInnerAudioContext();
      wordAudio.obeyMuteSwitch = false;
      wordAudio.src = '../../assets/focus/ding.mp3';
      wordAudio.volume = 0.35;
      if (wordAudio.onError) {
        wordAudio.onError(() => {
          wx.showToast({ title: '音频加载中，请重试', icon: 'none' });
        });
      }
    }
  },

  playCurrentWord() {
    const session = this.data.session || lightFeatures.buildDictation(this.data.wordsText);
    const words = session.words || [];
    if (!words.length) {
      this.setData({ session, voiceState: 'empty', voiceLine: '还没有词语。先输入词语，再开始听写。' });
      return;
    }
    const index = Math.min(Number(this.data.currentIndex || 0), words.length - 1);
    this.ensureAudio();
    if (wordAudio && wordAudio.play) wordAudio.play();
    this.setData({
      session,
      currentIndex: index,
      voiceState: 'playing',
      voiceLine: `第 ${index + 1} 个词：${words[index]}。先听清，再下笔。`
    });
  },

  nextWord() {
    const session = this.data.session || lightFeatures.buildDictation(this.data.wordsText);
    const words = session.words || [];
    const nextIndex = Math.min(Number(this.data.currentIndex || 0) + 1, Math.max(0, words.length - 1));
    this.setData({
      session,
      currentIndex: nextIndex,
      voiceState: words.length ? 'ready' : 'empty',
      voiceLine: words.length ? `准备报第 ${nextIndex + 1} 个词：${words[nextIndex]}` : '还没有词语。'
    });
  },

  submit() {
    const result = lightFeatures.submitDictation(this.data.wordsText, this.data.firstStepText, this.data.mistakeText);
    storage.recordLightEntryCompletion && storage.recordLightEntryCompletion('dictation', {
      dictationCompletionTime: new Date().toISOString(),
      wordCount: (result.session.words || []).length,
      mistakeType: result.mistakeType && result.mistakeType.id,
      reviewCardId: result.reviewCard && result.reviewCard.id
    });
    this.setData({
      session: result.session,
      result,
      transitionPrompt: {
        title: '这个方法今晚作业也能用',
        body: '听写时你先看拼音还是字形？有卡住的题吗？',
        acceptText: '去看看',
        rejectText: '今晚很顺，不用啦'
      }
    });
  },

  goCoreLoopFromDictation() {
    storage.recordLightToCoreTransition && storage.recordLightToCoreTransition('dictation', true, {
      dictationToDiagnosisClick: true
    });
    storage.recordCoreLoopEntry && storage.recordCoreLoopEntry('dictation_transition', {
      feature: 'dictation'
    });
    navigation.navigateLearningRoute('/pages/upload/upload?from=dictation');
  },

  dismissDictationTransition() {
    storage.recordLightToCoreTransition && storage.recordLightToCoreTransition('dictation', false, {
      dictationToDiagnosisClick: false
    });
    this.setData({ transitionPrompt: null });
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
