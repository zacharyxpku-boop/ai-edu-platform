#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const sourceMiniapp = path.join(root, 'miniprogram');
const defaultTarget = path.resolve(root, '..', 'aiedumini');
const defaultRemote = 'https://github.com/zacharyxpku-boop/aiedumini.git';
const manifestName = '.miniapp-sync-manifest.json';
const excludedNames = new Set([
  '.git',
  'node_modules',
  '.DS_Store',
  'project.private.config.json'
]);

function argValue(name, fallback = '') {
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function run(cmd, args, cwd, options = {}) {
  const safeArgs = cmd === 'git'
    ? ['-c', `safe.directory=${path.resolve(cwd).replace(/\\/g, '/')}`, ...args]
    : args;
  const result = childProcess.spawnSync(cmd, safeArgs, {
    cwd,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit'
  });
  if (result.status !== 0) {
    const detail = result.stderr || result.stdout || `${cmd} ${safeArgs.join(' ')}`;
    throw new Error(detail.trim());
  }
  return (result.stdout || '').trim();
}

function assertInside(child, parent) {
  const relative = path.relative(parent, child);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refuse to write outside target repo: ${child}`);
  }
}

function listFiles(dir, base = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    if (excludedNames.has(entry.name)) return [];
    const full = path.join(dir, entry.name);
    const relative = path.relative(base, full).replace(/\\/g, '/');
    if (entry.isDirectory()) return listFiles(full, base);
    if (!entry.isFile()) return [];
    return [relative];
  });
}

function ensureTargetRepo(target, remote) {
  if (!fs.existsSync(target)) {
    run('git', ['clone', remote, target], root);
  }
  if (!fs.existsSync(path.join(target, '.git'))) {
    throw new Error(`Target is not a git repo: ${target}`);
  }
}

function gitConfigValue(target, key) {
  const result = childProcess.spawnSync('git', [
    '-c',
    `safe.directory=${path.resolve(target).replace(/\\/g, '/')}`,
    'config',
    '--get',
    key
  ], {
    cwd: target,
    encoding: 'utf8',
    stdio: 'pipe'
  });
  return result.status === 0 ? (result.stdout || '').trim() : '';
}

function ensureLocalGitIdentity(target) {
  if (!gitConfigValue(target, 'user.name')) {
    run('git', ['config', 'user.name', 'Codex Miniapp Sync'], target);
  }
  if (!gitConfigValue(target, 'user.email')) {
    run('git', ['config', 'user.email', 'codex-miniapp-sync@users.noreply.github.com'], target);
  }
}

function readManifest(target) {
  const manifestPath = path.join(target, manifestName);
  if (!fs.existsSync(manifestPath)) return { files: [] };
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (_) {
    return { files: [] };
  }
}

function prunePreviousFiles(target, previousFiles, nextFiles) {
  const next = new Set(nextFiles);
  previousFiles
    .filter((file) => file.startsWith('miniprogram/') || file === 'README.md')
    .filter((file) => !next.has(file))
    .forEach((file) => {
      const full = path.join(target, file);
      assertInside(full, target);
      if (fs.existsSync(full) && fs.statSync(full).isFile()) fs.rmSync(full);
    });
}

function copyFile(source, target, targetRoot) {
  assertInside(target, targetRoot);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) {
    try {
      fs.chmodSync(target, 0o666);
    } catch (error) {
      if (!error || (error.code !== 'EPERM' && error.code !== 'EACCES')) throw error;
    }
  }
  try {
    fs.copyFileSync(source, target);
  } catch (error) {
    if (!error || (error.code !== 'EPERM' && error.code !== 'EACCES')) throw error;
    if (fs.existsSync(target)) fs.rmSync(target, { force: true });
    fs.writeFileSync(target, fs.readFileSync(source));
  }
}

function buildReadme(sourceCommit) {
  return [
    '# 原点智学小程序',
    '',
    '这个仓库由 `ai-edu-platform` 的小程序目录定期同步生成。',
    '',
    '- 小程序源码在 `miniprogram/`',
    '- 微信开发者工具打开 `miniprogram/project.config.json` 所在目录',
    '- `project.private.config.json` 不同步，避免把本机开发配置带入独立仓库',
    '- 上传前仍需把 `touristappid` 替换为真实小程序 AppID',
    '',
    `来源提交：${sourceCommit || 'working-tree'}`,
    ''
  ].join('\n');
}

function main() {
  const target = path.resolve(argValue('--target', defaultTarget));
  const remote = argValue('--remote', defaultRemote);
  const branch = argValue('--branch', 'main');
  const dryRun = hasFlag('--dry-run');
  const shouldCommit = hasFlag('--commit') || hasFlag('--push');
  const shouldPush = hasFlag('--push');
  const message = argValue('--message', `sync miniapp ${new Date().toISOString().slice(0, 10)}`);

  if (!fs.existsSync(sourceMiniapp)) throw new Error(`Missing source miniapp: ${sourceMiniapp}`);
  const sourceCommit = run('git', ['rev-parse', '--short', 'HEAD'], root, { capture: true });
  const files = listFiles(sourceMiniapp);
  const targetFiles = files.map((file) => `miniprogram/${file}`);
  const nextManifestFiles = targetFiles.concat(['README.md', manifestName]);

  if (dryRun) {
    console.log(JSON.stringify({
      ok: true,
      dryRun: true,
      source: sourceMiniapp,
      target,
      remote,
      targetExists: fs.existsSync(target),
      wouldClone: !fs.existsSync(target),
      files: files.length,
      excluded: Array.from(excludedNames).sort()
    }, null, 2));
    return;
  }

  ensureTargetRepo(target, remote);

  const previous = readManifest(target);
  prunePreviousFiles(target, previous.files || [], nextManifestFiles);
  files.forEach((file) => {
    copyFile(path.join(sourceMiniapp, file), path.join(target, 'miniprogram', file), target);
  });
  fs.writeFileSync(path.join(target, 'README.md'), buildReadme(sourceCommit), 'utf8');
  fs.writeFileSync(path.join(target, manifestName), JSON.stringify({
    sourceRepo: 'zacharyxpku-boop/ai-edu-platform',
    sourcePath: 'miniprogram',
    sourceCommit,
    syncedAt: new Date().toISOString(),
    files: nextManifestFiles
  }, null, 2) + '\n', 'utf8');

  run('git', ['status', '--short'], target);
  if (shouldCommit) {
    ensureLocalGitIdentity(target);
    run('git', ['add', 'miniprogram', 'README.md', manifestName], target);
    const staged = run('git', ['diff', '--cached', '--name-only'], target, { capture: true });
    if (staged) run('git', ['commit', '-m', message], target);
  }
  if (shouldPush) run('git', ['push', 'origin', branch], target);
}

main();
