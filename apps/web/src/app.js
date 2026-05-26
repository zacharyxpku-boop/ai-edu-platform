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

function mascot(extra = '') {
  return `<div class="mascot ${extra}" role="img" aria-label="咕点"></div>`;
}

const navIcons = {
  home: '⌂',
  upload: '⇧',
  report: '▤',
  tutor: '☻',
  review: '🎮',
  parent: '♙'
};

const state = WEB_DEMO_STATE;
const entries = WEB_ENTRY_CARDS;
const pageGuides = WEB_PAGE_GUIDES;
const materialPipeline = WEB_MATERIAL_PIPELINE;
const confidenceBands = WEB_CONFIDENCE_BANDS;

function setActive(id) {
  state.active = WEB_SURFACE_ROUTES.some((route) => route.id === id) ? id : 'home';
  location.hash = state.active;
  render();
}

function routeFromHash() {
  return (location.hash || '#home').replace('#', '') || 'home';
}

function iconArt(type) {
  if (type === 'folder') return '<div class="folder-art"><i></i><b></b><span>⬆</span></div>';
  if (type === 'report') return '<div class="paper-art"><i></i><b></b><span></span></div>';
  if (type === 'bot') return '<div class="bot-art"><i></i><b></b></div>';
  if (type === 'game') return '<div class="game-art"><i></i><b></b><span></span></div>';
  if (type === 'family') return '<div class="family-art"><i></i><b></b><span></span></div>';
  if (type === 'map') return '<div class="map-art"><i></i><b></b><span></span></div>';
  return '<div class="paper-art"></div>';
}

