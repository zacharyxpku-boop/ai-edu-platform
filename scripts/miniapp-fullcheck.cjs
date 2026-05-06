#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');

const checks = [
  {
    name: '定位与敏感文案',
    command: [process.execPath, ['scripts/check-positioning-copy.cjs']]
  },
  {
    name: '小程序本地上架预检',
    command: [process.execPath, ['scripts/miniapp-launch-assistant.cjs']]
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
    command: ['git', ['diff', '--check']]
  }
];

if (process.argv.includes('--remote')) {
  checks.splice(2, 0, {
    name: '线上接口冒烟检查',
    command: [process.execPath, ['scripts/miniapp-launch-assistant.cjs', '--remote']]
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
