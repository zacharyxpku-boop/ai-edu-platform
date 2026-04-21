/* ==========================================================================
   原点智学 — 通用 Lead 弹窗 (v1)
   --------------------------------------------------------------------------
   用法：
     1) 在任意 .html 里引入： <script src="/src/lead-modal.js" defer></script>
     2) 给按钮加 data-lead-kind 属性，例如：
        <button data-lead-kind="newsletter">订阅每周更新</button>
        <button data-lead-kind="camp" data-lead-title="少年营预约">立即咨询</button>
     3) 点击时自动弹模态框 → 收集姓名/手机/备注 → POST /api/lead
        → localStorage 备份一份到 ydzx_leads

   可选 data-* 属性：
     data-lead-kind        必填。membership / newsletter / camp / contact / notify
     data-lead-title       弹窗大标题，缺省按 kind 映射
     data-lead-sub         弹窗副标题
     data-lead-tier-label  tier 徽标文字（membership 专用）
     data-lead-tier        tier 隐藏值

   只需引入一次，重复调用会跳过。
   ========================================================================== */

(function () {
    'use strict';
    if (window.__ydzxLeadModal) return;
    window.__ydzxLeadModal = true;

    var KIND_DEFAULTS = {
        membership: { badge:'会员', title:'预约会员 1v1 沟通', sub:'留个联系方式，Zack 24 小时内主动加你。' },
        newsletter: { badge:'每周更新', title:'订阅「原点家长周刊」', sub:'每周一封，家庭 AI 学习最新方法 + 工具评测，随时退订。' },
        camp:       { badge:'少年营',   title:'预约少年营咨询',     sub:'留下手机号，助教会先了解孩子情况，再推荐合适批次。' },
        contact:    { badge:'咨询',     title:'联系原点团队',       sub:'我们看到留言后 24 小时内回复。' },
        notify:     { badge:'上线通知', title:'上线后第一时间通知你', sub:'新工具 / 新产品上线时主动告诉你，不发广告。' }
    };

    function h(tag, attrs, children) {
        var el = document.createElement(tag);
        if (attrs) Object.keys(attrs).forEach(function(k){
            if (k === 'style') el.style.cssText = attrs[k];
            else if (k === 'html') el.innerHTML = attrs[k];
            else el.setAttribute(k, attrs[k]);
        });
        (children||[]).forEach(function(c){ if(c) el.appendChild(c); });
        return el;
    }

    function safeGet(key, fb){ try { return localStorage.getItem(key); } catch(e){ return fb; } }
    function safeSet(key, val){ try { localStorage.setItem(key, val); } catch(e){} }

    var modalEl = null;
    function buildModal() {
        if (modalEl) return modalEl;
        var wrap = h('div', { id:'ydzx-lead-modal', style:'display:none;position:fixed;inset:0;z-index:9999;background:rgba(24,24,27,.72);backdrop-filter:blur(6px);align-items:center;justify-content:center;padding:20px' });
        wrap.innerHTML = ''
            + '<div style="background:#fff;border-radius:14px;max-width:420px;width:100%;padding:28px 24px;box-shadow:0 24px 60px rgba(0,0,0,.25);font-family:\'Noto Sans SC\',system-ui,sans-serif;color:#18181B">'
            +   '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">'
            +     '<div id="ydz-lm-badge" style="font-size:11px;font-weight:700;color:#F5A623;letter-spacing:.5px">会员</div>'
            +     '<button id="ydz-lm-close" style="border:none;background:transparent;font-size:22px;color:#A1A1AA;cursor:pointer;line-height:1;padding:0">×</button>'
            +   '</div>'
            +   '<h3 id="ydz-lm-title" style="font-size:20px;font-weight:900;margin-bottom:6px">联系原点</h3>'
            +   '<p id="ydz-lm-sub" style="font-size:12px;color:#71717A;margin-bottom:18px">我们看到留言后 24 小时内回复。</p>'
            +   '<form id="ydz-lm-form">'
            +     '<label style="font-size:12px;color:#3F3F46;display:block;margin-bottom:4px">称呼 *</label>'
            +     '<input id="ydz-lm-name" required maxlength="20" placeholder="方便我怎么称呼你" style="width:100%;padding:10px 12px;border:1px solid #E4E4E7;border-radius:8px;font-size:14px;font-family:inherit;margin-bottom:12px">'
            +     '<label style="font-size:12px;color:#3F3F46;display:block;margin-bottom:4px">手机号 *</label>'
            +     '<input id="ydz-lm-phone" required pattern="1[3-9]\\d{9}" maxlength="11" inputmode="tel" placeholder="11 位手机号" style="width:100%;padding:10px 12px;border:1px solid #E4E4E7;border-radius:8px;font-size:14px;font-family:inherit;margin-bottom:12px">'
            +     '<label style="font-size:12px;color:#3F3F46;display:block;margin-bottom:4px" id="ydz-lm-note-label">备注（选填）</label>'
            +     '<input id="ydz-lm-note" maxlength="80" placeholder="例如 初一男孩，数学薄弱" style="width:100%;padding:10px 12px;border:1px solid #E4E4E7;border-radius:8px;font-size:14px;font-family:inherit;margin-bottom:16px">'
            +     '<button type="submit" id="ydz-lm-submit" style="width:100%;padding:12px;border:none;background:#C2410C;color:#fff;font-size:14px;font-weight:700;border-radius:8px;cursor:pointer;font-family:inherit">提交</button>'
            +   '</form>'
            +   '<p style="font-size:11px;color:#A1A1AA;margin-top:10px;text-align:center">不方便留号？邮箱：business@yuandianzhixue.com</p>'
            + '</div>';
        document.body.appendChild(wrap);
        modalEl = wrap;

        wrap.querySelector('#ydz-lm-close').addEventListener('click', close);
        wrap.addEventListener('click', function(e){ if (e.target === wrap) close(); });
        wrap.querySelector('#ydz-lm-form').addEventListener('submit', submit);
        document.addEventListener('keydown', function(e){
            if (e.key === 'Escape' && wrap.style.display === 'flex') close();
        });
        return wrap;
    }

    var currentCtx = null;

    function open(ctx) {
        currentCtx = ctx || {};
        buildModal();
        var def = KIND_DEFAULTS[ctx.kind] || KIND_DEFAULTS.contact;
        modalEl.querySelector('#ydz-lm-badge').textContent = ctx.tierLabel || def.badge;
        modalEl.querySelector('#ydz-lm-title').textContent = ctx.title || def.title;
        modalEl.querySelector('#ydz-lm-sub').textContent = ctx.sub || def.sub;
        // newsletter 场景：备注字段改成「关心的主题」
        if (ctx.kind === 'newsletter') {
            modalEl.querySelector('#ydz-lm-note-label').textContent = '关心的话题（选填）';
            modalEl.querySelector('#ydz-lm-note').placeholder = '例如 Prompt 训练 / 防投毒 / 错题管理';
        } else if (ctx.kind === 'camp') {
            modalEl.querySelector('#ydz-lm-note-label').textContent = '孩子年龄 / 年级（选填）';
            modalEl.querySelector('#ydz-lm-note').placeholder = '例如 五年级';
        } else {
            modalEl.querySelector('#ydz-lm-note-label').textContent = '备注（选填）';
            modalEl.querySelector('#ydz-lm-note').placeholder = '例如 初一男孩，数学薄弱';
        }
        modalEl.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        setTimeout(function(){
            var n = modalEl.querySelector('#ydz-lm-name');
            if (n) n.focus();
        }, 80);
    }

    function close() {
        if (!modalEl) return;
        modalEl.style.display = 'none';
        document.body.style.overflow = '';
        var btn = modalEl.querySelector('#ydz-lm-submit');
        if (btn) { btn.disabled = false; btn.textContent = '提交'; btn.style.background = '#C2410C'; }
        var form = modalEl.querySelector('#ydz-lm-form');
        if (form) form.reset();
    }

    function clean(s){ return String(s||'').replace(/[<>"'&\\`]/g,'').substring(0,200); }

    function submit(e) {
        e.preventDefault();
        var name = modalEl.querySelector('#ydz-lm-name').value.trim();
        var phone = modalEl.querySelector('#ydz-lm-phone').value.trim();
        var note = modalEl.querySelector('#ydz-lm-note').value.trim();
        if (!/^1[3-9]\d{9}$/.test(phone)) { alert('请输入正确的 11 位手机号'); return; }
        if (/https?:|javascript:/i.test(name + note)) { alert('含无效字符'); return; }

        var btn = modalEl.querySelector('#ydz-lm-submit');
        btn.disabled = true; btn.textContent = '提交中…';

        var params = new URLSearchParams(window.location.search);
        var ctx = currentCtx || {};
        var lead = {
            kind: ctx.kind || 'contact',
            tier: ctx.tier || '',
            tier_label: ctx.tierLabel || '',
            name: clean(name),
            phone: phone,
            kid: clean(note),
            age_or_kid: clean(note),
            time: new Date().toISOString(),
            page: location.pathname,
            referrer: clean(document.referrer),
            utm_source: clean(params.get('utm_source')),
            utm_medium: clean(params.get('utm_medium')),
            utm_campaign: clean(params.get('utm_campaign'))
        };

        fetch('/api/lead', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify(lead)
        }).catch(function(){}).finally(function(){
            try {
                var arr = JSON.parse(safeGet('ydzx_leads','[]') || '[]');
                arr.push(lead);
                safeSet('ydzx_leads', JSON.stringify(arr));
            } catch(e){}
            btn.textContent = '✓ 已收到，24h 内回你';
            btn.style.background = '#2D9F6F';
            setTimeout(close, 2200);
        });
    }

    // 自动绑定 [data-lead-kind]
    function bindAll() {
        var nodes = document.querySelectorAll('[data-lead-kind]:not([data-lead-bound])');
        for (var i=0; i<nodes.length; i++) {
            (function(el){
                el.setAttribute('data-lead-bound','1');
                el.addEventListener('click', function(ev){
                    ev.preventDefault();
                    open({
                        kind:      el.getAttribute('data-lead-kind'),
                        title:     el.getAttribute('data-lead-title'),
                        sub:       el.getAttribute('data-lead-sub'),
                        tier:      el.getAttribute('data-lead-tier'),
                        tierLabel: el.getAttribute('data-lead-tier-label')
                    });
                });
            })(nodes[i]);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindAll);
    } else {
        bindAll();
    }

    // 暴露给手动调用
    window.YdzxLead = { open: open, close: close, bindAll: bindAll };
})();
