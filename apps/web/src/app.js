import { WEB_SURFACE_ROUTES } from './routes.js';
import {
  WEB_CONFIDENCE_BANDS,
  WEB_DEMO_STATE,
  WEB_ENTRY_CARDS,
  WEB_MATERIAL_PIPELINE,
  WEB_PAGE_GUIDES
} from './view-model.js';

const assetBase = document.querySelector('meta[name="web-app-asset-base"]')?.content || './assets/brand';
const referenceAsset = (name) => `${assetBase.replace(/\/brand\/?$/, '/reference').replace(/\/$/, '')}/${name}`;

const routes = [
  ['home', '官网首页', 'brand-house.png'],
  ['upload', '上传材料', 'entry-upload.png'],
  ['report', '个性化报告', 'entry-report.png'],
  ['tutor', 'AI 私教', 'entry-tutor.png'],
  ['review', '短回访', 'entry-review.png'],
  ['parent', '家长中心', 'entry-parent.png'],
  ['map', '今晚路线', 'entry-map.png'],
  ['lobster', '龙虾 AI 教师', 'hero-mascot.png']
];
const mobileLabels = { home: '首页', tutor: '私教', review: '回访', parent: '家长', upload: '上传' };
const state = { active: 'home', progress: WEB_DEMO_STATE.progress, uploads: WEB_DEMO_STATE.uploads };
const progressAssetById = {
  upload: 'entry-upload.png',
  report: 'entry-report.png',
  tutor: 'entry-tutor.png',
  review: 'entry-review.png',
  parent: 'entry-parent.png',
  map: 'entry-map.png'
};
const routeMapAsset = 'learning-route-map-transparent.png';

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
  if (/上传|材料|文件|错题|成绩|测评|pdf|照片/.test(text)) return 'upload';
  if (/报告|分析|画像|导出|证据/.test(text)) return 'report';
  if (/私教|ai|答疑|第一步|苏格拉底|追问/.test(text)) return 'tutor';
  if (/回访|复盘|变式|记忆|迁移|验证/.test(text)) return 'review';
  if (/家长|家庭|父母|今晚问什么/.test(text)) return 'parent';
  if (/龙虾|ai教师|教师|陪伴|共屏|跟进|lobster/.test(text)) return 'lobster';
  if (/地图|路线|路径|任务|目标|7天/.test(text)) return 'map';
  return 'home';
}

function renderShellNav() {
  document.querySelector('#sideNav').innerHTML = routes.map(([id, label, image]) => (
    `<a href="#${id}" class="${state.active === id ? 'active' : ''}"><img src="${referenceAsset(image)}" alt="">${label}</a>`
  )).join('');
  document.querySelector('#mobileNav').innerHTML = routes
    .filter(([id]) => ['home', 'tutor', 'review', 'parent', 'upload'].includes(id))
    .map(([id, label, image]) => `<a href="#${id}" class="${state.active === id ? 'active' : ''}"><img src="${referenceAsset(image)}" alt="">${mobileLabels[id] || label}</a>`)
    .join('');
}

function pageGuide(id) {
  const guide = WEB_PAGE_GUIDES[id];
  if (!guide) return '';
  return `<section class="page-guide card"><h2>${guide.title}</h2><div class="guide-steps">${guide.steps.map(([n, title, desc]) => `<div><i>${n}</i><b>${title}</b><p>${desc}</p></div>`).join('')}</div><button class="soft-button" data-route="${guide.cta[0]}">${guide.cta[1]}</button></section>`;
}

function sceneSwitch(activeId) {
  if (activeId === 'home') return '';
  return `<section class="web-scene-switch card" aria-label="核心入口切换">${routes.filter(([id]) => id !== 'home' && id !== 'lobster').map(([id, label, image]) => `<button class="${id === activeId ? 'active' : ''}" type="button" data-route="${id}"><img src="${referenceAsset(image)}" alt=""><span>${label}</span></button>`).join('')}</section>`;
}

