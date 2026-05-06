const priority = require('./learning-priority');

const KEYS = {
  state: 'ydzx.priority.state.v1',
  selectedHomework: 'ydzx.selected.homework.v1',
  selectedHomeworkSource: 'ydzx.selected.homework.source.v1',
  profile: 'ydzx.profile.v1',
  consent: 'ydzx.guardian.consent.v1',
  session: 'ydzx.mini.session.v1',
  tutorMessages: 'ydzx.tutor.messages.v1',
  feedback: 'ydzx.feedback.v1',
  moduleEvents: 'ydzx.module.events.v1',
  moduleFeedback: 'ydzx.module.feedback.v1',
  tutorEvents: 'ydzx.tutor.events.v1',
  pilotRuns: 'ydzx.pilot.runs.v1',
  factoryEvents: 'ydzx.factory.events.v1',
  thinkingReceipts: 'ydzx.thinking.receipts.v1',
  reviewDeck: 'ydzx.review.deck.v1',
  reviewNotes: 'ydzx.review.notes.v1',
  reviewCards: 'ydzx.review.cards.v1',
  reviewEvents: 'ydzx.review.events.v1',
  clientIdentity: 'ydzx.client.identity.v1',
  syncState: 'ydzx.sync.state.v1',
  syncQueue: 'ydzx.sync.queue.v1',
  reviewLoop: 'ydzx.review.loop.v1'
};

function get(key, fallback) {
  try {
    const value = wx.getStorageSync(key);
    return value || fallback;
  } catch (error) {
    return fallback;
  }
}

function set(key, value) {
  try {
    wx.setStorageSync(key, value);
  } catch (error) {
    // Storage failure should not block the learning flow.
  }
  return value;
}

function remove(key) {
  try {
    wx.removeStorageSync(key);
  } catch (error) {
    // Ignore storage cleanup failures.
  }
}

function clearLearningData() {
  [
    KEYS.state,
    KEYS.selectedHomework,
    KEYS.selectedHomeworkSource,
    KEYS.profile,
    KEYS.consent,
    KEYS.tutorMessages,
    KEYS.session,
    KEYS.feedback,
    KEYS.moduleEvents,
    KEYS.moduleFeedback,
    KEYS.tutorEvents,
    KEYS.pilotRuns,
    KEYS.factoryEvents,
    KEYS.thinkingReceipts,
    KEYS.reviewDeck,
    KEYS.reviewNotes,
    KEYS.reviewCards,
    KEYS.reviewEvents,
    KEYS.syncState,
    KEYS.syncQueue,
    KEYS.reviewLoop
  ].forEach(remove);
}

function loadState() {
  return get(KEYS.state, null) || priority.makeDemoState();
}

function saveState(state) {
  const saved = set(KEYS.state, Object.assign({}, state, { updated_at: new Date().toISOString() }));
  if (state && state.source !== 'demo') {
    appendSyncMutation('learning_state', {
      source: saved.source || '',
      grade: saved.grade || '',
      subject: saved.subject || '',
      weak_points: (saved.weak_points || []).slice(0, 8),
      homework_summary: saved.homework_plan && saved.homework_plan.summary
    });
  }
  return saved;
}

function loadProfile() {
  return get(KEYS.profile, {
    name: '',
    grade: '五年级',
    subject: '数学',
    minutes: 35
  });
}

function saveProfile(profile) {
  const saved = set(KEYS.profile, profile || {});
  appendSyncMutation('profile_update', {
    name: saved.name || '',
    grade: saved.grade || '',
    subject: saved.subject || '',
    minutes: Number(saved.minutes || 0)
  });
  return saved;
}

function loadFeedback() {
  const list = get(KEYS.feedback, []);
  return Array.isArray(list) ? list : [];
}

function appendFeedback(item) {
  const next = [Object.assign({ created_at: new Date().toISOString() }, item || {})]
    .concat(loadFeedback())
    .slice(0, 80);
  set(KEYS.feedback, next);
  appendSyncMutation('homework_feedback', next[0]);
  return next;
}

function feedbackSummary() {
  const list = loadFeedback();
  const accurate = list.filter((item) => item.rating === 'accurate').length;
  const off = list.filter((item) => item.rating === 'off').length;
  return {
    total: list.length,
    accurate,
    off,
    label: list.length ? `已记录 ${list.length} 条校准` : '还没有校准记录'
  };
}

