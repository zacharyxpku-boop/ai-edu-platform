#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

function loadCommonJs(filePath, requireMap = {}) {
  const file = path.join(root, filePath);
  const code = fs.readFileSync(file, 'utf8');
  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    require(request) {
      if (Object.prototype.hasOwnProperty.call(requireMap, request)) return requireMap[request];
      return require(request);
    },
    console,
    Date,
    Math,
    Number,
    String,
    Object,
    Array,
    RegExp,
    JSON,
    wx: global.wx
  };
  vm.runInNewContext(code, sandbox, { filename: file });
  return module.exports;
}

function collectStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  if (Array.isArray(value)) value.forEach((item) => collectStrings(item, out));
  if (value && typeof value === 'object') Object.keys(value).forEach((key) => collectStrings(value[key], out));
  return out;
}

const report = loadCommonJs(path.join('miniprogram', 'utils', 'learning-report.js'));
const recognition = loadCommonJs(path.join('miniprogram', 'utils', 'learning-report-recognition.js'), {
  './learning-report': report
});

assert.strictEqual(report.buildQuickAssessmentQuestions().length, 15, 'quick assessment exposes 15 questions');

const scoreOnly = report.parseScoreTableText(`
姓名 丁诚
语文 95
数学 107
英语 109
物理 69
化学 64
生物 63
说明：仅可见自己孩子成绩
`);
assert.strictEqual(scoreOnly.parsedScores['语文'].score, 95, 'score parser reads plain subject-score table');
assert.strictEqual(scoreOnly.parsedScores['数学'].score, 107, 'score parser reads math score');
assert.strictEqual(scoreOnly.parsedRanks.totalScore, 507, 'score parser sums total when only subject scores are present');
assert(scoreOnly.missingFields.includes('总排名/班级排名'), 'missing rank is marked instead of invented');

const mixedTable = report.parseScoreTableText(`
语文分数 107.5 班名 8
数学分数 117 班名 15
英语分数 116 班名 5
物理分数 86 班名 6
化学分数 40 班名 29
生物分数 60 班名 13
总分 526.5 班级排名 8
`);
assert.strictEqual(mixedTable.parsedScores['语文'].rank, 8, 'score parser reads subject rank');
assert.strictEqual(mixedTable.parsedScores['化学'].score, 40, 'score parser reads low subject score without rewriting it');
assert.strictEqual(mixedTable.parsedRanks.classRank, 8, 'score parser reads mixed total/class rank');
assert.strictEqual(mixedTable.parsedRanks.totalScore, 526.5, 'score parser reads explicit total score');

const rankOnlyLine = report.parseScoreTableText(`
语文 100 班名 11
数学 115 班名 9
英语 104.5 班名 31
物理 78 班名 13
化学 59 班名 8
生物 64 班名 9
总分 520.5
物化生总分排名 5
`);
assert.strictEqual(rankOnlyLine.parsedRanks.totalScore, 520.5, 'group rank line does not overwrite total score');

const recognitionDraft = recognition.normalizeRecognitionDraft({
  text: [
    '\u8bed\u6587 95',
    '\u6570\u5b66 107 \u73ed\u540d 12',
    '\u82f1\u8bed 109',
    '\u603b\u5206 311 \u73ed\u7ea7\u6392\u540d 9'
  ].join('\n'),
  sourceType: 'score_sheet'
});
assert.strictEqual(recognitionDraft.sourceType, 'score_sheet', 'recognition draft keeps explicit source type');
assert.strictEqual(recognitionDraft.parsedScores['\u6570\u5b66'].score, 107, 'recognition draft parses score text');
assert.strictEqual(recognitionDraft.requiresConfirmation, true, 'recognition draft always asks parent confirmation');
assert(recognitionDraft.confirmPrompts.length > 0, 'recognition draft explains what to confirm');

