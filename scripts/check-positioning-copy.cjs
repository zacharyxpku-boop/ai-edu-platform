'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const TARGETS = [
  'index.html',
  'study-tools.html',
  'tools-guide.html',
  'tutor.html',
  'parent-radar.html',
  'src/wechat-cta.js',
  'miniprogram/app.json',
  'miniprogram/pages/home/home.wxml',
  'miniprogram/pages/tools/tools.wxml',
  'miniprogram/pages/tools/tools.js',
  'miniprogram/pages/tools/tools.json',
  'miniprogram/pages/tutor/tutor.wxml',
  'miniprogram/pages/radar/radar.wxml',
  'miniprogram/pages/diagnosis/diagnosis.wxml',
  'miniprogram/pages/upload/upload.wxml',
  'miniprogram/pages/profile/profile.wxml',
  'miniprogram/pages/legal/legal.wxml',
  'miniprogram/pages/legal/legal.js',
  'docs/MINIAPP-REVIEW-COPY-PASTE.md',
  'docs/MINIAPP-LOW-COST-LAUNCH-WARROOM.md',
  'docs/MINIAPP-OPEN-ME-FIRST.md',
  'docs/MINIAPP-MVP-SHIP.md',
  'docs/MINIAPP-PRODUCTION-HARDENING.md',
  'docs/ARCHITECTURE.md',
  'README.md',
  'miniprogram/project.config.json',
  'package.json',
];

const FORBIDDEN = [
  { pattern: /AI 私教/g, reason: '公开定位应统一为原小点执行端或家庭学习决策系统' },
  { pattern: /一对一私教/g, reason: '会把产品讲成泛 AI 老师，而不是作业决策执行端' },
  { pattern: /私教页/g, reason: '公开入口应写执行端或原小点执行端' },
  { pattern: /Story\s*[123]/g, reason: 'Story 是内部叙事，不应出现在公开页面' },
  { pattern: /小程序前身/g, reason: '会削弱当前产品可信度' },
  { pattern: /正在开发中/g, reason: '当前应讲可验证链路，不讲等待上线' },
  { pattern: /预计2026/g, reason: '当前应讲可用闭环，不讲远期排期' },
  { pattern: /看课程方案/g, reason: 'CTA 应先导向诊断/作业取舍/家长复盘' },
  { pattern: /线上系统课咨询/g, reason: '微信 CTA 应统一到家庭学习决策咨询' },
  { pattern: /少年营报名/g, reason: '微信 CTA 应统一到家庭学习决策咨询' },
  { pattern: /清北\s*4\s*对\s*1/g, reason: '当前公开漏斗不应混入旧课程售卖' },
  { pattern: /会员入会/g, reason: '当前公开漏斗不应混入旧会员售卖' },
  { pattern: /全家会员/g, reason: '当前公开漏斗不应混入旧会员售卖' },
  { pattern: /保证提分/g, reason: '避免高风险教育承诺' },
  { pattern: /提分承诺/g, reason: '避免高风险教育承诺' },
  { pattern: /小程序\s*MVP|MVP\s*先|人教版\s*MVP/g, reason: '用户可见文案不应显得半成品' },
  { pattern: /首版只保留/g, reason: '用户可见文案不应显得半成品' },
  { pattern: />\s*TOOLS\s*</g, reason: '公开入口应讲诊断/决策，不讲工具仓库' },
  { pattern: /不上\s*OCR|先不做\s*OCR/g, reason: '用户可见文案不应强调未实现能力' },
  { pattern: /首版不做自动图片识别|不做自动图片识别/g, reason: '审核材料应说明当前数据用途，不强调未实现能力' },
  { pattern: /审核前待补/g, reason: '审核材料和小程序内不应暴露待补状态' },
  { pattern: /陪练/g, reason: '公开口径统一为原小点执行端或思路提示，避免辅导敏感表达' },
  { pattern: /AI 私教|应试提分|高考 AI 提分|Khanmigo|Khan Academy/g, reason: '当前对外叙事统一为家庭学习决策系统，不再讲旧平台定位' },
];

let failures = 0;

for (const rel of TARGETS) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);

  for (const rule of FORBIDDEN) {
    rule.pattern.lastIndex = 0;
    let match;
    while ((match = rule.pattern.exec(text)) !== null) {
      failures += 1;
      const lineNo = text.slice(0, match.index).split(/\r?\n/).length;
      const line = (lines[lineNo - 1] || '').trim();
      console.error(`${rel}:${lineNo} forbidden "${match[0]}" - ${rule.reason}`);
      console.error(`  ${line}`);
    }
  }
}

if (failures) {
  console.error(`\nFAIL: ${failures} positioning copy issue(s).`);
  process.exit(1);
}

console.log(`Positioning copy check passed across ${TARGETS.length} public files.`);