function loadPilotRuns() {
  const list = get(KEYS.pilotRuns, []);
  return Array.isArray(list) ? list : [];
}

function appendPilotRun(item) {
  const record = Object.assign({
    family: '',
    minutes_saved: 0,
    confidence: 3,
    review_returned: false,
    answer_blocks: 0,
    note: '',
    created_at: new Date().toISOString()
  }, item || {});
  const next = [record].concat(loadPilotRuns()).slice(0, 120);
  set(KEYS.pilotRuns, next);
  appendSyncMutation('pilot_run', record);
  return next;
}

function pilotRunSummary() {
  const list = loadPilotRuns();
  const total = list.length;
  const saved = list.reduce((sum, item) => sum + Number(item.minutes_saved || 0), 0);
  const confidence = total
    ? Math.round((list.reduce((sum, item) => sum + Number(item.confidence || 0), 0) / total) * 10) / 10
    : 0;
  const returned = list.filter((item) => !!item.review_returned).length;
  const blocks = list.reduce((sum, item) => sum + Number(item.answer_blocks || 0), 0);
  return {
    total,
    minutesSaved: saved,
    avgMinutesSaved: total ? Math.round(saved / total) : 0,
    avgConfidence: confidence,
    reviewReturned: returned,
    returnRate: total ? Math.round((returned / total) * 100) : 0,
    answerBlocks: blocks,
    latest: list[0] || null,
    label: total
      ? `${total} pilot nights logged, ${saved} minutes saved, ${returned} review returns.`
      : 'No pilot evidence logged yet.'
  };
}

function loadFactoryEvents() {
  const list = get(KEYS.factoryEvents, []);
  return Array.isArray(list) ? list : [];
}

function appendFactoryEvent(item) {
  const record = Object.assign({
    event: 'factory_generated',
    input_type: '',
    provider: 'local',
    card_count: 0,
    quality_score: 0,
    imported: 0,
    created_at: new Date().toISOString()
  }, item || {});
  const next = [record].concat(loadFactoryEvents()).slice(0, 160);
  set(KEYS.factoryEvents, next);
  appendSyncMutation('factory_event', record);
  return next;
}

function factoryEventSummary() {
  const list = loadFactoryEvents();
  const generated = list.filter((item) => item.event === 'factory_generated').length;
  const imported = list.reduce((sum, item) => sum + Number(item.imported || 0), 0);
  const remote = list.filter((item) => String(item.provider || '').indexOf('remote') >= 0).length;
  const quality = list.length
    ? Math.round(list.reduce((sum, item) => sum + Number(item.quality_score || 0), 0) / list.length)
    : 0;
  const latest = list[0] || null;
  return {
    total: list.length,
    generated,
    imported,
    remote,
    local: Math.max(0, generated - remote),
    quality,
    latest,
    label: list.length
      ? `${generated} factory runs, ${imported} cards imported, quality ${quality}/100.`
      : 'No content factory runs yet.'
  };
}

function loadModuleEvents() {
  const list = get(KEYS.moduleEvents, []);
  return Array.isArray(list) ? list : [];
}

function trackModuleEvent(eventName, module, props = {}) {
  const item = {
    event: eventName,
    module_id: module && module.id,
    module_title: module && module.title,
    subject: module && module.subject,
    type: module && module.type,
    source: props.source || '',
    reason: props.reason || '',
    recommendation: props.recommendation || null,
    created_at: new Date().toISOString()
  };
  const next = [item].concat(loadModuleEvents()).slice(0, 120);
  set(KEYS.moduleEvents, next);
  appendSyncMutation('module_event', item);
  return next;
}

function moduleEventSummary() {
  const list = loadModuleEvents();
  const started = list.filter((item) => item.event === 'module_started').length;
  const viewed = list.filter((item) => item.event === 'module_viewed').length;
  const completed = list.filter((item) => item.event === 'module_completed').length;
  const subjects = {};
  list.forEach((item) => {
    if (!item.subject) return;
    subjects[item.subject] = (subjects[item.subject] || 0) + 1;
  });
  const topSubject = Object.keys(subjects).sort((a, b) => subjects[b] - subjects[a])[0] || '';
  return {
    total: list.length,
    viewed,
    started,
    completed,
    topSubject,
    feedback: loadModuleFeedback().length,
    useful: loadModuleFeedback().filter((item) => item.rating === 'useful').length,
    notUseful: loadModuleFeedback().filter((item) => item.rating === 'not_useful').length,
    label: list.length ? `已记录 ${list.length} 次模块行为` : '还没有模块行为记录'
  };
}

