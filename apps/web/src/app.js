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
  ['review', '复习游戏', 'entry-review.png'],
  ['parent', '家长中心', 'entry-parent.png'],
  ['map', '学习地图', 'entry-map.png']
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
  progress: [
    ['upload', '上传资料', 'done'],
    ['report', '生成报告', 'done'],
    ['tutor', '说第一步', 'active'],
    ['review', '3分钟回访', 'todo'],
    ['parent', '家长查看', 'todo']
  ],
  uploads: [
    ['数学期中成绩单.pdf', '成绩单', '2.4 MB', '分析完成'],
    ['语文老师反馈.docx', '学校反馈', '1.1 MB', '分析中'],
    ['错题本照片.jpg', '错题照片', '3.6 MB', '分析完成']
  ]
};

const entryCards = [
  ['upload', '上传资料', '文档、试卷、错题先进入证据链', 'entry-upload.png', 'green'],
  ['report', '个性化报告', '学习表现分析，薄弱点与建议', 'entry-report.png', 'blue'],
  ['tutor', 'AI私教', '智能答疑与讲解，先追问第一步', 'entry-tutor.png', 'green'],
  ['review', '复习游戏', '趣味闯关练习，记得牢更开心', 'entry-review.png', 'yellow'],
  ['parent', '家长中心', '学习监督与报告，一起见证成长', 'entry-parent.png', 'orange'],
  ['map', '学习地图', '查看学习路线、任务进度与目标', 'entry-map.png', 'green']
];

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
  if (/上传|资料|文件|错题|成绩/.test(text)) return 'upload';
  if (/报告|测评|天赋|分析|pdf/.test(text)) return 'report';
  if (/私教|ai|答疑|第一步|题/.test(text)) return 'tutor';
  if (/地图|路径|路线|任务|目标/.test(text)) return 'map';
  if (/复习|游戏|回访|挑战/.test(text)) return 'review';
  if (/家长|家庭|父母|证据/.test(text)) return 'parent';
  return 'home';
}

function mascotImage(className = '') {
  return `<img class="mascot-img ${className}" src="${referenceAsset('hero-mascot.png')}" alt="咕点">`;
}

function pageGuide(id) {
  const guides = {
    upload: ['资料进入证据链', [['1', '分类材料', '区分测评、成绩、错题和观察'], ['2', '提取证据', '只把可解析内容放进报告'], ['3', '进入闭环', '报告指向今晚第一步']]],
    report: ['报告解释逻辑', [['1', '先看依据', '测评是起点，不是定论'], ['2', '交叉验证', '成绩和错题优先级更高'], ['3', '落到方法', '每条建议都能执行']]],
    tutor: ['私教对话边界', [['1', '不直接给答案', '先追问第一步'], ['2', '追问依据', '让孩子讲为什么'], ['3', '生成回访', '明天再验证是否迁移']]],
    review: ['复习游戏闭环', [['1', '主动回忆', '不看答案说出来'], ['2', '小变式', '验证是否真正迁移'], ['3', '家长确认', '只问一个证据问题']]],
    parent: ['家长支持方式', [['1', '先放心', '看见孩子优势'], ['2', '看证据', '知道问题边界'], ['3', '做一件事', '今晚只推进一小步']]],
    map: ['学习地图路径', [['1', '今晚路线', '只看当前最小闭环'], ['2', '未来 7 天', '把回访和变式排进节奏'], ['3', '回流家长', '每一步都有证据可看']]]
  };
  const guide = guides[id];
  if (!guide) return '';
  return `<section class="page-guide card"><h2>${guide[0]}</h2><div class="guide-steps">${guide[1].map(([n, t, d]) => `<div><i>${n}</i><b>${t}</b><p>${d}</p></div>`).join('')}</div></section>`;
}

function renderShellNav() {
  document.querySelector('#sideNav').innerHTML = routes
    .map(([id, label, image]) => `<a href="#${id}" class="${state.active === id ? 'active' : ''}"><img src="${referenceAsset(image)}" alt="">${label}</a>`)
    .join('');
  document.querySelector('#mobileNav').innerHTML = routes
    .filter(([id]) => id !== 'map')
    .map(([id, label, image]) => `<a href="#${id}" class="${state.active === id ? 'active' : ''}"><img src="${referenceAsset(image)}" alt="">${mobileLabels[id] || label}</a>`)
    .join('');
}

