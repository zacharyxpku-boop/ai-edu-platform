#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'docs', 'visual-audit');
fs.mkdirSync(outDir, { recursive: true });

const screens = [
  {
    id: '01-home-tonight',
    nav: 'home',
    titleNo: '01',
    titleText: '首页 / 作业点拨',
    screenClass: 'home',
    screenTitle: '错题先说想法，再闯一关',
    screenLead: '题目、作业、复习、错题都从这里开始。先写第一步，再进入作业点拨和游戏化练习。',
    pills: ['拍错题', '说想法', '拆错因', '轻回访'],
    primary: '开始作业点拨',
    secondary: '去轻回访',
    note: '空态：先写题目和你的第一步，不用写完整答案。',
    steps: ['拆错因', '玩一关', '复习回访', '留下思考证据'],
    cards: [
      { tone: 'priority', title: '轻练习', body: '把提示后的内容变成可回访的小练习。' },
      { tone: 'week', title: '修卡点', body: '把错题、原想法和错因沉淀成复习卡。' }
    ]
  },
  {
    id: '02-knowledge-challenge',
    nav: 'pack',
    titleNo: '02',
    titleText: '第二 Tab / 轻回访',
    screenClass: 'pack',
    screenTitle: '三种小游戏，吃掉不同知识点',
    screenLead: '短答案做轻练，概念做回忆，步骤看顺序。每一轮都写回错因和复习。',
    tabs: ['文本', '图片'],
    pills: ['速记轻练', '回忆答题', '顺序练习'],
    primary: '生成轻练习',
    secondary: '复习回访',
    note: '空态：还没有可闯材料。先粘贴真实作业、错题或笔记。',
    outputs: ['知识卡', '小测验', '复习计划', '错因卡'],
    helper: ['真实数量来自 API/Storage', '空态不展示假卡数', '生成后再进入复习']
  },
  {
    id: '03-review-challenge',
    nav: 'home',
    subpage: true,
    titleNo: '03',
    titleText: '子页 / 轻回访',
    screenClass: 'review',
    screenTitle: '5 分钟一关',
    screenLead: '先主动回忆，再看选项。答错只修一个关键错因。',
    levelPills: ['Lv.1 热身'],
    statPills: ['今日待复习', '空态先补卡'],
    primary: '开始这一关',
    secondary: '错了再看关键错因',
    question: '空态时先显示可开始的卡片和真实进度，不编题号。',
    options: ['A. 先回忆', 'B. 再选择', 'C. 看错因'],
    loop: ['先回忆', '再选择', '看一条错因', '进入下一次复习']
  },
  {
    id: '04-profile-growth',
    nav: 'profile',
    titleNo: '04',
    titleText: '第三 Tab / 我的学习战绩',
    screenClass: 'profile',
    screenTitle: '我的错因和回访记录',
    screenLead: '看见今天修了什么错、闯了几关、能分享哪张成长卡。不做假排名，只展示真实进步。',
    pills: ['学习身份卡', '邀请码', '同一关挑战'],
    primary: '晒成就卡',
    secondary: '挑战同一关',
    priorities: ['连续天和记录来自真实动作', '错因记录来自复习卡和思考证据', '未配置云同步前不展示同学榜'],
    summary: '完成一次真实任务后，这里生成可分享的学习身份卡。',
    stats: ['真实回访', '真实学习卡', '真实错因']
  },
  {
    id: '05-upload-homework',
    nav: 'home',
    subpage: true,
    titleNo: '05',
    titleText: '子页 / 学习任务清单',
    screenClass: 'upload',
    screenTitle: '先写学习任务清单',
    screenLead: '题型、数量、卡住哪里。写不完整也可以先生成本地判断，我会先判断必须做和可放过。',
    eyebrow: '作业分流',
    primary: '生成任务三分类',
    secondary: '先补一行真实任务',
    note: '空态：还没有学习任务清单。先粘贴真实任务，再生成三分类。',
    stats: ['空态 0 项', '真实数量待输入', '生成后再展示'],
    steps: ['写作业清单', '系统分出优先级', '只辅导必须做', '错因进入复习']
  },
  {
    id: '06-tutor-xiaodian',
    nav: 'home',
    subpage: true,
    titleNo: '06',
    titleText: '子页 / 作业点拨',
    screenClass: 'tutor',
    screenTitle: '你先说第一步',
    screenLead: '我不会直接替你写答案。你只要说题目、卡点，或者先写一步，我就继续往下带。',
    eyebrow: 'AI 学习伙伴',
    primary: '锁定必须做',
    secondary: '发送第一步',
    note: '空态：还没有对话。先说题目或第一步，下面才会出现真实聊天记录。',
    steps: ['先说一步', '只给最小提示', '说出错因', '留下一句复述证据'],
    cards: [
      { title: '带学原则', body: '先追问思路，再给提示，不替孩子写答案。' },
      { title: '别急着要答案', body: '遇到直接求答案，会先拉回“你先说第一步”。' }
    ]
  },
  {
    id: '07-learning-radar',
    nav: 'profile',
    subpage: true,
    titleNo: '07',
    titleText: '子页 / 今晚先看这一点',
    screenClass: 'radar',
    screenTitle: '先做这一题型',
    screenLead: '这页不制造焦虑，只回答一个问题：今晚先从哪一步开始。',
    eyebrow: '先看什么',
    primary: '去作业点拨',
    secondary: '看学习证据',
    stats: ['空态：还没有进展数据', '完成任务后再展示', '真实统计来自记录'],
    steps: ['锁定今晚卡点', '安排必须做', '记录学习反馈', '下次排序更准']
  },
  {
    id: '08-diagnosis-snap',
    nav: 'home',
    subpage: true,
    titleNo: '08',
    titleText: '子页 / 三问先看第一步',
    screenClass: 'diagnosis',
    screenTitle: '先看看卡在哪里',
    screenLead: '不用做整套卷。回答 3 个小问题，再补成绩和作业，我会先猜最该修的点。',
    eyebrow: '3 个问题先定位',
    primary: '生成今晚第一步安排',
    secondary: '补充成绩和作业',
    steps: ['旧知识是什么', '第一步怎么做', '换条件还会吗', '生成下一步安排'],
    note: '空态时只显示可开始的问题，不提前写结论。'
  },
  {
    id: '09-module-session',
    nav: 'pack',
    subpage: true,
    titleNo: '09',
    titleText: '子页 / 学习小局',
    screenClass: 'module',
    screenTitle: '现在就做这一小局',
    screenLead: '把一个方法练成能复述、能迁移、能进入复习卡的学习资产。',
    eyebrow: '学习小局',
    primary: '进入作业点拨',
    secondary: '完成并加入复习',
    steps: ['读题先定位', '写出第一步', '说清错因', '加入轻回访'],
    note: '空态：先把真实材料放进来，再生成学习小局。'
  }
];

