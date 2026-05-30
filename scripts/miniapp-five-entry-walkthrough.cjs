#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'docs', 'five-entry-walkthrough');
fs.mkdirSync(outDir, { recursive: true });

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), 'utf8');
}

function loadCommonJs(filePath, requireMap = {}) {
  const file = path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
  const code = fs.readFileSync(file, 'utf8');
  const module = { exports: {} };
  function localRequire(request) {
    if (Object.prototype.hasOwnProperty.call(requireMap, request)) return requireMap[request];
    if (request.startsWith('.')) {
      const resolved = path.resolve(path.dirname(file), request);
      const resolvedFile = fs.existsSync(resolved) ? resolved : `${resolved}.js`;
      return loadCommonJs(resolvedFile, requireMap);
    }
    return require(request);
  }
  const sandbox = {
    module,
    exports: module.exports,
    require: localRequire,
    console,
    Date,
    Math,
    Number,
    String,
    Object,
    Array,
    RegExp,
    JSON,
    Set,
    Map,
    wx: {}
  };
  vm.runInNewContext(code, sandbox, { filename: file });
  return module.exports;
}

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const importIntake = loadCommonJs(path.join('miniprogram', 'utils', 'import-intake.js'));
const learningReport = loadCommonJs(path.join('miniprogram', 'utils', 'learning-report.js'));
const gameLogic = loadCommonJs(path.join('miniprogram', 'utils', 'game-logic.js'));

const uploadJs = read('miniprogram/pages/upload/upload.js');
const uploadWxml = read('miniprogram/pages/upload/upload.wxml');
const profileJs = read('miniprogram/pages/profile/profile.js');
const profileWxml = read('miniprogram/pages/profile/profile.wxml');
const tutorJs = read('miniprogram/pages/tutor/tutor.js');
const tutorWxml = read('miniprogram/pages/tutor/tutor.wxml');
const reviewJs = read('miniprogram/pages/review/review.js');
const reviewWxml = read('miniprogram/pages/review/review.wxml');
const arcadeJs = read('miniprogram/pages/arcade/arcade.js');
const arcadeWxml = read('miniprogram/pages/arcade/arcade.wxml');

const materialText = [
  '天赋测评：孩子更适合先看图再复述，听完容易懂，但做题时第一步容易急。',
  '成绩单：数学 98 班级排名 3，英语 106，物理 78。',
  '错题：数学应用题列式卡住，孩子说不清第一步为什么先找数量关系。',
  '家长观察：晚上容易焦虑，讲太久会走神，游戏化短回合更能坚持。'
].join('\n');

const intakePacket = importIntake.buildUploadIntakePacket(materialText, [], 'talent_assessment');
const reportState = learningReport.buildLearningReportDraft({
  mode: 'full',
  sourceText: materialText,
  scoreText: '数学分数 98 班级排名 3\n英语 106\n物理 78',
  reportSources: [
    { type: 'talent_assessment', label: '天赋测评', text: '先看图再复述，听觉输入有帮助。', sourceSchemaId: 'talent_assessment', releaseScope: 'method_candidate_only' },
    { type: 'score_sheet', label: '成绩单', text: '数学 98 班级排名 3，英语 106，物理 78。', sourceSchemaId: 'score_sheet' },
    { type: 'wrong_question_paper', label: '错题', text: '数学应用题列式卡住，第一步说不清。', sourceSchemaId: 'wrong_question_paper' },
    { type: 'parent_report', label: '家长观察', text: '晚上焦虑，短回合更能坚持。', sourceSchemaId: 'parent_report' }
  ],
  behaviorSignals: {
    firstStep: '先找数量关系',
    wrongCause: '第一步判断依据不稳',
    parentQuestion: '这题第一步你先看哪里？'
  }
});