function rightRail() {
  const progressCard = `
    <article class="rail-card rail-progress">
      <div class="card-head"><h3>今日进度</h3><a href="#parent">更多 →</a></div>
      <div class="progress-summary"><div class="ring"><b>60%</b></div><div><span>今日目标</span><strong>3 / 5 步</strong></div></div>
      <ol class="step-list">${state.progress.map(([id, label, status], index) => `<li class="${status}"><span>${status === 'done' ? '✓' : index + 1}</span><b>${label}</b><em>${status === 'done' ? '已完成' : status === 'active' ? '进行中' : '待完成'}</em></li>`).join('')}</ol>
    </article>`;

  const evidenceCard = `
    <article class="rail-card rail-evidence-card">
      <div class="card-head"><h3>已上传证据</h3><a href="#upload">管理 →</a></div>
      <div class="evidence-strip"><span>试卷<small>2份</small></span><span>错题<small>18题</small></span><span>反馈<small>3份</small></span><span>观察<small>2份</small></span></div>
    </article>`;

  const genericCards = `${progressCard}${evidenceCard}
    <article class="rail-card"><h3>连续学习</h3><div class="streak"><strong>7</strong><span>天</span><p>保持短周期反馈，孩子会更愿意继续。</p></div></article>
    <article class="rail-card warm"><h3>家长小提醒</h3><p>今晚不要追问分数，先问：这道题你读懂了什么？需要我帮你检查哪里？</p></article>`;

  const rails = {
    upload: `${progressCard}
      <article class="rail-card rail-focus-card green"><b>资料完整度</b><strong>75%</strong><p>成绩、错题和测评已具备，可以生成报告；补充老师反馈后置信度更高。</p></article>
      <article class="rail-card"><h3>分类优先级</h3><div class="rail-list"><span>天赋测评 <em>画像起点</em></span><span>成绩单 <em>真实表现</em></span><span>错题照片 <em>卡点证据</em></span></div></article>
      <article class="rail-card warm"><h3>下一步</h3><p>上传后先进入证据链，不直接下结论；报告会标注每条判断来自哪里。</p></article>`,
    report: `${evidenceCard}
      <article class="rail-card rail-focus-card blue"><b>报告可信度</b><strong>较高</strong><p>测评只做假设，成绩和错题负责交叉验证，避免把标签当定论。</p></article>
      <article class="rail-card"><h3>方法匹配</h3><div class="rail-tags"><span>费曼复述</span><span>苏格拉底追问</span><span>错因归因</span><span>变式训练</span></div></article>
      <article class="rail-card warm"><h3>家长先看</h3><p>先看优势和待开发点，再看今晚只做哪一个动作。</p></article>`,
    tutor: `<article class="rail-card rail-focus-card orange"><b>本题关联弱点</b><strong>多步计算顺序</strong><p>合并同类数量时容易遗漏或重复，先说第一步比直接算答案更重要。</p></article>
      <article class="rail-card"><h3>相关知识点</h3><div class="rail-list"><span>三位数加法 <em>不进位/进位</em></span><span>加法意义 <em>合并与应用</em></span><span>应用题审题 <em>已知/所求</em></span></div></article>
      <article class="rail-card"><h3>推荐回访</h3><div class="rail-list soft"><span>3天后回访 <em>巩固本节知识</em></span><span>7天后回访 <em>综合应用提升</em></span></div></article>
      <article class="rail-card warm"><h3>家长可见摘要</h3><p>孩子已能说出“一共”要合并数量，下一步重点是列式和检查。</p></article>`,
    review: `${progressCard}
      <article class="rail-card rail-focus-card yellow"><b>今日挑战</b><strong>12 个知识点</strong><p>只奖励真实回忆和迁移，不奖励机械刷题。</p></article>
      <article class="rail-card"><h3>复习覆盖点</h3><div class="rail-tags"><span>主动回忆</span><span>小变式</span><span>错因复盘</span><span>家长确认</span></div></article>
      <article class="rail-card warm"><h3>规则</h3><p>先回忆，再变式，最后把结果回流到家长中心。</p></article>`,
    parent: `${evidenceCard}
      <article class="rail-card rail-focus-card green"><b>今晚只问一件事</b><strong>你第一步怎么想？</strong><p>从催促转为观察，先让孩子讲思路，再决定是否需要帮助。</p></article>
      <article class="rail-card"><h3>家长支持方式</h3><div class="rail-list"><span>观察者 <em>记录卡点</em></span><span>支持者 <em>给短反馈</em></span><span>确认者 <em>看证据</em></span></div></article>
      <article class="rail-card warm"><h3>下一步行动</h3><p>保存今晚问题后，明天自动进入3分钟回访。</p></article>`,
    map: `${progressCard}
      <article class="rail-card rail-focus-card blue"><b>本周路径</b><strong>3 / 6</strong><p>当前停在 AI 点拨，完成后进入复习回访和家长复盘。</p></article>
      <article class="rail-card"><h3>未来 7 天</h3><div class="rail-list"><span>5/19 <em>复习回访</em></span><span>5/20 <em>薄弱专项</em></span><span>5/22 <em>家长复盘</em></span></div></article>
      <article class="rail-card warm"><h3>路径原则</h3><p>每个节点都能跳转到可执行页面，避免长下拉堆信息。</p></article>`
  };

  return rails[state.active] || genericCards;
}

