/**
 * src/track.js · 极简 click 事件埋点(全站共享)
 *
 * 用法:
 *   <script src="/src/track.js"></script>
 *   <script>YDZX_TRACK.event('home_subject_click', { subject: 'math' });</script>
 *
 * 数据落点:
 *   - localStorage('ydzx_event_log_v1') 环形数组上限 500 条 {ts, e, p}
 *   - 镜像 window.gtag (GA4) / window.fbq (Meta) try-catch shim, 不依赖
 *
 * 跟 subject-hub.js 内 trackEvent 行为一致, 抽到独立 module 给 index/paths/quiz/errors
 * 等没加载 subject-hub 的页面也能用.
 */
(function (global) {
  'use strict';

  const KEY = 'ydzx_event_log_v1';
  const CAP = 500;

  function event(name, props) {
    const entry = { ts: Date.now(), e: name, p: props || {} };
    try {
      const log = JSON.parse(localStorage.getItem(KEY) || '[]');
      log.push(entry);
      if (log.length > CAP) log.splice(0, log.length - CAP);
      localStorage.setItem(KEY, JSON.stringify(log));
    } catch (_) {}
    try { if (typeof global.gtag === 'function') global.gtag('event', name, props || {}); } catch (_) {}
    try { if (typeof global.fbq === 'function') global.fbq('trackCustom', name, props || {}); } catch (_) {}
  }

  // 只读 helper · 给 OBSERVABILITY snippet / debug console 用
  function recent(n) {
    try { return (JSON.parse(localStorage.getItem(KEY) || '[]')).slice(-Math.max(1, n || 10)); }
    catch (_) { return []; }
  }
  function countByName() {
    try {
      const log = JSON.parse(localStorage.getItem(KEY) || '[]');
      const acc = {};
      log.forEach(e => { acc[e.e] = (acc[e.e] || 0) + 1; });
      return acc;
    } catch (_) { return {}; }
  }

  global.YDZX_TRACK = { event: event, recent: recent, countByName: countByName, KEY: KEY, CAP: CAP };
})(window);
