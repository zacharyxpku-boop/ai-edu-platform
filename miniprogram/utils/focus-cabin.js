const storage = require('./storage');

const KEYS = {
  settings: 'ydzx.focus.cabin.settings.v1',
  current: 'ydzx.focus.cabin.current.v1',
  history: 'ydzx.focus.cabin.history.v1'
};

const DURATION_MODES = [
  { id: '15', label: '15 分钟', minutes: 15, tone: '先坐稳' },
  { id: '25', label: '25 分钟', minutes: 25, tone: '标准专注' },
  { id: '45', label: '45 分钟', minutes: 45, tone: '做完一小段' },
  { id: '60', label: '60 分钟', minutes: 60, tone: '深一点' }
];

const BREAK_MODES = [
  { id: 'short_break', label: '短休息', minutes: 5 },
  { id: 'long_break', label: '长休息', minutes: 12 }
];

const SCENES = [
  { id: 'warm_desk', name: '暖光书桌', mood: '稳稳坐下', gradient: 'scene-warm' },
  { id: 'rain_window', name: '雨天窗边', mood: '慢慢来', gradient: 'scene-rain' },
  { id: 'night_room', name: '夜晚书桌', mood: '夜里也能慢慢来', gradient: 'scene-night' },
  { id: 'morning_study', name: '清晨书房', mood: '清爽开始', gradient: 'scene-morning' },
  { id: 'quiet_library', name: '安静图书馆', mood: '低声陪着', gradient: 'scene-library' },
  { id: 'starship', name: '星船学习舱', mood: '咕点值班', gradient: 'scene-starship' },
  { id: 'city_night', name: '城市夜景', mood: '窗外很远，先看眼前', gradient: 'scene-city' },
  { id: 'anime_companion', name: '轻陪伴', mood: '轻一点，也可以认真', gradient: 'scene-soft' }
];

const AUDIO_MODES = [
  { id: 'mute', name: '静音', detail: '只保留咕点陪着' },
  { id: 'rain', name: '雨声', detail: '适合慢慢读题' },
  { id: 'white_noise', name: '白噪音', detail: '挡住杂音' },
  { id: 'cafe', name: '轻咖啡馆', detail: '有一点人间背景' },
  { id: 'soft_music', name: '轻音乐', detail: '不抢注意力' },
  { id: 'library', name: '图书馆环境音', detail: '安静但不孤单' },
  { id: 'space_cabin', name: '星船舱', detail: '低低的航行声' }
];

const EXPERIENCE_SCENES = [
  { id: 'night_desk', name: '深夜书桌', mood: '灯光很小，先稳住这一段', gradient: 'scene-night-desk', asset: '/assets/focus/night-desk.png' },
  { id: 'morning_window', name: '清晨窗景', mood: '暖一点，慢慢开始', gradient: 'scene-morning-window', asset: '/assets/focus/morning-window.png' },
  { id: 'quiet_forest', name: '森林静谧', mood: '低声陪着，不催', gradient: 'scene-quiet-forest', asset: '/assets/focus/quiet-forest.png' }
];

const EXPERIENCE_AUDIO_MODES = [
  { id: 'mute', name: '安静', detail: '只保留呼吸灯', pulse: 'mute' },
  { id: 'rain', name: '雨声', detail: '适合慢慢读题', pulse: 'rain', asset: '/assets/focus/rain.mp3' },
  { id: 'cafe', name: '咖啡', detail: '一点低声背景', pulse: 'cafe', asset: '/assets/focus/cafe.mp3' },
  { id: 'campfire', name: '篝火', detail: '稳定、轻暖', pulse: 'campfire', asset: '/assets/focus/campfire.mp3' }
];

function nowIso() {
  return new Date().toISOString();
}

function today() {
  return nowIso().slice(0, 10);
}

function randomPart() {
  return Math.random().toString(36).slice(2, 8);
}

function get(key, fallback) {
  return storage.get ? storage.get(key, fallback) : fallback;
}

function set(key, value) {
  return storage.set ? storage.set(key, value) : value;
}

