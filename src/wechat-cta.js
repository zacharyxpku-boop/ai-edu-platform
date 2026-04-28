/* 原点智学 · 通用微信 CTA 漏斗 (v1)
 * --------------------------------------------------------------------------
 * 用法: 任意按钮加 data-wechat-cta 属性, 自动接管点击
 *   <button data-wechat-cta="hero-diagnose">立即咨询</button>
 *   <button data-wechat-cta="pricing-flagship">咨询报名</button>
 *
 * 弹出 modal 双通道:
 *   1. 加客服微信 (扫码)
 *   2. 留手机号 (走 /api/lead, 助教 24h 内联系)
 *
 * 自动埋点 YDZX_TRACK: wechat_cta_open / wechat_cta_qr_view / wechat_cta_phone_submit
 * --------------------------------------------------------------------------
 */
(function () {
    'use strict';
    if (window.__ydzxWechatCta) return;
    window.__ydzxWechatCta = true;

    var CHANNEL_LABEL = {
        'hero-diagnose': '原点智学诊断咨询',
        'hero-cta': '原点智学课程咨询',
        'pricing-online': '线上系统课咨询 ¥2,499',
        'pricing-camp': '少年营报名 ¥4,980',
        'pricing-flagship': '清北 4 对 1 陪跑 ¥6,980 (限 4 人/期)',
        'report-cta': '基于诊断报告 1v1 定制方案',
        'platform-engine': '原点自研技术深度沟通',
        'membership-basic': '会员入会 ¥99/月',
        'membership-family': '全家会员 ¥299/月',
        'tools-promo': '系统课方案咨询',
        'final-cta': '原点智学咨询',
    };

    /* 客服微信占位 SVG (墨绿色块 + 圆点二维码风格).
       生产环境替换为 /assets/wechat-qr.png 真二维码即可. */
    var WECHAT_QR_SVG = 'data:image/svg+xml;utf8,' + encodeURIComponent([
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">',
        '<rect width="240" height="240" fill="#FFFFFF" rx="6"/>',
        // 三个定位角
        '<rect x="14" y="14" width="56" height="56" fill="#0F4F3D"/>',
        '<rect x="22" y="22" width="40" height="40" fill="#FFFFFF"/>',
        '<rect x="30" y="30" width="24" height="24" fill="#0F4F3D"/>',
        '<rect x="170" y="14" width="56" height="56" fill="#0F4F3D"/>',
        '<rect x="178" y="22" width="40" height="40" fill="#FFFFFF"/>',
        '<rect x="186" y="30" width="24" height="24" fill="#0F4F3D"/>',
        '<rect x="14" y="170" width="56" height="56" fill="#0F4F3D"/>',
        '<rect x="22" y="178" width="40" height="40" fill="#FFFFFF"/>',
        '<rect x="30" y="186" width="24" height="24" fill="#0F4F3D"/>',
        // 中间品牌 dot
        '<circle cx="120" cy="120" r="22" fill="#0F4F3D"/>',
        '<circle cx="120" cy="120" r="8" fill="#B85C2E"/>',
        // 像素噪点装饰
        '<rect x="80" y="14" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="98" y="14" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="116" y="14" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="134" y="14" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="152" y="14" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="80" y="32" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="116" y="32" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="152" y="32" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="80" y="50" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="98" y="50" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="134" y="50" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="152" y="50" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="14" y="80" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="32" y="80" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="50" y="80" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="80" y="80" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="170" y="80" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="200" y="80" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="218" y="80" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="14" y="98" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="50" y="98" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="170" y="98" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="200" y="98" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="14" y="116" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="32" y="116" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="50" y="116" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="80" y="116" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="170" y="116" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="218" y="116" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="14" y="134" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="50" y="134" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="170" y="134" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="200" y="134" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="218" y="134" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="14" y="152" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="32" y="152" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="50" y="152" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="80" y="152" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="170" y="152" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="200" y="152" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="218" y="152" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="80" y="170" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="98" y="170" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="116" y="170" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="134" y="170" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="152" y="170" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="80" y="188" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="116" y="188" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="152" y="188" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="80" y="206" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="98" y="206" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="134" y="206" width="8" height="8" fill="#0F4F3D"/>',
        '<rect x="152" y="206" width="8" height="8" fill="#0F4F3D"/>',
        '</svg>'
    ].join(''));

    function track(name, payload) {
        try { if (window.YDZX_TRACK) window.YDZX_TRACK.event(name, payload || {}); } catch (e) {}
    }

    function injectStyle() {
        if (document.getElementById('ydzx-wechat-cta-style')) return;
        var style = document.createElement('style');
        style.id = 'ydzx-wechat-cta-style';
        style.textContent = [
            '#ydzx-wechat-modal{position:fixed;inset:0;z-index:9998;background:rgba(26,26,26,0.65);backdrop-filter:blur(8px);display:none;align-items:center;justify-content:center;padding:20px;font-family:"Noto Sans SC",system-ui,sans-serif}',
            '#ydzx-wechat-modal.open{display:flex;animation:ydzxFadeIn .25s ease-out}',
            '@keyframes ydzxFadeIn{from{opacity:0}to{opacity:1}}',
            '#ydzx-wechat-modal .ywc-card{background:#FAF7F0;max-width:480px;width:100%;border-radius:8px;box-shadow:0 24px 60px rgba(0,0,0,0.25);max-height:92vh;overflow:auto;font-size:15px;color:#1A1A1A;line-height:1.7}',
            '#ydzx-wechat-modal .ywc-head{padding:24px 28px 16px;border-bottom:0.5px solid rgba(26,26,26,0.08)}',
            '#ydzx-wechat-modal .ywc-eyebrow{font-family:"Instrument Serif",serif;font-style:italic;font-size:13px;color:#0F4F3D;margin-bottom:8px;letter-spacing:0.01em}',
            '#ydzx-wechat-modal .ywc-title{font-family:"Noto Serif SC",serif;font-size:22px;font-weight:500;letter-spacing:0.02em;line-height:1.3;margin-bottom:6px}',
            '#ydzx-wechat-modal .ywc-sub{font-size:13px;color:#666;line-height:1.7}',
            '#ydzx-wechat-modal .ywc-close{position:absolute;top:18px;right:22px;width:32px;height:32px;border:none;background:transparent;font-size:22px;color:#8A8780;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center}',
            '#ydzx-wechat-modal .ywc-close:hover{color:#1A1A1A}',
            '#ydzx-wechat-modal .ywc-tabs{display:flex;gap:0;padding:0 28px;border-bottom:0.5px solid rgba(26,26,26,0.08)}',
            '#ydzx-wechat-modal .ywc-tab{flex:1;padding:14px 0;background:transparent;border:none;border-bottom:2px solid transparent;font:500 14px "Noto Sans SC",sans-serif;color:#8A8780;cursor:pointer;transition:all .15s}',
            '#ydzx-wechat-modal .ywc-tab.on{color:#0F4F3D;border-bottom-color:#0F4F3D}',
            '#ydzx-wechat-modal .ywc-tab:hover{color:#1A1A1A}',
            '#ydzx-wechat-modal .ywc-pane{padding:28px;display:none}',
            '#ydzx-wechat-modal .ywc-pane.on{display:block}',
            '#ydzx-wechat-modal .ywc-qr-wrap{text-align:center}',
            '#ydzx-wechat-modal .ywc-qr-img{width:200px;height:200px;margin:0 auto 18px;display:block;border:0.5px solid rgba(26,26,26,0.08);border-radius:6px;background:#fff;padding:8px}',
            '#ydzx-wechat-modal .ywc-qr-tip{font-size:13px;color:#666;line-height:1.85;margin-bottom:14px}',
            '#ydzx-wechat-modal .ywc-qr-id{display:inline-block;font-family:"Inter",monospace;font-size:13px;color:#1A1A1A;background:#F2EEE3;padding:6px 14px;border-radius:4px;letter-spacing:0.04em;cursor:pointer;font-weight:500}',
            '#ydzx-wechat-modal .ywc-qr-id:hover{background:#EAE6DC}',
            '#ydzx-wechat-modal .ywc-form label{display:block;font-size:12px;color:#666;margin-bottom:6px;font-weight:500}',
            '#ydzx-wechat-modal .ywc-form input,#ydzx-wechat-modal .ywc-form textarea{width:100%;padding:11px 14px;font-family:inherit;font-size:14px;border:0.5px solid rgba(26,26,26,0.16);border-radius:6px;background:#fff;color:#1A1A1A;margin-bottom:14px;-webkit-appearance:none}',
            '#ydzx-wechat-modal .ywc-form input:focus,#ydzx-wechat-modal .ywc-form textarea:focus{outline:none;border-color:#0F4F3D}',
            '#ydzx-wechat-modal .ywc-submit{width:100%;padding:14px;background:#0F4F3D;color:#FAF7F0;border:none;border-radius:4px;font:500 14px "Noto Sans SC",sans-serif;cursor:pointer;letter-spacing:0.04em;transition:background .15s}',
            '#ydzx-wechat-modal .ywc-submit:hover{background:#0A3D2E}',
            '#ydzx-wechat-modal .ywc-submit:disabled{background:#8A8780;cursor:not-allowed}',
            '#ydzx-wechat-modal .ywc-fineprint{font-size:11px;color:#8A8780;margin-top:12px;text-align:center;line-height:1.7}',
            '#ydzx-wechat-modal .ywc-fineprint b{color:#1A1A1A;font-weight:500}',
            '#ydzx-wechat-modal .ywc-success{display:none;padding:32px 28px;text-align:center}',
            '#ydzx-wechat-modal .ywc-success.on{display:block}',
            '#ydzx-wechat-modal .ywc-success-mark{width:48px;height:48px;border-radius:50%;background:#E8EFE9;color:#0F4F3D;font-size:22px;font-weight:500;line-height:48px;margin:0 auto 14px}',
            '#ydzx-wechat-modal .ywc-success h3{font-family:"Noto Serif SC",serif;font-size:20px;font-weight:500;margin-bottom:8px;color:#1A1A1A}',
            '#ydzx-wechat-modal .ywc-success p{font-size:13px;color:#666;line-height:1.85}'
        ].join('\n');
        document.head.appendChild(style);
    }

    function buildModal() {
        if (document.getElementById('ydzx-wechat-modal')) return;
        var html = [
            '<div class="ywc-card" id="ywc-card" role="dialog" aria-modal="true">',
            '  <button class="ywc-close" aria-label="关闭" id="ywc-close">×</button>',
            '  <div class="ywc-head">',
            '    <div class="ywc-eyebrow" id="ywc-eyebrow">[Connect.]</div>',
            '    <h2 class="ywc-title" id="ywc-title">加客服微信，1v1 帮你看孩子情况</h2>',
            '    <p class="ywc-sub" id="ywc-sub">不卖课先聊清楚是否合适。前 100 名锁早鸟价。</p>',
            '  </div>',
            '  <div class="ywc-tabs" role="tablist">',
            '    <button class="ywc-tab on" data-pane="qr" id="ywc-tab-qr" role="tab">扫码加微信</button>',
            '    <button class="ywc-tab" data-pane="phone" id="ywc-tab-phone" role="tab">留手机号</button>',
            '  </div>',
            '  <div class="ywc-pane on" id="ywc-pane-qr" role="tabpanel">',
            '    <div class="ywc-qr-wrap">',
            '      <img class="ywc-qr-img" alt="原点智学客服微信" src="' + WECHAT_QR_SVG + '" id="ywc-qr-img">',
            '      <p class="ywc-qr-tip">长按 / 截图保存上图二维码<br>用微信扫一扫添加客服</p>',
            '      <span class="ywc-qr-id" id="ywc-qr-id" title="点击复制">微信号 yuandian-zhixue</span>',
            '      <p class="ywc-fineprint">备注 <b>「咨询」</b> + 孩子年级，Zack 会优先回复</p>',
            '    </div>',
            '  </div>',
            '  <div class="ywc-pane" id="ywc-pane-phone" role="tabpanel">',
            '    <form class="ywc-form" id="ywc-form" novalidate>',
            '      <label for="ywc-name">称呼 *</label>',
            '      <input id="ywc-name" type="text" maxlength="20" required placeholder="方便我怎么称呼你">',
            '      <label for="ywc-phone">手机号 *</label>',
            '      <input id="ywc-phone" type="tel" inputmode="tel" pattern="1[3-9]\\d{9}" maxlength="11" required placeholder="11 位手机号 · 加微信用">',
            '      <label for="ywc-kid">孩子情况（选填）</label>',
            '      <input id="ywc-kid" type="text" maxlength="50" placeholder="如 初一男孩, 数学薄弱">',
            '      <button type="submit" class="ywc-submit" id="ywc-submit">提交 · 24h 内联系</button>',
            '      <p class="ywc-fineprint">数据仅用于本次咨询 · 30 天内不发任何广告短信</p>',
            '    </form>',
            '  </div>',
            '  <div class="ywc-success" id="ywc-success">',
            '    <div class="ywc-success-mark">✓</div>',
            '    <h3>已收到 · 24h 内联系</h3>',
            '    <p>Zack 会主动加你微信。<br>同时可以截图上一页二维码先加上。</p>',
            '  </div>',
            '</div>'
        ].join('');
        var modal = document.createElement('div');
        modal.id = 'ydzx-wechat-modal';
        modal.innerHTML = html;
        document.body.appendChild(modal);

        modal.addEventListener('click', function (e) {
            if (e.target === modal) close();
        });
        document.getElementById('ywc-close').addEventListener('click', close);

        var tabs = modal.querySelectorAll('.ywc-tab');
        tabs.forEach(function (t) {
            t.addEventListener('click', function () {
                var name = t.dataset.pane;
                tabs.forEach(function (x) { x.classList.toggle('on', x === t); });
                modal.querySelectorAll('.ywc-pane').forEach(function (p) {
                    p.classList.toggle('on', p.id === 'ywc-pane-' + name);
                });
                track('wechat_cta_tab_switch', { pane: name, channel: modal.dataset.channel });
            });
        });

        document.getElementById('ywc-qr-id').addEventListener('click', function () {
            try {
                navigator.clipboard.writeText('yuandian-zhixue');
                this.textContent = '已复制 · yuandian-zhixue';
                setTimeout(function () {
                    document.getElementById('ywc-qr-id').textContent = '微信号 yuandian-zhixue';
                }, 1800);
            } catch (e) {}
        });

        document.getElementById('ywc-form').addEventListener('submit', onSubmit);
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && modal.classList.contains('open')) close();
        });
    }

    function open(channel, customTitle, customSub) {
        injectStyle();
        buildModal();
        var modal = document.getElementById('ydzx-wechat-modal');
        modal.dataset.channel = channel;
        var titleEl = document.getElementById('ywc-title');
        var subEl = document.getElementById('ywc-sub');
        var label = customTitle || CHANNEL_LABEL[channel];
        if (label) titleEl.textContent = label;
        if (customSub) subEl.textContent = customSub;
        // reset state
        document.getElementById('ywc-success').classList.remove('on');
        document.querySelectorAll('.ywc-tab')[0].click();
        document.getElementById('ywc-form').reset();
        document.getElementById('ywc-submit').disabled = false;
        document.getElementById('ywc-submit').textContent = '提交 · 24h 内联系';

        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
        track('wechat_cta_open', { channel: channel });
    }

    function close() {
        var modal = document.getElementById('ydzx-wechat-modal');
        if (!modal) return;
        modal.classList.remove('open');
        document.body.style.overflow = '';
    }

    function onSubmit(e) {
        e.preventDefault();
        var name = document.getElementById('ywc-name').value.trim();
        var phone = document.getElementById('ywc-phone').value.trim();
        var kid = document.getElementById('ywc-kid').value.trim();
        var modal = document.getElementById('ydzx-wechat-modal');
        var channel = modal.dataset.channel || 'unknown';

        if (!/^1[3-9]\d{9}$/.test(phone)) {
            alert('请输入正确的 11 位手机号');
            return false;
        }
        if (/[<>{}()\\\/]|https?:|javascript:/i.test(name + kid)) {
            alert('含无效字符');
            return false;
        }

        var btn = document.getElementById('ywc-submit');
        btn.disabled = true;
        btn.textContent = '提交中...';

        var params = new URLSearchParams(window.location.search);
        var clean = function (s) { return String(s || '').replace(/[<>"'&\\`]/g, '').slice(0, 200); };
        var lead = {
            kind: 'wechat-cta',
            channel: channel,
            channel_label: CHANNEL_LABEL[channel] || channel,
            name: clean(name),
            phone: phone,
            kid: clean(kid),
            time: new Date().toISOString(),
            page: location.pathname + location.search,
            referrer: clean(document.referrer),
            utm_source: clean(params.get('utm_source')),
            utm_medium: clean(params.get('utm_medium')),
            utm_campaign: clean(params.get('utm_campaign'))
        };

        fetch('/api/lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(lead)
        }).catch(function () { /* swallow, we always show success */ })
            .finally(function () {
                try {
                    var leads = JSON.parse(localStorage.getItem('ydzx_leads') || '[]');
                    leads.push(lead);
                    localStorage.setItem('ydzx_leads', JSON.stringify(leads));
                } catch (e) {}
                document.querySelectorAll('.ywc-pane').forEach(function (p) { p.classList.remove('on'); });
                document.querySelector('.ywc-tabs').style.display = 'none';
                document.getElementById('ywc-success').classList.add('on');
                track('wechat_cta_phone_submit', { channel: channel });
            });
        return false;
    }

    /* 全局自动绑定 */
    function bind(scope) {
        scope = scope || document;
        scope.querySelectorAll('[data-wechat-cta]').forEach(function (el) {
            if (el.dataset.ywcBound) return;
            el.dataset.ywcBound = '1';
            el.addEventListener('click', function (e) {
                e.preventDefault();
                var channel = el.dataset.wechatCta || 'unknown';
                var customTitle = el.dataset.wechatTitle || '';
                var customSub = el.dataset.wechatSub || '';
                open(channel, customTitle, customSub);
            });
        });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { bind(); });
    } else {
        bind();
    }

    /* 暴露公开 API */
    window.YDZX_WECHAT_CTA = { open: open, close: close, bind: bind };
})();