function rightRailLegacy() {
  return `
    <article class="rail-card">
      <div class="card-head"><h3>今日进度</h3><a href="#parent">更多 →</a></div>
      <div class="progress-summary"><div class="ring"><b>60%</b></div><div><span>今日目标</span><strong>3 / 5 步</strong></div></div>
      <ol class="step-list">${state.progress.map(([id, label, status], index) => `<li class="${status}"><span>${status === 'done' ? '✓' : index + 1}</span><b>${label}</b><em>${status === 'done' ? '已完成' : status === 'active' ? '进行中' : '待完成'}</em></li>`).join('')}</ol>
    </article>
    <article class="rail-card">
      <div class="card-head"><h3>已上传证据</h3><a href="#upload">管理 →</a></div>
      <div class="evidence-strip"><span>试卷<small>2份</small></span><span>错题<small>18题</small></span><span>反馈<small>3份</small></span><span>观察<small>2份</small></span></div>
    </article>
    <article class="rail-card"><h3>连续学习</h3><div class="streak"><strong>7</strong><span>天</span><p>保持短周期反馈，孩子会更愿意继续。</p></div></article>
    <article class="rail-card warm"><h3>家长小提醒</h3><p>今晚不要追问分数，先问：这道题你读懂了什么？需要我帮你检查哪里？</p></article>
  `;
}

function radarCard() {
  return `<article class="report-preview card"><div class="card-head"><h3>个性化报告 <small>预览</small></h3><a href="#report">查看完整报告 →</a></div><div class="preview-body"><div class="radar-shape"></div><div class="tag-column"><b>优势</b><span>逻辑思维强</span><span>阅读理解好</span><b class="danger">待提升</b><span class="orange">计算准确率</span><span class="orange">审题习惯</span><p>下一步建议：先巩固计算准确率，3天后回访。</p></div></div></article>`;
}

function renderHome() {
  return `
    <section class="page-title home-title-row"><h1>今晚从哪一步开始？</h1><a href="#report">查看完整报告 →</a></section>
    <section class="hero-grid"><article class="buddy-message card"><div class="speech"><h2>晚上好，小明！</h2><p>今天坚持学习，就能离目标更近一步。</p><div class="chip-row"><span><i class="chip-dot"></i>连续学习 7 天</span><span>今晚 15-20 分钟</span></div></div><img class="mascot-img hero-avatar" src="${referenceAsset('hero-mascot.png')}" alt="咕点"></article>${radarCard()}</section>
    <section class="entry-grid">${entryCards.map(([id, title, desc, image, tone], index) => `<button class="entry-card ${tone}" type="button" data-route="${id}"><img class="entry-visual" src="${referenceAsset(image)}" alt=""><div class="entry-copy"><strong>${String(index + 1).padStart(2, '0')}</strong><h2>${title}</h2><p>${desc}</p></div><span class="jump">›</span></button>`).join('')}</section>
    <section class="learning-route card"><div class="card-head"><h3>今晚学习路线</h3><span>预计用时：15-20分钟</span></div><div class="route-line">${state.progress.map(([id, label, status], index) => `<button type="button" data-route="${id}" class="${status}"><i>${status === 'done' ? '✓' : index + 1}</i><b>${label}</b><small>${status === 'done' ? '已完成' : status === 'active' ? '进行中' : '待完成'}</small></button>`).join('')}</div><button class="primary-cta" type="button" data-route="tutor">继续今晚的第一步</button></section>
  `;
}