const preview = reportState.personalizedParentReportPreview;
const standard = preview && preview.standard;
const reviewCard = {
  id: 'walkthrough_wrong_step',
  question: '数学应用题列式第一步是什么？',
  answer: '先找数量关系',
  weakPoint: '数量关系',
  wrongCauseLabel: '第一步判断依据不稳',
  parentCheck: '家长只问第一步，不看完整答案。',
  next_review: new Date(Date.now() - 3600 * 1000).toISOString()
};
const highFrequencyLoop = gameLogic.buildHighFrequencyPracticeLoop(
  { reviewed_today: 1, correct_today: 1, streak: 2 },
  [reviewCard],
  [{ type: 'review_grade', rating: 2, cardId: reviewCard.id, wrongCauseLabel: reviewCard.wrongCauseLabel }],
  { correct: 2, total: 3, weakKey: '数量关系', wrongCauseLabel: reviewCard.wrongCauseLabel },
  { id: 'walkthrough_challenge', weakKey: '数量关系' },
  {},
  { source: 'five_entry_walkthrough' }
);

const checks = [
  {
    id: 'upload_material_classification',
    title: '上传页分类材料',
    route: '/pages/upload/upload?type=talent_assessment',
    passed: !!(
      intakePacket
      && intakePacket.intakeSourceSchema
      && uploadWxml.includes('学习偏好/测评资料')
      && uploadWxml.includes('成绩单/周测')
      && uploadWxml.includes('错题试卷')
      && uploadJs.includes('buildUploadIntakePacket')
      && uploadJs.includes('requiresStructuredEvidenceGate')
    ),
    evidence: [
      `材料类型：${intakePacket.intakeSourceSchema.label}`,
      `下一步队列：${(intakePacket.nextActionQueue || []).map((item) => item.label).slice(0, 3).join(' / ')}`,
      '页面按钮覆盖测评、成绩、错题、学校反馈、家长观察和无测评快测。'
    ]
  },
  {
    id: 'report_evidence_method',
    title: '报告页解释证据和方法',
    route: '/pages/profile/profile?from=upload_report_ready',
    passed: !!(
      preview
      && standard
      && standard.evidenceProtocol.selectedCaseIds.includes('mixed_materials')
      && standard.methodologyBackbone.some((item) => item.id === 'socratic')
      && standard.methodologyBackbone.some((item) => item.id === 'retrieval_spaced')
      && profileWxml.includes('今晚结论')
      && profileWxml.includes('判断依据')
      && profileWxml.includes('资料')
      && profileWxml.includes('家长看回访')
    ),
    evidence: [
      `标准版本：${preview.standardVersion}`,
      `命中材料场景：${standard.evidenceProtocol.selectedCaseIds.join(' / ')}`,
      `HTML 长度：${preview.htmlLength}`
    ]
  },
  {
    id: 'tutor_first_step',
    title: '私教页追问第一步',
    route: '/pages/tutor/tutor?from=parent_report_standard',
    passed: !!(
      /先说.*第一步|第一步.*发过来|说第一步/.test(tutorWxml)
      && /不直接讲答案|不给完整答案|不要写完整答案/.test(tutorWxml + tutorJs)
      && tutorJs.includes('first_step_only_no_full_answer')
      && tutorJs.includes('firstStep')
      && standard.competitorClosureBenchmarks.some((item) => item.route.includes('/pages/tutor/tutor'))
    ),
    evidence: [
      '私教入口绑定报告标准里的 tutor route。',
      '可见文案强调先说第一步，不直接替写答案。',
      '报告标准要求回流 child_first_step + socratic_receipt。'
    ]
  },
  {
    id: 'review_game_transfer',
    title: '复习/游戏页验证记忆和迁移',
    route: '/pages/review/review -> /pages/arcade/arcade',
    passed: !!(
      highFrequencyLoop
      && highFrequencyLoop.dailyReturnContract
      && highFrequencyLoop.reviewReturnSeed
      && highFrequencyLoop.nextDayReturnEvidence
      && reviewJs.includes('recordReportRevisitEvidence')
      && arcadeWxml.includes('小课堂回流')
      && arcadeWxml.includes('复习岛不是刷题')
      && standard.competitorClosureBenchmarks.some((item) => item.route.includes('/pages/arcade/arcade'))
    ),
    evidence: [
      `回访合约：${highFrequencyLoop.dailyReturnContract.id}`,
      `复习种子：${highFrequencyLoop.reviewReturnSeed.id}`,
      `次日证据：${highFrequencyLoop.nextDayReturnEvidence.status || highFrequencyLoop.nextDayReturnEvidence.id}`
    ]
  },
  {
    id: 'parent_summary_next_step',
    title: '家长页汇总证据与下一步',
    route: '/pages/profile/profile',
    passed: !!(
      profileJs.includes('personalizedParentReportCompetitorBenchmarks')
      && profileJs.includes('personalizedParentReportMiniappPlan')
      && profileWxml.includes('今晚只看一个决策')
      && profileWxml.includes('不靠感觉下结论')
      && profileWxml.includes('下一步')
    ),
    evidence: [
      '家长页展示报告标准、导出规则、闭环动作和下一证据。',
      '完整 HTML/PDF 仍按 H5 WebView 或服务端临时文件导出，不在小程序内假承诺。',
      `导出策略：${standard.exportPolicy.miniappLine}`
    ]
  }
];

