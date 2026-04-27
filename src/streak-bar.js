/**
 * streak-bar.js · KA-style 顶部 streak 条
 *
 * 一行说服:
 *   连续 N 天 + 今日 X 个动作 + 本周已学 Y 章
 *   = retention 仪式感(Khan Academy 学到的 #1 信号)
 *
 * 用法:
 *   <div id="streak-mount"></div>
 *   <script src="/src/streak-bar.js"></script>
 *   <script>STREAK_BAR.mount('#streak-mount');</script>
 *
 * 数据源(全本地, 不依赖 GAME 模块也能跑):
 *   - localStorage.ydzx_game_profile_v1 (gamification.js 写的)
 *       { streak, streakBest, lastActiveDay, daily: { '2026-04-26': {xp,actions,tools} } }
 *   - localStorage.ydzx_textbook_read    (教材阅读器写的, set 形式 {sig: ts})
 *   - localStorage.ydzx_quiz_outcome_v1  (quiz.html 写的, {id: {r,d,book,ch,subj}})
 */
(function (global) {
  'use strict';

  const PROFILE_KEY = 'ydzx_game_profile_v1';
  const READ_KEY    = 'ydzx_textbook_read';
  const OUT_KEY     = 'ydzx_quiz_outcome_v1';

  function safeGet(k, dflt) {
    try { return JSON.parse(localStorage.getItem(k) || (dflt != null ? JSON.stringify(dflt) : 'null')); }
    catch (e) { return dflt; }
  }
  function dayKey(ts) {
    const d = new Date(ts || Date.now());
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function daysBetween(a, b) {
    const da = new Date(a), db = new Date(b);
    return Math.floor((db - da) / 86400000);
  }
  function startOfWeek() {
    // 周一为一周开始(中国语境)
    const d = new Date();
    const day = d.getDay();              // 0=Sun, 1=Mon, ...
    const offset = day === 0 ? 6 : day - 1;
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - offset);
    return d.getTime();
  }

  // ---------- 计算指标 ----------
  function computeStats() {
    const p = safeGet(PROFILE_KEY, null) || {};
    const today = dayKey();
    const todayBucket = (p.daily && p.daily[today]) || { xp: 0, actions: 0, tools: [] };

    // streak: 严格按 lastActiveDay 校验, 跨天断签自动归零(显示用)
    let streak = p.streak || 0;
    if (p.lastActiveDay) {
      const gap = daysBetween(p.lastActiveDay, today);
      if (gap > 1) streak = 0;          // 已经断了, 但 ydzx_game_profile_v1 里仍是旧值
    } else {
      streak = 0;
    }

    // 今日已读章节(去重)
    const read = safeGet(READ_KEY, {}) || {};
    const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
    let chToday = 0;
    Object.values(read).forEach(ts => { if (typeof ts === 'number' && ts >= todayMidnight.getTime()) chToday++; });

    // 本周已读章节(去重)
    const weekStart = startOfWeek();
    let chWeek = 0;
    Object.values(read).forEach(ts => { if (typeof ts === 'number' && ts >= weekStart) chWeek++; });

    // 今日做题数 / 正确率
    const out = safeGet(OUT_KEY, {}) || {};
    let qToday = 0, qRight = 0;
    Object.values(out).forEach(o => {
      if (o && o.d === today) {
        qToday++;
        if (o.r === 'right' || o.r === 'correct') qRight++;
      }
    });

    return {
      streak: streak,
      streakBest: p.streakBest || 0,
      todayActions: todayBucket.actions || 0,
      todayXP: todayBucket.xp || 0,
      chToday: chToday,
      chWeek: chWeek,
      qToday: qToday,
      qAcc: qToday > 0 ? Math.round(qRight / qToday * 100) : null
    };
  }

  // ---------- 鼓励文案 ----------
  function flameLevel(streak) {
    if (streak >= 30) return { emoji: '🌟', tone: '铁粉', cls: 't3' };
    if (streak >= 7)  return { emoji: '🔥🔥', tone: '一周', cls: 't2' };
    if (streak >= 3)  return { emoji: '🔥', tone: '热身', cls: 't1' };
    if (streak >= 1)  return { emoji: '✨', tone: '今天', cls: 't0' };
    return { emoji: '💤', tone: '断签', cls: 't0' };
  }
  function pep(s) {
    if (s.streak >= 30) return '一个月没断过, 这就是「认真」二字最贵的样子';
    if (s.streak >= 7)  return '已经连续一周, 大脑开始相信「我是会学习的人」';
    if (s.streak >= 3)  return '连续 ' + s.streak + ' 天, 习惯回路已经搭起来一半';
    if (s.streak >= 1)  return '今天来了就赢了, 明天再来一次就开始连击';
    return '断签不重要, 现在就是下一次连击的第 1 天';
  }

  function fmtTodayLine(s) {
    const parts = [];
    if (s.chToday > 0) parts.push('读 ' + s.chToday + ' 章');
    if (s.qToday > 0) {
      parts.push('做 ' + s.qToday + ' 题' + (s.qAcc != null ? ' · ' + s.qAcc + '% 对' : ''));
    }
    if (s.todayActions > 0) parts.push('+' + s.todayXP + ' XP');
    if (parts.length === 0) return '今天还没动 · 推荐: 翻 1 章教材或做 1 道每日一题';
    return '今天 · ' + parts.join(' · ');
  }

  // ---------- 渲染 ----------
  function ensureStyle() {
    if (document.getElementById('ydzx-streak-style')) return;
    const css = `
.ydzx-streak{
  display:flex;align-items:center;gap:14px;
  background:linear-gradient(95deg,#FFF7ED 0%,#FEF3C7 60%,#FFFBEB 100%);
  border:1px solid #FCD34D;border-radius:14px;
  padding:14px 18px;margin:14px 0 4px;
  font-family:inherit;
  box-shadow:0 1px 0 rgba(255,255,255,.6) inset, 0 4px 14px -8px rgba(217,119,6,.35);
}
.ydzx-streak .flame{
  font-size:30px;line-height:1;flex-shrink:0;
  filter:drop-shadow(0 2px 4px rgba(217,119,6,.25));
}
.ydzx-streak .grow{flex:1;min-width:0}
.ydzx-streak .row1{
  display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;
  font-weight:800;color:#78350F;letter-spacing:-0.01em;
}
.ydzx-streak .row1 .num{font-size:24px;color:#B45309;font-variant-numeric:tabular-nums}
.ydzx-streak .row1 .lbl{font-size:14px}
.ydzx-streak .row1 .pep{font-weight:500;color:#92400E;font-size:13px;margin-left:auto}
.ydzx-streak .row2{
  font-size:12px;color:#78350F;margin-top:4px;
  display:flex;gap:10px;flex-wrap:wrap;align-items:center;
  font-variant-numeric:tabular-nums;
}
.ydzx-streak .row2 .sep{color:#D97706;opacity:.5}
.ydzx-streak .row2 .week{color:#B45309;font-weight:700}
.ydzx-streak.t0{background:linear-gradient(95deg,#F4F4F5 0%,#FAFAF9 100%);border-color:#E4E4E7}
.ydzx-streak.t0 .row1{color:#52525B}
.ydzx-streak.t0 .row1 .num{color:#3F3F46}
.ydzx-streak.t0 .row1 .pep,.ydzx-streak.t0 .row2{color:#71717A}
.ydzx-streak.t0 .row2 .sep,.ydzx-streak.t0 .row2 .week{color:#71717A}
@media (max-width:520px){
  .ydzx-streak{padding:12px 14px;gap:10px}
  .ydzx-streak .flame{font-size:24px}
  .ydzx-streak .row1 .num{font-size:20px}
  .ydzx-streak .row1 .pep{display:none}
}
    `.trim();
    const el = document.createElement('style');
    el.id = 'ydzx-streak-style';
    el.textContent = css;
    document.head.appendChild(el);
  }

  function render(mount, opts) {
    opts = opts || {};
    const s = computeStats();
    const flame = flameLevel(s.streak);
    const lineToday = fmtTodayLine(s);
    const weekTxt = s.chWeek > 0 ? '本周 ' + s.chWeek + ' 章' : '本周还没读';
    const bestTxt = s.streakBest > s.streak ? '历史最高 ' + s.streakBest + ' 天' : null;

    const html = `
      <div class="flame">${flame.emoji}</div>
      <div class="grow">
        <div class="row1">
          <span class="num">${s.streak}</span><span class="lbl">天连续学习</span>
          <span class="pep">${pep(s)}</span>
        </div>
        <div class="row2">
          <span>${lineToday}</span>
          <span class="sep">·</span>
          <span class="week">${weekTxt}</span>
          ${bestTxt ? `<span class="sep">·</span><span>${bestTxt}</span>` : ''}
        </div>
      </div>
    `;

    const node = typeof mount === 'string' ? document.querySelector(mount) : mount;
    if (!node) return null;
    node.className = 'ydzx-streak ' + flame.cls + (opts.className ? ' ' + opts.className : '');
    node.innerHTML = html;
    return s;
  }

  function mount(selector, opts) {
    ensureStyle();
    return render(selector, opts);
  }

  global.STREAK_BAR = {
    mount: mount,
    computeStats: computeStats
  };
})(window);