function durationById(id) {
  return DURATION_MODES.concat(BREAK_MODES).find((item) => item.id === String(id)) || DURATION_MODES[1];
}

function sceneById(id) {
  return EXPERIENCE_SCENES.find((item) => item.id === id) || SCENES.find((item) => item.id === id) || EXPERIENCE_SCENES[0];
}

function audioById(id) {
  return EXPERIENCE_AUDIO_MODES.find((item) => item.id === id) || AUDIO_MODES.find((item) => item.id === id) || EXPERIENCE_AUDIO_MODES[1];
}

function defaultSettings() {
  return {
    selectedDurationId: '25',
    selectedSceneId: 'night_desk',
    selectedAudioId: 'mute',
    muted: true,
    volume: 40,
    manualTask: '',
    checklist: [],
    roomMode: 'local_room',
    updated_at: nowIso()
  };
}

function loadSettings() {
  return Object.assign(defaultSettings(), get(KEYS.settings, {}));
}

function saveSettings(patch = {}) {
  return set(KEYS.settings, Object.assign(loadSettings(), patch || {}, { updated_at: nowIso() }));
}

function loadCurrentSession() {
  const session = get(KEYS.current, null);
  if (!session || typeof session !== 'object') return null;
  return session;
}

function saveCurrentSession(session) {
  if (!session) {
    if (storage.remove) storage.remove(KEYS.current);
    return null;
  }
  return set(KEYS.current, Object.assign({}, session, { updated_at: nowIso() }));
}

function loadHistory() {
  const list = get(KEYS.history, []);
  return Array.isArray(list) ? list : [];
}

function saveHistory(list) {
  return set(KEYS.history, Array.isArray(list) ? list.slice(0, 180) : []);
}

function normalizeFirstStepEvidence(focus = {}) {
  if (storage.normalizeFirstStepEvidence) return storage.normalizeFirstStepEvidence(focus || {});
  const systemSuggestedStep = String(focus.systemSuggestedStep || focus.miniActionText || '先把题目问什么说出来。').trim();
  const childArticulatedStep = String(focus.childArticulatedStep || focus.childStepSentence || '').trim();
  return {
    stuckPointText: focus.stuckPointText || focus.sourceText || focus.thought || '',
    taskType: focus.taskType || 'unknown',
    systemSuggestedStep,
    childArticulatedStep,
    childStepSentence: childArticulatedStep,
    childStepQuality: childArticulatedStep ? 'partial' : 'empty',
    firstStepSource: childArticulatedStep ? 'child_articulated' : 'system_suggested',
    firstStepStatus: focus.firstStepStatus || (childArticulatedStep ? 'child_confirmed' : 'suggested'),
    quickChoices: []
  };
}

function focusTargetFromEvidence(focus, manualTask = '') {
  const hasFocus = !!(focus && focus.id);
  const evidence = hasFocus ? normalizeFirstStepEvidence(focus || {}) : {
    stuckPointText: '',
    systemSuggestedStep: '',
    childArticulatedStep: '',
    taskType: ''
  };
  const childStep = String(evidence.childArticulatedStep || '').trim();
  const systemStep = String(evidence.systemSuggestedStep || '').trim();
  const manual = String(manualTask || loadSettings().manualTask || '').trim();
  const title = childStep || systemStep || manual || '还没有今晚第一步';
  const targetSource = childStep ? 'child_articulated' : systemStep ? 'system_suggested' : manual ? 'manual' : 'manual';
  return {
    source: hasFocus ? 'today_focus' : (manual ? 'manual' : 'empty'),
    focusId: hasFocus ? focus.id : '',
    title: title.slice(0, 80),
    issueType: focus && focus.issueType ? focus.issueType : '',
    linkedStuckPointText: evidence.stuckPointText || '',
    linkedSystemSuggestedStep: systemStep,
    linkedChildArticulatedStep: childStep,
    targetSource,
    taskBound: !!(childStep || systemStep || manual),
    parentLine: childStep
      ? `孩子今晚围绕自己说出的第一步：${childStep}`
      : systemStep
        ? `孩子今晚围绕咕点建议的第一步：${systemStep}`
        : manual
          ? `孩子今晚先专注：${manual}`
          : '今晚还没有第一步记录。'
  };
}