const lowConfidenceDraft = recognition.normalizeRecognitionDraft({
  text: '\u56fe\u7247\u6bd4\u8f83\u6a21\u7cca\uff0c\u53ea\u80fd\u770b\u5230\u5b69\u5b50\u8fd9\u6b21\u597d\u50cf\u6709\u6570\u5b66\u548c\u82f1\u8bed\u3002',
  sourceType: 'score_sheet'
});
assert.strictEqual(Object.keys(lowConfidenceDraft.parsedScores).length, 0, 'low confidence draft does not invent scores');
assert(lowConfidenceDraft.missingFields.includes('\u53ef\u786e\u8ba4\u7684\u5b66\u79d1\u5206\u6570'), 'low confidence draft marks missing score fields');

const providerDraft = recognition.normalizeRecognitionDraft({
  text: '\u5bb6\u957f\u4e0a\u4f20\u8d44\u6599\u6458\u8981',
  sourceType: 'third_party_assessment',
  providerResult: {
    provider: 'configured_provider',
    recognizedText: '\u6570\u5b66 88 \u73ed\u7ea7\u6392\u540d 18\uff1b\u7b2c\u4e09\u65b9\u8d44\u6599\u663e\u793a\u66f4\u9002\u5408\u5148\u62c6\u6b65\u9aa4\u3002',
    parsedScores: {
      '\u6570\u5b66': { subject: '\u6570\u5b66', score: 88, confidence: 0.91, evidence: 'provider score' }
    },
    confidence: 0.91
  }
});
assert.strictEqual(providerDraft.mode, 'external_api', 'provider result is marked as external api mode');
assert.strictEqual(providerDraft.parsedScores['\u6570\u5b66'].score, 88, 'provider parsed scores can be merged');
assert(providerDraft.confirmPrompts.some((line) => /\u53c2\u8003/.test(line)), 'third-party material is only an auxiliary reference');

const mergedInput = recognition.mergeRecognitionIntoReportInput({ mode: 'fast', sourceText: '' }, providerDraft);
assert.strictEqual(mergedInput.parsedScores['\u6570\u5b66'].score, 88, 'recognition merge carries parsed scores into report input');
assert(mergedInput.reportSources[0].status.includes('\u786e\u8ba4'), 'recognition source remains confirm-first');

const fast = report.buildLearningReportDraft({
  sourceText: '数学 82，应用题总卡在列式，题目一多就不知道先写什么。',
  mode: 'fast'
});
assert.strictEqual(fast.reportDraft.mode, 'fast', 'single input can generate fast report');
assert(fast.reportCompleteness >= 28, 'fast report still has minimum completeness');
assert(fast.reportDraft.overview.evidence.length > 0, 'fast report carries evidence');
assert(fast.recommendationPlan.cta.path, 'fast report ends with an app solution path');

const answers = report.buildQuickAssessmentQuestions().map((question) => ({
  id: question.id,
  optionId: question.options[0].id,
  confidence: 0.86,
  source: 'unit_test'
}));

const full = report.buildLearningReportDraft({
  sourceText: `
语文分数 107.5 班名 8
数学分数 117 班名 15
英语分数 116 班名 5
物理分数 86 班名 6
化学分数 40 班名 29
生物分数 60 班名 13
总分 526.5 班级排名 8
学习类型：听觉型
行为导向：动机型
`,
  profileBasics: { grade: '高三', age: 17, gender: '男', region: '江苏', schoolType: '公办' },
  behaviorSignals: { studyMinutes: 180, homeworkMinutes: 120, sleepHours: 7, focusRating: 3 },
  emotionSignals: { anxiety: '中', communication: '每周 2 次', willingness: '愿意改方法', goalSense: '升学目标明确' },
  interestSignals: { tags: '篮球、科技', strengths: '愿意复述题意', aspiration: '想提升化学' },
  assessmentAnswers: answers
});
assert(full.reportCompleteness >= 80, 'full report reaches full completeness with rich inputs');
assert.strictEqual(full.reportDraft.mode, 'full', 'rich inputs produce full mode');
assert(full.reportDraft.capabilityTendencies.length >= 2, 'full report builds capability tendencies');
assert(full.reportDraft.diagnosisMatrix.some((item) => item.subject === '化学' && item.status === '需要支持'), 'full report identifies the weakest available subject as support-needed');
assert(full.reportDraft.rootCauses.every((item) => item.evidence && item.evidence.length && item.confidence && Array.isArray(item.missing)), 'root causes are evidence anchored');
assert(full.recommendationPlan.sevenDayPlan.length === 7, 'report creates a 7-day app-linked plan');
assert(full.recommendationPlan.sevenDayPlan.every((item) => item.path && item.minutes), 'each plan day has app route and time budget');

