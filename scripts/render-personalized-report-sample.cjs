#!/usr/bin/env node
'use strict';

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

const {
  buildPersonalizedReportModel,
  renderPersonalizedReportHtml
} = loadCommonJs(path.join('miniprogram', 'utils', 'personalized-report-template.js'));

const dingChengInput = {
  studentName: '丁诚',
  stage: '高三备考',
  generatedAt: '2026-05-24',
  assessmentProfile: {
    learningChannel: '听觉输入更容易启动',
    brainPreference: '逻辑结构偏好，空间/视觉细节需要补偿',
    behaviorMode: '目标驱动，适合短周期反馈',
    persistenceIndex: '坚持指数偏低，需要小块任务和高频正反馈',
    strengths: [
      '听觉理解与复述启动较快，适合先说后写',
      '总分维持在班级前列，具备高三冲刺的基础盘',
      '理科组合排名靠前，说明模型化能力可以继续放大'
    ],
    risks: [
      '不要把“听觉型”当作固定标签，只把它作为方法候选',
      '英语和化学出现波动，必须用真实错题和 7 天回访验证',
      '注意力与坚持信号偏弱时，任务要短、反馈要快、奖励只奖过程证据'
    ]
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

const model = buildPersonalizedReportModel(dingChengInput);
const html = renderPersonalizedReportHtml(model);
const outputDir = path.join(root, 'tmp_report_inspect');
const outputFile = path.join(outputDir, 'dingcheng-personalized-report.html');

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputFile, html, 'utf8');

console.log(outputFile);
