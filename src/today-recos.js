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
        var read = safeGet('ydzx_textbook_read', []) || [];
        if (!Array.isArray(read)) read = [];
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

    window.TodayRecos = { render: render, gather: gather, buildCards: buildCards };
})();