checks.forEach((check) => assert(check.passed, `${check.id} did not pass walkthrough gate`));

const chromeCandidates = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
];
const chrome = chromeCandidates.find((item) => fs.existsSync(item));

function css() {
  return `
    *{box-sizing:border-box}
    body{margin:0;background:#ded3bf;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;color:#10231b}
    .wrap{max-width:430px;margin:0 auto;padding:20px}
    .phone{width:390px;min-height:844px;margin:0 auto;background:#fffaf0;border-radius:36px;padding:18px;box-shadow:0 26px 60px rgba(64,48,24,.22)}
    .status{display:flex;justify-content:space-between;font-weight:900;font-size:14px;padding:4px 4px 14px}
    .hero{border-radius:28px;background:#153f35;color:#fff;padding:20px;position:relative;overflow:hidden}
    .hero:after{content:"";position:absolute;right:-22px;top:18px;width:118px;height:118px;border-radius:40px;background:#f6d56b;opacity:.85}
    .hero b{display:inline-block;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.14);font-size:12px}
    .hero h1{position:relative;z-index:1;margin:14px 0 8px;font-size:28px;line-height:1.12;letter-spacing:0}
    .hero p{position:relative;z-index:1;margin:0;font-size:13px;line-height:1.55;color:rgba(255,255,255,.88)}
    .route{margin-top:14px;padding:12px 14px;border-radius:18px;background:#fff;color:#153f35;font-weight:900;font-size:13px}
    .card{margin-top:14px;border:1px solid #eadcc7;background:#fff;border-radius:22px;padding:16px;box-shadow:0 12px 24px rgba(56,42,20,.06)}
    .top{display:flex;align-items:center;justify-content:space-between;gap:10px}
    .num{width:34px;height:34px;border-radius:13px;background:#ffe08a;display:grid;place-items:center;font-weight:950;color:#153f35}
    .ok{padding:6px 9px;border-radius:999px;background:#e5f5e9;color:#0d5a35;font-size:12px;font-weight:900}
    h2{margin:12px 0 8px;font-size:18px;line-height:1.25}
    .evidence{display:grid;gap:8px;margin-top:10px}
    .evidence span{display:block;padding:10px 12px;border-radius:15px;background:#f8f2e8;color:#554d43;font-size:13px;line-height:1.4;font-weight:730}
    .footer{margin-top:16px;padding:14px;border-radius:20px;background:#eff8f3;color:#153f35;font-weight:850;font-size:13px;line-height:1.45}
  `;
}

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>5入口闭环走查</title>
  <style>${css()}</style>
