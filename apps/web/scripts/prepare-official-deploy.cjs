#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outRoot = path.join(os.tmpdir(), `yuandian-web-official-${stamp}`);

const overlayPaths = [
  'package.json',
  'vercel.json',
  'index.html',
  'app',
  'apps/app',
  'apps/web',
  'packages',
  'scripts/check-product-boundaries.cjs'
];

function relPath(filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, '/');
}

function runGit(args, options = {}) {
  return childProcess.execFileSync('git', args, {
    cwd: repoRoot,
    encoding: options.encoding === undefined ? 'utf8' : options.encoding,
    maxBuffer: 1024 * 1024 * 200
  });
}

function run(command, args, options = {}) {
  return childProcess.execFileSync(command, args, {
    cwd: options.cwd || repoRoot,
    encoding: options.encoding === undefined ? 'utf8' : options.encoding,
    maxBuffer: 1024 * 1024 * 200,
    windowsHide: true
  });
}

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function copyFromHead() {
  const errors = [];
  try {
    copyFromHeadZipArchive();
    return;
  } catch (error) {
    errors.push(`zip archive: ${error.message}`);
  }

  try {
    copyFromHeadTarArchive();
    return;
  } catch (error) {
    errors.push(`tar archive: ${error.message}`);
  }

  console.warn(`Warning: git archive extraction unavailable; falling back to git show copy. ${errors.join('; ')}`);
  copyFromHeadSlow();
}

function copyFromHeadZipArchive() {
  const powershell = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
  if (process.platform !== 'win32' || !fs.existsSync(powershell)) {
    throw new Error('Windows PowerShell Expand-Archive is not available');
  }
  const archive = runGit(['archive', '--format=zip', 'HEAD'], { encoding: null });
  const archivePath = path.join(outRoot, '.head-archive.zip');
  fs.writeFileSync(archivePath, archive);
  try {
    run(powershell, [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      '& { param($archivePath, $destinationPath) Expand-Archive -LiteralPath $archivePath -DestinationPath $destinationPath -Force }',
      archivePath,
      outRoot
    ]);
  } finally {
    fs.rmSync(archivePath, { force: true });
  }
}

function copyFromHeadTarArchive() {
  const archive = runGit(['archive', '--format=tar', 'HEAD'], { encoding: null });
  const archivePath = path.join(outRoot, '.head-archive.tar');
  fs.writeFileSync(archivePath, archive);
  try {
    run('tar', ['-xf', archivePath, '-C', outRoot]);
  } finally {
    fs.rmSync(archivePath, { force: true });
  }
}

function copyFromHeadSlow() {
  const files = runGit(['ls-files', '-z'])
    .split('\0')
    .filter(Boolean);

  for (const file of files) {
    const target = path.join(outRoot, file);
    ensureParent(target);
    const data = runGit(['show', `HEAD:${file}`], { encoding: null });
    fs.writeFileSync(target, data);
  }
}

function copyCurrent(relativePath) {
  const source = path.join(repoRoot, relativePath);
  if (!fs.existsSync(source)) return false;
  const target = path.join(outRoot, relativePath);
  ensureParent(target);
  fs.cpSync(source, target, { recursive: true, force: true });
  return true;
}

function copyVercelProjectLink() {
  const source = path.join(repoRoot, '.vercel', 'project.json');
  if (!fs.existsSync(source)) return false;
  const target = path.join(outRoot, '.vercel', 'project.json');
  ensureParent(target);
  fs.copyFileSync(source, target);
  return true;
}

function main() {
  fs.rmSync(outRoot, { recursive: true, force: true });
  fs.mkdirSync(outRoot, { recursive: true });

  copyFromHead();

  const copied = overlayPaths.filter(copyCurrent);
  const linked = copyVercelProjectLink();

  const packageJson = path.join(outRoot, 'package.json');
  const vercelJson = path.join(outRoot, 'vercel.json');
  const appIndex = path.join(outRoot, 'app', 'index.html');
  const webApp = path.join(outRoot, 'apps', 'web', 'src', 'app.js');

  for (const required of [packageJson, vercelJson, appIndex, webApp]) {
    if (!fs.existsSync(required)) {
      throw new Error(`deploy bundle missing ${relPath(required)}`);
    }
  }

  console.log(`Prepared clean official Web deploy bundle: ${outRoot}`);
  console.log(`Overlay paths: ${copied.join(', ')}`);
  console.log(`Vercel project link: ${linked ? 'included' : 'missing'}`);
  console.log('');
  console.log('Next commands after Vercel login:');
  console.log(`  cd /d "${outRoot}"`);
  console.log('  npm.cmd run web:acceptance');
  console.log('  npx.cmd vercel deploy --prod');
}

main();
