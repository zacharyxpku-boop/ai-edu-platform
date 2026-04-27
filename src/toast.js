/**
 * /src/toast.js · 全局 toast + 字段错误标记
 *
 * 用法：
 *   <script src="/src/toast.js"></script>
 *   YdzxToast.show('请输入知识点', 'error');
 *   YdzxToast.flagField('keyword');           // 给 #keyword 所在 .form-group 加红边，input/change 时自动清除
 *   YdzxToast.confirm('真的删除？').then(ok => { if (ok) ... }); // 替代 window.confirm（非阻塞）
 *
 * kind: 'error' | 'success' | 'warn' | 'info'
 * 自动 CSS 注入（仅首次），堆叠多条不重叠，移动端顶部全宽。
 */
(function(){
    if (window.YdzxToast) return;

    var STYLE_ID = 'ydzx-toast-style';
    function injectStyles(){
        if (document.getElementById(STYLE_ID)) return;
        var css = ''
            + '.ydzx-toast-wrap{position:fixed;top:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none;max-width:calc(100vw - 40px)}'
            + '@media(max-width:480px){.ydzx-toast-wrap{left:12px;right:12px;top:12px;align-items:stretch}}'
            + '.ydzx-toast{background:#18181B;color:#fff;padding:12px 16px;border-radius:10px;font-size:13px;font-weight:600;box-shadow:0 12px 32px rgba(0,0,0,.18);display:flex;align-items:flex-start;gap:10px;pointer-events:auto;animation:ydzxToastIn .25s cubic-bezier(.2,.8,.2,1);max-width:380px;line-height:1.5;font-family:"Noto Sans SC",system-ui,sans-serif}'
            + '.ydzx-toast.error{background:#DC2626}'
            + '.ydzx-toast.success{background:#059669}'
            + '.ydzx-toast.warn{background:#F59E0B;color:#7C2D12}'
            + '.ydzx-toast.info{background:#0EA5E9}'
            + '.ydzx-toast .ydzx-toast-em{flex:0 0 auto;font-size:16px;line-height:1.2}'
            + '.ydzx-toast .ydzx-toast-msg{flex:1;min-width:0;word-break:break-word}'
            + '.ydzx-toast.fade{opacity:0;transform:translateX(20px);transition:opacity .25s,transform .25s}'
            + '@keyframes ydzxToastIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}'
            + '.ydzx-confirm-mask{position:fixed;inset:0;z-index:99998;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:20px;animation:ydzxToastIn .15s ease}'
            + '.ydzx-confirm{background:#fff;border-radius:14px;padding:22px 24px;max-width:380px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,.25);font-family:"Noto Sans SC",system-ui,sans-serif}'
            + '.ydzx-confirm-msg{font-size:14px;color:#18181B;line-height:1.65;margin-bottom:18px;font-weight:500}'
            + '.ydzx-confirm-btns{display:flex;gap:8px;justify-content:flex-end}'
            + '.ydzx-confirm-btns button{padding:8px 16px;border-radius:7px;border:none;cursor:pointer;font-family:inherit;font-size:13px;font-weight:700}'
            + '.ydzx-confirm-btns .y-no{background:#F4F4F5;color:#3F3F46}'
            + '.ydzx-confirm-btns .y-yes{background:#18181B;color:#fff}'
            + '.ydzx-confirm-btns .y-yes.danger{background:#DC2626}'
            // form field error
            + '.form-group.has-error select,.form-group.has-error input,.form-group.has-error textarea,.has-error select,.has-error input,.has-error textarea{border-color:#DC2626 !important;background:#FEF2F2 !important}';
        var s = document.createElement('style');
        s.id = STYLE_ID; s.textContent = css;
        document.head.appendChild(s);
    }

    function ensureWrap(){
        var w = document.getElementById('ydzx-toast-wrap');
        if (!w){
            w = document.createElement('div');
            w.id = 'ydzx-toast-wrap';
            w.className = 'ydzx-toast-wrap';
            document.body.appendChild(w);
        }
        return w;
    }

    function show(msg, kind, ttl){
        injectStyles();
        kind = kind || 'info';
        ttl = ttl || (kind === 'error' ? 4500 : 2800);
        var wrap = ensureWrap();
        var em = { error:'⚠', success:'✓', warn:'!', info:'ⓘ' }[kind] || 'ⓘ';
        var t = document.createElement('div');
        t.className = 'ydzx-toast ' + kind;
        t.innerHTML = '<span class="ydzx-toast-em"></span><span class="ydzx-toast-msg"></span>';
        t.querySelector('.ydzx-toast-em').textContent = em;
        t.querySelector('.ydzx-toast-msg').textContent = msg;
        wrap.appendChild(t);
        setTimeout(function(){
            t.classList.add('fade');
            setTimeout(function(){ if (t.parentNode) t.remove(); }, 280);
        }, ttl);
        return t;
    }

    function flagField(idOrEl){
        injectStyles();
        var el = (typeof idOrEl === 'string') ? document.getElementById(idOrEl) : idOrEl;
        if (!el) return;
        var grp = el.closest && (el.closest('.form-group') || el.closest('label') || el.parentElement);
        if (!grp) return;
        grp.classList.add('has-error');
        var clear = function(){ grp.classList.remove('has-error'); el.removeEventListener('change', clear); el.removeEventListener('input', clear); };
        el.addEventListener('change', clear);
        el.addEventListener('input', clear);
        try { el.focus(); } catch(_){}
    }

    function confirm(msg, opts){
        injectStyles();
        opts = opts || {};
        return new Promise(function(resolve){
            var mask = document.createElement('div');
            mask.className = 'ydzx-confirm-mask';
            mask.innerHTML = '<div class="ydzx-confirm">'
                + '<div class="ydzx-confirm-msg"></div>'
                + '<div class="ydzx-confirm-btns">'
                + '<button class="y-no"></button>'
                + '<button class="y-yes' + (opts.danger ? ' danger' : '') + '"></button>'
                + '</div></div>';
            mask.querySelector('.ydzx-confirm-msg').textContent = msg;
            mask.querySelector('.y-no').textContent = opts.cancelText || '取消';
            mask.querySelector('.y-yes').textContent = opts.confirmText || '确定';
            document.body.appendChild(mask);
            function close(v){ if (mask.parentNode) mask.remove(); resolve(v); }
            mask.querySelector('.y-no').addEventListener('click', function(){ close(false); });
            mask.querySelector('.y-yes').addEventListener('click', function(){ close(true); });
            mask.addEventListener('click', function(e){ if (e.target === mask) close(false); });
        });
    }

    window.YdzxToast = { show: show, flagField: flagField, confirm: confirm };
})();
