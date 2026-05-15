#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const root = path.join(__dirname, '..');

function loadCommonJsModule(relativePath) {
  const file = path.join(root, relativePath);
  const code = fs.readFileSync(file, 'utf8');
  const sandbox = {
    module: { exports: {} },
    exports: {},
    require,
    console,
    Date,
    Math,
    Number,
    String,
    RegExp,
    Array,
    Object
  };
  vm.runInNewContext(code, sandbox, { filename: file });
  return sandbox.module.exports;
}

const assessment = loadCommonJsModule('miniprogram/utils/learning-assessment.js');

const math = assessment.buildLearningAssessment('数学 82 分，应用题总卡在列式，题目一多就不知道先写什么');
assert.strictEqual(math.subject, '数学', 'math text should be detected as math');
assert.strictEqual(math.capability.id, 'tutor', 'math no-thought text should prefer tutor');
assert(math.methodHint.includes('咕点追问'), 'math recommendation should mention Socratic prompt');
assert(math.nextQuestion.includes('圈出题干里的已知条件') || math.nextQuestion.includes('从哪一步开始'), 'math next question stays first-step oriented');

const english = assessment.buildLearningAssessment('英语单词听写会，阅读题慢，语法题总错');
assert.strictEqual(english.subject, '英语', 'english text should be detected as english');
assert(['tutor', 'focus', 'review', 'tools'].includes(english.capability.id), 'english text should produce an explicit capability recommendation');
assert(english.methodHint.length > 0, 'english text should produce a method hint');

const quiet = assessment.buildLearningAssessment('');
assert(quiet.summaryLine.includes('先录入一次成绩'), 'empty assessment should be a safe empty state');
assert(quiet.nextQuestion.includes('从哪一步开始') || quiet.nextQuestion.includes('先说你准备'), 'empty assessment keeps a clear next action');

console.log('All learning assessment tests pass.');
