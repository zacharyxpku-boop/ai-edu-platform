#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const miniRoot = path.join(root, 'miniprogram');
const appJsonPath = path.join(miniRoot, 'app.json');
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

function exists(rel) {
  return fs.existsSync(path.join(miniRoot, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(miniRoot, rel), 'utf8');
}

function assertPageFiles(pagePath) {
  ['js', 'json', 'wxml', 'wxss'].forEach((ext) => {
    assert(exists(`${pagePath}.${ext}`), `${pagePath}.${ext} exists`);
  });
}

assert(Array.isArray(appJson.pages) && appJson.pages.length > 0, 'app.json declares pages');
const launchPage = appJson.pages[0];
assert.strictEqual(launchPage, 'pages/home/home', 'launch page is Home');
appJson.pages.forEach(assertPageFiles);

const tabPages = (((appJson.tabBar || {}).list) || []).map((item) => item.pagePath);
assert.deepStrictEqual(tabPages, [
  'pages/home/home',
  'pages/tutor/tutor',
  'pages/arcade/arcade',
  'pages/profile/profile',
  'pages/upload/upload'
], 'tab pages follow the child-first five-entry product route');
tabPages.forEach(assertPageFiles);

if (appJson.tabBar && appJson.tabBar.custom) {
  ['index.js', 'index.json', 'index.wxml', 'index.wxss'].forEach((file) => {
    assert(exists(`custom-tab-bar/${file}`), `custom-tab-bar/${file} exists`);
  });
  const customTabJson = JSON.parse(read('custom-tab-bar/index.json'));
  assert.strictEqual(customTabJson.component, true, 'custom-tab-bar is declared as a component');
}

function collectRequires(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  const requires = [];
  const pattern = /require\(['"]([^'"]+)['"]\)/g;
  let match;
  while ((match = pattern.exec(code))) {
    requires.push(match[1]);
  }
  return requires;
}

function resolveMiniRequire(fromFile, request) {
  if (!request.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), request);
  const candidates = [
    base,
    `${base}.js`,
    path.join(base, 'index.js')
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

const startupJsFiles = [
  path.join(miniRoot, 'app.js'),
  path.join(miniRoot, `${launchPage}.js`),
  path.join(miniRoot, 'custom-tab-bar/index.js')
];

startupJsFiles.forEach((file) => {
  assert(fs.existsSync(file), `${path.relative(miniRoot, file)} exists`);
  collectRequires(file).forEach((request) => {
    const resolved = resolveMiniRequire(file, request);
    if (request.startsWith('.')) {
      assert(resolved, `${path.relative(miniRoot, file)} resolves ${request}`);
    }
  });
});

function loadPageDefinition(filePath) {
  const cache = {};
  let capturedPage = null;
  const wx = {
    getStorageSync() { return undefined; },
    setStorageSync() {},
    removeStorageSync() {},
    request(options = {}) {
      if (typeof options.fail === 'function') options.fail({ errMsg: 'startup guard stub' });
    },
    getAccountInfoSync() {
      return { miniProgram: { appId: 'touristappid' } };
    },
    login(options = {}) {
      if (typeof options.fail === 'function') options.fail({ errMsg: 'startup guard stub' });
    },
    switchTab() {},
    navigateTo() {},
    showToast() {}
  };

  function load(file) {
    const full = path.resolve(file);
    if (cache[full]) return cache[full].exports;
    const module = { exports: {} };
    cache[full] = module;
    const code = fs.readFileSync(full, 'utf8');
    const sandbox = {
      module,
      exports: module.exports,
      console,
      Date,
      Math,
      Number,
      String,
      Object,
      Array,
      RegExp,
      JSON,
      setTimeout(fn) {
        if (typeof fn === 'function') fn();
      },
      wx,
      getCurrentPages() {
        return [{ route: launchPage }];
      },
      App() {},
      Component() {},
      Page(definition) {
        capturedPage = definition;
      },
      require(request) {
        if (!request.startsWith('.')) return require(request);
        const resolved = resolveMiniRequire(full, request);
        assert(resolved, `${path.relative(miniRoot, full)} resolves ${request}`);
        return load(resolved);
      }
    };
    vm.runInNewContext(code, sandbox, { filename: full });
    return module.exports;
  }

  load(filePath);
  return capturedPage;
}

const homePage = loadPageDefinition(path.join(miniRoot, `${launchPage}.js`));
assert(homePage && homePage.data, 'Home Page definition loads');
assert(homePage.data.homeViewModel && homePage.data.homeViewModel.title, 'Home has launch-time viewModel');
assert(homePage.data.companionPreference && homePage.data.companionPreference.selectedCompanion, 'Home companionPreference is non-null before first render');

const homeWxml = read(`${launchPage}.wxml`);
assert(homeWxml.includes('homeViewModel.title'), 'Home WXML binds launch viewModel title');
assert(!/companionPreference\.selectedCompanion/.test(homeWxml) || homePage.data.companionPreference.selectedCompanion, 'Home direct companion binding has a first-render default');

const tabStartupExpectations = {
  'pages/home/home': ['homeViewModel'],
  'pages/focus/focus': ['cabin'],
  'pages/review/review': ['reviewViewModel'],
  'pages/tools/tools': ['toolsViewModel'],
  'pages/profile/profile': ['profileViewModel']
};

Object.entries(tabStartupExpectations).forEach(([pagePath, fields]) => {
  const page = pagePath === launchPage ? homePage : loadPageDefinition(path.join(miniRoot, `${pagePath}.js`));
  const wxml = read(`${pagePath}.wxml`);
  assert(page && page.data, `${pagePath} Page definition loads`);
  fields.forEach((field) => {
    assert(page.data[field], `${pagePath} has launch-time ${field}`);
    if (field === 'cabin') {
      assert(page.data[field].currentSession, `${pagePath} has launch-time focus session state`);
      assert(wxml.includes(`${field}.currentSession`), `${pagePath} WXML binds focus session state`);
      return;
    }
    assert(page.data[field].title, `${pagePath} has launch-time ${field} title`);
    assert(wxml.includes(`${field}.title`), `${pagePath} WXML binds ${field}.title`);
  });
});

console.log('All miniapp startup guards pass.');