function css() {
  return `
    *{box-sizing:border-box}
    body{margin:0;background:#d9ceb9;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif;color:#0f2019}
    .gallery{display:grid;grid-template-columns:1fr;gap:32px;padding:24px;justify-content:center;max-width:430px;margin:0 auto}
    .gallery-card{display:grid;gap:14px}
    .gallery-meta{padding:0 8px;color:#5f584f;font-size:13px;font-weight:700;letter-spacing:.02em}
    .phone{position:relative;width:100%;max-width:390px;height:844px;padding:20px;background:#f4ecdc;border-radius:36px;box-shadow:0 32px 60px rgba(71,56,31,.22);margin:0 auto}
    .phone::before{content:"";position:absolute;inset:16px;border-radius:28px;border:1px solid rgba(140,111,66,.18);pointer-events:none}
    .screen{position:relative;width:100%;height:100%;border-radius:28px;background:#fff;overflow:hidden;padding:18px 18px 112px}
    .status{display:flex;justify-content:space-between;align-items:center;color:#14251d;font-size:15px;font-weight:800;line-height:1;padding:4px 4px 10px}
    .status-icons{display:flex;align-items:center;gap:7px}
    .sig{display:flex;gap:3px;align-items:flex-end;height:12px}
    .sig i{display:block;width:3px;background:#14251d;border-radius:999px}
    .sig i:nth-child(1){height:4px}.sig i:nth-child(2){height:6px}.sig i:nth-child(3){height:9px}.sig i:nth-child(4){height:12px}
    .wifi{width:13px;height:10px;border:2px solid #14251d;border-top-color:transparent;border-left-color:transparent;border-right-color:transparent;border-radius:0 0 12px 12px;transform:translateY(1px)}
    .battery{position:relative;width:22px;height:11px;border:1.8px solid #14251d;border-radius:4px}
    .battery::before{content:"";position:absolute;right:-3px;top:3px;width:2px;height:4px;border-radius:1px;background:#14251d}
    .battery::after{content:"";position:absolute;left:2px;top:2px;width:14px;height:5px;border-radius:2px;background:#14251d}
    .header{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:4px 0 16px}
    .brand{display:flex;align-items:center;gap:10px;min-width:0}
    .logo{width:38px;height:38px;border-radius:15px;background:#123f35;box-shadow:0 12px 22px rgba(16,55,45,.16);position:relative;flex:0 0 auto}
    .logo::before,.logo::after{content:"";position:absolute;top:15px;width:6px;height:6px;border-radius:50%;background:#fff}
    .logo::before{left:11px}.logo::after{right:11px}
    .brand-title{font-size:22px;font-weight:850;line-height:1.05}
    .brand-sub{margin-top:4px;font-size:12px;font-weight:650;color:#6f6a62}
    .capsule{min-height:34px;padding:0 13px;border-radius:999px;border:1px solid #eadbc3;background:#fff;color:#6a4e24;font-size:12px;font-weight:760;display:grid;place-items:center;white-space:nowrap}
    .hero{position:relative;border-radius:30px;padding:18px;background:#fff;border:1px solid #ece3d2;box-shadow:0 24px 40px rgba(49,38,24,.08)}
    .hero-dark{background:#184f42;color:#fff;border-color:#184f42}
    .hero-mist{background:linear-gradient(180deg,#eff8fb 0%,#fffdf6 100%)}
    .eyebrow{display:inline-flex;align-items:center;min-height:30px;padding:0 12px;border-radius:999px;background:rgba(255,255,255,.14);font-size:12px;font-weight:760}
    .hero-mist .eyebrow{background:#e8f6f3;color:#153f35}
    .hero h1{position:relative;z-index:2;margin:14px 0 10px;max-width:252px;font-size:29px;line-height:1.12;font-weight:850;letter-spacing:0}
    .hero p{margin:0;max-width:306px;font-size:13px;line-height:1.55;font-weight:600}
    .hero-dark p{color:rgba(255,255,255,.9)}
    .hero-mist p{color:#4d5d58}
    .mascot{position:absolute;right:16px;top:78px;width:76px;height:64px;border-radius:24px;background:#fee088;z-index:1}
    .mascot::before,.mascot::after{content:"";position:absolute;top:28px;width:7px;height:7px;border-radius:50%;background:#14362e}
    .mascot::before{left:24px}.mascot::after{right:24px}
    .plant{position:absolute;right:12px;bottom:18px;width:78px;height:68px;z-index:1}
    .plant i,.plant b,.plant span{position:absolute;display:block}
    .plant i{left:36px;bottom:4px;width:8px;height:42px;background:#376c55;border-radius:999px}
    .plant b{width:34px;height:20px;background:#5d8f60;border-radius:24px 24px 24px 0}
    .plant b:nth-child(2){left:8px;bottom:34px;transform:rotate(-28deg)}
    .plant b:nth-child(3){left:38px;bottom:38px;transform:scaleX(-1) rotate(-24deg)}
    .plant span{left:16px;bottom:0;width:44px;height:16px;background:#dbc3a3;border-radius:12px 12px 18px 18px}
    .family{position:absolute;right:10px;bottom:10px;width:102px;height:88px;z-index:1}
    .family i,.family b,.family span,.family em{position:absolute;display:block}
    .family i{width:28px;height:28px;border-radius:50%;background:#f0c69a}
    .family i:nth-child(1){left:12px;top:12px}
    .family i:nth-child(2){left:56px;top:6px}
    .family b{width:42px;height:44px;border-radius:22px 22px 14px 14px;background:#f6f0e4}
    .family b:nth-child(3){left:6px;top:34px}
    .family b:nth-child(4){left:50px;top:28px;background:#d9eadf}
    .family span{left:18px;top:70px;width:72px;height:12px;border-radius:999px;background:#d2bda2}
    .family em{left:86px;top:54px;width:20px;height:24px;border-radius:10px;background:#80a28c}
    .identity-card{margin:14px 0 12px;padding:14px;border-radius:20px;background:linear-gradient(135deg,#fff2b8,#f8fcf6 52%,#d9f2e1);border:1px solid rgba(18,63,53,.10);box-shadow:0 12px 28px rgba(18,63,53,.08)}
    .identity-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
    .identity-top span{display:block;color:#8a6a08;font-size:12px;font-weight:900}
    .identity-top b{display:block;margin-top:3px;color:#11231c;font-size:22px;line-height:1.05}
    .identity-top em{flex:0 0 auto;padding:5px 8px;border-radius:999px;background:#123f35;color:#fff;font-size:12px;font-style:normal;font-weight:900}
    .identity-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:10px}
    .identity-grid i{display:block;padding:8px 3px;border-radius:12px;background:rgba(255,255,255,.65);font-size:11px;font-style:normal;font-weight:900;text-align:center;color:#123f35}
    .identity-line{margin-top:9px;color:#6a4d05;font-size:12px;font-weight:800;line-height:1.35}
    .input-box{margin-top:16px;padding:15px 16px;min-height:70px;border-radius:20px;border:1px dashed #c9d1c7;background:#f7f8f6;color:#41514b;font-size:13px;font-weight:700;line-height:1.45}
    .pills{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
    .pill{padding:8px 11px;border-radius:999px;background:rgba(255,255,255,.14);font-size:12px;font-weight:800;color:inherit}
    .hero-mist .pill{background:#fff;color:#163c33;border:1px solid #ebefe8}
    .actions{display:grid;gap:12px;margin-top:18px}
    .btn{min-height:50px;border-radius:17px;font-size:14px;font-weight:800;display:grid;place-items:center}
    .btn-primary{background:#123f35;color:#fff}
    .btn-secondary{background:#fff;color:#123f35;border:1px solid #e3d6c2}
    .hero-dark .btn-primary{background:#fff;color:#123f35}
    .hero-dark .btn-secondary{background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.22);color:#fff}
    .tabs{display:grid;grid-template-columns:1fr;gap:10px;margin-top:14px}
    .tab{min-height:36px;border-radius:14px;display:grid;place-items:center;font-size:13px;font-weight:800;background:#fff;color:#8b8377}
    .tab.active{background:#123f35;color:#fff}.text-link{background:transparent!important;border:0!important;color:#123f35!important;min-height:34px!important}.hero-dark .text-link{color:#fff!important}.tabs.subtle{padding:6px;border:1px solid #eadcc7;border-radius:18px;background:#fff}
    .section{margin-top:14px;padding:16px;border-radius:24px;background:#fff;border:1px solid #eee2d0;box-shadow:0 14px 28px rgba(48,38,22,.06)}
    .section-title{font-size:15px;font-weight:850;color:#123f35}
    .section-copy{margin-top:6px;color:#6b6257;font-size:13px;font-weight:620;line-height:1.45}
    .flow{display:grid;gap:10px;margin-top:12px}
    .flow-item{display:grid;grid-template-columns:34px 1fr;gap:10px;align-items:center}
    .flow-num{width:34px;height:34px;border-radius:14px;background:#fde9a3;color:#123f35;display:grid;place-items:center;font-size:13px;font-weight:900}
    .flow-text{font-size:14px;font-weight:760}
    .mini-list{display:grid;gap:10px;margin-top:12px}
    .mini-card{display:flex;align-items:center;gap:10px;min-height:46px;padding:12px 14px;border-radius:18px;background:#fbf6ec;border:1px solid #efdfc7;font-size:14px;font-weight:720}
    .mini-card::before{content:"";width:10px;height:10px;border-radius:50%;background:#ffd45d;flex:0 0 auto}
    .matrix{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
    .matrix-card{min-height:88px;padding:14px;border-radius:18px;background:#f5f9fd;border:1px solid #dbe8f5;font-size:14px;font-weight:800;line-height:1.35}
    .helper-list{display:grid;gap:10px;margin-top:12px}
    .helper-row{display:flex;align-items:center;gap:10px;font-size:14px;font-weight:800;color:#123f35}
    .helper-row::before{content:"";width:8px;height:8px;border-radius:50%;background:#8caf98}
    .levels{display:flex;gap:8px;margin-top:14px}
    .level{padding:9px 12px;border-radius:999px;background:#f0f5ff;color:#1d3f78;font-size:12px;font-weight:800}
    .level.active{background:#123f35;color:#fff}
    .progress{height:12px;border-radius:999px;background:rgba(255,255,255,.18);margin-top:14px;overflow:hidden}
    .progress i{display:block;width:58%;height:100%;background:#ffd968}
    .question-card{margin-top:16px;padding:16px;border-radius:22px;background:#fff;color:#122119}
    .question-card small{display:block;color:#6c7570;font-size:12px;font-weight:800}
    .question-card strong{display:block;margin-top:8px;font-size:17px;line-height:1.35}
    .week-card{margin-top:12px;padding:14px 16px;border-radius:20px;background:#faf7f1;border:1px solid #ece0cf}
    .week-card strong{display:block;font-size:14px;font-weight:900;color:#123f35}
    .week-card p{margin:6px 0 0;color:#655d53;font-size:13px;font-weight:700;line-height:1.45}
    .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px}
    .stat{min-height:74px;padding:12px;border-radius:18px;background:#f7f2e9;border:1px solid #eadcc7;font-size:13px;font-weight:800;line-height:1.35}
    .loop-proof{padding:14px}
    .loop-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}
    .loop-chip{min-height:64px;padding:10px 8px;border-radius:16px;background:#123f35;color:#fff}
    .loop-chip b{display:block;width:22px;height:22px;border-radius:9px;background:#ffe08a;color:#123f35;font-size:12px;line-height:22px;text-align:center}
    .loop-chip span{display:block;margin-top:8px;font-size:12px;font-weight:760;line-height:1.25}
    .textarea-card{margin-top:14px;min-height:92px;padding:14px 16px;border-radius:20px;background:#fff;border:1px dashed #d8c9b4;color:#635b51;font-size:13px;font-weight:700;line-height:1.45}
    .soft-hero{background:linear-gradient(180deg,#fffdf8 0%,#f6f9f3 100%);color:#0f2019}
    .soft-hero p{color:#5f675f}
    .soft-hero .eyebrow{background:#e8f6f0;color:#123f35}
    .soft-hero .btn-secondary{color:#123f35;background:#fff;border:1px solid #eadcc7}
    .paper-stack{position:absolute;right:12px;top:88px;width:78px;height:82px;z-index:1}
    .paper-stack::before,.paper-stack::after{content:"";position:absolute;width:62px;height:76px;border-radius:14px;background:#fff;border:3px solid rgba(18,63,53,.15);box-shadow:0 12px 22px rgba(42,32,18,.10)}
    .paper-stack::before{right:5px;top:0;transform:rotate(8deg);background:#eaf5ee}
    .paper-stack::after{left:0;bottom:0;transform:rotate(-8deg);background:#fee088}
    .mini-chat{display:grid;gap:9px;margin-top:12px}
    .bubble-row{max-width:82%;padding:11px 13px;border-radius:16px;background:#fff;border:1px solid #eadcc7;font-size:13px;font-weight:800;line-height:1.4}
    .bubble-row.user{justify-self:end;background:#123f35;color:#fff;border-color:#123f35}
    .nav{position:absolute;left:18px;right:18px;bottom:22px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:8px;border-radius:22px;background:#fff;border:1px solid #ecdfca;box-shadow:0 16px 24px rgba(48,38,22,.06)}
    .nav-item{min-height:46px;border-radius:16px;display:grid;place-items:center;font-size:13px;font-weight:800;color:#1a2a23;border:1px solid #eadcc7;background:#fff}
    .nav-item.active{background:#123f35;color:#fff;border-color:#123f35}
  `;
}

