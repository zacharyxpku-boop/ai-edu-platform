#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const MINI = path.join(ROOT, 'miniprogram');
const REQUEST_DOMAIN = 'https://yuandianzhixue.com';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function walk(dir, output = []) {
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, output);
    else output.push(full);
  }
  return output;
}

function argValue(name) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) return process.argv[i + 1];
  return '';
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function looksLikePlaceholderAppId(appid) {
  return /PLACEHOLDER|TEST|DUMMY|FAKE|YOUR|真实|你的|示例/i.test(String(appid || ''));
}

function check(condition, ok, fail, results) {
  results.push({ ok: !!condition, okText: ok, failText: fail });
}

function get(url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'GET', timeout: 12000 }, (res) => {
      res.resume();
      resolve({ ok: res.statusCode >= 200 && res.statusCode < 500, status: res.statusCode });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, status: 'timeout' });
    });
    req.on('error', () => resolve({ ok: false, status: 'network_error' }));
    req.end();
  });
}

function postJson(url, data) {
  return new Promise((resolve) => {
    const body = JSON.stringify(data);
    const req = https.request(url, {
      method: 'POST',
      timeout: 16000,
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body)
      }
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(raw); } catch (_) {}
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300 && (!json || json.ok !== false), status: res.statusCode, json });
      });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, status: 'timeout' });
    });
    req.on('error', () => resolve({ ok: false, status: 'network_error' }));
    req.write(body);
    req.end();
  });
}

function configureAppId(appid, options = {}) {
  if (!appid) return null;
  if (!/^wx[a-zA-Z0-9]{8,}$/.test(appid)) {
    throw new Error(`AppID 看起来不对：${appid}。微信小程序 AppID 通常以 wx 开头。`);
  }
  if (appid === 'touristappid' || looksLikePlaceholderAppId(appid)) {
    throw new Error(`AppID 不能是游客值或占位值：${appid}。请使用微信公众平台里的真实小程序 AppID。`);
  }
  const target = path.join(MINI, 'project.private.config.json');
  const existingPrivateConfig = fs.existsSync(target) ? readJson(target) : {};
  const privateConfig = Object.assign({}, existingPrivateConfig, {
    appid,
    projectname: existingPrivateConfig.projectname || 'yuandianzhixue-miniapp',
    setting: Object.assign({}, existingPrivateConfig.setting || {}, {
      compileHotReLoad: true
    })
  });
  if (options.dryRun) {
    return { target, dryRun: true, appid, privateConfig };
  }
  writeJson(target, privateConfig);
  return { target, dryRun: false, appid };
}

