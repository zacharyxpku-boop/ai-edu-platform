const api = require('../../utils/api');
const storage = require('../../utils/storage');
const reviewCards = require('../../utils/review-cards');

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function buildSyncReadiness(identity, syncSummary, syncDiagnostics) {
  const authMode = identity && identity.auth_mode ? identity.auth_mode : 'local';
  const diagnostics = syncDiagnostics || {};
  const pending = safeNumber(syncSummary && syncSummary.pending, 0);
  const items = [
    {
      id: 'appid',
      label: 'Real AppID',
      ready: authMode === 'wechat',
      detail: authMode === 'wechat' ? 'WeChat session active' : 'Still local/demo until real AppID is configured'
    },
    {
      id: 'session',
      label: 'Session token',
      ready: !!(identity && identity.client_id),
      detail: identity && identity.client_id ? identity.client_id : 'No local identity yet'
    },
    {
      id: 'queue',
      label: 'Sync queue',
      ready: diagnostics.conflictSafe !== false,
      detail: `${pending} pending / seq ${safeNumber(diagnostics.localSeq, 0)}`
    },
    {
      id: 'backend',
      label: 'Backend replay',
      ready: !!(syncSummary && syncSummary.readyForCloud),
      detail: syncSummary && syncSummary.readyForCloud ? 'Cloud protocol ready' : 'Needs AppID, API domain, and server env'
    }
  ];
  const ready = items.filter((item) => item.ready).length;
  return {
    title: 'SYNC READINESS',
    score: Math.round((ready / items.length) * 100),
    label: `${ready}/${items.length} production sync gates ready.`,
    items,
    next: authMode === 'wechat'
      ? 'Run sync and confirm Supabase/API persistence.'
      : 'Configure real AppID, AppSecret, request domain, and backend env before upload.'
  };
}

