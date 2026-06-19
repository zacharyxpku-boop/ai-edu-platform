const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const captureScript = fs.readFileSync(path.join(root, 'scripts', 'capture-miniapp-real-device.cjs'), 'utf8');
const gateScript = fs.readFileSync(path.join(root, 'scripts', 'miniapp-real-device-gate.cjs'), 'utf8');

assert(captureScript.includes("process.env.WECHAT_DEVTOOLS_PORT_FLAG === '--auto-port' ? '--auto-port' : '--port'"), 'capture script defaults to the current DevTools CLI --port variant while keeping the legacy --auto-port override');
assert(captureScript.includes("['auto', '--project', projectPath, autoPortFlag, String(launchPort), '--trust-project']"), 'capture script launches WeChat DevTools automation with a configurable port flag after the auto command');
assert(captureScript.includes('WECHAT_DEVTOOLS_AUTO_PORT'), 'capture script keeps an explicit environment override for the automation websocket port');
assert(captureScript.includes('writeCaptureError(error)'), 'capture script writes a structured capture error report when DevTools automation is blocked');

const directShots = [...captureScript.matchAll(/\['\/pages\/[^']+', 'tab-[^']+\.png'\]/g)].map((match) => match[0]);
assert.strictEqual(directShots.length, 4, 'capture script covers the four AI-first main tab screenshots');
assert(!captureScript.includes('tab-today.png') && captureScript.includes('tab-tutor.png'), 'capture script removes the retired today tab screenshot and starts from AI tutor');
assert(gateScript.includes('Open Knowledge Park tab directly') && gateScript.includes('Open Growth Report tab directly') && gateScript.includes('Open Upload Material page directly'), 'real-device gate uses the current Knowledge Park / Growth Report / Upload Material product names');
[
  'Open short-revisit tab directly',
  'Open Parent tab directly',
  'Open Upload tab directly',
  'learning pack',
  'Short revisit entry screen',
  'Parent sees key progress entry screen'
].forEach((term) => {
  assert(!gateScript.includes(term), `real-device gate does not restore stale product wording: ${term}`);
});

const childFlows = [...captureScript.matchAll(/\['(?:tutor|review|report|parent|upload)', 'child-[^']+\.png'\]/g)].map((match) => match[0]);
assert.strictEqual(childFlows.length, 5, 'capture script covers five active post-click child flow screenshots');

const childEntryShots = [...captureScript.matchAll(/\['(?:tutor|review|report|parent|upload)', 'entry-detail-[^']+\.png'\]/g)].map((match) => match[0]);
assert.strictEqual(childEntryShots.length, 5, 'capture script covers five active entry-detail visual screenshots before tapping primary actions');

[
  'entry-detail-tutor.png',
  'entry-detail-review.png',
  'entry-detail-report.png',
  'entry-detail-parent.png',
  'entry-detail-upload.png'
].forEach((name) => {
  assert(captureScript.includes(name), `capture script keeps required entry-detail evidence slot: ${name}`);
});

console.log('Miniapp real-device capture contract passed.');
