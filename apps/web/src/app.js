import { WEB_SURFACE_ROUTES } from './routes.js';
import {
  WEB_CONFIDENCE_BANDS,
  WEB_DEMO_STATE,
  WEB_ENTRY_CARDS,
  WEB_MATERIAL_PIPELINE,
  WEB_PAGE_GUIDES
} from './view-model.js';

const assetBase = document.querySelector('meta[name="web-app-asset-base"]')?.content || './assets/brand';
const asset = (name) => `${assetBase.replace(/\/$/, '')}/${name}`;
const referenceAsset = (name) => `${assetBase.replace(/\/brand\/?$/, '/reference').replace(/\/$/, '')}/${name}`;

const routes = [
  ['home', '学习主界面', 'brand-house.png'],
  ['upload', '上传资料', 'entry-upload.png'],
  ['report', '个性化报告', 'entry-report.png'],
  ['tutor', 'AI私教', 'entry-tutor.png'],
  ['review', '复习岛', 'entry-review.png'],
  ['parent', '家长中心', 'entry-parent.png'],
  ['map', '今晚路径', 'entry-map.png']
];

const mobileLabels = {
  home: '首页',
  upload: '上传',
  report: '报告',
  tutor: '私教',
  review: '复习',
  parent: '家长',
  map: '地图'
};

const state = {
  active: 'home',
  progress: WEB_DEMO_STATE.progress,
  uploads: WEB_DEMO_STATE.uploads
};

function routeFromHash() {
  return (location.hash || '#home').replace('#', '') || 'home';
}

function setActive(id) {
  state.active = routes.some(([route]) => route === id) ? id : 'home';
  if (location.hash !== `#${state.active}`) location.hash = state.active;
  render();
}

function routeForSearch(value) {
  const text = String(value || '').toLowerCase();
  if (/上传|资料|文件|错题|成绩|测评|pdf|照片/.test(text)) return 'upload';
  if (/报告|分析|天赋|学习画像|导出/.test(text)) return 'report';
  if (/私教|ai|答疑|第一步|苏格拉底|追问/.test(text)) return 'tutor';
  if (/复习|游戏|回访|挑战|变式|记忆/.test(text)) return 'review';
  if (/家长|家庭|父母|证据|今晚问什么/.test(text)) return 'parent';
  if (/地图|路径|路线|任务|目标|7天/.test(text)) return 'map';
  return 'home';
}

function renderShellNav() {
  document.querySelector('#sideNav').innerHTML = routes
    .map(([id, label, image]) => `<a href="#${id}" class="${state.active === id ? 'active' : ''}"><img src="${referenceAsset(image)}" alt="">${label}</a>`)
    .join('');
  document.querySelector('#mobileNav').innerHTML = routes
    .filter(([id]) => ['home', 'tutor', 'review', 'parent'].includes(id))
    .map(([id, label, image]) => `<a href="#${id}" class="${state.active === id ? 'active' : ''}"><img src="${referenceAsset(image)}" alt="">${mobileLabels[id] || label}</a>`)
    .join('');
}

function pageGuide(id) {
  const guide = WEB_PAGE_GUIDES[id];
  if (!guide) return '';
  return `
    <section class="page-guide card">
      <h2>${guide.title}</h2>
      <div class="guide-steps">
        ${guide.steps.map(([n, title, desc]) => `<div><i>${n}</i><b>${title}</b><p>${desc}</p></div>`).join('')}
      </div>
      <button class="soft-button" data-route="${guide.cta[0]}">${guide.cta[1]}</button>
    </section>`;
}

function sceneSwitch(activeId) {
  if (activeId === 'home') return '';
  return `
    <section class="web-scene-switch card" aria-label="核心入口切换">
      ${routes
        .filter(([id]) => id !== 'home')
        .map(([id, label, image]) => `
          <button class="${id === activeId ? 'active' : ''}" type="button" data-route="${id}">
            <img src="${referenceAsset(image)}" alt="">
            <span>${label}</span>
          </button>
        `).join('')}
    </section>`;
}

