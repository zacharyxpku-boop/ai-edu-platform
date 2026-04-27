/**
 * scripts/check-static-links.cjs
 *
 * Static-link 404 lint: scan top-level *.html + subjects/*.html for hard-coded
 * internal href / src references, assert each target file exists.
 *
 * 抓的是这次会断的低级错误(比如 feynman.html → feynman-verify.html 五处死链),
 * 不抓 SPA-style 模板字符串里的拼接 URL.
 *
 * Run: `node scripts/check-static-links.cjs` or via `npm test`.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const VERCEL_REWRITES = (() => {
  // tools/feynman 一类 cleanUrls 的 path 也接受省略 .html
  return [];
})();

// vercel.json 里的 redirects 应当被视为 valid
let VERCEL_REDIRECT_SOURCES = new Set();
try {
  const vc = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  (vc.redirects || []).forEach(r => VERCEL_REDIRECT_SOURCES.add(r.source));
} catch (_) {}

function listHtmlFiles() {
  const out = [];
  // top-level
  fs.readdirSync(ROOT).forEach(f => {
    if (f.endsWith('.html')) out.push(f);
  });
  // subjects/
  const subjDir = path.join(ROOT, 'subjects');
  if (fs.existsSync(subjDir)) {
    fs.readdirSync(subjDir).forEach(f => {
      if (f.endsWith('.html')) out.push('subjects/' + f);
    });
  }
  return out;
}

function extractRefs(content) {
  const refs = [];
  // <a href="...">  capture quotes carefully (no nesting)
  const aRe = /\bhref\s*=\s*"([^"]+)"/gi;
  const sRe = /\bsrc\s*=\s*"([^"]+)"/gi;
  let m;
  while ((m = aRe.exec(content)) !== null) refs.push({ kind: 'href', url: m[1] });
  while ((m = sRe.exec(content)) !== null) refs.push({ kind: 'src', url: m[1] });
  return refs;
}

function classifyAndCheck(url) {
  // 跳过 anchor / external / data: / javascript: / mailto: / tel:
  if (!url || url.startsWith('#')) return { skip: true, reason: 'anchor' };
  if (url.startsWith('http://') || url.startsWith('https://')) return { skip: true, reason: 'external' };
  if (/^(data:|javascript:|mailto:|tel:)/i.test(url)) return { skip: true, reason: 'protocol' };
  // 模板字符串占位符 / Vue / React-style / JS 拼接 不查
  if (url.includes('${') || url.includes('{{') || url.includes('<%')) return { skip: true, reason: 'template' };
  if (url.includes(' + ') || url.startsWith('+') || url.endsWith('+')) return { skip: true, reason: 'js-concat' };
  if (/'\s*\+|\+\s*'/.test(url)) return { skip: true, reason: 'js-concat-quote' };
  // 跳过仅 query/hash 但带相对路径的(?subject=foo); 拆出 path 部分检查
  const noQuery = url.split('?')[0].split('#')[0];
  if (!noQuery) return { skip: true, reason: 'pure-query' };

  // Vercel redirect 命中
  if (VERCEL_REDIRECT_SOURCES.has(noQuery)) return { ok: true, reason: 'vercel-redirect' };

  // 解相对/绝对到 fs path
  let candidate;
  if (noQuery.startsWith('/')) {
    candidate = path.join(ROOT, noQuery.slice(1));
  } else {
    // 相对当前文件 — 我们这里比较 lenient, 假定相对 ROOT
    candidate = path.join(ROOT, noQuery);
  }

  // 试三种情况: 原样 / 加 .html / index.html
  const tries = [
    candidate,
    candidate + '.html',
    path.join(candidate, 'index.html')
  ];
  for (const p of tries) {
    if (fs.existsSync(p)) return { ok: true, hit: p };
  }
  return { ok: false, candidate, tried: tries };
}

let failed = 0;
let checked = 0;
const files = listHtmlFiles();
console.log('Scanning ' + files.length + ' HTML files...');

files.forEach(f => {
  const content = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const refs = extractRefs(content);
  refs.forEach(r => {
    const v = classifyAndCheck(r.url);
    if (v.skip) return;
    checked++;
    if (!v.ok) {
      failed++;
      console.error('  ✗ ' + f + ' [' + r.kind + '] → ' + r.url + '  (no fs match for ' + (v.candidate || r.url) + ')');
    }
  });
});

console.log('\nChecked ' + checked + ' internal links across ' + files.length + ' files.');
if (failed) {
  console.error('FAIL: ' + failed + ' broken link(s)');
  process.exit(1);
} else {
  console.log('All internal links resolve.');
  process.exit(0);
}