function resolveFocusTarget(manualTask = '') {
  const todaySession = storage.getTodaySession ? storage.getTodaySession() : null;
  if (todaySession && todaySession.childArticulatedStep) {
    return {
      source: 'today_session',
      focusId: todaySession.reviewCardId || '',
      title: String(todaySession.childArticulatedStep || '').slice(0, 80),
      issueType: todaySession.taskType || '',
      linkedStuckPointText: todaySession.stuckPointText || '',
      linkedSystemSuggestedStep: '',
      linkedChildArticulatedStep: todaySession.childArticulatedStep || '',
      targetSource: todaySession.firstStepSource || 'child_articulated',
      taskBound: true,
      parentLine: `孩子今晚围绕自己说出的第一步：${todaySession.childArticulatedStep}`
    };
  }
  const focus = storage.loadTodayFocus ? storage.loadTodayFocus() : null;
  if (focus && focus.id) return focusTargetFromEvidence(focus, manualTask);
  return focusTargetFromEvidence(null, manualTask);
}

function createSession(options = {}) {
  const settings = loadSettings();
  const duration = durationById(options.durationId || settings.selectedDurationId);
  const scene = sceneById(options.sceneId || settings.selectedSceneId);
  const audio = audioById(options.audioId || settings.selectedAudioId);
  const focusTarget = resolveFocusTarget(options.manualTask || settings.manualTask);
  const seconds = Math.max(60, Number(duration.minutes || 25) * 60);
  return {
    id: `focus_${Date.now()}_${randomPart()}`,
    status: 'idle',
    mode: String(duration.id).indexOf('break') >= 0 ? 'break' : 'focus',
    durationId: duration.id,
    durationMinutes: duration.minutes,
    remainingSeconds: seconds,
    totalSeconds: seconds,
    roundCurrent: 1,
    roundTotal: Number(options.roundTotal || 1),
    sceneId: scene.id,
    audioId: audio.id,
    muted: settings.muted !== false,
    volume: Number(settings.volume || 40),
    focusTarget,
    checklist: Array.isArray(settings.checklist) ? settings.checklist : [],
    mascotLine: '别急，我们先专注这一小步。',
    startedAt: '',
    pausedAt: '',
    completedAt: '',
    created_at: nowIso(),
    updated_at: nowIso()
  };
}

function markTodayFocusStatus(firstStepStatus) {
  const focus = storage.loadTodayFocus ? storage.loadTodayFocus() : null;
  if (!focus || !focus.id || !storage.saveTodayFocus) return focus;
  return storage.saveTodayFocus(Object.assign({}, focus, {
    firstStepStatus,
    updatedAt: nowIso()
  }));
}

function startSession(options = {}) {
  const current = loadCurrentSession();
  const base = current && current.status !== 'completed' && current.status !== 'interrupted'
    ? current
    : createSession(options);
  const session = Object.assign({}, base, {
    status: 'running',
    startedAt: base.startedAt || nowIso(),
    pausedAt: '',
    mascotLine: '我在旁边，不吵你。先把这一小步写下去。'
  });
  if (session.focusTarget && session.focusTarget.source === 'today_focus') markTodayFocusStatus('focus_started');
  saveCurrentSession(session);
  return session;
}

function pauseSession() {
  const current = loadCurrentSession();
  if (!current) return null;
  return saveCurrentSession(Object.assign({}, current, {
    status: 'paused',
    pausedAt: nowIso(),
    mascotLine: '卡住没关系，我陪你坐一会儿。'
  }));
}

function resumeSession() {
  const current = loadCurrentSession();
  if (!current) return null;
  return saveCurrentSession(Object.assign({}, current, {
    status: 'running',
    pausedAt: '',
    mascotLine: '回来就很好。继续这一小步。'
  }));
}

function resetSession(options = {}) {
  const session = createSession(options);
  saveCurrentSession(session);
  return session;
}

function elapsedSeconds(session) {
  return Math.max(0, Number(session.totalSeconds || 0) - Number(session.remainingSeconds || 0));
}

