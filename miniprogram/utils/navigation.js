'use strict';

const TAB_ROUTES = [
  '/pages/home/home',
  '/pages/tutor/tutor',
  '/pages/arcade/arcade',
  '/pages/profile/profile',
  '/pages/upload/upload'
];

function normalizeRoute(route) {
  const value = typeof route === 'string' ? route.trim() : '';
  if (!value) return '';
  return value.startsWith('/') ? value : `/${value}`;
}

function baseRoute(route) {
  return normalizeRoute(route).split('?')[0];
}

function routeQuery(route) {
  const url = normalizeRoute(route);
  const index = url.indexOf('?');
  return index >= 0 ? url.slice(index + 1) : '';
}

function rememberTabRouteContext(route) {
  const url = normalizeRoute(route);
  const base = baseRoute(url);
  const query = routeQuery(url);
  if (!query || typeof wx === 'undefined' || !wx.setStorageSync) return;
  try {
    wx.setStorageSync('navigation.pendingTabRoute.v1', {
      route: url,
      base,
      query,
      createdAt: Date.now()
    });
  } catch (error) {
    // Navigation must still work when storage is unavailable.
  }
}

function parseQuery(query = '') {
  return String(query || '').split('&').filter(Boolean).reduce((acc, pair) => {
    const index = pair.indexOf('=');
    const rawKey = index >= 0 ? pair.slice(0, index) : pair;
    const rawValue = index >= 0 ? pair.slice(index + 1) : '';
    if (!rawKey) return acc;
    try {
      acc[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue || '');
    } catch (error) {
      acc[rawKey] = rawValue || '';
    }
    return acc;
  }, {});
}

function consumePendingTabRouteContext(route) {
  const base = baseRoute(route);
  if (!base || typeof wx === 'undefined' || !wx.getStorageSync) return null;
  let pending = null;
  try {
    pending = wx.getStorageSync('navigation.pendingTabRoute.v1');
  } catch (error) {
    return null;
  }
  if (!pending || pending.base !== base) return null;
  if (Date.now() - Number(pending.createdAt || 0) > 5 * 60 * 1000) {
    if (wx.removeStorageSync) wx.removeStorageSync('navigation.pendingTabRoute.v1');
    return null;
  }
  if (wx.removeStorageSync) wx.removeStorageSync('navigation.pendingTabRoute.v1');
  return Object.assign({}, pending, {
    options: parseQuery(pending.query || '')
  });
}

function shouldOpenFunctionalTab(options = {}) {
  const from = String(options.from || '');
  return from.indexOf('entry_') === 0 || options.open === 'flow' || options.panel || options.type || options.mode;
}

function navigateLearningRoute(route) {
  const url = normalizeRoute(route);
  if (!url || typeof wx === 'undefined') return false;
  const base = baseRoute(url);
  if (TAB_ROUTES.includes(base)) {
    rememberTabRouteContext(url);
    wx.switchTab({ url: base });
    return true;
  }
  wx.navigateTo({ url });
  return true;
}

module.exports = {
  navigateLearningRoute,
  normalizeRoute,
  baseRoute,
  routeQuery,
  parseQuery,
  rememberTabRouteContext,
  consumePendingTabRouteContext,
  shouldOpenFunctionalTab
};