async function main() {
  const appid = argValue('--appid') || process.env.MINIPROGRAM_APPID || process.env.WECHAT_APP_ID || '';
  const remote = hasFlag('--remote');
  const dryRun = hasFlag('--dry-run') || hasFlag('--check-only');
  const results = [];

  const configured = configureAppId(appid, { dryRun });

  const appJsonPath = path.join(MINI, 'app.json');
  const projectConfigPath = path.join(MINI, 'project.config.json');
  const appJson = readJson(appJsonPath);
  const projectConfig = readJson(projectConfigPath);
  const privateConfigPath = path.join(MINI, 'project.private.config.json');
  const privateConfig = fs.existsSync(privateConfigPath) ? readJson(privateConfigPath) : null;
  const activeAppId = (configured && configured.dryRun && hasFlag('--upload-ready'))
    ? configured.appid
    : (privateConfig?.appid || projectConfig.appid || '');

  check(fs.existsSync(MINI), 'miniprogram/ 已存在', '缺少 miniprogram/ 目录', results);
  const requireAppId = hasFlag('--require-appid') || hasFlag('--upload-ready');
  check(
    !requireAppId || (activeAppId && activeAppId !== 'touristappid'),
    activeAppId && activeAppId !== 'touristappid' ? `AppID 已配置：${activeAppId}` : 'AppID 未填不阻塞本地预检；拿到后运行 npm run miniapp:appid -- wx...',
    '上传/提审前必须配置真实 AppID：npm run miniapp:appid -- wx你的AppID',
    results
  );
  check(appJson.__usePrivacyCheck__ === true, '隐私授权开关已开启', 'app.json 缺少 __usePrivacyCheck__', results);
  check(Array.isArray(appJson.pages) && appJson.pages.length >= 5, '小程序页面已声明', 'app.json pages 不完整', results);

  for (const page of appJson.pages || []) {
    for (const ext of ['.js', '.json', '.wxml', '.wxss']) {
      const file = path.join(MINI, `${page}${ext}`);
      check(fs.existsSync(file), `${page}${ext} 存在`, `缺少 ${page}${ext}`, results);
    }
  }

  const docs = [
    'docs/MINIAPP-LOW-COST-LAUNCH-WARROOM.md',
    'docs/MINIAPP-REVIEW-COPY-PASTE.md',
    'docs/MINIAPP-MVP-SHIP.md',
    'docs/MINIAPP-PRODUCTION-HARDENING.md'
  ];
  docs.forEach((file) => {
    check(fs.existsSync(path.join(ROOT, file)), `${file} 已准备`, `缺少 ${file}`, results);
  });

  const textFiles = walk(MINI).filter((file) => /\.(js|wxml|json|wxss)$/.test(file));
  const publicText = textFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  const risky = ['保证提分', '行业第一', '全国第一', '最好', '精准攻克', '自动识别图片', '直接 OCR'];
  const hit = risky.find((word) => publicText.includes(word));
  check(!hit, '前台高风险承诺词未命中', `前台仍含高风险词：${hit}`, results);
  check(publicText.includes('api.buildPriority'), '测评/作业主流程已接服务端优先级接口', '测评/作业主流程未接入服务端优先级接口', results);
  check(publicText.includes('api.submitFeedback'), 'family feedback calibration wired', 'family feedback calibration missing', results);
  check(publicText.includes('api.checkContent'), '作业点拨已接内容安全前置检查', '作业点拨未接入内容安全前置检查', results);

  check(true, `微信后台 request 合法域名只需配置：${REQUEST_DOMAIN}`, 'request 合法域名未明确', results);
  check(true, '首版不需要 uploadFile/downloadFile 合法域名', '首版不应开放上传/下载域名', results);

  if (remote) {
    const session = await postJson(`${REQUEST_DOMAIN}/api/mini/session`, { code: 'demo', profile: { grade: 'grade5' } });
    check(session.ok, `/api/mini/session 可用`, `/api/mini/session 不可用：${session.status}`, results);
    const priority = await postJson(`${REQUEST_DOMAIN}/api/mini/priority`, {
      score: 78,
      totalScore: 100,
      examText: 'reading transfer',
      homeworkText: 'math basics\napplication problems',
      minutes: 35
    });
    check(priority.ok, `/api/mini/priority 可用`, `/api/mini/priority 不可用：${priority.status}`, results);
    const content = await postJson(`${REQUEST_DOMAIN}/api/mini/content-check`, { content: 'math homework' });
    check(content.ok, `/api/mini/content-check 可用`, `/api/mini/content-check 不可用：${content.status}`, results);
    const weekly = await postJson(`${REQUEST_DOMAIN}/api/mini/weekly`, {
      axes: [{ key: 'reading', name: '审题建模', score: 56 }],
      weak_points: [{ key: 'reading', name: '审题建模', score: 56 }],
      homework_plan: { must_do: [{ text: '应用题 4 道', reason: '命中当前卡点', minutes: 12 }], flexible: [], can_skip: [] }
    });
    check(weekly.ok, `/api/mini/weekly 可用`, `/api/mini/weekly 不可用：${weekly.status}`, results);
    const feedback = await postJson(`${REQUEST_DOMAIN}/api/mini/feedback`, {
      kind: 'homework_priority',
      target_id: 'remote_hw_1',
      rating: 'accurate',
      bucket: 'must_do',
      reason: 'remote_smoke'
    });
    check(feedback.ok, `/api/mini/feedback available`, `/api/mini/feedback unavailable: ${feedback.status}`, results);
    const site = await get(REQUEST_DOMAIN);
    check(site.ok, `${REQUEST_DOMAIN} 可访问`, `${REQUEST_DOMAIN} 不可访问：${site.status}`, results);
  }

  const failed = results.filter((item) => !item.ok);
  const passed = results.length - failed.length;

  console.log('\n原点智学小程序上架助手\n');
  if (configured) {
    const relativeTarget = path.relative(ROOT, configured.target);
    console.log(configured.dryRun
      ? `AppID dry-run 通过；不会写入文件。目标文件：${relativeTarget}`
      : `已写入本地 AppID 配置：${relativeTarget}`);
  }
  console.log(`通过 ${passed}/${results.length}`);
  results.forEach((item) => {
    console.log(`${item.ok ? 'OK ' : 'ERR'} ${item.ok ? item.okText : item.failText}`);
  });

  console.log('\n你本人只剩这几步：');
  console.log('1. 微信公众平台拿 AppID');
  console.log('2. 运行：npm run miniapp:appid -- wx你的AppID');
  console.log(`3. 微信后台 request 合法域名填：${REQUEST_DOMAIN}`);
  console.log('4. 运行：npm run miniapp:fullcheck');
  console.log('5. 微信开发者工具导入 miniprogram/，上传体验版');
  console.log('6. 运行：npm run miniapp:review，复制输出材料提交审核\n');

  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