function statusBar() {
  const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `<div class="status"><span>${time}</span><div class="status-icons"><div class="sig"><i></i><i></i><i></i><i></i></div><div class="wifi"></div><div class="battery"></div></div></div>`;
}

function header(screen) {
  const badgeMap = {
    home: screen.subpage ? '复习子页' : '作业点拨',
    pack: '材料入口',
    profile: '我的成长'
  };
  const subMap = {
    home: screen.subpage ? '从学习任务进入的一局复习' : '错题、作业、第一步',
    pack: '粘贴材料，生成可练内容',
    profile: '只看关键行动'
  };
  return `<header class="header">
    <div class="brand">
      <div class="logo"></div>
      <div>
        <div class="brand-title">原点智学</div>
        <div class="brand-sub">${subMap[screen.nav]}</div>
      </div>
    </div>
    <div class="capsule">${badgeMap[screen.nav]}</div>
  </header>`;
}

function homeHero(screen) {
  return `<section class="hero soft-hero">
    <div class="eyebrow">作业点拨</div>
    <h1>${screen.screenTitle}</h1>
    <p>${screen.screenLead}</p>
    <div class="mascot"></div>
    <div class="input-box">${screen.note}</div>
    ${screen.pills.length ? `<div class="pills">${screen.pills.map((item) => `<span class="pill">${item}</span>`).join('')}</div>` : ''}
    <div class="actions">
      <div class="btn btn-primary">${screen.primary}</div>
      <div class="btn btn-secondary text-link">${screen.secondary}</div>
    </div>
  </section>`;
}

