const storage = require('./storage');

const KEY = 'ydzx.service.access.v1';
const FREE_LIMIT_DAYS = 3;

const FEATURES = {
  full_history: '完整历史记录与趋势',
  deep_scaffolding: '学科深度脚手架',
  parent_training: '家长沟通练习',
  emotion_intervention: '情绪支持提醒',
  seven_day_milestone: '连续 7 天第一步记录'
};

function nowIso() {
  return new Date().toISOString();
}

function dayDiff(fromIso, toIso = nowIso()) {
  const from = new Date(fromIso || toIso).getTime();
  const to = new Date(toIso || nowIso()).getTime();
  if (!from || !to) return 0;
  return Math.max(0, Math.floor((to - from) / (24 * 60 * 60 * 1000)));
}

function defaultState() {
  return {
    mode: 'local_free',
    configured: false,
    installDate: nowIso(),
    freeRecentDays: FREE_LIMIT_DAYS,
    enabledFeatures: [],
    serviceIntentStartedAt: '',
    activatedAt: '',
    requestSheetVisible: false,
    successVisible: false,
    updatedAt: nowIso()
  };
}

function loadServiceAccessState() {
  const loaded = Object.assign(defaultState(), storage.get ? storage.get(KEY, {}) : {});
  if (!loaded.installDate) loaded.installDate = nowIso();
  loaded.usedDays = dayDiff(loaded.installDate);
  loaded.configured = !!loaded.configured;
  return loaded;
}

function saveServiceAccessState(patch = {}) {
  const next = Object.assign(loadServiceAccessState(), patch || {}, { updatedAt: nowIso() });
  next.configured = !!next.configured;
  next.mode = next.configured ? 'service_configured' : 'local_free';
  next.enabledFeatures = next.configured ? Object.keys(FEATURES) : [];
  return storage.set ? storage.set(KEY, next) : next;
}

function requestServiceAccess(source = 'service_request') {
  if (storage.recordServiceIntent) storage.recordServiceIntent(source);
  return saveServiceAccessState({
    serviceIntentStartedAt: nowIso(),
    requestSource: source,
    lastGate: source,
    requestSheetVisible: true,
    successVisible: false
  });
}

function configureServiceAccess(source = 'service_configured') {
  return saveServiceAccessState({
    configured: true,
    activatedAt: nowIso(),
    requestSource: source,
    requestSheetVisible: false,
    successVisible: true
  });
}

function deactivateServiceAccess() {
  return saveServiceAccessState({
    configured: false,
    deactivatedAt: nowIso()
  });
}

function countQuality(events = []) {
  return events.reduce((counts, event) => {
    const quality = event && event.childStepQuality;
    if (Object.prototype.hasOwnProperty.call(counts, quality)) counts[quality] += 1;
    return counts;
  }, { empty: 0, vague: 0, partial: 0, actionable: 0 });
}

function buildWeeklySupportSummary(state = loadServiceAccessState()) {
  const profile = storage.loadUserFirstStepProfile ? storage.loadUserFirstStepProfile() : { events: [] };
  const counts = countQuality((profile.events || []).slice(0, 7));
  if (state.configured) {
    return {
      mode: 'configured',
      title: '本周复盘',
      body: counts.actionable
        ? `本周已有 ${counts.actionable} 次第一步比较具体，可以继续观察哪类题最容易接上。`
        : '本周还在练习把第一步说具体，建议先保持低压力回访。',
      actionSuggestion: counts.actionable
        ? '今晚可以问：你上次是怎么做到先圈条件的？'
        : '今晚只问：你准备先看哪里？'
    };
  }
  return {
    mode: 'local_service_notice',
    title: '本周第一步记录',
    body: `最近记录里有 ${counts.vague} 次模糊、${counts.empty} 次空白。当前先用本地记录看趋势，更深的连续复盘会在开通后显示。`,
    actionSuggestion: '今晚先固定只问一句：你第一步准备先看哪里？'
  };
}

function buildServiceGate(featureId, state = loadServiceAccessState()) {
  const weekly = buildWeeklySupportSummary(state);
  return {
    featureId,
    title: weekly.title,
    body: weekly.body,
    actionSuggestion: weekly.actionSuggestion,
    trustLine: '当前只开放记录、复盘和轻练习；更深的连续服务开通后再显示。',
    benefits: [
      '完整历史和本周模式',
      '第二步、第三步脚手架',
      '家长沟通练习'
    ],
    primaryAction: 'request_service_access',
    secondaryAction: 'keep_local_free'
  };
}

function canAccess(featureId, state = loadServiceAccessState()) {
  const freeFeatures = {
    daily_math: true,
    dictation: true,
    light_diagnosis: true,
    recent_3_day_recap: true
  };
  if (freeFeatures[featureId]) return { allowed: true, reason: 'free_feature' };
  if (state.configured) return { allowed: true, reason: 'service_configured' };
  return {
    allowed: false,
    reason: 'service_not_configured',
    gate: buildServiceGate(featureId, state)
  };
}

function limitHistoryByGate(items = [], state = loadServiceAccessState()) {
  if (state.configured) return Array.isArray(items) ? items : [];
  const list = Array.isArray(items) ? items : [];
  const cutoff = Date.now() - FREE_LIMIT_DAYS * 24 * 60 * 60 * 1000;
  return list.filter((item) => {
    const stamp = new Date(item.createdAt || item.completedAt || item.day || 0).getTime();
    return !stamp || stamp >= cutoff;
  });
}

module.exports = {
  KEY,
  FEATURES,
  FREE_LIMIT_DAYS,
  loadServiceAccessState,
  saveServiceAccessState,
  requestServiceAccess,
  configureServiceAccess,
  deactivateServiceAccess,
  canAccess,
  buildServiceGate,
  buildWeeklySupportSummary,
  dayDiff,
  limitHistoryByGate
};