function rightRail() {
  const progressCard = `
    <article class="rail-card rail-progress">
      <div class="card-head"><h3>今日进度</h3><a href="#parent">更多 ›</a></div>
      <div class="progress-summary"><div class="ring"><b>60%</b></div><div><span>今日目标</span><strong>3 / 5 步</strong></div></div>
      <ol class="step-list">
        ${state.progress.map((item, index) => `<li class="${item.done ? 'done' : item.active ? 'active' : 'todo'}"><span>${item.done ? '✓' : index + 1}</span><b>${item.label}</b><em>${item.done ? '已完成' : item.active ? '进行中' : '待完成'}</em></li>`).join('')}
      </ol>
    </article>`;
  const evidenceCard = `
    <article class="rail-card rail-evidence-card">
      <div class="card-head"><h3>已上传证据</h3><a href="#upload">管理 ›</a></div>
      <div class="evidence-strip"><span>试卷<small>2份</small></span><span>错题<small>18题</small></span><span>反馈<small>3份</small></span><span>观察<small>2份</small></span></div>
    </article>`;

  const rails = {
    upload: `${progressCard}
      <article class="rail-card rail-focus-card green"><b>资料完整度</b><strong>75%</strong><p>成绩、错题和测评已具备，可以生成报告；补充老师反馈后置信度更高。</p></article>
      <article class="rail-card"><h3>分类优先级</h3><div class="rail-list"><span>天赋测评 <em>画像起点</em></span><span>成绩单 <em>真实表现</em></span><span>错题照片 <em>卡点证据</em></span></div></article>`,
    report: `${evidenceCard}
      <article class="rail-card rail-focus-card blue"><b>报告可信度</b><strong>较高</strong><p>测评只做假设，成绩和错题负责交叉验证，避免把标签当定论。</p></article>
      <article class="rail-card"><h3>方法匹配</h3><div class="rail-tags"><span>费曼复述</span><span>苏格拉底追问</span><span>错因归因</span><span>变式训练</span></div></article>`,
    tutor: `<article class="rail-card rail-focus-card orange"><b>本题关联弱点</b><strong>多步计算顺序</strong><p>合并同类数量时容易遗漏或重复，先说第一步比直接算答案更重要。</p></article>
      <article class="rail-card"><h3>提示边界</h3><div class="rail-list"><span>不代写答案 <em>只追问下一步</em></span><span>记录卡点 <em>回流复习</em></span></div></article>`,
    review: `${progressCard}
      <article class="rail-card rail-focus-card yellow"><b>今日挑战</b><strong>12 个知识点</strong><p>只奖励真实回忆和迁移，不奖励机械刷题。</p></article>
      <article class="rail-card"><h3>复习覆盖点</h3><div class="rail-tags"><span>主动回忆</span><span>小变式</span><span>错因复盘</span><span>家长确认</span></div></article>`,
    parent: `${evidenceCard}
      <article class="rail-card rail-focus-card green"><b>今晚只问一件事</b><strong>你的第一步怎么想？</strong><p>从催促转为观察，先让孩子讲思路，再决定是否需要帮助。</p></article>
      <article class="rail-card"><h3>家长支持方式</h3><div class="rail-list"><span>观察者 <em>记录卡点</em></span><span>支持者 <em>给短反馈</em></span><span>确认者 <em>看证据</em></span></div></article>`,
    map: `${progressCard}
      <article class="rail-card rail-focus-card blue"><b>本周路径</b><strong>3 / 6</strong><p>当前停在 AI 点拨，完成后进入复习回访和家长复盘。</p></article>
      <article class="rail-card"><h3>未来 7 天</h3><div class="rail-list"><span>明天 <em>复习回访</em></span><span>第 3 天 <em>薄弱专项</em></span><span>第 7 天 <em>家长复盘</em></span></div></article>`
  };

  return rails[state.active] || `${progressCard}${evidenceCard}
    <article class="rail-card"><h3>连续学习</h3><div class="streak"><strong>7</strong><span>天</span><p>保持短周期反馈，孩子会更愿意继续。</p></div></article>
    <article class="rail-card warm"><h3>家长小提醒</h3><p>今晚不要追问分数，先问：这道题你读懂了什么？需要我帮你检查哪里？</p></article>`;
}

