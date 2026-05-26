#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');

const repoRoot = path.resolve(__dirname, '..', '..', '..');

function readJson(relativePath) {
  const fullPath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`missing ${relativePath}`);
  }
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

function exists(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function hasVercelAuth() {
  if (process.env.VERCEL_TOKEN && process.env.VERCEL_TOKEN.trim()) {
    return { ok: true, source: 'VERCEL_TOKEN' };
  }

  const authJson = path.join(os.homedir(), '.vercel', 'auth.json');
  if (fs.existsSync(authJson)) {
    return { ok: true, source: '~/.vercel/auth.json' };
  }

  try {
    const whoami = childProcess.execFileSync(process.env.ComSpec || 'cmd.exe', ['/c', 'npx.cmd', 'vercel', 'whoami'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    }).trim();
    if (whoami) {
      return { ok: true, source: `vercel cli (${whoami})` };
    }
  } catch (_) {
    // fall through to missing auth
  }

  return { ok: false, source: 'missing' };
}

function main() {
  const errors = [];

  const project = (() => {
    try {
      return readJson('.vercel/project.json');
    } catch (error) {
      errors.push(error.message);
      return {};
    }
  })();

  if (project.projectName !== 'ai-edu-platform') {
    errors.push(`unexpected Vercel projectName: ${project.projectName || '(missing)'}`);
  }
  if (!project.projectId) errors.push('missing Vercel projectId');
  if (!project.orgId) errors.push('missing Vercel orgId');

  const vercel = (() => {
    try {
      return readJson('vercel.json');
    } catch (error) {
      errors.push(error.message);
      return {};
    }
  })();

  const rewrites = Array.isArray(vercel.rewrites) ? vercel.rewrites : [];
  for (const source of ['/app', '/app/']) {
    if (!rewrites.some((rewrite) => rewrite.source === source && rewrite.destination === '/app/index.html')) {
      errors.push(`vercel.json must rewrite ${source} to /app/index.html`);
    }
  }

  const headers = Array.isArray(vercel.headers) ? vercel.headers : [];
  if (!headers.some((header) => header.source === '/app')) {
    errors.push('vercel.json must include /app cache headers');
  }

  for (const required of [
    'app/index.html',
    'apps/web/index.html',
    'apps/web/src/app.js',
    'apps/web/src/routes.js',
    'apps/web/src/view-model.js',
    'apps/web/src/styles.css',
    'apps/web/surface-manifest.json',
    'apps/app/README.md',
    'packages/ui-contracts/web-surface-contract.cjs',
    'scripts/check-product-boundaries.cjs'
  ]) {
    if (!exists(required)) errors.push(`missing ${required}`);
  }

  const packageJson = (() => {
    try {
      return readJson('package.json');
    } catch (error) {
      errors.push(error.message);
      return { scripts: {} };
    }
  })();

  for (const script of ['web:acceptance', 'web:prepare:deploy', 'web:deploy:check', 'web:deploy:prod', 'web:live:check']) {
    if (!packageJson.scripts || !packageJson.scripts[script]) {
      errors.push(`package.json missing script ${script}`);
    }
  }

  const auth = hasVercelAuth();
  if (!auth.ok) {
    errors.push('Vercel auth missing: run `npx.cmd vercel login` or set VERCEL_TOKEN before production deploy');
  }

  if (errors.length) {
    console.error('Official Web deploy readiness failed:');
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log(`Official Web deploy readiness passed for project ${project.projectName}.`);
  console.log(`Vercel auth source: ${auth.source}`);
}

main();
