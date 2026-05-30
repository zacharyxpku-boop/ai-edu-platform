const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function assertWxmlTemplateIsCompilerSafe(name, wxml, options = {}) {
  assert.strictEqual((wxml.match(/(?<!\{)\{(?!\{)/g) || []).length, 0, `${name} has malformed single-brace mustache`);
  assert.strictEqual((wxml.match(/\{\{/g) || []).length, (wxml.match(/\}\}/g) || []).length, `${name} has balanced mustache delimiters`);

  const mustache = /\{\{([\s\S]*?)\}\}/g;
  let expression;
  while ((expression = mustache.exec(wxml))) {
    const singleQuotes = (expression[1].match(/'/g) || []).length;
    const doubleQuotes = (expression[1].match(/"/g) || []).length;
    assert.strictEqual(singleQuotes % 2, 0, `${name} has an unterminated single-quoted WXML expression: ${expression[0]}`);
    assert.strictEqual(doubleQuotes % 2, 0, `${name} has an unterminated double-quoted WXML expression: ${expression[0]}`);
    if (options.noRawAngleExpressions) {
      assert(!/[<>]/.test(expression[1]), `${name} keeps raw angle comparisons out of WXML expressions: ${expression[0]}`);
    }
  }

  if (options.fullTagStack) {
    const stack = [];
    const tags = /<\/?[a-zA-Z][^>]*>/g;
    let tagMatch;
    while ((tagMatch = tags.exec(wxml))) {
      const tag = tagMatch[0];
      const tagName = (tag.match(/^<\/?\s*([\w-]+)/) || [])[1];
      if (!tagName) continue;
      if (tag.startsWith('</')) {
        const last = stack.pop();
        assert.strictEqual(tagName, last, `${name} closes </${tagName}> while <${last || 'none'}> is open`);
      } else if (!tag.endsWith('/>') && !['image', 'input'].includes(tagName)) {
        stack.push(tagName);
      }
    }
    assert.strictEqual(stack.length, 0, `${name} has unclosed WXML tags: ${stack.join(', ')}`);
  }
}

const appJson = JSON.parse(read('miniprogram/app.json'));
assert(appJson.pages.includes('pages/entry-detail/entry-detail'), 'entry detail page is registered');
[
  ['pages', 'daily-math', 'daily-math'].join('/'),
  ['pages', 'dictation', 'dictation'].join('/'),
  ['pages', 'light-diagnosis', 'light-diagnosis'].join('/'),
  ['pages', 'focus', 'focus'].join('/'),
  ['pages', 'tools', 'tools'].join('/'),
  ['pages', 'module', 'module'].join('/'),
  ['pages', 'radar', 'radar'].join('/'),
  ['pages', 'diagnosis', 'diagnosis'].join('/')
].forEach((page) => {
  assert(!appJson.pages.includes(page), `retired page must not remain registered: ${page}`);
});

const tabPages = [
  ['home', 'miniprogram/pages/home/home.wxml', 'miniprogram/pages/home/home.js'],
  ['tutor', 'miniprogram/pages/tutor/tutor.wxml', 'miniprogram/pages/tutor/tutor.js'],
  ['arcade', 'miniprogram/pages/arcade/arcade.wxml', 'miniprogram/pages/arcade/arcade.js'],
  ['profile', 'miniprogram/pages/profile/profile.wxml', 'miniprogram/pages/profile/profile.js'],
  ['upload', 'miniprogram/pages/upload/upload.wxml', 'miniprogram/pages/upload/upload.js']
];

const denseLaunchClasses = [
  'ux-kit-input-card',
  'ux-kit-route',
  'ux-kit-teacher-card',
  'ux-kit-quiz-card',
  'ux-kit-parent-card',
  'ux-kit-output-grid',
  'ux-kit-segment'
];

const retiredUiMarkers = [
  ['show','Leg','acyEntryContent'].join(''),
  ['page','positioning'].join('-'),
  ['rc','14-'].join(''),
  ['v','1-topbar'].join(''),
  ['composer','shell'].join('-'),
  ['family','summary-card'].join('-')
];

tabPages.forEach(([name, wxmlPath, jsPath]) => {
  const wxml = read(wxmlPath);
  const js = read(jsPath);
  const launchSlice = wxml.split('<block wx:if="{{showRetiredEntryContent}}">')[0];
  const jumpCardCount = (launchSlice.match(/ux-kit-jump-card/g) || []).length;

  assertWxmlTemplateIsCompilerSafe(name, wxml, {
    fullTagStack: name === 'arcade',
    noRawAngleExpressions: name === 'arcade'
  });
  assert(wxml.includes('ux-kit-screen'), `${name} keeps a focused entry screen`);
  assert(wxml.includes('ux-kit-jump-grid'), `${name} entry exposes clear jump cards instead of a long scroll brief`);
  assert.strictEqual(jumpCardCount, 3, `${name} direct tab entry exposes exactly three jump cards`);
  retiredUiMarkers.forEach((marker) => {
    assert(!wxml.includes(marker), `${name} WXML must not carry retired UI marker: ${marker}`);
  });
  denseLaunchClasses.forEach((className) => {
    assert(!launchSlice.includes(className), `${name} direct tab entry removes dense ${className} from the launch viewport`);
  });
  assert(wxml.includes('bindtap="openEntryDetail"'), `${name} entry CTA jumps to a child page`);
  const positioningClass = ['page', 'positioning'].join('-');
  assert(!new RegExp(`<view class="${positioningClass} [^"]+">`).test(wxml), `${name} does not render the retired explanatory positioning block on direct tab entry`);
  assert(js.includes('openEntryDetail(event)'), `${name} implements entry jump handler`);
  assert(js.includes('/pages/entry-detail/entry-detail?scene='), `${name} routes to the entry detail child page`);
  assert(js.includes('consumePendingTabRouteContext'), `${name} still consumes child-page route context without reopening historical UI`);
});

const detailWxml = read('miniprogram/pages/entry-detail/entry-detail.wxml');
const detailJs = read('miniprogram/pages/entry-detail/entry-detail.js');
['today', 'tutor', 'review', 'report', 'parent', 'upload'].forEach((scene) => {
  assert(detailJs.includes(`${scene}: {`), `entry detail supports ${scene} scene`);
});
assert(detailWxml.includes('entry-primary') && detailWxml.includes('entry-secondary'), 'entry detail exposes clear next actions');
assert(detailWxml.includes('entry-jump-grid') && detailWxml.includes('bindtap="openScene"'), 'entry detail child page exposes clickable cross-entry jumps');
assert(detailJs.includes('openScene(event)') && detailJs.includes('setScene(key'), 'entry detail can switch child entry scenes in place');
assert(detailWxml.includes('entry-spotlight') && detailJs.includes('今晚路线板') && detailJs.includes('材料分类板') && detailJs.includes('私教追问板') && detailJs.includes('复习闯关板') && detailJs.includes('报告决策板') && detailJs.includes('家长行动卡'), 'entry detail child scenes have dedicated visual decision panels');
assert(detailJs.includes('open=flow'), 'entry detail marks tab-return actions as explicit functional flows');
assert(detailWxml.includes('entry-proof-node') && detailWxml.includes('entry-proof-icon'), 'entry detail proof strip uses visual evidence nodes');
assert(detailWxml.includes('wx:for="{{scene.proofSteps}}"') && detailWxml.includes('class="entry-proof-hint"'), 'entry detail proof strip is data-driven instead of a hardcoded three-step tail');
['entry-upload.png', 'entry-report.png', 'entry-tutor.png', 'entry-review.png', 'entry-parent.png'].forEach((asset) => {
  assert(detailJs.includes(asset), `entry detail proof flow uses reference asset: ${asset}`);
});
assert(detailJs.includes('const PROOF_FLOW') && detailJs.includes("label: '材料'") && detailJs.includes("label: '家长'"), 'entry detail proof flow covers the full upload-report-tutor-review-parent loop');
assert(!detailWxml.includes('<view><text>1</text>'), 'entry detail proof strip never regresses to number-only boxes');

const sceneBodyPattern = /(\w+): \{([\s\S]*?)\n  \},/g;
let sceneMatch;
const sceneRoutes = {};
while ((sceneMatch = sceneBodyPattern.exec(detailJs))) {
  const [, scene, body] = sceneMatch;
  if (!['today', 'tutor', 'review', 'report', 'parent', 'upload'].includes(scene)) continue;
  const primary = (body.match(/primaryRoute: '([^']+)'/) || [])[1] || '';
  const secondary = (body.match(/secondaryRoute: '([^']+)'/) || [])[1] || '';
  sceneRoutes[scene] = { primary, secondary };
}
assert.strictEqual(Object.keys(sceneRoutes).length, 6, 'entry detail defines routes for six child scenes');
Object.entries(sceneRoutes).forEach(([scene, routes]) => {
  assert(routes.primary && routes.secondary, `${scene} child scene has primary and secondary routes`);
  Object.entries(routes).forEach(([kind, route]) => {
    assert(!/\/pages\/(daily-math|dictation|light-diagnosis|focus|tools|module|radar|diagnosis)\//.test(route), `${scene} ${kind} route does not reopen retired pages`);
    assert(
      /\/pages\/(home|tutor|review|profile|upload|entry-detail)\//.test(route),
      `${scene} ${kind} route targets an active page: ${route}`
    );
  });
});
assert(sceneRoutes.today.primary.includes('/pages/tutor/tutor'), 'today primary goes to AI tutor first step');
assert(sceneRoutes.report.primary.includes('/pages/profile/profile'), 'report primary goes to evidence report view');
assert(sceneRoutes.tutor.secondary.includes('/pages/review/review'), 'tutor secondary deposits into review');
assert(sceneRoutes.review.secondary.includes('/pages/tutor/tutor'), 'review secondary can return to tutor');
assert(sceneRoutes.parent.secondary.includes('/pages/upload/upload'), 'parent secondary can add evidence');
assert(sceneRoutes.upload.primary.includes('/pages/upload/upload'), 'upload primary opens upload flow');

const navigationJs = read('miniprogram/utils/navigation.js');
assert(navigationJs.includes('consumePendingTabRouteContext'), 'navigation can consume pending tab route context');
assert(navigationJs.includes('shouldOpenFunctionalTab'), 'navigation distinguishes short tab entries from functional flows');
assert(navigationJs.includes('TAB_ROUTES.includes(base)'), 'navigation detects tabBar routes');
assert(navigationJs.includes('wx.switchTab({ url: base })'), 'navigation uses switchTab for tabBar routes');
assert(!navigationJs.includes('RETIRED_ROUTE_MAP'), 'navigation no longer carries old route compatibility maps');
assert(navigationJs.includes('function activeRoute(route)') && navigationJs.includes('return normalizeRoute(route);'), 'navigation only accepts current active routes');

const activeSurfaceFiles = [
  'miniprogram/pages/home/home.js',
  'miniprogram/pages/upload/upload.js',
  'miniprogram/pages/entry-detail/entry-detail.js',
  'miniprogram/pages/tutor/tutor.js',
  'miniprogram/pages/review/review.js',
  'miniprogram/pages/arcade/arcade.js',
  'miniprogram/pages/profile/profile.js',
  'miniprogram/utils/storage.js',
  'miniprogram/utils/review-cards.js',
  'miniprogram/utils/real-homework-coverage.js',
  'miniprogram/utils/product-readiness.js',
  'miniprogram/utils/personalized-report-template.js',
  'miniprogram/utils/learning-report.js',
  'miniprogram/utils/game-logic.js',
  'miniprogram/utils/learning-assessment.js'
];
const retiredRoutePattern = /\/pages\/(?:daily-math|dictation|light-diagnosis|focus|tools|module|radar|diagnosis)\//;
activeSurfaceFiles.forEach((file) => {
  const source = read(file);
  assert(!retiredRoutePattern.test(source), `${file} must not retain direct retired-page routes`);
});

const registeredTabs = new Set((appJson.tabBar && appJson.tabBar.list ? appJson.tabBar.list : [])
  .map((item) => `/${item.pagePath}`));
const tabRoutePattern = /wx\.navigateTo\(\{\s*url:\s*[^}]*\/pages\/(home|tutor|arcade|profile|upload)\//g;
const literalSwitchTabPattern = /wx\.switchTab\(\{\s*url:\s*['"`]([^'"`]+)['"`]/g;
const jsFilesToScan = fs.readdirSync(path.join(root, 'miniprogram', 'pages'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join('miniprogram', 'pages', entry.name, `${entry.name}.js`))
  .filter((file) => fs.existsSync(path.join(root, file)));
jsFilesToScan.forEach((file) => {
  const source = read(file);
  tabRoutePattern.lastIndex = 0;
  assert(!tabRoutePattern.test(source), `${file} must not navigateTo a tabBar page; use navigation.navigateLearningRoute`);
  literalSwitchTabPattern.lastIndex = 0;
  let match;
  while ((match = literalSwitchTabPattern.exec(source))) {
    assert(registeredTabs.has(match[1]), `${file} must not switchTab to non-tabBar route ${match[1]}`);
  }
  assert(!source.includes('wx.navigateTo({ url: pageTargets[action] })'), `${file} must route dynamic tab/page targets through navigation.navigateLearningRoute`);
});

const realDeviceGate = read('scripts/miniapp-real-device-gate.cjs');
assert(realDeviceGate.includes('readPngSize'), 'real-device gate validates screenshot dimensions, not only file presence');
assert(realDeviceGate.includes('tab-today.png') && realDeviceGate.includes('child-upload-material.png'), 'real-device gate lists all tab and child screenshots');
assert(realDeviceGate.includes('Static HTML previews and desktop screenshots do not satisfy this gate'), 'real-device gate rejects static proxy evidence');
assert(realDeviceGate.includes('route:') && realDeviceGate.includes('expected:'), 'real-device gate records route and expected UX for each screenshot');

console.log('All entry jump shell tests pass.');