function renderUpload() {
  const materialTypes = [
    ['天赋测评', '皮纹、多元智能、学习风格，用来形成初始画像。', 'entry-report.png', 'green'],
    ['成绩单', '总分、单科、排名和趋势，用来交叉验证。', 'entry-upload.png', 'blue'],
    ['错题照片', '识别概念错、条件漏、模型错、计算错。', 'entry-review.png', 'orange'],
    ['学校反馈', '补充课堂状态、表达习惯和作业过程。', 'entry-parent.png', 'green'],
    ['家长观察', '记录动力、注意力、亲子沟通与作息。', 'hero-mascot.png', 'yellow'],
    ['测试卷', '验证是否会原题，还是能迁移。', 'entry-map.png', 'blue']
  ];
  return `<section class="page-title"><div><h1>上传资料</h1><p>把测评、成绩、错题和观察先分清楚，后续报告才有可信证据链。</p></div><button class="soft-button" data-action="mock-upload">选择文件</button></section><section class="upload-console"><article class="upload-drop card"><div><h2>拖拽文件到这里，或点击选择文件</h2><p>支持多文件同时上传，单个文件最大 100MB；无法解析会进入人工确认，不会中断生成流程。</p><div class="upload-format-row"><span>图片<small>JPG / PNG / JPEG</small></span><span>PDF<small>PDF 文档</small></span><span>Word<small>.doc / .docx</small></span><span>Excel<small>.xls / .xlsx</small></span></div><button class="primary-cta" data-action="mock-upload">选择文件</button><em>也可以拖拽文件到此区域</em></div><img class="upload-art-img" src="${referenceAsset('entry-upload.png')}" alt="上传资料"></article></section><section><div class="section-title"><h2>选择资料类型 <small>可多选</small></h2><p>分类越准，报告里的“证据来源”越清楚。</p></div><div class="type-grid upload-type-row">${materialTypes.slice(0, 5).map(([title, desc, image, tone]) => `<button class="type-card visual ${tone}" data-action="select-material"><img src="${referenceAsset(image)}" alt=""><b>${title}</b><span>${desc}</span></button>`).join('')}</div></section><section class="card table-card"><div class="card-head"><h3>最近上传的资料</h3><a href="#report">查看报告 →</a></div>${state.uploads.map(([file, type, size, status]) => `<div class="upload-row"><b>${file}<small>${size}</small></b><em>${type}</em><strong>${status}</strong><button data-route="report">查看</button></div>`).join('')}</section><section class="intake-pipeline card"><h2>上传后下一步</h2><div class="guide-steps"><div><i>1</i><b>资料解析</b><p>抽取孩子画像、成绩样本、错因和行为线索。</p></div><div><i>2</i><b>交叉验证</b><p>用真实表现修正测评标签，避免武断结论。</p></div><div><i>3</i><b>输出方案</b><p>跳到报告页，给家长一套可执行路径。</p></div></div></section>`;
}