function loadModuleFeedback() {
  const list = get(KEYS.moduleFeedback, []);
  return Array.isArray(list) ? list : [];
}

function appendModuleFeedback(module, rating, props = {}) {
  const item = {
    module_id: module && module.id,
    module_title: module && module.title,
    subject: module && module.subject,
    type: module && module.type,
    rating,
    source: props.source || '',
    reason: props.reason || '',
    created_at: new Date().toISOString()
  };
  const next = [item].concat(loadModuleFeedback()).slice(0, 120);
  set(KEYS.moduleFeedback, next);
  appendSyncMutation('module_feedback', item);
  return next;
}

function moduleFeedbackMap() {
  const map = {};
  loadModuleFeedback().forEach((item) => {
    if (!item.module_id) return;
    if (!map[item.module_id]) map[item.module_id] = { useful: 0, notUseful: 0 };
    if (item.rating === 'useful') map[item.module_id].useful += 1;
    if (item.rating === 'not_useful') map[item.module_id].notUseful += 1;
  });
  return map;
}

function loadTutorEvents() {
  const list = get(KEYS.tutorEvents, []);
  return Array.isArray(list) ? list : [];
}

function trackTutorEvent(eventName, payload = {}) {
  const selected = get(KEYS.selectedHomework, null);
  const source = get(KEYS.selectedHomeworkSource, '');
  const item = {
    event: eventName,
    selected_id: selected && selected.id,
    selected_text: selected && selected.text,
    source,
    module_id: source && source.indexOf('module:') === 0 ? source.replace('module:', '') : '',
    coach_step: payload.coach_step || '',
    mastery_status: payload.mastery_status || '',
    blocked: !!payload.blocked,
    created_at: new Date().toISOString()
  };
  const next = [item].concat(loadTutorEvents()).slice(0, 160);
  set(KEYS.tutorEvents, next);
  appendSyncMutation('tutor_event', item);
  return next;
}

function tutorEventSummary() {
  const list = loadTutorEvents();
  const completed = list.filter((item) => item.event === 'tutor_mastery_ready').length;
  const blocked = list.filter((item) => item.blocked || item.mastery_status === 'blocked_answer_request').length;
  const moduleRuns = list.filter((item) => item.module_id).length;
  return {
    total: list.length,
    completed,
    blocked,
    moduleRuns,
    label: list.length ? `已记录 ${list.length} 次原小点执行信号` : '还没有原小点执行记录'
  };
}

function loadThinkingReceipts() {
  const list = get(KEYS.thinkingReceipts, []);
  return Array.isArray(list) ? list : [];
}

function appendThinkingReceipt(receipt = {}) {
  const selected = get(KEYS.selectedHomework, null);
  const source = get(KEYS.selectedHomeworkSource, '');
  const checks = Array.isArray(receipt.checks) ? receipt.checks : [];
  const item = {
    id: receipt.id || `think_${Date.now()}_${randomPart()}`,
    title: receipt.title || 'THINKING RECEIPT',
    score: Math.max(0, Math.min(100, Number(receipt.score || 0))),
    status: receipt.status || '',
    focus: receipt.focus || (selected && selected.text) || '',
    selected_id: receipt.selected_id || (selected && selected.id) || '',
    selected_text: receipt.selected_text || (selected && selected.text) || '',
    source,
    coach_step: receipt.coach_step || receipt.activeStep || '',
    mastery_status: receipt.mastery_status || '',
    risk: receipt.risk || '',
    shareLine: receipt.shareLine || '',
    checks: checks.map((check) => ({
      id: check.id || '',
      label: check.label || '',
      done: !!check.done,
      detail: check.detail || ''
    })),
    created_at: receipt.created_at || new Date().toISOString()
  };
  const next = [item].concat(loadThinkingReceipts()).slice(0, 120);
  set(KEYS.thinkingReceipts, next);
  appendSyncMutation('thinking_receipt', item);
  return next;
}

