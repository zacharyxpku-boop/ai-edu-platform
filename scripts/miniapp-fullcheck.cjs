#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const safeGitDirectory = path.resolve(process.cwd()).replace(/\\/g, '/');

const checks = [
  {
    name: '定位与敏感文案',
    command: [process.execPath, ['scripts/check-positioning-copy.cjs']]
  },
  {
    name: 'Miniapp encoding guard',
    command: [process.execPath, ['scripts/check-miniapp-encoding.cjs']]
  },
  {
    name: '小程序本地上架预检',
    command: [process.execPath, ['scripts/miniapp-launch-assistant.cjs']]
  },
  {
    name: 'Miniapp reference asset adoption',
    command: [process.execPath, ['scripts/test-miniapp-reference-adoption.cjs']]
  },
  {
    name: 'Miniapp reference library inventory',
    command: [process.execPath, ['scripts/test-miniapp-reference-library-inventory.cjs']]
  },
  {
    name: 'Miniapp reference HTML coverage',
    command: [process.execPath, ['scripts/test-miniapp-reference-html-coverage.cjs']]
  },
  {
    name: 'Miniapp reference visual shell',
    command: [process.execPath, ['scripts/test-miniapp-reference-visual-shell.cjs']]
  },
  {
    name: 'Miniapp tab layout contract',
    command: [process.execPath, ['scripts/test-miniapp-tab-layout-contract.cjs']]
  },
  {
    name: 'Miniapp first-screen density contract',
    command: [process.execPath, ['scripts/test-miniapp-first-screen-density-contract.cjs']]
  },
  {
    name: 'Miniapp tab product focus contract',
    command: [process.execPath, ['scripts/test-miniapp-tab-product-focus.cjs']]
  },
  {
    name: 'Miniapp entry jump shell contract',
    command: [process.execPath, ['scripts/test-entry-jump-shell.cjs']]
  },
  {
    name: 'Miniapp entry-detail route contract',
    command: [process.execPath, ['scripts/test-miniapp-entry-detail-route-contract.cjs']]
  },
  {
    name: 'Miniapp click contract',
    command: [process.execPath, ['scripts/test-miniapp-click-contract.cjs']]
  },
  {
    name: 'Miniapp inline-SVG background wipe scan',
    command: [process.execPath, ['scripts/scan-bg-wipe.cjs']]
  },
  {
    name: 'Miniapp five user journey smoke',
    command: [process.execPath, ['scripts/test-five-user-journey-smoke.cjs']]
  },
  {
    name: 'Miniapp user journey risk smoke',
    command: [process.execPath, ['scripts/test-miniapp-user-journey-risk-smoke.cjs']]
  },
  {
    name: 'Miniapp deep-link runtime harness',
    command: [process.execPath, ['scripts/test-miniapp-deep-link-runtime.cjs']]
  },
  {
    name: 'Report job status API contract',
    command: [process.execPath, ['scripts/test-report-job-status-api.cjs']]
  },
  {
    name: 'Miniapp revisit engine contract',
    command: [process.execPath, ['scripts/test-revisit-engine.cjs']]
  },
  {
    name: 'Miniapp practice workshop contract',
    command: [process.execPath, ['scripts/test-review-engine.cjs']]
  },
  {
    name: 'Miniapp qbank integration contract',
    command: [process.execPath, ['scripts/test-qbank-integration.cjs']]
  },
  {
    name: 'Legacy API inventory risk contract',
    command: [process.execPath, ['scripts/test-legacy-api-inventory-risk.cjs']]
  },
  {
    name: 'RLS API contract',
    command: [process.execPath, ['scripts/test-rls-api-contract.cjs']]
  },
  {
    name: 'Miniapp production release scope contract',
    command: [process.execPath, ['scripts/check-miniapp-production-release-scope.cjs']]
  },
  {
    name: 'Miniapp real-device capture harness contract',
    command: [process.execPath, ['scripts/test-miniapp-real-device-capture-contract.cjs']]
  },
  {
    name: 'Miniapp DevTools simulator capture contract',
    command: [process.execPath, ['scripts/test-miniapp-devtools-simulator-capture-contract.cjs']]
  },
  {
    name: 'Miniapp runtime window capture contract',
    command: [process.execPath, ['scripts/test-miniapp-runtime-window-capture-contract.cjs']]
  },
  {
    name: 'Miniapp runtime walkthrough capture contract',
    command: [process.execPath, ['scripts/test-miniapp-runtime-walkthrough-capture-contract.cjs']]
  },
  {
    name: 'Miniapp manual screenshot audit contract',
    command: [process.execPath, ['scripts/test-miniapp-manual-screenshot-audit-contract.cjs']]
  },
  {
    name: '小程序生产规则测试',
    command: [process.execPath, ['scripts/test-miniapp-production.cjs']]
  },
  {
    name: '审核材料生成',
    command: [process.execPath, ['scripts/miniapp-review-pack.cjs']]
  },
  {
    name: 'Git 空白字符检查',
    command: ['git', ['-c', `safe.directory=${safeGitDirectory}`, 'diff', '--check']]
  }
];

if (process.argv.includes('--remote')) {
  checks.splice(2, 0, {
    name: '线上接口冒烟检查',
    command: [process.execPath, ['scripts/miniapp-launch-assistant.cjs', '--remote']]
  }, {
    name: 'Live miniapp API smoke',
    command: [process.execPath, ['scripts/test-live-miniapp-api-smoke.cjs']]
  }, {
    name: 'Live miniapp user journey smoke',
    command: [process.execPath, ['scripts/test-live-miniapp-user-journey.cjs']]
  });
}

if (process.argv.includes('--upload-ready')) {
  checks[1] = {
    name: '小程序上传前 AppID 门禁',
    command: [process.execPath, ['scripts/miniapp-launch-assistant.cjs', '--upload-ready']]
  };
}

function run(name, command, args) {
  console.log(`\n========== ${name} ==========\n`);
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: false
  });

  if (result.error) {
    console.error(`\n${name} 启动失败：${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`\n${name} 未通过，已停止后续检查。`);
    process.exit(result.status || 1);
  }
}

console.log('原点智学小程序提审前总检查');
console.log(process.argv.includes('--remote')
  ? '模式：本地规则 + 线上接口'
  : '模式：本地规则');

for (const item of checks) {
  run(item.name, item.command[0], item.command[1]);
}

console.log('\n全部检查通过。可以进入微信开发者工具上传体验版。');
