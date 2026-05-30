const storage = require('./storage');

const DEFAULT_BASE_URL = 'https://yuandianzhixue.com';

function apiBase() {
  const app = typeof getApp === 'function' ? getApp() : null;
  return (app && app.globalData && app.globalData.apiBase) || DEFAULT_BASE_URL;
}

function clientHeader() {
  const identity = storage.loadClientIdentity ? storage.loadClientIdentity() : {};
  return identity.client_id ? { 'x-mini-client': identity.client_id } : {};
}

function request(path, options) {
  const opts = options || {};
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${apiBase()}${path}`,
      method: opts.method || 'GET',
      data: opts.data || {},
      header: Object.assign({
        'content-type': 'application/json'
      }, clientHeader(), opts.header || {}),
      timeout: opts.timeout || 25000,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
          return;
        }
        reject(new Error((res.data && (res.data.message || res.data.error)) || `HTTP ${res.statusCode}`));
      },
      fail(error) {
        reject(error);
      }
    });
  });
}

function localSession() {
  return {
    ok: true,
    mode: 'local',
    session_id: `local_${Date.now()}`,
    message: '本地体验模式'
  };
}

function shouldUseLocalSession() {
  if (!wx || !wx.getAccountInfoSync) return false;
  try {
    const info = wx.getAccountInfoSync();
    const appId = info && info.miniProgram && info.miniProgram.appId;
    return !appId || appId === 'touristappid';
  } catch (_) {
    return false;
  }
}

function initSession(profile) {
  return new Promise((resolve) => {
    if (shouldUseLocalSession()) {
      const fallback = localSession();
      if (storage.saveClientIdentity) storage.saveClientIdentity({ auth_mode: 'local', user_id: '' });
      storage.set(storage.KEYS.session, fallback);
      resolve(fallback);
      return;
    }
    wx.login({
      success(loginRes) {
        request('/api/mini/session', {
          method: 'POST',
          data: {
            code: loginRes.code || 'local',
            profile: profile || storage.loadProfile()
          },
          timeout: 15000
        }).then((session) => {
          if (storage.saveClientIdentity) {
            storage.saveClientIdentity({
              auth_mode: session && session.mode === 'wechat' ? 'wechat' : 'local',
              user_id: session && session.openid_hash ? `wechat_${session.openid_hash}` : ''
            });
          }
          storage.set(storage.KEYS.session, session);
          resolve(session);
        }).catch(() => {
          const fallback = localSession();
          if (storage.saveClientIdentity) storage.saveClientIdentity({ auth_mode: 'local', user_id: '' });
          storage.set(storage.KEYS.session, fallback);
          resolve(fallback);
        });
      },
      fail() {
        const fallback = localSession();
        if (storage.saveClientIdentity) storage.saveClientIdentity({ auth_mode: 'local', user_id: '' });
        storage.set(storage.KEYS.session, fallback);
        resolve(fallback);
      }
    });
  });
}

function sendTutorMessage(payload) {
  const session = storage.get(storage.KEYS.session, {});
  return request('/api/mini/tutor-message', {
    method: 'POST',
    data: payload || {},
    header: session.session_id ? { 'x-mini-session': session.session_id } : {},
    timeout: 30000
  });
}

function buildPriority(payload) {
  const session = storage.get(storage.KEYS.session, {});
  return request('/api/mini/priority', {
    method: 'POST',
    data: payload || {},
    header: session.session_id ? { 'x-mini-session': session.session_id } : {},
    timeout: 20000
  });
}

function checkContent(content) {
  const session = storage.get(storage.KEYS.session, {});
  return request('/api/mini/content-check', {
    method: 'POST',
    data: { content },
    header: session.session_id ? { 'x-mini-session': session.session_id } : {},
    timeout: 12000
  });
}

function buildWeekly(payload) {
  const session = storage.get(storage.KEYS.session, {});
  return request('/api/mini/weekly', {
    method: 'POST',
    data: payload || {},
    header: session.session_id ? { 'x-mini-session': session.session_id } : {},
    timeout: 15000
  });
}

function submitFeedback(payload) {
  const session = storage.get(storage.KEYS.session, {});
  return request('/api/mini/feedback', {
    method: 'POST',
    data: payload || {},
    header: session.session_id ? { 'x-mini-session': session.session_id } : {},
    timeout: 12000
  });
}

function submitEvent(payload) {
  const session = storage.get(storage.KEYS.session, {});
  const identity = storage.loadClientIdentity ? storage.loadClientIdentity() : {};
  const body = Object.assign({ event: 'learning_event', client_id: identity.client_id || '' }, payload || {});
  if (storage.appendSyncMutation) {
    storage.appendSyncMutation('mini_event', body);
  }
  return request('/api/mini/event', {
    method: 'POST',
    data: body,
    header: session.session_id ? { 'x-mini-session': session.session_id } : {},
    timeout: 12000
  });
}

function submitLead(payload) {
  return request('/api/lead', {
    method: 'POST',
    data: Object.assign({
      kind: 'miniapp',
      page: 'miniprogram/profile'
    }, payload || {})
  });
}

function buildContentCards(payload) {
  const session = storage.get(storage.KEYS.session, {});
  return request('/api/mini/content-engine', {
    method: 'POST',
    data: payload || {},
    header: session.session_id ? { 'x-mini-session': session.session_id } : {},
    timeout: 30000
  });
}

function pushSyncMutations(payload) {
  const session = storage.get(storage.KEYS.session, {});
  return request('/api/mini/sync', {
    method: 'POST',
    data: payload || {},
    header: session.session_id ? { 'x-mini-session': session.session_id } : {},
    timeout: 20000
  });
}

function flushLocalSyncQueue() {
  const queue = storage.loadSyncQueue ? storage.loadSyncQueue() : [];
  const pending = queue.filter((item) => item.status === 'pending').slice(0, 80);
  if (!pending.length) {
    return Promise.resolve({ ok: true, pushed: 0, mode: 'empty' });
  }
  const identity = storage.loadClientIdentity ? storage.loadClientIdentity() : {};
  return pushSyncMutations({
    identity,
    mutations: pending,
    cursor: storage.loadSyncState ? storage.loadSyncState().cursor : ''
  }).then((result) => {
    const acknowledged = Array.isArray(result.acknowledged) ? result.acknowledged : [];
    const persisted = result && result.mode === 'supabase'
      && acknowledged.length >= pending.length
      && Number(result.pushed || 0) >= pending.length;
    if (storage.markSyncAttempt) {
      storage.markSyncAttempt({
        ok: persisted,
        mode: result.mode || 'unknown',
        acknowledged,
        error: persisted ? '' : 'sync_not_persisted'
      });
    }
    return Object.assign({}, result, {
      localReceipt: !persisted && result && result.mode === 'local_receipt'
    });
  }).catch((error) => {
    if (storage.markSyncAttempt) storage.markSyncAttempt({ ok: false, error: error.message || 'sync_failed' });
    return { ok: false, error: error.message || 'sync_failed', pushed: 0 };
  });
}

function reviewToday(payload) {
  const session = storage.get(storage.KEYS.session, {});
  return request('/api/mini/review-today', {
    method: 'POST',
    data: payload || {},
    header: session.session_id ? { 'x-mini-session': session.session_id } : {},
    timeout: 12000
  });
}

function gradeReview(payload) {
  const session = storage.get(storage.KEYS.session, {});
  return request('/api/mini/review-grade', {
    method: 'POST',
    data: payload || {},
    header: session.session_id ? { 'x-mini-session': session.session_id } : {},
    timeout: 12000
  });
}

function generateQuiz(payload) {
  const session = storage.get(storage.KEYS.session, {});
  return request('/api/mini/quiz-generate', {
    method: 'POST',
    data: payload || {},
    header: session.session_id ? { 'x-mini-session': session.session_id } : {},
    timeout: 12000
  });
}

function submitQuiz(payload) {
  const session = storage.get(storage.KEYS.session, {});
  return request('/api/mini/quiz-submit', {
    method: 'POST',
    data: payload || {},
    header: session.session_id ? { 'x-mini-session': session.session_id } : {},
    timeout: 12000
  });
}

function fetchAchievements(payload) {
  const session = storage.get(storage.KEYS.session, {});
  return request('/api/mini/achievements', {
    method: 'POST',
    data: payload || {},
    header: session.session_id ? { 'x-mini-session': session.session_id } : {},
    timeout: 12000
  });
}

function fetchShop(payload) {
  const session = storage.get(storage.KEYS.session, {});
  return request('/api/mini/shop', {
    method: 'POST',
    data: payload || {},
    header: session.session_id ? { 'x-mini-session': session.session_id } : {},
    timeout: 12000
  });
}

function purchaseShopItem(payload) {
  return fetchShop(Object.assign({ action: 'purchase' }, payload || {}));
}

function fetchLeaderboard(payload) {
  const session = storage.get(storage.KEYS.session, {});
  return request('/api/mini/leaderboard', {
    method: 'POST',
    data: payload || {},
    header: session.session_id ? { 'x-mini-session': session.session_id } : {},
    timeout: 12000
  });
}

function fetchGameReport(payload) {
  const session = storage.get(storage.KEYS.session, {});
  return request('/api/mini/report', {
    method: 'POST',
    data: payload || {},
    header: session.session_id ? { 'x-mini-session': session.session_id } : {},
    timeout: 12000
  });
}

function recognizeLearningReport(payload) {
  const session = storage.get(storage.KEYS.session, {});
  return request('/api/mini/learning-report-recognize', {
    method: 'POST',
    data: payload || {},
    header: session.session_id ? { 'x-mini-session': session.session_id } : {},
    timeout: 20000
  }).catch(() => {
    const text = (payload && (payload.text || payload.sourceText || payload.recognizedText)) || '';
    return {
      ok: !!text,
      mode: text ? 'local_rules_fallback' : 'unavailable',
      service_ready: false,
      persisted: false,
      service_contract: {
        mode: 'client_local_draft',
        persisted: false,
        confirmation_required: true,
        evidence_required: ['recognized_text', 'parent_confirmation']
      },
      action_required: 'recognition_service_configuration',
      sourceType: (payload && payload.sourceType) || 'mixed',
      recognizedText: text,
      parsedScores: {},
      parsedRanks: {},
      assessmentSignals: {},
      confidence: text ? 0.34 : 0.2,
      requiresConfirmation: true,
      confirmPrompts: ['识别服务暂时不可用，请先确认或手动补充关键字段。'],
      missingFields: ['可确认的学科分数', '总排名/班级排名'],
      evidence: text ? ['已保留家长输入，等待确认。'] : [],
      updatedAt: new Date().toISOString()
    };
  });
}

function analyzeMiniappMaterial(payload) {
  const session = storage.get(storage.KEYS.session, {});
  return request('/api/miniapp-material-analysis', {
    method: 'POST',
    data: payload || {},
    header: session.session_id ? { 'x-mini-session': session.session_id } : {},
    timeout: 22000
  });
}

function fetchReportJobStatus(caseId) {
  const safeCaseId = String(caseId || 'default').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64) || 'default';
  return request(`/api/report-job-status?case_id=${encodeURIComponent(safeCaseId)}`, {
    method: 'GET',
    timeout: 12000
  });
}

module.exports = {
  request,
  initSession,
  buildPriority,
  buildWeekly,
  submitFeedback,
  submitEvent,
  checkContent,
  sendTutorMessage,
  submitLead,
  buildContentCards,
  pushSyncMutations,
  flushLocalSyncQueue,
  reviewToday,
  gradeReview,
  generateQuiz,
  submitQuiz,
  fetchAchievements,
  fetchShop,
  purchaseShopItem,
  fetchLeaderboard,
  fetchGameReport,
  recognizeLearningReport,
  analyzeMiniappMaterial,
  fetchReportJobStatus
};