function renderHome() {
  return `
    <section class="page-title home-title-row"><h1>今晚从哪一步开始？</h1><a href="#report">查看完整报告 ›</a></section>
    <section class="hero-grid">
      <article class="buddy-message card"><div class="speech"><h1 class="mobile-hero-title">今晚先做哪一步？</h1><h2>晚上好，小明！</h2><p>今天坚持学习，就能离目标更近一步。</p><div class="chip-row"><span><i class="chip-dot"></i>连续学习 7 天</span><span>今晚 15-20 分钟</span></div></div><img class="mascot-img hero-avatar" src="${referenceAsset('hero-mascot.png')}" alt="咕点"></article>
      <article class="report-preview card"><div class="card-head"><h3>个性化报告 <small>预览</small></h3><a href="#report">查看 ›</a></div><div class="preview-body"><div class="mini-radar"><span>知识掌握</span><span>思维能力</span><span>学习习惯</span><span>学习动力</span><span>应用迁移</span><span>基础技能</span><div class="radar-shape"></div></div><div class="tag-column"><b>优势</b><span>逻辑思维强</span><span>阅读理解好</span><b class="danger">待提升</b><span class="orange">计算准确率</span><span class="orange">审题习惯</span><p>下一步：先巩固计算准确率，3 天后回访。</p></div></div></article>
    </section>
    <section class="entry-grid">
      ${WEB_ENTRY_CARDS.map((card) => `<button class="entry-card ${card.tone}" type="button" data-route="${card.id}"><img class="entry-visual" src="${referenceAsset(card.image)}" alt=""><div class="entry-copy"><strong>${card.number}</strong><h2>${card.title}</h2><p>${card.desc}</p></div><span class="jump">›</span></button>`).join('')}
    </section>
    <section class="learning-route card"><div class="card-head"><h3>今晚学习路线</h3><span>预计用时：15-20 分钟</span></div><div class="route-line">${state.progress.map((item, index) => `<button type="button" data-route="${item.id}" class="${item.done ? 'done' : item.active ? 'active' : 'todo'}"><i>${item.done ? '✓' : index + 1}</i><b>${item.label}</b><small>${item.done ? '已完成' : item.active ? '进行中' : '待完成'}</small></button>`).join('')}</div><button class="primary-cta" type="button" data-route="tutor">继续今晚的第一步</button></section>
  `;
}

function renderUpload() {
  const materialTypes = [
    ['天赋测评', '皮纹、多元智能、学习风格，用来形成初始画像。', 'entry-report.png', 'green'],
    ['成绩单', '总分、单科、排名和趋势，用来交叉验证。', 'entry-upload.png', 'blue'],
    ['错题照片', '识别概念错、条件漏、模型错、计算错。', 'entry-review.png', 'orange'],
    ['学校反馈', '补充课堂状态、表达习惯和作业过程。', 'entry-parent.png', 'green'],
    ['家长观察', '记录动力、注意力、亲子沟通与作息。', 'hero-mascot.png', 'yellow']
  ];
  return `
    <section class="page-title"><div><h1>上传资料</h1><p>先把测评、成绩、错题和观察分清楚，后续报告才有可信证据链。</p></div><button class="soft-button" data-action="mock-upload">选择文件</button></section>
    ${sceneSwitch('upload')}
    <section class="upload-console"><article class="upload-drop card"><div><h2>拖拽文件到这里，或点击选择文件</h2><p>支持多文件同时上传。无法解析的材料会进入人工确认，不中断生成流程。</p><div class="upload-format-row"><span>图片<small>JPG / PNG</small></span><span>PDF<small>测评报告</small></span><span>Word<small>老师反馈</small></span><span>Excel<small>成绩表</small></span></div><button class="primary-cta" data-action="mock-upload">选择文件</button><em>也可以先粘贴文字摘要。</em></div><img class="upload-art-img" src="${referenceAsset('entry-upload.png')}" alt="上传资料"></article></section>
    ${pageGuide('upload')}
    <section><div class="section-title"><h2>选择资料类型 <small>可多选</small></h2><p>分类越准，报告里的证据来源越清晰。</p></div><div class="type-grid upload-type-row">${materialTypes.map(([title, desc, image, tone]) => `<button class="type-card visual ${tone}" data-action="select-material"><img src="${referenceAsset(image)}" alt=""><b>${title}</b><span>${desc}</span></button>`).join('')}</div></section>
    <section class="card table-card"><div class="card-head"><h3>最近上传的资料</h3><a href="#report">查看报告 ›</a></div>${state.uploads.map((item) => `<div class="upload-row"><b>${item.file}<small>${item.size}</small></b><em>${item.type}</em><strong>${item.status}</strong><button data-route="report">查看</button></div>`).join('')}</section>
    <section class="intake-pipeline card"><h2>上传后的标准 SOP</h2><div class="guide-steps">${WEB_MATERIAL_PIPELINE.map(([title, desc], index) => `<div><i>${index + 1}</i><b>${title}</b><p>${desc}</p></div>`).join('')}</div></section>
  `;
}

