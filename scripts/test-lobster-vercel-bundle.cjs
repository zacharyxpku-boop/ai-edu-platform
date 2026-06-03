#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const config = vercel.functions && vercel.functions['api/lobster*.js'];
const fallbackPath = path.join(root, 'src', 'lobster', 'lobster-edu-fallback.cjs');
const corePath = path.join(root, 'src', 'lobster', 'lobster-core.cjs');

assert(config, 'vercel.json configures lobster serverless functions');
assert.strictEqual(config.includeFiles, 'miniprogram/utils/**', 'lobster function bundle includes miniapp utility dependencies');
assert(fs.existsSync(fallbackPath), 'lobster runtime has a fallback education adapter for serverless bundles');
assert(fs.readFileSync(corePath, 'utf8').includes('safeLoadCommonJs'), 'lobster core falls back when miniapp utility files are unavailable');

process.env.LOBSTER_FORCE_EDU_FALLBACK = '1';
const lobster = require('../src/lobster/lobster-core.cjs');
const child = lobster.routeLobsterMessage({ role: 'child', message: '我不会第一步' });
const parent = lobster.routeLobsterMessage({ role: 'parent', message: '数学82分，应用题卡住' });
delete process.env.LOBSTER_FORCE_EDU_FALLBACK;

assert(child && child.displayName, 'fallback child lobster produces a reply');
assert(child.teacherMode && child.teacherMode.noFinalAnswer, 'fallback child lobster keeps no-final-answer boundary');
assert(parent && parent.summary && parent.summary.oneSentenceDecision, 'fallback parent lobster produces a report summary');

console.log('Lobster Vercel bundle tests pass.');
