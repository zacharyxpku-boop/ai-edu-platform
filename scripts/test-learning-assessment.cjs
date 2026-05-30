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
assert(math.evidenceSeed && math.evidenceSeed.id === 'assessment_evidence_seed', 'assessment returns a structured evidence seed');
assert(math.evidenceSeed.nextEvidenceRequired.includes('child_first_step'), 'assessment evidence seed requires child first-step evidence');
assert(math.evidenceSeed.reportInputPatch.behaviorSignals.requiredNextEvidence.includes('next_day_revisit'), 'assessment seed can feed report input with revisit evidence');
assert(math.blockedClaims.some((line) => line.includes('不凭单次输入')), 'assessment seed blocks single-input long-term claims');

const talentSeed = assessment.buildAssessmentEvidenceSeed('天赋测评：视觉型优势，数学错题先看图会更稳。', { sourceType: 'talent_assessment' });
assert.strictEqual(talentSeed.sourceType, 'talent_assessment', 'explicit talent source type is preserved');
assert(talentSeed.matchedSignals.some((item) => item.id === 'talent_assessment'), 'talent assessment signal is detected');
assert(talentSeed.blockedClaims.some((line) => line.includes('天赋标签')), 'talent seed blocks deterministic talent labeling');
assert(talentSeed.localBetterFor.includes('是否放行画像'), 'assessment seed keeps release decisions local');
assert(talentSeed.talentLearningMethodPlan && talentSeed.talentLearningMethodPlan.status === 'method_candidate_only', 'talent assessment creates a method-candidate plan, not a talent label');
assert(talentSeed.talentLearningMethodPlan.blockedClaims.includes('天赋定性') && talentSeed.talentLearningMethodPlan.confirmWithEvidence.includes('第 7 天小变式是否迁移'), 'talent method plan blocks talent determination and requires day-7 transfer evidence');
assert(talentSeed.reportInputPatch.behaviorSignals.talentLearningMethodPlan.route.includes('talent_method_plan'), 'talent method plan flows into report input for parent decision routing');

const english = assessment.buildLearningAssessment('英语单词听写会，阅读题慢，语法题总错');
assert.strictEqual(english.subject, '英语', 'english text should be detected as english');
assert(['tutor', 'focus', 'review', 'revisit'].includes(english.capability.id), 'english text should produce an explicit capability recommendation');
assert(english.methodHint.length > 0, 'english text should produce a method hint');

const quiet = assessment.buildLearningAssessment('');
assert(quiet.summaryLine.includes('先录入一次成绩'), 'empty assessment should be a safe empty state');
assert(quiet.nextQuestion.includes('从哪一步开始') || quiet.nextQuestion.includes('先说你准备'), 'empty assessment keeps a clear next action');

console.log('All learning assessment tests pass.');