function rightRail() {
  const progressCard = `<article class="rail-card rail-progress"><div class="card-head"><h3>今日进度</h3><a href="#parent">更多</a></div><div class="progress-summary"><div class="ring"><b>60%</b></div><div><span>今晚闭环</span><strong>3 / 5 步</strong></div></div><ol class="step-list">${state.progress.map((item) => `<li class="${item.done ? 'done' : item.active ? 'active' : 'todo'}"><img src="${referenceAsset(progressAssetById[item.id] || 'entry-map.png')}" alt=""><b>${item.label}</b><em>${item.done ? '已完成' : item.active ? '进行中' : '待完成'}</em></li>`).join('')}</ol></article>`;
  const evidenceCard = `<article class="rail-card rail-evidence-card"><div class="card-head"><h3>已上传证据</h3><a href="#upload">管理</a></div><div class="evidence-strip visual">${[['试卷','2份','entry-upload.png'],['错题','18题','entry-review.png'],['反馈','3份','entry-report.png'],['观察','2份','entry-parent.png']].map(([label, value, image]) => `<span><img src="${referenceAsset(image)}" alt=""><b>${label}</b><small>${value}</small></span>`).join('')}</div></article>`;
  return `${progressCard}${evidenceCard}<article class="rail-card warm"><h3>今晚只做一件事</h3><p>先让孩子说出第一步，再进入练习和回访。</p></article>`;
}

function renderHome() {
  return `<section class="official-hero"><article><span class="eyebrow">原点智学官网</span><h1>把孩子今晚该做的第一步讲清楚</h1><p>原点智学从真实材料出发，生成家长看得懂、孩子能执行、AI 私教能继续追问的学习闭环。</p><div class="hero-actions"><button class="primary-cta" type="button" data-route="upload">上传材料体验</button><button class="soft-button" type="button" data-route="report">查看报告样例</button></div><div class="proof-row"><span>测评</span><span>错题</span><span>成绩</span><span>反馈</span><span>家长观察</span></div></article><img class="official-hero-art" src="${referenceAsset('hero-mascot.png')}" alt="原点智学 AI 学习伙伴"></section><section class="page-title home-title-row"><h1>从一个入口走完整个闭环</h1><a href="#map">看今晚路线</a></section><section class="entry-grid">${WEB_ENTRY_CARDS.map((card) => `<button class="entry-card ${card.tone}" type="button" data-route="${card.id}"><img class="entry-visual" src="${referenceAsset(card.image)}" alt=""><div class="entry-copy"><strong>${card.number}</strong><h2>${card.title}</h2><p>${card.desc}</p></div><span class="jump">进入</span></button>`).join('')}</section><section class="learning-route card"><div class="card-head"><h3>今晚学习路线</h3><span>预计 15-20 分钟</span></div><div class="route-line visual">${state.progress.map((item) => `<button type="button" data-route="${item.id}" class="${item.done ? 'done' : item.active ? 'active' : 'todo'}"><img src="${referenceAsset(progressAssetById[item.id] || 'entry-map.png')}" alt=""><b>${item.label}</b><small>${item.done ? '已完成' : item.active ? '进行中' : '待完成'}</small></button>`).join('')}</div><button class="primary-cta" type="button" data-route="tutor">继续 AI 第一问</button></section>`;
}

function renderUpload() {
  return `<section class="page-title"><div><h1>上传材料</h1><p>上传不是文件柜，而是证据链入口。先把材料分清楚，报告和私教才有依据。</p></div><button class="soft-button" data-action="mock-upload">选择文件</button></section>${sceneSwitch('upload')}<section class="upload-console"><article class="upload-drop card"><div><h2>把试卷、测评、错题或反馈放进来</h2><p>支持图片、PDF、Word 和文字摘要。无法自动解析的材料会进入人工确认，不中断后续流程。</p><div class="upload-format-row"><span>图片<small>JPG / PNG</small></span><span>PDF<small>测评报告</small></span><span>Word<small>老师反馈</small></span><span>文本<small>家长观察</small></span></div><button class="primary-cta" data-action="mock-upload">选择文件</button></div><img class="upload-art-img" src="${referenceAsset('upload-folder-stack-transparent.png')}" alt="上传材料"></article></section>${pageGuide('upload')}<section><div class="section-title"><h2>材料分类</h2><p>分类越准，报告里的证据来源越清楚。</p></div><div class="type-grid upload-type-row">${[['测评报告','形成学习画像起点','entry-report.png'],['成绩单','验证学科优先级','entry-upload.png'],['错题照片','定位概念、审题和计算错因','entry-review.png'],['学校反馈','补充课堂状态','entry-parent.png']].map(([title, desc, image]) => `<button class="type-card visual" data-action="select-material"><img src="${referenceAsset(image)}" alt=""><b>${title}</b><span>${desc}</span></button>`).join('')}</div></section><section class="intake-pipeline card"><h2>上传后的标准 SOP</h2><div class="guide-steps">${WEB_MATERIAL_PIPELINE.map(([title, desc], index) => `<div><i>${index + 1}</i><b>${title}</b><p>${desc}</p></div>`).join('')}</div></section>`;
}

