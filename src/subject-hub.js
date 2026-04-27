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

  // welcome.html 里写入的 yd:my_grade 形如 'primary_4' / 'middle_2' / 'high_1'
  // 映射成本仓 manifest 用的学段词('初中' / '高中'), 进学科页时自动锁到对应 tab
  function detectStudentStage() {
    let g = '';
    try { g = localStorage.getItem('yd:my_grade') || ''; } catch (e) {}
    if (g.indexOf('high') === 0) return '高中';
    if (g.indexOf('middle') === 0) return '初中';
    if (g.indexOf('primary') === 0) return '全部'; // 小学暂无 manifest, 退到全部以免空列表
    return '全部';
  }
  // 把 'middle_2' 翻译成中文 '初二' 之类, 用在 "Up next for you" 卡片
  const GRADE_CN = {
    primary_1:'小一',primary_2:'小二',primary_3:'小三',primary_4:'小四',primary_5:'小五',primary_6:'小六',
    middle_1:'初一',middle_2:'初二',middle_3:'初三',
    high_1:'高一',high_2:'高二',high_3:'高三'
  };
  function gradeCn(g){ return GRADE_CN[g] || ''; }
  // 试着把学生年级跟 manifest book.grade 对齐: middle_2 → '八年级'
  const GRADE_TO_BOOK_GRADE = {
    middle_1:'七年级', middle_2:'八年级', middle_3:'九年级',
    high_1:['必修','必修1','必修第一册','第一册'],
    high_2:['必修2','必修第二册','第二册','选择性必修1','选择性必修'],
    high_3:['选择性必修2','选择性必修3']
  };
  function bookGradesForStudent(g){
    const v = GRADE_TO_BOOK_GRADE[g];
    if (!v) return [];
    return Array.isArray(v) ? v : [v];
  }

  // ─── EXP-2 · 月度 mastery snapshot ───
  // Shape: ydzx_mastery_snapshots_v1 = { 'YYYY-MM': { 'math': { mc:5, total:284, pct:1 }, ... } }
  const SNAP_KEY = 'ydzx_mastery_snapshots_v1';
  function thisMonthKey() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  function prevMonthKey() {
    const d = new Date();
    d.setDate(1); d.setMonth(d.getMonth() - 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  function readSnaps() {
    try { return JSON.parse(localStorage.getItem(SNAP_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }
  function writeSnaps(o) {
    try { localStorage.setItem(SNAP_KEY, JSON.stringify(o)); } catch (e) {}
  }
  // 把当前月-学科 mastery 写入 snapshot, 只写一次/月
  function ensureSnapshot(subjectKey, mc, total) {
    const m = thisMonthKey();
    const all = readSnaps();
    if (!all[m]) all[m] = {};
    if (all[m][subjectKey]) return; // 本月已 snapshot, 不重写
    all[m][subjectKey] = { mc: mc, total: total, pct: total ? mc / total : 0, ts: Date.now() };
    writeSnaps(all);
  }
  // 取上月 snapshot, 算 pct 差
  function deltaVsLastMonth(subjectKey, currMc, currTotal) {
    const all = readSnaps();
    const prev = (all[prevMonthKey()] && all[prevMonthKey()][subjectKey]) || null;
    if (!prev || !currTotal || !prev.total) return null;
    const currPct = currMc / currTotal;
    const prevPct = prev.mc / prev.total;
    const diff = Math.round((currPct - prevPct) * 100);
    return diff;   // 数字, 单位百分点; 0 = 平
  }

  async function fetchManifest() {
    const r = await fetch('/data/extracted/manifest.json', { cache: 'force-cache' });
    return r.json();
  }

  // 8 个已上线的学科 chip + 1 个建设中(英语)
  const SUBJ_CHIPS = [
    { key:'math',     zh:'数学', href:'/subjects/math.html'      },
    { key:'physics',  zh:'物理', href:'/subjects/physics.html'   },
    { key:'chemistry',zh:'化学', href:'/subjects/chemistry.html' },
    { key:'biology',  zh:'生物', href:'/subjects/?key=biology'   },
    { key:'chinese',  zh:'语文', href:'/subjects/chinese.html'   },
    { key:'history',  zh:'历史', href:'/subjects/?key=history'   },
    { key:'geography',zh:'地理', href:'/subjects/?key=geography' },
    { key:'politics', zh:'政治', href:'/subjects/?key=politics'  },
    { key:'english',  zh:'英语', href:'#', disabled:true         }
  ];

  function ensureSwitcherStyle() {
    if (document.getElementById('subj-hub-switcher-style')) return;
    const css = ''
      + '.subj-switcher{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 4px}'
      + '.subj-switcher a{padding:5px 11px;font-size:11.5px;font-weight:700;color:#71717A;background:#fff;border:1px solid #E4E4E7;border-radius:100px;text-decoration:none;transition:.15s}'
      + '.subj-switcher a:hover{border-color:currentColor}'
      + '.subj-switcher a.on{background:var(--tone,#18181B);color:#fff;border-color:var(--tone,#18181B)}'
      + '.subj-switcher a.disabled{opacity:.4;cursor:not-allowed;pointer-events:none}'
      + '.stage-tabs{display:inline-flex;background:#fff;border:1px solid #E4E4E7;border-radius:9px;overflow:hidden;margin:6px 0 14px}'
      + '.stage-tabs button{background:transparent;border:none;padding:7px 14px;font-size:12px;font-weight:700;color:#52525B;cursor:pointer;font-family:inherit;border-right:1px solid #E4E4E7}'
      + '.stage-tabs button:last-child{border-right:none}'
      + '.stage-tabs button.on{background:var(--tone,#18181B);color:#fff}';
    const s = document.createElement('style'); s.id='subj-hub-switcher-style'; s.textContent=css;
    document.head.appendChild(s);
  }

  function renderSwitcher(mountId, currentKey) {
    const node = $(mountId);
    if (!node) return;
    ensureSwitcherStyle();
    node.className = 'subj-switcher';
    node.innerHTML = SUBJ_CHIPS.map(s => {
      const cls = (s.key === currentKey ? 'on ' : '') + (s.disabled ? 'disabled' : '');
      const href = s.disabled ? '#' : s.href;
      const suffix = s.disabled ? ' <span style="font-size:9px;color:#A1A1AA;margin-left:2px">建设中</span>' : '';
      return '<a class="' + cls.trim() + '" href="' + href + '">' + s.zh + suffix + '</a>';
    }).join('');
  }

  function renderStageTabs(mountId, current, onChange) {
    const node = $(mountId);
    if (!node) return;
    ensureSwitcherStyle();
    node.className = 'stage-tabs';
    const tabs = ['全部', '初中', '高中'];
    node.innerHTML = tabs.map(t => '<button data-stage="' + t + '" class="' + (t === current ? 'on' : '') + '">' + t + '</button>').join('');
    node.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => {
        node.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
        try { onChange(b.dataset.stage); } catch(e){ console.warn('stage change', e); }
      });
    });
  }

  async function init(cfg) {
    cfg = cfg || {};
    const SUBJECT_ZH  = cfg.subjectZh  || '数学';
    const SUBJECT_KEY = cfg.subjectKey || 'math';
    const TOOL_QUERY  = cfg.toolQuery  || SUBJECT_KEY;
    // 优先级: URL ?stage=... > cfg.initialStage > yd:my_grade 推断 > 全部
    let urlStage = '';
    try {
      const m = location.search.match(/[?&]stage=([^&]+)/);
      if (m) urlStage = decodeURIComponent(m[1]);
    } catch (e) {}
    let activeStage = urlStage || cfg.initialStage || detectStudentStage();
    const studentGrade = (function () {
      try { return localStorage.getItem('yd:my_grade') || ''; } catch (e) { return ''; }
    })();
    const studentName = (function () {
      try { return localStorage.getItem('yd:my_name') || ''; } catch (e) { return ''; }
    })();

    // 可选: 渲染学科切换 chip 条
    if (cfg.switcherMountId) renderSwitcher(cfg.switcherMountId, SUBJECT_KEY);

    let manifest;
    try { manifest = await fetchManifest(); }
    catch (e) {
      const list = $('book-list');
      if (list) list.innerHTML = '<div style="color:#DC2626;font-size:13px;padding:12px">manifest 加载失败 · ' + escHtml(e.message || e) + '</div>';
      return;
    }

    const allBooks = (manifest.books || [])
      .filter(b => b.subject === SUBJECT_ZH)
      .sort((a, b) => {
        const sa = a.stage === '初中' ? 0 : (a.stage === '高中' ? 1 : 2);
        const sb = b.stage === '初中' ? 0 : (b.stage === '高中' ? 1 : 2);
        if (sa !== sb) return sa - sb;
        const ga = gradeRank(a.grade), gb = gradeRank(b.grade);
        if (ga !== gb) return ga - gb;
        return (a.volume || '').localeCompare(b.volume || '');
      });

    // ----- 本地状态聚合 (跨学段恒定, 不随 stage 变) -----
    const read = safeGet('ydzx_textbook_read', {}) || {};
    const readSig = new Set(Object.keys(read));
    const outcomes = safeGet('ydzx_quiz_outcome_v1', {}) || {};
    const clearedSet = new Set(Object.keys(safeGet('ydzx_challenge_clears_v1', {}) || {}));

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

    function paint(stage) {
      const books = stage === '全部' ? allBooks : allBooks.filter(b => b.stage === stage);

      // ----- 总分母 + mastery (随 stage 变) -----
      let totalCh = 0, readCh = 0, masteredCh = 0, clearedCh = 0;
      const stageErrSet = new Set();
      books.forEach(b => {
        (b.chapters || []).forEach(c => {
          totalCh++;
          const sig = b.path + '::ch' + c.ch;
          if (readSig.has(sig)) readCh++;
          if (clearedSet.has(sig)) clearedCh++;
          const px = chPx[sig];
          if (readSig.has(sig) && px && px.good >= 2 && px.good >= px.bad * 2) masteredCh++;
          if (errCount[sig]) stageErrSet.add(sig);
        });
      });

      if ($('m-books')) $('m-books').textContent = books.length;
      if ($('m-ch'))    $('m-ch').textContent    = totalCh;
      if ($('m-read'))  $('m-read').textContent  = readCh;
      if ($('m-err'))   $('m-err').textContent   = stageErrSet.size;
      if ($('m-mas'))   $('m-mas').textContent   = masteredCh;
      if ($('m-cleared')) $('m-cleared').textContent = clearedCh;

      const pct = totalCh > 0 ? Math.round(masteredCh / totalCh * 100) : 0;
      if ($('ring-n'))  $('ring-n').textContent  = pct + '%';
      if ($('ring-fg')) $('ring-fg').setAttribute('stroke-dashoffset', String(RING_CIRC * (1 - pct / 100)));

      // EXP-2: 本月初取一次 snapshot, 与上月对比生成 delta 文案
      // 只在 stage='全部' 时记 snapshot, 避免被学段过滤干扰
      if (stage === '全部') ensureSnapshot(SUBJECT_KEY, masteredCh, totalCh);
      const dEl = $('m-delta');
      if (dEl) {
        const diff = deltaVsLastMonth(SUBJECT_KEY, masteredCh, totalCh);
        if (diff == null) {
          dEl.innerHTML = '<span style="color:#A1A1AA;font-size:11px;font-weight:600">本月起步</span>';
        } else if (diff > 0) {
          dEl.innerHTML = '<span style="color:#15803D;font-size:11px;font-weight:800">↑ 比上月 +' + diff + '%</span>';
        } else if (diff === 0) {
          dEl.innerHTML = '<span style="color:#71717A;font-size:11px;font-weight:600">与上月持平</span>';
        } else {
          // 故意不显示负值, 避免负反馈打击动机
          dEl.innerHTML = '<span style="color:#A1A1AA;font-size:11px;font-weight:600">·</span>';
        }
      }

      // 错题 stage 切片 = 当前 stage 学段下的本科错题
      const stageBookPaths = new Set(books.map(b => b.path));
      const stageErrs = subjErrs.filter(e =>
        e.textbookRef && stageBookPaths.has(e.textbookRef.path)
      );
      // 全部 stage 模式下若错题没绑 textbookRef, 也展示
      const dueAll = subjErrs.filter(e => (e.reviewCount || 0) < 3);
      const due = stage === '全部'
        ? dueAll
        : stageErrs.filter(e => (e.reviewCount || 0) < 3);
      if ($('cta-err-s')) $('cta-err-s').textContent = due.length + ' 道待复习';

      // ----- 教材卡列表 -----
      const list = $('book-list');
      if (list) {
        if (!books.length) {
          list.innerHTML = '<div style="color:#71717A;font-size:13px;padding:12px">' + escHtml(stage) + ' 学段暂无 ' + escHtml(SUBJECT_ZH) + ' 教材</div>';
        } else {
          list.innerHTML = books.map(b => {
            const chs = b.chapters || [];
            const rN = chs.reduce((a, c) => a + (readSig.has(b.path + '::ch' + c.ch) ? 1 : 0), 0);
            const eN = chs.reduce((a, c) => a + (errCount[b.path + '::ch' + c.ch] ? 1 : 0), 0);
            const cN = chs.reduce((a, c) => a + (clearedSet.has(b.path + '::ch' + c.ch) ? 1 : 0), 0);
            const total = chs.length;
            const w = total > 0 ? Math.round(rN / total * 100) : 0;
            const zero = rN === 0;
            const em = b.stage === '初中' ? '📘' : '📗';
            const sub = (b.edition || '') + ' · ' + (b.grade || '') + (b.volume ? '·' + b.volume : '');
            const href = '/tools/textbook-browser.html?path=' + encodeURIComponent(b.path);
            const tailMeta = eN > 0
              ? '<span class="err">' + eN + ' 章有错题</span>'
              : (cN > 0
                  ? '<span class="cleared">🏆 ' + cN + ' 章冲关</span>'
                  : '<span>' + w + '%</span>');
            return '<a class="book-card ' + (zero ? 'zero' : '') + (cN > 0 ? ' has-cleared' : '') + '" href="' + href + '">' +
              '<span class="bk-em">' + em + '</span>' +
              '<span class="bk-bd">' +
                '<div class="bk-t">' + escHtml(b.stage) + ' · ' + escHtml(b.grade) + (b.volume ? ' · ' + escHtml(b.volume) : '') +
                  (cN > 0 ? ' <span style="font-size:11px;color:#92400E;background:#FEF3C7;border:1px solid #FBBF24;padding:1px 6px;border-radius:100px;font-weight:700;margin-left:4px">🏆 ' + cN + '</span>' : '') +
                '</div>' +
                '<div class="bk-s">' + escHtml(sub) + '</div>' +
                '<div class="bk-bar"><i style="width:' + w + '%"></i></div>' +
                '<div class="bk-meta">' +
                  '<span>已读 <b>' + rN + '</b>/' + total + ' 章</span>' +
                  tailMeta +
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
          errMount.innerHTML = '<div class="err-empty">✅ ' + escHtml(SUBJECT_ZH) +
            (stage !== '全部' ? '·' + stage : '') +
            '没有待复习的错题 · 状态干净 · ' +
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

      return { books, totalCh, readCh, masteredCh, pct };
    }

    // ----- "Up next for you" KA-style 个性化推荐卡 -----
    function renderUpNext() {
      const mount = $('upnext-mount');
      if (!mount) return;
      ensureUpNextStyle();

      // 优先级:
      //   A. 错题到期 → 一道复习
      //   B. 学生年级匹配的本科教材 → 第一个未读章节
      //   C. activeStage 范围内首本未读完教材 → 下一章
      //   D. 推每日一题
      const dueErrs = subjErrs
        .filter(e => (e.reviewCount || 0) < 3 && (e.nextReviewAt || 0) <= Date.now())
        .sort((a, b) => (a.nextReviewAt || 0) - (b.nextReviewAt || 0));

      let kind = 'D', title = '今天先来一道' + SUBJECT_ZH + '每日一题', sub = '3 分钟一道, 含解析', href = '/quiz.html?subject=' + encodeURIComponent(TOOL_QUERY), icon = '🎯';
      let pep = (studentName ? studentName + '，' : '') + '别让节奏断了';

      if (dueErrs.length > 0) {
        kind = 'A';
        const e = dueErrs[0];
        const tag = e.keyword || (e.mistakeTags && e.mistakeTags[0]) || '错题';
        title = '先把这道' + SUBJECT_ZH + '错题攻克: ' + tag;
        sub = '今日到期 · 阶段 ' + (e.reviewCount || 0) + '/3 · 不补就给同学送分';
        href = '/errors.html?id=' + encodeURIComponent(e.id || '') + '#review';
        icon = '📕';
      } else {
        // 找年级匹配的教材
        const wanted = bookGradesForStudent(studentGrade);
        const myGradeBook = wanted.length
          ? allBooks.find(b => wanted.indexOf(b.grade) >= 0)
          : null;
        const target = myGradeBook || allBooks.find(b => {
          if (activeStage !== '全部' && b.stage !== activeStage) return false;
          const chs = b.chapters || [];
          return chs.some(c => !readSig.has(b.path + '::ch' + c.ch));
        });
        if (target) {
          const chs = target.chapters || [];
          const nextCh = chs.find(c => !readSig.has(target.path + '::ch' + c.ch));
          if (nextCh) {
            kind = myGradeBook ? 'B' : 'C';
            const stub = myGradeBook
              ? '为' + (gradeCn(studentGrade) || '你') + '准备的'
              : '继续' + (target.grade || '') + ' · ';
            title = stub + (target.grade ? '' : '') + '第 ' + nextCh.ch + ' 章: ' + (nextCh.title || '下一章');
            sub = (target.stage || '') + ' · ' + (target.edition || '') + ' · 大约 ' + Math.max(1, Math.round(((nextCh.end_page||0) - (nextCh.start_page||0)) / 5)) + ' 分钟可读完';
            href = '/tools/textbook-browser.html?path=' + encodeURIComponent(target.path) + '&ch=' + nextCh.ch;
            icon = '📖';
          }
        }
      }

      mount.innerHTML = ''
        + '<div class="upnext-card kind-' + kind + '">'
        +   '<div class="upnext-em">' + icon + '</div>'
        +   '<div class="upnext-bd">'
        +     '<div class="upnext-tag">为你准备的下一步' + (studentName ? ' · 你好 ' + escHtml(studentName) : '') + '</div>'
        +     '<div class="upnext-t">' + escHtml(title) + '</div>'
        +     '<div class="upnext-s">' + escHtml(sub) + '</div>'
        +   '</div>'
        +   '<a class="upnext-go" href="' + href + '">开始 →</a>'
        + '</div>'
        + '<div class="upnext-pep">' + escHtml(pep) + '</div>';
    }

    function ensureUpNextStyle() {
      if (document.getElementById('subj-hub-upnext-style')) return;
      const css = ''
        + '.upnext-card{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center;padding:16px 18px;border-radius:14px;background:#FFFBEB;border:1px solid #FCD34D;margin:12px 0 4px}'
        + '.upnext-card.kind-A{background:#FEF2F2;border-color:#FCA5A5}'
        + '.upnext-card.kind-B{background:#EFF6FF;border-color:#93C5FD}'
        + '.upnext-card.kind-C{background:#F0FDF4;border-color:#86EFAC}'
        + '.upnext-em{font-size:32px;line-height:1;flex-shrink:0}'
        + '.upnext-bd{min-width:0}'
        + '.upnext-tag{font-size:10px;letter-spacing:.6px;color:#92400E;font-weight:700;text-transform:uppercase;margin-bottom:4px}'
        + '.upnext-card.kind-A .upnext-tag{color:#991B1B}'
        + '.upnext-card.kind-B .upnext-tag{color:#1D4ED8}'
        + '.upnext-card.kind-C .upnext-tag{color:#15803D}'
        + '.upnext-t{font-size:15px;font-weight:800;color:#18181B;letter-spacing:-.005em;margin-bottom:3px}'
        + '.upnext-s{font-size:12px;color:#52525B}'
        + '.upnext-go{padding:9px 18px;background:#18181B;color:#fff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700;white-space:nowrap;flex-shrink:0;transition:.15s}'
        + '.upnext-go:hover{background:#000;transform:translateY(-1px)}'
        + '.upnext-pep{font-size:11px;color:#A1A1AA;text-align:center;margin:6px 0 14px}'
        + '@media(max-width:560px){.upnext-card{grid-template-columns:auto 1fr;gap:10px;padding:14px}.upnext-go{grid-column:1/-1;text-align:center}}';
      const s = document.createElement('style'); s.id='subj-hub-upnext-style'; s.textContent=css;
      document.head.appendChild(s);
    }

    // ----- 给家长看·一眼读懂卡 -----
    function ensureParentStyle() {
      if (document.getElementById('subj-hub-parent-style')) return;
      const css = ''
        + '.parent-card{background:#FAFAF7;border:1px solid #E4E4E7;border-radius:14px;padding:18px 20px;margin:24px 0 0}'
        + '.parent-card .ph{display:flex;align-items:center;gap:8px;margin-bottom:10px}'
        + '.parent-card .ph .em{font-size:18px}'
        + '.parent-card .ph h3{font-size:14px;font-weight:800;color:#18181B;margin:0;letter-spacing:.3px}'
        + '.parent-card .ph .badge{font-size:10px;font-weight:700;padding:2px 8px;border-radius:100px;letter-spacing:.4px;margin-left:auto}'
        + '.parent-card .badge.b-stable{background:#DBEAFE;color:#1E40AF}'
        + '.parent-card .badge.b-burst{background:#FEF3C7;color:#92400E}'
        + '.parent-card .badge.b-stuck{background:#FEE2E2;color:#991B1B}'
        + '.parent-card .badge.b-start{background:#F4F4F5;color:#52525B}'
        + '.parent-card .lines{font-size:13px;color:#3F3F46;line-height:1.85;margin-bottom:12px}'
        + '.parent-card .lines b{color:#18181B;font-weight:800}'
        + '.parent-card .lines .m{color:#92400E;font-weight:700}'
        + '.parent-card .advice{background:#fff;border-left:3px solid #F59E0B;padding:10px 14px;font-size:12.5px;color:#52525B;border-radius:0 8px 8px 0;margin-bottom:10px;line-height:1.6}'
        + '.parent-card .advice b{color:#92400E}'
        + '.parent-card .copy-row{display:flex;gap:8px;align-items:center}'
        + '.parent-card .copy-btn{padding:7px 14px;background:#18181B;color:#fff;border:none;border-radius:7px;font:700 12px var(--font,system-ui);cursor:pointer;transition:.15s}'
        + '.parent-card .copy-btn:hover{background:#000}'
        + '.parent-card .copy-tip{font-size:11px;color:#A1A1AA}';
      const s = document.createElement('style'); s.id='subj-hub-parent-style'; s.textContent=css;
      document.head.appendChild(s);
    }

    function renderParentSummary() {
      const mount = $('parent-mount');
      if (!mount) return;
      ensureParentStyle();

      // 一周窗口起点(7 天前的 00:00)
      const weekAgo = (function () {
        const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - 6);
        return d.getTime();
      })();
      const todayStart = (function () { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();

      // 本周读章 / 今日读章 (限定本科目教材)
      const subjBookPaths = new Set(allBooks.map(b => b.path));
      let weekRead = 0, todayRead = 0;
      Object.keys(read).forEach(sig => {
        const ts = read[sig];
        if (typeof ts !== 'number') return;
        const path = sig.split('::ch')[0];
        if (!subjBookPaths.has(path)) return;
        if (ts >= weekAgo) weekRead++;
        if (ts >= todayStart) todayRead++;
      });

      // 本周做题 / 答对率
      let weekQ = 0, weekRight = 0;
      Object.values(outcomes).forEach(o => {
        if (!o || !o.book || o.ch == null) return;
        if (o.subj && !(o.subj === SUBJECT_KEY || o.subj === SUBJECT_ZH)) return;
        // outcome 没绝对时间戳就用 d 字段判断 7 天内
        if (o.d) {
          const t = new Date(o.d + 'T00:00:00').getTime();
          if (t >= weekAgo) {
            weekQ++;
            if (o.r === 'right' || o.r === 'correct') weekRight++;
          }
        }
      });
      const acc = weekQ ? Math.round(weekRight / weekQ * 100) : null;

      // 错题数 active 当前
      const activeErrCount = subjErrs.filter(e => (e.reviewCount || 0) < 3).length;
      // 本周新增错题
      const weekNewErrs = subjErrs.filter(e => (e.timestamp || 0) >= weekAgo).length;
      // 本周通关数
      let weekClears = 0;
      try {
        const cleared = JSON.parse(localStorage.getItem('ydzx_challenge_clears_v1') || '{}') || {};
        Object.keys(cleared).forEach(sig => {
          const path = sig.split('::ch')[0];
          if (!subjBookPaths.has(path)) return;
          if ((cleared[sig].ts || 0) >= weekAgo) weekClears++;
        });
      } catch (e) {}

      // 状态判定
      let state = 'start', stateLabel = '起步中', stateAdvice = '';
      if (weekClears >= 1 || weekRead >= 5) {
        state = 'burst'; stateLabel = '突进期';
        stateAdvice = '这周明显发力 · <b>建议保护节奏, 不要再加任务</b>, 让她自然过完这个高峰';
      } else if (weekRead >= 3 && (acc == null || acc >= 60)) {
        state = 'stable'; stateLabel = '稳推进';
        stateAdvice = '稳定爬坡 · <b>不催不夸, 保持当前节奏</b> 就是最好的支持';
      } else if (weekRead <= 1 && activeErrCount >= 5) {
        state = 'stuck'; stateLabel = '卡顿';
        stateAdvice = '错题攒了不少, 阅读节奏掉下来了 · <b>不要硬推, 先陪她做完一道错题</b>把状态拉回来';
      } else if (weekRead === 0 && weekQ === 0) {
        state = 'stuck'; stateLabel = '本周空白';
        stateAdvice = '本周还没有进度 · <b>问她哪一科最让她头疼</b>, 一起在这门里挑 1 章读 10 分钟即可';
      } else {
        state = 'start'; stateLabel = '起步中';
        stateAdvice = '总量不大, 处于刚起步阶段 · <b>每天 15 分钟胜过周末突击</b>, 别用考试压力催';
      }

      // 第一行
      const lineWeek = '本周读了 <b>' + weekRead + '</b> 章'
        + (weekQ > 0 ? '· 答了 <b>' + weekQ + '</b> 题' + (acc != null ? ' (对 <b>' + acc + '%</b>)' : '') : '')
        + (weekClears > 0 ? '· <span class="m">通关 ' + weekClears + ' 关</span>' : '');

      // 第二行
      const lineState = (todayRead > 0 ? '今天已读 <b>' + todayRead + '</b> 章 · ' : '')
        + '错题在线 <b>' + activeErrCount + '</b> 道'
        + (weekNewErrs > 0 ? ' · 本周新进 <b>' + weekNewErrs + '</b> 道' : '');

      // 拷贝文本
      const myName = studentName || '孩子';
      const copyText = '【' + myName + ' · ' + SUBJECT_ZH + '·一周】' + '\n'
        + '状态：' + stateLabel + '\n'
        + '本周：读 ' + weekRead + ' 章'
        + (weekQ > 0 ? ' · 答 ' + weekQ + ' 题' + (acc != null ? '(对 ' + acc + '%)' : '') : '')
        + (weekClears > 0 ? ' · 通关 ' + weekClears + ' 关' : '')
        + '\n'
        + '错题：在线 ' + activeErrCount + ' 道'
        + (weekNewErrs > 0 ? ' · 本周新进 ' + weekNewErrs + ' 道' : '');

      mount.innerHTML = ''
        + '<div class="parent-card">'
        +   '<div class="ph">'
        +     '<span class="em">💌</span>'
        +     '<h3>给家长看 · ' + SUBJECT_ZH + '本周一眼读懂</h3>'
        +     '<span class="badge b-' + state + '">' + stateLabel + '</span>'
        +   '</div>'
        +   '<div class="lines">'
        +     '<div>' + lineWeek + '</div>'
        +     '<div>' + lineState + '</div>'
        +   '</div>'
        +   '<div class="advice">家长这周可以：' + stateAdvice + '</div>'
        +   '<div class="copy-row">'
        +     '<button class="copy-btn" id="parent-copy">📋 复制本周简报</button>'
        +     '<span class="copy-tip">粘贴进微信发给爸妈</span>'
        +   '</div>'
        + '</div>';

      const btn = $('parent-copy');
      if (btn) {
        btn.addEventListener('click', function () {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(copyText).then(function () {
              btn.textContent = '✓ 已复制 · 发给爸妈吧';
              setTimeout(function () { btn.textContent = '📋 复制本周简报'; }, 1800);
            }).catch(function () { fallbackCopy(); });
          } else {
            fallbackCopy();
          }
          function fallbackCopy() {
            const ta = document.createElement('textarea');
            ta.value = copyText; document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); btn.textContent = '✓ 已复制'; } catch(_){ btn.textContent = '复制失败'; }
            ta.remove();
            setTimeout(function () { btn.textContent = '📋 复制本周简报'; }, 1800);
          }
        });
      }
    }

    // ----- 3 套打法预设 (Playbooks) -----
    function ensurePlaybookStyle() {
      if (document.getElementById('subj-hub-playbook-style')) return;
      const css = ''
        + '.pb-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:8px 0 16px}'
        + '@media(max-width:680px){.pb-grid{grid-template-columns:1fr}}'
        + '.pb-card{display:flex;flex-direction:column;background:#fff;border:1px solid #E4E4E7;border-radius:12px;padding:14px;text-decoration:none;color:inherit;transition:.15s;position:relative;overflow:hidden;min-height:120px}'
        + '.pb-card:hover{transform:translateY(-2px);box-shadow:0 6px 20px -8px rgba(0,0,0,.12)}'
        + '.pb-card .pb-h{display:flex;align-items:center;gap:8px;margin-bottom:6px}'
        + '.pb-card .pb-em{font-size:18px;line-height:1}'
        + '.pb-card .pb-time{font-size:10px;font-weight:800;letter-spacing:.6px;color:#fff;padding:2px 7px;border-radius:100px;text-transform:uppercase}'
        + '.pb-card.pb-quick .pb-time{background:#16A34A}'
        + '.pb-card.pb-tonight .pb-time{background:#DC2626}'
        + '.pb-card.pb-weekend .pb-time{background:#7C3AED}'
        + '.pb-card .pb-t{font-size:14px;font-weight:800;color:#18181B;letter-spacing:-.005em;margin-bottom:3px;line-height:1.4}'
        + '.pb-card .pb-s{font-size:11.5px;color:#52525B;line-height:1.5;flex:1}'
        + '.pb-card .pb-go{font-size:11px;font-weight:700;margin-top:8px;align-self:flex-start;color:#A1A1AA;letter-spacing:.4px}'
        + '.pb-card.pb-quick:hover{border-color:#16A34A}.pb-card.pb-quick:hover .pb-go{color:#16A34A}'
        + '.pb-card.pb-tonight:hover{border-color:#DC2626}.pb-card.pb-tonight:hover .pb-go{color:#DC2626}'
        + '.pb-card.pb-weekend:hover{border-color:#7C3AED}.pb-card.pb-weekend:hover .pb-go{color:#7C3AED}'
        + '.pb-card .pb-disabled{position:absolute;inset:0;background:rgba(255,255,255,.7);display:flex;align-items:center;justify-content:center;font-size:11px;color:#A1A1AA;font-weight:700;backdrop-filter:blur(2px)}';
      const s = document.createElement('style'); s.id = 'subj-hub-playbook-style'; s.textContent = css;
      document.head.appendChild(s);
    }

    function renderPlaybooks() {
      const mount = $('playbook-mount');
      if (!mount) return;
      ensurePlaybookStyle();

      // ----- 今天 15 分钟: 找当前 stage 范围内的"下一章" -----
      let quickHref = '/tools/textbook-browser.html', quickLabel = '挑一本教材开始';
      const stageBooks = activeStage === '全部' ? allBooks : allBooks.filter(b => b.stage === activeStage);
      const wantedGrades = bookGradesForStudent(studentGrade);
      const myBook = wantedGrades.length ? stageBooks.find(b => wantedGrades.indexOf(b.grade) >= 0) : null;
      const target = myBook || stageBooks.find(b => {
        const chs = b.chapters || [];
        return chs.some(c => !readSig.has(b.path + '::ch' + c.ch));
      });
      if (target) {
        const chs = target.chapters || [];
        const nextCh = chs.find(c => !readSig.has(target.path + '::ch' + c.ch));
        if (nextCh) {
          quickHref = '/tools/textbook-browser.html?path=' + encodeURIComponent(target.path) + '&ch=' + nextCh.ch;
          const t = nextCh.title || '第 ' + nextCh.ch + ' 章';
          quickLabel = (target.grade || '') + ' · ' + (t.length > 14 ? t.slice(0, 13) + '…' : t);
        }
      }

      // ----- 今晚冲一关: 用错题数和学科 quiz 决策 -----
      const dueCount = subjErrs.filter(e => (e.reviewCount || 0) < 3 && (e.nextReviewAt || 0) <= Date.now()).length;
      const activeCount = subjErrs.filter(e => (e.reviewCount || 0) < 3).length;
      let tonightHref, tonightLabel, tonightAvail = true;
      if (dueCount >= 5) {
        tonightHref = '/errors.html?subject=' + encodeURIComponent(TOOL_QUERY) + '&due=1';
        tonightLabel = '今日 ' + dueCount + ' 道到期 · 攒成一关闯掉';
      } else if (activeCount >= 5) {
        tonightHref = '/errors.html?subject=' + encodeURIComponent(TOOL_QUERY);
        tonightLabel = '在线 ' + activeCount + ' 道错题 · 5 题冲关解锁徽章';
      } else {
        tonightHref = '/quiz.html?subject=' + encodeURIComponent(TOOL_QUERY);
        tonightLabel = '错题不够攒一关 · 先刷一组 5 道每日一题';
        tonightAvail = activeCount < 3;   // 攒题中 → 用粉笔色但仍可用
      }

      // ----- 周末复盘: 用诊断或周报 -----
      const weekendHref = '/weekly.html?subject=' + encodeURIComponent(TOOL_QUERY);
      const weekendLabel = '7 天进度 + 错题趋势 + 下周 3 件事';

      mount.innerHTML = '<div class="pb-grid">'
        + '<a class="pb-card pb-quick" href="' + quickHref + '">'
          + '<div class="pb-h"><span class="pb-em">⏱️</span><span class="pb-time">今天 15 分钟</span></div>'
          + '<div class="pb-t">读一章 ≈ 12 分钟</div>'
          + '<div class="pb-s">' + escHtml(quickLabel) + '<br>适合通勤 / 课间 / 睡前</div>'
          + '<div class="pb-go">读起来 →</div>'
        + '</a>'
        + '<a class="pb-card pb-tonight" href="' + tonightHref + '">'
          + '<div class="pb-h"><span class="pb-em">🌙</span><span class="pb-time">今晚冲一关</span></div>'
          + '<div class="pb-t">' + (dueCount >= 5 || activeCount >= 5 ? '5 题挑战 30 分钟' : '攒题模式') + '</div>'
          + '<div class="pb-s">' + escHtml(tonightLabel) + '<br>适合晚自习 / 睡前 30 分钟</div>'
          + '<div class="pb-go">' + (dueCount >= 5 || activeCount >= 5 ? '冲关 →' : '去做题 →') + '</div>'
        + '</a>'
        + '<a class="pb-card pb-weekend" href="' + weekendHref + '">'
          + '<div class="pb-h"><span class="pb-em">📈</span><span class="pb-time">周末复盘</span></div>'
          + '<div class="pb-t">回头看 + 排下周</div>'
          + '<div class="pb-s">' + escHtml(weekendLabel) + '<br>适合周日晚 / 月考前</div>'
          + '<div class="pb-go">复盘 →</div>'
        + '</a>'
        + '</div>';
    }

    // 可选: stage tabs
    if (cfg.stageTabsMountId) {
      renderStageTabs(cfg.stageTabsMountId, activeStage, (s) => { activeStage = s; paint(s); renderUpNext(); renderParentSummary(); renderPlaybooks(); });
    }

    const r = paint(activeStage);
    renderUpNext();
    renderPlaybooks();
    renderParentSummary();
    return r;
  }

  global.SUBJECT_HUB = { init: init };
})(window);