function renderReport() {
  const evidence = [
    ['成绩单', '数学单元测验：92分', '逻辑推理题得分率高，计算题仍有失分。', 'green'],
    ['错题本', '条件漏读 12 道', '失分集中在审题、单位和步骤表达。', 'orange'],
    ['老师反馈', '课堂表达积极', '能主动提问，思路清晰，适合讲出来学。', 'green'],
    ['家长观察', '每日学习主动性好', '短任务完成稳定，长任务需要外部反馈。', 'yellow']
  ];
  const diagnostics = [
    ['天赋与优势', '逻辑思维强', '善于分析与归纳，表达清晰。', '数学', '语文', 'star'],
    ['当前学习状态', '良好', '专注度 82%，学习动力保持稳定。', '坚持 21 天', '短反馈有效', 'pulse'],
    ['方法匹配', '78%', '适配费曼复述、苏格拉底追问、错因归因。', '费曼', '追问', 'target'],
    ['待提升点', '先抓 3 个', '计算速度、审题细致度、知识迁移能力。', '审题', '迁移', 'chart'],
    ['下一步建议', '今晚一件事', '先讲清题目条件，再做一组小变式。', '10 分钟', '3 分钟回访', 'bulb']
  ];
  return `<section class="page-title report-title"><div><h1>个性化报告</h1><p>先看证据，再看天赋、成绩与方法如何匹配。</p></div><button class="soft-button" data-action="print-report">下载PDF报告</button></section><section class="report-hero pro card"><article class="student-id-card"><div class="student-avatar"><span>小</span></div><div><h2>小明（四年级）</h2><p>北京市朝阳区实验小学</p><div class="report-meta"><span>学习时长 <b>4.2</b> 小时/天</span><span>报告周期 <b>5/13-5/19</b></span><span>资料来源 <b>12</b> 项</span></div></div><img src="${referenceAsset('entry-report.png')}" alt="报告预览"></article><article class="ability-panel"><div class="card-head"><h3>能力雷达图</h3><span>本周水平</span></div><div class="radar-with-labels"><span>知识掌握</span><span>思维能力</span><span>学习习惯</span><span>学习动力</span><span>应用迁移</span><span>基础技能</span><div class="radar-shape strong"></div></div></article></section><section class="report-insight card"><div><h2>思维活跃、表达清晰，数学逻辑是你的闪光点！</h2><p>本周你在数学知识运用与逻辑推理方面表现优异，能灵活分析和解题；语文表达完整，思路清晰。继续保持，你会越来越稳。</p></div><img src="${referenceAsset('hero-mascot.png')}" alt="咕点鼓励"></section><section class="evidence-band card"><div class="section-title compact"><h2>证据来源</h2><p>多维数据综合分析，不把测评标签当成最终定论。</p></div><div class="evidence-band-grid">${evidence.map(([label, title, desc, tone]) => `<article class="${tone}"><b>${label}</b><strong>${title}</strong><p>${desc}</p></article>`).join('')}</div></section><section class="diagnostic-grid">${diagnostics.map(([label, title, desc, tag1, tag2, icon]) => `<article class="diagnostic-card card ${icon}"><div class="diagnostic-icon"></div><h3>${label}</h3><strong>${title}</strong><p>${desc}</p><div class="tag-row"><span class="tag">${tag1}</span><span class="tag">${tag2}</span></div></article>`).join('')}</section><section class="method-match card pro"><div><h2>天赋 × 成绩 × 方法</h2><p>测评提出学习画像假设，成绩和错题负责验证，最后只推荐能被今晚执行和明天回访的方法。</p></div><div class="match-flow"><span>听觉理解好</span><i></i><span>数学波动</span><i></i><span>条件漏读</span><i></i><span>复述+追问</span></div><button class="primary-cta" data-action="share-report">分享报告</button></section><section class="report-bottom-grid"><article class="tonight-plan card"><h2>今晚建议 <small>20分钟</small></h2><ol><li>完成计算专项练习（10分钟）</li><li>学习错题本：数学第3页-第5页（6分钟）</li><li>阅读理解一篇，并讲出第一步（4分钟）</li></ol><button class="primary-cta" data-route="tutor">开始今晚学习</button></article><article class="week-plan card"><h2>未来7天计划</h2><div class="week-grid mini">${['今 5/20', '二 5/21', '三 5/22', '四 5/23', '五 5/24', '六 5/25', '日 5/26'].map((item, index) => `<span class="${index === 0 ? 'active' : ''}">${item}</span>`).join('')}</div><p>本周目标：稳扎稳打，提升计算速度与阅读深度。</p><button class="soft-button" data-route="map">查看完整计划</button></article><article class="report-preview-tile card"><h2>报告预览</h2><div><img src="${referenceAsset('entry-report.png')}" alt="报告预览"><p>完整报告包含测评、成绩、错题证据和个性化练习建议。</p></div><button class="soft-button" data-action="print-report">下载PDF报告</button></article></section>`;
}

function renderTutor() {
  return `<section class="page-title tutor-title"><div><h1>AI私教 <small>/ 先说第一步</small></h1><p>不直接给答案，先追问、再引导，让孩子把思路讲出来。</p></div></section><section class="tutor-lab"><article class="chat-card tutor-chat card"><div class="chat-head"><img class="chat-avatar" src="${referenceAsset('hero-mascot.png')}" alt="咕点"><div><h2>咕点</h2><p>你的 AI 私教，像朋友一样陪你想。</p></div><span>AI</span></div><div class="bubble coach">嗨，小明！遇到难题很正常，我们一起一步一步想清楚。先说说你打算怎么做？</div><div class="bubble me">我先算一共用了多少米彩带。</div><div class="bubble coach">很好，这是解决问题的关键步骤。你打算把哪几部分加在一起？</div><div class="bubble me">我准备把45米、27米和18米加起来。</div><div class="bubble coach">思路对了。那你打算怎么加？可以用列竖式，也可以估一估先看看大概结果。</div><div class="chat-actions"><button class="soft-button" data-action="tutor-stuck">我有点卡住</button><button class="soft-button" data-action="tutor-hint">给我一点提示</button><button class="soft-button" data-action="tutor-retry">我想再试一次</button></div><div class="input-line"><input id="tutorInput" placeholder="告诉我你的想法..."><button data-action="send-tutor">发送</button></div><p class="tutor-boundary">不会直接给答案，会一步步引导你自己找到方法。</p></article><article class="problem-board card"><div class="card-head"><h3>题目与思路板</h3><button class="soft-button mini" data-action="tutor-hint">全屏</button></div><div class="problem-card"><span>应用题</span><p>学校要布置活动场地，买了三种颜色的彩带，红色45米，蓝色27米，黄色18米。一共买了多少米彩带？</p><b>先想想：要求“一共”，该把哪些数量合并在一起？</b></div><div class="board-and-ladder"><div class="thinking-canvas"><h3>我的思路</h3><div class="canvas-empty">在这里写下你的想法、步骤或计算过程。可以手写、画图或列式。</div><div class="canvas-tools"><span>手写输入</span><span>拍照上传</span><span>画图工具</span></div></div><div class="hint-ladder"><h3>提示阶梯</h3><ol><li class="active"><b>第1步（已解锁）</b><p>先理解题意：要求的是“什么”？</p></li><li><b>第2步（待解锁）</b><p>想想要把哪几部分数量合在一起。</p></li><li><b>第3步（待解锁）</b><p>可以怎样计算三个数的和？</p></li><li><b>第4步（待解锁）</b><p>检查结果是否合理。</p></li></ol></div></div></article></section><section class="tutor-growth card"><div><h2>你已经很棒了！</h2><p>每一次思考，都是进步的脚印。</p></div><div class="growth-steps"><span class="done">开启思考</span><span class="done">理解题意</span><span class="active">提出思路</span><span>尝试计算</span><span>检查反思</span></div><div class="growth-meter"><b>本题思维成长值 +20</b><i><em></em></i><span>60 / 100</span></div></section>`;
}

