#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..', '..');

function run(command, args, options = {}) {
  const result = childProcess.spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    encoding: 'utf8',
    shell: false,
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    windowsHide: true
  });

  if (result.status !== 0) {
    const detail = options.capture ? `${result.stdout || ''}${result.stderr || ''}`.trim() : '';
    throw new Error(`${command} ${args.join(' ')} failed${detail ? `\n${detail}` : ''}`);
  }

  return options.capture ? `${result.stdout || ''}${result.stderr || ''}` : '';
}

function extractDeploymentUrl(output) {
  const urls = output.match(/https:\/\/[^\s]+/g) || [];
  const cleanUrls = urls.map((url) => url.replace(/[",\]})]+$/, ''));
  return cleanUrls.find((url) => url.includes('.vercel.app')) || cleanUrls[cleanUrls.length - 1] || '';
}

function main() {
  run('node', ['apps/web/scripts/check-official-deploy-readiness.cjs'], { capture: true });
  if (process.env.WEB_DEPLOY_SKIP_CAPTURE === '1') {
    console.log('Skipping screenshot capture for deploy because WEB_DEPLOY_SKIP_CAPTURE=1.');
    run('node', ['apps/web/scripts/check-web-surface.cjs']);
    run('node', ['apps/web/scripts/check-web-interactions.cjs']);
    run('node', ['apps/web/scripts/check-official-preview.cjs']);
    run('node', ['scripts/check-product-boundaries.cjs']);
  } else {
    run('npm.cmd', ['run', 'web:acceptance']);
  }

  const deployOutput = run(process.env.ComSpec || 'cmd.exe', ['/c', 'npx.cmd', 'vercel', 'deploy', '--prod'], { capture: true });
  process.stdout.write(deployOutput);

  const deploymentUrl = extractDeploymentUrl(deployOutput);
  if (deploymentUrl) {
    console.log('');
    console.log(`Checking deployed preview: ${deploymentUrl}`);
    run('npm.cmd', ['run', 'web:live:check', '--', deploymentUrl]);
  }

  console.log('');
  console.log('Checking official domain: https://yuandianzhixue.com');
  run('npm.cmd', ['run', 'web:live:check']);
}

try {
  main();
} catch (error) {
  console.error('');
  console.error('Official Web production deploy stopped.');
  console.error(error.message || error);
  process.exit(1);
}
