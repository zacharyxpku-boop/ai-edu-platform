/**
 * 原点智学 分享卡生成工具
 * 用法:
 *   YdzxShare.open({
 *       source: 'exam-generator',            // 必填 工具标识
 *       title: '今天用原点AI给娃出了一份',     // 必填 一句话
 *       subtitle: '初二 数学 周测 · 20题',    // 必填 二级文案
 *       metrics: [                            // 可选 3-4 个数字亮点
 *           { label: '题量', value: '20' },
 *           { label: '覆盖章节', value: '4' },
 *           { label: '难度', value: '中等' }
 *       ],
 *       quote: '老师说选题和重点完全对上了' // 可选 用户感言
 *   });
 *
 * 依赖: 需要页面引入 html2canvas
 *   <script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
 */
(function(global){
    'use strict';

    var BRAND = {
        bg: '#FAFAF7',
        card: '#FFFFFF',
        ink: '#18181B',
        ink2: '#3F3F46',
        ink3: '#71717A',
        amber: '#F5A623',
        amberBg: '#FFFBF0',
        cta: '#C2410C',
        bdr: '#E4E4E7'
    };

    // 预设工具映射（个性化默认文案）
    var PRESETS = {
        'exam-generator':   { emoji:'📝', verb:'出了一份卷子' },
        'essay-grading':    { emoji:'✍️', verb:'批了篇作文' },
        'study-plan':       { emoji:'📅', verb:'排了一份学习计划' },
        'scoring-breakdown':{ emoji:'📊', verb:'拆了提分空间' },
        'exam-diagnosis':   { emoji:'🔍', verb:'诊断了一次考试' },
        'error-mastery':    { emoji:'🎯', verb:'攻克了错题' },
        'error-practice':   { emoji:'🧩', verb:'刷了一轮错题变式' },
        'note-enhancer':    { emoji:'📖', verb:'扩写了一份笔记' },
        'knowledge-explain':{ emoji:'💡', verb:'讲懂了一个知识点' },
        'knowledge-visual': { emoji:'🗺️', verb:'画出了知识地图' },
        'feynman-verify':   { emoji:'🧠', verb:'验证了真懂没懂' },
        'reading-rewriter': { emoji:'📚', verb:'改写了段阅读材料' },
        'music-appreciation':{emoji:'🎵', verb:'听懂了一首乐曲' },
        'art-thinking':     { emoji:'🎨', verb:'看懂了一幅画' },
        'learning-profile': { emoji:'📈', verb:'生成了能力画像' },
        'knowledge-arcade': { emoji:'🎮', verb:'玩了知识街机' },
        'progress':         { emoji:'🔥', verb:'坚持学习的战绩' }
    };

    function buildURL(source) {
        // progress 特殊：回到首页而非 tools/progress.html（档案走根路径）
        if (source === 'progress') {
            return 'https://www.yuandianzhixue.com/progress.html?utm_source=share&utm_medium=png&utm_campaign=progress';
        }
        return 'https://www.yuandianzhixue.com/tools/' + source + '.html?utm_source=share&utm_medium=png&utm_campaign=' + source;
    }

    function ensureHtml2Canvas(cb) {
        if (typeof html2canvas === 'function') { cb(); return; }
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
        s.onload = cb;
        s.onerror = function(){ alert('分享模块加载失败，请检查网络'); };
        document.head.appendChild(s);
    }

    function buildCard(opts) {
        var preset = PRESETS[opts.source] || { emoji:'✨', verb:'用了一下原点AI' };
        var shareUrl = opts.url || buildURL(opts.source);

        var metricsHtml = '';
        if (opts.metrics && opts.metrics.length) {
            metricsHtml = '<div style="display:flex;gap:12px;margin:20px 0 0;flex-wrap:wrap">' +
                opts.metrics.slice(0, 4).map(function(m){
                    return '<div style="flex:1;min-width:70px;background:'+BRAND.amberBg+';border-radius:10px;padding:14px 10px;text-align:center">' +
                        '<div style="font-size:22px;font-weight:900;color:'+BRAND.cta+';line-height:1">'+m.value+'</div>' +
                        '<div style="font-size:11px;color:'+BRAND.ink3+';margin-top:4px">'+m.label+'</div>' +
                    '</div>';
                }).join('') +
            '</div>';
        }

        var quoteHtml = opts.quote ?
            '<div style="margin-top:20px;padding:14px 16px;background:'+BRAND.bg+';border-left:3px solid '+BRAND.amber+';border-radius:4px;font-size:13px;color:'+BRAND.ink2+';line-height:1.7;font-style:italic">“'+opts.quote+'”</div>'
            : '';

        // 竖版 1080x1920 卡
        return '<div id="ydzx-share-card" style="position:fixed;left:-9999px;top:0;width:540px;height:960px;background:'+BRAND.bg+';font-family:\'Noto Sans SC\',system-ui,sans-serif;padding:44px 36px;box-sizing:border-box;color:'+BRAND.ink+'">' +
            // 顶部品牌
            '<div style="display:flex;align-items:center;gap:10px;margin-bottom:36px">' +
                '<div style="width:36px;height:36px;border-radius:50%;background:'+BRAND.ink+';display:flex;align-items:center;justify-content:center;color:'+BRAND.amber+';font-weight:900;font-size:18px">◉</div>' +
                '<div style="font-weight:900;font-size:16px;letter-spacing:.5px">原点智学</div>' +
                '<div style="flex:1;text-align:right;font-size:11px;color:'+BRAND.ink3+';letter-spacing:.5px">AI 时代家庭教育</div>' +
            '</div>' +
            // 主卡
            '<div style="background:'+BRAND.card+';border-radius:16px;padding:32px 28px;box-shadow:0 10px 40px rgba(0,0,0,.06);border:1px solid '+BRAND.bdr+'">' +
                '<div style="font-size:44px;line-height:1;margin-bottom:16px">'+preset.emoji+'</div>' +
                '<div style="font-size:22px;font-weight:900;line-height:1.4;color:'+BRAND.ink+';margin-bottom:10px">'+escapeHtml(opts.title)+'</div>' +
                '<div style="font-size:14px;color:'+BRAND.ink2+';line-height:1.7">'+escapeHtml(opts.subtitle||'')+'</div>' +
                metricsHtml +
                quoteHtml +
            '</div>' +
            // 底部 CTA
            '<div style="position:absolute;bottom:44px;left:36px;right:36px;display:flex;align-items:center;gap:14px">' +
                '<div style="flex:1">' +
                    '<div style="font-size:12px;color:'+BRAND.ink3+';margin-bottom:4px">免费体验同款工具</div>' +
                    '<div style="font-size:14px;font-weight:700;color:'+BRAND.cta+';word-break:break-all;line-height:1.4">yuandianzhixue.com</div>' +
                '</div>' +
                '<div style="width:86px;height:86px;background:'+BRAND.ink+';border-radius:10px;display:flex;align-items:center;justify-content:center;color:'+BRAND.amber+';font-size:11px;text-align:center;line-height:1.4;font-weight:700;padding:6px">扫码<br>直达</div>' +
            '</div>' +
        '</div>';
    }

    function escapeHtml(s) {
        return String(s||'').replace(/[&<>"']/g, function(c){
            return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
        });
    }

    function showModal(imgDataUrl, opts) {
        // 移除旧的
        var old = document.getElementById('ydzx-share-modal');
        if (old) old.remove();

        var shareText = opts.title + ' — ' + (opts.subtitle||'') + '\n原点智学 yuandianzhixue.com';
        var shareUrl = opts.url || buildURL(opts.source);
        var modal = document.createElement('div');
        modal.id = 'ydzx-share-modal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(24,24,27,.82);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;animation:ydzxFade .2s';
        modal.innerHTML =
            '<style>@keyframes ydzxFade{from{opacity:0}to{opacity:1}}</style>' +
            '<div style="background:#fff;border-radius:14px;max-width:400px;width:100%;padding:22px;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,.3);max-height:90vh;overflow:auto">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">' +
                    '<strong style="font-size:15px;color:'+BRAND.ink+'">分享给朋友</strong>' +
                    '<button onclick="document.getElementById(\'ydzx-share-modal\').remove()" style="border:none;background:transparent;font-size:22px;color:#A1A1AA;cursor:pointer;line-height:1">×</button>' +
                '</div>' +
                '<img src="'+imgDataUrl+'" style="width:100%;max-width:270px;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.15);margin-bottom:16px">' +
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">' +
                    '<button id="ydzx-share-dl" style="padding:11px;border:none;background:'+BRAND.cta+';color:#fff;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit">📷 保存图片</button>' +
                    '<button id="ydzx-share-native" style="padding:11px;border:1px solid '+BRAND.bdr+';background:#fff;color:'+BRAND.ink+';border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit">🔗 系统分享</button>' +
                '</div>' +
                '<button id="ydzx-share-copy" style="width:100%;padding:10px;border:1px solid '+BRAND.bdr+';background:#fff;color:'+BRAND.ink2+';border-radius:8px;font-size:12px;cursor:pointer;font-family:inherit">复制链接</button>' +
                '<div style="font-size:11px;color:'+BRAND.ink3+';margin-top:12px;line-height:1.6">保存图片到朋友圈/小红书，或用系统分享直发微信群</div>' +
            '</div>';
        document.body.appendChild(modal);
        modal.addEventListener('click', function(e){ if (e.target===modal) modal.remove(); });

        document.getElementById('ydzx-share-dl').onclick = function(){
            var a = document.createElement('a');
            a.href = imgDataUrl;
            a.download = '原点智学_'+opts.source+'_'+Date.now()+'.png';
            a.click();
        };
        document.getElementById('ydzx-share-copy').onclick = function(){
            if (navigator.clipboard) {
                navigator.clipboard.writeText(shareText+'\n'+shareUrl);
                this.textContent = '✓ 已复制';
                var self = this;
                setTimeout(function(){ self.textContent='复制链接'; }, 1600);
            }
        };
        document.getElementById('ydzx-share-native').onclick = function(){
            if (navigator.share) {
                fetch(imgDataUrl).then(function(r){return r.blob();}).then(function(blob){
                    var file = new File([blob], 'ydzx.png', {type:'image/png'});
                    if (navigator.canShare && navigator.canShare({files:[file]})) {
                        navigator.share({ title:'原点智学', text:shareText, url:shareUrl, files:[file] });
                    } else {
                        navigator.share({ title:'原点智学', text:shareText, url:shareUrl });
                    }
                });
            } else {
                alert('当前浏览器不支持系统分享，请点「保存图片」自行分享');
            }
        };
    }

    function open(opts) {
        if (!opts || !opts.source || !opts.title) {
            console.warn('YdzxShare.open 需要 source 和 title');
            return;
        }
        ensureHtml2Canvas(function(){
            var cardHtml = buildCard(opts);
            var holder = document.createElement('div');
            holder.innerHTML = cardHtml;
            document.body.appendChild(holder);
            var node = document.getElementById('ydzx-share-card');
            html2canvas(node, { backgroundColor: BRAND.bg, scale: 2, logging: false, useCORS: true }).then(function(canvas){
                var dataUrl = canvas.toDataURL('image/png');
                holder.remove();
                showModal(dataUrl, opts);
            }).catch(function(err){
                holder.remove();
                console.error(err);
                alert('生成分享图失败，稍后再试');
            });
        });
    }

    global.YdzxShare = { open: open, buildURL: buildURL };

})(window);