function sessionEvidence(session, completionType, seconds) {
  const target = session.focusTarget || {};
  const actualFocusSeconds = Math.max(0, Number(seconds || 0));
  const title = target.title || '今晚第一步';
  const interrupted = completionType === 'interrupted';
  return {
    linkedStuckPointText: target.linkedStuckPointText || '',
    linkedSystemSuggestedStep: target.linkedSystemSuggestedStep || '',
    linkedChildArticulatedStep: target.linkedChildArticulatedStep || '',
    targetSource: target.targetSource || (target.source === 'manual' ? 'manual' : 'system_suggested'),
    taskBound: !!target.taskBound,
    completionType,
    actualFocusSeconds,
    focusEvidenceText: interrupted
      ? `今天围绕“${title}”坐下来过一段，先把这里留住。`
      : `你围绕这一小步坐了一段。${title}`,
    parentRecapLine: interrupted
      ? `孩子今天在“${title}”上开始过，中途停下也算留下了努力证据。`
      : `孩子今天围绕“${title}”专注了一段，这一步真的开始过了。`,
    childEncouragementLine: interrupted
      ? '今天能坐下来一下，也算开始。'
      : '这一步，今天真的开始过了。'
  };
}

function appendSessionToHistory(record) {
  saveHistory([record].concat(loadHistory()).slice(0, 180));
  return record;
}

function interruptSession(reason = '') {
  const current = loadCurrentSession() || createSession();
  const actualFocusSeconds = elapsedSeconds(current);
  const interruptedAt = nowIso();
  const evidence = sessionEvidence(current, 'interrupted', actualFocusSeconds);
  const session = Object.assign({}, current, evidence, {
    status: 'interrupted',
    interruptedAt,
    interruptedReason: String(reason || '').trim().slice(0, 60),
    completedSeconds: actualFocusSeconds,
    gentleInterruptionRecap: '没关系，这一步我们下次从这里接着来。',
    mascotLine: '今天能坐下来一下，也算开始。'
  });
  appendSessionToHistory(session);
  if (storage.recordFocusSessionEvidence) storage.recordFocusSessionEvidence(session);
  saveCurrentSession(null);
  return session;
}

function tickSession(deltaSeconds = 1) {
  const current = loadCurrentSession();
  if (!current || current.status !== 'running') return current;
  const remainingSeconds = Math.max(0, Number(current.remainingSeconds || 0) - Math.max(1, Number(deltaSeconds || 1)));
  const next = saveCurrentSession(Object.assign({}, current, { remainingSeconds }));
  return remainingSeconds <= 0 ? completeSession({ auto: true }) : next;
}

function updateChecklistItem(id, done) {
  const settings = loadSettings();
  const checklist = (settings.checklist || []).map((item) => (
    item.id === id ? Object.assign({}, item, { done: !!done }) : item
  ));
  saveSettings({ checklist });
  const current = loadCurrentSession();
  if (current) saveCurrentSession(Object.assign({}, current, { checklist }));
  return checklist;
}

function setManualTask(text = '') {
  const manualTask = String(text || '').trim().slice(0, 80);
  saveSettings({ manualTask });
  const current = loadCurrentSession();
  if (current && current.focusTarget && current.focusTarget.source === 'empty') {
    saveCurrentSession(Object.assign({}, current, { focusTarget: resolveFocusTarget(manualTask) }));
  }
  return manualTask;
}

function selectScene(sceneId) {
  const scene = sceneById(sceneId);
  saveSettings({ selectedSceneId: scene.id });
  const current = loadCurrentSession();
  if (current) saveCurrentSession(Object.assign({}, current, { sceneId: scene.id }));
  return scene;
}

function selectAudio(audioId) {
  const audio = audioById(audioId);
  saveSettings({ selectedAudioId: audio.id, muted: audio.id === 'mute' });
  const current = loadCurrentSession();
  if (current) saveCurrentSession(Object.assign({}, current, { audioId: audio.id, muted: audio.id === 'mute' }));
  return audio;
}

