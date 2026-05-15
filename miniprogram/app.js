const api = require('./utils/api');
const storage = require('./utils/storage');

App({
  globalData: {
    apiBase: 'https://yuandianzhixue.com',
    productName: '原点私教',
    tutorName: '咕点'
  },

  onLaunch() {
    storage.ensureLocalUserId && storage.ensureLocalUserId();
    storage.archiveYesterdaySession && storage.archiveYesterdaySession();
    setTimeout(() => {
      const profile = storage.loadProfile();
      api.initSession(profile).catch(() => {});
    }, 800);
  },

  onShareAppMessage() {
    const profile = storage.loadProfile ? storage.loadProfile() : {};
    const name = profile.name || '我家孩子';
    return {
      title: `${name} 今晚确认了第一步`,
      path: `/pages/home/home?ref=${storage.getLocalUserId ? storage.getLocalUserId() : ''}`
    };
  }
});
