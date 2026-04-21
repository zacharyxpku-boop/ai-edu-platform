/* 原点智学 — 轻量自建分析 (v1)
   引入： <script src="/src/analytics.js" defer></script>
   自动采集：pageview / scroll_depth / time_on_page / click[data-track] / lead_submit
   手动：window.YdzxTrack.send('event_name', { foo:'bar' })
   sid 放 sessionStorage（30min 超时重置）
   utm_* 首访落 sessionStorage，后续所有事件带上
*/
(function () {
    'use strict';
    if (window.__ydzxAnalytics) return;
    window.__ydzxAnalytics = true;

    var ENDPOINT = '/api/track';
    var SESSION_MS = 30 * 60 * 1000;

    function now() { return Date.now(); }
    function safeGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
    function safeSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }

    // --- session ---
    function getSid() {
        var sid = safeGet('ydzx_sid');
        var ts = parseInt(safeGet('ydzx_sid_ts') || '0', 10);
        if (!sid || now() - ts > SESSION_MS) {
            sid = 's_' + now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
            safeSet('ydzx_sid', sid);
        }
        safeSet('ydzx_sid_ts', String(now()));
        return sid;
    }

    // --- utm 首访记忆 ---
    (function captureUtm() {
        try {
            var p = new URLSearchParams(location.search);
            ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(function (k) {
                var v = p.get(k);
                if (v && !safeGet(k)) safeSet(k, v.slice(0, 80));
            });
        } catch (e) {}
    })();

    function utmMeta() {
        var m = {};
        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(function (k) {
            var v = safeGet(k); if (v) m[k] = v;
        });
        return m;
    }

    // --- 发送 ---
    function send(event, meta) {
        if (!event) return;
        var payload = {
            event: event,
            page:  location.pathname + location.search,
            sid:   getSid(),
            ref:   document.referrer || '',
            meta:  Object.assign({}, utmMeta(), meta || {})
        };
        var body = JSON.stringify(payload);
        try {
            if (navigator.sendBeacon) {
                var blob = new Blob([body], { type: 'application/json' });
                if (navigator.sendBeacon(ENDPOINT, blob)) return;
            }
        } catch (e) {}
        // 回落
        fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function () {});
    }

    // --- pageview ---
    send('pageview', { title: document.title.slice(0, 80) });

    // --- scroll depth ---
    var seen = {};
    function scrollHandler() {
        var h = document.documentElement;
        var max = Math.max(1, h.scrollHeight - h.clientHeight);
        var pct = Math.round((h.scrollTop || document.body.scrollTop) / max * 100);
        [25, 50, 75, 100].forEach(function (m) {
            if (pct >= m && !seen[m]) {
                seen[m] = 1;
                send('scroll_depth', { pct: m });
            }
        });
    }
    var scrollTO = null;
    window.addEventListener('scroll', function () {
        clearTimeout(scrollTO);
        scrollTO = setTimeout(scrollHandler, 200);
    }, { passive: true });

    // --- time on page (unload) ---
    var enter = now();
    function flushTimer() {
        var dur = Math.round((now() - enter) / 1000);
        if (dur < 3 || dur > 3600) return; // 过短/过长丢弃
        send('time_on_page', { sec: dur });
    }
    window.addEventListener('pagehide', flushTimer);
    // Safari 历史 bfcache 不触发 pagehide，补一发
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') flushTimer();
    });

    // --- data-track 点击 ---
    document.addEventListener('click', function (e) {
        var t = e.target;
        while (t && t !== document.body) {
            if (t.hasAttribute && t.hasAttribute('data-track')) {
                send('click', {
                    name: (t.getAttribute('data-track') || '').slice(0, 40),
                    label: (t.innerText || '').trim().slice(0, 40)
                });
                return;
            }
            t = t.parentNode;
        }
    }, { capture: true });

    // --- 自动桥接 lead 弹窗 ---
    // lead-modal 里未暴露事件，监听 document 即可，后续可补发自定义 event
    // 这里直接劫持 fetch 到 /api/lead 的成功回来，补一发 lead_submit
    var _fetch = window.fetch;
    window.fetch = function (url, opts) {
        var p = _fetch.apply(this, arguments);
        try {
            if (typeof url === 'string' && url.indexOf('/api/lead') !== -1 && opts && opts.method === 'POST') {
                p.then(function () {
                    var kind = '';
                    try { kind = JSON.parse(opts.body).kind || ''; } catch (e) {}
                    send('lead_submit', { kind: kind });
                }).catch(function () {});
            }
        } catch (e) {}
        return p;
    };

    window.YdzxTrack = { send: send, sid: getSid };
})();
