#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');

execFileSync(process.execPath, [path.join(root, 'scripts', 'report-pipeline', 'run-report-pipeline.cjs'), 'all'], {
  cwd: root,
  stdio: 'pipe'
});

execFileSync(process.execPath, [path.join(root, 'scripts', 'report-pipeline', 'run-report-pipeline.cjs'), 'generate_images'], {
  cwd: root,
  stdio: 'pipe',
  env: Object.assign({}, process.env, { OPENAI_API_KEY: '' })
});

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function removeUnderRoot(relativePath) {
  const target = path.resolve(root, relativePath);
  if (!target.startsWith(root + path.sep)) {
    throw new Error(`Refusing to remove outside repo: ${target}`);
  }
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function makeStoredZip(entries, outputFile) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  entries.forEach((entry) => {
    const name = Buffer.from(entry.name, 'utf8');
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, 'utf8');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + data.length;
  });
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, Buffer.concat([...localParts, ...centralParts, end]));
}

[
  'scripts/report-pipeline/README.md',
  'inputs/reports',
  'inputs/questionnaire',
  'inputs/questionnaire/QUESTIONNAIRE_TEMPLATE.md',
  'inputs/scores',
  'inputs/scores/score_template.csv',
  'inputs/scores/README.md',
  'inputs/methodology',
  'inputs/methodology/methodology_notes.md',
  'inputs/style_refs',
  'inputs/style_refs/README.md',
  'inputs/extra_notes',
  'inputs/extra_notes/parent_teacher_notes.md',
  'inputs/reports/README.md',
  'outputs/analysis/source_manifest.json',
  'outputs/analysis/child_profile.md',
  'outputs/analysis/questionnaire_profile.md',
  'outputs/analysis/evidence_digest.md',
  'outputs/analysis/score_analysis.md',
  'outputs/analysis/cross_validation.md',
  'outputs/analysis/methodology_mapping.md',
  'outputs/deck/deck_structure_24_pages.md',
  'outputs/deck/slide_copy_24_pages.md',
  'outputs/deck/image2_prompts_batch_01.md',
  'outputs/deck/image2_prompts_batch_02.md',
  'outputs/deck/image2_prompts_batch_03.md',
  'outputs/deck/manual_generation_queue.md',
  'outputs/handoff/product_handoff.json',
  'outputs/handoff/product_handoff.md',
  'outputs/status/report_job_status.json',
  'outputs/status/report_job_status.md',
  'outputs/review/image_generation_log.md',
  'outputs/review/image_audit.json',
  'outputs/review/image_audit.md',
  'outputs/review/qa_checklist.md',
  'outputs/review/qa_approval.template.json',
  'outputs/review/generation_notes.md',
  'outputs/review/needs_manual_review.md',
  'outputs/review/readiness_report.md',
  'outputs/review/readiness_report.json',
  'outputs/packages/PACKAGE_MANIFEST.md',
  'outputs/logs/parse_warnings.md'
].forEach((relativePath) => {
  assert(fs.existsSync(path.join(root, relativePath)), `${relativePath} exists`);
});

const prompts = read('outputs/deck/image2_prompts_batch_01.md');
assert(prompts.includes('Slide 01 Prompt'), 'batch prompt has slide 01');
assert(prompts.includes('Slide 10 Prompt'), 'batch prompt has slide 10');
assert(!prompts.includes('Slide 11 Prompt'), 'batch prompt stops before slide 11');
assert(prompts.includes('Do not include any logo'), 'prompt forbids logo');
assert(prompts.includes('Do not include page numbers'), 'prompt forbids page numbers');
assert(prompts.includes('原点智学') && prompts.includes('Yuandian Learning Lab'), 'prompt uses plain company text');
assert(prompts.includes('Talent report is framed as hypothesis, not destiny'), 'prompt keeps assessment boundary');

