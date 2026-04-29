function requirePrivacy(scopeName) {
  return new Promise((resolve, reject) => {
    if (!wx.requirePrivacyAuthorize) {
      resolve({ ok: true, legacy: true });
      return;
    }
    wx.requirePrivacyAuthorize({
      success() {
        resolve({ ok: true });
      },
      fail(error) {
        wx.showToast({
          title: scopeName ? `需要同意隐私指引后使用${scopeName}` : '需要同意隐私指引',
          icon: 'none'
        });
        reject(error);
      }
    });
  });
}

module.exports = {
  requirePrivacy
};
