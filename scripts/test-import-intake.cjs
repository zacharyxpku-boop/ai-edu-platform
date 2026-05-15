#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const file = path.join(__dirname, '..', 'miniprogram', 'utils', 'import-intake.js');
const code = fs.readFileSync(file, 'utf8');
const sandbox = {
  module: { exports: {} },
  exports: {}
};
vm.runInNewContext(code, sandbox, { filename: file });
const intake = sandbox.module.exports;

const homework = intake.classifyImportInput('把一根长1.2米的圆柱形钢材截成3段，表面积增加了6.28平方分米。这根钢材原来的体积是多少？');
assert.strictEqual(homework.kind, 'homework_question', 'pasted question routes to homework tutoring');
assert.strictEqual(homework.route, 'tutor', 'pasted question opens tutor');
assert.strictEqual(homework.shouldCreateFocus, false, 'pasted question does not create a stuck focus by itself');
assert.ok(!/答案|秒解|拍照出答案/.test(homework.feedback), 'pasted question feedback does not promise answers');

const stuck = intake.classifyImportInput('我不会列式');
assert.strictEqual(stuck.kind, 'stuck_point', 'stuck wording is classified as stuck point');
assert.strictEqual(stuck.route, 'today_focus', 'stuck wording writes todayFocus');
assert.strictEqual(stuck.shouldCreateFocus, true, 'stuck wording creates todayFocus');

const review = intake.classifyImportInput('我想复习这个');
assert.strictEqual(review.kind, 'review_request', 'review wording is classified as review request');
assert.strictEqual(review.route, 'review', 'review wording routes to review/knowledge playground');
assert.strictEqual(review.shouldCreateFocus, false, 'review wording does not replace active focus');

['我读不懂题', '我不会列式', '我想复习这个', '我想做同类题'].forEach((label) => {
  assert(intake.IMPORT_CHIPS.some((chip) => chip.label === label), `import MVP chip exists: ${label}`);
});

console.log('All import intake tests pass.');
