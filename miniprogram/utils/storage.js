const priority = require('./learning-priority');

const KEYS = {
  state: 'ydzx.priority.state.v1',
  selectedHomework: 'ydzx.selected.homework.v1',
  profile: 'ydzx.profile.v1',
  consent: 'ydzx.guardian.consent.v1',
  session: 'ydzx.mini.session.v1',
  tutorMessages: 'ydzx.tutor.messages.v1'
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

function loadState() {
  return get(KEYS.state, null) || priority.makeDemoState();
}

function saveState(state) {
  return set(KEYS.state, Object.assign({}, state, { updated_at: new Date().toISOString() }));
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
  return set(KEYS.profile, profile || {});
}

module.exports = {
  KEYS,
  get,
  set,
  loadState,
  saveState,
  loadProfile,
  saveProfile
};