function renderReport() {
  const evidence = [['成绩单', '数学单元测验 82 分', '计算仍有失分。'], ['错题本', '条件漏读 12 道', '失分集中在审题和步骤表达。'], ['老师反馈', '课堂表达积极', '适合讲出来学。']];
  return `<section class="page-title report-title"><div><h1>个性化报告</h1><p>先看证据，再看天赋、成绩与学习方法如何匹配。</p></div><button class="soft-button" data-action="print-report">下载 PDF 报告</button></section>${sceneSwitch('report')}<section class="report-hero pro card"><article class="student-id-card"><div><h2>小明（四年级）</h2><p>原点智学样例档案</p><div class="report-meta"><span>资料 <b>12</b> 项</span><span>周期 <b>7</b> 天</span><span>置信度 <b>较高</b></span></div></div><img src="${referenceAsset('report-radar-card-illustration.png')}" alt="报告证据"></article><article class="ability-panel"><h3>能力画像</h3><p>优势在逻辑推理，短板在多步题审题和计算稳定性。</p><button class="soft-button mini" data-action="share-report">分享给家长</button></article></section><section class="evidence-band card"><div class="card-head"><h3>证据来源</h3><button class="soft-button mini" data-action="share-report">生成分享链接</button></div><div class="evidence-band-grid">${evidence.map(([title, score, note]) => `<article><b>${title}</b><strong>${score}</strong><p>${note}</p></article>`).join('')}</div></section><section class="confidence-board card"><h2>置信度边界</h2><div class="confidence-grid">${WEB_CONFIDENCE_BANDS.map(([title, source, rule]) => `<article><b>${title}</b><span>${source}</span><p>${rule}</p></article>`).join('')}</div></section>${pageGuide('report')}`;
}

function renderTutor() {
  return `<section class="page-title"><div><h1>AI 私教</h1><p>只追问第一步、依据和反例，不代写完整答案。</p></div><button class="soft-button" data-route="review">去短回访</button></section>${sceneSwitch('tutor')}<section class="tutor-lab"><article class="chat-card card"><div class="chat-head"><img src="${referenceAsset('tutor-socratic-board-transparent.png')}" alt=""><div><h2>苏格拉底第一问</h2><p>先让孩子说出准备从哪里开始。</p></div></div><div class="chat-window"><div class="bubble coach">这道题问“一共”，你先准备把哪些数量放在一起？</div><div class="bubble me">我先算三种彩带一共有多少米。</div><div class="bubble coach">很好。那你会先写哪一个式子？为什么？</div></div><div class="chat-actions"><button class="soft-button" data-action="tutor-stuck">我卡住了</button><button class="soft-button" data-action="tutor-hint">给一点提示</button><button class="soft-button" data-action="tutor-retry">再试一次</button></div><div class="input-line"><input id="tutorInput" placeholder="写下你的第一步"><button data-action="send-tutor">发送</button></div></article><article class="problem-board card"><h3>题目与思路板</h3><p>红色 45 米、蓝色 27 米、黄色 18 米彩带，一共买了多少米？</p><b>先想：要求“一共”，要把哪些数量合并？</b></article></section>${pageGuide('tutor')}`;
}

function renderReview() {
  return `<section class="page-title review-title"><div><h1>短回访</h1><p>3 分钟回访，把错因变成主动回忆、迁移和变式证据。</p></div><article class="review-buddy-card"><img src="${referenceAsset('review-world-map-transparent.png')}" alt="短回访地图"><div><b>今天还有 12 个知识点</b><span>先回忆，再变式，最后复盘。</span></div></article></section>${sceneSwitch('review')}<section class="review-world card"><img class="review-world-art" src="${referenceAsset('review-world-map-transparent.png')}" alt=""><div class="world-node node-1 done"><img src="${referenceAsset('entry-report.png')}" alt=""><b>主动回忆</b><em>已完成</em></div><div class="world-node node-2 active"><img src="${referenceAsset('entry-review.png')}" alt=""><b>变式验证</b><em>进行中</em></div><button class="world-rule-button" data-action="review-map-info">查看规则</button></section>${pageGuide('review')}<section class="recall-module-grid">${[['主动回忆','entry-report.png'],['迁移验证','entry-map.png'],['变式验证','entry-review.png'],['错因复盘','entry-tutor.png']].map(([title, image]) => `<button class="recall-module-card" data-action="review-level" data-level="${title}"><img src="${referenceAsset(image)}" alt=""><h3>${title}</h3><p>留下可回流的学习证据。</p><span>开始验证</span></button>`).join('')}</section><section class="review-evidence-flow card"><div class="section-title compact"><h2>证据回流</h2><p>每一次短回访都回到错因、回忆或迁移证据。</p></div><button class="soft-button" data-action="review-evidence" data-level="变式验证">记录变式证据</button><button class="primary-cta review-main-cta" data-action="start-review">开始今天的短回访</button></section>`;
}

