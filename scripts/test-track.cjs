/**
 * scripts/test-track.cjs
 *
 * Unit test src/track.js by sandboxing a fake window + localStorage + document
 * environment, loading the IIFE, then asserting public API behavior.
 *
 * Run: node scripts/test-track.cjs · or via npm test
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const trackSrc = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'track.js'), 'utf8');

let failed = 0;
function pass(label) { console.log('  ✓ ' + label); }
function fail(label, err) { failed++; console.error('  ✗ ' + label + ' — ' + (err && err.message || err)); }

// ─── 沙箱 ───
function makeSandbox() {
  const store = {};
  const ls = {
    getItem: k => Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
  let metaContent = null;
  const docMock = {
    querySelector: sel => {
      if (sel === 'meta[name="ydzx-page"]' && metaContent) {
        return { content: metaContent };
      }
      return null;
    },
    body: {}
  };
  const win = {
    localStorage: ls,
    document: docMock,
    location: { pathname: '/test-page.html' },
    Blob: function Blob(parts, options) { this.parts = parts; this.options = options || {}; },
    navigator: { sendBeacon: () => false },
    fetch: () => Promise.resolve({ ok: true }),
    setTimeout: (fn, ms) => fn(),   // fire immediately for assert simplicity
    __setMeta(content) { metaContent = content; }
  };
  win.window = win;
  return win;
}

function loadTrack(sandbox) {
  // Wrap track.js IIFE: it expects (function(global) {...})(window)
  // We feed our sandbox.window as `window`, also expose localStorage / document
  const wrapped = `
    var localStorage = sandbox.localStorage;
    var document = sandbox.document;
    var location = sandbox.location;
    var Blob = sandbox.Blob;
    var setTimeout = sandbox.setTimeout;
    var window = sandbox.window;
    ${trackSrc}
    return sandbox.window.YDZX_TRACK;
  `;
  return new Function('sandbox', wrapped)(sandbox);
}

// ─── case 1: event() writes to localStorage ───
console.log('case 1: event writes log entry');
try {
  const sb = makeSandbox();
  const track = loadTrack(sb);
  track.event('hello', { x: 1 });
  const log = JSON.parse(sb.localStorage.getItem('ydzx_event_log_v1'));
  // First entry is the auto page_view, second is hello
  assert.equal(log.length, 2);
  assert.equal(log[0].e, 'page_view');
  assert.equal(log[1].e, 'hello');
  assert.equal(log[1].p.x, 1);
  pass('event() writes to ydzx_event_log_v1');
} catch (e) { fail('event write', e); }

// ─── case 2: page_view auto-fired with correct page name ───
console.log('case 2: auto page_view derives page name');
try {
  const sb = makeSandbox();
  const track = loadTrack(sb);
  const log = JSON.parse(sb.localStorage.getItem('ydzx_event_log_v1'));
  const pv = log.find(e => e.e === 'page_view');
  assert.ok(pv, 'page_view should exist');
  assert.equal(pv.p.page, 'test-page', 'derived from /test-page.html');
  pass('auto page_view derives page name from path');
} catch (e) { fail('auto pv', e); }

// ─── case 3: meta[name=ydzx-page] override ───
console.log('case 3: meta tag overrides path');
try {
  const sb = makeSandbox();
  sb.__setMeta('custom-page-name');
  const track = loadTrack(sb);
  const log = JSON.parse(sb.localStorage.getItem('ydzx_event_log_v1'));
  const pv = log.find(e => e.e === 'page_view');
  assert.equal(pv.p.page, 'custom-page-name');
  pass('meta tag overrides path');
} catch (e) { fail('meta override', e); }

// ─── case 4: ring buffer at 500 ───
console.log('case 4: ring buffer caps at 500');
try {
  const sb = makeSandbox();
  const track = loadTrack(sb);
  for (let i = 0; i < 600; i++) track.event('click', { i });
  const log = JSON.parse(sb.localStorage.getItem('ydzx_event_log_v1'));
  assert.equal(log.length, 500, 'capped at 500');
  // Last entry is the latest click
  assert.equal(log[log.length - 1].e, 'click');
  assert.equal(log[log.length - 1].p.i, 599);
  pass('ring buffer caps at 500');
} catch (e) { fail('ring buffer', e); }

// ─── case 5: recent() returns last n ───
console.log('case 5: recent(n)');
try {
  const sb = makeSandbox();
  const track = loadTrack(sb);
  for (let i = 0; i < 20; i++) track.event('e' + i, { i });
  const last5 = track.recent(5);
  assert.equal(last5.length, 5);
  assert.equal(last5[last5.length - 1].e, 'e19');
  pass('recent(5) returns last 5');
} catch (e) { fail('recent', e); }

// ─── case 6: countByName() bucketing ───
console.log('case 6: countByName');
try {
  const sb = makeSandbox();
  const track = loadTrack(sb);
  track.event('a', {}); track.event('a', {}); track.event('b', {});
  const cnt = track.countByName();
  assert.equal(cnt.a, 2);
  assert.equal(cnt.b, 1);
  assert.equal(cnt.page_view, 1);   // auto-fired
  pass('countByName bucket counts');
} catch (e) { fail('countByName', e); }

// ─── case 7: gtag/fbq mirror is best-effort, no crash ───
console.log('case 7: gtag/fbq shim does not crash');
try {
  const sb = makeSandbox();
  let gtagCalls = 0;
  sb.window.gtag = (...args) => { gtagCalls++; };
  // fbq not set on purpose to verify try-catch shim
  const track = loadTrack(sb);
  track.event('test_event', { foo: 'bar' });
  // gtag fires for both auto page_view and test_event
  assert.ok(gtagCalls >= 2, 'gtag invoked at least 2x');
  pass('gtag mirror works, fbq missing tolerated');
} catch (e) { fail('gtag/fbq shim', e); }

// ─── case 8: server payload redacts sensitive metadata ───
console.log('case 8: server payload redacts secrets');
try {
  const sb = makeSandbox();
  const requests = [];
  sb.window.fetch = (url, options) => {
    requests.push({ url, options });
    return Promise.resolve({ ok: true });
  };
  const track = loadTrack(sb);
  track.event('apikey_set', { provider: 'openai', apiKey: 'sk-secret-value', nested: { token: 'abc', ok: true } });
  const last = requests[requests.length - 1];
  assert.equal(last.url, '/api/track');
  const body = JSON.parse(last.options.body);
  assert.equal(body.meta.apiKey, '[redacted]');
  assert.equal(body.meta.nested.token, '[redacted]');
  assert.equal(body.meta.nested.ok, true);
  pass('server payload redacts sensitive metadata keys');
} catch (e) { fail('server redaction', e); }

// ─── exit ───
if (failed) { console.error('\nFAIL: ' + failed + ' assertion(s)'); process.exit(1); }
console.log('\nAll src/track.js unit tests pass.');
process.exit(0);
