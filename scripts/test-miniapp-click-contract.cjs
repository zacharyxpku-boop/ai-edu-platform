const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const miniprogramRoot = path.join(root, 'miniprogram');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.git'].includes(entry.name)) walk(full, out);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.wxml')) out.push(full);
  }
  return out;
}

function jsForWxml(wxmlFile) {
  const dir = path.dirname(wxmlFile);
  const base = path.basename(wxmlFile, '.wxml');
  const sameBase = path.join(dir, `${base}.js`);
  if (fs.existsSync(sameBase)) return sameBase;
  const indexJs = path.join(dir, 'index.js');
  if (fs.existsSync(indexJs)) return indexJs;
  return null;
}

function hasHandler(js, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[\\s,{])${escaped}\\s*\\(`).test(js)
    || new RegExp(`${escaped}\\s*:\\s*function\\s*\\(`).test(js)
    || new RegExp(`${escaped}\\s*:\\s*\\(`).test(js);
}

function literalValues(source, attr) {
  const values = [];
  const re = new RegExp(`${attr}="([^"{][^"]*)"`, 'g');
  let match;
  while ((match = re.exec(source))) values.push(match[1]);
  return values;
}

const appJson = JSON.parse(read('miniprogram/app.json'));
const activePageRoutes = new Set((appJson.pages || []).map((item) => `/${item}`));
const tabRoutes = new Set(((appJson.tabBar && appJson.tabBar.list) || []).map((item) => `/${item.pagePath}`));
const allowedScenes = new Set(['today', 'upload', 'report', 'tutor', 'review', 'parent']);
const retiredRoute = /\/pages\/(?:daily-math|dictation|light-diagnosis|focus|tools|module|radar|diagnosis)\//;

const failures = [];
const wxmlFiles = walk(miniprogramRoot).sort();

for (const wxmlFile of wxmlFiles) {
  const rel = path.relative(root, wxmlFile).replace(/\\/g, '/');
  const wxml = fs.readFileSync(wxmlFile, 'utf8');
  const jsFile = jsForWxml(wxmlFile);
  const js = jsFile ? fs.readFileSync(jsFile, 'utf8') : '';

  const bindtapMatches = [...wxml.matchAll(/\bbindtap="([A-Za-z_][A-Za-z0-9_]*)"/g)].map((match) => match[1]);
  if (bindtapMatches.length && !jsFile) {
    failures.push(`${rel} has bindtap handlers but no peer JS file`);
    continue;
  }

  for (const handler of bindtapMatches) {
    if (!hasHandler(js, handler)) failures.push(`${rel} binds ${handler} but ${path.relative(root, jsFile).replace(/\\/g, '/')} does not implement it`);
  }

  for (const scene of literalValues(wxml, 'data-scene')) {
    if (!allowedScenes.has(scene)) failures.push(`${rel} uses unsupported data-scene="${scene}"`);
  }

  for (const route of literalValues(wxml, 'data-path').concat(literalValues(wxml, 'data-route'))) {
    if (route.startsWith('/pages/')) {
      const base = route.split('?')[0];
      if (retiredRoute.test(route)) failures.push(`${rel} points to retired route ${route}`);
      if (!activePageRoutes.has(base) && !tabRoutes.has(base)) failures.push(`${rel} points to unregistered route ${route}`);
    }
  }
}

assert.strictEqual(failures.length, 0, failures.join('\n'));

const entryDetailJs = read('miniprogram/pages/entry-detail/entry-detail.js');
const sceneKeys = [...entryDetailJs.matchAll(/^  ([a-z]+): \{/gm)].map((match) => match[1]).filter((key) => allowedScenes.has(key));
assert.deepStrictEqual(new Set(sceneKeys), allowedScenes, 'entry-detail implements every supported child scene');

const entryDetailWxml = read('miniprogram/pages/entry-detail/entry-detail.wxml');
assert(entryDetailWxml.includes('bindtap="openScene"'), 'entry-detail child scene cards can switch in place');
assert(entryDetailWxml.includes('bindtap="goPrimary"') && entryDetailWxml.includes('bindtap="goSecondary"'), 'entry-detail has two actionable child-page CTAs');

console.log(`Miniapp click contract passed for ${wxmlFiles.length} WXML files.`);