function renderReport() {
  const evidence = [
    ['成绩单', '数学单元测验 82 分', '逻辑推理题得分率高，计算题仍有失分。', 'green'],
    ['错题本', '条件漏读 12 道', '失分集中在审题、单位和步骤表达。', 'orange'],
    ['老师反馈', '课堂表达积极', '能主动提问，思路清晰，适合讲出来学。', 'green'],
    ['家长观察', '短任务完成稳定', '长任务需要可见进度和短反馈。', 'blue']
  ];
  return `
    <section class="page-title report-title"><div><h1>个性化报告</h1><p>先看证据，再看天赋、成绩与方法如何匹配。</p></div><button class="soft-button" data-action="print-report">下载 PDF 报告</button></section>
    ${sceneSwitch('report')}
    <section class="report-hero pro card"><article class="student-id-card"><div class="student-avatar"><span>小</span></div><div><h2>小明（四年级）</h2><p>原点智学样例档案</p><div class="report-meta"><span>学习时长 <b>4.2</b> 小时/天</span><span>报告周期 <b>7 天</b></span><span>资料来源 <b>12</b> 项</span></div></div><img src="${referenceAsset('entry-report.png')}" alt="报告预览"></article><article class="ability-panel"><div class="card-head"><h3>能力雷达图</h3><span>本周水平</span></div><div class="radar-with-labels"><span>知识掌握</span><span>思维能力</span><span>学习习惯</span><span>学习动力</span><span>应用迁移</span><span>基础技能</span><div class="radar-shape strong"></div></div></article></section>
    ${pageGuide('report')}
    <section class="report-insight card"><div><h2>思维活跃、表达清晰，逻辑推理是闪光点。</h2><p>当前成绩没有完全兑现潜力，主要原因不是“不适合学”，而是方法还没有稳定匹配：审题和步骤表达需要用复述、追问和变式来补偿。</p></div><img src="${referenceAsset('hero-mascot.png')}" alt="咕点鼓励"></section>
    <section class="evidence-band card"><div class="section-title compact"><h2>证据来源</h2><p>测评是画像起点，不是命运定论；真实成绩和错题优先级更高。</p></div><div class="evidence-band-grid">${evidence.map(([label, title, desc, tone]) => `<article class="${tone}"><b>${label}</b><strong>${title}</strong><p>${desc}</p></article>`).join('')}</div></section>
    <section class="confidence-board card"><h2>置信度分层</h2><div class="guide-steps">${WEB_CONFIDENCE_BANDS.map(([title, source, desc], index) => `<div><i>${index + 1}</i><b>${title}</b><p>${source}：${desc}</p></div>`).join('')}</div></section>
    <section class="method-match card pro"><div><h2>天赋 × 成绩 × 方法</h2><p>听觉理解较好、表达积极，但计算和审题有波动，因此优先采用“听讲复述 + 苏格拉底追问 + 错因归因 + 小变式”。</p></div><div class="match-flow"><span>听觉理解好</span><i></i><span>数学波动</span><i></i><span>条件漏读</span><i></i><span>复述 + 追问</span></div><button class="primary-cta" data-action="share-report">分享报告</button></section>
  `;
}