function packHero(screen) {
  return `<section class="hero hero-mist">
    <div class="eyebrow">粘贴材料，生成可练内容</div>
    <h1>${screen.screenTitle}</h1>
    <p>${screen.screenLead}</p>
    <div class="plant"><i></i><b></b><b></b><span></span></div>
    <div class="tabs subtle">
      <div class="tab active">${screen.tabs[0]}</div>
    </div>
    <div class="input-box">${screen.note}</div>
    ${screen.pills.length ? `<div class="pills">${screen.pills.map((item) => `<span class="pill">${item}</span>`).join('')}</div>` : ''}
    <div class="actions">
      <div class="btn btn-primary">${screen.primary}</div>
      <div class="btn btn-secondary text-link">${screen.secondary}</div>
    </div>
  </section>`;
}

function reviewHero(screen) {
  return `<section class="hero soft-hero">
    <div class="eyebrow">只练今天该回忆的内容</div>
    <h1>${screen.screenTitle}</h1>
    <p>${screen.screenLead}</p>
    <div class="levels">${screen.levelPills.map((item, index) => `<span class="level ${index === 0 ? 'active' : ''}">${item}</span>`).join('')}</div>
    <div class="progress"><i></i></div>
    <div class="question-card"><small>先回忆，再选择</small><strong>${screen.question}</strong></div>
    <div class="pills">${screen.statPills.map((item) => `<span class="pill">${item}</span>`).join('')}</div>
    <div class="actions">
      <div class="btn btn-primary">${screen.primary}</div>
      <div class="btn btn-secondary">${screen.secondary}</div>
    </div>
  </section>`;
}