function thinkingReceiptSummary() {
  const list = loadThinkingReceipts();
  const countDone = (id) => list.filter((receipt) => {
    const checks = Array.isArray(receipt.checks) ? receipt.checks : [];
    return checks.some((check) => check.id === id && check.done);
  }).length;
  const total = list.length;
  const avgScore = total
    ? Math.round(list.reduce((sum, item) => sum + Number(item.score || 0), 0) / total)
    : 0;
  const blocked = list.filter((item) => item.status === 'answer shortcut blocked' || item.risk === 'high').length;
  const latest = list[0] || null;
  return {
    total,
    avgScore,
    studentFirst: countDone('first'),
    wrongCauseNamed: countDone('cause'),
    answerCopyAvoided: countDone('safe'),
    proofSentence: countDone('proof'),
    blocked,
    latest,
    label: total
      ? `Thinking ledger has ${total} parent-visible tutor receipts.`
      : 'No thinking receipts yet.'
  };
}

function loadReviewCards() {
  const list = get(KEYS.reviewCards, []);
  return Array.isArray(list) ? list : [];
}

function loadReviewDeck() {
  return get(KEYS.reviewDeck, null);
}

function saveReviewDeck(deck) {
  return set(KEYS.reviewDeck, deck || null);
}

function loadReviewNotes() {
  const list = get(KEYS.reviewNotes, []);
  return Array.isArray(list) ? list : [];
}

function saveReviewNotes(notes) {
  return set(KEYS.reviewNotes, Array.isArray(notes) ? notes : []);
}

function saveReviewCards(cards) {
  return set(KEYS.reviewCards, Array.isArray(cards) ? cards : []);
}

function loadReviewEvents() {
  const list = get(KEYS.reviewEvents, []);
  return Array.isArray(list) ? list : [];
}

function appendReviewEvent(item) {
  const next = [Object.assign({ created_at: new Date().toISOString() }, item || {})]
    .concat(loadReviewEvents())
    .slice(0, 240);
  set(KEYS.reviewEvents, next);
  return next;
}

function randomPart() {
  return Math.random().toString(36).slice(2, 10);
}