function renderTutor() {
  return `
    <section class="page-title tutor-title"><div><h1>AI私教 <small>/ 先说第一步</small></h1><p>不直接给答案，先追问、再引导，让孩子把思路讲出来。</p></div></section>
    ${sceneSwitch('tutor')}
    <section class="tutor-lab"><article class="chat-card tutor-chat card"><div class="chat-head"><img class="chat-avatar" src="${referenceAsset('hero-mascot.png')}" alt="咕点"><div><h2>咕点</h2><p>像朋友一样陪你想，不替你写答案。</p></div><span>AI</span></div><div class="bubble coach">遇到难题很正常。先说说：你准备从哪一步开始？</div><div class="bubble me">我先算一共用了多少米彩带。</div><div class="bubble coach">很好。那你准备把哪几部分加在一起？</div><div class="chat-actions"><button class="soft-button" data-action="tutor-stuck">我有点卡住</button><button class="soft-button" data-action="tutor-hint">给我一点提示</button><button class="soft-button" data-action="tutor-retry">我想再试一次</button></div><div class="input-line"><input id="tutorInput" placeholder="告诉我你的想法..."><button data-action="send-tutor">发送</button></div><p class="tutor-boundary">边界：只做思路提示和追问，不提供整题代写。</p></article><article class="problem-board card"><div class="card-head"><h3>题目与思路板</h3><button class="soft-button mini" data-action="tutor-hint">提示</button></div><div class="problem-card"><span>应用题</span><p>活动场地买了红色 45 米、蓝色 27 米、黄色 18 米彩带。一共买了多少米？</p><b>先想：要求“一共”，要把哪些数量合并在一起？</b></div><div class="board-and-ladder"><div class="thinking-canvas"><h3>我的思路</h3><div class="canvas-empty">写下你的步骤、图示或列式。</div></div><div class="hint-ladder"><h3>提示阶梯</h3><ol><li class="active"><b>第 1 步</b><p>先理解题目问什么。</p></li><li><b>第 2 步</b><p>找出需要合并的数量。</p></li><li><b>第 3 步</b><p>列式并检查结果。</p></li></ol></div></div></article></section>
    ${pageGuide('tutor')}
  `;
}

function renderReview() {
  const levels = [
    ['回忆关', '巩固基础，快速回忆。', 'entry-report.png', 'green', '奖励 10 星'],
    ['迁移关', '学以致用，灵活迁移。', 'entry-map.png', 'blue', '奖励 15 星'],
    ['变式挑战', '换一种问法验证方法。', 'entry-review.png', 'yellow', '奖励 20 星'],
    ['错因复盘', '把错误变成下一次的检查清单。', 'entry-tutor.png', 'orange', '奖励 25 星']
  ];
  return `
    <section class="page-title review-title"><div><h1>复习岛</h1><p>3 分钟回访，把错因变成主动回忆和变式验证。</p></div><article class="review-buddy-card"><img src="${referenceAsset('hero-mascot.png')}" alt="咕点"><div><b>今天有 12 个知识点</b><span>先回忆，再变式，最后复盘。</span></div></article></section>
    ${sceneSwitch('review')}
    <section class="review-world card"><div class="world-path"><span></span></div><div class="world-node node-1 done"><img src="${referenceAsset('entry-report.png')}" alt=""><b>回忆关</b><em>已完成</em></div><div class="world-node node-2 done"><img src="${referenceAsset('entry-map.png')}" alt=""><b>迁移关</b><em>已完成</em></div><div class="world-node node-3 active"><img src="${referenceAsset('entry-review.png')}" alt=""><b>变式挑战</b><em>进行中</em></div><div class="world-node node-4"><img src="${referenceAsset('entry-tutor.png')}" alt=""><b>错因复盘</b><em>待解锁</em></div><button class="world-rule-button" data-action="review-map-info">查看规则</button></section>
    ${pageGuide('review')}
    <section class="level-card-grid">${levels.map(([title, desc, image, tone, reward]) => `<button class="level-card ${tone}" data-action="review-level" data-level="${title}"><img src="${referenceAsset(image)}" alt=""><h3>${title}</h3><p>${desc}</p><small>${reward}</small><span>开始挑战</span></button>`).join('')}</section>
    <section class="review-mini-games card"><div class="section-title compact"><h2>趣味小游戏</h2><p>每个小游戏都必须回到错因、回忆或迁移证据。</p></div><div class="mini-game-grid"><button class="mini-game-card" data-action="review-challenge" data-level="变式挑战"><img src="${referenceAsset('entry-review.png')}" alt=""><div><h3>错题消消乐</h3><p>消除错题，赢取星星。</p><strong>1250 星</strong></div><span>去挑战</span></button><button class="mini-game-card" data-action="review-level" data-level="回忆关"><img src="${referenceAsset('entry-report.png')}" alt=""><div><h3>知识拼图</h3><p>拼出知识点图谱。</p><strong>24/56</strong></div><span>去挑战</span></button></div><button class="primary-cta review-main-cta" data-action="start-review">开始今天的挑战</button></section>
  `;
}

