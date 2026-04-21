/* ===== 原点智学 · 游戏化引擎 v1 =====
 * 全站共享的 XP / 等级 / 连续打卡 / 徽章系统
 *
 * 用法：
 *   GAME.addXP(30, '费曼验证 · 铜级');   // 加分 + 自动检查升级 + 自动触发 Toast
 *   GAME.pingToday();                    // 标记今日活跃，维护 streak
 *   GAME.unlockBadge('first_diagnosis'); // 解锁徽章（重复解锁无效）
 *   GAME.getProfile();                   // { xp, level, levelName, streak, streakBest, todayXP, badges, history }
 *   GAME.getBadgeById('first_diagnosis') // 徽章元数据
 *   GAME.getAllBadges();                 // 所有徽章（含 unlocked 状态）
 *   GAME.recordAction({ source, type, meta });  // 纯日志（progress.html 用）
 */
(function () {
    'use strict';

    var K = {
        PROFILE: 'ydzx_game_profile_v1',
        LOG: 'ydzx_game_log_v1'
    };

    // 等级门槛：累计 XP ≥ 该值即进阶
    var LEVELS = [
        { lv: 1, xp: 0,    name: '初入门径', emoji: '🌱' },
        { lv: 2, xp: 100,  name: '勤学弟子', emoji: '📘' },
        { lv: 3, xp: 260,  name: '举一反三', emoji: '🧩' },
        { lv: 4, xp: 500,  name: '融会贯通', emoji: '🔍' },
        { lv: 5, xp: 900,  name: '格物致知', emoji: '🧠' },
        { lv: 6, xp: 1500, name: '博闻强识', emoji: '📚' },
        { lv: 7, xp: 2400, name: '明辨慎思', emoji: '🦉' },
        { lv: 8, xp: 3600, name: '学以致用', emoji: '⚙️' },
        { lv: 9, xp: 5200, name: '登堂入室', emoji: '🎓' },
        { lv: 10, xp: 7500, name: '原点宗师', emoji: '🏛️' }
    ];

    // 徽章库（id 固定不变，改名/改图也不影响已有用户数据）
    var BADGES = [
        { id: 'first_diagnosis',    name: '首诊达成',    emoji: '📊', hint: '完成一次考试诊断' },
        { id: 'diagnosis_streak_3', name: '月考信徒',    emoji: '📈', hint: '做过 3 次考试诊断' },
        { id: 'feynman_bronze',     name: '铜口才',      emoji: '🥉', hint: '费曼验证拿到铜级' },
        { id: 'feynman_silver',     name: '银讲师',      emoji: '🥈', hint: '费曼验证拿到银级' },
        { id: 'feynman_gold',       name: '金嗓子',      emoji: '🥇', hint: '费曼验证拿到金级' },
        { id: 'error_sweeper_10',   name: '错题清道夫',  emoji: '🧹', hint: '攻克 10 道错题' },
        { id: 'error_sweeper_50',   name: '错题粉碎机',  emoji: '💥', hint: '攻克 50 道错题' },
        { id: 'streak_3',           name: '三日连读',    emoji: '🔥', hint: '连续 3 天使用原点' },
        { id: 'streak_7',           name: '一周坚持',    emoji: '🔥🔥', hint: '连续 7 天使用原点' },
        { id: 'streak_30',          name: '月度铁粉',    emoji: '🌟', hint: '连续 30 天使用原点' },
        { id: 'arcade_centurion',   name: '游乐场百分',  emoji: '🎮', hint: '游乐场单局 100 分' },
        { id: 'knowledge_cartographer', name: '知识地图师', emoji: '🗺️', hint: '生成一张知识可视化图' },
        { id: 'essay_polisher',     name: '作文工匠',    emoji: '✍️', hint: '作文打分得 85+ 分' },
        { id: 'all_five_tools',     name: '五件套',      emoji: '🎯', hint: '一天内用过 5 件不同工具' },
        { id: 'ai_whisperer',       name: 'AI 细语者',   emoji: '🔮', hint: 'BYOK 配置成功自己的 API Key' }
    ];

    function safeGet(k, fallback) {
        try {
            var s = localStorage.getItem(k);
            return s ? JSON.parse(s) : (fallback || null);
        } catch (e) { return fallback || null; }
    }
    function safeSet(k, v) {
        try { localStorage.setItem(k, JSON.stringify(v)); return true; }
        catch (e) { console.warn('gamification safeSet 失败', e); return false; }
    }
    function dayKey(ts) {
        var d = new Date(ts || Date.now());
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function daysBetween(a, b) {
        var da = new Date(a), db = new Date(b);
        return Math.floor((db - da) / 86400000);
    }

    function defaultProfile() {
        return {
            xp: 0,
            totalXpEver: 0,
            streak: 0,
            streakBest: 0,
            lastActiveDay: null,
            badges: [],            // [{id, ts}]
            daily: {},             // { "2026-04-21": {xp: 30, actions: 4, tools: ["feynman", ...]} }
            createdAt: Date.now()
        };
    }

    function getProfile() {
        var p = safeGet(K.PROFILE, null);
        if (!p) { p = defaultProfile(); safeSet(K.PROFILE, p); }
        // 补字段（老用户）
        if (p.totalXpEver == null) p.totalXpEver = p.xp || 0;
        if (!p.daily) p.daily = {};
        return p;
    }

    function computeLevel(xp) {
        var cur = LEVELS[0];
        for (var i = 0; i < LEVELS.length; i++) {
            if (xp >= LEVELS[i].xp) cur = LEVELS[i];
            else break;
        }
        var next = LEVELS.find(function (l) { return l.xp > xp; }) || null;
        return {
            lv: cur.lv, name: cur.name, emoji: cur.emoji,
            curLevelXp: cur.xp,
            nextLevelXp: next ? next.xp : null,
            nextName: next ? next.name : null,
            progress: next ? Math.round((xp - cur.xp) / (next.xp - cur.xp) * 100) : 100
        };
    }

    function pushLog(entry) {
        var log = safeGet(K.LOG, []) || [];
        entry.ts = Date.now();
        log.push(entry);
        if (log.length > 500) log = log.slice(-500);
        safeSet(K.LOG, log);
    }

    // 今日计数 & streak 维护
    function pingToday(toolName) {
        var p = getProfile();
        var today = dayKey();
        if (!p.daily[today]) p.daily[today] = { xp: 0, actions: 0, tools: [] };
        if (toolName && p.daily[today].tools.indexOf(toolName) === -1) {
            p.daily[today].tools.push(toolName);
        }
        // streak
        if (p.lastActiveDay !== today) {
            if (p.lastActiveDay) {
                var gap = daysBetween(p.lastActiveDay, today);
                if (gap === 1) p.streak = (p.streak || 0) + 1;
                else if (gap > 1) p.streak = 1; // 断签重置
            } else {
                p.streak = 1;
            }
            if (p.streak > (p.streakBest || 0)) p.streakBest = p.streak;
            p.lastActiveDay = today;
            // streak 徽章自动解锁
            if (p.streak >= 3)  innerUnlock(p, 'streak_3');
            if (p.streak >= 7)  innerUnlock(p, 'streak_7');
            if (p.streak >= 30) innerUnlock(p, 'streak_30');
        }
        safeSet(K.PROFILE, p);
        return p;
    }

    function innerUnlock(p, id) {
        var has = p.badges.find(function (b) { return b.id === id; });
        if (has) return false;
        p.badges.push({ id: id, ts: Date.now() });
        return true;
    }

    function unlockBadge(id) {
        var meta = BADGES.find(function (b) { return b.id === id; });
        if (!meta) { console.warn('未知徽章', id); return false; }
        var p = getProfile();
        var unlocked = innerUnlock(p, id);
        safeSet(K.PROFILE, p);
        if (unlocked) {
            pushLog({ type: 'badge', id: id, name: meta.name });
            showToast('🏅 解锁徽章「' + meta.name + '」 ' + meta.emoji, 'badge');
        }
        return unlocked;
    }

    function addXP(amount, reason) {
        amount = Math.max(0, Math.round(amount || 0));
        if (!amount) return null;
        var p = getProfile();
        var beforeLv = computeLevel(p.xp).lv;
        p.xp += amount;
        p.totalXpEver += amount;
        var today = dayKey();
        if (!p.daily[today]) p.daily[today] = { xp: 0, actions: 0, tools: [] };
        p.daily[today].xp += amount;
        p.daily[today].actions += 1;
        safeSet(K.PROFILE, p);
        var afterLv = computeLevel(p.xp).lv;

        pushLog({ type: 'xp', amount: amount, reason: reason || '', total: p.xp });
        showToast('+' + amount + ' XP · ' + (reason || '加油'), 'xp');

        if (afterLv > beforeLv) {
            var newLv = LEVELS[afterLv - 1];
            showToast('🎉 升级到 LV.' + newLv.lv + ' 「' + newLv.name + '」', 'levelup', 4200);
            pushLog({ type: 'levelup', toLv: newLv.lv, name: newLv.name });
        }
        return { xp: p.xp, level: computeLevel(p.xp) };
    }

    function recordAction(info) {
        pushLog({ type: 'action', source: info.source || '', action: info.type || '', meta: info.meta || null });
    }

    // ---------- Toast ----------
    var toastQueue = [];
    var toastShowing = false;
    function showToast(text, kind, duration) {
        toastQueue.push({ text: text, kind: kind || 'xp', duration: duration || 2600 });
        if (!toastShowing) drainToast();
    }
    function drainToast() {
        var t = toastQueue.shift();
        if (!t) { toastShowing = false; return; }
        toastShowing = true;
        var el = document.createElement('div');
        el.className = 'ydzx-game-toast ' + t.kind;
        el.textContent = t.text;
        ensureToastStyle();
        document.body.appendChild(el);
        requestAnimationFrame(function () { el.classList.add('show'); });
        setTimeout(function () {
            el.classList.remove('show');
            setTimeout(function () { el.remove(); drainToast(); }, 320);
        }, t.duration);
    }
    function ensureToastStyle() {
        if (document.getElementById('ydzx-game-toast-style')) return;
        var s = document.createElement('style');
        s.id = 'ydzx-game-toast-style';
        s.textContent =
            '.ydzx-game-toast{position:fixed;top:84px;right:20px;z-index:9998;padding:12px 18px;background:#fff;border:1px solid #E8E5DE;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);font:600 14px/1.4 "Noto Sans SC",system-ui,sans-serif;color:#1C1C1E;opacity:0;transform:translateX(20px);transition:all .3s ease;max-width:280px;pointer-events:none}' +
            '.ydzx-game-toast.show{opacity:1;transform:translateX(0)}' +
            '.ydzx-game-toast.xp{border-left:4px solid #F5A623}' +
            '.ydzx-game-toast.badge{border-left:4px solid #8B5CF6;background:#FAF5FF}' +
            '.ydzx-game-toast.levelup{border-left:4px solid #059669;background:#ECFDF5;font-weight:700;font-size:15px}' +
            '@media (max-width:600px){.ydzx-game-toast{top:auto;bottom:96px;right:12px;left:12px;max-width:none}}';
        document.head.appendChild(s);
    }

    function getAllBadges() {
        var p = getProfile();
        var unlocked = {};
        (p.badges || []).forEach(function (b) { unlocked[b.id] = b.ts; });
        return BADGES.map(function (b) {
            return Object.assign({}, b, {
                unlocked: !!unlocked[b.id],
                unlockedAt: unlocked[b.id] || null
            });
        });
    }

    function getBadgeById(id) {
        return BADGES.find(function (b) { return b.id === id; }) || null;
    }

    function getLog() {
        return safeGet(K.LOG, []) || [];
    }

    // Daily 任务（基础 3 条，完成即加分）
    // 本周（过去 7 天，含今天）聚合
    function getWeekStats() {
        var p = getProfile();
        var now = new Date();
        var xpSum = 0, actionSum = 0;
        var toolSet = {};
        var days = [];
        for (var i = 6; i >= 0; i--) {
            var d = new Date(now.getTime() - i*86400000);
            var k = dayKey(d.getTime());
            var dd = p.daily[k] || { xp: 0, actions: 0, tools: [] };
            xpSum += (dd.xp || 0);
            actionSum += (dd.actions || 0);
            (dd.tools || []).forEach(function(t){ toolSet[t] = true; });
            days.push({ day: k, xp: dd.xp || 0, actions: dd.actions || 0, tools: (dd.tools||[]).length });
        }
        var flashReviewed = 0;
        try {
            var log = safeGet(K.LOG, []) || [];
            var cutoff = Date.now() - 7*86400000;
            log.forEach(function(e){
                if (e.ts >= cutoff && typeof e.reason === 'string' && /闪卡|复习|FSRS/.test(e.reason)) flashReviewed++;
            });
        } catch (e) {}
        return {
            xp: xpSum,
            actions: actionSum,
            toolDiversity: Object.keys(toolSet).length,
            tools: Object.keys(toolSet),
            days: days,
            flashReviewed: flashReviewed
        };
    }

    function getWeeklyQuests() {
        var w = getWeekStats();
        return [
            {
                id: 'w_earn_500xp',
                name: '本周累计获得 500 XP',
                current: w.xp,
                target: 500,
                progress: Math.min(100, Math.round(w.xp / 500 * 100)),
                done: w.xp >= 500,
                reward: 50
            },
            {
                id: 'w_five_tools',
                name: '本周使用 5 件不同工具',
                current: w.toolDiversity,
                target: 5,
                progress: Math.min(100, Math.round(w.toolDiversity / 5 * 100)),
                done: w.toolDiversity >= 5,
                reward: 40
            },
            {
                id: 'w_flash_30',
                name: '本周复习闪卡 30 次',
                current: w.flashReviewed,
                target: 30,
                progress: Math.min(100, Math.round(w.flashReviewed / 30 * 100)),
                done: w.flashReviewed >= 30,
                reward: 60
            }
        ];
    }

    function getDailyQuests() {
        var p = getProfile();
        var today = dayKey();
        var d = p.daily[today] || { xp: 0, actions: 0, tools: [] };
        var quests = [
            {
                id: 'q_use_one_tool',
                name: '今日首次打开任何工具',
                done: (d.tools || []).length >= 1,
                reward: 5
            },
            {
                id: 'q_earn_30xp',
                name: '今日累计获得 30 XP',
                progress: Math.min(100, Math.round((d.xp || 0) / 30 * 100)),
                done: (d.xp || 0) >= 30,
                reward: 10
            },
            {
                id: 'q_three_tools',
                name: '今日使用 3 件不同工具',
                progress: Math.min(100, Math.round((d.tools || []).length / 3 * 100)),
                done: (d.tools || []).length >= 3,
                reward: 15
            }
        ];
        // 五件套徽章
        if ((d.tools || []).length >= 5) unlockBadge('all_five_tools');
        return quests;
    }

    // 排行榜：仅本地（等后端同步再做云端）
    function getProfile_forShare() {
        var p = getProfile();
        var lv = computeLevel(p.xp);
        return {
            level: lv.lv, levelName: lv.name, emoji: lv.emoji,
            xp: p.xp, streak: p.streak || 0, streakBest: p.streakBest || 0,
            badgesCount: (p.badges || []).length,
            totalBadges: BADGES.length,
            levelFloor: lv.curLevelXp,
            levelCap: lv.nextLevelXp || lv.curLevelXp,
            progress: lv.progress
        };
    }

    window.GAME = {
        addXP: addXP,
        pingToday: pingToday,
        unlockBadge: unlockBadge,
        getProfile: function () {
            var p = getProfile();
            var lv = computeLevel(p.xp);
            return Object.assign({}, p, { levelInfo: lv });
        },
        getAllBadges: getAllBadges,
        getBadgeById: getBadgeById,
        getDailyQuests: getDailyQuests,
        getWeeklyQuests: getWeeklyQuests,
        getWeekStats: getWeekStats,
        getLog: getLog,
        recordAction: recordAction,
        getSummary: getProfile_forShare,
        LEVELS: LEVELS,
        BADGES: BADGES
    };
})();
