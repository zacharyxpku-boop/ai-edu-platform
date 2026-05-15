/**
 * src/track.js · 极简 click 事件埋点(全站共享)
 *
 * 用法:
 *   <script src="/src/track.js"></script>
 *   <script>YDZX_TRACK.event('home_subject_click', { subject: 'math' });</script>
 *
 * 数据落点:
 *   - localStorage('ydzx_event_log_v1') 环形数组上限 500 条 {ts, e, p}
 *   - POST /api/track 写服务端轻量日志(仅事件元信息, 敏感字段会裁剪)
 *   - 镜像 window.gtag (GA4) / window.fbq (Meta) try-catch shim, 不依赖
 *
 * 跟 subject-hub.js 内 trackEvent 行为一致, 抽到独立 module 给 index/paths/quiz/errors
 * 等没加载 subject-hub 的页面也能用.
 */
(function (global) {
  'use strict';

  const KEY = 'ydzx_event_log_v1';
  const CAP = 500;
  const SENSITIVE_KEY = /key|token|secret|password|authorization|credential|openid|phone|mobile/i;
  const MAX_META_STR = 180;

  function scrub(value, depth) {
    if (depth > 3) return '[truncated]';
    if (value == null) return value;
    if (typeof value === 'string') return value.slice(0, MAX_META_STR);
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.slice(0, 8).map(function (item) { return scrub(item, depth + 1); });
    if (typeof value === 'object') {
      const out = {};
      Object.keys(value).slice(0, 24).forEach(function (key) {
        out[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : scrub(value[key], depth + 1);
      });
      return out;
    }
    return String(value).slice(0, MAX_META_STR);
  }

  function sid() {
    try {
      const key = 'ydzx_sid_v1';
      let value = localStorage.getItem(key);
      if (!value) {
        value = 'sid_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem(key, value);
      }
      return value;
    } catch (_) {
      return '';
    }
  }

  function sendServer(entry) {
    const payload = JSON.stringify({
      event: entry.e,
      page: derivePageName(),
      ts: entry.ts,
      sid: sid(),
      ref: document.referrer || '',
      meta: scrub(entry.p || {}, 0)
    });
    try {
      if (global.navigator && typeof global.navigator.sendBeacon === 'function') {
        const ok = global.navigator.sendBeacon('/api/track', new Blob([payload], { type: 'application/json' }));
        if (ok) return;
      }
    } catch (_) {}
    try {
      if (typeof global.fetch === 'function') {
        global.fetch('/api/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true
        }).catch(function () {});
      }
    } catch (_) {}
  }

  function event(name, props) {
    const safeProps = scrub(props || {}, 0);
    const entry = { ts: Date.now(), e: name, p: safeProps };
    try {
      const log = JSON.parse(localStorage.getItem(KEY) || '[]');
      log.push(entry);
      if (log.length > CAP) log.splice(0, log.length - CAP);
      localStorage.setItem(KEY, JSON.stringify(log));
    } catch (_) {}
    try { if (typeof global.gtag === 'function') global.gtag('event', name, safeProps); } catch (_) {}
    try { if (typeof global.fbq === 'function') global.fbq('trackCustom', name, safeProps); } catch (_) {}
    sendServer(entry);
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

  // ─── 自动 page_view 一次/加载 ───
  // 页面只要 <script src="/src/track.js"></script> 就自动登记 PV, 无需手动调用
  // 页面名优先 meta[name="ydzx-page"], fallback 取 location.pathname 的最后一段(去 .html)
  function derivePageName() {
    try {
      const meta = document.querySelector('meta[name="ydzx-page"]');
      if (meta && meta.content) return meta.content;
      const path = (location.pathname || '/').replace(/\/$/, '/');
      let seg = path.split('/').filter(Boolean).pop() || 'home';
      seg = seg.replace(/\.html?$/i, '');
      return seg || 'home';
    } catch (_) { return 'unknown'; }
  }
  // 防同次刷新内重复 push (例如 SPA 二次 boot 误触)
  if (!global.__YDZX_PV_FIRED__) {
    global.__YDZX_PV_FIRED__ = true;
    setTimeout(function () {
      try {
        event('page_view', {
          page: derivePageName(),
          path: location.pathname || '',
          ref: document.referrer || ''
        });
      } catch (_) {}
    }, 0);
  }

  global.YDZX_TRACK = { event: event, recent: recent, countByName: countByName, derivePageName: derivePageName, KEY: KEY, CAP: CAP };
})(window);
