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
    JSON,
    Set
  };
  vm.runInNewContext(code, sandbox, { filename: file });
  return module.exports;
}

const engine = loadCommonJs(path.join('miniprogram', 'utils', 'family-report-engine.js'));

const baseInput = {
  profile: {
    studentName: '丁诚',
    gender: '男',
    grade: '高三',
    schoolStage: '高中',
    sourceConfidence: 'high'
  },
  assessment: {
    trc: '131 + 1X',
    atd: 41.5,
    brainPreference: '左脑型',
    persistenceIndex: 1.1,
    behaviorMode: '动机型',
    learningChannel: '听觉型',
    rawEvidence: ['测评材料摘录']
  },
  scoreRecords: [
    {
      examName: '阶段一',
      examDate: '2026-05-01',
      totalScore: 507,
      subjects: [
        { name: '语文', score: 95, fullScore: 150, sourceEvidence: ['阶段一成绩单'] },
        { name: '数学', score: 107, fullScore: 150, sourceEvidence: ['阶段一成绩单'] },
        { name: '英语', score: 109, fullScore: 150, sourceEvidence: ['阶段一成绩单'] },
        { name: '物理', score: 69, fullScore: 100, sourceEvidence: ['阶段一成绩单'] },
        { name: '化学', score: 64, fullScore: 100, sourceEvidence: ['阶段一成绩单'] },
        { name: '生物', score: 63, fullScore: 100, sourceEvidence: ['阶段一成绩单'] }
      ]
    },
    {
      examName: '阶段二',
      examDate: '2026-05-08',
      totalScore: 526.5,
      subjects: [
        { name: '语文', score: 107.5, fullScore: 150, sourceEvidence: ['阶段二成绩单'] },
        { name: '数学', score: 117, fullScore: 150, sourceEvidence: ['阶段二成绩单'] },
        { name: '英语', score: 116, fullScore: 150, sourceEvidence: ['阶段二成绩单'] },
        { name: '物理', score: 86, fullScore: 100, sourceEvidence: ['阶段二成绩单'] },
        { name: '化学', score: 40, fullScore: 100, sourceEvidence: ['阶段二成绩单'] },
        { name: '生物', score: 60, fullScore: 100, sourceEvidence: ['阶段二成绩单'] }
      ]
    },
    {
      examName: '阶段三',
      examDate: '2026-05-15',
      totalScore: 520.5,
      subjects: [
        { name: '语文', score: 100, fullScore: 150, sourceEvidence: ['阶段三成绩单'] },
        { name: '数学', score: 115, fullScore: 150, sourceEvidence: ['阶段三成绩单'] },
        { name: '英语', score: 104.5, fullScore: 150, sourceEvidence: ['阶段三成绩单'] },
        { name: '物理', score: 78, fullScore: 100, sourceEvidence: ['阶段三成绩单'] },
        { name: '化学', score: 59, fullScore: 100, sourceEvidence: ['阶段三成绩单'] },
        { name: '生物', score: 64, fullScore: 100, sourceEvidence: ['阶段三成绩单'] }
      ]
    }
  ],
  parentInput: {
    observation: '家长希望先知道今晚怎么做，不希望只看测评术语。'
  }
};

const report = engine.buildParentDecisionReport(baseInput);

assert.strictEqual(report.profile.gender, '男', 'input male must stay male');
assert.strictEqual(report.profile.grade, '高三', 'input grade must stay high school senior');
assert(!JSON.stringify(report).includes('女'), 'report must not invent female gender');
assert(!JSON.stringify(report).includes('高二'), 'report must not invent another grade');
assert(!JSON.stringify(report).includes('123'), 'report must not invent math score 123');
assert(report.subjectMatrix.find((item) => item.subjectName === '数学').trend.includes('107 → 117 → 115'), 'score order is preserved');
assert(report.subjectMatrix.find((item) => item.subjectName === '化学').priority === 'P0', 'chemistry should be P0 due volatility');
assert(report.subjectMatrix.find((item) => item.subjectName === '化学').priorityReason, 'P0 subject has reason');
assert(report.subjectMatrix.every((item) => item.evidence && item.evidence.length), 'each subject card has evidence');
assert.strictEqual(report.sevenDayPlan.length, 7, '7-day plan has seven days');
assert(report.sevenDayPlan.every((day) => day.completionStandard && day.teacherAiFeedback), 'every day has completion standard and teacher/AI feedback');
assert(report.parentTonightCard.dontSay.length >= 2 && report.parentTonightCard.canSay.length >= 2, 'parent tonight card has dont/can say copy');
assert(report.studentMessage.length <= 500, 'student message is under 500 chars');
assert(report.appendix.termTranslations.TRC.includes('不等于最终成绩'), 'appendix translates TRC');
assert(report.qualityCheck.score >= 85, 'quality score must be at least 85');
assert.strictEqual(report.qualityCheck.status, 'ready_for_parent_preview', 'quality gate can release parent preview');
assert(!JSON.stringify(report).includes('保证提分'), 'report avoids guaranteed improvement language');

const missingGender = engine.buildParentDecisionReport(Object.assign({}, baseInput, {
  profile: Object.assign({}, baseInput.profile, { gender: '' })
}));
assert(missingGender.appendix.missingFields.includes('gender'), 'missing gender is marked, not invented');
assert(!missingGender.profile.gender, 'missing gender remains empty');

const conflictInput = Object.assign({}, baseInput, {
  profileCandidates: [{ gender: '男', grade: '高三' }, { gender: '女', grade: '高二' }]
});
const guarded = engine.validateReportInputs(conflictInput);
assert.strictEqual(guarded.ok, false, 'conflicting gender/grade blocks clean release');
assert(guarded.conflicts.some((item) => item.field === 'gender'), 'gender conflict is explicit');
assert(guarded.conflicts.some((item) => item.field === 'grade'), 'grade conflict is explicit');

const missingScore = engine.buildParentDecisionReport(Object.assign({}, baseInput, {
  scoreRecords: [{
    examName: '缺失科目成绩',
    examDate: '2026-05-20',
    subjects: [{ name: '化学', fullScore: 100, sourceEvidence: ['成绩截图模糊'] }]
  }]
}));
assert(missingScore.appendix.missingFields.some((field) => field.includes('化学.score')), 'missing subject score is marked');
assert(missingScore.subjectMatrix.find((item) => item.subjectName === '化学').currentStatus.includes('待补充'), 'missing score does not generate a number');

const html = engine.renderParentDecisionReportHtml(report);
assert(html.includes('viewport'), 'HTML preview has viewport meta');
assert(html.includes('@media(max-width:720px)'), 'HTML preview has mobile single-column media query');
assert(html.includes('overflow-x:hidden'), 'HTML preview prevents horizontal overflow');
assert(html.includes('打印') === false, 'engine HTML preview does not inject unrelated button copy');

console.log(JSON.stringify({
  ok: true,
  qualityScore: report.qualityCheck.score,
  p0Subject: report.executiveSummary.fourCards[1].text,
  subjects: report.subjectMatrix.map((item) => `${item.subjectName}:${item.priority}`)
}, null, 2));