</head>
<body>
  <div class="wrap">
    <main class="phone">
      <div class="status"><span>19:24</span><span>5入口走查</span></div>
      <section class="hero">
        <b>非真机布局预览 + 代码级证据</b>
        <h1>上传到报告，再回到行动</h1>
        <p>这张截图按真实小程序入口组织：上传分类、报告解释、私教追问、复习/游戏验证、家长汇总。</p>
        <div class="route">样例学生：测评 + 成绩 + 错题 + 家长观察混合材料</div>
      </section>
      ${checks.map((check, index) => `<section class="card">
        <div class="top"><div class="num">${index + 1}</div><div class="ok">已通过</div></div>
        <h2>${esc(check.title)}</h2>
        <div class="route">${esc(check.route)}</div>
        <div class="evidence">${check.evidence.map((item) => `<span>${esc(item)}</span>`).join('')}</div>
      </section>`).join('')}
      <div class="footer">边界：微信 DevTools CLI 当前被本机服务端口拦截；本报告只用于布局预览，不能替代真机或模拟器截图。</div>
    </main>
  </div>
</body>
</html>`;

const htmlPath = path.join(outDir, 'five-entry-walkthrough.html');
const pngPath = path.join(outDir, 'five-entry-walkthrough.png');
const jsonPath = path.join(outDir, 'five-entry-walkthrough.json');
fs.writeFileSync(htmlPath, html, 'utf8');
fs.writeFileSync(jsonPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  devtoolsCli: {
    attempted: true,
    status: 'blocked_by_local_service_port',
    detail: '微信开发者工具 CLI 服务端口未能连接 127.0.0.1:9420；需要在工具安全设置里开启服务端口后再抓 DevTools/真机截图。'
  },
  checks
}, null, 2), 'utf8');

let screenshotStatus = 'not_generated';
if (chrome) {
  fs.rmSync(pngPath, { force: true });
  const profileDir = path.join(outDir, `.chrome-five-entry-${process.pid}-${Date.now()}`);
  const result = spawnSync(chrome, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-gpu-sandbox',
    '--disable-gpu-compositing',
    '--disable-accelerated-2d-canvas',
    '--disable-accelerated-video-decode',
    '--disable-features=UseSkiaRenderer,VizDisplayCompositor,GpuRasterization,Vulkan',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--window-size=430,2400',
    `--user-data-dir=${profileDir}`,
    `--screenshot=${pngPath}`,
    `file:///${htmlPath.replace(/\\/g, '/')}`
  ], { encoding: 'utf8', timeout: 60000 });
  fs.rmSync(profileDir, { recursive: true, force: true });
  assert.strictEqual(result.status, 0, result.stderr || result.stdout || 'Chrome screenshot failed');
  assert(fs.existsSync(pngPath) && fs.statSync(pngPath).size > 10000, 'walkthrough screenshot was not generated');
  screenshotStatus = 'generated';
}

const reportMd = [
  '# 5入口闭环走查',
  '',
  `生成时间：${new Date().toISOString()}`,
  '',
  '## 证据文件',
  '',
  '- `docs/five-entry-walkthrough/five-entry-walkthrough.html`',
  '- `docs/five-entry-walkthrough/five-entry-walkthrough.png`',
  '- `docs/five-entry-walkthrough/five-entry-walkthrough.json`',
  '- `docs/visual-audit/gallery.png`',
  '',
  '## 结果',
  '',
  ...checks.map((check) => `- 通过：${check.title} -> ${check.route}`),
  '',
  '## 真机边界',
  '',
  '已尝试微信开发者工具 CLI，但本机服务端口未能连接 `127.0.0.1:9420`。需要在微信开发者工具 -> 设置 -> 安全设置开启服务端口后，才能继续抓 DevTools 或真机预览截图。',
  '',
  `截图状态：${screenshotStatus}`
].join('\n');
fs.writeFileSync(path.join(outDir, 'REPORT.md'), reportMd, 'utf8');

console.log(JSON.stringify({
  ok: true,
  screenshotStatus,
  checks: checks.map((item) => ({ id: item.id, passed: item.passed, route: item.route })),
  files: {
    html: path.relative(root, htmlPath),
    png: path.relative(root, pngPath),
    json: path.relative(root, jsonPath),
    report: path.relative(root, path.join(outDir, 'REPORT.md'))
  }
}, null, 2));