function profileHero(screen) {
  return `<section class="hero soft-hero">
    <div class="eyebrow">我的学习战绩</div>
    <h1>${screen.screenTitle}</h1>
    <p>${screen.screenLead}</p>
    <div class="identity-card">
      <div class="identity-top"><span>今日学习身份</span><b>错因修复者</b><em>本机码</em></div>
      <div class="identity-grid"><i>真实回访</i><i>连续天</i><i>学习卡</i><i>错因</i></div>
      <div class="identity-line">不排名，只邀请朋友完成同一关；数字来自真实记录。</div>
    </div>
    <div class="pills">${screen.pills.map((item) => `<span class="pill">${item}</span>`).join('')}</div>
    <div class="actions">
      <div class="btn btn-primary">${screen.primary}</div>
      <div class="btn btn-secondary">${screen.secondary}</div>
    </div>
  </section>`;
}

function homeSections(screen) {
  return `
    <section class="section loop-proof">
      <div class="section-title">今日闭环</div>
      <div class="section-copy">一题进来，不直接给答案：先拆错因，再玩一关，最后进入到期回访。</div>
      <div class="loop-strip">${screen.steps.slice(0, 3).map((item, index) => `<div class="loop-chip"><b>${index + 1}</b><span>${item}</span></div>`).join('')}</div>
    </section>`;
}

