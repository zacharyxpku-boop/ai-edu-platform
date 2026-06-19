const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const appJson = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram', 'app.json'), 'utf8'));
const miniRoot = path.join(root, 'miniprogram');

const declaredPages = new Set((appJson.pages || []).map((page) => `/${page}`));
const tabRoutes = new Set(((appJson.tabBar && appJson.tabBar.list) || []).map((item) => `/${item.pagePath}`));
const sceneKeys = ['upload', 'report', 'tutor', 'review', 'parent'];
let pageConfig = null;
let switchedUrl = '';
let navigatedUrl = '';
let storedContext = null;
const navigationWx = {
  switchTab({ url }) {
    switchedUrl = url;
  },
  navigateTo({ url }) {
    navigatedUrl = url;
  },
  setStorageSync(key, value) {
    if (key === 'navigation.pendingTabRoute.v1') storedContext = value;
  },
  removeStorageSync() {}
};

function resolveMiniRequire(fromFile, request) {
  if (!request.startsWith('.')) return require.resolve(request);
  const base = path.resolve(path.dirname(fromFile), request);
  const candidates = [
    base,
    `${base}.js`,
    path.join(base, 'index.js')
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function loadMiniModule(entryFile, options = {}) {
  const cache = {};

  function load(file) {
    const full = path.resolve(file);
    if (cache[full]) return cache[full].exports;
    const code = fs.readFileSync(full, 'utf8');
    const module = { exports: {} };
    cache[full] = module;
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
      wx: options.wx || {},
      getCurrentPages() {
        return [{ route: 'pages/home/home' }];
      },
      Page(definition) {
        if (typeof options.onPage === 'function') options.onPage(definition);
      },
      App() {},
      Component() {},
      require(request) {
        const resolved = resolveMiniRequire(full, request);
        assert(resolved, `${path.relative(miniRoot, full)} resolves ${request}`);
        if (!request.startsWith('.')) return require(resolved);
        return load(resolved);
      }
    };
    vm.runInNewContext(code, sandbox, { filename: full });
    return module.exports;
  }

  return load(entryFile);
}

const entryDetailPath = path.join(root, 'miniprogram', 'pages', 'entry-detail', 'entry-detail.js');
loadMiniModule(entryDetailPath, {
  wx: navigationWx,
  onPage(config) {
    pageConfig = config;
  }
});
const navigation = loadMiniModule(path.join(root, 'miniprogram', 'utils', 'navigation.js'), { wx: navigationWx });

assert(pageConfig, 'entry-detail page registers a Page config');
assert.strictEqual(typeof pageConfig.setScene, 'function', 'entry-detail exposes setScene');
assert.strictEqual(typeof pageConfig.goPrimary, 'function', 'entry-detail exposes primary navigation');
assert.strictEqual(typeof pageConfig.goSecondary, 'function', 'entry-detail exposes secondary navigation');
assert.strictEqual(typeof pageConfig.openSceneCard, 'function', 'entry-detail exposes card navigation');
assert.strictEqual(typeof pageConfig.openScene, 'undefined', 'entry-detail does not expose in-page cross-scene switching');

const detailWxml = fs.readFileSync(path.join(root, 'miniprogram', 'pages', 'entry-detail', 'entry-detail.wxml'), 'utf8');
assert(detailWxml.includes('entry-card-grid') && detailWxml.includes('wx:for="{{scene.cards}}"') && detailWxml.includes('bindtap="openSceneCard"'), 'entry-detail renders scene cards as clickable functional entries');

function createPage() {
  return {
    data: Object.assign({}, pageConfig.data),
    setData(update) {
      this.data = Object.assign({}, this.data, update);
    },
    setScene(key) {
      return pageConfig.setScene.call(this, key);
    }
  };
}

function routeBase(route) {
  return navigation.baseRoute(route);
}

function assertRoute(route, label) {
  const base = routeBase(route);
  assert(route && route.startsWith('/pages/'), `${label} uses an absolute miniapp route`);
  assert(declaredPages.has(base), `${label} route is declared in app.json: ${route}`);
  if (tabRoutes.has(base)) {
    assert(route.includes('?'), `${label} keeps tab route context in query so the destination can open the intended state`);
    assert(
      /(?:from=entry_|open=flow|panel=|mode=|quick_assessment=)/.test(route),
      `${label} tab route carries functional context instead of landing as a generic tab: ${route}`
    );
  }
}

const allCardScenes = new Set();
const primaryRoutes = [];
const secondaryRoutes = [];

sceneKeys.forEach((sceneKey) => {
  const page = createPage();
  pageConfig.setScene.call(page, sceneKey);
  assert.strictEqual(page.data.sceneKey, sceneKey, `entry-detail can activate scene: ${sceneKey}`);
  assert(page.data.scene && page.data.scene.title, `${sceneKey} scene has visible content`);
  assert(Array.isArray(page.data.scene.cards) && page.data.scene.cards.length >= 3, `${sceneKey} scene keeps clickable cards`);
  assert(!Array.isArray(page.data.scene.proofSteps), `${sceneKey} scene does not carry a repeated proof-flow rail`);

  assertRoute(page.data.scene.primaryRoute, `${sceneKey} primary`);
  assertRoute(page.data.scene.secondaryRoute, `${sceneKey} secondary`);
  primaryRoutes.push(page.data.scene.primaryRoute);
  secondaryRoutes.push(page.data.scene.secondaryRoute);

  page.data.scene.cards.forEach((card) => {
    assert(sceneKeys.includes(card.scene), `${sceneKey} card points to a known scene: ${card.scene}`);
    allCardScenes.add(card.scene);
  });
});

sceneKeys.forEach((sceneKey) => {
  assert(allCardScenes.has(sceneKey), `entry-detail card network exposes scene: ${sceneKey}`);
});

assert(!pageConfig.data.loopNodes, 'entry-detail does not carry hidden loop nodes after the child page is focused');

const tabRouteWithQuery = primaryRoutes.find((route) => tabRoutes.has(routeBase(route)));
assert(tabRouteWithQuery, 'at least one entry-detail primary route targets a tab page with context');
assert.strictEqual(navigation.navigateLearningRoute(tabRouteWithQuery), true, 'navigation accepts tab route with query');
assert.strictEqual(switchedUrl, routeBase(tabRouteWithQuery), 'tab route switches to the declared base path');
assert(storedContext && storedContext.route === tabRouteWithQuery, 'tab route query is preserved in pending context');

const normalRoute = [...primaryRoutes, ...secondaryRoutes].find((route) => !tabRoutes.has(routeBase(route)));
if (normalRoute) {
  assert.strictEqual(navigation.navigateLearningRoute(normalRoute), true, 'navigation accepts normal page route');
  assert.strictEqual(navigatedUrl, normalRoute, 'normal page route uses navigateTo with the full URL');
}

const cardPage = createPage();
pageConfig.setScene.call(cardPage, 'upload');
switchedUrl = '';
navigatedUrl = '';
storedContext = null;
pageConfig.openSceneCard.call(cardPage, { currentTarget: { dataset: { scene: 'tutor' } } });
assert.strictEqual(switchedUrl, '/pages/tutor/tutor', 'entry-detail card tap switches to the target tab page');
assert(storedContext && storedContext.route.includes('/pages/tutor/tutor?from=entry_tutor_first_step'), 'entry-detail card tap preserves the target scene functional context');

console.log('Miniapp entry-detail route contract passed.');
