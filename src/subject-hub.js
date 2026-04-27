/**
 * subject-hub.js · 学科枢纽页共享渲染引擎
 *
 * KA "Math course / Physics course" 中文化版本的数据合流层。每个 /subjects/<key>.html
 * 只需提供主题 config(中文学科名 + 英文 key + 主色 + sigil + 工具链 query)，本脚本统一处理:
 *   1. manifest 拉取 + 按学段/年级排序
 *   2. 已读章节 / 错题章节 / 做题成败的本地状态合流
 *   3. 圆环 mastery + meta + 教材列 + 错题切片 + 智能 CTA 渲染
 *
 * 用法:
 *   <script src="/src/learning-store.js"></script>
 *   <script src="/src/subject-hub.js"></script>
 *   <script>SUBJECT_HUB.init({ subjectZh:'物理', subjectKey:'physics', toolQuery:'physics' });</script>
 *
 * 期望 DOM 节点(id):
 *   m-books / m-ch / m-read / m-err / m-mas
 *   ring-fg / ring-n
 *   cta-continue / cta-cont-t / cta-cont-s / cta-err-s
 *   book-list / err-mount
 *
 * 期望 CSS class 已在宿主页内: book-card / err-row / err-empty 等
 */
(function (global) {
  'use strict';

  const RING_CIRC = 226.2;   // 2*pi*36

  const GRADE_ORDER = [
    '七年级','八年级','九年级',
    '必修','必修1','必修2','必修3','必修4','必修第一册','必修第二册',
    '第一册','第二册',
    '选择性必修','选择性必修1','选择性必修2','选择性必修3'
  ];

  function $(id) { return document.getElementById(id); }
  function safeGet(k, dflt) {
    try { return JSON.parse(localStorage.getItem(k) || (dflt != null ? JSON.stringify(dflt) : 'null')); }
    catch (e) { return dflt; }
  }
  function escHtml(s) {
    return String(s || '').replace(/[<>&"']/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' }[c]));
  }
  function gradeRank(g) { const i = GRADE_ORDER.indexOf(g); return i < 0 ? 99 : i; }

  async function fetchManifest() {
    const r = await fetch('/data/extracted/manifest.json', { cache: 'force-cache' });
    return r.json();
  }

  async function init(cfg) {
    cfg = cfg || {};
    const SUBJECT_ZH  = cfg.subjectZh  || '数学';
    const SUBJECT_KEY = cfg.subjectKey || 'math';
    const TOOL_QUERY  = cfg.toolQuery  || SUBJECT_KEY;

    let manifest;
    try { manifest = await fetchManifest(); }
    catch (e) {
      const list = $('book-list');
      if (list) list.innerHTML = '<div style="color:#DC2626;font-size:13px;padding:12px">manifest 加载失败 · ' + escHtml(e.message || e) + '</div>';
      return;
    }

    const books = (manifest.books || [])
      .filter(b => b.subject === SUBJECT_ZH)
      .sort((a, b) => {
        const sa = a.stage === '初中' ? 0 : (a.stage === '高中' ? 1 : 2);
        const sb = b.stage === '初中' ? 0 : (b.stage === '高中' ? 1 : 2);
        if (sa !== sb) return sa - sb;
        const ga = gradeRank(a.grade), gb = gradeRank(b.grade);
        if (ga !== gb) return ga - gb;
        return (a.volume || '').localeCompare(b.volume || '');
      });

    // ----- 本地状态聚合 -----
    const read = safeGet('ydzx_textbook_read', {}) || {};
    const readSig = new Set(Object.keys(read));
    const outcomes = safeGet('ydzx_quiz_outcome_v1', {}) || {};

    const allErrs = (global.LearningStore && global.LearningStore.getErrors)
      ? (global.LearningStore.getErrors() || []) : [];
    const subjErrs = allErrs.filter(e => e.subject === SUBJECT_ZH || e.subject === SUBJECT_KEY);
    const errCount = {};
    subjErrs.forEach(e => {
      if ((e.reviewCount || 0) >= 3) return;
      if (!e.textbookRef || !e.textbookRef.path || e.textbookRef.ch == null) return;
      const sig = e.textbookRef.path + '::ch' + e.textbookRef.ch;
      errCount[sig] = (errCount[sig] || 0) + 1;
    });

    const chPx = {};
    Object.values(outcomes).forEach(o => {
      if (!o || !o.book || o.ch == null) return;
      if (o.subj && !(o.subj === SUBJECT_KEY || o.subj === SUBJECT_ZH)) return;
      const sig = o.book + '::ch' + o.ch;
      if (!chPx[sig]) chPx[sig] = { good: 0, bad: 0 };
      if (o.r === 'right' || o.r === 'correct') chPx[sig].good++;
      else if (o.r === 'wrong' || o.r === 'incorrect') chPx[sig].bad++;
    });

    // ----- 总分母 + mastery -----
    let totalCh = 0, readCh = 0, masteredCh = 0;
    books.forEach(b => {
      (b.chapters || []).forEach(c => {
        totalCh++;
        const sig = b.path + '::ch' + c.ch;
        if (readSig.has(sig)) readCh++;
        const px = chPx[sig];
        if (readSig.has(sig) && px && px.good >= 2 && px.good >= px.bad * 2) masteredCh++;
      });
    });
    const errChCount = Object.keys(errCount).length;

    if ($('m-books')) $('m-books').textContent = books.length;
    if ($('m-ch'))    $('m-ch').textContent    = totalCh;
    if ($('m-read'))  $('m-read').textContent  = readCh;
    if ($('m-err'))   $('m-err').textContent   = errChCount;
    if ($('m-mas'))   $('m-mas').textContent   = masteredCh;

    const pct = totalCh > 0 ? Math.round(masteredCh / totalCh * 100) : 0;
    if ($('ring-n'))  $('ring-n').textContent  = pct + '%';
    if ($('ring-fg')) $('ring-fg').setAttribute('stroke-dashoffset', String(RING_CIRC * (1 - pct / 100)));

    const due = subjErrs.filter(e => (e.reviewCount || 0) < 3);
    if ($('cta-err-s')) $('cta-err-s').textContent = due.length + ' 道待复习';

    // ----- 教材卡列表 -----
    const list = $('book-list');
    if (list) {
      if (!books.length) {
        list.innerHTML = '<div style="color:#71717A;font-size:13px;padding:12px">manifest 暂无 ' + escHtml(SUBJECT_ZH) + ' 教材</div>';
      } else {
        list.innerHTML = books.map(b => {
          const chs = b.chapters || [];
          const rN = chs.reduce((a, c) => a + (readSig.has(b.path + '::ch' + c.ch) ? 1 : 0), 0);
          const eN = chs.reduce((a, c) => a + (errCount[b.path + '::ch' + c.ch] ? 1 : 0), 0);
          const total = chs.length;
          const w = total > 0 ? Math.round(rN / total * 100) : 0;
          const zero = rN === 0;
          const em = b.stage === '初中' ? '📘' : '📗';
          const sub = (b.edition || '') + ' · ' + (b.grade || '') + (b.volume ? '·' + b.volume : '');
          const href = '/tools/textbook-browser.html?path=' + encodeURIComponent(b.path);
          return '<a class="book-card ' + (zero ? 'zero' : '') + '" href="' + href + '">' +
            '<span class="bk-em">' + em + '</span>' +
            '<span class="bk-bd">' +
              '<div class="bk-t">' + escHtml(b.stage) + ' · ' + escHtml(b.grade) + (b.volume ? ' · ' + escHtml(b.volume) : '') + '</div>' +
              '<div class="bk-s">' + escHtml(sub) + '</div>' +
              '<div class="bk-bar"><i style="width:' + w + '%"></i></div>' +
              '<div class="bk-meta">' +
                '<span>已读 <b>' + rN + '</b>/' + total + ' 章</span>' +
                (eN > 0 ? '<span class="err">' + eN + ' 章有错题</span>' : '<span>' + w + '%</span>') +
              '</div>' +
            '</span>' +
          '</a>';
        }).join('');
      }
    }

    // ----- 错题切片 -----
    const slice = due
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 5);
    const errMount = $('err-mount');
    if (errMount) {
      if (!slice.length) {
        errMount.innerHTML = '<div class="err-empty">✅ ' + escHtml(SUBJECT_ZH) + '没有待复习的错题 · 状态干净 · ' +
          '<a href="/quiz.html?subject=' + encodeURIComponent(TOOL_QUERY) + '" style="color:#065F46;font-weight:700">来一题保持手感 →</a></div>';
      } else {
        errMount.innerHTML = slice.map(e => {
          const tag = e.keyword || (e.mistakeTags && e.mistakeTags[0]) || '错题';
          const q = escHtml((e.question || '').slice(0, 90));
          const dueLbl = (e.nextReviewAt || 0) <= Date.now() ? '今日到期' : '复习中';
          return '<div class="err-row">' +
            '<div class="em">📕</div>' +
            '<div class="bd">' +
              '<div><b>' + escHtml(tag) + '</b> · 阶段 ' + (e.reviewCount || 0) + '/3 · ' + dueLbl + '</div>' +
              '<div class="qx">' + (q || '(无题干)') + '</div>' +
            '</div>' +
            '<a class="ax" href="/errors.html?id=' + encodeURIComponent(e.id || '') + '#review">复习</a>' +
          '</div>';
        }).join('');
      }
    }

    // ----- 智能"继续学习" CTA -----
    let contHref = '/quiz.html?subject=' + encodeURIComponent(TOOL_QUERY);
    let contT = '从' + SUBJECT_ZH + '每日一题开始';
    let contS = 'AI 出题, 1 道挂 1 个考点';

    if (slice.length > 0) {
      contHref = '/errors.html?subject=' + encodeURIComponent(TOOL_QUERY) + '&due=1';
      contT = '今日 ' + slice.filter(e => (e.nextReviewAt || 0) <= Date.now()).length + ' 道' + SUBJECT_ZH + '错题到期';
      contS = '错题不补就是给同学送分 · 直接进复习';
    } else {
      const firstIncomplete = books.find(b => {
        const chs = b.chapters || [];
        const r = chs.filter(c => readSig.has(b.path + '::ch' + c.ch)).length;
        return r < chs.length;
      });
      if (firstIncomplete) {
        const chs = firstIncomplete.chapters || [];
        const nextCh = chs.find(c => !readSig.has(firstIncomplete.path + '::ch' + c.ch));
        if (nextCh) {
          contHref = '/tools/textbook-browser.html?path=' + encodeURIComponent(firstIncomplete.path) + '&ch=' + nextCh.ch;
          contT = '继续读 ' + (firstIncomplete.grade || '') + ' · 第 ' + nextCh.ch + ' 章';
          contS = nextCh.title || '下一章';
        }
      }
    }
    if ($('cta-continue')) $('cta-continue').href = contHref;
    if ($('cta-cont-t'))   $('cta-cont-t').textContent = contT;
    if ($('cta-cont-s'))   $('cta-cont-s').textContent = contS;

    return { books, totalCh, readCh, masteredCh, errChCount, pct };
  }

  global.SUBJECT_HUB = { init: init };
})(window);