function packSections(screen) {
  return `
    <section class="section loop-proof">
      <div class="section-title">第一关怎么来</div>
      <div class="section-copy">没有材料时只显示生成入口；粘贴真实错题或笔记后，再展示可玩的关卡数量。</div>
    </section>
    <section class="section">
      <div class="section-title">生成后得到</div>
      <div class="matrix">${screen.outputs.map((item) => `<div class="matrix-card">${item}</div>`).join('')}</div>
    </section>
    <section class="section">
      <div class="section-title">轻练习会帮你</div>
      <div class="helper-list">${screen.helper.map((item) => `<div class="helper-row">${item}</div>`).join('')}</div>
    </section>`;
}

function reviewSections(screen) {
  return `
    <section class="section">
      <div class="section-title">本关问题</div>
      <div class="mini-list">${screen.options.map((item) => `<div class="mini-card">${item}</div>`).join('')}</div>
    </section>
    <section class="section">
      <div class="section-title">复习循环</div>
      <div class="flow">${screen.loop.map((item, index) => `<div class="flow-item"><div class="flow-num">${index + 1}</div><div class="flow-text">${item}</div></div>`).join('')}</div>
    </section>`;
}

function profileSections(screen) {
  return `
    <section class="section">
      <div class="section-title">今天优先看这三件事</div>
      <div class="mini-list">${screen.priorities.map((item) => `<div class="mini-card">${item}</div>`).join('')}</div>
    </section>
    <section class="section">
      <div class="section-title">一句话周报</div>
      <div class="week-card"><strong>本周一句话</strong><p>${screen.summary}</p></div>
    </section>
    <section class="section">
      <div class="section-title">错因清晰统计</div>
      <div class="stats">${screen.stats.map((item) => `<div class="stat">${item}</div>`).join('')}</div>
    </section>`;
}