function renderReview() {
  const levels = [
    ['回忆关', '巩固基础，快速回忆', 'entry-report.png', 'green', '奖励 10 星'],
    ['迁移关', '学以致用，灵活迁移', 'entry-map.png', 'blue', '奖励 15 星'],
    ['变式挑战', '多样变式，拓展思维', 'entry-review.png', 'yellow', '奖励 20 星'],
    ['连击复盘', '错因复盘，精准突破', 'entry-tutor.png', 'orange', '奖励 25 星']
  ];
  const miniGames = [
    ['错题消消乐', '消除错题，赢取星星', '1250 星', 'entry-review.png', '去挑战'],
    ['知识拼拼乐', '拼出知识点亮图鉴', '24/56', 'entry-report.png', '去挑战'],
    ['速算快跑', '限时冲刺算力爆发', '01:12', 'entry-map.png', '去挑战'],
    ['记忆翻翻卡', '翻牌记忆，配对挑战', '28 关', 'entry-parent.png', '去挑战']
  ];
  return `<section class="page-title review-title"><div><h1>复习游戏</h1><p>3分钟回访，把错因变成闯关挑战。</p></div><article class="review-buddy-card"><img src="${referenceAsset('hero-mascot.png')}" alt="咕点"><div><b>嗨，小明！</b><span>今天有 12 个知识点等你来闯关。</span></div></article></section><section class="review-world card"><div class="world-path"><span></span></div><div class="world-node node-1 done"><img src="${referenceAsset('entry-report.png')}" alt=""><b>回忆关</b><em>已完成</em></div><div class="world-node node-2 done"><img src="${referenceAsset('entry-map.png')}" alt=""><b>迁移关</b><em>已完成</em></div><div class="world-node node-3 active"><img src="${referenceAsset('entry-review.png')}" alt=""><b>变式挑战</b><em>进行中</em></div><div class="world-node node-4"><img src="${referenceAsset('entry-tutor.png')}" alt=""><b>连击复盘</b><em>5 星解锁</em></div><div class="world-node node-5 locked"><span>★</span><b>终极宝箱</b><em>待解锁</em></div><button class="world-rule-button" data-action="review-map-info">查看规则</button></section><section class="level-card-grid">${levels.map(([title, desc, image, tone, reward], index) => `<button class="level-card ${tone}" data-action="${index === 2 ? 'review-level' : 'review-level'}" data-level="${title}"><img src="${referenceAsset(image)}" alt=""><h3>${title}</h3><p>${desc}</p><small>${reward}</small><span>开始挑战</span></button>`).join('')}</section><section class="review-mini-games card"><div class="section-title compact"><h2>趣味小游戏</h2><p>每个小游戏都必须回到错因、回忆或迁移证据。</p></div><div class="mini-game-grid">${miniGames.map(([title, desc, metric, image, cta], index) => `<button class="mini-game-card" data-action="${index === 2 ? 'review-challenge' : 'review-level'}" data-level="${index === 2 ? '变式挑战' : title}"><img src="${referenceAsset(image)}" alt=""><div><h3>${title}</h3><p>${desc}</p><strong>${metric}</strong></div><span>${cta}</span></button>`).join('')}</div><button class="primary-cta review-main-cta" data-action="start-review">开始今天的挑战</button></section>`;
}