function renderParent() {
  const evidence = [
    ['课堂练习', '正确率 86%', '18 次', 'entry-report.png'],
    ['错题巩固', '已订正 12 道', '正确率 83%', 'entry-review.png'],
    ['AI私教互动', '对话 9 次', '掌握度提升', 'entry-tutor.png'],
    ['知识掌握', '掌握 23 个', '薄弱 6 个', 'entry-map.png']
  ];
  return `
    <section class="page-title parent-title"><div><h1>家长中心 <small>/ 证据与下一步</small></h1><p>看懂孩子为什么卡住，今晚只做一件有效的事。</p></div><span class="data-chip">数据更新：今天 20:30</span></section>
    ${sceneSwitch('parent')}
    <section class="parent-dashboard"><article class="student-parent-card card"><div class="student-face"><img src="${referenceAsset('entry-parent.png')}" alt="孩子画像"></div><div><h2>小明（四年级）</h2><p>数学 · 本周复盘</p><strong>孩子不是不会学，是方法还没有稳定匹配。</strong></div><img class="parent-mini-mascot" src="${referenceAsset('hero-mascot.png')}" alt="咕点"></article><article class="weekly-overview card"><h2>本周学习概览 <small>7 天</small></h2><div class="overview-metrics"><span><i class="blue-dot"></i><b>5.6</b>小时<em>较上周 +1.2</em></span><span><i class="green-dot"></i><b>18</b>/24<em>任务完成</em></span><span><i class="orange-dot"></i><b>84%</b><em>回访正确率</em></span></div></article></section>
    ${pageGuide('parent')}
    <section class="parent-proof-console card"><div class="card-head"><h3>证据判断台</h3><button class="soft-button mini" data-action="parent-proof-all">查看全部证据</button></div><div class="parent-proof-grid">${evidence.map(([title, main, sub, image]) => `<article><img src="${referenceAsset(image)}" alt=""><div><h3>${title}</h3><b>${main}</b><p>${sub}</p></div></article>`).join('')}</div></section>
    <section class="parent-action-grid"><article class="tonight-question card"><h2>今晚该问什么？</h2><ol><li>今天你学到最有意思的是什么？</li><li>哪道题一开始没想到，后来怎么想通的？</li><li>哪个知识点还不熟，想再练一练？</li></ol><button class="primary-cta" data-action="parent-question">保存今晚问题</button></article><article class="method-advice card"><h2>方法建议</h2><ul><li><b>先复盘再学习：</b>先让孩子说思路，再看答案和解析。</li><li><b>用“讲给你听”：</b>让孩子把思路讲给你听，能更好发现盲点。</li><li><b>鼓励具体：</b>具体表扬努力或策略，会更有效。</li></ul><button class="soft-button" data-action="parent-methods">查看更多方法建议</button></article></section>
    <section class="parent-next-grid"><article class="parent-resolved-card card"><h2>已修复卡点</h2><p>单位换算、应用题审题、小数加减法。</p><button class="soft-button" data-action="parent-proof">查看修复记录</button></article><article class="parent-watch-card card"><h2>待关注问题</h2><p>多步计算、长题审题和表达完整度。</p><button class="soft-button" data-action="parent-proof-all">去专项练习</button></article></section>
  `;
}

function renderMap() {
  const route = [
    ['upload', '01', '资料上传', '已完成', 'entry-upload.png', 'done'],
    ['report', '02', '报告生成', '已完成', 'entry-report.png', 'done'],
    ['tutor', '03', 'AI 点拨', '进行中', 'entry-tutor.png', 'active'],
    ['review', '04', '复习回访', '即将开始', 'entry-review.png', 'todo'],
    ['parent', '05', '家长复盘', '待安排', 'entry-parent.png', 'todo'],
    ['map', '06', '周目标达成', '待完成', 'entry-map.png', 'todo']
  ];
  return `
    <section class="page-title map-title"><div><h1>今晚路径 <small>/ 看见本周闭环</small></h1></div></section>
    ${sceneSwitch('map')}
    <section class="learning-road card"><div class="road-head"><h2>小明的专属学习旅程</h2><span>本周第 3 天</span></div><div class="road-line"></div>${route.map(([id, num, title, status, image, stateName], index) => `<button class="road-stop stop-${index + 1} ${stateName}" data-route="${id}"><b>${num}</b><strong>${title}</strong><em>${status}</em><img src="${referenceAsset(image)}" alt=""></button>`).join('')}<div class="road-cheer"><img src="${referenceAsset('hero-mascot.png')}" alt="咕点"><p>你已完成 2 个关键节点。完成本周路径后，可以获得学习探索者勋章。</p><button class="soft-button" data-route="review">查看勋章</button></div></section>
    ${pageGuide('map')}
    <section class="map-info-grid"><article class="task-list card"><h2>本周任务清单 <small>3/6 已完成</small></h2><ul><li class="done">上传学科资料<span>已完成</span></li><li class="done">查看个性化报告<span>已完成</span></li><li class="active">完成 AI 点拨练习<span>进行中</span></li><li>复习回访<span>待开始</span></li><li>家长复盘<span>待开始</span></li></ul><button class="soft-button" data-route="upload">查看全部任务</button></article><article class="future-path card"><h2>未来 7 天路径</h2><ol>${['明天：复习回访', '第 3 天：薄弱专项', '第 5 天：变式训练', '第 7 天：家长复盘'].map((item, index) => `<li class="${index === 0 ? 'active' : ''}">${item}</li>`).join('')}</ol><button class="soft-button" data-route="review">查看完整日程</button></article></section>
  `;
}

