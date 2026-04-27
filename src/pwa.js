/* 原点智学 — PWA 注册 + 安装引导
   - 注册 /sw.js
   - 捕获 beforeinstallprompt，延迟到第 N 次访问再弹，避免骚扰
   - localStorage:  ydzx_pwa_visits / ydzx_pwa_dismiss / ydzx_pwa_installed
*/
(function () {
    'use strict';
    if (window.__ydzxPwa) return;
    window.__ydzxPwa = true;

    var MIN_VISITS = 3;  // 至少第 3 次访问才提示
    var LS_VISITS = 'ydzx_pwa_visits';
    var LS_DISMISS = 'ydzx_pwa_dismiss';
    var LS_INSTALLED = 'ydzx_pwa_installed';

    function get(k, fb) { try { return localStorage.getItem(k); } catch (e) { return fb; } }
    function set(k, v)  { try { localStorage.setItem(k, v); } catch (e) {} }

    // 访问计数
    try {
        var v = parseInt(get(LS_VISITS, '0') || '0', 10) + 1;
        set(LS_VISITS, String(v));
    } catch (e) {}

    // SW 注册
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
        window.addEventListener('load', function () {
            navigator.serviceWorker.register('/sw.js').catch(function () {});
        });
    }

    // 已在 standalone 模式运行 → 跳过
    var standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    if (standalone || get(LS_INSTALLED) === '1') return;

    var deferred = null;
    window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault();
        deferred = e;
        maybeShowBar();
    });

    window.addEventListener('appinstalled', function () {
        set(LS_INSTALLED, '1');
        hideBar();
        try { if (window.YdzxTrack) window.YdzxTrack.send('pwa_installed'); } catch (e) {}
    });

    function maybeShowBar() {
        var visits = parseInt(get(LS_VISITS, '0') || '0', 10);
        var dismissedTs = parseInt(get(LS_DISMISS, '0') || '0', 10);
        // 拒绝后 14 天冷却
        if (dismissedTs && (Date.now() - dismissedTs) < 14 * 864e5) return;
        if (visits < MIN_VISITS) return;
        // 桌面端不弹（PWA 在桌面价值低且会盖住内容）
        var isMobile = window.matchMedia && window.matchMedia('(max-width: 820px)').matches;
        var isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        if (!isMobile && !isTouch) return;
        showBar();
    }

    function showBar() {
        if (document.getElementById('ydzx-pwa-bar')) return;
        var bar = document.createElement('div');
        bar.id = 'ydzx-pwa-bar';
        bar.style.cssText = [
            'position:fixed', 'left:12px', 'right:12px', 'bottom:12px', 'z-index:9997',
            'background:#18181B', 'color:#fff', 'border-radius:12px', 'padding:12px 14px',
            'display:flex', 'align-items:center', 'gap:12px',
            'box-shadow:0 16px 40px rgba(0,0,0,.28)',
            'font-family:"Noto Sans SC",system-ui,sans-serif',
            'font-size:13px', 'max-width:520px', 'margin-left:auto', 'margin-right:auto',
            'transform:translateY(120%)', 'transition:transform .35s cubic-bezier(.2,.8,.2,1)'
        ].join(';');
        bar.innerHTML =
            '<div style="flex:1;line-height:1.5">' +
              '<div style="font-weight:700;margin-bottom:2px">装到桌面，像 App 一样打开</div>' +
              '<div style="font-size:11px;color:rgba(255,255,255,.65)">所有工具一键打开，离线也能查指南</div>' +
            '</div>' +
            '<button id="ydz-pwa-no"  style="background:transparent;border:none;color:rgba(255,255,255,.6);font-size:12px;cursor:pointer;font-family:inherit;padding:6px 8px">以后再说</button>' +
            '<button id="ydz-pwa-yes" style="background:#F5A623;border:none;color:#18181B;font-weight:800;font-size:13px;padding:8px 14px;border-radius:8px;cursor:pointer;font-family:inherit">装到桌面</button>';
        document.body.appendChild(bar);
        requestAnimationFrame(function () { bar.style.transform = 'translateY(0)'; });

        try { if (window.YdzxTrack) window.YdzxTrack.send('pwa_prompt_shown'); } catch (e) {}

        document.getElementById('ydz-pwa-no').onclick = function () {
            set(LS_DISMISS, String(Date.now()));
            try { if (window.YdzxTrack) window.YdzxTrack.send('pwa_prompt_dismiss'); } catch (e) {}
            hideBar();
        };
        document.getElementById('ydz-pwa-yes').onclick = function () {
            if (!deferred) { hideBar(); return; }
            deferred.prompt();
            deferred.userChoice.then(function (c) {
                try { if (window.YdzxTrack) window.YdzxTrack.send('pwa_prompt_choice', { outcome: c && c.outcome }); } catch (e) {}
                if (c && c.outcome === 'dismissed') set(LS_DISMISS, String(Date.now()));
                deferred = null;
                hideBar();
            });
        };
    }

    function hideBar() {
        var bar = document.getElementById('ydzx-pwa-bar');
        if (!bar) return;
        bar.style.transform = 'translateY(120%)';
        setTimeout(function () { if (bar.parentNode) bar.parentNode.removeChild(bar); }, 400);
    }
})();
