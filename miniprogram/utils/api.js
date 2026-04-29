const storage = require('./storage');

const DEFAULT_BASE_URL = 'https://yuandianzhixue.com';

function apiBase() {
  const app = typeof getApp === 'function' ? getApp() : null;
  return (app && app.globalData && app.globalData.apiBase) || DEFAULT_BASE_URL;
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
      }, opts.header || {}),
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

function initSession(profile) {
  return new Promise((resolve) => {
    wx.login({
      success(loginRes) {
        request('/api/mini/session', {
          method: 'POST',
          data: {
            code: loginRes.code || 'demo',
            profile: profile || storage.loadProfile()
          },
          timeout: 15000
        }).then((session) => {
          storage.set(storage.KEYS.session, session);
          resolve(session);
        }).catch(() => {
          const fallback = {
            ok: true,
            mode: 'local',
            session_id: `local_${Date.now()}`,
            message: '本地体验模式'
          };
          storage.set(storage.KEYS.session, fallback);
          resolve(fallback);
        });
      },
      fail() {
        const fallback = {
          ok: true,
          mode: 'local',
          session_id: `local_${Date.now()}`,
          message: '本地体验模式'
        };
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

function submitLead(payload) {
  return request('/api/lead', {
    method: 'POST',
    data: Object.assign({
      kind: 'miniapp',
      page: 'miniprogram/profile'
    }, payload || {})
  });
}

module.exports = {
  request,
  initSession,
  sendTutorMessage,
  submitLead
};