function pageGuide(id) {
  const guide = pageGuides[id];
  if (!guide) return '';
  return `
    <section class="page-guide card" aria-label="${guide.title}">
      <div class="guide-title">
        <span>${guide.title}</span>
        <button type="button" data-route="${guide.cta[0]}">${guide.cta[1]}</button>
      </div>
      <div class="guide-steps">
        ${guide.steps.map(([num, title, desc]) => `
          <div>
            <i>${num}</i>
            <b>${title}</b>
            <p>${desc}</p>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function progressRail() {
  return `
    <article class="rail-card">
      <div class="card-head"><h3>今日进度</h3><a href="#parent">更多 ›</a></div>
      <div class="progress-summary">
        <div class="ring" style="--value:60"><b>60%</b></div>
        <div><span>今日目标</span><strong>3 / 5 步</strong></div>
      </div>
      <ol class="step-list">
        ${state.progress.map((item, index) => `
          <li class="${item.done ? 'done' : ''} ${item.active ? 'active' : ''}">
            <span>${item.done ? '✓' : index + 1}</span>
            <b>${item.label}</b>
            <em>${item.done ? '已完成' : item.active ? '进行中' : '待完成'}</em>
          </li>
        `).join('')}
      </ol>
    </article>
  `;
}

function evidenceRail() {
  return `
    <article class="rail-card">
      <div class="card-head"><h3>已上传证据</h3><a href="#upload">管理 ›</a></div>
      <div class="evidence-strip">
        <span class="mini-doc blue">成绩单<small>2份</small></span>
        <span class="mini-doc orange">错题照片<small>18题</small></span>
        <span class="mini-doc green">老师反馈<small>3份</small></span>
        <span class="mini-doc yellow">家长观察<small>2份</small></span>
      </div>
    </article>
  `;
}

function streakRail() {
  return `
    <article class="rail-card">
      <div class="card-head"><h3>连续学习</h3><a href="#review">规则 ›</a></div>
      <div class="streak"><strong>7</strong><span>天</span><p>太棒了！继续保持 👏</p></div>
      <div class="week-dots">${['一','二','三','四','五','六','日'].map((d, i) => `<span class="${i < 6 ? 'checked' : ''}"><b>${d}</b><i>${i < 6 ? '✓' : ''}</i></span>`).join('')}</div>
    </article>
  `;
}

function parentTipRail() {
  return `
    <article class="rail-card warm">
      <div class="card-head"><h3>家长小提醒</h3></div>
      <div class="parent-tip">
        <p>今晚建议多关注孩子的审题习惯，可以问：这道题你读懂了什么？需要我帮你检查哪里？</p>
        <img src="${asset('family-report.png')}" alt="家长提醒" />
      </div>
    </article>
  `;
}

function defaultRightRail() {
  return progressRail() + evidenceRail() + streakRail() + parentTipRail();
}

function radarChart() {
  return `
    <div class="radar">
      <svg viewBox="0 0 220 180" role="img" aria-label="能力雷达图">
        <polygon class="grid" points="110,12 196,58 196,124 110,168 24,124 24,58" />
        <polygon class="grid inner" points="110,44 166,74 166,108 110,138 54,108 54,74" />
        <polygon class="shape" points="110,35 168,70 158,118 111,145 54,115 60,72" />
        <circle cx="110" cy="35" r="4" /><circle cx="168" cy="70" r="4" /><circle cx="158" cy="118" r="4" /><circle cx="111" cy="145" r="4" /><circle cx="54" cy="115" r="4" /><circle cx="60" cy="72" r="4" />
      </svg>
      <span class="r1">知识理解</span><span class="r2">思维能力</span><span class="r3">学习习惯</span><span class="r4">学习动力</span><span class="r5">应用迁移</span><span class="r6">基础技能</span>
    </div>
  `;
}

function renderHome() {
  return `
    <section class="hero-grid">
      <div class="hero-copy">
        <h1>今晚从哪一步开始？</h1>
        <div class="buddy-message">
          ${mascot('mascot-hero')}
          <p>嗨，小明！我们一起把学习变得更简单有趣，从今天的第一步开始吧！</p>
        </div>
        <div class="mobile-launchboard" aria-label="产品入口">
          ${entries.map((entry) => `
            <button type="button" data-route="${entry.id === 'map' ? 'review' : entry.id}" class="${entry.tone}">
              <strong>${entry.number}</strong>
              <span>${entry.title}</span>
            </button>
          `).join('')}
        </div>
      </div>
      <article class="report-preview">
        <div class="card-head"><h3>个性化报告 <small>预览</small></h3><a href="#report">查看完整报告 ›</a></div>
        <div class="preview-body">
          ${radarChart()}
          <div class="tag-column">
            <b>优势</b><span>逻辑思维</span><span>阅读理解</span>
            <b class="danger">待提升</b><span class="orange">计算准确率</span><span class="orange">审题习惯</span>
            <p>下一步建议：先巩固计算准确率，3天后回访。</p>
          </div>
        </div>
      </article>
    </section>
    <section class="entry-grid">
      ${entries.map((entry) => `
        <button class="entry-card ${entry.tone}" type="button" data-route="${entry.id === 'map' ? 'review' : entry.id}">
          ${iconArt(entry.icon)}
          <div>
            <strong>${entry.number}</strong>
            <h2>${entry.title}</h2>
            <p>${entry.desc}</p>
          </div>
          <span class="jump">›</span>
        </button>
      `).join('')}
    </section>
    <section class="learning-route card">
      <div class="card-head"><h3>今晚学习路线</h3><span>预计用时：15-20分钟</span></div>
      <div class="route-line">
        ${state.progress.map((step, index) => `
          <button type="button" data-route="${step.id}" class="${step.done ? 'done' : ''} ${step.active ? 'active' : ''}">
            <i>${step.done ? '✓' : index + 1}</i><b>${step.label}</b><small>${step.done ? '已完成' : step.active ? '进行中' : '待完成'}</small>
          </button>
        `).join('')}
      </div>
      <button class="primary-cta" type="button" data-route="tutor">▶ 继续今晚的第一步</button>
    </section>
  `;
}

function renderUpload() {
  const types = [
    ['天赋测评', '天赋测评报告、潜能评估等', 'green'],
    ['成绩单', '期中/期末成绩单、各科成绩表', 'blue'],
    ['错题照片', '错题本、试卷错题部分', 'orange'],
    ['学校反馈', '老师评语、通知单、评估表', 'yellow'],
    ['家长观察', '日常表现记录、兴趣特长等', 'purple']
  ];
  return `
    <section class="page-title"><h1>上传资料</h1><p>上传孩子的学习资料，系统将智能分析并生成个性化学习建议</p></section>
    ${pageGuide('upload')}
    <section class="upload-drop card">
      <div class="upload-illustration">${iconArt('folder')}</div>
      <div>
        <h2>拖拽或点击上传</h2>
        <p>支持图片、PDF、Word、Excel 等格式，单文件不超过 50MB</p>
        <button class="soft-button" type="button" data-action="mock-upload">📁 选择文件</button>
      </div>
    </section>
    <section class="intake-pipeline card">
      <div>
        <span>标准化处理</span>
        <h3>不管材料是否标准，都先进同一条证据流水线</h3>
      </div>
      <div class="pipeline-steps">
        ${materialPipeline.map(([title, desc], index) => `
          <article>
            <i>${index + 1}</i>
            <b>${title}</b>
            <p>${desc}</p>
          </article>
        `).join('')}
      </div>
    </section>
    <section class="material-types">
      <div class="section-head"><h3>选择资料类型</h3><a>如何选择资料？</a></div>
      <div class="type-grid">
        ${types.map(([title, desc, tone]) => `<button class="type-card ${tone}" type="button" data-action="select-material" data-material="${title}"><i></i><b>${title}</b><span>${desc}</span><em></em></button>`).join('')}
      </div>
    </section>
    <section class="card table-card">
      <h3>最近上传</h3>
      <div class="upload-table">
        ${state.uploads.map((item) => `
          <div class="upload-row">
            <span class="thumb ${item.color}"></span>
            <b>${item.file}<small>${item.size}</small></b>
            <em class="${item.color}">${item.type}</em>
            <strong>${item.status}</strong>
            <button type="button" data-route="report">查看报告</button>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function renderReport() {
  return `
    <section class="page-title report-title">
      <div><h1>个性化报告 <span>预览</span></h1><p>基于多维数据分析，为小明量身定制学习画像与成长建议</p></div>
      <div class="report-actions"><button type="button" data-action="print-report">⇩ 下载报告</button><button type="button" class="green" data-action="share-report">分享报告</button></div>
    </section>
    ${pageGuide('report')}
    <section class="student-banner card">
      <span class="avatar large">小</span>
      <div><h2>小明（四年级）</h2><p>活泼好奇，思维敏捷</p><small>学科范围：语文、数学、英语 · 分析周期：近30天 · 资料来源：5类28份</small></div>
      <strong>思维活跃，表达清晰，数学逻辑是你的闪光点！</strong>
      ${mascot('mascot-report')}
    </section>
    <section class="evidence-flow card" aria-label="证据到行动链路">
      ${[
        ['01', '材料证据', '成绩单、错题、老师反馈先分层，不把单一测评当结论。'],
        ['02', '学习信号', '数学逻辑强，但计算细心和审题稳定性拉低发挥。'],
        ['03', '方法匹配', '先说第一步 + 费曼复述 + 第7天变式迁移。'],
        ['04', '产品动作', '进入AI私教追问，再用复习游戏验证记忆和迁移。']
      ].map(([num, title, desc]) => `
        <div class="flow-step">
          <i>${num}</i>
          <b>${title}</b>
          <p>${desc}</p>
        </div>
      `).join('')}
    </section>
    <section class="report-grid">
      <article class="card">${radarChart()}<div class="ability-list"><b>优势项</b><span>思维能力 优秀</span><span>应用迁移 良好</span><span>学习动力 良好</span><b class="danger">待提升项</b><span class="orange">基础技能 待提升</span><span class="orange">学习习惯 待提升</span></div></article>
      <article class="card evidence-card">
        <h3>证据来源</h3>
        <div class="evidence-badges"><span>成绩单 2份</span><span>错题本 18题</span><span>老师反馈 2条</span><span>家长观察 3条</span></div>
        <ul><li>数学应用题正确率达85%，逻辑推理表现突出。</li><li>错题集中在计算粗心与单位换算问题。</li><li>课堂发言积极，能清晰表达思路。</li></ul>
        <div class="evidence-callout">
          <b>方法匹配</b>
          <p>当前证据更支持「先说第一步 + 复述 + 变式回访」的组合，而不是直接把孩子贴成固定标签。</p>
        </div>
      </article>
    </section>
    <section class="confidence-board card">
      <div class="confidence-head">
        <span>证据置信度</span>
        <h3>报告先说明“我们凭什么判断”，再给学习方法</h3>
      </div>
      <div class="confidence-grid">
        ${confidenceBands.map(([level, source, usage], index) => `
          <article class="confidence-card level-${index + 1}">
            <i>${index + 1}</i>
            <b>${level}</b>
            <span>${source}</span>
            <p>${usage}</p>
          </article>
        `).join('')}
      </div>
    </section>
    <section class="insight-row">
      ${[
        ['⭐','天赋与优势','潜力点：数学思维'],
        ['❤','当前学习状态','状态：稳定向上'],
        ['🧩','方法匹配','匹配度：高'],
        ['📈','待提升点','优先级：高'],
        ['➡','下一步建议','立即行动']
      ].map(([icon,title,line]) => `<article class="mini-insight card"><i>${icon}</i><b>${title}</b><p>${line}</p></article>`).join('')}
    </section>
    <section class="bottom-panels">
      <article class="card tonight"><h3>今晚建议</h3><p>花15-20分钟，轻松进步！</p><div class="task-chip">完成5道单位换算练习，做、说、升</div><button class="primary-cta" data-route="tutor">开始练习</button></article>
      <article class="card week-plan"><h3>未来7天计划</h3><div class="week-dots big">${['一','二','三','四','五','六','日'].map((d, i) => `<span class="${i < 4 ? 'checked' : ''}"><b>周${d}</b><i>${i < 4 ? '✓' : ''}</i></span>`).join('')}</div><button class="soft-button" type="button" data-route="review">查看完整计划</button></article>
      <article class="card report-thumb"><h3>报告预览</h3><div class="report-paper">${radarChart()}</div><button class="soft-button" type="button" data-route="report">查看完整报告</button></article>
    </section>
  `;
}

function renderTutor() {
  return `
    <section class="tutor-head">
      <div><h1>AI私教</h1><p>先说第一步，我来追问和引导</p></div>
      ${mascot('mascot-tutor')}
      <div class="stats-card"><span>当前题目<b>3/5</b></span><span>已完成追问<b>2轮</b></span><span>今日点拨时长<b>12分钟</b></span></div>
    </section>
    ${pageGuide('tutor')}
    <section class="tutor-layout">
      <article class="chat-card card">
        <div class="ai-status"><img src="${asset('gudian-mascot.png')}" alt="" />咕点AI正在引导思考中...</div>
        ${[
          ['ai','小明，我们来一起想这道题 😊<br>你先说说这题的第一步是什么？你从哪里开始想的？'],
          ['me','我想先算出每捆有多少根。'],
          ['ai','很好，这是一个不错的起点！那你打算用什么方法来算每捆有多少根呢？'],
          ['me','我准备用除法。'],
          ['ai','很棒！那你列出的算式是什么呢？先写出你的算式，我们再看看下一步。']
        ].map(([who, text]) => `<div class="msg ${who}"><span>${who === 'ai' ? `<img src="${asset('gudian-mascot.png')}" alt="">` : '小'}</span><p>${text}</p></div>`).join('')}
        <div class="quick-actions"><button type="button" data-action="tutor-stuck">我有点卡住</button><button type="button" data-action="tutor-hint">给我一点提示</button><button type="button" data-action="tutor-retry">我想再试一次</button><button type="button" data-route="report">回到报告建议</button></div>
        <label class="chat-input"><input id="tutorInput" placeholder="试着输入你的想法吧，咕点会一步步引导你思考~" /><button type="button" data-action="send-tutor">发送</button></label>
      </article>
      <article class="board-card card">
        <div class="card-head"><h3>题目与思路板</h3><a>收起⌃</a></div>
        <div class="problem-box"><b>题目</b><p>学校买来84根跳绳，平均分给6个班，每个班分得几根？</p><div class="rope-art"></div></div>
        <div class="thinking-box"><b>我的思路</b><p>第一步：先算出每捆有多少根<br>84 ÷ 6 = ?（根）</p></div>
        <div class="hint-steps"><span class="active">提示1 我可以用什么方法来解决这道题？</span><span>提示2 要先解决什么问题？</span><span class="locked">提示3 除法算式应该怎么列？</span></div>
      </article>
    </section>
  `;
}

function renderReview() {
  return `
    <section class="review-head">
      <div><h1>🎮 复习游戏</h1><p>3分钟回访，把错因变成闯关挑战 ⭐</p></div>
      <div class="review-stats"><span>今日目标<b>3/5关</b></span><span>累计获得<b>28⭐</b></span></div>
    </section>
    ${pageGuide('review')}
    <section class="map-card card">
      <div class="card-head"><h3>闯关进度：已完成 2/6 关</h3><button>地图说明</button></div>
      <div class="game-map">
        ${['回忆关','迁移关','变式挑战','连击复盘','综合挑战'].map((name, index) => `<button class="level l${index + 1} ${index < 2 ? 'done' : index === 2 ? 'current' : 'locked'}"><b>${index + 1}</b><span>${name}</span></button>`).join('')}
        <span class="treasure">🎁</span>
      </div>
    </section>
    <section class="challenge-grid">
      ${[
        ['回忆关','快速回想课堂重点，牢固基础记忆','推荐','去挑战'],
        ['迁移关','把知识用到新情境，提升灵活运用','','去挑战'],
        ['变式挑战','变换题型与条件，突破易错点','当前','继续挑战'],
        ['连击复盘','针对错题连击巩固，彻底搞懂错因','','去挑战']
      ].map(([title, desc, tag, action]) => `<article class="challenge card"><em>${tag}</em><h3>${title}</h3><p>${desc}</p><div class="stars">★★★</div><button>${action}</button></article>`).join('')}
    </section>
    <section class="play-now card"><img src="${asset('review-sprout.png')}" alt="" /><b>3分钟回访，错因变经验！</b><button class="primary-cta" type="button" data-action="start-review">▶ 开始今天的挑战</button><span>02:59</span></section>
  `;
}

function renderParent() {
  return `
    <section class="parent-head">
      <div><h1>家长中心</h1><p>看得懂证据，也知道今晚怎么陪</p></div>
      <div class="family-hero-art" role="img" aria-label="家长中心"></div>
    </section>
    ${pageGuide('parent')}
    <section class="parent-grid">
      <article class="child-card card"><h3>孩子画像</h3><div class="child-row"><span class="avatar large">小</span><div><b>小明（四年级）</b><em>勤学乐思型</em><p>好奇心强，愿意尝试新方法，在理解力和表达上进步明显。</p></div></div><a>查看完整画像 ›</a></article>
      <article class="week-card card"><h3>本周进展</h3><div class="metric-row"><span>学习时长<b>5h36m</b><small>较上周 +18%</small></span><span>完成任务<b>16/20个</b><small>较上周 +2个</small></span><span>正确率<b>84%</b><small>较上周 +7%</small></span></div><p class="ok-line">本周达到目标，继续保持！💪</p></article>
      <article class="evidence-list card"><h3>证据汇总</h3>${['上传资料 8份','生成报告 6份','说第一步 3次','AI私教提问 12次'].map((x) => `<p><span>✓</span>${x}<a>查看›</a></p>`).join('')}<button>查看全部证据</button></article>
      <article class="question-card card"><h3>今晚该问什么</h3><p>晚饭后10分钟，高效了解孩子的学习情况</p><ol><li>今天最有成就感的一件事是什么？</li><li>哪个地方你还不太明白，可以说给我听吗？</li><li>明天你想先解决哪一个小问题？</li></ol><button type="button" data-action="parent-question">换一组问题</button></article>
      <article class="method-card card"><h3>方法建议</h3><ul><li>多用“追问”代替“告诉”。</li><li>把错题变成“资源”。</li><li>小目标加及时鼓励。</li></ul><a>查看全部方法建议 ›</a></article>
      <article class="chart-card card"><h3>本周变化</h3><div class="line-chart"><i></i><i></i><i></i><i></i><i></i><i></i></div></article>
    </section>
  `;
}

function pageById(id) {
  if (id === 'upload') return renderUpload();
  if (id === 'report') return renderReport();
  if (id === 'tutor') return renderTutor();
  if (id === 'review') return renderReview();
  if (id === 'parent') return renderParent();
  return renderHome();
}

function rightRailById(id) {
  if (id === 'upload') {
    return `
      <article class="rail-card stats"><h3>已上传资料统计</h3><div class="four-stats"><span>总文件数<b>12个</b></span><span>已完成分析<b>9个</b></span><span>分析中<b>2个</b></span><span>待分析<b>1个</b></span></div></article>
      <article class="rail-card">${progressCircle('资料完整度', 72)}<ul class="check-lines"><li>天赋测评 已上传</li><li>成绩单 已上传</li><li>错题照片 已上传</li><li>学校反馈 已上传</li><li class="warn">家长观察 推荐上传</li></ul></article>
      <article class="rail-card"><h3>上传后下一步</h3><p>智能分析资料进行多维度分析</p><p>生成个性化报告与学习建议</p><p>获取学习计划与资源</p></article>
      ${parentTipRail()}
    `;
  }
  if (id === 'report') {
    return progressRail() + `<article class="rail-card"><h3>关键收获</h3><ul class="reward-list"><li>数学逻辑是强项，保持优势继续冲！</li><li>表达清晰，课堂参与度高。</li><li>计算细心度提升后，成绩会更稳。</li></ul></article>` + parentTipRail();
  }
  if (id === 'tutor') {
    return `<article class="rail-card"><h3>本题关联弱点</h3><p>除法意义理解不足</p>${progressBar(58)}<ul class="check-lines"><li>平均分的含义理解 中等偏弱</li><li>除法算式的建立 中等偏弱</li><li>有余数问题的理解 良好</li></ul></article><article class="rail-card"><h3>推荐回访</h3><p>平均分问题思路梳理</p><p>除法算式怎样列？</p><p>练一练：平均分应用题</p></article><article class="rail-card warm"><h3>家长可见摘要</h3><p>小明在本题中能主动选择除法思路，但对“平均分”的意义理解还不够稳定，需要在“除法算式建立”上加强练习。</p></article>`;
  }
  if (id === 'review') {
    return streakRail() + `<article class="rail-card"><h3>今日奖励</h3><div class="reward-cards"><span>⭐<b>通过1关</b></span><span>💎<b>通过3关</b></span><span>🏆<b>通过5关</b></span></div></article><article class="rail-card">${progressCircle('复习覆盖点', 60)}<p>主要覆盖：小数加减法、平均分应用题、两位数乘两位数。</p></article><article class="rail-card warm"><h3>今日回访报告</h3><strong>82分</strong><p>较昨天提升12分。咕点建议：再巩固“应用题数量关系”。</p></article>`;
  }
  if (id === 'parent') {
    return `<article class="rail-card"><h3>学习概览</h3><div class="overview-grid"><span>35天<small>学习天数</small></span><span>84%<small>完成率</small></span><span>3个<small>需关注</small></span><span>12个<small>本周任务</small></span></div></article><article class="rail-card"><h3>今晚建议对话</h3><ol class="question-list"><li>今天哪个知识点最有趣？为什么？</li><li>遇到困难时，你是怎么想的？</li><li>如果明天继续学，你想先学什么？</li></ol></article><article class="rail-card"><h3>下一步行动</h3><p>完成《分数意义》练习题 预计15分钟</p><p>复习错题本：小数乘法 预计10分钟</p><p>口语表达练习 预计10分钟</p></article>${parentTipRail()}`;
  }
  return defaultRightRail();
}

function progressCircle(title, value) {
  return `<div class="progress-summary big"><div class="ring" style="--value:${value}"><b>${value}%</b></div><div><h3>${title}</h3><p>资料越完整，分析越准确</p></div></div>`;
}

function progressBar(value) {
  return `<div class="bar"><i style="width:${value}%"></i><b>${value}%</b></div>`;
}

function renderNav() {
  const nav = document.querySelector('#sideNav');
  const mobile = document.querySelector('#mobileNav');
  const items = WEB_SURFACE_ROUTES.map((route) => `
    <a href="#${route.id}" class="${state.active === route.id ? 'active' : ''}" data-route="${route.id}">
      <span>${navIcons[route.id]}</span>${route.label}
    </a>
  `).join('');
  nav.innerHTML = items;
  mobile.innerHTML = WEB_SURFACE_ROUTES.map((route) => `<a href="#${route.id}" class="${state.active === route.id ? 'active' : ''}"><span>${navIcons[route.id]}</span><b>${route.label.replace('首页总览','首页').replace('个性化报告','报告').replace('复习游戏','复习').replace('家长中心','家长')}</b></a>`).join('');
}

function bindRouteClicks() {
  document.querySelectorAll('[data-route]').forEach((node) => {
    node.addEventListener('click', (event) => {
      const route = event.currentTarget.dataset.route;
      if (!route) return;
      event.preventDefault();
      setActive(route);
    });
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
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2200);
}

function routeForSearch(value) {
  const keyword = value.trim().toLowerCase();
  if (!keyword) return null;
  if (keyword.includes('上传') || keyword.includes('资料') || keyword.includes('错题') || keyword.includes('成绩')) return 'upload';
  if (keyword.includes('报告') || keyword.includes('画像') || keyword.includes('天赋')) return 'report';
  if (keyword.includes('私教') || keyword.includes('ai') || keyword.includes('第一步') || keyword.includes('追问')) return 'tutor';
  if (keyword.includes('复习') || keyword.includes('游戏') || keyword.includes('回访') || keyword.includes('记忆')) return 'review';
  if (keyword.includes('家长') || keyword.includes('陪') || keyword.includes('问题')) return 'parent';
  return 'home';
}

function bindSearch() {
  const search = document.querySelector('.search-box input');
  if (!search || search.dataset.bound === '1') return;
  search.dataset.bound = '1';
  search.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const route = routeForSearch(search.value);
    if (!route) return;
    setActive(route);
    showToast(`已跳转到「${WEB_SURFACE_ROUTES.find((item) => item.id === route)?.label || '首页'}」`);
  });
}

async function shareReport() {
  const shareUrl = `${location.origin}${location.pathname}#report`;
  try {
    if (navigator.share) {
      await navigator.share({
        title: '原点智学个性化报告',
        text: '查看小明的证据链、方法匹配和下一步学习建议。',
        url: shareUrl
      });
      return;
    }
    await navigator.clipboard.writeText(shareUrl);
    showToast('报告链接已复制');
  } catch (_) {
    showToast('报告链接已准备好，可从地址栏复制');
  }
}

function handleAction(action, target) {
  if (action === 'mock-upload') {
    state.uploads.unshift({
      file: `${state.selectedMaterialType}_样例材料.pdf`,
      type: state.selectedMaterialType,
      size: '1.0MB',
      status: '已加入分析队列',
      color: 'green'
    });
    render();
    showToast('已模拟加入分析队列，稍后会进入报告证据');
    return;
  }
  if (action === 'select-material') {
    state.selectedMaterialType = target.dataset.material || '学习材料';
    showToast(`已选择材料类型：${state.selectedMaterialType}`);
    return;
  }
  if (action === 'print-report') {
    setActive('report');
    window.setTimeout(() => window.print(), 50);
    return;
  }
  if (action === 'share-report') {
    shareReport();
    return;
  }
  if (action === 'send-tutor') {
    const input = document.querySelector('#tutorInput');
    showToast(input?.value ? '已记录孩子的第一步想法' : '可以先写一句：我想先求什么');
    if (input) input.value = '';
    return;
  }
  if (action === 'tutor-stuck' || action === 'tutor-hint' || action === 'tutor-retry') {
    showToast('已切换为第一步追问，不会直接给完整答案');
    return;
  }
  if (action === 'start-review') {
    showToast('今日回访挑战已开始：先做回忆关，再做迁移关');
    return;
  }
  if (action === 'parent-question') {
    showToast('已换成更适合今晚的家长提问');
  }
}

function bindActions() {
  document.querySelectorAll('[data-action]').forEach((node) => {
    node.addEventListener('click', (event) => {
      event.preventDefault();
      handleAction(event.currentTarget.dataset.action, event.currentTarget);
    });
  });
}

function render() {
  state.active = routeFromHash();
  document.querySelector('#appContent').innerHTML = pageById(state.active);
  document.querySelector('#rightRail').innerHTML = rightRailById(state.active);
  renderNav();
  bindRouteClicks();
  bindActions();
  bindSearch();
}

window.addEventListener('hashchange', render);
render();
