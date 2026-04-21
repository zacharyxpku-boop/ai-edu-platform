/* ===== 原点智学 · HUD 悬浮徽章 =====
 * 引入即自动在右下角渲染 LV / 🔥 streak / XP 小徽章，点击跳 progress.html
 * 依赖：先加载 src/gamification.js
 */
(function () {
    'use strict';
    if (!window.GAME) {
        console.warn('[HUD] gamification.js 未加载，HUD 跳过');
        return;
    }

    function ensureStyle() {
        if (document.getElementById('ydzx-game-hud-style')) return;
        var s = document.createElement('style');
        s.id = 'ydzx-game-hud-style';
        s.textContent =
            '#ydzx-hud{position:fixed;right:16px;bottom:16px;z-index:9997;display:flex;align-items:center;gap:8px;padding:10px 14px;background:#fff;border:1px solid #E8E5DE;border-radius:100px;box-shadow:0 6px 20px rgba(0,0,0,0.08);cursor:pointer;transition:all .2s ease;font:600 13px/1 "Noto Sans SC",system-ui,sans-serif;color:#1C1C1E;text-decoration:none}' +
            '#ydzx-hud:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(0,0,0,0.12);border-color:#F5A623}' +
            '#ydzx-hud .hud-lv{display:inline-flex;align-items:center;gap:4px;padding:4px 8px;background:linear-gradient(135deg,#F5A623,#C2410C);color:#fff;border-radius:100px;font-weight:800;font-size:12px}' +
            '#ydzx-hud .hud-streak{color:#DC2626}' +
            '#ydzx-hud .hud-xp{color:#6B7280;font-weight:500}' +
            '#ydzx-hud .hud-bar{position:absolute;bottom:-3px;left:12px;right:12px;height:2px;background:#F3F0E8;border-radius:2px;overflow:hidden}' +
            '#ydzx-hud .hud-bar::after{content:"";display:block;height:100%;background:linear-gradient(90deg,#F5A623,#C2410C);width:var(--w,0%);transition:width .6s ease}' +
            '@media (max-width:600px){#ydzx-hud{right:12px;bottom:80px;padding:8px 12px;font-size:12px}}';
        document.head.appendChild(s);
    }

    function render() {
        var p = window.GAME.getProfile();
        var lv = p.levelInfo || { lv: 1, name: '初入门径', progress: 0 };
        var el = document.getElementById('ydzx-hud');
        if (!el) {
            el = document.createElement('a');
            el.id = 'ydzx-hud';
            el.href = '/progress.html';
            el.setAttribute('aria-label', '我的学习进度');
            document.body.appendChild(el);
        }
        el.innerHTML =
            '<span class="hud-lv">LV.' + lv.lv + '</span>' +
            (p.streak > 0 ? '<span class="hud-streak">🔥' + p.streak + '</span>' : '') +
            '<span class="hud-xp">' + (p.xp || 0) + ' XP</span>' +
            '<span class="hud-bar" style="--w:' + (lv.progress || 0) + '%"></span>';
    }

    function init() {
        ensureStyle();
        // 记一次打卡（基于当前页路径猜工具名）
        var path = location.pathname;
        var tool = path.split('/').pop().replace('.html', '') || 'home';
        try { window.GAME.pingToday(tool); } catch (e) {}
        render();
        // 每 30 秒刷一下（等待 toast 触发后 XP 更新）
        setInterval(render, 30000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 暴露一个手动刷新钩子
    window.YdzxHUD = { refresh: render };
})();