function setVolume(volume) {
  const value = Math.max(0, Math.min(100, Number(volume || 0)));
  saveSettings({ volume: value, muted: value === 0 });
  const current = loadCurrentSession();
  if (current) saveCurrentSession(Object.assign({}, current, { volume: value, muted: value === 0 }));
  return value;
}

function uniqueCompletedDates(history) {
  return Array.from(new Set((history || [])
    .filter((item) => item && item.completionType !== 'interrupted')
    .map((item) => String(item.completedAt || item.created_at || '').slice(0, 10))
    .filter(Boolean))).sort();
}

function calculateStreak(history = [], nowDate = today()) {
  const dates = uniqueCompletedDates(history);
  let cursor = new Date(`${nowDate}T00:00:00`);
  let streak = 0;
  const setDates = new Set(dates);
  while (setDates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function progressSummary(history = loadHistory()) {
  const totalSessions = history.length;
  const effectiveSessions = history.filter((item) => item && item.completionType !== 'interrupted');
  const totalSeconds = history.reduce((sum, item) => sum + Number(item.actualFocusSeconds || item.completedSeconds || 0), 0);
  const todayCount = history.filter((item) => String(item.completedAt || item.interruptedAt || '').slice(0, 10) === today()).length;
  const focusEvidenceCount = history.filter((item) => item && item.taskBound).length;
  const streak = calculateStreak(history);
  const badges = [];
  if (totalSessions >= 1) badges.push({ id: 'first_sit', label: '第一次坐下来' });
  if (totalSeconds >= 25 * 60) badges.push({ id: 'twenty_five', label: '围绕第一步 25 分钟' });
  if (streak >= 3) badges.push({ id: 'three_days', label: '三天有痕迹' });
  return {
    totalSessions,
    totalFocusMinutes: Math.round(totalSeconds / 60),
    streak,
    tonightCompletionCount: todayCount,
    focusEvidenceCount,
    completedSessions: effectiveSessions.length,
    interruptedSessions: totalSessions - effectiveSessions.length,
    badges,
    parentRecap: totalSessions
      ? `已留下 ${totalSessions} 次围绕第一步的专注痕迹，共 ${Math.round(totalSeconds / 60)} 分钟。`
      : '还没有专注记录。'
  };
}

function sessionProgress(session = {}) {
  const total = Math.max(1, Number(session.totalSeconds || 1));
  const remaining = Math.max(0, Number(session.remainingSeconds || 0));
  const elapsed = Math.max(0, total - remaining);
  const percent = Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
  return {
    percent,
    ringStyle: `--progress:${percent};`,
    isLastMinute: remaining > 0 && remaining <= 60,
    breathing: session.status === 'running'
  };
}

function completionCopy(record) {
  const minutes = Math.max(1, Math.round(Number(record.actualFocusSeconds || record.completedSeconds || 0) / 60));
  const target = record.focusTarget || {};
  return {
    childLine: '你围绕这一小步坐了一段。',
    summary: `这一步，今天真的开始过了。本次围绕：${target.title || '今晚第一步'}，约 ${minutes} 分钟。`,
    parentRecap: record.parentRecapLine || `${target.parentLine || '孩子围绕第一步坐了一段。'} 本次约 ${minutes} 分钟。`
  };
}

function completeSession(options = {}) {
  const current = loadCurrentSession() || createSession(options);
  const elapsed = Math.max(60, elapsedSeconds(current));
  const completedSeconds = options.completedSeconds
    ? Math.max(60, Number(options.completedSeconds))
    : (options.auto ? Number(current.totalSeconds || elapsed) : Math.max(elapsed, Math.min(Number(current.totalSeconds || elapsed), Number(current.durationMinutes || 15) * 60)));
  const completionType = options.manualDone ? 'manual_done' : 'completed';
  const evidence = sessionEvidence(current, completionType, completedSeconds);
  const record = Object.assign({}, current, evidence, {
    status: 'completed',
    completedAt: nowIso(),
    completedSeconds,
    remainingSeconds: 0,
    mascotLine: '这一步，今天真的开始过了。'
  });
  const copy = completionCopy(record);
  const savedRecord = Object.assign({}, record, copy);
  appendSessionToHistory(savedRecord);
  if (storage.recordFocusSessionEvidence) storage.recordFocusSessionEvidence(savedRecord);
  saveCurrentSession(null);
  if (savedRecord.focusTarget && savedRecord.focusTarget.source === 'today_focus') markTodayFocusStatus('focus_completed');
  if (storage.createScaffoldingChain && savedRecord.taskBound) {
    storage.createScaffoldingChain({
      taskType: (storage.loadTodayFocus && storage.loadTodayFocus() && storage.loadTodayFocus().taskType) || 'unknown',
      stuckPointText: savedRecord.linkedStuckPointText,
      systemSuggestedStep: savedRecord.linkedSystemSuggestedStep,
      childArticulatedStep: savedRecord.linkedChildArticulatedStep,
      secondStepSuggestion: (storage.buildSecondStepHint
        ? storage.buildSecondStepHint((storage.loadTodayFocus && storage.loadTodayFocus() && storage.loadTodayFocus().taskType) || 'unknown', savedRecord.linkedChildArticulatedStep || savedRecord.linkedSystemSuggestedStep).secondStep
        : '现在试着把两个条件连起来，问一句：它们有什么关系？')
    });
    if (storage.recordFirstStepEvent) {
      storage.recordFirstStepEvent({
        source: 'focus_cabin_completed',
        taskType: (storage.loadTodayFocus && storage.loadTodayFocus() && storage.loadTodayFocus().taskType) || 'unknown',
        stuckPointText: savedRecord.linkedStuckPointText,
        systemSuggestedStep: savedRecord.linkedSystemSuggestedStep,
        childArticulatedStep: savedRecord.linkedChildArticulatedStep,
        childStepQuality: savedRecord.linkedChildArticulatedStep ? 'actionable' : 'partial',
        secondStepStatus: 'needs_scaffold'
      });
    }
  }
  if (storage.appendThinkingReceipt) {
    storage.appendThinkingReceipt({
      title: '咕点专注舱记录',
      score: Math.min(100, 70 + Math.round(completedSeconds / 120)),
      status: 'focus_session_completed',
      focus: savedRecord.focusTarget && savedRecord.focusTarget.title,
      selected_text: copy.summary,
      source: 'focus_cabin',
      coach_step: 'finish_first_step',
      mastery_status: 'started_and_stayed',
      risk: 'low',
      shareLine: copy.parentRecap,
      checks: [
        { id: 'task', label: '绑定第一步', done: !!savedRecord.taskBound, detail: savedRecord.focusTarget && savedRecord.focusTarget.title },
        { id: 'time', label: '围绕这一小步坐下', done: true, detail: `${Math.round(completedSeconds / 60)} 分钟` }
      ]
    });
  }
  if (storage.appendReviewEvent) {
    storage.appendReviewEvent({
      type: 'focus_cabin_completed',
      rating: 'completed',
      focus_id: savedRecord.focusTarget && savedRecord.focusTarget.focusId,
      focus_title: savedRecord.focusTarget && savedRecord.focusTarget.title,
      completed_seconds: completedSeconds
    });
  }
  return savedRecord;
}

function parentPausePrompt(emotionLevel = 3) {
  const current = loadCurrentSession() || createSession();
  const target = current.focusTarget || {};
  const phrase = '你刚才第一步看了什么？';
  if (storage.recordParentPauseUsed) {
    storage.recordParentPauseUsed({
      focusTarget: target.title || '',
      emotionLevel
    });
  }
  const log = storage.appendParentInterventionLog ? storage.appendParentInterventionLog({
    source: 'focus_parent_pause',
    emotionLevel,
    usedProductPhrase: true,
    gaveDirectAnswer: false,
    phrase
  }) : null;
  return {
    title: '先暂停 10 秒',
    body: '忍住，先问这一句。',
    phrase,
    target: target.title || '',
    log
  };
}

function proofSummary(history = loadHistory(), todayFocus = storage.loadTodayFocus ? storage.loadTodayFocus() : null) {
  const list = Array.isArray(history) ? history : [];
  const childStepCount = [todayFocus].concat(list).filter((item) => item && item.linkedChildArticulatedStep || item && item.childArticulatedStep).length;
  const taskBoundFocusCount = list.filter((item) => item && item.taskBound).length;
  const revisitCount = (storage.loadReviewEvents ? storage.loadReviewEvents() : [])
    .filter((event) => event && (event.type === 'today_focus_review_card_created' || event.type === 'focus_revisit')).length;
  const typeCounts = {};
  [todayFocus].concat(list).forEach((item) => {
    const type = item && item.taskType;
    if (type) typeCounts[type] = (typeCounts[type] || 0) + 1;
  });
  const commonTaskType = Object.keys(typeCounts).sort((a, b) => typeCounts[b] - typeCounts[a])[0] || '';
  const insufficient = '再用几晚后，咕点会帮你看见孩子常卡在哪一步。';
  return {
    oneNightProof: list.length || todayFocus
      ? `今晚已记录 ${childStepCount ? '孩子自己的第一步' : '咕点建议的第一步'}，并留下 ${taskBoundFocusCount} 次绑定专注证据。`
      : insufficient,
    threeNightPattern: list.length >= 3
      ? `近几晚：孩子说出第一步 ${childStepCount} 次，绑定专注 ${taskBoundFocusCount} 次，轻回访 ${revisitCount} 次${commonTaskType ? `，常见任务类型：${commonTaskType}` : ''}。`
      : insufficient,
    sevenNightReadiness: list.length >= 7
      ? '已有 7 晚左右的本地痕迹，可以开始看孩子是否更容易说出第一步。'
      : insufficient,
    counts: {
      childStepCount,
      taskBoundFocusCount,
      revisitCount,
      historyCount: list.length,
      commonTaskType
    }
  };
}

function roomSnapshot(history = loadHistory()) {
  const summary = progressSummary(history);
  return {
    id: 'local_evening_room',
    title: '咕点陪坐',
    onlineCount: summary.tonightCompletionCount ? 3 : 1,
    checkinText: summary.tonightCompletionCount
      ? '你今晚已经围绕第一步坐过一会儿，咕点看见了。'
      : '先完成一段专注，就会留下今晚的一小步痕迹。',
    peers: [
      { id: 'gudian', name: '咕点', status: '陪坐中' },
      { id: 'local_you', name: '你', status: summary.tonightCompletionCount ? '留下痕迹' : '准备开始' }
    ],
    localOnly: true
  };
}

function pageState() {
  const settings = loadSettings();
  const currentSession = loadCurrentSession() || createSession(settings);
  const history = loadHistory();
  const focusTarget = resolveFocusTarget(settings.manualTask);
  const session = currentSession.focusTarget && currentSession.focusTarget.source !== 'empty'
    ? currentSession
    : Object.assign({}, currentSession, { focusTarget });
  return {
    settings,
    currentSession: session,
    focusTarget,
    progress: progressSummary(history),
    proof: proofSummary(history),
    room: roomSnapshot(history),
    progressRing: sessionProgress(session),
    scenes: EXPERIENCE_SCENES,
    audioModes: EXPERIENCE_AUDIO_MODES,
    durationModes: DURATION_MODES,
    breakModes: BREAK_MODES,
    selectedScene: sceneById(session.sceneId || settings.selectedSceneId),
    selectedAudio: audioById(session.audioId || settings.selectedAudioId),
    selectedDuration: durationById(session.durationId || settings.selectedDurationId),
    history
  };
}

module.exports = {
  KEYS,
  DURATION_MODES,
  BREAK_MODES,
  SCENES,
  AUDIO_MODES,
  loadSettings,
  saveSettings,
  loadCurrentSession,
  saveCurrentSession,
  loadHistory,
  saveHistory,
  resolveFocusTarget,
  createSession,
  startSession,
  pauseSession,
  resumeSession,
  resetSession,
  interruptSession,
  tickSession,
  completeSession,
  selectScene,
  selectAudio,
  setVolume,
  setManualTask,
  updateChecklistItem,
  calculateStreak,
  progressSummary,
  proofSummary,
  parentPausePrompt,
  roomSnapshot,
  pageState
};
