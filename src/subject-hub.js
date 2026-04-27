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
      let totalCh = 0, readCh = 0, masteredCh = 0;
      const stageErrSet = new Set();
      books.forEach(b => {
        (b.chapters || []).forEach(c => {
          totalCh++;
          const sig = b.path + '::ch' + c.ch;
          if (readSig.has(sig)) readCh++;
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

      const pct = totalCh > 0 ? Math.round(masteredCh / totalCh * 100) : 0;
      if ($('ring-n'))  $('ring-n').textContent  = pct + '%';
      if ($('ring-fg')) $('ring-fg').setAttribute('stroke-dashoffset', String(RING_CIRC * (1 - pct / 100)));

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

    // 可选: stage tabs
    if (cfg.stageTabsMountId) {
      renderStageTabs(cfg.stageTabsMountId, activeStage, (s) => { activeStage = s; paint(s); renderUpNext(); });
    }

    const r = paint(activeStage);
    renderUpNext();
    return r;
  }

  global.SUBJECT_HUB = { init: init };
})(window);
