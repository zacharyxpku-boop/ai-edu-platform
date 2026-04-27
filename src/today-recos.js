/**
 * /src/today-recos.js · 共享推荐引擎
 *
 * 用法：
 *   <script src="/src/learning-store.js"></script>
 *   <script src="/src/gamification.js"></script>
 *   <script src="/src/today-recos.js"></script>
 *   <div id="my-recos"></div>
 *   <script>
 *   window.addEventListener('DOMContentLoaded', function(){
 *     window.TodayRecos.render(document.getElementById('my-recos'));
 *   });
 *   </script>
 *
 * 数据源：
 *   - LearningStore.getErrors()  → 错题池（dueOnly / reviewCount<3 / 全量）
 *   - localStorage('ydzx_textbook_read')  → 已读章节列表
 *   - GAME.getLog() reason 字段  → 题库速练 / 费曼 / 错题攻克 计数
 *
 * 推荐规则按优先级降序，最多挑前 3。规则改进时只动这一份文件。
 */
(function(){
    var STYLE_INJECTED = false;
    function injectStyles(){
        if (STYLE_INJECTED) return;
        STYLE_INJECTED = true;
        var css = ''
            + '.tr-card{background:#fff;border:1px solid #E4E4E7;border-radius:12px;padding:14px 16px;display:flex;gap:12px;align-items:flex-start;text-decoration:none;color:inherit;transition:all .15s;border-left-width:4px}'
            + '.tr-card:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(0,0,0,.06);border-color:#A1A1AA}'
            + '.tr-card.urgent{border-left-color:#DC2626}'
            + '.tr-card.warm{border-left-color:#F5A623}'
            + '.tr-card.cool{border-left-color:#0EA5E9}'
            + '.tr-card.green{border-left-color:#059669}'
            + '.tr-card.violet{border-left-color:#7C3AED}'
            + '.tr-em{font-size:24px;line-height:1;flex:0 0 auto}'
            + '.tr-bd{flex:1;min-width:0}'
            + '.tr-h{font-size:13px;font-weight:800;color:#18181B;margin-bottom:3px;line-height:1.4}'
            + '.tr-d{font-size:11.5px;color:#52525B;line-height:1.5;margin-bottom:6px}'
            + '.tr-d b{color:#18181B;font-weight:800}'
            + '.tr-cta{font-size:11px;font-weight:700;color:#F5A623}'
            + '.tr-cta::after{content:" →"}';
        var s = document.createElement('style');
        s.id = 'today-recos-style';
        s.textContent = css;
        document.head.appendChild(s);
    }

    function safeGet(k, dflt){
        try { return JSON.parse(localStorage.getItem(k) || (dflt!=null?JSON.stringify(dflt):'null')); }
        catch(e){ return dflt; }
    }

    function gather(){
        var errs = (window.LearningStore && window.LearningStore.getErrors) ? (window.LearningStore.getErrors() || []) : [];
        var dueErrs = errs.filter(function(e){
            return (e.nextReviewAt||0) <= Date.now() && (e.reviewCount||0) < 3;
        });
        // ydzx_textbook_read 兼容两种写法: 老的 Array<sig> 与新的 Object<sig:ts>
        var rawRead = safeGet('ydzx_textbook_read', null);
        var readN = 0;
        if (Array.isArray(rawRead)) readN = rawRead.length;
        else if (rawRead && typeof rawRead === 'object') readN = Object.keys(rawRead).length;
        var read = { length: readN };   // 占位仅供 readN 引用
        var log = (window.GAME && window.GAME.getLog) ? (window.GAME.getLog() || []) : [];
        var arcadeN = 0, feynmanN = 0, errorActN = 0;
        log.forEach(function(e){
            if (e.type !== 'xp' || !e.reason) return;
            var r = e.reason;
            if (r.indexOf('题库速练') >= 0) arcadeN++;
            else if (r.indexOf('费曼') >= 0) feynmanN++;
            else if (r.indexOf('错题攻克') >= 0) errorActN++;
        });
        return {
            errsAll: errs.length,
            errsDue: dueErrs.length,
            readN: read.length,
            arcadeN: arcadeN,
            feynmanN: feynmanN,
            errorActN: errorActN
        };
    }

    function buildCards(stats, opts){
        opts = opts || {};
        var cards = [];

        // prio 100：到期错题需复盘
        if (stats.errsDue > 0){
            cards.push({
                cls: 'urgent', em: '🔥', priority: 100,
                h: '先复习 ' + stats.errsDue + ' 道到期错题',
                d: '错过的题不复盘，下次还会错。<b>FSRS 间隔到期</b>，正是窗口。',
                cta: '进入复习模式', href: '/errors.html'
            });
        }

        // prio 90：读了不少但完全没练
        if (stats.readN >= 3 && stats.arcadeN === 0){
            cards.push({
                cls: 'warm', em: '✏️', priority: 90,
                h: '读了 ' + stats.readN + ' 章，没练过一道题',
                d: '输入和输出之间需要桥梁。<b>挑一章先刷 3 道</b>验证理解。',
                cta: '随机来一道', href: '/quiz.html'
            });
        }

        // prio 80：完全空白账号 → 演示模式
        if (stats.readN === 0 && stats.arcadeN === 0 && stats.errsAll === 0 && stats.feynmanN === 0){
            cards.push({
                cls: 'violet', em: '⚡', priority: 80,
                h: '空白账号 · 30 秒看产品满载',
                d: '一键注入示例数据，看 progress / errors / quiz 长什么样。<b>不用真的学一遍</b>。',
                cta: '进入演示', href: '/demo.html'
            });
        }

        // prio 70：动作够多但从没费曼
        if ((stats.errorActN >= 3 || stats.arcadeN >= 5) && stats.feynmanN === 0){
            cards.push({
                cls: 'cool', em: '🗣️', priority: 70,
                h: '从来没讲一遍课',
                d: '费曼一次胜十题。把刚学的章节<b>用人话讲给一个不懂的人</b>。',
                cta: '去讲一段', href: '/tools/feynman-verify'
            });
        }

        // prio 60：做了题但没读教材
        if (stats.readN === 0 && stats.arcadeN > 0){
            cards.push({
                cls: 'green', em: '📖', priority: 60,
                h: '光做题没读教材',
                d: '题是知识的引子，<b>一章原文比 5 道题更扎实</b>。',
                cta: '挑一本翻翻', href: '/tools/textbook-browser'
            });
        }

        // prio 50 (回访期，少量动作但没积压)：连续刷题日活提示
        if (stats.arcadeN >= 5 && stats.errsDue === 0 && stats.errsAll > 0){
            cards.push({
                cls: 'green', em: '🌳', priority: 50,
                h: '错题都在间隔期 · 状态不错',
                d: '连续保持答题节奏 · <b>趁势挑战一道难题</b>。',
                cta: '随机抽一题', href: '/quiz.html'
            });
        }

        // 兜底：无任何匹配 → 三张默认 starter
        if (!cards.length){
            cards.push({
                cls: 'warm', em: '📝', priority: 50,
                h: '今日打卡',
                d: '随机一道挂教材的题，做完点对错 <b>就有数据画 progress</b>。',
                cta: '抽一道', href: '/quiz.html'
            });
            cards.push({
                cls: 'cool', em: '📊', priority: 40,
                h: '看四维体检',
                d: '读 / 练 / 错 / 讲，哪一维最弱一目了然。',
                cta: '打开档案', href: '/progress.html'
            });
            cards.push({
                cls: 'green', em: '📖', priority: 30,
                h: '翻一章教材',
                d: '56 本人教/统编 OCR 全章正文，自带反链题。',
                cta: '挑一本', href: '/tools/textbook-browser'
            });
        }

        cards.sort(function(a, b){ return b.priority - a.priority; });
        var max = opts.max || 3;
        return cards.slice(0, max);
    }

    function render(target, opts){
        if (!target) return;
        injectStyles();
        var cards = buildCards(gather(), opts);
        var html = cards.map(function(c){
            return '<a class="tr-card ' + c.cls + '" href="' + c.href + '">'
                + '<div class="tr-em">' + c.em + '</div>'
                + '<div class="tr-bd">'
                + '<div class="tr-h">' + c.h + '</div>'
                + '<div class="tr-d">' + c.d + '</div>'
                + '<div class="tr-cta">' + c.cta + '</div>'
                + '</div>'
                + '</a>';
        }).join('');
        target.innerHTML = html;
        return cards.length;
    }

    // ------- KA "Up next" banner: 跨学科版的最高优一张大卡 -------
    // 用与 subject-hub 同口径的 4 档优先级, 但跨全学科, 适合首页 / paths / errors 顶部使用
    function injectBannerStyle(){
        if (document.getElementById('today-recos-banner-style')) return;
        var css = ''
            + '.tr-banner{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center;padding:16px 18px;border-radius:14px;margin:8px 0 14px;font-family:inherit}'
            + '.tr-banner.lvl-A{background:#FEF2F2;border:1px solid #FCA5A5}'
            + '.tr-banner.lvl-B{background:#EFF6FF;border:1px solid #93C5FD}'
            + '.tr-banner.lvl-C{background:#FFFBEB;border:1px solid #FCD34D}'
            + '.tr-banner.lvl-D{background:#F0FDF4;border:1px solid #86EFAC}'
            + '.tr-banner .em{font-size:30px;line-height:1;flex-shrink:0}'
            + '.tr-banner .bd{min-width:0}'
            + '.tr-banner .tag{font-size:10px;letter-spacing:.6px;font-weight:800;text-transform:uppercase;margin-bottom:4px;opacity:.7}'
            + '.tr-banner.lvl-A .tag{color:#991B1B}.tr-banner.lvl-B .tag{color:#1D4ED8}.tr-banner.lvl-C .tag{color:#92400E}.tr-banner.lvl-D .tag{color:#15803D}'
            + '.tr-banner .t{font-size:15px;font-weight:800;color:#18181B;letter-spacing:-.005em;margin-bottom:3px}'
            + '.tr-banner .s{font-size:12px;color:#52525B}'
            + '.tr-banner .go{padding:9px 18px;background:#18181B;color:#fff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700;white-space:nowrap;transition:.15s}'
            + '.tr-banner .go:hover{background:#000;transform:translateY(-1px)}'
            + '@media(max-width:560px){.tr-banner{grid-template-columns:auto 1fr}.tr-banner .go{grid-column:1/-1;text-align:center}}';
        var s = document.createElement('style'); s.id='today-recos-banner-style'; s.textContent=css;
        document.head.appendChild(s);
    }

    function pickUpNext(){
        var stats = gather();
        var name = '';
        try { name = localStorage.getItem('yd:my_name') || ''; } catch(e){}

        // A: 错题到期 优先
        var errs = (window.LearningStore && window.LearningStore.getErrors) ? (window.LearningStore.getErrors() || []) : [];
        var dueErrs = errs.filter(function(e){
            return (e.nextReviewAt||0) <= Date.now() && (e.reviewCount||0) < 3;
        });
        if (dueErrs.length > 0) {
            var subj = dueErrs[0].subject || '';
            return {
                lvl: 'A', em: '📕', tag: '错题到期',
                t: (subj ? '先把这道' + subj + '错题攻克' : '先把今日到期错题攻克'),
                s: dueErrs.length + ' 道到期 · 不补就给同学送分',
                href: '/errors.html'
            };
        }

        // B: 学生年级 → 学科首页里挑一个推 (走 subject 主页, hub 内自己再挑章节)
        var grade = '';
        try { grade = localStorage.getItem('yd:my_grade') || ''; } catch(e){}
        var subjects = ['math','physics','chemistry','chinese','biology','history','geography','politics'];
        if (grade) {
            // 简单轮转: 用日期挑一个学科, 避免天天看到一样
            var idx = (new Date().getDate()) % subjects.length;
            var subj = subjects[idx];
            return {
                lvl: 'B', em: '📖', tag: '为你定制',
                t: (name ? name + '，' : '') + '该回学科页看下一章了',
                s: '基于你的年级与读书记录智能挑下一步',
                href: '/subjects/' + subj + '.html'
            };
        }

        // C: 教材广度 — 还没读够 5 章, 推 path
        if (stats.readN < 5) {
            return {
                lvl: 'C', em: '📚', tag: '建立基线',
                t: '还没读够 5 章 · 先挑一本教材打地基',
                s: '已读 ' + stats.readN + ' 章 · 5 章是 mastery 起步线',
                href: '/paths.html'
            };
        }

        // D: 兜底 - 来道每日一题
        return {
            lvl: 'D', em: '🎯', tag: '今日一道',
            t: '保持手感 · 来一道每日一题',
            s: '3 分钟一道, 含解析, 错了进错题本',
            href: '/quiz.html'
        };
    }

    function renderUpNextBanner(target){
        var node = typeof target === 'string' ? document.querySelector(target) : target;
        if (!node) return null;
        injectBannerStyle();
        var p = pickUpNext();
        node.className = 'tr-banner lvl-' + p.lvl;
        node.innerHTML = ''
            + '<div class="em">' + p.em + '</div>'
            + '<div class="bd">'
            +   '<div class="tag">' + p.tag + '</div>'
            +   '<div class="t">' + p.t + '</div>'
            +   '<div class="s">' + p.s + '</div>'
            + '</div>'
            + '<a class="go" href="' + p.href + '">开始 →</a>';
        return p;
    }

    window.TodayRecos = {
        render: render,
        gather: gather,
        buildCards: buildCards,
        pickUpNext: pickUpNext,
        renderUpNextBanner: renderUpNextBanner
    };
})();