function subpageHero(screen) {
  const art = screen.screenClass === 'tutor'
    ? '<div class="mascot"></div>'
    : screen.screenClass === 'radar'
      ? '<div class="family"><i></i><i></i><b></b><b></b><span></span><em></em></div>'
      : screen.screenClass === 'upload' || screen.screenClass === 'module'
        ? '<div class="paper-stack"></div>'
        : '<div class="plant"><i></i><b></b><b></b><span></span></div>';
  const heroClass = 'hero soft-hero';
  return `<section class="${heroClass}">
    <div class="eyebrow">${screen.eyebrow}</div>
    <h1>${screen.screenTitle}</h1>
    <p>${screen.screenLead}</p>
    ${art}
    ${screen.note ? `<div class="textarea-card">${screen.note}</div>` : ''}
    <div class="actions">
      <div class="btn btn-primary">${screen.primary}</div>
      <div class="btn btn-secondary text-link">${screen.secondary}</div>
    </div>
  </section>`;
}

function subpageSections(screen) {
  const stats = screen.stats || [];
  const cards = screen.cards || [];
  return `
    ${stats.length ? `<section class="section"><div class="section-title">当前判断</div><div class="stats">${stats.map((item) => `<div class="stat">${item}</div>`).join('')}</div></section>` : ''}
    <section class="section">
      <div class="section-title">${screen.screenClass === 'tutor' ? '带学循环' : '主流程'}</div>
      <div class="flow">${(screen.steps || []).map((item, index) => `<div class="flow-item"><div class="flow-num">${index + 1}</div><div class="flow-text">${item}</div></div>`).join('')}</div>
    </section>
    ${cards.length ? `<section class="section"><div class="section-title">为什么这样设计</div><div class="mini-list">${cards.map((item) => `<div class="week-card"><strong>${item.title}</strong><p>${item.body}</p></div>`).join('')}</div></section>` : ''}
    ${screen.screenClass === 'tutor' ? `<section class="section"><div class="section-title">真实对话区</div><div class="mini-chat"><div class="bubble-row">还没有对话。学生说出题目或第一步后，这里显示真实记录。</div></div></section>` : ''}
  `;
}

function nav(screen) {
  const items = [
    { id: 'home', label: '作业点拨' },
    { id: 'pack', label: '轻回访' },
    { id: 'profile', label: '我的' }
  ];
  return `<nav class="nav">${items.map((item) => `<div class="nav-item ${screen.nav === item.id ? 'active' : ''}">${item.label}</div>`).join('')}</nav>`;
}

