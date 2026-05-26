#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const appPath = path.join(root, 'src', 'app.js');
const stylesPath = path.join(root, 'src', 'styles.css');
const viewModelPath = path.join(root, 'src', 'view-model.js');

function fail(message) {
  console.error(`Web interaction check failed: ${message}`);
  process.exit(1);
}

const app = fs.readFileSync(appPath, 'utf8');
const styles = fs.readFileSync(stylesPath, 'utf8');
const viewModel = fs.readFileSync(viewModelPath, 'utf8');

for (const snippet of [
  'function bindSearch()',
  'function routeForSearch(value)',
  'function pageGuide(id)',
  'function bindActions()',
  'function handleAction(action, target)',
  'function showToast(message)',
  'function shareReport()'
]) {
  if (!app.includes(snippet)) fail(`missing ${snippet}`);
}

for (const action of [
  'mock-upload',
  'select-material',
  'print-report',
  'share-report',
  'send-tutor',
  'tutor-stuck',
  'tutor-hint',
  'tutor-retry',
  'start-review',
  'parent-question'
]) {
  if (!app.includes(`data-action="${action}"`)) {
    fail(`missing data-action="${action}"`);
  }
  if (!app.includes(`action === '${action}'`)) {
    fail(`missing handler branch for ${action}`);
  }
}

for (const route of ['upload', 'report', 'tutor', 'review', 'parent']) {
  if (!app.includes(`return '${route}'`)) {
    fail(`search route mapping does not cover ${route}`);
  }
}

for (const style of ['.web-toast', '.web-toast.show', '@media print']) {
  if (!styles.includes(style)) fail(`missing ${style} style`);
}

for (const requiredUxSnippet of [
  'WEB_PAGE_GUIDES',
  'WEB_MATERIAL_PIPELINE',
  'WEB_CONFIDENCE_BANDS',
  "pageGuide('upload')",
  "pageGuide('report')",
  "pageGuide('tutor')",
  "pageGuide('review')",
  "pageGuide('parent')"
]) {
  if (!app.includes(requiredUxSnippet)) fail(`missing UX flow snippet: ${requiredUxSnippet}`);
}

for (const requiredViewModelSnippet of [
  'export const WEB_DEMO_STATE',
  'export const WEB_ENTRY_CARDS',
  'export const WEB_PAGE_GUIDES',
  'export const WEB_MATERIAL_PIPELINE',
  'export const WEB_CONFIDENCE_BANDS'
]) {
  if (!viewModel.includes(requiredViewModelSnippet)) fail(`missing view-model export: ${requiredViewModelSnippet}`);
}

for (const requiredUxStyle of ['.page-guide', '.intake-pipeline', '.confidence-board']) {
  if (!styles.includes(requiredUxStyle)) fail(`missing UX flow style: ${requiredUxStyle}`);
}

console.log('Web interaction check passed for search, actions, toast, and print flow.');
