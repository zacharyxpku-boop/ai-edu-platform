const api = require('./utils/api');
const storage = require('./utils/storage');

App({
  globalData: {
    apiBase: 'https://yuandianzhixue.com',
    productName: '原点智学',
    tutorName: '原小点'
  },

  onLaunch() {
    const profile = storage.loadProfile();
    api.initSession(profile);
  }
});
