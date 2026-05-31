'use strict';

const navigation = require('../../utils/navigation');

function buildReviewRoute(query = {}) {
  const pairs = Object.keys(query || {})
    .filter((key) => query[key] !== undefined && query[key] !== null && query[key] !== '')
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`);
  const suffix = pairs.length ? `?${pairs.join('&')}` : '?from=legacy_arcade_redirect';
  return `/pages/review/review${suffix}`;
}

Page({
  data: {
    targetRoute: '/pages/review/review?from=legacy_arcade_redirect'
  },

  onLoad(query = {}) {
    const targetRoute = buildReviewRoute(Object.assign({ from: 'legacy_arcade_redirect' }, query));
    this.setData({ targetRoute });
    if (navigation.rememberTabRouteContext) navigation.rememberTabRouteContext(targetRoute);
    if (typeof wx !== 'undefined' && wx.switchTab) {
      wx.switchTab({ url: '/pages/review/review' });
    }
  },

  onShow() {
    if (navigation.consumePendingTabRouteContext) {
      navigation.consumePendingTabRouteContext('/pages/arcade/arcade');
    }
  },

  openEntryDetail(event) {
    const scene = event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.scene || 'review'
      : 'review';
    const route = `/pages/entry-detail/entry-detail?scene=${encodeURIComponent(scene)}&from=legacy_arcade_redirect`;
    if (navigation.navigateLearningRoute) {
      navigation.navigateLearningRoute(route);
    }
  },

  goReview() {
    if (navigation.navigateLearningRoute) {
      navigation.navigateLearningRoute(this.data.targetRoute || '/pages/review/review?from=legacy_arcade_redirect');
    }
  }
});