const allVisibleText = collectStrings([fast, full]).join('\n');
[
  ['证', '明'].join(''),
  ['必', '然'].join(''),
  ['注', '定'].join(''),
  ['没', '天', '赋'].join(''),
  ['孩子', '不', '行'].join(''),
  ['保证', '提升'].join(''),
  ['拍照', '出', '答案'].join(''),
  ['自动', '识别', '答案'].join('')
].map((term) => new RegExp(term)).forEach((pattern) => {
  assert(!pattern.test(allVisibleText), `report avoids unsafe deterministic wording: ${pattern}`);
});
const hiddenSpecificTerm = String.fromCharCode(30382, 32441);
assert(!allVisibleText.includes(hiddenSpecificTerm), 'report avoids the explicitly banned assessment term');

const storageMap = {};
global.wx = {
  getStorageSync(key) { return storageMap[key]; },
  setStorageSync(key, value) { storageMap[key] = value; },
  removeStorageSync(key) { delete storageMap[key]; }
};
const storage = loadCommonJs(path.join('miniprogram', 'utils', 'storage.js'), {
  './learning-priority': {},
  './learning-report': report
});
assert.strictEqual(typeof storage.loadLearningReportState, 'function', 'storage exports report loader');
assert.strictEqual(typeof storage.saveLearningReportState, 'function', 'storage exports report saver');

storage.saveLearningReportState(full, { skipBuild: true });
const resumed = storage.loadLearningReportState();
[
  'reportDraft',
  'reportSources',
  'recognitionDraft',
  'reportProgress',
  'parsedScores',
  'parsedRanks',
  'profileBasics',
  'behaviorSignals',
  'emotionSignals',
  'interestSignals',
  'assessmentAnswers',
  'capabilityTendencies',
  'diagnosisMatrix',
  'recommendationPlan',
  'reportCompleteness',
  'reportStatus',
  'lastSavedAt'
].forEach((key) => {
  assert(Object.prototype.hasOwnProperty.call(resumed, key), `resumed report keeps state key: ${key}`);
});
assert.strictEqual(resumed.parsedScores['数学'].score, 117, 'resumed report keeps parsed score data');
assert(resumed.reportDraft.overview.confidence, 'resumed report keeps confidence markers');

storage.saveLearningReportState(Object.assign({}, full, { recognitionDraft: providerDraft }), { skipBuild: true });
const resumedWithRecognition = storage.loadLearningReportState();
assert.strictEqual(resumedWithRecognition.recognitionDraft.mode, 'external_api', 'resumed report keeps recognition draft metadata');

const apiEndpoint = fs.readFileSync(path.join(root, 'api', 'mini', 'learning-report-recognize.js'), 'utf8');
assert(apiEndpoint.includes('requiresConfirmation: true'), 'recognition api requires parent confirmation');
assert(apiEndpoint.includes('verifySession'), 'recognition api keeps session verification path');
assert(apiEndpoint.includes('recognitionServiceReady'), 'recognition api has an explicit service readiness gate');
assert(apiEndpoint.includes('callRecognitionProvider'), 'recognition api can call a configured external recognition provider');
assert(apiEndpoint.includes('confirmFirst: true'), 'external recognition provider is invoked in confirm-first mode');
assert(apiEndpoint.includes('confirmation_required: true'), 'recognition service contract requires parent confirmation');
assert(apiEndpoint.includes('recognition_service_configuration'), 'recognition api reports setup action when external recognition is not configured');
assert(!/拍照出答案|自动识别答案/.test(apiEndpoint), 'recognition api avoids fake answer-recognition claims');

console.log('All learning report tests pass.');