function renderContent() {
  if (state.active === 'upload') return renderUpload();
  if (state.active === 'report') return renderReport();
  if (state.active === 'tutor') return renderTutor();
  if (state.active === 'review') return renderReview();
  if (state.active === 'parent') return renderParent();
  if (state.active === 'map') return renderMap();
  return renderHome();
}

function showToast(message) {
  let toast = document.querySelector('#webToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'webToast';
    toast.className = 'web-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 1800);
}

function shareReport() {
  showToast('报告分享链接已生成，可发给家长或合作老师。');
}

function handleAction(action, target) {
  if (action === 'mock-upload') showToast('已打开上传入口：支持测评、成绩、错题和反馈材料。');
  else if (action === 'select-material') showToast('已选择资料类型，后续会进入证据分级。');
  else if (action === 'print-report') {
    showToast('正在准备 PDF 报告预览。');
    window.print();
  } else if (action === 'share-report') shareReport();
  else if (action === 'send-tutor') showToast(`已记录第一步：${document.querySelector('#tutorInput')?.value || '先说出题目问什么'}`);
  else if (action === 'tutor-stuck') showToast('已切换到更小提示：只问下一步，不给整题答案。');
  else if (action === 'tutor-hint') showToast('提示：先圈出已知条件，再说要求什么。');
  else if (action === 'tutor-retry') showToast('已重置思路板，可以重新说第一步。');
  else if (action === 'start-review') showToast('复习挑战已开始：先回忆，再核对。');
  else if (action === 'review-map-info') showToast('规则：每一关都要留下回忆或迁移证据。');
  else if (action === 'review-level') showToast(`已进入${target?.dataset.level || '复习关卡'}。`);
  else if (action === 'review-challenge') showToast(`变式挑战已打开：先说第一步再作答。`);
  else if (action === 'parent-question') showToast('今晚问题已保存，明天会回访证据。');
  else if (action === 'parent-proof') showToast('已打开本周修复证据。');
  else if (action === 'parent-proof-all') showToast('已展开全部学习证据。');
  else if (action === 'parent-methods') showToast('已打开家长支持方法清单。');
  else if (action === 'student-menu') showToast('当前为小明（四年级）样例档案。');
  else if (action === 'notifications') showToast('今日有 3 条学习提醒。');
  else if (action === 'family-menu') showToast('已进入小明家家庭视角。');
}

function bindActions() {
  document.querySelector('#appContent').addEventListener('click', (event) => {
    const routeButton = event.target.closest('[data-route]');
    if (routeButton) {
      setActive(routeButton.dataset.route);
      return;
    }
    const actionButton = event.target.closest('[data-action]');
    if (actionButton) handleAction(actionButton.dataset.action, actionButton);
  });
  document.querySelector('.top-actions').addEventListener('click', (event) => {
    const actionButton = event.target.closest('[data-action]');
    if (actionButton) handleAction(actionButton.dataset.action, actionButton);
  });
}

function bindSearch() {
  const input = document.querySelector('.search-box input');
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    setActive(routeForSearch(input.value));
  });
}

function render() {
  renderShellNav();
  document.querySelector('#appContent').innerHTML = renderContent();
  document.querySelector('#rightRail').innerHTML = rightRail();
  document.title = `${WEB_SURFACE_ROUTES.find((route) => route.id === state.active)?.label || '原点智学'} · 原点智学`;
}

window.addEventListener('hashchange', () => {
  const next = routeFromHash();
  if (next !== state.active) setActive(next);
});

bindActions();
bindSearch();
setActive(routeFromHash());
