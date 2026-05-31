#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const apiPath = path.join(__dirname, '..', 'api', 'miniapp-material-analysis.js');
const code = fs.readFileSync(apiPath, 'utf8');
const miniappApiCode = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'utils', 'api.js'), 'utf8');
const uploadJsCode = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'upload', 'upload.js'), 'utf8');
const uploadWxmlCode = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'upload', 'upload.wxml'), 'utf8');
const profileJsCode = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'profile', 'profile.js'), 'utf8');
const profileWxmlCode = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'profile', 'profile.wxml'), 'utf8');

assert(code.includes("export const config = { runtime: 'edge' }"), 'material analysis API runs on edge runtime');
assert(code.includes("['DEEPSEEK_KEY', 'DEEPSEEK_API_KEY']"), 'material analysis API reads DeepSeek key from environment only');
assert(code.includes("['QWEN_KEY', 'DASHSCOPE_API_KEY']"), 'material analysis API reads Qwen key from environment only');
assert(!/sk-[a-zA-Z0-9]/.test(code), 'material analysis API must not hardcode provider keys');
assert(code.includes('talent_label') && code.includes('personality_label') && code.includes('guaranteed_improvement'), 'material analysis API blocks unsafe talent and promise fields');
assert(code.includes('manual_confirmation_fields') && code.includes('local_release_gate'), 'material analysis API returns manual confirmation and local release gates');
assert(code.includes('source_text_excerpt: String(body.source_text_excerpt || \'\').slice(0, 1200)'), 'material analysis API truncates source excerpts before model call');
assert(code.includes('You must not produce talent labels') && code.includes('strict JSON'), 'material analysis API prompt forbids unsafe claims and requires JSON');
assert(code.includes('score_sheet') && code.includes('Treat score sheets only as private parent priority signals'), 'material analysis API treats score sheets as private parent priority signals');
['subject', 'wrongCause', 'firstStep', 'learningPreference', 'evidenceConfidence', 'analysisQuality', 'nextAction', 'blockedClaims', 'executionPath'].forEach((field) => {
  assert(code.includes(field), `material analysis API schema includes normalized ${field}`);
});
assert(code.includes('product_execution_path') && code.includes('/pages/tutor/tutor?from=ai_material_analysis') && code.includes('/pages/review/review?from=ai_material_analysis'), 'material analysis API binds AI draft to product execution paths');
assert(code.includes('buildAnalysisQualityGate') && code.includes('fallback_or_manual_confirm') && code.includes('draft_can_enter_local_execution'), 'material analysis API scores analysis quality before release');
assert(code.includes('fallback_required: true'), 'material analysis API returns a clear fallback when server keys are not configured');
assert(miniappApiCode.includes('function analyzeMiniappMaterial') && miniappApiCode.includes("request('/api/miniapp-material-analysis'") && miniappApiCode.includes('analyzeMiniappMaterial'), 'miniapp client exposes material analysis API call');
assert(uploadJsCode.includes('personalizedParentReportPreviewMeta') && uploadJsCode.includes('reportExportPolicy') && uploadJsCode.includes('reportPreviewRoute'), 'upload page persists personalized HTML report metadata and export policy');
assert(uploadWxmlCode.includes('家长报告') && uploadWxmlCode.includes('证据与方法匹配'), 'upload page exposes the parent report entry through the compact material grid');
assert(profileJsCode.includes('personalizedParentReportStandardVersion') && profileJsCode.includes('personalizedParentReportSop'), 'profile summary exposes report standard version and SOP');
assert(profileJsCode.includes('personalizedParentReportCompetitorBenchmarks') && profileJsCode.includes('personalizedParentReportMiniappPlan'), 'profile summary exposes competitor-informed closure plan');
assert(profileWxmlCode.includes('今晚结论') && profileWxmlCode.includes('判断依据') && profileWxmlCode.includes('查看'), 'profile page renders personalized report guidance through the compact report preview');
assert(profileWxmlCode.includes('今晚只看一个决策') && profileWxmlCode.includes('资料进来') && profileWxmlCode.includes('家长看回访'), 'profile page renders competitor-informed closure as a compact route plan');

console.log('Miniapp material analysis API tests pass.');