function loadClientIdentity() {
  const existing = get(KEYS.clientIdentity, null);
  if (existing && existing.client_id) return existing;
  return set(KEYS.clientIdentity, {
    client_id: `local_${Date.now()}_${randomPart()}`,
    user_id: '',
    auth_mode: 'local',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
}

function saveClientIdentity(patch = {}) {
  const current = loadClientIdentity();
  return set(KEYS.clientIdentity, Object.assign({}, current, patch, {
    updated_at: new Date().toISOString()
  }));
}

function loadSyncState() {
  return get(KEYS.syncState, {
    enabled: false,
    cursor: '',
    version: 1,
    last_success_at: '',
    last_attempt_at: '',
    last_error: '',
    mode: 'local_queue'
  });
}

function saveSyncState(patch = {}) {
  const current = loadSyncState();
  return set(KEYS.syncState, Object.assign({}, current, patch, {
    updated_at: new Date().toISOString()
  }));
}

function loadSyncQueue() {
  const list = get(KEYS.syncQueue, []);
  return Array.isArray(list) ? list : [];
}

function mutationEntity(type, payload = {}) {
  const entityId = payload.id
    || payload.target_id
    || payload.module_id
    || payload.card_id
    || payload.note_id
    || payload.reward_id
    || payload.deck_id
    || '';
  const family = String(type || '').split('_')[0] || 'learning';
  return {
    entity_type: payload.entity_type || family,
    entity_id: String(entityId || '')
  };
}

function appendSyncMutation(type, payload = {}) {
  const identity = loadClientIdentity();
  const safePayload = payload && typeof payload === 'object' ? payload : {};
  const entity = mutationEntity(type, safePayload);
  const state = loadSyncState();
  const seq = Number(state.local_seq || 0) + 1;
  const dedupeKey = [
    type,
    entity.entity_id,
    safePayload.created_at || '',
    JSON.stringify(safePayload).slice(0, 120)
  ].join('|');
  const existing = loadSyncQueue();
  if (existing.some((item) => item.dedupe_key === dedupeKey && item.status === 'pending')) {
    return existing.find((item) => item.dedupe_key === dedupeKey && item.status === 'pending');
  }
  const mutation = {
    id: `mut_${Date.now()}_${randomPart()}`,
    type,
    schema_version: 1,
    base_version: Number(safePayload.base_version || safePayload.version || 0),
    local_seq: seq,
    payload: safePayload,
    client_id: identity.client_id,
    entity_type: entity.entity_type,
    entity_id: entity.entity_id,
    dedupe_key: dedupeKey,
    created_at: new Date().toISOString(),
    status: 'pending'
  };
  const next = [mutation].concat(existing).slice(0, 300);
  set(KEYS.syncQueue, next);
  saveSyncState({
    local_seq: seq,
    pending: next.filter((item) => item.status === 'pending').length,
    last_mutation_at: mutation.created_at
  });
  return mutation;
}

function markSyncAttempt(result = {}) {
  const ok = !!result.ok;
  const queue = loadSyncQueue();
  const next = ok
    ? queue.map((item) => Object.assign({}, item, { status: 'synced', synced_at: new Date().toISOString() })).slice(0, 80)
    : queue;
  if (ok) set(KEYS.syncQueue, next);
  return saveSyncState({
    last_attempt_at: new Date().toISOString(),
    last_success_at: ok ? new Date().toISOString() : loadSyncState().last_success_at,
    last_error: ok ? '' : (result.error || 'sync_not_available'),
    pending: next.filter((item) => item.status === 'pending').length
  });
}

function syncDiagnostics() {
  const queue = loadSyncQueue();
  const state = loadSyncState();
  const byType = {};
  const byEntity = {};
  let pending = 0;
  let synced = 0;
  let failed = 0;
  queue.forEach((item) => {
    const status = item.status || 'pending';
    const type = item.type || 'unknown';
    const entityKey = `${item.entity_type || 'unknown'}:${item.entity_id || ''}`;
    if (!byType[type]) byType[type] = { type, pending: 0, synced: 0, failed: 0, total: 0 };
    byType[type].total += 1;
    byType[type][status] = Number(byType[type][status] || 0) + 1;
    if (!byEntity[entityKey]) byEntity[entityKey] = { entity: entityKey, pending: 0, total: 0 };
    byEntity[entityKey].total += 1;
    if (status === 'pending') {
      pending += 1;
      byEntity[entityKey].pending += 1;
    } else if (status === 'synced') {
      synced += 1;
    } else {
      failed += 1;
    }
  });
  const duplicates = queue.length - Object.keys(queue.reduce((map, item) => {
    map[item.dedupe_key || item.id] = true;
    return map;
  }, {})).length;
  const conflictedEntities = Object.keys(byEntity).filter((key) => byEntity[key].pending > 1);
  return {
    schemaVersion: 1,
    localSeq: Number(state.local_seq || 0),
    pending,
    synced,
    failed,
    duplicates,
    conflictedEntities,
    conflictSafe: duplicates === 0,
    lastSuccessAt: state.last_success_at || '',
    lastAttemptAt: state.last_attempt_at || '',
    lastError: state.last_error || '',
    byType: Object.keys(byType).map((key) => byType[key]).sort((a, b) => b.pending - a.pending || b.total - a.total),
    label: pending
      ? `Local queue has ${pending} pending mutations across ${Object.keys(byType).length} types.`
      : 'Local sync queue is clean.'
  };
}

function loadReviewLoop() {
  return get(KEYS.reviewLoop, {
    lives: 5,
    max_lives: 5,
    streak_freeze: 1,
    current_streak: 0,
    longest_streak: 0,
    bonus_xp: 0,
    claimed_rewards: {},
    last_review_day: '',
    last_life_refill_day: '',
    leaderboard: [],
    updated_at: ''
  });
}

function claimReviewReward(reward = {}) {
  const id = reward.id || '';
  if (!id) return { claimed: false, reason: 'missing_reward_id', loop: loadReviewLoop() };
  const current = loadReviewLoop();
  const claimed = current.claimed_rewards || {};
  if (claimed[id]) return { claimed: false, reason: 'already_claimed', loop: current };
  const maxLives = Math.max(1, Number(current.max_lives || 5));
  const xp = Number(reward.xp || reward.rewardXp || 0);
  const lives = Math.max(0, Math.min(maxLives, Number(current.lives || maxLives) + Number(reward.lives || 0)));
  const next = saveReviewLoop(Object.assign({}, current, {
    lives,
    bonus_xp: Number(current.bonus_xp || 0) + Math.max(0, xp),
    streak_freeze: Number(current.streak_freeze || 0) + Number(reward.streakFreeze || 0),
    claimed_rewards: Object.assign({}, claimed, {
      [id]: Object.assign({}, reward, {
        claimed_at: new Date().toISOString()
      })
    })
  }));
  appendSyncMutation('review_reward_claimed', {
    reward_id: id,
    xp,
    lives: Number(reward.lives || 0),
    streakFreeze: Number(reward.streakFreeze || 0)
  });
  return { claimed: true, loop: next };
}

function saveReviewLoop(loop) {
  return set(KEYS.reviewLoop, Object.assign({}, loop || {}, {
    updated_at: new Date().toISOString()
  }));
}

function updateReviewLoopForRating(rating, streak = 0) {
  const today = new Date().toISOString().slice(0, 10);
  const current = loadReviewLoop();
  const maxLives = Math.max(1, Number(current.max_lives || 5));
  const refill = current.last_life_refill_day === today ? Number(current.lives || maxLives) : maxLives;
  const lost = rating === 'again' ? 1 : 0;
  const gained = rating === 'easy' ? 1 : 0;
  const lives = Math.max(0, Math.min(maxLives, refill - lost + gained));
  const lastDay = current.last_review_day || '';
  const gapDays = lastDay ? Math.floor((new Date(`${today}T00:00:00Z`).getTime() - new Date(`${lastDay}T00:00:00Z`).getTime()) / (24 * 60 * 60 * 1000)) : 0;
  const missedDays = Math.max(0, gapDays - 1);
  const freeze = Math.max(0, Number(current.streak_freeze || 0));
  const freezeUsed = missedDays ? Math.min(freeze, missedDays) : 0;
  const protectedGap = missedDays > 0 && freezeUsed >= missedDays;
  const baseStreak = Number(current.current_streak || streak || 0);
  const currentStreak = !lastDay
    ? 1
    : lastDay === today
      ? Math.max(1, baseStreak, Number(streak || 0))
      : gapDays <= 1 || protectedGap
        ? Math.max(1, baseStreak + 1)
        : 1;
  return saveReviewLoop(Object.assign({}, current, {
    lives,
    max_lives: maxLives,
    current_streak: currentStreak,
    streak_freeze: Math.max(0, freeze - freezeUsed),
    last_freeze_used_at: freezeUsed ? new Date().toISOString() : current.last_freeze_used_at,
    longest_streak: Math.max(Number(current.longest_streak || 0), currentStreak, Number(streak || 0)),
    last_review_day: today,
    last_life_refill_day: today
  }));
}

function localLeaderboardSnapshot(profile = {}, progress = {}) {
  const loop = loadReviewLoop();
  const name = profile.name || 'Local learner';
  const self = {
    rank: 1,
    name,
    xp: Number(progress.xp || 0),
    streak: Number(progress.streak || 0),
    isSelf: true
  };
  const peers = Array.isArray(loop.leaderboard) ? loop.leaderboard : [];
  return [self].concat(peers).sort((a, b) => Number(b.xp || 0) - Number(a.xp || 0)).slice(0, 8)
    .map((item, index) => Object.assign({}, item, { rank: index + 1 }));
}

function topCountKey(counter) {
  return Object.keys(counter || {}).sort((a, b) => counter[b] - counter[a])[0] || '';
}

function familyCalibrationProfile() {
  const feedbackList = loadFeedback();
  const moduleEvents = loadModuleEvents();
  const moduleFeedback = loadModuleFeedback();
  const tutorEvents = loadTutorEvents();
  const reviewEvents = loadReviewEvents();
  const reviewCards = loadReviewCards();
  const reviewNotes = loadReviewNotes();
  const profile = loadProfile();
  const state = loadState() || {};

  const accurate = feedbackList.filter((item) => item.rating === 'accurate').length;
  const off = feedbackList.filter((item) => item.rating === 'off').length;
  const viewed = moduleEvents.filter((item) => item.event === 'module_viewed').length;
  const started = moduleEvents.filter((item) => item.event === 'module_started').length;
  const useful = moduleFeedback.filter((item) => item.rating === 'useful').length;
  const notUseful = moduleFeedback.filter((item) => item.rating === 'not_useful').length;
  const tutorCompleted = tutorEvents.filter((item) => item.event === 'tutor_mastery_ready').length;
  const tutorBlocked = tutorEvents.filter((item) => item.blocked || item.mastery_status === 'blocked_answer_request').length;
  const reviewed = reviewEvents.length;
  const reviewGood = reviewEvents.filter((item) => ['good', 'easy'].includes(item.rating)).length;

  const subjectCounter = {};
  moduleEvents.concat(moduleFeedback).forEach((item) => {
    if (!item.subject) return;
    subjectCounter[item.subject] = (subjectCounter[item.subject] || 0) + 1;
  });

  const calibrationCounter = {};
  feedbackList.forEach((item) => {
    if (!item.calibration_key) return;
    calibrationCounter[item.calibration_key] = (calibrationCounter[item.calibration_key] || 0) + 1;
  });

  const topSubject = topCountKey(subjectCounter) || profile.subject || '';
  const topCalibrationKey = topCountKey(calibrationCounter);
  const topWeakPoint = (((state.weak_points || [])[0] || {}).name) || '';
  const homeworkTotal = accurate + off;
  const moduleFeedbackTotal = useful + notUseful;
  const accuracyRate = homeworkTotal ? Math.round((accurate / homeworkTotal) * 100) : 0;
  const fitRate = moduleFeedbackTotal ? Math.round((useful / moduleFeedbackTotal) * 100) : 0;
  const startRate = viewed ? Math.round((started / viewed) * 100) : 0;
  const moduleCompletionRate = started ? Math.round((tutorCompleted / started) * 100) : 0;

  const signals = [];

  if (homeworkTotal >= 3) {
    signals.push(
      accuracyRate >= 70 ? '作业判断开始贴近真实情况' : '作业判断还需要继续校准'
    );
  } else if (homeworkTotal > 0) {
    signals.push('已开始积累作业判断校准记录');
  }

  if (moduleFeedbackTotal >= 3) {
    signals.push(
      fitRate >= 60 ? '学习模块适配度开始收敛' : '学习模块仍在探索更适合的练法'
    );
  } else if (viewed || started) {
    signals.push('已开始积累学习模块适配反馈');
  }

  if (topSubject) {
    signals.push(`高频学科：${topSubject}`);
  }

  if (tutorCompleted) {
    signals.push(`原小点已形成 ${tutorCompleted} 次掌握证据`);
  }

  if (tutorBlocked) {
    signals.push(`出现 ${tutorBlocked} 次直接要答案倾向`);
  }

  if (reviewed) {
    signals.push(`已完成 ${reviewed} 次错因复习`);
  }

  if (topWeakPoint) {
    signals.push(`当前高频弱点：${topWeakPoint}`);
  }

  if (topCalibrationKey) {
    signals.push(`最常出现的校准点：${topCalibrationKey}`);
  }

  let label = '还没有足够记录形成画像';
  if (homeworkTotal || viewed || started || moduleFeedbackTotal) {
    label = '正在形成家庭校准画像';
  }
  if (homeworkTotal >= 3 && moduleFeedbackTotal >= 3) {
    label = accuracyRate >= 70 && fitRate >= 60
      ? '已形成初步家庭校准画像'
      : '已有画像雏形，仍需继续校准';
  }

  return {
    homework: {
      total: homeworkTotal,
      accurate,
      off,
      accuracyRate,
      topCalibrationKey
    },
    modules: {
      viewed,
      started,
      useful,
      notUseful,
      fitRate,
      startRate,
      completed: tutorCompleted,
      completionRate: moduleCompletionRate,
      topSubject
    },
    tutor: tutorEventSummary(),
    review: {
      totalCards: reviewCards.length,
      totalNotes: reviewNotes.length,
      reviewed,
      accuracyRate: reviewed ? Math.round((reviewGood / reviewed) * 100) : 0
    },
    weakPoint: topWeakPoint,
    signals: signals.slice(0, 5),
    label
  };
}

function installInvestorDemo() {
  const state = priority.makeDemoState();
  const demoState = Object.assign({}, state, {
    source: 'investor_demo',
    updated_at: new Date().toISOString(),
    weak_points: [
      { key: 'modeling', name: 'Math modeling', score: 54, reason: 'Knows the numbers but misses the relation.' },
      { key: 'units', name: 'Unit check', score: 61, reason: 'Loses points by mixing meters and centimeters.' }
    ]
  });
  saveState(demoState);
  saveProfile({
    name: 'Demo learner',
    grade: demoState.grade || 'Grade 5',
    subject: demoState.subject || 'Math',
    minutes: 35
  });
  set(KEYS.selectedHomework, (demoState.homework_plan && demoState.homework_plan.must_do && demoState.homework_plan.must_do[0]) || null);
  set(KEYS.selectedHomeworkSource, 'investor_demo');
  set(KEYS.tutorMessages, [
    { role: 'assistant', text: 'Demo mode: we only coach the must-do task and the key wrong cause.' },
    { role: 'user', text: 'I know the numbers but I cannot find the relation.' },
    { role: 'assistant', text: 'Good. First say what the problem is asking, then list the known facts and the unknown target.' }
  ]);
  saveReviewLoop({
    lives: 4,
    max_lives: 5,
    streak_freeze: 1,
    longest_streak: 6,
    current_streak: 4,
    claimed_rewards: {}
  });
  appendFeedback({ rating: 'accurate', calibration_key: 'math:modeling', note: 'Must-do prioritization matched parent judgment.' });
  appendFeedback({ rating: 'accurate', calibration_key: 'math:units', note: 'Wrong-cause tag correctly caught the unit issue.' });
  appendFactoryEvent({ event: 'factory_generated', input_type: 'class_notes', provider: 'rule_content_engine_v2', card_count: 9, quality_score: 88, imported: 6 });
  appendFactoryEvent({ event: 'factory_generated', input_type: 'wrong_cause', provider: 'rule_content_engine_v2', card_count: 6, quality_score: 84, imported: 4 });
  appendPilotRun({ family: 'Demo family A', minutes_saved: 18, confidence: 4, review_returned: true, answer_blocks: 1, note: 'Parent felt the child started faster with less argument.' });
  appendPilotRun({ family: 'Demo family B', minutes_saved: 12, confidence: 5, review_returned: true, answer_blocks: 0, note: 'Review loop returned the next day without extra prompting.' });
  trackModuleEvent('module_started', { id: 'math_route_problem', title: 'Math Word Problem Route Map', subject: 'Math', type: 'Route' }, { source: 'investor_demo' });
  trackModuleEvent('module_completed', { id: 'math_route_problem', title: 'Math Word Problem Route Map', subject: 'Math', type: 'Route' }, { source: 'investor_demo' });
  trackTutorEvent('tutor_progress', { coach_step: 'find_conditions', mastery_status: 'needs_student_step', blocked: false });
  trackTutorEvent('tutor_mastery_ready', { coach_step: 'review', mastery_status: 'ready_for_parent_review', blocked: false });
  appendReviewEvent({ card_id: 'demo_card_modeling_first_step', source: 'thinking_receipt', rating: 'good' });
  appendReviewEvent({ card_id: 'demo_card_unit_check', source: 'homework_plan', rating: 'easy' });
  appendReviewEvent({ card_id: 'demo_card_relation_trap', source: 'tutor', rating: 'again' });
  appendThinkingReceipt({
    score: 92,
    status: 'ready for parent review',
    focus: 'Math word problem must-do task',
    coach_step: 'review',
    mastery_status: 'ready_for_parent_review',
    risk: 'low',
    shareLine: 'Thinking proof 92/100: student named the modeling mistake before finishing.',
    checks: [
      { id: 'first', label: 'Student first thought', done: true, detail: 'student described the relation issue' },
      { id: 'cause', label: 'Wrong cause named', done: true, detail: 'modeling mistake named' },
      { id: 'safe', label: 'Answer-copy avoided', done: true, detail: 'no direct answer shortcut' },
      { id: 'proof', label: 'Proof sentence', done: true, detail: 'ready for parent review' }
    ]
  });
  return demoState;
}

module.exports = {
  KEYS,
  get,
  set,
  remove,
  clearLearningData,
  loadState,
  saveState,
  loadProfile,
  saveProfile,
  loadFeedback,
  appendFeedback,
  feedbackSummary,
  loadPilotRuns,
  appendPilotRun,
  pilotRunSummary,
  loadFactoryEvents,
  appendFactoryEvent,
  factoryEventSummary,
  loadModuleEvents,
  trackModuleEvent,
  moduleEventSummary,
  loadModuleFeedback,
  appendModuleFeedback,
  moduleFeedbackMap,
  loadTutorEvents,
  trackTutorEvent,
  tutorEventSummary,
  loadThinkingReceipts,
  appendThinkingReceipt,
  thinkingReceiptSummary,
  loadReviewDeck,
  saveReviewDeck,
  loadReviewNotes,
  saveReviewNotes,
  loadReviewCards,
  saveReviewCards,
  loadReviewEvents,
  appendReviewEvent,
  loadClientIdentity,
  saveClientIdentity,
  loadSyncState,
  saveSyncState,
  loadSyncQueue,
  appendSyncMutation,
  markSyncAttempt,
  syncDiagnostics,
  loadReviewLoop,
  saveReviewLoop,
  updateReviewLoopForRating,
  claimReviewReward,
  localLeaderboardSnapshot,
  familyCalibrationProfile,
  installInvestorDemo
};
