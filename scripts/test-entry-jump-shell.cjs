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

tabPages.forEach(([name, wxmlPath, jsPath]) => {
  const wxml = read(wxmlPath);
  const js = read(jsPath);
  const launchSlice = wxml.split('<block wx:if="{{showLegacyEntryContent}}">')[0];
  const jumpCardCount = (launchSlice.match(/ux-kit-jump-card/g) || []).length;

  assertWxmlTemplateIsCompilerSafe(name, wxml, {
    fullTagStack: name === 'arcade',
    noRawAngleExpressions: name === 'arcade'
  });
  assert(wxml.includes('ux-kit-screen'), `${name} keeps a focused entry screen`);
  assert(wxml.includes('ux-kit-jump-grid'), `${name} entry exposes clear jump cards instead of a long scroll brief`);
  assert.strictEqual(jumpCardCount, 3, `${name} direct tab entry exposes exactly three jump cards`);
  denseLaunchClasses.forEach((className) => {
    assert(!launchSlice.includes(className), `${name} direct tab entry removes dense ${className} from the launch viewport`);
  });
  assert(wxml.includes('bindtap="openEntryDetail"'), `${name} entry CTA jumps to a child page`);
  assert(wxml.includes('wx:if="{{showLegacyEntryContent}}"'), `${name} legacy long content is still guarded behind an explicit flag`);
  assert(js.includes('showLegacyEntryContent: false'), `${name} keeps historical long UI closed even after child-page returns`);
  assert(!/<view class="page-positioning [^"]+">/.test(wxml), `${name} does not render the old explanatory positioning block on direct tab entry`);
  assert(js.includes('openEntryDetail(event)'), `${name} implements entry jump handler`);
  assert(js.includes('/pages/entry-detail/entry-detail?scene='), `${name} routes to the entry detail child page`);
  assert(js.includes('consumePendingTabRouteContext'), `${name} still consumes child-page route context without reopening historical UI`);
});

const detailWxml = read('miniprogram/pages/entry-detail/entry-detail.wxml');
const detailJs = read('miniprogram/pages/entry-detail/entry-detail.js');
['today', 'tutor', 'review', 'parent', 'upload'].forEach((scene) => {
  assert(detailJs.includes(`${scene}: {`), `entry detail supports ${scene} scene`);
});
assert(detailWxml.includes('entry-primary') && detailWxml.includes('entry-secondary'), 'entry detail exposes clear next actions');
assert(detailWxml.includes('entry-jump-grid') && detailWxml.includes('bindtap="openScene"'), 'entry detail child page exposes clickable cross-entry jumps');
assert(detailJs.includes('openScene(event)') && detailJs.includes('setScene(key'), 'entry detail can switch child entry scenes in place');
assert(detailJs.includes('open=flow'), 'entry detail marks tab-return actions as explicit functional flows');

const navigationJs = read('miniprogram/utils/navigation.js');
assert(navigationJs.includes('consumePendingTabRouteContext'), 'navigation can consume pending tab route context');
assert(navigationJs.includes('shouldOpenFunctionalTab'), 'navigation distinguishes short tab entries from functional flows');
assert(navigationJs.includes('TAB_ROUTES.includes(base)'), 'navigation detects tabBar routes');
assert(navigationJs.includes('wx.switchTab({ url: base })'), 'navigation uses switchTab for tabBar routes');

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