function bodyHtml(screen) {
  let hero = '';
  let sections = '';
  if (screen.screenClass === 'home') {
    hero = homeHero(screen);
    sections = homeSections(screen);
  } else if (screen.screenClass === 'pack') {
    hero = packHero(screen);
    sections = packSections(screen);
  } else if (screen.screenClass === 'review') {
    hero = reviewHero(screen);
    sections = reviewSections(screen);
  } else if (screen.screenClass === 'profile') {
    hero = profileHero(screen);
    sections = profileSections(screen);
  } else {
    hero = subpageHero(screen);
    sections = subpageSections(screen);
  }

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${screen.titleNo} ${screen.titleText}</title>
  <style>${css()}</style>
</head>
<body>
  <div class="phone">
    <main class="screen">
      ${statusBar()}
      ${header(screen)}
      ${hero}
      ${sections}
      ${screen.subpage ? '' : nav(screen)}
    </main>
  </div>
</body>
</html>`;
}

for (const screen of screens) {
  fs.writeFileSync(path.join(outDir, `${screen.id}.html`), bodyHtml(screen), 'utf8');
}

const galleryHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Miniapp Visual Audit</title>
  <style>${css()}body{padding:0}.gallery-shell{display:grid;grid-template-columns:390px;gap:34px;padding:24px 20px 40px;justify-content:center}.gallery-card{width:390px}</style>
</head>
<body>
  <div class="gallery-shell">
    ${screens.map((screen) => `<section class="gallery-card"><div class="gallery-meta">${screen.titleNo} ${screen.titleText}</div><iframe title="${screen.titleText}" src="${screen.id}.html" style="width:390px;height:844px;border:0;border-radius:36px;display:block"></iframe></section>`).join('')}
  </div>
</body>
</html>`;
fs.writeFileSync(path.join(outDir, 'gallery.html'), galleryHtml, 'utf8');

const chromeCandidates = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
];
const chrome = chromeCandidates.find((item) => fs.existsSync(item));
if (!chrome) {
  console.error('Chrome not found. Cannot run visual audit.');
  process.exit(1);
}

const galleryPng = path.join(outDir, 'gallery.png');
fs.rmSync(galleryPng, { force: true });

for (const screen of screens) {
  fs.rmSync(path.join(outDir, `${screen.id}.png`), { force: true });
}

function capturePng(targetPath, outputPath, size) {
  const profileDir = path.join(outDir, `.chrome-${path.basename(outputPath, '.png')}-${process.pid}-${Date.now()}`);
  const result = spawnSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-extensions',
    '--hide-scrollbars',
    `--window-size=${size}`,
    `--user-data-dir=${profileDir}`,
    `--screenshot=${outputPath}`,
    `file:///${targetPath.replace(/\\/g, '/')}`
  ], { encoding: 'utf8', timeout: 60000 });
  try {
    fs.rmSync(profileDir, { recursive: true, force: true });
  } catch (error) {
    fs.writeFileSync(
      path.join(outDir, 'cleanup-warning.txt'),
      `Could not remove ${profileDir}: ${error.message}\n`,
      'utf8'
    );
  }
  return result;
}

const screenResults = screens.map((screen) => ({
  screen,
  result: capturePng(
    path.join(outDir, `${screen.id}.html`),
    path.join(outDir, `${screen.id}.png`),
    '390,844'
  )
}));
const galleryHeight = Math.min(12000, 40 + screens.length * 920);
const galleryResult = capturePng(path.join(outDir, 'gallery.html'), galleryPng, `430,${galleryHeight}`);
const expectedPngs = ['gallery.png'].concat(screens.map((screen) => `${screen.id}.png`));
const generated = expectedPngs.filter((file) => {
  const full = path.join(outDir, file);
  return fs.existsSync(full) && fs.statSync(full).size > 10000;
});

const failedScreen = screenResults.find((item) => item.result.status !== 0);
const ok = generated.length === expectedPngs.length && galleryResult.status === 0 && !failedScreen;
const report = [
  '# Miniapp Visual Audit',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  'Screens:',
  ...screens.map((screen) => `- ${screen.titleNo} ${screen.titleText}`),
  '',
  'Files:',
  '- docs/visual-audit/gallery.html',
  '- docs/visual-audit/gallery.png',
  ...screens.map((screen) => `- docs/visual-audit/${screen.id}.html`),
  ...screens.map((screen) => `- docs/visual-audit/${screen.id}.png`),
  '',
  'Note: These are static HTML proxy screenshots for layout review. Final release still needs WeChat DevTools or device screenshots for keyboard, safe-area, and native tabbar behavior.',
  '',
  ok ? 'Status: screenshots generated successfully.' : `Status: screenshot generation failed. ${
    (failedScreen && failedScreen.result.error && failedScreen.result.error.message)
    || (failedScreen && (failedScreen.result.stderr || failedScreen.result.stdout))
    || (galleryResult.error ? galleryResult.error.message : galleryResult.stderr || galleryResult.stdout || 'unknown error')
  }`
].join('\n');

fs.writeFileSync(path.join(outDir, 'REPORT.md'), report, 'utf8');

if (!ok) {
  console.error(report);
  process.exit(1);
}

console.log(report);
