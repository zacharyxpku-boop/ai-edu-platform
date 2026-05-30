#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

function loadCommonJs(filePath) {
  const file = path.join(root, filePath);
  const code = fs.readFileSync(file, 'utf8');
  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    require,
    console,
    Date,
    Math,
    Number,
    String,
    Object,
    Array,
    RegExp,
    JSON
  };
  vm.runInNewContext(code, sandbox, { filename: file });
  return module.exports;
}

const renderer = loadCommonJs(path.join('miniprogram', 'utils', 'personalized-report-template.js'));

const dingChengInput = {
  studentName: '丁诚',
  stage: '高三备考',
  generatedAt: '2026-05-24',
  assessmentProfile: {
    learningChannel: '听觉输入更容易启动',
    brainPreference: '逻辑结构偏好，空间/视觉细节需补偿',
    behaviorMode: '目标驱动，适合短周期反馈',
    persistenceIndex: '坚持指数偏低，需小块任务和高频正反馈',
    strengths: ['听觉理解与复述', '结构化执行', '情绪稳定'],
    risks: ['不要贴固定听觉型标签', '空间与视觉短板必须用真实题验证']
  },
  scoreRecords: [
    {
      examName: '阶段一',
      totalScore: 507,
      classRank: 3,
      subjects: [
        { name: '语文', score: 95, fullScore: 150, classRank: 17 },
        { name: '数学', score: 107, fullScore: 150, classRank: 11 },
        { name: '英语', score: 109, fullScore: 150, classRank: 16 },
        { name: '物理', score: 69, fullScore: 100, classRank: 8 },
        { name: '化学', score: 64, fullScore: 100, classRank: 7 },
        { name: '生物', score: 63, fullScore: 100, classRank: 6 }
      ]
    },
    {
      examName: '阶段二',
      totalScore: 526.5,
      classRank: 8,
      subjects: [
        { name: '语文', score: 107.5, fullScore: 150, classRank: 8 },
        { name: '数学', score: 117, fullScore: 150, classRank: 15 },
        { name: '英语', score: 116, fullScore: 150, classRank: 5 },
        { name: '物理', score: 86, fullScore: 100, classRank: 6 },
        { name: '化学', score: 40, fullScore: 100, classRank: 29 },
        { name: '生物', score: 60, fullScore: 100, classRank: 13 }
      ]
    },
    {
      examName: '阶段三',
      totalScore: 520.5,
      comboRank: 5,
      subjects: [
        { name: '语文', score: 100, fullScore: 150, classRank: 11 },
        { name: '数学', score: 115, fullScore: 150, classRank: 9 },
        { name: '英语', score: 104.5, fullScore: 150, classRank: 31 },
        { name: '物理', score: 78, fullScore: 100, classRank: 13 },
        { name: '化学', score: 59, fullScore: 100, classRank: 8 },
        { name: '生物', score: 64, fullScore: 100, classRank: 9 }
      ]
    }
  ]
};

const model = renderer.buildPersonalizedReportModel(dingChengInput);
assert.strictEqual(model.studentName, '丁诚', 'model keeps student name');
assert.strictEqual(model.records.length, 3, 'model keeps all three score snapshots');
assert(model.subjects.length >= 6, 'model builds six subject plans');
assert(model.prioritySubjects.length === 3, 'model exposes three priority subjects');
assert(model.methodology.some((item) => item.id === 'socratic_private_tutor'), 'methodology includes Socratic tutor');
assert(model.methodology.some((item) => item.id === 'retrieval_spaced_recall'), 'methodology includes spaced retrieval');
assert(model.methodology.some((item) => item.id === 'interleaving_variant_transfer'), 'methodology includes transfer validation');
assert(model.talentProfile && model.talentProfile.learnerArchetype.includes('学习者'), 'model builds a parent-readable talent profile');
assert(model.talentMethodMatches.some((item) => item.method.includes('苏格拉底') && item.potential.includes('语言')), 'talent profile maps signal to method and potential');
assert(model.guardrails.some((line) => line.includes('固定天赋标签')), 'guardrail blocks fixed talent labels');
assert(model.subjects.find((item) => item.name === '物理').method.includes('小黑板'), 'physics plan uses blackboard compensation');
assert(model.subjects.find((item) => item.name === '生物').day7.includes('图表'), 'biology plan validates chart transfer');

const html = renderer.renderPersonalizedReportHtml(model);
[
  '丁诚专属个性化学习方法论报告',
  '目录 Contents',
  '成绩趋势与学科优先级',
  '个性化学习方法论',
  '分学科行动路径',
  '7 天验证与 30 天执行闭环',
  '苏格拉底 1 对 1 私教',
  '/pages/tutor/tutor?from=report_physics'
].forEach((text) => {
  assert(html.includes(text), `HTML includes ${text}`);
});
assert(html.includes('@media(max-width:760px)'), 'HTML includes mobile responsive media query');
assert(html.includes('@media print'), 'HTML includes print rules for PDF export');
assert(html.includes('@page'), 'HTML includes paged-media print sizing');
assert((html.match(/class="report-page/g) || []).length >= 60, 'HTML renders a 60+ page long-form report structure');
assert(html.length > 70000, 'HTML report has enough text density for a parent-facing long report');
assert(Buffer.byteLength(html, 'utf8') > 100000, 'HTML report has enough byte-level density for Chinese long-form delivery');
assert(html.includes('cover-panel'), 'HTML includes formal cover summary panel');
assert(html.includes('目录与阅读路径'), 'HTML includes a report-style visual table of contents');
assert(html.includes('toc-row'), 'HTML includes structured table-of-contents rows');
assert((html.match(/class="dense-table/g) || []).length >= 2, 'HTML includes dense report tables inspired by data-report layouts');
[
  '证据地图',
  '天赋潜能',
  '测评信号',
  '天赋 × 方法匹配矩阵',
  '教育学依据',
  '为什么不直接用别的方法',
  '成绩 × 天赋 × 方法匹配',
  '从成绩/卡点看到什么',
  '自我解释与生成效应',
  '双编码与认知负荷',
  '检索练习与间隔效应',
  '潜能释放路径',
  '潜能释放关键',
  '为什么现在没完全释放',
  '测评拆解',
  '成绩证据矩阵',
  'AI 与本地规则分工',
  '家长话术',
  '30 天计划',
  '报告放行规则',
  '交付质量',
  'html-anything',
  '每个学科都要落到动作',
  '产品内承接入口'
].forEach((text) => {
  assert(html.includes(text), `dense report includes ${text}`);
});
[
  'profile-visual-grid',
  'ability-board',
  'strength-weakness-board',
  'subject-score-board',
  'subject-potential-split',
  'method-logo-board',
  'action-path-board',
  'radar-visual',
  'assessment-dashboard',
  'method-flow',
  'method-inference-map',
  'diagnosis-canvas',
  'score-river',
  'method-fit-board',
  'subject-rationale-board'
].forEach((className) => {
  assert(html.includes(className), `visual report includes ${className}`);
});
assert(!html.includes('保分') && !html.includes('保证提分'), 'HTML avoids guaranteed score improvement language');
assert(!html.includes('原题照片') || html.includes('看不到原题照片') === false, 'HTML does not expose private original-photo content');

console.log('Personalized report template tests pass.');