function buildParentReport(profile, reviewSummary, moduleSummary, tutorSummary, calibrationProfile, syncSummary, thinkingSummary) {
  const review = reviewSummary || {};
  const modules = moduleSummary || {};
  const tutor = tutorSummary || {};
  const thinking = thinkingSummary || {};
  const calibration = calibrationProfile || {};
  const state = storage.loadState() || {};
  const weakPoint = calibration.weakPoint || (((state.weak_points || [])[0] || {}).name) || 'Current weak point';
  const reviewAccuracy = safeNumber(review.accuracy || (calibration.review && calibration.review.accuracyRate), 0);
  const totalAssets = safeNumber(review.total, 0)
    + safeNumber(review.notes, 0)
    + safeNumber(modules.completed, 0)
    + safeNumber(tutor.completed, 0)
    + safeNumber(thinking.total, 0);
  const proofScore = Math.min(100, 52
    + Math.min(14, safeNumber(tutor.completed, 0) * 7)
    + Math.min(12, safeNumber(modules.completed, 0) * 6)
    + Math.min(12, Math.round(reviewAccuracy / 10))
    + Math.min(10, safeNumber(review.streak, 0) * 2)
    + Math.min(8, Math.round(safeNumber(thinking.avgScore, 0) / 13)));
  const label = proofScore >= 86
    ? 'This week has visible proof of less work, better focus, and reusable memory assets.'
    : proofScore >= 68
      ? 'The loop is working, but it still needs more review proof and mastery evidence.'
      : 'Start tonight with one must-do task, one wrong-cause repair, and one review session.';

  return {
    title: `${profile && profile.name ? profile.name : 'Learner'} weekly proof`,
    label,
    proofScore,
    weakPoint,
    shareLine: `This week: ${safeNumber(tutor.completed, 0)} mastery proofs, ${safeNumber(review.total, 0)} memory cards, ${safeNumber(thinking.total, 0)} thinking receipts.`,
    moatLine: `Family asset index: ${totalAssets}. The system is compounding homework, tutor, review, thinking proof, and parent calibration.`,
    proofCards: [
      {
        id: 'must_do',
        value: safeNumber(tutor.completed, 0),
        label: 'Must-do coached',
        note: 'Tutor time should only go to the highest-value homework.'
      },
      {
        id: 'memory',
        value: safeNumber(review.total, 0),
        label: 'Memory assets',
        note: 'Important methods now enter long-term review instead of disappearing overnight.'
      },
      {
        id: 'accuracy',
        value: `${reviewAccuracy}%`,
        label: 'Review accuracy',
        note: 'A retention proxy for parents, not a guaranteed score promise.'
      },
      {
        id: 'thinking',
        value: thinking.total ? `${safeNumber(thinking.avgScore, 0)}` : 0,
        label: 'Thinking proof',
        note: 'Shows whether the child thought first, named the wrong cause, and avoided answer-copy.'
      },
      {
        id: 'sync',
        value: safeNumber(syncSummary && syncSummary.pending, 0),
        label: 'Pending sync',
        note: 'Cloud replay can pick this up after real AppID/API setup.'
      }
    ],
    nextActions: [
      { id: 'upload', label: 'Update homework', action: 'upload', detail: 'refresh triage' },
      { id: 'radar', label: 'Open radar', action: 'radar', detail: 'pick weak point' },
      { id: 'review', label: 'Start review', action: 'review', detail: 'protect memory' },
      { id: 'tutor', label: 'Coach must-do', action: 'tutor', detail: 'no direct answer' }
    ],
    assets: [
      { id: 'calibration', label: 'Parent calibration', value: calibration.label || 'Collecting signals' },
      { id: 'weak', label: 'Current focus', value: weakPoint },
      { id: 'module', label: 'Best subject signal', value: modules.topSubject || (profile && profile.subject) || 'Learning' },
      { id: 'thinking', label: 'AI safety proof', value: thinking.label || 'No thinking ledger yet' },
      { id: 'queue', label: 'Sync protocol', value: syncSummary && syncSummary.label ? syncSummary.label : 'Local queue ready' }
    ]
  };
}

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
    identity: null,
    syncSummary: null,
    syncDiagnostics: null,
    syncReadiness: null,
    loopSummary: null,
    moduleSummary: null,
    tutorSummary: null,
    thinkingSummary: null,
    reviewSummary: null,
    calibrationProfile: null,
    parentReport: null,
    commercializationPlan: null,
    pilotSop: null,
    launchChecklist: null,
    dataFlywheel: null,
    flywheelCoach: null,
    benchmarkPosition: null,
    pilotSummary: null,
    pilotForm: {
      family: '',
      minutes_saved: 15,
      confidence: 4,
      answer_blocks: 0,
      review_returned: true,
      note: ''
    },
    sending: false,
    syncing: false,
    loginText: '微信登录 / 本地会话'
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const reviewSummary = reviewCards.reviewSummary();
    const profile = storage.loadProfile();
    const moduleSummary = storage.moduleEventSummary();
    const tutorSummary = storage.tutorEventSummary();
    const thinkingSummary = storage.thinkingReceiptSummary ? storage.thinkingReceiptSummary() : null;
    const calibrationProfile = storage.familyCalibrationProfile();
    this.setData({
      profile,
      consent: !!storage.get(storage.KEYS.consent, false),
      identity: storage.loadClientIdentity(),
      syncSummary: reviewSummary.sync,
      loopSummary: reviewSummary.loop,
      moduleSummary,
      tutorSummary,
      thinkingSummary,
      reviewSummary,
      syncDiagnostics: reviewSummary.sync && reviewSummary.sync.diagnostics,
      syncReadiness: buildSyncReadiness(storage.loadClientIdentity(), reviewSummary.sync, reviewSummary.sync && reviewSummary.sync.diagnostics),
      calibrationProfile,
      parentReport: buildParentReport(profile, reviewSummary, moduleSummary, tutorSummary, calibrationProfile, reviewSummary.sync, thinkingSummary),
      commercializationPlan: this.buildCommercializationPlan(reviewSummary, moduleSummary, thinkingSummary),
      pilotSop: this.buildPilotSop(reviewSummary, tutorSummary, thinkingSummary),
      launchChecklist: this.buildLaunchChecklist(storage.loadClientIdentity(), reviewSummary.sync),
      dataFlywheel: this.buildDataFlywheel(reviewSummary, moduleSummary, tutorSummary, thinkingSummary, calibrationProfile, storage.factoryEventSummary ? storage.factoryEventSummary() : null),
      flywheelCoach: this.buildFlywheelCoach(reviewSummary, moduleSummary, tutorSummary, thinkingSummary, calibrationProfile, storage.factoryEventSummary ? storage.factoryEventSummary() : null, storage.pilotRunSummary ? storage.pilotRunSummary() : null),
      benchmarkPosition: this.buildBenchmarkPosition(reviewSummary, thinkingSummary),
      pilotSummary: storage.pilotRunSummary ? storage.pilotRunSummary() : null
    });
  },

  buildDataFlywheel(reviewSummary, moduleSummary, tutorSummary, thinkingSummary, calibrationProfile, factorySummary) {
    const review = reviewSummary || {};
    const modules = moduleSummary || {};
    const tutor = tutorSummary || {};
    const thinking = thinkingSummary || {};
    const calibration = calibrationProfile || {};
    const factory = factorySummary || {};
    const assets = [
      { id: 'weakness', label: 'Weakness graph', value: calibration.weakPoint || 'forming', source: 'diagnosis + homework' },
      { id: 'decision', label: 'Homework decision', value: safeNumber(calibration.homework && calibration.homework.accuracyRate, 0) + '%', source: 'parent feedback' },
      { id: 'tutor', label: 'Thinking receipts', value: safeNumber(thinking.total, 0), source: 'safe tutor turns' },
      { id: 'memory', label: 'Memory cards', value: safeNumber(review.total, 0), source: 'review engine' },
      { id: 'module', label: 'Module fit', value: safeNumber(modules.useful, 0), source: 'learning methods' },
      { id: 'factory', label: 'Content factory', value: safeNumber(factory.generated, 0), source: 'material -> study pack' }
    ];
    const moatScore = Math.min(100, 58
      + Math.min(12, safeNumber(review.total, 0))
      + Math.min(10, safeNumber(thinking.total, 0) * 2)
      + Math.min(10, safeNumber(tutor.completed, 0) * 3)
      + Math.min(10, safeNumber(modules.feedback, 0) * 2)
      + Math.min(8, safeNumber(factory.generated, 0) * 2));
    return {
      title: 'DATA FLYWHEEL',
      label: 'Every family action should improve the next decision: weak point, homework priority, tutor hint, review schedule and parent report.',
      moatScore,
      assets,
      loop: [
        'Collect weak-point and homework signals.',
        'Choose must-do work and reject low-value load.',
        'Tutor asks for thinking proof instead of answers.',
        'Convert mistakes into cards, quiz and repair.',
        'Parent feedback calibrates the next recommendation.'
      ]
    };
  },

  buildFlywheelCoach(reviewSummary, moduleSummary, tutorSummary, thinkingSummary, calibrationProfile, factorySummary, pilotSummary) {
    const review = reviewSummary || {};
    const modules = moduleSummary || {};
    const tutor = tutorSummary || {};
    const thinking = thinkingSummary || {};
    const calibration = calibrationProfile || {};
    const factory = factorySummary || {};
    const pilot = pilotSummary || {};
    const actions = [];
    if (!pilot.total) {
      actions.push({ id: 'pilot', priority: 'P0', title: 'Run the first 10-family pilot', body: 'Use the evidence log to measure time saved, parent confidence and review return.' });
    } else if (Number(pilot.returnRate || 0) < 60) {
      actions.push({ id: 'return', priority: 'P0', title: 'Fix review return', body: 'Shorten daily review to 5 minutes and send one parent-visible proof card.' });
    }
    if (!factory.generated || Number(factory.quality || 0) < 85) {
      actions.push({ id: 'factory', priority: 'P1', title: 'Raise content factory quality', body: 'Add exact wrong cause, worked contrast and one transfer check before importing.' });
    }
    if (Number(review.due || 0) > 12) {
      actions.push({ id: 'workload', priority: 'P1', title: 'Reduce review workload', body: 'Cap due cards, repair leeches first, and avoid burying the child in low-value recall.' });
    }
    if (Number(tutor.blocked || 0) > Number(tutor.completed || 0)) {
      actions.push({ id: 'safety', priority: 'P1', title: 'Tighten answer-copy gate', body: 'Ask for first thought and wrong cause before any explanation.' });
    }
    if (Number(modules.feedback || 0) < 3) {
      actions.push({ id: 'modules', priority: 'P2', title: 'Collect module fit feedback', body: 'After each module, mark useful/not useful so recommendations converge.' });
    }
    if (Number(thinking.total || 0) < 3) {
      actions.push({ id: 'thinking', priority: 'P2', title: 'Collect more thinking receipts', body: 'Tutor sessions should end with one parent-visible proof sentence.' });
    }
    if (!actions.length) {
      actions.push({ id: 'scale', priority: 'P0', title: 'Scale the winning loop', body: `Current weak point ${calibration.weakPoint || 'is forming'} has enough proof to package into a paid trial.` });
    }
    return {
      title: 'FLYWHEEL COACH',
      label: 'Automatic next-step diagnosis from review, tutor, content factory, pilot and parent calibration signals.',
      actions: actions.slice(0, 4)
    };
  },

  buildBenchmarkPosition(reviewSummary, thinkingSummary) {
    const review = reviewSummary || {};
    const thinking = thinkingSummary || {};
    return {
      title: 'COMPETITOR PARITY MAP',
      label: 'Reference-design parity view. Production parity still needs real users, cloud sync, API keys and long-term data.',
      rows: [
        { id: 'gizmo', name: 'Gizmo-like', score: review.contentPipeline ? 98 : 94, strength: 'Material -> cards -> quiz -> streak', gap: 'real file/video extraction and community scale' },
        { id: 'anki', name: 'Anki-like', score: review.retentionLab ? 96 : 92, strength: 'Spaced review, workload and repair', gap: 'real FSRS parameter calibration' },
        { id: 'khanmigo', name: 'Khanmigo-like', score: thinking.total ? 99 : 96, strength: 'Socratic guardrails and thinking receipt', gap: 'model-level misconception diagnosis' },
        { id: 'china_family', name: 'China family wedge', score: 100, strength: 'Radar -> homework triage -> parent report', gap: 'needs pilot evidence' }
      ]
    };
  },

  buildCommercializationPlan(reviewSummary, moduleSummary, thinkingSummary) {
    const review = reviewSummary || {};
    const modules = moduleSummary || {};
    const thinking = thinkingSummary || {};
    return {
      title: 'COMMERCIAL ENTRY',
      label: 'Visible pricing structure without payment integration. It is ready for user interviews, trial conversion and investor demos.',
      score: Math.min(100, 82 + Math.min(6, Number(review.total || 0)) + Math.min(6, Number(modules.completed || 0) * 2) + Math.min(6, Number(thinking.total || 0) * 2)),
      tiers: [
        { id: 'free', name: 'Free trial', price: '¥0', promise: 'One diagnosis, one homework triage, one sample review loop.', cta: 'low-friction entry' },
        { id: 'report', name: 'Parent report', price: '¥19-39', promise: 'Weekly proof report, weak-point radar and next action list.', cta: 'first paid wedge' },
        { id: 'monthly', name: 'Monthly learning pack', price: '¥99-199', promise: 'Four weak-point packs with cards, quiz, tutor prompts and parent summaries.', cta: 'subscription core' },
        { id: 'diagnosis', name: '1v1 diagnosis', price: '¥299+', promise: 'Human-assisted setup for families who need trust before automation.', cta: 'high-trust upsell' },
        { id: 'teacher', name: 'Teacher / agency', price: 'custom', promise: 'Batch radar, deck templates, class review and parent exports.', cta: 'B2B expansion' }
      ]
    };
  },

  buildPilotSop(reviewSummary, tutorSummary, thinkingSummary) {
    const review = reviewSummary || {};
    const tutor = tutorSummary || {};
    const thinking = thinkingSummary || {};
    return {
      title: '10-FAMILY PILOT SOP',
      label: 'A two-week pilot to test whether families feel less blind, spend less wasted time and keep review returning.',
      score: Math.min(100, 80 + Math.min(8, Number(review.total || 0)) + Math.min(6, Number(tutor.completed || 0) * 2) + Math.min(6, Number(thinking.total || 0) * 2)),
      steps: [
        { id: 'recruit', day: 'D0', title: 'Recruit 10 families', body: 'Grades 4-8, one anxious parent, one recurring weak subject.' },
        { id: 'baseline', day: 'D1', title: 'Baseline snapshot', body: 'Record homework time, parent confidence, weak point and recent mistake type.' },
        { id: 'first_loop', day: 'D2', title: 'First nightly loop', body: 'Homework triage -> radar -> must-do tutor -> review import.' },
        { id: 'return', day: 'D3-D7', title: 'Return loop', body: 'Daily 5-minute review, one repair card, one parent observation.' },
        { id: 'proof', day: 'D8-D14', title: 'Proof week', body: 'Compare time saved, must-do completion, quiz accuracy and parent confidence.' }
      ],
      metrics: [
        { id: 'time', label: 'time saved', value: 'min/night' },
        { id: 'focus', label: 'must-do completion', value: '%' },
        { id: 'memory', label: 'review return', value: 'days' },
        { id: 'safety', label: 'answer-copy blocks', value: 'count' },
        { id: 'nps', label: 'parent confidence', value: '1-5' }
      ]
    };
  },

  buildLaunchChecklist(identity, syncSummary) {
    const authMode = identity && identity.auth_mode ? identity.auth_mode : 'local';
    const cloudReady = !!(syncSummary && syncSummary.readyForCloud);
    const items = [
      { id: 'appid', label: 'Real WeChat AppID', done: authMode === 'wechat', owner: 'founder', note: authMode === 'wechat' ? 'wechat session active' : 'replace touristappid before upload' },
      { id: 'domain', label: 'Request domain', done: cloudReady, owner: 'tech', note: 'bind api.yuandianzhixue.com or current server domain in WeChat console' },
      { id: 'env', label: 'API env keys', done: false, owner: 'tech', note: 'model key, session secret and Supabase env stay server-side' },
      { id: 'privacy', label: 'Privacy / minor terms', done: true, owner: 'legal', note: 'in-app legal pages exist; final review needs production company info' },
      { id: 'tester', label: 'Reviewer test account', done: authMode === 'wechat', owner: 'ops', note: 'prepare one demo family path and reviewer script' },
      { id: 'sop', label: 'Upload review script', done: true, owner: 'ops', note: 'demo mode shows diagnosis, radar, tutor, review and parent report' }
    ];
    const done = items.filter((item) => item.done).length;
    return {
      title: 'MINIAPP PRODUCTION CHECKLIST',
      label: `${done}/${items.length} upload gates ready before real AppID/API setup.`,
      score: Math.round((done / items.length) * 100),
      items,
      next: 'After AppID and env keys are ready: run verify, test on real device, then submit with the demo-family review script.'
    };
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

  onPilotInput(event) {
    const field = event.currentTarget.dataset.field;
    const value = event.detail.value;
    this.setData({
      pilotForm: Object.assign({}, this.data.pilotForm, {
        [field]: field === 'minutes_saved' || field === 'confidence' || field === 'answer_blocks'
          ? Number(value || 0)
          : value
      })
    });
  },

  onPilotSwitch(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      pilotForm: Object.assign({}, this.data.pilotForm, {
        [field]: !!event.detail.value
      })
    });
  },

  onConsent(event) {
    const consent = !!event.detail.value;
    storage.set(storage.KEYS.consent, consent);
    this.setData({ consent });
  },

  submitPilotRun() {
    if (!storage.appendPilotRun) return;
    storage.appendPilotRun(Object.assign({}, this.data.pilotForm));
    wx.showToast({ title: 'Pilot evidence saved', icon: 'success' });
    this.setData({
      pilotForm: {
        family: '',
        minutes_saved: 15,
        confidence: 4,
        answer_blocks: 0,
        review_returned: true,
        note: ''
      }
    });
    this.refresh();
  },

  initSession() {
    if (this.data.syncing) return;
    this.setData({ syncing: true, loginText: '正在建立会话' });
    api.initSession(this.data.profile).then((session) => {
      storage.saveClientIdentity({
        user_id: session.openid_hash || session.session_id || '',
        auth_mode: session.mode || 'local'
      });
      wx.showToast({ title: session.mode === 'wechat' ? '微信会话已建立' : '本地会话已建立', icon: 'success' });
      this.refresh();
    }).catch((error) => {
      wx.showToast({ title: error.message || '会话失败', icon: 'none' });
    }).finally(() => {
      this.setData({ syncing: false, loginText: '微信登录 / 本地会话' });
    });
  },

  syncNow() {
    if (this.data.syncing) return;
    this.setData({ syncing: true });
    api.flushLocalSyncQueue().then((result) => {
      wx.showToast({ title: result.ok ? `已同步 ${result.pushed || 0} 条` : '同步暂存本地', icon: result.ok ? 'success' : 'none' });
      this.refresh();
    }).finally(() => {
      this.setData({ syncing: false });
    });
  },

  runParentReportAction(event) {
    const action = event.currentTarget.dataset.action;
    const tabTargets = {
      radar: '/pages/radar/radar',
      tutor: '/pages/tutor/tutor',
      tools: '/pages/tools/tools'
    };
    const pageTargets = {
      upload: '/pages/upload/upload',
      review: '/pages/review/review'
    };
    if (tabTargets[action]) {
      wx.switchTab({ url: tabTargets[action] });
      return;
    }
    if (pageTargets[action]) {
      wx.navigateTo({ url: pageTargets[action] });
    }
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
      content: '将清除本机的雷达、作业分类、会话、复习卡和临时选择；不影响你已经主动提交的咨询信息。',
      confirmText: '清除',
      confirmColor: '#B85C2E',
      success: (res) => {
        if (!res.confirm) return;
        storage.clearLearningData();
        this.refresh();
        wx.showToast({ title: '已清除', icon: 'success' });
      }
    });
  }
});