function renderParent() {
  return `<section class="page-title parent-title"><div><h1>家长中心</h1><p>这里不是杂项入口，只回答三件事：发生了什么、孩子卡在哪里、今晚问什么。</p></div><span class="data-chip">更新：今天 20:30</span></section>${sceneSwitch('parent')}<section class="parent-proof-summary"><article class="student-parent-card card"><div class="student-face"><img src="${referenceAsset('family-avatar-group-transparent.png')}" alt="家庭画像"></div><div><h2>小明（四年级）</h2><p>数学本周复盘</p><strong>孩子不是不会学，是方法还没有稳定匹配。</strong></div><img class="parent-mini-mascot" src="${referenceAsset('gudian-fullbody-transparent.png')}" alt="咕点"></article></section>${pageGuide('parent')}<section class="parent-proof-console card"><div class="card-head"><h3>证据判断台</h3><button class="soft-button mini" data-action="parent-proof-all">查看全部证据</button></div><div class="parent-proof-grid">${[['课堂练习','正确率 86%','entry-report.png'],['错题巩固','已订正 12 道','entry-review.png'],['AI 私教','对话 9 次','entry-tutor.png'],['知识掌握','掌握 23 个','entry-map.png']].map(([title, main, image]) => `<article><img src="${referenceAsset(image)}" alt=""><div><h3>${title}</h3><b>${main}</b></div></article>`).join('')}</div><button class="soft-button" data-action="parent-proof">查看修复记录</button></section><section class="parent-action-grid"><article class="tonight-question card"><h2>今晚该问什么？</h2><ol><li>今天你学到最有意思的是什么？</li><li>哪道题一开始没想到，后来怎么想通的？</li><li>哪个知识点还不熟，想再练一练？</li></ol><button class="primary-cta" data-action="parent-question">保存今晚问题</button><button class="soft-button" data-action="parent-methods">查看陪学方法</button></article></section>`;
}

function renderMap() {
  const route = [['upload', '01', '材料上传', '已完成', 'entry-upload.png', 'done'], ['report', '02', '报告生成', '已完成', 'entry-report.png', 'done'], ['tutor', '03', 'AI 点拨', '进行中', 'entry-tutor.png', 'active'], ['review', '04', '短回访', '即将开始', 'entry-review.png', 'todo'], ['parent', '05', '家长复盘', '待安排', 'entry-parent.png', 'todo'], ['map', '06', '周目标达成', '待完成', 'entry-map.png', 'todo']];
  return `<section class="page-title map-title"><div><h1>今晚路线</h1><p>把今晚闭环和未来 7 天路径放在一张图里。</p></div></section>${sceneSwitch('map')}<section class="learning-road card"><img class="learning-road-art" src="${referenceAsset(routeMapAsset)}" alt=""><div class="road-head"><h2>小明的专属学习旅程</h2><span>本周第 3 天</span></div>${route.map(([id, num, title, status, image, stateName], index) => `<button class="road-stop stop-${index + 1} ${stateName}" data-route="${id}"><b>${num}</b><strong>${title}</strong><em>${status}</em><img src="${referenceAsset(image)}" alt=""></button>`).join('')}<div class="road-cheer"><img src="${referenceAsset('gudian-fullbody-transparent.png')}" alt="咕点"><p>完成本周路径后，会生成一条清晰的成长记录。</p><button class="soft-button" data-route="review">查看成长记录</button></div></section>${pageGuide('map')}`;
}