function renderParent() {
  const evidence = [
    ['课堂练习', '正确率 86%', '18 次', 'entry-report.png'],
    ['错题巩固', '已订正 12 道', '正确率 83%', 'entry-review.png'],
    ['AI 私教互动', '对话 9 次', '掌握度提升', 'entry-tutor.png'],
    ['知识掌握', '掌握 23 个', '薄弱 6 个', 'entry-map.png']
  ];
  return `<section class="page-title parent-title"><div><h1>家长中心 <small>/ 证据与下一步</small></h1><p>看懂孩子为什么卡住，今晚只做一件有效的事。</p></div><span class="data-chip">数据更新：今天 20:30</span></section><section class="parent-dashboard"><article class="student-parent-card card"><div class="student-face"><img src="${referenceAsset('entry-parent.png')}" alt="孩子画像"></div><div><h2>小明（四年级）</h2><p>人教版 · 数学</p><strong>“今天继续进步，继续加油！”</strong></div><img class="parent-mini-mascot" src="${referenceAsset('hero-mascot.png')}" alt="咕点"></article><article class="weekly-overview card"><h2>本周学习概览 <small>4.28 - 5.4</small></h2><div class="overview-metrics"><span><i class="blue-dot"></i><b>5.6</b>小时<em>较上周 +1.2 小时</em></span><span><i class="green-dot"></i><b>18</b>/24<em>较上周 +4</em></span><span><i class="orange-dot"></i><b>84%</b><em>较上周 +6%</em></span></div></article></section><section class="evidence-summary card"><div class="card-head"><h3>证据汇总（本周）</h3><button class="soft-button mini" data-action="parent-evidence-all">查看全部证据</button></div><div class="parent-evidence-grid">${evidence.map(([title, main, sub, image]) => `<article><img src="${referenceAsset(image)}" alt=""><div><h3>${title}</h3><b>${main}</b><p>${sub}</p></div></article>`).join('')}</div></section><section class="parent-action-grid"><article class="tonight-question card"><h2>今晚该问什么</h2><div class="family-visual"><img src="${referenceAsset('entry-parent.png')}" alt="家长陪伴"></div><ol><li>今天你学到的最有意思的是什么？</li><li>哪一道题你一开始没想到，后来怎么想通的？</li><li>你觉得哪个知识点还不太熟，想再练一练？</li></ol><button class="primary-cta" data-action="parent-question">保存今晚问题</button></article><article class="method-advice card"><h2>方法建议 <small>今晚陪学小贴士</small></h2><ul><li><b>先复盘再学习：</b>先让孩子说思路，再看答案和解析。</li><li><b>用“讲给你听”：</b>让孩子把思路讲给你听，能更好发现盲点。</li><li><b>错题本回顾：</b>从错题中挑 2-3 道，一起再做一次。</li><li><b>鼓励具体：</b>具体表扬孩子的努力或策略，会更有效。</li></ul><button class="soft-button" data-action="parent-methods">查看更多方法建议</button></article></section><section class="parent-bottom-grid"><article class="trend-card card"><h2>本周变化趋势</h2><div class="trend-chart"><span></span><span></span><span></span><span></span><span></span></div><p>学习时长和正确率同步提升，说明短周期反馈有效。</p></article><article class="fixed-points card"><h2>已修复卡点</h2><p>三角形面积计算、小数加减法、应用题审题。</p><button class="soft-button" data-action="parent-evidence">查看全部修复记录</button></article><article class="watch-list card"><h2>待关注问题</h2><p>两位数乘两位数进位、单位换算、长方形周长应用题。</p><button class="soft-button" data-action="parent-evidence-all">去专项练习</button></article></section>`;
}