const prompts02 = read('outputs/deck/image2_prompts_batch_02.md');
assert(prompts02.includes('Slide 11 Prompt'), 'batch 02 has slide 11');
assert(prompts02.includes('Slide 20 Prompt'), 'batch 02 has slide 20');
assert(!prompts02.includes('Slide 10 Prompt') && !prompts02.includes('Slide 21 Prompt'), 'batch 02 stays within slides 11-20');
assert(prompts02.includes('苏格拉底') && prompts02.includes('费曼'), 'batch 02 contains methodology modules');

const prompts03 = read('outputs/deck/image2_prompts_batch_03.md');
assert(prompts03.includes('Slide 21 Prompt'), 'batch 03 has slide 21');
assert(prompts03.includes('Slide 24 Prompt'), 'batch 03 has slide 24');
assert(!prompts03.includes('Slide 20 Prompt'), 'batch 03 starts after slide 20');
assert(prompts03.includes('家长') && prompts03.includes('学情档案'), 'batch 03 closes parent and evidence loop');

const structure = read('outputs/deck/deck_structure_24_pages.md');
assert((structure.match(/^\| \d{2} \|/gm) || []).length === 24, 'deck structure has 24 pages');
assert(structure.includes('天赋特质 × 成绩表现交叉验证'), 'deck includes cross validation');
assert(structure.includes('家长如何有效支持孩子'), 'deck includes parent support');