function renderLobster() {
  const cards = [
    ['家长龙虾', '接收成绩、错题、老师反馈和家长观察，生成今晚陪学动作。', 'entry-parent.png', 'lobster-parent-demo'],
    ['孩子龙虾', '在家长设备上共屏追问第一步，不要求孩子独立账号。', 'entry-tutor.png', 'lobster-coview'],
    ['主动跟进', '安排今晚第一步、明天短回访和周末家长报告。', 'entry-map.png', 'lobster-followup']
  ];
  return `<section class="page-title lobster-title"><div><h1>龙虾 AI 教师</h1><p>Web-only 新产品入口：家长龙虾和孩子龙虾合成一个家长设备里的 AI 教师。</p></div><a class="soft-button" href="/lobster.html">打开独立配置入口</a></section><section class="lobster-hero card"><article><span class="data-chip">家长设备优先</span><h2>保留家长和孩子双侧能力，但交付成一个 AI 教师。</h2><p>家长负责配置和查看报告，孩子只在共屏模式里说第一步；系统补上情绪陪伴、主动跟进和证据回流。</p><div class="lobster-actions"><button class="primary-cta" data-action="lobster-configure">配置家庭龙虾</button><button class="soft-button" data-action="lobster-coview">试用孩子共屏</button></div></article><img src="${referenceAsset('hero-mascot.png')}" alt="龙虾 AI 教师"></section><section class="lobster-teacher-grid">${cards.map(([title, desc, image, action]) => `<article class="card lobster-teacher-card"><img src="${referenceAsset(image)}" alt=""><div><b>${title}</b><p>${desc}</p><button class="soft-button mini" data-action="${action}">打开</button></div></article>`).join('')}</section>`;
}

function renderContent() {
  if (state.active === 'upload') return renderUpload();
  if (state.active === 'report') return renderReport();
  if (state.active === 'tutor') return renderTutor();
  if (state.active === 'review') return renderReview();
  if (state.active === 'parent') return renderParent();
  if (state.active === 'map') return renderMap();
  if (state.active === 'lobster') return renderLobster();
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
  showToast('报告分享链接已生成，可以发给家长或合作老师。');
}

function handleAction(action, target) {
  if (action === 'mock-upload') showToast('已打开上传入口：支持测评、成绩、错题和反馈材料。');
  else if (action === 'select-material') showToast('已选择材料类型，后续进入证据分级。');
  else if (action === 'print-report') { showToast('正在准备 PDF 报告预览。'); window.print(); }
  else if (action === 'share-report') shareReport();
  else if (action === 'send-tutor') showToast(`已记录第一步：${document.querySelector('#tutorInput')?.value || '先圈条件'}`);
  else if (action === 'tutor-stuck') showToast('已切换到更小提示：只问下一步。');
  else if (action === 'tutor-hint') showToast('提示：先圈出已知条件，再说要求什么。');
  else if (action === 'tutor-retry') showToast('已重置思路板，可以重新说第一步。');
  else if (action === 'start-review') showToast('短回访已开始：先回忆，再核对。');
  else if (action === 'review-map-info') showToast('规则：每一步都要留下回忆或迁移证据。');
  else if (action === 'review-level') showToast(`已进入${target?.dataset.level || '回访验证'}。`);
  else if (action === 'review-evidence') showToast('已记录变式证据。');
  else if (action === 'parent-question') showToast('今晚问题已保存，明天会回访证据。');
  else if (action === 'parent-proof') showToast('已打开本周修复证据。');
  else if (action === 'parent-proof-all') showToast('已展开全部学习证据。');
  else if (action === 'parent-methods') showToast('已打开家长陪学方法清单。');
  else if (action === 'lobster-configure') { showToast('正在打开龙虾配置。'); window.location.href = '/lobster.html'; }
  else if (action === 'lobster-coview') showToast('孩子共屏模式已准备。');
  else if (action === 'lobster-parent-demo') showToast('家长教师台已生成。');
  else if (action === 'lobster-followup') showToast('主动跟进计划已打开。');
  else if (action === 'student-menu') showToast('当前为小明（四年级）样例档案。');
  else if (action === 'notifications') showToast('今日有 3 条学习提醒。');
  else if (action === 'family-menu') showToast('已进入小明家庭视角。');
}

function bindSearch() {
  document.querySelector('.search-box input').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    setActive(routeForSearch(event.currentTarget.value));
  });
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

function bindEvents() {
  bindActions();
  bindSearch();
}

function render() {
  renderShellNav();
  document.querySelector('#appContent').innerHTML = renderContent();
  document.querySelector('#rightRail').innerHTML = rightRail();
  document.title = `${WEB_SURFACE_ROUTES.find((route) => route.id === state.active)?.label || '原点智学'} · 原点智学`;
}

window.addEventListener('hashchange', () => {
  state.active = routeFromHash();
  render();
});

state.active = routeFromHash();
bindEvents();
render();