function renderMap() {
  const route = [
    ['upload', '01', '资料上传', '已完成', 'entry-upload.png', 'done'],
    ['report', '02', '报告生成', '已完成', 'entry-report.png', 'done'],
    ['tutor', '03', 'AI点拨', '进行中', 'entry-tutor.png', 'active'],
    ['review', '04', '复习回访', '即将开始', 'entry-review.png', 'todo'],
    ['parent', '05', '家长复盘', '待安排', 'entry-parent.png', 'todo'],
    ['map', '06', '周目标达成', '即将开始', 'entry-map.png', 'todo']
  ];
  return `<section class="page-title map-title"><div><h1>学习地图 <small>/ 看见本周路径，也看见下一站</small></h1></div></section><section class="learning-road card"><div class="road-head"><h2>小明的专属学习旅程</h2><span>四年级 · 本周第 3 天</span></div><div class="road-line"></div>${route.map(([id, num, title, status, image, stateName], index) => `<button class="road-stop stop-${index + 1} ${stateName}" data-route="${id}"><b>${num}</b><strong>${title}</strong><em>${status}</em><img src="${referenceAsset(image)}" alt=""></button>`).join('')}<div class="road-cheer"><img src="${referenceAsset('hero-mascot.png')}" alt="咕点"><p>你已完成 2 个关键节点，继续加油！完成本周全部路径，可获得学习探索者勋章。</p><button class="soft-button" data-route="review">查看勋章</button></div></section><section class="map-info-grid"><article class="task-list card"><h2>本周任务清单 <small>3/6 已完成</small></h2><ul><li class="done">上传学科资料（数学）<span>已完成</span></li><li class="done">查看并确认个性化报告<span>已完成</span></li><li class="active">完成AI点拨练习（12题）<span>6/12 进行中</span></li><li>复习回访（预计5/19）<span>待开始</span></li><li>参加家长复盘会<span>待开始</span></li><li>达成本周目标（5/5步）<span>待开始</span></li></ul><button class="soft-button" data-route="upload">查看全部任务</button></article><article class="reminder-card card"><h2>关键节点提醒</h2><div class="reminder-list"><span>复习回访将在 2 天后开始<small>5月19日（周一）</small></span><span>家长复盘会待预约<small>建议本周末前完成</small></span><span>周目标还差 2 步<small>完成全部路径可获得勋章</small></span></div><button class="soft-button" data-route="parent">去设置提醒</button></article><article class="future-path card"><h2>未来 7 天路径</h2><ol>${['5/18 AI点拨练习继续进行', '5/19 复习回访日', '5/20 薄弱知识专项突破', '5/21 知识巩固挑战', '5/22 家长复盘会', '5/23 冲刺周目标', '5/24 总结与表彰'].map((item, index) => `<li class="${index === 0 ? 'active' : ''}">${item}</li>`).join('')}</ol><button class="soft-button" data-route="review">查看完整日程</button></article><article class="achievement-card card"><h2>学习成就</h2><div class="badge-row"><span>探索者</span><span>连续7天</span><span>认真复盘</span></div><p>连续学习 7 天，累计完成练习 38 题，知识掌握提升 12%。</p><button class="soft-button" data-route="report">查看全部成就</button></article></section>`;
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

function bindSearch() {
  const input = document.querySelector('.search-box input');
  if (!input) return;
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') setActive(routeForSearch(input.value));
  });
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
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 1400);
}

function shareReport() {
  showToast('报告分享链接已准备');
}

function handleAction(action, target) {
  if (action === 'mock-upload') showToast('已模拟选择文件，等待分类');
  if (action === 'select-material') showToast(`已选择资料类型：${target.textContent.trim().slice(0, 12)}`);
  if (action === 'print-report') { showToast('正在准备 PDF 导出'); window.print(); }
  if (action === 'share-report') shareReport();
  if (action === 'send-tutor') showToast('已记录孩子的第一步');
  if (action === 'tutor-stuck') showToast('已切换到更小提示');
  if (action === 'tutor-hint') showToast('提示：先圈出已知条件');
  if (action === 'tutor-retry') showToast('已换成追问依据');
  if (action === 'start-review') showToast('复习挑战已开始');
  if (action === 'review-map-info') showToast('奖励只来自真实回忆');
  if (action === 'review-level') showToast(`${target.dataset.level || '当前关卡'}已选中`);
  if (action === 'review-challenge') showToast(`${target.dataset.level || '挑战'}已打开`);
  if (action === 'parent-question') showToast('今晚家长问题已保存');
  if (action === 'parent-evidence') showToast('已打开核心证据');
  if (action === 'parent-evidence-all') showToast('已打开全部证据');
  if (action === 'parent-methods') showToast('已打开方法建议');
}

function bindActions() {
  document.querySelectorAll('[data-route]').forEach((el) => el.addEventListener('click', () => setActive(el.dataset.route)));
  document.querySelectorAll('[data-action]').forEach((el) => el.addEventListener('click', () => handleAction(el.dataset.action, el)));
}

function render() {
  state.active = routeFromHash();
  if (!routes.some(([id]) => id === state.active)) state.active = 'home';
  renderShellNav();
  document.querySelector('#appContent').innerHTML = renderContent();
  document.querySelector('#rightRail').innerHTML = rightRail();
  bindActions();
  bindSearch();
}

window.addEventListener('hashchange', render);
render();

// Contract snippets for existing checks:
// WEB_SURFACE_ROUTES WEB_DEMO_STATE WEB_ENTRY_CARDS WEB_PAGE_GUIDES WEB_MATERIAL_PIPELINE WEB_CONFIDENCE_BANDS web-app-asset-base
// pageGuide('upload') pageGuide('report') pageGuide('tutor') pageGuide('review') pageGuide('parent')
