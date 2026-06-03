#!/usr/bin/env node
'use strict';

const path = require('path');
const followup = require('../src/lobster/lobster-followup.cjs');

function argValue(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : '';
}

const baseDirArg = argValue('baseDir');
const nowArg = argValue('now');
const options = {};
if (baseDirArg) options.baseDir = path.resolve(baseDirArg);
if (nowArg) options.now = nowArg;

const scan = followup.scanDueFollowUps(options);
process.stdout.write(`${JSON.stringify(scan, null, 2)}\n`);
if (!scan.ok) process.exit(1);
