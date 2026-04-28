/* 原点智学 · 全站 Sticky 加微信 CTA (v1)
 * --------------------------------------------------------------------------
 * 自动注入 fixed 胶囊按钮; 滚动 > 400px 出现; 点击调用 wechat-cta modal.
 * 暗墨绿 #0F4F3D / 米白 #FAF7F0 · 桌面 bottom-right · 移动端固定底部居中
 * sessionStorage 记录关闭状态: ydzx_sticky_dismissed
 * 埋点: sticky_wechat_view / sticky_wechat_click / sticky_wechat_dismiss
 * 依赖: src/wechat-cta.js (window.YDZX_WECHAT_CTA.open)
 * -------------------------------------------------------------------------- */
(function () {
    'use strict';
    if (window.__ydzxStickyWechat) return;
    window.__ydzxStickyWechat = true;

    var DISMISS_KEY = 'ydzx_sticky_dismissed';
    var SHOW_AFTER_PX = 400;
    var STYLE_ID = 'ydzx-sticky-wechat-style';
    var CONTAINER_ID = 'ydzx-sticky-wechat';

    function track(name, payload) {
        try { if (window.YDZX_TRACK) window.YDZX_TRACK.event(name, payload || {}); } catch (e) {}
    }

    function isDismissed() {
        try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch (e) { return false; }
    }

    function setDismissed() {
        try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch (e) {}
    }

    function injectStyle() {
        if (document.getElementById(STYLE_ID)) return;
        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = [
            '#' + CONTAINER_ID + '{position:fixed;right:20px;bottom:20px;z-index:9990;display:none;opacity:0;transform:translateY(12px);transition:opacity .28s ease-out,transform .28s ease-out;font-family:"Noto Sans SC",system-ui,sans-serif}',
            '#' + CONTAINER_ID + '.show{display:flex;opacity:1;transform:translateY(0)}',
            '#' + CONTAINER_ID + ' .ydsw-btn{display:inline-flex;align-items:center;gap:8px;padding:13px 20px;background:#0F4F3D;color:#FAF7F0;border:none;border-radius:4px;font:500 14px "Noto Sans SC",sans-serif;letter-spacing:0.04em;cursor:pointer;box-shadow:0 8px 24px rgba(15,79,61,0.32),0 2px 6px rgba(0,0,0,0.12);transition:background .15s,transform .15s}',
            '#' + CONTAINER_ID + ' .ydsw-btn:hover{background:#0A3D2E;transform:translateY(-1px)}',
            '#' + CONTAINER_ID + ' .ydsw-btn:active{transform:translateY(0)}',
            '#' + CONTAINER_ID + ' .ydsw-icon{font-size:15px;line-height:1}',
            '#' + CONTAINER_ID + ' .ydsw-arrow{margin-left:2px;font-size:13px;opacity:0.85}',
            '#' + CONTAINER_ID + ' .ydsw-close{margin-left:6px;width:24px;height:24px;border:none;background:rgba(250,247,240,0.14);color:#FAF7F0;border-radius:4px;font-size:14px;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center;padding:0;transition:background .15s}',
            '#' + CONTAINER_ID + ' .ydsw-close:hover{background:rgba(250,247,240,0.28)}',
            '@media(max-width:640px){',
            '#' + CONTAINER_ID + '{left:12px;right:12px;bottom:12px;justify-content:center}',
            '#' + CONTAINER_ID + ' .ydsw-btn{flex:1;justify-content:center;padding:14px 16px;font-size:15px;border-radius:4px}',
            '}'
        ].join('\n');
        document.head.appendChild(style);
    }

    function build() {
        if (document.getElementById(CONTAINER_ID)) return;
        var wrap = document.createElement('div');
        wrap.id = CONTAINER_ID;
        wrap.setAttribute('role', 'complementary');
        wrap.setAttribute('aria-label', '加微信咨询');
        wrap.innerHTML = [
            '<button class="ydsw-btn" type="button" id="ydsw-cta" aria-label="加微信咨询">',
            '  <span class="ydsw-icon" aria-hidden="true">💬</span>',
            '  <span>加微信咨询</span>',
            '  <span class="ydsw-arrow" aria-hidden="true">→</span>',
            '</button>',
            '<button class="ydsw-close" type="button" id="ydsw-close" aria-label="关闭">×</button>'
        ].join('');
        document.body.appendChild(wrap);

        document.getElementById('ydsw-cta').addEventListener('click', function () {
            track('sticky_wechat_click', { page: location.pathname });
            try {
                if (window.YDZX_WECHAT_CTA && typeof window.YDZX_WECHAT_CTA.open === 'function') {
                    window.YDZX_WECHAT_CTA.open('floating-cta');
                }
            } catch (e) {}
        });

        document.getElementById('ydsw-close').addEventListener('click', function () {
            setDismissed();
            track('sticky_wechat_dismiss', { page: location.pathname });
            hide();
        });
    }

    var visible = false;
    var viewTracked = false;

    function show() {
        var el = document.getElementById(CONTAINER_ID);
        if (!el) return;
        if (!visible) {
            el.classList.add('show');
            visible = true;
            if (!viewTracked) {
                viewTracked = true;
                track('sticky_wechat_view', { page: location.pathname });
            }
        }
    }

    function hide() {
        var el = document.getElementById(CONTAINER_ID);
        if (!el) return;
        el.classList.remove('show');
        visible = false;
    }

    function onScroll() {
        if (isDismissed()) return;
        var y = window.pageYOffset || document.documentElement.scrollTop || 0;
        if (y > SHOW_AFTER_PX) show();
    }

    function init() {
        if (isDismissed()) return;
        injectStyle();
        build();
        // 检查初始滚动位置 (用户可能 deep-link 到页面中段)
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    /* 暴露 API 便于外部调试或手动触发 */
    window.YDZX_STICKY_WECHAT = {
        show: show,
        hide: hide,
        isDismissed: isDismissed,
        reset: function () {
            try { sessionStorage.removeItem(DISMISS_KEY); } catch (e) {}
        }
    };
})();