const slideCopy = read('outputs/deck/slide_copy_24_pages.md');
assert(slideCopy.includes('evidence -> interpretation -> method fit -> validation gate'), 'slide copy preserves report logic');
assert((slideCopy.match(/^## Slide \d{2}:/gm) || []).length === 24, 'slide copy has 24 pages');

const mapping = read('outputs/analysis/methodology_mapping.md');
[
  '目标启动模块',
  '听觉复述模块',
  '费曼学习法模块',
  '苏格拉底追问模块',
  '条件拆解模块',
  '图像转文字模块',
  '错因归因模块',
  '变式训练模块',
  '短周期反馈模块',
  '学习病历模块',
  '家长支持模块',
  'AI私教支持模块'
].forEach((moduleName) => {
  assert(mapping.includes(moduleName), `methodology includes ${moduleName}`);
});
assert(mapping.includes('Do not make an external generic agent shell the product core'), 'mapping records external-agent boundary');

const questionnaireProfile = read('outputs/analysis/questionnaire_profile.md');
assert(questionnaireProfile.includes('Questionnaire Profile'), 'questionnaire profile is generated');
assert(questionnaireProfile.includes('低置信度') || questionnaireProfile.includes('未形成'), 'questionnaire profile states confidence boundary');
assert(questionnaireProfile.includes('不能用问卷给孩子贴固定标签'), 'questionnaire profile blocks deterministic labels');

const queue = read('outputs/deck/manual_generation_queue.md');
assert(queue.includes('No Image 2 API call has been made'), 'manual queue states no fake image generation');
assert(queue.includes('outputs/images/slide_10.png'), 'manual queue includes slide 10');
assert(queue.includes('outputs/images/slide_24.png'), 'manual queue covers all 24 slides');
assert(queue.includes('REPORT_BATCH=01') && queue.includes('REPORT_BATCH=all'), 'manual queue documents batch controls');
assert(queue.includes('manual-approved'), 'manual queue documents manual approval marker');
assert(queue.includes('no_logo: true') && queue.includes('evidence_consistent: true'), 'manual queue documents complete per-slide approval checks');

const qaApprovalTemplate = JSON.parse(read('outputs/review/qa_approval.template.json'));
assert.strictEqual(qaApprovalTemplate.approved, false, 'QA approval template starts unapproved');
assert.strictEqual(qaApprovalTemplate.checks.no_logo, false, 'QA approval template requires explicit checks');

const imageLog = read('outputs/review/image_generation_log.md');
assert(imageLog.includes('No API call was made because `OPENAI_API_KEY` is not set'), 'generate_images degrades without API key');
assert(imageLog.includes('Loaded local image env keys'), 'generate_images reports local image env loading without exposing values');

const readiness = JSON.parse(read('outputs/review/readiness_report.json'));
assert.strictEqual(readiness.status, 'not_ready_for_parent_release', 'empty/default pipeline is not parent-release ready');
assert.strictEqual(readiness.evidenceCounts.scores, 0, 'score template is not counted as real score evidence');
assert.strictEqual(readiness.parsedEvidenceCounts.scores, 0, 'score template is not counted as parsed real score evidence');
assert(readiness.gates.some((gate) => gate.name === 'Parsed input evidence' && !gate.passed), 'readiness blocks missing parsed evidence');
assert(readiness.gates.some((gate) => gate.name === 'Generated images' && !gate.passed), 'readiness gate blocks missing images');
assert(readiness.gates.some((gate) => gate.name === 'Image audit' && !gate.passed), 'readiness gate blocks missing image audit');
assert(readiness.gates.some((gate) => gate.name === 'PDF export' && !gate.passed), 'readiness gate blocks missing PDF');
assert(readiness.gates.some((gate) => gate.name === 'Human QA approval' && !gate.passed), 'readiness gate blocks missing human QA approval');
assert(readiness.gates.some((gate) => gate.name === 'Product handoff' && gate.passed), 'readiness includes product handoff gate');

const handoff = JSON.parse(read('outputs/handoff/product_handoff.json'));
assert.strictEqual(handoff.caseId, 'default', 'handoff preserves case id');
assert.strictEqual(handoff.evidencePolicy.noExternalAgentAsCoreShell, true, 'handoff keeps external agent boundary');
assert.strictEqual(handoff.parsedEvidenceCounts.scores, 0, 'handoff exposes parsed evidence counts');
assert(handoff.reportPipeline.analysisFiles.questionnaireProfile.path.endsWith('questionnaire_profile.md'), 'handoff exposes questionnaire profile');
['upload', 'report', 'tutor', 'review_game', 'parent'].forEach((routeId) => {
  assert(handoff.routes.some((route) => route.id === routeId), `handoff includes ${routeId} route`);
});
assert(handoff.routes.find((route) => route.id === 'report').requiredInput.includes('questionnaire_profile.md'), 'report route consumes questionnaire profile');
assert(handoff.routes.find((route) => route.id === 'tutor').purpose.includes('Socratic'), 'tutor route maps to Socratic first-step questioning');
assert(handoff.routes.find((route) => route.id === 'review_game').purpose.includes('transfer'), 'review route validates transfer');
assert(handoff.routes.find((route) => route.id === 'parent').outputForNextStep.includes('PDF/report package link'), 'parent route exposes package link');
assert(handoff.nextMaterialNeeded.includes('child assessment report or questionnaire answers'), 'handoff asks for real profile material when only templates exist');
assert(handoff.reportPipeline.status.endsWith('status/report_job_status.json'), 'handoff exposes product status file');
assert(read('outputs/handoff/product_handoff.md').includes('Product Loop Routes'), 'handoff markdown summarizes routes');

const jobStatus = JSON.parse(read('outputs/status/report_job_status.json'));
assert.strictEqual(jobStatus.jobId, 'report:default', 'job status has stable default job id');
assert.strictEqual(jobStatus.status, 'needs_input_evidence', 'default job status blocks on missing real evidence');
assert.strictEqual(jobStatus.evidence.evidenceReady, false, 'job status exposes evidence gate');
assert.strictEqual(jobStatus.pipeline.promptsReady, true, 'job status exposes prompt readiness');
assert.strictEqual(jobStatus.pipeline.images.count, 0, 'job status exposes image count');
assert.strictEqual(jobStatus.externalProviderRequired, true, 'job status marks provider required once prompts are ready and images are missing');
assert(jobStatus.externalBlockers.some((item) => item.id === 'image_provider_missing'), 'job status exposes missing image provider blocker');
assert(jobStatus.safetyPolicy.noExternalAgentAsCoreShell, 'job status keeps AI provider boundary');
assert(read('outputs/status/report_job_status.md').includes('Next Best Action'), 'job status markdown is readable');

const warnings = read('outputs/logs/parse_warnings.md');
assert(warnings.includes('Production Rule'), 'parse warnings include non-abort rule');

const manifest = JSON.parse(read('outputs/analysis/source_manifest.json'));
assert(manifest.lanes.some((lane) => lane.id === 'questionnaire'), 'source manifest supports questionnaire fallback');
assert.strictEqual(manifest.caseId, 'default', 'default manifest case is default');
assert(read('inputs/questionnaire/QUESTIONNAIRE_TEMPLATE.md').includes('没有皮纹测评'), 'questionnaire template covers no-assessment fallback');
assert(read('inputs/scores/score_template.csv').includes('exam,subject,score,full_score'), 'score template has required columns');
assert(read('inputs/methodology/methodology_notes.md').includes('苏格拉底追问'), 'methodology template includes core methods');
assert(read('inputs/style_refs/README.md').includes('不要 logo'), 'style reference template includes visual constraints');
assert(read('inputs/extra_notes/parent_teacher_notes.md').includes('家长观察'), 'extra notes template includes parent observations');

const caseId = 'codex_case_probe';
removeUnderRoot(path.join('inputs', 'cases', caseId));
removeUnderRoot(path.join('outputs', 'cases', caseId));
execFileSync(process.execPath, [path.join(root, 'scripts', 'report-pipeline', 'run-report-pipeline.cjs'), 'all'], {
  cwd: root,
  stdio: 'pipe',
  env: Object.assign({}, process.env, { REPORT_CASE: caseId, OPENAI_API_KEY: '' })
});
const caseManifestPath = path.join('outputs', 'cases', caseId, 'analysis', 'source_manifest.json');
assert(fs.existsSync(path.join(root, caseManifestPath)), 'case mode writes isolated source manifest');
const caseManifest = JSON.parse(read(caseManifestPath));
assert.strictEqual(caseManifest.caseId, caseId, 'case manifest preserves case id');
assert.strictEqual(caseManifest.inputsDir, `inputs/cases/${caseId}`, 'case manifest uses isolated input root');
assert.strictEqual(caseManifest.outputsDir, `outputs/cases/${caseId}`, 'case manifest uses isolated output root');
assert(fs.existsSync(path.join(root, 'inputs', 'cases', caseId, 'questionnaire', 'QUESTIONNAIRE_TEMPLATE.md')), 'case mode writes questionnaire template under case');
const caseJobStatus = JSON.parse(read(path.join('outputs', 'cases', caseId, 'status', 'report_job_status.json')));
assert.strictEqual(caseJobStatus.jobId, `report:${caseId}`, 'case mode writes isolated job status');
assert.strictEqual(caseJobStatus.outputsDir, `outputs/cases/${caseId}`, 'case job status uses isolated output root');
removeUnderRoot(path.join('inputs', 'cases', caseId));
removeUnderRoot(path.join('outputs', 'cases', caseId));

const parseCaseId = 'codex_parse_probe';
removeUnderRoot(path.join('inputs', 'cases', parseCaseId));
removeUnderRoot(path.join('outputs', 'cases', parseCaseId));
makeStoredZip([
  {
    name: 'word/document.xml',
    data: '<w:document><w:body><w:p><w:r><w:t>听觉复述与目标启动测试报告</w:t></w:r></w:p></w:body></w:document>'
  }
], path.join(root, 'inputs', 'cases', parseCaseId, 'reports', 'sample.docx'));
fs.mkdirSync(path.join(root, 'inputs', 'cases', parseCaseId, 'reports'), { recursive: true });
fs.writeFileSync(path.join(root, 'inputs', 'cases', parseCaseId, 'reports', 'talent-report.pdf'), Buffer.from('%PDF-1.4\n% test placeholder\n', 'utf8'));
fs.writeFileSync(path.join(root, 'inputs', 'cases', parseCaseId, 'reports', 'talent-report.pdf.txt'), '皮纹测评摘录：孩子听觉输入较强，图像转文字需要训练，不能作为命运定论。\n', 'utf8');
let internalPdfExpected = false;
try {
  execFileSync('python', ['-c', [
    'import fitz, sys',
    'doc=fitz.open()',
    'page=doc.new_page()',
    'page.insert_text((72,72), "PDF auto extraction test: auditory input, Socratic first step")',
    'doc.save(sys.argv[1])'
  ].join(';'), path.join(root, 'inputs', 'cases', parseCaseId, 'reports', 'auto-report.pdf')], {
    cwd: root,
    stdio: 'pipe'
  });
  internalPdfExpected = true;
} catch {
  internalPdfExpected = false;
}
makeStoredZip([
  {
    name: 'xl/sharedStrings.xml',
    data: '<sst><si><t>科目</t></si><si><t>数学</t></si><si><t>分数</t></si></sst>'
  },
  {
    name: 'xl/worksheets/sheet1.xml',
    data: '<worksheet><sheetData><row><c t="s"><v>0</v></c><c t="s"><v>2</v></c></row><row><c t="s"><v>1</v></c><c><v>115</v></c></row></sheetData></worksheet>'
  }
], path.join(root, 'inputs', 'cases', parseCaseId, 'scores', 'scores.xlsx'));
execFileSync(process.execPath, [path.join(root, 'scripts', 'report-pipeline', 'run-report-pipeline.cjs'), 'parse_inputs'], {
  cwd: root,
  stdio: 'pipe',
  env: Object.assign({}, process.env, { REPORT_CASE: parseCaseId, OPENAI_API_KEY: '' })
});
const parseManifest = JSON.parse(read(path.join('outputs', 'cases', parseCaseId, 'analysis', 'source_manifest.json')));
const parsedFiles = parseManifest.lanes.flatMap((lane) => lane.files);
assert(parsedFiles.find((file) => file.relativePath.endsWith('sample.docx') && file.parsed), 'DOCX source is parsed');
assert(parsedFiles.find((file) => file.relativePath.endsWith('scores.xlsx') && file.parsed), 'XLSX source is parsed');
const parsedPdf = parsedFiles.find((file) => file.relativePath.endsWith('talent-report.pdf'));
assert(parsedPdf && parsedPdf.parsed && parsedPdf.parser === 'sidecar', 'PDF source can be parsed through sidecar text');
if (internalPdfExpected) {
  const parsedInternalPdf = parsedFiles.find((file) => file.relativePath.endsWith('auto-report.pdf'));
  assert(parsedInternalPdf && parsedInternalPdf.parsed && parsedInternalPdf.parser === 'internal-pdf', 'PDF source can be parsed through internal extractor');
}
execFileSync(process.execPath, [path.join(root, 'scripts', 'report-pipeline', 'run-report-pipeline.cjs'), 'build_analysis'], {
  cwd: root,
  stdio: 'pipe',
  env: Object.assign({}, process.env, { REPORT_CASE: parseCaseId, OPENAI_API_KEY: '' })
});
const caseDigest = read(path.join('outputs', 'cases', parseCaseId, 'analysis', 'evidence_digest.md'));
assert(caseDigest.includes('听觉复述与目标启动测试报告'), 'evidence digest includes parsed DOCX text');
assert(caseDigest.includes('皮纹测评摘录') && caseDigest.includes('Parser: sidecar'), 'evidence digest includes sidecar PDF text and parser');
if (internalPdfExpected) {
  assert(caseDigest.includes('PDF auto extraction test') && caseDigest.includes('Parser: internal-pdf'), 'evidence digest includes internal PDF extraction text and parser');
}
const caseScoreAnalysis = read(path.join('outputs', 'cases', parseCaseId, 'analysis', 'score_analysis.md'));
assert(caseScoreAnalysis.includes('数学') && caseScoreAnalysis.includes('115'), 'score analysis includes parsed XLSX row');
removeUnderRoot(path.join('inputs', 'cases', parseCaseId));
removeUnderRoot(path.join('outputs', 'cases', parseCaseId));

const unparsedCaseId = 'codex_unparsed_pdf_probe';
removeUnderRoot(path.join('inputs', 'cases', unparsedCaseId));
removeUnderRoot(path.join('outputs', 'cases', unparsedCaseId));
fs.mkdirSync(path.join(root, 'inputs', 'cases', unparsedCaseId, 'reports'), { recursive: true });
fs.mkdirSync(path.join(root, 'inputs', 'cases', unparsedCaseId, 'scores'), { recursive: true });
fs.writeFileSync(path.join(root, 'inputs', 'cases', unparsedCaseId, 'reports', 'raw-report.pdf'), Buffer.from('%PDF-1.4\n% unparsed placeholder\n', 'utf8'));
fs.writeFileSync(path.join(root, 'inputs', 'cases', unparsedCaseId, 'scores', 'scores.csv'), 'exam,subject,score,full_score\n阶段一,数学,115,150\n', 'utf8');
execFileSync(process.execPath, [path.join(root, 'scripts', 'report-pipeline', 'run-report-pipeline.cjs'), 'all'], {
  cwd: root,
  stdio: 'pipe',
  env: Object.assign({}, process.env, { REPORT_CASE: unparsedCaseId, OPENAI_API_KEY: '' })
});
const unparsedReady = JSON.parse(read(path.join('outputs', 'cases', unparsedCaseId, 'review', 'readiness_report.json')));
assert.strictEqual(unparsedReady.evidenceCounts.reports, 1, 'unparsed PDF counts as a real uploaded file');
assert.strictEqual(unparsedReady.parsedEvidenceCounts.reports, 0, 'unparsed PDF does not count as parsed evidence');
assert(unparsedReady.gates.find((gate) => gate.name === 'Parsed input evidence' && !gate.passed), 'unparsed PDF blocks parent-release readiness');
removeUnderRoot(path.join('inputs', 'cases', unparsedCaseId));
removeUnderRoot(path.join('outputs', 'cases', unparsedCaseId));

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64'
);

const readyCaseId = 'codex_ready_probe';
removeUnderRoot(path.join('inputs', 'cases', readyCaseId));
removeUnderRoot(path.join('outputs', 'cases', readyCaseId));
fs.mkdirSync(path.join(root, 'inputs', 'cases', readyCaseId, 'questionnaire'), { recursive: true });
fs.mkdirSync(path.join(root, 'inputs', 'cases', readyCaseId, 'scores'), { recursive: true });
fs.writeFileSync(path.join(root, 'inputs', 'cases', readyCaseId, 'questionnaire', 'answers.md'), '# 问卷\n孩子听觉复述启动较好，第一步需要苏格拉底追问。\n', 'utf8');
fs.writeFileSync(path.join(root, 'inputs', 'cases', readyCaseId, 'scores', 'scores.csv'), 'exam,subject,score,full_score\n阶段一,数学,137,150\n阶段一,化学,77,100\n', 'utf8');
for (let index = 1; index <= 24; index += 1) {
  const slideNo = String(index).padStart(2, '0');
  const imageDir = path.join(root, 'outputs', 'cases', readyCaseId, 'images');
  fs.mkdirSync(imageDir, { recursive: true });
  fs.writeFileSync(path.join(imageDir, `slide_${slideNo}.png`), tinyPng);
}
execFileSync(process.execPath, [path.join(root, 'scripts', 'report-pipeline', 'run-report-pipeline.cjs'), 'all'], {
  cwd: root,
  stdio: 'pipe',
  env: Object.assign({}, process.env, { REPORT_CASE: readyCaseId, OPENAI_API_KEY: '' })
});
execFileSync(process.execPath, [path.join(root, 'scripts', 'report-pipeline', 'run-report-pipeline.cjs'), 'readiness'], {
  cwd: root,
  stdio: 'pipe',
  env: Object.assign({}, process.env, { REPORT_CASE: readyCaseId, OPENAI_API_KEY: '' })
});
const readyRoot = path.join(root, 'outputs', 'cases', readyCaseId);
assert(fs.existsSync(path.join(readyRoot, 'packages', 'final_report_images.pptx')), 'ready case creates PPTX');
assert(fs.existsSync(path.join(readyRoot, 'packages', 'final_images_zip.zip')), 'ready case creates image ZIP');
assert(fs.existsSync(path.join(readyRoot, 'packages', 'contact_sheet.svg')), 'ready case creates contact sheet');
assert(fs.existsSync(path.join(readyRoot, 'packages', 'final_report_preview.html')), 'ready case creates HTML preview');
const readyReport = JSON.parse(fs.readFileSync(path.join(readyRoot, 'review', 'readiness_report.json'), 'utf8'));
assert.strictEqual(readyReport.slideImageCount, 24, 'ready case has 24 slide images');
assert.strictEqual(readyReport.imageAudit.passCount, 0, 'tiny probe images do not pass release image audit');
assert(readyReport.evidenceCounts.questionnaire >= 1 && readyReport.evidenceCounts.scores >= 1, 'ready case has real input evidence');
const readyPrompts = fs.readFileSync(path.join(readyRoot, 'deck', 'image2_prompts_batch_01.md'), 'utf8');
assert(readyPrompts.includes('数学：137/150') && readyPrompts.includes('化学：77/100'), 'score prompts use uploaded score rows');
assert(!readyPrompts.includes('语文：100/150') && !readyPrompts.includes('英语：104.5/150'), 'score prompts do not reuse template sample scores');
assert.strictEqual(readyReport.status, 'not_ready_for_parent_release', 'ready probe still blocks without PDF export');
assert(readyReport.gates.find((gate) => gate.name === 'PDF export' && !gate.passed), 'ready probe blocks missing PDF');
assert(readyReport.gates.find((gate) => gate.name === 'Image audit' && !gate.passed), 'ready probe blocks invalid image dimensions and metadata');
assert(readyReport.gates.find((gate) => gate.name === 'Human QA approval' && !gate.passed), 'ready probe blocks missing human QA approval');
assert(readyReport.gates.find((gate) => gate.name === 'Product handoff' && gate.passed), 'ready probe includes product handoff');
const readyHandoff = JSON.parse(fs.readFileSync(path.join(readyRoot, 'handoff', 'product_handoff.json'), 'utf8'));
assert.strictEqual(readyHandoff.routes.length, 5, 'ready handoff has five product routes');
assert(readyHandoff.reportPipeline.packageLinks.pptx.exists, 'ready handoff exposes PPTX package state');
removeUnderRoot(path.join('inputs', 'cases', readyCaseId));
removeUnderRoot(path.join('outputs', 'cases', readyCaseId));

const batchCaseId = 'codex_batch_probe';
removeUnderRoot(path.join('inputs', 'cases', batchCaseId));
removeUnderRoot(path.join('outputs', 'cases', batchCaseId));
removeUnderRoot(path.join('outputs', 'case_batch'));
fs.mkdirSync(path.join(root, 'inputs', 'cases', batchCaseId, 'questionnaire'), { recursive: true });
fs.writeFileSync(path.join(root, 'inputs', 'cases', batchCaseId, 'questionnaire', 'answers.md'), '# 问卷\n批量 case 测试。\n', 'utf8');
execFileSync(process.execPath, [path.join(root, 'scripts', 'report-pipeline', 'run-report-cases.cjs'), 'all'], {
  cwd: root,
  stdio: 'pipe',
  env: Object.assign({}, process.env, { REPORT_CASES: batchCaseId, OPENAI_API_KEY: '' })
});
assert(fs.existsSync(path.join(root, 'outputs', 'case_batch', 'summary.md')), 'batch runner writes markdown summary');
assert(read('outputs/case_batch/summary.md').includes(batchCaseId), 'batch summary includes selected case');
assert(fs.existsSync(path.join(root, 'outputs', 'cases', batchCaseId, 'review', 'readiness_report.json')), 'batch runner writes case readiness');
removeUnderRoot(path.join('inputs', 'cases', batchCaseId));
removeUnderRoot(path.join('outputs', 'cases', batchCaseId));
removeUnderRoot(path.join('outputs', 'case_batch'));

const testImage = path.join(root, 'outputs', 'images', 'slide_01.png');
const testPptx = path.join(root, 'outputs', 'packages', 'final_report_images.pptx');
const testZip = path.join(root, 'outputs', 'packages', 'final_images_zip.zip');
const testContactSheet = path.join(root, 'outputs', 'packages', 'contact_sheet.svg');
const testPreviewHtml = path.join(root, 'outputs', 'packages', 'final_report_preview.html');
const testPreviewPdf = path.join(root, 'outputs', 'packages', 'final_report_preview.pdf');
fs.writeFileSync(testImage, tinyPng);
execFileSync(process.execPath, [path.join(root, 'scripts', 'report-pipeline', 'run-report-pipeline.cjs'), 'package_outputs'], {
  cwd: root,
  stdio: 'pipe'
});
assert(fs.existsSync(testPptx), 'package step creates PPTX when slide image exists');
assert.strictEqual(fs.readFileSync(testPptx).slice(0, 2).toString('utf8'), 'PK', 'PPTX is a zip package');
assert(fs.existsSync(testZip), 'package step creates image ZIP when slide image exists');
assert.strictEqual(fs.readFileSync(testZip).slice(0, 2).toString('utf8'), 'PK', 'image ZIP is a zip package');
assert(fs.existsSync(testContactSheet), 'package step creates contact sheet when slide image exists');
assert(read('outputs/packages/contact_sheet.svg').includes('Slide 01'), 'contact sheet references generated slide');
assert(fs.existsSync(testPreviewHtml), 'package step creates HTML preview when slide image exists');
assert(read('outputs/packages/final_report_preview.html').includes('Slide 01'), 'HTML preview references generated slide');

execFileSync(process.execPath, [path.join(root, 'scripts', 'report-pipeline', 'run-report-pipeline.cjs'), 'export_pdf'], {
  cwd: root,
  stdio: 'pipe',
  env: Object.assign({}, process.env, { REPORT_PDF_BROWSER: '' })
});
assert(fs.existsSync(path.join(root, 'outputs', 'review', 'pdf_export_log.md')), 'PDF export writes a log');
assert(read('outputs/review/pdf_export_log.md').includes('PDF'), 'PDF export log is readable');

fs.unlinkSync(testImage);
fs.unlinkSync(testPptx);
fs.unlinkSync(testZip);
fs.unlinkSync(testContactSheet);
fs.unlinkSync(testPreviewHtml);
if (fs.existsSync(testPreviewPdf)) fs.unlinkSync(testPreviewPdf);
execFileSync(process.execPath, [path.join(root, 'scripts', 'report-pipeline', 'run-report-pipeline.cjs'), 'package_outputs'], {
  cwd: root,
  stdio: 'pipe'
});
assert(read('outputs/packages/PACKAGE_MANIFEST.md').includes('0 generated slide image'), 'package manifest returns to no-image state');

console.log('Report Image 2 pipeline tests pass.');
