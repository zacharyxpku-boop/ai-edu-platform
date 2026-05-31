#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const zlib = require('zlib');

const root = path.join(__dirname, '..', '..');
const imageEnvKeys = new Set([
  'OPENAI_API_KEY',
  'IMAGE_MODEL',
  'IMAGE_SIZE',
  'IMAGE_QUALITY',
  'IMAGE_OUTPUT_FORMAT'
]);

function loadLocalImageEnv() {
  const envFile = path.join(root, '.env.local');
  if (!fs.existsSync(envFile)) return [];
  const loaded = [];
  const lines = fs.readFileSync(envFile, 'utf8').split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) return;
    const key = match[1];
    if (!imageEnvKeys.has(key) || process.env[key]) return;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
    loaded.push(key);
  });
  return loaded;
}

function sanitizeCaseId(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

const activeCaseId = sanitizeCaseId(process.env.REPORT_CASE || '');
const inputsRootDir = path.join(root, 'inputs');
const outputsRootDir = path.join(root, 'outputs');
const inputsDir = activeCaseId ? path.join(inputsRootDir, 'cases', activeCaseId) : inputsRootDir;
const outputsDir = activeCaseId ? path.join(outputsRootDir, 'cases', activeCaseId) : outputsRootDir;

const inputLanes = [
  ['reports', '孩子测评报告'],
  ['questionnaire', '孩子/家长问卷'],
  ['scores', '成绩截图/成绩表'],
  ['methodology', '原点智学学习方法论'],
  ['style_refs', '风格参考图'],
  ['extra_notes', '家长/老师/错题补充']
];

const methodologyModules = [
  ['目标启动模块', '动机型、目标感强但状态波动', '先明确为什么学、学到什么程度、如何判断完成', '今日任务 / 今晚路径'],
  ['听觉复述模块', '听觉型、语言理解较好', '用“听-讲-复述-输出”验证真正理解', 'AI私教 / 家长今晚问一句'],
  ['费曼学习法模块', '会做但讲不清、知识不稳', '让孩子把知识讲给家长或 AI，讲不清就是卡点', 'AI私教复述检查'],
  ['苏格拉底追问模块', '容易等答案、第一步启动弱', '不直接给答案，而是追问第一步、依据和反例', 'AI私教第一步追问'],
  ['条件拆解模块', '数学、物理、化学审题不稳', '拆成已知、所求、限制条件、模型入口', '小黑板 / 条件卡'],
  ['图像转文字模块', '图像力、空间处理、观察力偏弱', '把图表、情境、结构图转成语言结构', '小黑板讲解'],
  ['错因归因模块', '成绩波动、重复错、失分原因不清', '把失分分为概念、条件、模型、计算、表达', '错因卡 / 学习病历'],
  ['变式训练模块', '原题会，换题不会', '通过同类变式验证是否真正迁移', '复习/游戏页变式挑战'],
  ['短周期反馈模块', '坚持指数偏低、长期任务容易掉状态', '用小目标、阶段反馈、可见进步维持动力', '7天验证 / 进度栏'],
  ['学习病历模块', '需要长期跟踪', '记录学科弱点、错因、有效方法和阶段变化', '家长端学情档案'],
  ['家长支持模块', '家长焦虑、亲子冲突或陪伴方法不清', '把家长从催促者转为观察者、支持者、反馈者', '家长页下一步'],
  ['AI私教支持模块', '需要高频反馈、个性化追问和复盘', '辅助追问、错因分析、复述检查、阶段反馈', 'AI私教 / 复习闭环']
];

const deckPages = [
  ['01', '孩子专属阶段个性化学习方法论', '建立高端、专业、非营销的报告第一印象', '封面 + 证据卡 + 学习路径'],
  ['02', '这份报告如何形成', '说明测评、成绩、错题、方法论的证据链', '四源证据流水线'],
  ['03', '测评是学习画像起点，不是命运定论', '建立边界，避免家长误解测评标签', '可参考 / 不能定论 分栏'],
  ['04', '天赋测评核心发现', '提炼学习类型、行为导向、TRC/ATD等信号', '雷达图 + 信号卡'],
  ['05', '天赋优势与待开发点', '解释哪些可放大、哪些要方法补偿', '优势/待开发矩阵'],
  ['06', '阶段成绩样本概览', '先呈现事实，再解释', '成绩表 + 横向柱图'],
  ['07', '成绩趋势与学科波动分析', '识别稳定科目、波动科目、潜力科目', '学科波动图'],
  ['08', '天赋特质 × 成绩表现交叉验证', '证明建议来自证据交叉，而不是硬推产品', '交叉验证矩阵'],
  ['09', '六科学习诊断与提升优先级', '决定先解决什么，再放大什么', '六科优先级卡片'],
  ['10', '阶段性家长结论', '先放心、再看问题、最后看方案', '放心/关注/行动三卡'],
  ['11', '学习方法论模块总览', '展开方法库，但仍保持客观', '12模块地图'],
  ['12', '动机型孩子的方法模块', '目标启动与短周期反馈', '目标闭环图'],
  ['13', '听觉型孩子的方法模块', '听-说-复述-输出', '复述流转图'],
  ['14', '图像/空间短板的方法模块', '图像转文字与小黑板', '图转文画板'],
  ['15', '坚持指数偏低的方法模块', '短周期反馈和可见进步', '1/3/7天反馈环'],
  ['16', '错因归因与变式训练模块', '从错因到迁移验证', '错因-变式路径'],
  ['17', '语文学习建议', '学科行动化', '语文行动卡'],
  ['18', '数学学习建议', '第一步、条件拆解、变式', '数学小黑板'],
  ['19', '英语学习建议', '听说复述、语法输出', '英语复述卡'],
  ['20', '物理学习建议', '模型和条件拆解', '模型条件图'],
  ['21', '化学学习建议', '原理、方程、条件、错因', '化学条件卡'],
  ['22', '生物学习建议', '图表解释与概念关系', '图表转文字板'],
  ['23', '家长如何有效支持孩子', '把陪伴变成低压证据反馈', '家长对话卡'],
  ['24', '学情档案如何持续更新', '连接长期产品闭环', '证据账本 + AI私教 + 复习闭环']
];

const promptBatches = [
  {
    id: '01',
    title: 'Batch 01, Slides 01-10',
    range: [0, 10],
    goal: 'Slides 01-10 establish trust, explain assessment boundaries, summarize child profile, connect talent signals with scores, and give a parent-friendly stage conclusion. Do not over-market Yuandian or AI in this batch.'
  },
  {
    id: '02',
    title: 'Batch 02, Slides 11-20',
    range: [10, 20],
    goal: 'Slides 11-20 translate the child profile into methodology modules and subject-level action plans. Keep method-fit reasoning explicit: why this method matches this child, what evidence supports it, and how to validate it.'
  },
  {
    id: '03',
    title: 'Batch 03, Slides 21-24',
    range: [20, 24],
    goal: 'Slides 21-24 complete chemistry, biology, parent support, and the long-term learning evidence loop. Close with support and execution clarity, not hard selling.'
  }
];

const humanQaChecks = [
  'no_logo',
  'no_page_number',
  'no_slide_index',
  'no_pagination',
  'chinese_readable',
  'evidence_consistent',
  'not_too_empty',
  'not_too_crowded',
  'not_over_marketing',
  'no_score_guarantee'
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(file, content) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${content.trimEnd()}\n`, 'utf8');
}

function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readText(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

function xmlText(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function readZipEntries(file) {
  const buffer = fs.readFileSync(file);
  const entries = {};
  for (let offset = 0; offset < buffer.length - 30;) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) {
      offset += 1;
      continue;
    }
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLength + extraLength;
    const name = buffer.slice(nameStart, nameStart + fileNameLength).toString('utf8');
    const compressed = buffer.slice(dataStart, dataStart + compressedSize);
    try {
      if (method === 0) entries[name] = compressed;
      if (method === 8) entries[name] = zlib.inflateRawSync(compressed);
    } catch {
      // Keep scanning; a corrupt optional part should not abort the whole intake.
    }
    offset = dataStart + compressedSize;
  }
  return entries;
}

function extractDocxText(file) {
  const entries = readZipEntries(file);
  const document = entries['word/document.xml'];
  if (!document) return '';
  return xmlText(document.toString('utf8'));
}

function extractXlsxText(file) {
  const entries = readZipEntries(file);
  const sharedXml = entries['xl/sharedStrings.xml'] ? entries['xl/sharedStrings.xml'].toString('utf8') : '';
  const sharedStrings = [...sharedXml.matchAll(/<si[\s\S]*?<\/si>/g)].map((match) => xmlText(match[0]));
  const sheetNames = Object.keys(entries).filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).sort();
  const rows = [];
  sheetNames.forEach((name) => {
    const xml = entries[name].toString('utf8');
    [...xml.matchAll(/<row[\s\S]*?<\/row>/g)].forEach((rowMatch) => {
      const cells = [...rowMatch[0].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)].map((cellMatch) => {
        const attrs = cellMatch[1];
        const body = cellMatch[2];
        const valueMatch = body.match(/<v>([\s\S]*?)<\/v>/);
        const inlineMatch = body.match(/<is>([\s\S]*?)<\/is>/);
        if (attrs.includes('t="s"') && valueMatch) return sharedStrings[Number(valueMatch[1])] || '';
        if (inlineMatch) return xmlText(inlineMatch[1]);
        return valueMatch ? xmlText(valueMatch[1]) : '';
      }).filter(Boolean);
      if (cells.length) rows.push(cells.join(','));
    });
  });
  return rows.join('\n');
}

function xmlEscape(value) {
  return String(value == null ? '' : value).replace(/[<>&'"]/g, (char) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;'
  }[char]));
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const time = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((Math.floor(date.getSeconds() / 2)) & 0x1f);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = Math.max(1980, date.getFullYear()) - 1980;
  const dosDate = ((year & 0x7f) << 9) | ((month & 0x0f) << 5) | (day & 0x1f);
  return { time, date: dosDate };
}

function createZip(entries, outputFile) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const stamp = dosDateTime();

  entries.forEach((entry) => {
    const name = Buffer.from(entry.name.replace(/\\/g, '/'), 'utf8');
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data), 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(stamp.time, 12);
    central.writeUInt16LE(stamp.date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + data.length;
  });

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  ensureDir(path.dirname(outputFile));
  fs.writeFileSync(outputFile, Buffer.concat([...localParts, ...centralParts, end]));
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name !== '.gitkeep')
    .map((entry) => path.join(dir, entry.name));
}

function extOf(file) {
  return path.extname(file).slice(1).toLowerCase();
}

function isTemplateFile(relativePath) {
  return [
    'inputs/reports/README.md',
    'inputs/questionnaire/QUESTIONNAIRE_TEMPLATE.md',
    'inputs/scores/README.md',
    'inputs/scores/score_template.csv',
    'inputs/methodology/methodology_notes.md',
    'inputs/style_refs/README.md',
    'inputs/extra_notes/parent_teacher_notes.md'
  ].some((suffix) => relativePath.endsWith(suffix) || relativePath.includes(suffix.replace('inputs/', '')));
}

function findTextSidecar(file) {
  const dir = path.dirname(file);
  const ext = path.extname(file);
  const base = path.basename(file, ext);
  return [
    `${file}.txt`,
    `${file}.md`,
    path.join(dir, `${base}.txt`),
    path.join(dir, `${base}.md`),
    path.join(dir, `${base}.ocr.txt`),
    path.join(dir, `${base}.extract.txt`)
  ].find((candidate) => fs.existsSync(candidate));
}

function runTextExtractor(command, file) {
  const parts = Array.isArray(command) ? command : [command];
  const [bin, ...args] = parts;
  return execFileSync(bin, [...args, file], {
    cwd: root,
    encoding: 'utf8',
    timeout: 30000,
    windowsHide: true
  });
}

function runInternalTextExtractor(file) {
  const extractor = path.join(__dirname, 'extract-text.py');
  if (!fs.existsSync(extractor)) return '';
  const python = process.env.PYTHON || 'python';
  return runTextExtractor([python, extractor], file);
}

function extractUnsupportedDocumentText(file) {
  const sidecar = findTextSidecar(file);
  if (sidecar) {
    return {
      text: readText(sidecar),
      parser: 'sidecar',
      source: path.relative(root, sidecar).replace(/\\/g, '/')
    };
  }

  const parser = process.env.REPORT_TEXT_EXTRACTOR;
  if (parser) {
    const output = runTextExtractor(parser, file);
    return {
      text: output,
      parser: 'external',
      source: parser
    };
  }

  if (extOf(file) === 'pdf') {
    const output = runInternalTextExtractor(file);
    return {
      text: output,
      parser: output.trim() ? 'internal-pdf' : '',
      source: output.trim() ? 'scripts/report-pipeline/extract-text.py' : ''
    };
  }

  return { text: '', parser: '', source: '' };
}

function buildInputManifest() {
  const warnings = [];
  const lanes = inputLanes.map(([id, label]) => {
    const dir = path.join(inputsDir, id);
    ensureDir(dir);
    const files = listFiles(dir).map((file) => {
      const ext = extOf(file);
      const stat = fs.statSync(file);
      const item = {
        lane: id,
        label,
        file,
        relativePath: path.relative(root, file).replace(/\\/g, '/'),
        ext,
        bytes: stat.size,
        isTemplate: isTemplateFile(path.relative(root, file).replace(/\\/g, '/')),
        parsed: false,
        parser: '',
        parseSource: '',
        textPreview: ''
      };

      if (['txt', 'md', 'csv'].includes(ext)) {
        try {
          item.textPreview = readText(file).slice(0, 4000);
          item.parsed = true;
        } catch (error) {
          warnings.push(`- ${item.relativePath}: 文本读取失败，${error.message}`);
        }
      } else if (ext === 'docx') {
        try {
          item.textPreview = extractDocxText(file).slice(0, 4000);
          item.parsed = Boolean(item.textPreview);
          if (!item.parsed) warnings.push(`- ${item.relativePath}: DOCX 未提取到正文文本，需人工确认。`);
        } catch (error) {
          warnings.push(`- ${item.relativePath}: DOCX 解析失败，${error.message}`);
        }
      } else if (ext === 'xlsx') {
        try {
          item.textPreview = extractXlsxText(file).slice(0, 4000);
          item.parsed = Boolean(item.textPreview);
          if (!item.parsed) warnings.push(`- ${item.relativePath}: XLSX 未提取到表格文本，需人工确认。`);
        } catch (error) {
          warnings.push(`- ${item.relativePath}: XLSX 解析失败，${error.message}`);
        }
      } else if (['pdf', 'png', 'jpg', 'jpeg'].includes(ext)) {
        try {
          const extracted = extractUnsupportedDocumentText(file);
          item.textPreview = extracted.text.slice(0, 4000);
          item.parsed = Boolean(item.textPreview.trim());
          item.parser = extracted.parser;
          item.parseSource = extracted.source;
          if (item.parsed) {
            warnings.push(`- ${item.relativePath}: 已通过 ${item.parser} 文本提取进入证据链；请人工抽查是否忠于原件。`);
          } else {
            warnings.push(`- ${item.relativePath}: 已发现文件，但当前未提取到 OCR/PDF/图片文本。请补充同名 .txt/.md sidecar，或设置 REPORT_TEXT_EXTRACTOR 后重跑。`);
          }
        } catch (error) {
          warnings.push(`- ${item.relativePath}: OCR/PDF/图片文本提取失败：${error.message}。请补充同名 .txt/.md sidecar。`);
        }
      } else {
        warnings.push(`- ${item.relativePath}: 不在当前支持格式白名单内，已跳过解析。`);
      }
      return item;
    });

    if (!files.length) {
      warnings.push(`- inputs/${id}/: 暂无正式输入文件。`);
    }

    return { id, label, dir, files };
  });

  return {
    generatedAt: new Date().toISOString(),
    caseId: activeCaseId || 'default',
    inputsDir: path.relative(root, inputsDir).replace(/\\/g, '/'),
    outputsDir: path.relative(root, outputsDir).replace(/\\/g, '/'),
    lanes,
    warnings
  };
}

function parseScoreRows(manifest) {
  const scoreLane = manifest.lanes.find((lane) => lane.id === 'scores');
  const scoreFiles = scoreLane ? scoreLane.files.filter((file) => !file.isTemplate && file.parsed && ['csv', 'xlsx'].includes(file.ext)) : [];
  const rows = [];
  scoreFiles.forEach((file) => {
    const lines = file.textPreview.split('\n').map((line) => line.trim()).filter(Boolean);
    if (lines.length < 2) return;
    const headers = lines[0].split(',').map((value) => value.trim());
    lines.slice(1).forEach((line) => {
      const values = line.split(',').map((value) => value.trim());
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      rows.push(row);
    });
  });
  return rows;
}

function questionnaireEvidenceItems(manifest) {
  const lane = manifest.lanes.find((item) => item.id === 'questionnaire');
  if (!lane) return [];
  return lane.files.filter((file) => file.parsed && file.textPreview && !file.isTemplate);
}

function scoreQuestionnaireText(text) {
  const normalized = String(text || '').toLowerCase();
  const includesAny = (words) => words.some((word) => normalized.includes(word.toLowerCase()));
  const profile = {
    inputMode: [],
    startMode: [],
    stuckPoint: [],
    feedbackMode: [],
    methodCandidates: new Set(),
    validationGates: new Set()
  };

  if (includesAny(['听', '复述', '讲给', '说出来', 'audio', 'verbal', 'explain'])) {
    profile.inputMode.push('听觉/语言输入信号');
    profile.methodCandidates.add('听觉复述模块');
    profile.methodCandidates.add('费曼学习法模块');
    profile.validationGates.add('让孩子用自己的话讲清题意、条件和第一步');
  }
  if (includesAny(['图', '画图', '表格', '空间', '观察', 'visual', 'diagram'])) {
    profile.inputMode.push('图像/空间处理信号');
    profile.methodCandidates.add('图像转文字模块');
    profile.validationGates.add('把图表或情境图转成文字关系后再做变式题');
  }
  if (includesAny(['第一步', '不知道怎么开始', '等答案', '不会启动', 'start', 'first step'])) {
    profile.startMode.push('第一步启动需要脚手架');
    profile.methodCandidates.add('苏格拉底追问模块');
    profile.methodCandidates.add('条件拆解模块');
    profile.validationGates.add('AI私教连续追问三轮后，孩子能独立说出入口');
  }
  if (includesAny(['条件', '审题', '漏条件', '已知', '所求', '模型'])) {
    profile.stuckPoint.push('条件识别或模型入口不稳');
    profile.methodCandidates.add('条件拆解模块');
    profile.methodCandidates.add('错因归因模块');
    profile.validationGates.add('每道错题标注已知、所求、限制条件和错因类型');
  }
  if (includesAny(['换题不会', '变式', '迁移', '原题会', 'transfer', 'variant'])) {
    profile.stuckPoint.push('迁移验证不足');
    profile.methodCandidates.add('变式训练模块');
    profile.validationGates.add('第7天完成同类变式挑战，验证是否真正迁移');
  }
  if (includesAny(['坚持', '注意力', '拖延', '掉状态', '反馈', '进步', 'streak'])) {
    profile.feedbackMode.push('需要短周期反馈维持状态');
    profile.methodCandidates.add('短周期反馈模块');
    profile.methodCandidates.add('家长支持模块');
    profile.validationGates.add('用1天、3天、7天小目标观察状态稳定性');
  }
  if (includesAny(['焦虑', '冲突', '催促', '家长', '陪伴', 'parent'])) {
    profile.feedbackMode.push('家长支持方式需要从催促转为观察');
    profile.methodCandidates.add('家长支持模块');
    profile.validationGates.add('家长每晚只问一个证据问题，而不是评价孩子');
  }

  if (!profile.methodCandidates.size) {
    profile.methodCandidates.add('学习病历模块');
    profile.validationGates.add('先收集3道错题、一次作业过程和一次复述记录，再提升判断置信度');
  }

  return {
    inputMode: profile.inputMode,
    startMode: profile.startMode,
    stuckPoint: profile.stuckPoint,
    feedbackMode: profile.feedbackMode,
    methodCandidates: [...profile.methodCandidates],
    validationGates: [...profile.validationGates]
  };
}

function buildQuestionnaireProfile(manifest, scoreRows = []) {
  const items = questionnaireEvidenceItems(manifest);
  const combinedText = items.map((item) => item.textPreview).join('\n');
  const profile = scoreQuestionnaireText(combinedText);
  const hasQuestionnaire = items.length > 0;
  const hasScores = scoreRows.length > 0;
  const confidence = hasQuestionnaire && hasScores
    ? '中置信度：问卷信号已经可以和成绩样本交叉验证，但仍需要错题与7天回访。'
    : hasQuestionnaire
      ? '低置信度：只有问卷时，只能输出学习方法假设，不能当作能力定论。'
      : '未形成：当前没有真实问卷答案；如缺少测评报告，应先补问卷。';

  writeFile(path.join(outputsDir, 'analysis', 'questionnaire_profile.md'), `# Questionnaire Profile

## Purpose

当孩子没有皮纹测评、多元智能测评或学习风格报告时，问卷是学习画像的起点，但不是最终定论。它的作用是把家长和孩子的观察转成可验证的方法假设。

## Evidence

${hasQuestionnaire ? items.map((item) => `- ${item.relativePath}`).join('\n') : '- 当前没有真实问卷答案。'}

## Confidence

${confidence}

## Structured Signals

| Dimension | Current Signal |
| --- | --- |
| 输入偏好 | ${profile.inputMode.length ? profile.inputMode.join('；') : '待通过问卷、复述或作业过程补充'} |
| 启动方式 | ${profile.startMode.length ? profile.startMode.join('；') : '待观察孩子遇到难题时的第一反应'} |
| 主要卡点 | ${profile.stuckPoint.length ? profile.stuckPoint.join('；') : '待结合错题和成绩波动确认'} |
| 反馈方式 | ${profile.feedbackMode.length ? profile.feedbackMode.join('；') : '待观察短周期任务完成情况'} |

## Method Candidates

${profile.methodCandidates.map((item) => `- ${item}`).join('\n')}

## Validation Gates

${profile.validationGates.map((item) => `- ${item}`).join('\n')}

## Parent-Facing Boundary

- 问卷结果只能说明“更值得先尝试哪种学习方法”。
- 不能用问卷给孩子贴固定标签，也不能承诺必然提分。
- 一旦上传成绩、错题、作业过程或7天复习记录，报告必须重新计算证据等级。
`);
}

function parsedEvidenceItems(manifest) {
  return manifest.lanes.flatMap((lane) => lane.files
    .filter((file) => file.parsed && file.textPreview && !file.isTemplate)
    .map((file) => ({
      lane: lane.id,
      label: lane.label,
      relativePath: file.relativePath,
      ext: file.ext,
      parser: file.parser,
      parseSource: file.parseSource,
      preview: file.textPreview
    })));
}

function buildEvidenceDigest(manifest) {
  const items = parsedEvidenceItems(manifest);
  writeFile(path.join(outputsDir, 'analysis', 'evidence_digest.md'), `# Evidence Digest

## Case

- Case ID: ${manifest.caseId}
- Input root: \`${manifest.inputsDir}\`

## Parsed Evidence

${items.length ? items.map((item) => `### ${item.label}: \`${item.relativePath}\`

- Format: ${item.ext}
- Parsed: yes
- Parser: ${item.parser || 'native'}
- Parse source: ${item.parseSource || item.relativePath}

\`\`\`text
${item.preview.slice(0, 1200)}
\`\`\`
`).join('\n') : 'No parsed evidence text is available yet.'}

## Use Rule

Parsed text is evidence input, not final truth. Strong parent-facing conclusions still require cross-validation with scores, wrong questions, behavior evidence, or follow-up checks.
`);
}

function writeParseWarnings(manifest) {
  writeJson(path.join(outputsDir, 'analysis', 'source_manifest.json'), {
    generatedAt: manifest.generatedAt,
    caseId: manifest.caseId,
    inputsDir: manifest.inputsDir,
    outputsDir: manifest.outputsDir,
    lanes: manifest.lanes.map((lane) => ({
      id: lane.id,
      label: lane.label,
      files: lane.files.map((file) => ({
        relativePath: file.relativePath,
        ext: file.ext,
        bytes: file.bytes,
        isTemplate: Boolean(file.isTemplate),
        parsed: file.parsed,
        parser: file.parser,
        parseSource: file.parseSource,
        textPreview: file.textPreview ? file.textPreview.slice(0, 1000) : ''
      }))
    })),
    warnings: manifest.warnings
  });

  const laneLines = manifest.lanes.map((lane) => {
    if (!lane.files.length) return `- \`/inputs/${lane.id}/\`: no formal source file found.`;
    return `- \`/inputs/${lane.id}/\`: ${lane.files.length} file(s) found.`;
  });
  writeFile(path.join(outputsDir, 'logs', 'parse_warnings.md'), `# Parse Warnings

Generated: ${manifest.generatedAt}
Case: ${manifest.caseId}
Input root: \`${manifest.inputsDir}\`
Output root: \`${manifest.outputsDir}\`

## Current Input Status

${laneLines.join('\n')}

## File-Level Notes

${manifest.warnings.length ? manifest.warnings.join('\n') : '- No warnings.'}

## Production Rule

If a source cannot be parsed, keep the pipeline running, record the file-level issue here, and downgrade unsupported claims to hypotheses instead of aborting the whole report.
`);
}

function buildQuestionnaireTemplate() {
  writeFile(path.join(inputsDir, 'questionnaire', 'QUESTIONNAIRE_TEMPLATE.md'), `# 孩子/家长问卷模板

## 使用场景

当家长没有皮纹测评、多元智能测评或学习风格报告时，用这份问卷补足学习画像起点。问卷结论只能作为方法假设，必须继续用成绩、错题和7天回访验证。

## 孩子填写

1. 遇到一道不会的题，你通常第一反应是什么？
   - A. 等老师/家长讲
   - B. 先找题目里的已知条件
   - C. 先看例题或相似题
   - D. 先画图或列关系

2. 你更容易通过哪种方式听懂新知识？
   - A. 听别人讲一遍
   - B. 看图、表格、板书
   - C. 自己做一道题
   - D. 把它讲给别人听

3. 你最容易在哪一步卡住？
   - A. 不知道第一步
   - B. 看漏条件
   - C. 公式/概念记混
   - D. 会做原题，换题不会

4. 你复习时最常出现什么情况？
   - A. 当天会，过几天忘
   - B. 看解析懂，自己写不出
   - C. 做题很多，但错因说不清
   - D. 时间一长就坚持不住

5. 你觉得哪种反馈最有帮助？
   - A. 直接告诉我错在哪里
   - B. 问我第一步，让我自己想
   - C. 给我一个同类小变式
   - D. 告诉我今天完成得怎么样

## 家长填写

1. 孩子做作业时最常见的状态是什么？
2. 孩子最容易和家长发生冲突的学习场景是什么？
3. 最近一次成绩波动最大的科目是什么？可能原因是什么？
4. 最近三类高频错因分别是什么？
5. 家长最希望报告解决什么问题：放心、定位问题、给方法、给计划、长期跟踪？

## 输出规则

- 如果只有问卷，没有测评和成绩：只能输出低置信度学习画像。
- 如果问卷 + 成绩：可以输出中置信度方法候选。
- 如果问卷 + 成绩 + 错题 + 7天验证：可以输出高置信度方法建议。
`);
}

function writeIfMissing(file, content) {
  if (!fs.existsSync(file)) writeFile(file, content);
}

function buildInputTemplates() {
  buildQuestionnaireTemplate();
  writeIfMissing(path.join(inputsDir, 'reports', 'README.md'), `# 测评报告输入说明

放置孩子的皮纹测评、多元智能测评、学习风格报告、过往咨询报告等。

支持格式：

- DOCX：可基础提取正文
- TXT / MD：可直接读取
- PDF：当前记录文件，需要后续 PDF 解析器或人工摘录
- PNG / JPG：当前记录文件，需要 OCR 或人工摘录

建议同时补一份 \`report_notes.md\`，用人工方式摘出关键字段：

- 学习类型/输入偏好
- TRC / ATD / 左右脑 / 坚持指数等核心指标
- 报告原文中最重要的 5 条结论
- 家长认为最符合孩子的部分
- 家长认为不准确或存疑的部分
`);

  writeIfMissing(path.join(inputsDir, 'scores', 'score_template.csv'), `exam,subject,score,full_score,rank,note
阶段一,语文,100,150,,输出结构需要观察
阶段一,数学,115,150,,第一步和变式迁移需要验证
阶段一,英语,104.5,150,,听觉复述和语法输出可观察
阶段一,物理,78,100,,模型入口较好但需稳定
阶段一,化学,59,100,,条件识别和错因归因优先
阶段一,生物,64,100,,图表转文字优先
`);

  writeIfMissing(path.join(inputsDir, 'scores', 'README.md'), `# 成绩输入说明

放置成绩截图、成绩表、排名截图、Excel/CSV 成绩记录。

推荐优先使用 \`score_template.csv\` 或 XLSX 表格，字段至少包括：

- exam：考试名称或阶段
- subject：科目
- score：得分
- full_score：满分
- rank：排名，可选
- note：补充观察，可选

如果只有截图或 PDF，当前流水线会记录文件，但需要 OCR 或人工整理成 CSV/XLSX 后才能进入强结论。
`);

  writeIfMissing(path.join(inputsDir, 'methodology', 'methodology_notes.md'), `# 方法论材料输入说明

放置原点智学内部方法论、教育学依据、AI 私教策略、竞品学习方法总结。

建议按以下结构补充：

- 方法名称
- 适合哪类孩子
- 解决什么学习问题
- 具体动作
- 验证方式
- 在产品里的落点：AI私教 / 复习岛 / 家长端 / 学情档案

内置方法包括：目标启动、听觉复述、费曼学习法、苏格拉底追问、条件拆解、图像转文字、错因归因、变式训练、短周期反馈、学习病历、家长支持、AI私教支持。
`);

  writeIfMissing(path.join(inputsDir, 'style_refs', 'README.md'), `# 风格参考输入说明

放置已确认满意的 GPT/Variant/竞品参考图。

支持格式：

- PNG / JPG：作为人工视觉参考，当前不自动读取像素语义
- MD / TXT：可写清楚希望借鉴什么，不希望借鉴什么

建议写明：

- 色彩：例如白底、浅蓝、深蓝、金色点缀，或橙蓝咨询风
- 页面密度：偏咨询报告、偏家长友好、偏视觉图解
- 禁止项：不要 logo、不要页码、不要 mascot、不要营销口号
`);

  writeIfMissing(path.join(inputsDir, 'extra_notes', 'parent_teacher_notes.md'), `# 家长/老师/错题补充模板

## 家长观察

- 孩子做作业最常卡在哪里：
- 孩子最有成就感的学习场景：
- 家长最焦虑的问题：
- 亲子冲突最常出现的学习场景：

## 老师反馈

- 当前优势：
- 高频问题：
- 最近一次明显进步：
- 需要优先处理的学科：

## 错题补充

- 高频错因 1：
- 高频错因 2：
- 高频错因 3：
- 是否存在“原题会，换题不会”：
- 是否存在“听懂了，自己写不出”：
`);
}

function buildAnalysis(manifest) {
  const scoreRows = parseScoreRows(manifest);
  const evidenceItems = parsedEvidenceItems(manifest);
  const hasFormalInputs = manifest.lanes.some((lane) => lane.files.length);
  const sourceSummary = manifest.lanes.map((lane) => `- ${lane.label}: ${lane.files.length ? lane.files.map((file) => file.relativePath).join(', ') : '待补充'}`).join('\n');
  const scoreSummary = scoreRows.length
    ? scoreRows.slice(0, 12).map((row) => `- ${Object.entries(row).map(([key, value]) => `${key}: ${value}`).join(' / ')}`).join('\n')
    : '- 当前没有可结构化读取的 CSV/XLSX 成绩行；如上传的是截图或 PDF，需接 OCR/表格解析器后再进入强结论。';
  const parsedSummary = evidenceItems.length
    ? evidenceItems.map((item) => `- ${item.label}: \`${item.relativePath}\` -> ${item.preview.slice(0, 120).replace(/\n/g, ' ')}`).join('\n')
    : '- 暂无可直接读取的文本证据。';

  buildQuestionnaireProfile(manifest, scoreRows);
  buildEvidenceDigest(manifest);

  writeFile(path.join(outputsDir, 'analysis', 'child_profile.md'), `# Child Profile Analysis

## Status

${hasFormalInputs ? 'This analysis was rebuilt from the current `/inputs` folder. Unsupported binary files are recorded as warnings and should be manually verified before production release.' : 'This is a pilot analysis. The formal `/inputs` folders are currently empty, so the report can only validate structure and prompt style, not final child-specific conclusions.'}

## Evidence Sources

${sourceSummary}

## Parsed Evidence Summary

${parsedSummary}

## Case

- Case ID: ${manifest.caseId}
- Input root: \`${manifest.inputsDir}\`
- Output root: \`${manifest.outputsDir}\`

## Profile Rule

Talent or dermatoglyphics reports are treated as learning-signal hypotheses. They can suggest how to test a method, but they cannot decide a child's ceiling, personality, or future outcome.

## Parent-Facing Interpretation Frame

- 先说明孩子可能更容易从哪种输入方式启动。
- 再说明这种信号是否已经在真实成绩、错题、表达、复述中出现。
- 再给出可以验证的方法，而不是直接贴标签。
- 所有强判断都必须经过真实成绩或错题证据确认。
`);

  writeFile(path.join(outputsDir, 'analysis', 'score_analysis.md'), `# Score Analysis

## Status

Scores are only treated as strong evidence when they come from structured tables, readable screenshots, official score sheets, or repeated exam records.

## Parsed Score Rows

${scoreSummary}

## Analysis Rules

- 单次成绩只用于定位当前问题，不用于判断长期能力。
- 多次成绩可以看趋势、波动和稳定性。
- 错题证据优先于测评标签。
- 如果只有测评没有成绩，学科建议只能写成“方法候选”，不能写成确定诊断。
`);

  writeFile(path.join(outputsDir, 'analysis', 'cross_validation.md'), `# Cross Validation

## Purpose

This layer prevents the report from becoming either a talent-label report or a score-only diagnosis.

## Required Chain

\`assessment finding -> score evidence -> professional explanation -> method suggestion -> validation gate\`

## Standard Matrix

| Assessment / Profile Signal | Score or Behavior Evidence | Professional Explanation | Method Candidate | Validation Gate |
| --- | --- | --- | --- | --- |
| 听觉/语言输入可能更容易启动 | 语文、英语输出稳定性；复述记录；课堂表达 | 理解不等于能写出，需把听懂转为讲清楚 | 听觉复述、费曼学习法 | 孩子能用自己的话讲题意、条件和第一步 |
| 推理潜力或逻辑信号较强 | 数学、物理表现；条件题错因 | 优势可能已体现，但第一步和条件稳定性仍需验证 | 苏格拉底追问、条件拆解 | 第一道追问后能独立说出入口 |
| 图像/空间或观察信号待开发 | 生物图表、物理情境、化学结构题错因 | 不是能力差，而是需要外化脚手架 | 图像转文字、小黑板 | 图表能转成文字关系并完成变式 |
| 坚持或注意力波动 | 作业过程、复习回访、7天留存 | 长周期任务容易掉状态，需要短反馈 | 短周期反馈、游戏化复习 | 次日回忆和第7天变式通过 |

## Confidence Levels

- High: assessment + repeated score trend + wrong-question evidence + 7-day validation.
- Medium: assessment + score evidence, but no wrong-question or follow-up validation yet.
- Low: only assessment or only questionnaire. Use hypothesis language only.
`);

  writeFile(path.join(outputsDir, 'analysis', 'methodology_mapping.md'), `# Methodology Mapping

## Product Position

The report should not sell AI first. It should first explain the child, then explain the method match, then naturally show how Yuandian's product loop supports execution.

## Built-In Method Modules

| Module | Best For | What It Does | Product Landing |
| --- | --- | --- | --- |
${methodologyModules.map((item) => `| ${item[0]} | ${item[1]} | ${item[2]} | ${item[3]} |`).join('\n')}

## OpenClaw / External Agent Decision

Do not make an external generic agent shell the product core right now.

External AI can be used for summarization, report wording, Image 2 prompt drafting, and Socratic question variants. Local product rules must own evidence grading, privacy boundaries, allowed claims, report structure, method mapping, and miniapp/app routing.

Reason: the moat is not a chat UI. The moat is the evidence ledger, method mapping, review loop, and parent-readable report SOP.
`);
}

function buildDeckPlan() {
  writeFile(path.join(outputsDir, 'deck', 'deck_structure_24_pages.md'), `# Deck Structure: 24-Page Personalized Learning Methodology Report

## Working Mode

This is the standard 24-page report structure for Image 2 based slide generation. It is designed for parent-facing PDF delivery and partner-facing confidence while avoiding hard-selling the company.

## Report Narrative

1. Establish trust: what evidence was used and what cannot be concluded.
2. Explain the child: learning signals, strengths, and under-developed points.
3. Validate with scores: compare assessment signals with actual performance.
4. Map methodology: explain why each method fits the child.
5. Give subject plans: translate methods into subject-level learning actions.
6. Close the loop: parent support, AI tutor, review game, and evolving learning record.

## Page Plan

| Page | Title | Purpose | Core Visual |
| ---: | --- | --- | --- |
${deckPages.map((page) => `| ${page[0]} | ${page[1]} | ${page[2]} | ${page[3]} |`).join('\n')}

## Production Rules

- No logo.
- Only show company name as text: "原点智学" and "Yuandian Learning Lab".
- No page number.
- No slide index.
- No "1/10" or pagination.
- Do not over-market AI or Yuandian before page 10.
- Every judgment should show evidence or a validation gate.
- Use "方法候选", "待开发点", "潜力尚未充分兑现", "优势已有体现".
- Avoid deterministic claims and score guarantees.
`);
}

function buildSlideCopy() {
  const pageBlocks = deckPages.map((page) => {
    const [num, title, purpose, visual] = page;
    return `## Slide ${num}: ${title}

- Purpose: ${purpose}
- Main visual: ${visual}
- Parent-facing copy rule: explain evidence first, then interpretation, then method, then validation.
- Product bridge rule: mention Yuandian only as the execution support after the parent understands the child.
- Claim boundary: no fixed talent label, no score guarantee, no anxiety-selling.`;
  });

  writeFile(path.join(outputsDir, 'deck', 'slide_copy_24_pages.md'), `# Slide Copy: 24-Page Personalized Learning Methodology Report

## Copy Standard

Every slide follows this sequence:

\`evidence -> interpretation -> method fit -> validation gate\`

The first 10 slides must stay analysis-first. Product capability appears later as implementation support, not as the starting claim.

${pageBlocks.join('\n\n')}
`);
}

function globalStyle() {
  return 'Create a polished Chinese business-style education report slide in 16:9 landscape format. The slide should look like a formal consulting presentation, suitable for both partner institutions and parents. Use a clean white and light-blue background, deep navy typography, subtle gold accents, elegant rounded cards, soft shadows, and professional data/report visuals. Information density should be moderate: not too empty, not too crowded. Do not include any logo. Only show the company name as plain text at the top-left: "原点智学" and "Yuandian Learning Lab". Do not include page numbers. Do not include slide index. Do not write 1/10, 2/10, or any pagination. The tone should be professional, reassuring, analytical, and parent-friendly.';
}

function buildPromptContext(manifest) {
  const scoreRows = parseScoreRows(manifest).filter((row) => row.subject && row.score && row.full_score);
  const scoredSubjects = scoreRows.map((row) => {
    const score = Number(row.score);
    const full = Number(row.full_score);
    return {
      subject: row.subject,
      score: row.score,
      fullScore: row.full_score,
      rank: row.rank || '',
      note: row.note || '',
      ratio: full > 0 && Number.isFinite(score) ? score / full : null
    };
  });
  const sorted = scoredSubjects
    .filter((item) => item.ratio != null)
    .sort((a, b) => b.ratio - a.ratio);
  const strongest = sorted.slice(0, 2).map((item) => item.subject).join('、') || '待成绩证据确认';
  const weakest = sorted.slice(-2).reverse().map((item) => item.subject).join('、') || '待成绩证据确认';
  const scoreLines = scoredSubjects.map((item) => {
    const rank = item.rank ? `（${item.rank}）` : '';
    return `${item.subject}：${item.score}/${item.fullScore}${rank}`;
  });
  return {
    scoreRows,
    scoreLines,
    strongest,
    weakest,
    hasScores: scoreLines.length > 0,
    scoreSourceLine: scoreLines.length
      ? '成绩来源：已上传/转录的结构化成绩表，需结合原始成绩单抽查'
      : '当前没有结构化成绩，页面只能展示方法候选，不能做强诊断'
  };
}

function applyPromptContext(num, promptBody, context) {
  if (!context || !context.hasScores) return promptBody;
  if (num === '06') {
    return [
      '先呈现真实成绩样本，再做解释；成绩用于定位优先级，不用于制造焦虑',
      [
        ...context.scoreLines,
        context.scoreSourceLine
      ],
      'Academic score dashboard with compact table and normalized horizontal bar chart. Use only the score values listed in Main content text; do not invent or reuse sample values.'
    ];
  }
  if (num === '07') {
    return [
      '从真实成绩差异中看方法匹配程度，而不是给孩子贴偏科标签',
      [
        `当前相对优势科目：${context.strongest}，先判断哪些天赋或学习动作已经发挥`,
        `当前优先验证科目：${context.weakest}，重点看错因、输入方式和迁移能力`,
        '所有科目判断都必须回到“测评发现 → 成绩体现 → 专业解释 → 方法建议”的链路'
      ],
      'Three grouped sections with a subject dot chart and gold priority accent. Use the uploaded score table as the only numeric source.'
    ];
  }
  if (num === '09') {
    return [
      '先修复最影响稳定性的环节，再放大已经出现的优势',
      [
        `第一优先级：${context.weakest}，先做错因归因、条件拆解和第7天变式验证`,
        `优势保持：${context.strongest}，用费曼复述和变式训练防止优势波动`,
        '下一步不是多刷题，而是把每科的卡点写入学习病历并进入AI私教追问'
      ],
      'Six compact subject cards in two rows, each with performance, stuck point, method tag, and validation gate.'
    ];
  }
  return promptBody;
}

function promptForPage(page, context = {}) {
  const [num, title, purpose, visual] = page;
  const promptBody = applyPromptContext(num, ({
    '01': ['从测评画像、真实成绩到学习方法匹配的家庭决策报告', ['报告目标：看懂孩子当前状态，找到更适合的学习方法', '核心路径：测评发现 -> 成绩体现 -> 方法匹配 -> 行动验证', '本报告不做固定标签，不承诺必然提分，只给可验证的学习方案'], 'Premium cover layout: large title on the left, three evidence cards on the right, subtle learning path line at the bottom.'],
    '02': ['不是单看测评，也不是单看分数，而是把多类证据放到同一条分析链路中', ['输入一：测评报告，提供学习画像起点', '输入二：成绩数据，观察真实学习结果', '输入三：错题/老师/家长反馈，补充过程证据', '输入四：学习方法论模块，形成可执行方案'], 'Left-to-right evidence pipeline with four source cards flowing into one final report card.'],
    '03': ['测评可以帮助提出方法假设，但不能替代真实学习证据', ['可以参考：学习输入偏好、反应节奏、潜在优势、待开发点', '必须验证：错题表现、第一步表达、成绩趋势、第7天迁移', '禁止结论：固定天赋标签、长期上限判断、提分承诺'], 'Two-column board: allowed use vs not allowed conclusion, with a bottom validation rule.'],
    '04': ['当前材料更适合翻译为学习信号，而不是固定标签', ['学习潜能：具备进一步释放空间', '输入方式：听觉输入与口头复述可作为启动路径', '行为节奏：需要短周期目标和清晰反馈', '待开发点：图像/空间信息需要外化支持'], 'Radar chart center-left and four signal cards on the right. Use relative visual levels only, no fake precision.'],
    '05': ['优势不是口号，必须落到具体学习动作', ['可放大的优势：目标感、表达意愿、推理潜力、听觉启动', '需要补偿的点：图像转文字、长期坚持、题目条件拆解', '关键判断：当前更像方法尚未完全匹配，而不是潜力不足'], 'Large 2x2 matrix: already visible, worth amplifying, needs support, validation method.'],
    '06': ['先看事实，再做解释；成绩用于定位优先级，不用于制造焦虑', ['语文：100/150', '数学：115/150', '英语：104.5/150', '物理：78/100', '化学：59/100', '生物：64/100', '正式生成时替换为上传成绩单的真实数据'], 'Academic score dashboard with compact table and normalized horizontal bar chart.'],
    '07': ['从分数差异中看方法匹配程度，而不是给孩子贴偏科标签', ['优势科目：物理、数学，说明推理潜力已有体现', '潜力科目：化学、生物，抽象关系和图像转化需要支持', '输出科目：语文、英语，适合用听说复述带动结构化输出'], 'Three grouped sections with a subject dot chart and gold priority accent.'],
    '08': ['只有测评和成绩互相印证，方法建议才更可信', ['听觉/表达信号 -> 英语、语文需要从理解转向输出', '推理潜力信号 -> 数学、物理已有体现，但需稳定第一步', '图像/空间待开发 -> 生物、化学需要图像转文字与条件卡', '坚持节奏信号 -> 用短周期反馈和第7天验证维持状态'], 'Four-row cross-validation matrix with columns: 测评发现, 成绩体现, 专业解释, 方法建议.'],
    '09': ['先修复最影响稳定性的环节，再放大已经出现的优势', ['第一优先级：化学、生物 - 抽象关系外化与错因归因', '第二优先级：语文、英语 - 听说复述带动结构化输出', '第三优先级：数学、物理 - 保持优势，强化变式迁移'], 'Six compact subject cards in two rows, each with performance, stuck point, method tag.'],
    '10': ['孩子不是没有潜力，而是需要把潜力翻译成稳定的学习动作', ['可以放心：推理能力和表达入口已经有可利用信号', '需要关注：部分学科潜力尚未充分兑现，方法匹配不够稳定', '下一步：苏格拉底第一问、费曼复述、错因归因、第7天变式验证', '家长今晚只问一句：这道题你第一步准备看哪里？'], 'Three stacked cards: 放心, 关注, 行动. Add one highlighted parent question at the bottom.'],
    '11': ['方法不是堆技巧，而是把孩子的学习信号转成可验证动作', ['12个方法模块按证据进入，不按营销排序', '每个模块都要回答：适合谁、解决什么、怎么验证', 'AI私教只做追问、复述、错因和反馈支持，不替代证据判断'], 'Method library map with 12 compact modules grouped by motivation, cognition, subject transfer, review, and parent support.'],
    '12': ['目标感强但状态波动时，先把学习任务变小、变清楚、变可完成', ['适配信号：动机型、目标感强、但长期任务容易掉状态', '方法动作：本轮目标、完成标准、反馈时间点', '验证方式：孩子能说出今天完成什么、为什么做、完成后怎么看结果'], 'Goal loop diagram: why learn, what to finish, how to check, next feedback.'],
    '13': ['听觉输入不是结论，而是把理解转为输出的入口', ['适配信号：听讲能启动，但写作/表达/英语输出不稳定', '方法动作：听一遍、讲一遍、复述一遍、写成三行', '验证方式：不用看答案也能说清题意、条件和第一步'], 'Listen-speak-restatement-output flow with one example card.'],
    '14': ['图像/空间待开发时，不是多刷题，而是先把图像外化成语言结构', ['适配信号：图表题、情境题、结构题容易卡住', '方法动作：图像转文字、条件卡、小黑板关系图', '验证方式：能把图表讲成“对象-关系-变化-结论”'], 'Diagram-to-text board with before/after visual conversion.'],
    '15': ['坚持指数偏低时，长期计划要改成短周期反馈', ['适配信号：当天会、过几天忘；任务一长就掉状态', '方法动作：当天反馈、次日回忆、第7天小变式', '验证方式：看复现率和迁移率，不看刷题数量'], '1-day, next-day, day-7 feedback loop with calm progress markers.'],
    '16': ['错因不清，复习就会变成重复消耗', ['适配信号：重复错、成绩波动、换题不会', '方法动作：概念错、条件漏、模型错、计算错、表达错分类', '验证方式：同错因小变式能通过，才算真正修复'], 'Error taxonomy to variant-transfer path.'],
    '17': ['语文重点不是泛泛多读，而是把理解变成结构化表达', ['当前判断：语文需要提升输出稳定性和表达结构', '方法匹配：听觉复述、费曼讲解、素材归因', '验证方式：一段材料能说出观点、证据、结构和可迁移句式'], 'Chinese subject action cards: reading, writing, expression, feedback.'],
    '18': ['数学优势要继续放大，但第一步和条件稳定性必须守住', ['当前判断：数学潜力已有体现，需要减少入口错误和迁移断裂', '方法匹配：苏格拉底第一问、条件拆解、变式训练', '验证方式：换一个条件后仍能找到模型入口'], 'Math first-step board with condition decomposition and variant gate.'],
    '19': ['英语要把听懂和认识，转成可复述、可书写、可迁移', ['当前判断：英语输出稳定性仍有提升空间', '方法匹配：听觉复述、语法口述、错句归因', '验证方式：能复述语篇逻辑并改写同类句子'], 'English listen-retell-write card set.'],
    '20': ['物理不是记公式，而是先看对象、条件、模型和限制', ['当前判断：物理有优势基础，但复杂情境仍需条件外化', '方法匹配：小黑板、条件拆解、模型入口追问', '验证方式：能画出对象关系并说明公式为什么可用'], 'Physics model and condition decomposition board.'],
    '21': ['化学需要把原理、方程、条件和现象放在同一张关系图里', ['当前判断：化学波动可能来自抽象关系和条件识别不稳', '方法匹配：错因归因、条件卡、原理-方程-现象三联表', '验证方式：同一反应换条件后仍能解释方向和现象'], 'Chemistry principle-equation-condition cards.'],
    '22': ['生物要把图表、概念和过程关系转成能讲清的文字链', ['当前判断：生物潜力需要通过图表解释和概念关系释放', '方法匹配：图像转文字、费曼复述、变式迁移', '验证方式：能把图表讲成过程、变量、趋势和结论'], 'Biology graph/table interpretation board.'],
    '23': ['家长的角色不是催促者，而是观察者、支持者和反馈者', ['今晚不要问：你为什么又错了', '今晚可以问：这道题第一步你准备看哪里', '一周内只看三类证据：第一步、错因、第7天变式'], 'Parent conversation cards: do not say, can say, evidence to observe.'],
    '24': ['一次报告不是终点，真正有价值的是持续更新的学情档案', ['报告结论进入学情档案，成为下次私教追问和复习任务的依据', 'AI私教负责高频追问，复习岛验证记忆和迁移', '家长端看到证据变化、下一步任务和方法是否有效'], 'Long-term evidence loop: intake, report, tutor, review, parent evidence ledger, next update.']
  })[num] || [
    `${purpose}，但必须用证据链和验证门槛表达`,
    [
      `本页目标：${purpose}`,
      `视觉重点：${visual}`,
      '表达顺序：证据 -> 解释 -> 方法 -> 验证',
      '产品只作为后续执行支持，不作为第一结论'
    ],
    `Use a professional report layout centered on ${visual}.`
  ], context);

  return `## Slide ${num} Prompt

${globalStyle()}

Slide title: "${title}"
Subtitle: "${promptBody[0]}"
Main content text:
${promptBody[1].map((line) => `- "${line}"`).join('\n')}
Layout instructions: ${promptBody[2]}
Visual style: refined consulting deck, calm and high-end, parent-friendly.
Chart/table/card instructions: Core visual should be "${visual}". Use deep navy text, light-blue surfaces, and small gold accent lines.
Strict negative instructions: no logo, no mascot, no page number, no pagination, no exaggerated marketing words, no score guarantee, no fixed talent conclusion.`;
}

function parseBatchPrompts(promptFile) {
  if (!fs.existsSync(promptFile)) return [];
  const content = readText(promptFile);
  const matches = [...content.matchAll(/## Slide (\d{2}) Prompt\n\n([\s\S]*?)(?=\n## Slide \d{2} Prompt|\n## Batch 01 Quality Checklist|$)/g)];
  return matches.map((match) => ({
    slideNo: match[1],
    prompt: match[2].trim()
  }));
}

function selectedPromptsForGeneration() {
  const batch = process.env.REPORT_BATCH || '01';
  const batchIds = batch === 'all'
    ? promptBatches.map((item) => item.id)
    : batch.split(',').map((item) => item.trim().padStart(2, '0')).filter(Boolean);
  const prompts = batchIds.flatMap((batchId) => parseBatchPrompts(path.join(outputsDir, 'deck', `image2_prompts_batch_${batchId}.md`)));
  const only = process.env.REPORT_SLIDES
    ? new Set(process.env.REPORT_SLIDES.split(',').map((item) => item.trim().padStart(2, '0')))
    : null;
  const limit = Number(process.env.REPORT_IMAGE_LIMIT || 0);
  const selected = prompts.filter((item) => !only || only.has(item.slideNo));
  return limit > 0 ? selected.slice(0, limit) : selected;
}

async function requestImage(prompt) {
  loadLocalImageEnv();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set.');
  }

  const model = process.env.IMAGE_MODEL || 'gpt-image-1.5';
  const body = {
    model,
    prompt,
    size: process.env.IMAGE_SIZE || '1536x1024',
    quality: process.env.IMAGE_QUALITY || 'high',
    output_format: process.env.IMAGE_OUTPUT_FORMAT || 'png'
  };

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (error) {
    throw new Error(`Image API returned non-JSON response: ${text.slice(0, 300)}`);
  }

  if (!response.ok) {
    const message = payload && payload.error && payload.error.message ? payload.error.message : text;
    throw new Error(`Image API ${response.status}: ${message}`);
  }

  const image = payload.data && payload.data[0];
  if (!image) throw new Error('Image API response did not include data[0].');

  if (image.b64_json) {
    return {
      buffer: Buffer.from(image.b64_json, 'base64'),
      revisedPrompt: image.revised_prompt || '',
      model,
      response: payload
    };
  }

  if (image.url) {
    const urlResponse = await fetch(image.url);
    if (!urlResponse.ok) throw new Error(`Failed to download image URL: ${urlResponse.status}`);
    return {
      buffer: Buffer.from(await urlResponse.arrayBuffer()),
      revisedPrompt: image.revised_prompt || '',
      model,
      response: payload
    };
  }

  throw new Error('Image API response did not include b64_json or url.');
}

function buildImagePrompts(manifest = buildInputManifest()) {
  const promptContext = buildPromptContext(manifest);
  promptBatches.forEach((batch) => {
    const [start, end] = batch.range;
    const batchPages = deckPages.slice(start, end);
    writeFile(path.join(outputsDir, 'deck', `image2_prompts_batch_${batch.id}.md`), `# Image 2 Prompts: ${batch.title}

## Batch Goal

${batch.goal}

## Global Style Block

Use this style in every prompt:

${globalStyle()}

${batchPages.map((page) => promptForPage(page, promptContext)).join('\n\n')}

## Batch Quality Checklist

- No logo.
- No page number.
- No slide index or pagination.
- Company appears only as plain text at top-left.
- Chinese text is readable and not overcrowded.
- First 10 slides are analysis-first, not product-sales-first.
- Talent report is framed as hypothesis, not destiny.
- Score claims are labeled as sample/pilot unless real input files are provided.
- Every method suggestion has an evidence or validation gate.
`);
  });
}

async function generateImages() {
  const loadedEnvKeys = loadLocalImageEnv();
  buildManualQueue();
  const prompts = selectedPromptsForGeneration();
  const generationLog = [];
  ensureDir(path.join(outputsDir, 'images'));

  if (!prompts.length) {
    writeFile(path.join(outputsDir, 'review', 'image_generation_log.md'), `# Image Generation Log

No prompts found for generation. Run \`npm run report:image-pipeline:prompts\` first.
`);
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    writeFile(path.join(outputsDir, 'review', 'image_generation_log.md'), `# Image Generation Log

No API call was made because \`OPENAI_API_KEY\` is not set.

Loaded local image env keys: ${loadedEnvKeys.length ? loadedEnvKeys.join(', ') : 'none'}.

Use \`${relativeOutput(path.join(outputsDir, 'deck', 'manual_generation_queue.md'))}\` and the batch prompt files under \`${relativeOutput(path.join(outputsDir, 'deck'))}\` for manual Image 2 generation.
`);
    return;
  }

  for (const item of prompts) {
    const outputImage = path.join(outputsDir, 'images', `slide_${item.slideNo}.png`);
    const promptFile = path.join(outputsDir, 'images', `slide_${item.slideNo}.prompt.txt`);
    const metaFile = path.join(outputsDir, 'images', `slide_${item.slideNo}.generation.json`);
    writeFile(promptFile, item.prompt);

    try {
      const result = await requestImage(item.prompt);
      fs.writeFileSync(outputImage, result.buffer);
      writeJson(metaFile, {
        slideNo: item.slideNo,
        model: result.model,
        size: process.env.IMAGE_SIZE || '1536x1024',
        quality: process.env.IMAGE_QUALITY || 'high',
        outputFormat: process.env.IMAGE_OUTPUT_FORMAT || 'png',
        revisedPrompt: result.revisedPrompt,
        generatedAt: new Date().toISOString()
      });
      generationLog.push(`- slide_${item.slideNo}: generated -> ${relativeOutput(outputImage)}`);
    } catch (error) {
      generationLog.push(`- slide_${item.slideNo}: failed -> ${error.message}`);
      writeFile(path.join(outputsDir, 'images', `slide_${item.slideNo}.error.txt`), error.stack || error.message);
      break;
    }
  }

  writeFile(path.join(outputsDir, 'review', 'image_generation_log.md'), `# Image Generation Log

Generated: ${new Date().toISOString()}

## Settings

- IMAGE_MODEL: ${process.env.IMAGE_MODEL || 'gpt-image-1.5'}
- IMAGE_SIZE: ${process.env.IMAGE_SIZE || '1536x1024'}
- IMAGE_QUALITY: ${process.env.IMAGE_QUALITY || 'high'}
- IMAGE_OUTPUT_FORMAT: ${process.env.IMAGE_OUTPUT_FORMAT || 'png'}
- Local image env keys loaded: ${loadedEnvKeys.length ? loadedEnvKeys.join(', ') : 'none'}
- REPORT_BATCH: ${process.env.REPORT_BATCH || '01'}
- REPORT_SLIDES: ${process.env.REPORT_SLIDES || 'batch default'}
- REPORT_IMAGE_LIMIT: ${process.env.REPORT_IMAGE_LIMIT || 'none'}

## Results

${generationLog.join('\n')}
`);
}

function buildManualQueue() {
  const deckDir = path.join(outputsDir, 'deck');
  const imagesDir = path.join(outputsDir, 'images');
  writeFile(path.join(outputsDir, 'deck', 'manual_generation_queue.md'), `# Manual Image 2 Generation Queue

## Status

No Image 2 API call has been made by this queue. Use it when the current environment cannot directly call Image 2 or when the user wants to manually confirm prompts before generation.

## Source Prompt Files

- \`${relativeOutput(path.join(deckDir, 'image2_prompts_batch_01.md'))}\`
- \`${relativeOutput(path.join(deckDir, 'image2_prompts_batch_02.md'))}\`
- \`${relativeOutput(path.join(deckDir, 'image2_prompts_batch_03.md'))}\`

## Generation Order

| Slide | Output Image | Prompt Section | Review Priority |
| ---: | --- | --- | --- |
${deckPages.map((page) => `| ${page[0]} | \`${relativeOutput(path.join(imagesDir, `slide_${page[0]}.png`))}\` | \`Slide ${page[0]} Prompt\` | ${page[2]} |`).join('\n')}

## Required Saved Files

For every generated slide, save both files:

- \`${relativeOutput(path.join(imagesDir, 'slide_XX.png'))}\`
- \`${relativeOutput(path.join(imagesDir, 'slide_XX.prompt.txt'))}\`
- \`${relativeOutput(path.join(imagesDir, 'slide_XX.manual-approved.txt'))}\` if the image was generated manually outside this script

Manual approval file must include these exact passing lines:

\`\`\`text
approved: true
no_logo: true
no_page_number: true
no_slide_index: true
no_pagination: true
chinese_readable: true
evidence_consistent: true
not_too_empty: true
not_too_crowded: true
not_over_marketing: true
no_score_guarantee: true
\`\`\`

## Batch 01 Stop Rule

Default API generation should start with \`REPORT_BATCH=01\`. Do not generate slides 11-24 until Batch 01 is reviewed for report logic credibility, visual density, Chinese readability, no accidental logo or page number, no over-marketing, and consistency with the child's actual materials.

## API Batch Controls

- \`REPORT_BATCH=01\`: slides 01-10.
- \`REPORT_BATCH=02\`: slides 11-20.
- \`REPORT_BATCH=03\`: slides 21-24.
- \`REPORT_BATCH=all\`: slides 01-24.
- \`REPORT_SLIDES=01,08\`: selected slides only.
- \`REPORT_IMAGE_LIMIT=1\`: generate only the first selected slide for cost-controlled testing.
`);
}

function buildReviewFiles() {
  writeFile(path.join(outputsDir, 'review', 'qa_checklist.md'), `# Report Generation QA Checklist

## Image-Level Checks

- [ ] 16:9 landscape format.
- [ ] No logo.
- [ ] No page number.
- [ ] No slide index.
- [ ] No text like \`1/10\`, \`2/10\`, or pagination.
- [ ] Company appears only as plain text: \`原点智学\` and \`Yuandian Learning Lab\`.
- [ ] Chinese text is readable.
- [ ] The slide is not too empty.
- [ ] The slide is not too crowded.
- [ ] Visual style is consistent with the approved reference direction.

## Content-Level Checks

- [ ] Key claims are supported by assessment, scores, wrong questions, parent notes, or clearly marked as hypotheses.
- [ ] The report does not treat dermatoglyphics or talent testing as destiny.
- [ ] Real scores and wrong questions are weighted above assessment labels.
- [ ] The language avoids \`孩子不行\`, \`能力差\`, \`天赋弱\`.
- [ ] No guaranteed score improvement is promised.
- [ ] No anxiety-driven selling.
- [ ] Yuandian product support appears as an execution path, not as the first conclusion.

## Batch 01 Special Checks

- [ ] Slides 01-10 are evidence-first, not product-first.
- [ ] Slide 02 clearly explains input sources and missing sources.
- [ ] Slide 03 clearly states assessment boundaries.
- [ ] Slide 08 uses the chain: assessment finding -> score evidence -> professional explanation -> method suggestion.
- [ ] Slide 10 leaves the parent with one clear next action.
`);

  writeJson(path.join(outputsDir, 'review', 'qa_approval.template.json'), {
    approved: false,
    reviewer: '',
    reviewedAt: '',
    slideCount: 24,
    checks: Object.fromEntries(humanQaChecks.map((key) => [key, false])),
    notes: 'Copy this file to qa_approval.json only after all generated slides have been reviewed against qa_checklist.md.'
  });

  writeFile(path.join(outputsDir, 'review', 'generation_notes.md'), `# Generation Notes

## Current Product Judgment

The report workflow should be the product's main parent-facing proof layer:

1. Intake materials or questionnaire.
2. Build a child learning profile.
3. Cross-check talent signals against scores, wrong questions, and observed learning behavior.
4. Map the child to education methodology modules.
5. Generate slide images with Image 2.
6. Place images into PPT.
7. Export a stable PDF for parents.
8. Feed the conclusions back into the miniapp / app loop: AI private tutor, review game, parent evidence ledger, and next-step tasks.

## External AI / OpenClaw / Lobster Decision

Do not make an external generic agent shell the product core yet. External AI can help generate, but Yuandian owns the education logic, evidence chain, and family workflow.

## Current Input Sufficiency

The current report quality depends on the strength of uploaded sources. With no structured score, wrong-question, or parent-note evidence, the system must produce a method hypothesis instead of a final strong diagnosis.
`);
}

function reviewImages() {
  ensureDir(path.join(outputsDir, 'images'));
  const audit = auditSlideImages();
  const batch01 = audit.slides
    .filter((slide) => Number(slide.slideNo) <= 10 && slide.exists)
    .map((slide) => path.basename(slide.file));
  writeJson(path.join(outputsDir, 'review', 'image_audit.json'), audit);
  writeFile(path.join(outputsDir, 'review', 'image_audit.md'), `# Image Audit

Generated: ${audit.generatedAt}
Status: ${audit.readyForPackaging ? 'ready_for_packaging' : 'not_ready_for_packaging'}

## Summary

- Slides found: ${audit.foundCount}/24
- Slides passing automated checks: ${audit.passCount}/24
- Issues: ${audit.issues.length}

## Slide Checks

| Slide | Exists | Size | Ratio | Prompt | Metadata | Status |
| --- | --- | --- | --- | --- | --- | --- |
${audit.slides.map((slide) => `| ${slide.slideNo} | ${slide.exists ? 'yes' : 'no'} | ${slide.width && slide.height ? `${slide.width}x${slide.height}` : '-'} | ${slide.aspectRatio || '-'} | ${slide.promptExists ? 'yes' : 'no'} | ${slide.metadataExists || slide.manualApprovalPassed ? 'yes' : 'no'} | ${slide.passed ? 'PASS' : 'BLOCKED'} |`).join('\n')}

## Issues

${audit.issues.length ? audit.issues.map((issue) => `- ${issue}`).join('\n') : '- No automated issues.'}

## Manual Rule

Automated checks verify file existence, dimensions, ratio, prompt pairing, and API generation metadata or complete per-slide manual approval markers. Parent release still requires \`review/qa_approval.json\` to confirm Chinese readability, evidence consistency, visual polish, no logo, no page numbers, and no over-marketing across the full deck.
`);

  writeFile(path.join(outputsDir, 'review', 'needs_manual_review.md'), `# Needs Manual Review

## Before Image Generation

1. Add original assessment files into \`inputs/reports/\`.
2. Add real score screenshots/tables into \`inputs/scores/\`.
3. Confirm whether the final deck should be 24 or 28 pages.
4. Confirm whether Image 2 should follow the white/light-blue consulting style or the orange/navy partner-deck style shown in the screenshots.
5. Confirm whether the final PDF should include only generated slide images or also an appendix with source evidence notes.

## Current Image Status

${batch01.length ? `Generated Batch 01 images found: ${batch01.join(', ')}` : 'No Image 2 image has been generated yet. The current output is a prompt and report-planning package only.'}

Automated image audit: ${audit.readyForPackaging ? 'PASS' : 'BLOCKED'} (${audit.passCount}/24 slides pass).

## Release Boundary

Do not release a parent-facing PDF until all generated images pass \`outputs/review/qa_checklist.md\`.
`);
}

function pngInfo(buffer) {
  if (buffer.length < 24) return null;
  if (buffer.readUInt32BE(0) !== 0x89504e47 || buffer.readUInt32BE(4) !== 0x0d0a1a0a) return null;
  return {
    type: 'png',
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function jpegInfo(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset < buffer.length - 9) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) return null;
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      return {
        type: 'jpeg',
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7)
      };
    }
    offset += 2 + length;
  }
  return null;
}

function imageInfo(file) {
  const buffer = fs.readFileSync(file);
  return pngInfo(buffer) || jpegInfo(buffer) || { type: extOf(file), width: 0, height: 0 };
}

function parseApprovalText(file) {
  if (!fs.existsSync(file)) {
    return { exists: false, approved: false, missing: ['approval file missing'], values: {} };
  }
  const text = readText(file);
  const values = {};
  text.split('\n').forEach((line) => {
    const match = line.trim().match(/^([a-z_]+)\s*:\s*(true|false)\s*$/i);
    if (match) values[match[1].toLowerCase()] = match[2].toLowerCase() === 'true';
  });
  const required = ['approved', ...humanQaChecks];
  const missing = required.filter((key) => values[key] !== true);
  return {
    exists: true,
    approved: missing.length === 0,
    missing,
    values
  };
}

function readQaApproval() {
  const file = path.join(outputsDir, 'review', 'qa_approval.json');
  if (!fs.existsSync(file)) {
    return {
      exists: false,
      approved: false,
      missing: ['qa_approval.json missing'],
      file: relativeOutput(file)
    };
  }
  let data;
  try {
    data = JSON.parse(readText(file));
  } catch (error) {
    return {
      exists: true,
      approved: false,
      missing: [`invalid JSON: ${error.message}`],
      file: relativeOutput(file)
    };
  }
  const checks = data && data.checks && typeof data.checks === 'object' ? data.checks : {};
  const missing = [];
  if (data.approved !== true) missing.push('approved must be true');
  if (Number(data.slideCount) !== 24) missing.push('slideCount must be 24');
  humanQaChecks.forEach((key) => {
    if (checks[key] !== true) missing.push(`checks.${key} must be true`);
  });
  return {
    exists: true,
    approved: missing.length === 0,
    missing,
    file: relativeOutput(file),
    reviewer: data.reviewer || '',
    reviewedAt: data.reviewedAt || ''
  };
}

function auditSlideImages() {
  const slides = deckPages.map((page) => {
    const slideNo = page[0];
    const found = findSlideImages().find((item) => item.slideNo === slideNo);
    const promptFile = path.join(outputsDir, 'images', `slide_${slideNo}.prompt.txt`);
    const metadataFile = path.join(outputsDir, 'images', `slide_${slideNo}.generation.json`);
    const manualFile = path.join(outputsDir, 'images', `slide_${slideNo}.manual-approved.txt`);
    const issues = [];
    let info = { type: '', width: 0, height: 0 };
    if (!found) {
      issues.push('missing image');
    } else {
      try {
        info = imageInfo(found.file);
      } catch (error) {
        issues.push(`cannot read image: ${error.message}`);
      }
    }
    const aspect = info.width && info.height ? info.width / info.height : 0;
    const aspectOk = Math.abs(aspect - (16 / 9)) < 0.04;
    const sizeOk = info.width >= 1200 && info.height >= 675;
    const promptExists = fs.existsSync(promptFile);
    const metadataExists = fs.existsSync(metadataFile);
    const manualApproved = fs.existsSync(manualFile);
    const manualApproval = parseApprovalText(manualFile);
    if (found && !sizeOk) issues.push('image is below 1200x675');
    if (found && !aspectOk) issues.push('image is not close to 16:9');
    if (found && !promptExists) issues.push('missing slide prompt file');
    if (found && !metadataExists && !manualApproved) issues.push('missing generation metadata or manual approval marker');
    if (found && manualApproved && !manualApproval.approved) issues.push(`manual approval incomplete: ${manualApproval.missing.join(', ')}`);
    return {
      slideNo,
      file: found ? found.file : '',
      exists: Boolean(found),
      type: info.type,
      width: info.width,
      height: info.height,
      aspectRatio: aspect ? Number(aspect.toFixed(3)) : null,
      promptExists,
      metadataExists,
      manualApproved,
      manualApprovalPassed: manualApproval.approved,
      issues,
      passed: Boolean(found) && sizeOk && aspectOk && promptExists && (metadataExists || manualApproval.approved)
    };
  });
  const issues = slides.flatMap((slide) => slide.issues.map((issue) => `slide_${slide.slideNo}: ${issue}`));
  const passCount = slides.filter((slide) => slide.passed).length;
  return {
    generatedAt: new Date().toISOString(),
    caseId: activeCaseId || 'default',
    foundCount: slides.filter((slide) => slide.exists).length,
    passCount,
    readyForPackaging: passCount >= 24,
    issues,
    slides
  };
}

function imageContentType(file) {
  const ext = extOf(file);
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  return 'application/octet-stream';
}

function imageExtensionForPpt(file) {
  const ext = extOf(file);
  return ext === 'jpeg' ? 'jpg' : ext;
}

function findSlideImages() {
  const imagesDir = path.join(outputsDir, 'images');
  if (!fs.existsSync(imagesDir)) return [];
  return deckPages
    .map((page) => {
      const png = path.join(imagesDir, `slide_${page[0]}.png`);
      const jpg = path.join(imagesDir, `slide_${page[0]}.jpg`);
      const jpeg = path.join(imagesDir, `slide_${page[0]}.jpeg`);
      if (fs.existsSync(png)) return { slideNo: page[0], file: png };
      if (fs.existsSync(jpg)) return { slideNo: page[0], file: jpg };
      if (fs.existsSync(jpeg)) return { slideNo: page[0], file: jpeg };
      return null;
    })
    .filter(Boolean);
}

function buildPptxFromImages(slideImages, outputFile) {
  if (!slideImages.length) return false;

  const entries = [];
  const contentTypeOverrides = [];
  const presentationSlideIds = [];
  const presentationRels = [];

  slideImages.forEach((image, index) => {
    const slideIndex = index + 1;
    const imageExt = imageExtensionForPpt(image.file);
    const imageName = `image${slideIndex}.${imageExt}`;
    const slidePath = `ppt/slides/slide${slideIndex}.xml`;
    const slideRelPath = `ppt/slides/_rels/slide${slideIndex}.xml.rels`;
    const relId = `rId${slideIndex}`;
    const slideRelId = `rId${slideIndex}`;

    presentationSlideIds.push(`<p:sldId id="${256 + slideIndex}" r:id="${relId}"/>`);
    presentationRels.push(`<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${slideIndex}.xml"/>`);
    contentTypeOverrides.push(`<Override PartName="/ppt/slides/slide${slideIndex}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`);
    contentTypeOverrides.push(`<Override PartName="/ppt/media/${imageName}" ContentType="${imageContentType(image.file)}"/>`);

    entries.push({
      name: slidePath,
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      <p:pic>
        <p:nvPicPr>
          <p:cNvPr id="2" name="slide_${xmlEscape(image.slideNo)}"/>
          <p:cNvPicPr>
            <a:picLocks noChangeAspect="1"/>
          </p:cNvPicPr>
          <p:nvPr/>
        </p:nvPicPr>
        <p:blipFill>
          <a:blip r:embed="rId1"/>
          <a:stretch><a:fillRect/></a:stretch>
        </p:blipFill>
        <p:spPr>
          <a:xfrm>
            <a:off x="0" y="0"/>
            <a:ext cx="12192000" cy="6858000"/>
          </a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
      </p:pic>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`
    });

    entries.push({
      name: slideRelPath,
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${imageName}"/>
</Relationships>`
    });

    entries.push({
      name: `ppt/media/${imageName}`,
      data: fs.readFileSync(image.file)
    });
  });

  entries.push(
    {
      name: '[Content_Types].xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/>
  <Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/>
  ${contentTypeOverrides.join('\n  ')}
</Types>`
    },
    {
      name: '_rels/.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`
    },
    {
      name: 'ppt/_rels/presentation.xml.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${presentationRels.join('\n  ')}
  <Relationship Id="rIdPresProps" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps" Target="presProps.xml"/>
  <Relationship Id="rIdViewProps" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps" Target="viewProps.xml"/>
</Relationships>`
    },
    {
      name: 'ppt/presentation.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldSz cx="12192000" cy="6858000" type="screen16x9"/>
  <p:notesSz cx="6858000" cy="9144000"/>
  <p:sldIdLst>
    ${presentationSlideIds.join('\n    ')}
  </p:sldIdLst>
  <p:defaultTextStyle>
    <a:defPPr><a:defRPr lang="zh-CN"/></a:defPPr>
  </p:defaultTextStyle>
</p:presentation>`
    },
    {
      name: 'ppt/presProps.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentationPr xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`
    },
    {
      name: 'ppt/viewProps.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:viewPr xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`
    }
  );

  createZip(entries, outputFile);
  return true;
}

function packageSlideImagesZip(slideImages, outputFile) {
  if (!slideImages.length) return false;
  const entries = [];
  slideImages.forEach((image) => {
    const ext = imageExtensionForPpt(image.file);
    entries.push({
      name: `images/slide_${image.slideNo}.${ext}`,
      data: fs.readFileSync(image.file)
    });
    const promptFile = path.join(outputsDir, 'images', `slide_${image.slideNo}.prompt.txt`);
    if (fs.existsSync(promptFile)) {
      entries.push({
        name: `prompts/slide_${image.slideNo}.prompt.txt`,
        data: readText(promptFile)
      });
    }
    const metaFile = path.join(outputsDir, 'images', `slide_${image.slideNo}.generation.json`);
    if (fs.existsSync(metaFile)) {
      entries.push({
        name: `metadata/slide_${image.slideNo}.generation.json`,
        data: readText(metaFile)
      });
    }
  });
  entries.push({
    name: 'README.md',
    data: `# Final Images Package

This archive contains generated slide images and their prompts/metadata when available.

Image count: ${slideImages.length}

Do not treat this archive as parent-ready until every image passes \`outputs/review/qa_checklist.md\`.
`
  });
  createZip(entries, outputFile);
  return true;
}

function buildContactSheet(slideImages, outputFile) {
  if (!slideImages.length) return false;
  const cardWidth = 360;
  const cardHeight = 250;
  const gap = 24;
  const columns = 3;
  const rows = Math.ceil(slideImages.length / columns);
  const width = columns * cardWidth + (columns + 1) * gap;
  const height = rows * cardHeight + (rows + 1) * gap + 56;
  const cards = slideImages.map((image, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = gap + col * (cardWidth + gap);
    const y = gap + 56 + row * (cardHeight + gap);
    const mime = imageContentType(image.file);
    const data = fs.readFileSync(image.file).toString('base64');
    return `<g>
  <rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="12" fill="#ffffff" stroke="#d9e4f2"/>
  <text x="${x + 16}" y="${y + 26}" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#10233f">Slide ${image.slideNo}</text>
  <image x="${x + 16}" y="${y + 42}" width="${cardWidth - 32}" height="${Math.round((cardWidth - 32) * 9 / 16)}" href="data:${mime};base64,${data}" preserveAspectRatio="xMidYMid meet"/>
</g>`;
  }).join('\n');

  writeFile(outputFile, `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#f4f8fc"/>
  <text x="${gap}" y="36" font-family="Arial, sans-serif" font-size="26" font-weight="800" fill="#10233f">Yuandian Learning Report Contact Sheet</text>
  ${cards}
</svg>`);
  return true;
}

function fileUrl(filePath) {
  return `file:///${path.resolve(filePath).replace(/\\/g, '/').replace(/ /g, '%20')}`;
}

function buildHtmlPreview(slideImages, outputFile) {
  if (!slideImages.length) return false;
  const slides = slideImages.map((image) => {
    const mime = imageContentType(image.file);
    const data = fs.readFileSync(image.file).toString('base64');
    return `<section class="slide" data-slide="${xmlEscape(image.slideNo)}">
  <img src="data:${mime};base64,${data}" alt="Slide ${xmlEscape(image.slideNo)}" />
</section>`;
  }).join('\n');

  writeFile(outputFile, `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>原点智学个性化学习方法论报告预览</title>
  <style>
    @page { size: 16in 9in; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #f4f8fc; }
    body { font-family: Arial, "Microsoft YaHei", sans-serif; }
    .slide {
      width: 16in;
      height: 9in;
      page-break-after: always;
      break-after: page;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;
      overflow: hidden;
    }
    .slide img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }
    @media screen {
      body { display: grid; gap: 24px; padding: 24px; }
      .slide { width: min(96vw, 1280px); height: auto; aspect-ratio: 16 / 9; box-shadow: 0 18px 48px rgba(16, 35, 63, 0.16); }
    }
  </style>
</head>
<body>
${slides}
</body>
</html>`);
  return true;
}

function findHeadlessBrowser() {
  const envPath = process.env.REPORT_PDF_BROWSER;
  const candidates = [
    envPath,
    path.join(process.env.ProgramFiles || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || '';
}

function powershellExe() {
  const candidate = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
  return fs.existsSync(candidate) ? candidate : '';
}

function exportPdfWithPowerPoint(pptxFile, pdfFile) {
  if (!fs.existsSync(pptxFile)) return { ok: false, reason: 'PPTX file not found.' };
  const ps = powershellExe();
  if (!ps) return { ok: false, reason: 'Windows PowerShell was not found.' };
  const script = `
$ErrorActionPreference = 'Stop'
$pptx = [System.IO.Path]::GetFullPath('${pptxFile.replace(/'/g, "''")}')
$pdf = [System.IO.Path]::GetFullPath('${pdfFile.replace(/'/g, "''")}')
$app = $null
$presentation = $null
try {
  $app = New-Object -ComObject PowerPoint.Application
  $app.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
  $presentation = $app.Presentations.Open($pptx, $true, $false, $false)
  $presentation.SaveAs($pdf, 32)
  $presentation.Close()
  $app.Quit()
} finally {
  if ($presentation -ne $null) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($presentation) | Out-Null }
  if ($app -ne $null) { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null }
}
`;
  try {
    execFileSync(ps, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], { cwd: root, stdio: 'pipe' });
    return { ok: fs.existsSync(pdfFile), reason: fs.existsSync(pdfFile) ? '' : 'PowerPoint command completed but PDF file was not created.' };
  } catch (error) {
    return { ok: false, reason: error.stderr ? error.stderr.toString('utf8').slice(0, 800) : error.message };
  }
}

function exportPreviewPdf() {
  ensureDir(path.join(outputsDir, 'packages'));
  const slideImages = findSlideImages();
  const htmlFile = path.join(outputsDir, 'packages', 'final_report_preview.html');
  const pdfFile = path.join(outputsDir, 'packages', 'final_report_preview.pdf');
  const pptxFile = path.join(outputsDir, 'packages', 'final_report_images.pptx');
  const logFile = path.join(outputsDir, 'review', 'pdf_export_log.md');

  if (!slideImages.length) {
    writeFile(logFile, `# PDF Export Log

No PDF was exported because no slide images were found in \`${path.relative(root, path.join(outputsDir, 'images')).replace(/\\/g, '/')}\`.
`);
    return false;
  }

  buildHtmlPreview(slideImages, htmlFile);
  const preferPowerPoint = process.env.REPORT_PDF_ENGINE === 'powerpoint';
  if (preferPowerPoint) {
    const result = exportPdfWithPowerPoint(pptxFile, pdfFile);
    writeFile(logFile, `# PDF Export Log

PowerPoint PDF export ${result.ok ? 'succeeded' : 'failed'}.

- PPTX: \`${path.relative(root, pptxFile).replace(/\\/g, '/')}\`
- PDF: \`${path.relative(root, pdfFile).replace(/\\/g, '/')}\`
- Reason: ${result.reason || 'ok'}
`);
    return result.ok;
  }

  const browser = findHeadlessBrowser();
  if (!browser) {
    const pptResult = exportPdfWithPowerPoint(pptxFile, pdfFile);
    if (pptResult.ok) {
      writeFile(logFile, `# PDF Export Log

PDF exported successfully with PowerPoint fallback.

- PPTX: \`${path.relative(root, pptxFile).replace(/\\/g, '/')}\`
- PDF: \`${path.relative(root, pdfFile).replace(/\\/g, '/')}\`
- Slide count: ${slideImages.length}
`);
      return true;
    }

    writeFile(logFile, `# PDF Export Log

No PDF was exported because no Chrome/Edge renderer was found and PowerPoint fallback failed.

HTML preview is available:

- \`${path.relative(root, htmlFile).replace(/\\/g, '/')}\`

Set \`REPORT_PDF_BROWSER\` to a Chrome or Edge executable path, then run:

\`npm.cmd run report:image-pipeline:pdf\`

Or install/use PowerPoint and set \`REPORT_PDF_ENGINE=powerpoint\`.

PowerPoint fallback reason:

${pptResult.reason}
`);
    return false;
  }

  try {
    execFileSync(browser, [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      `--print-to-pdf=${pdfFile}`,
      '--print-to-pdf-no-header',
      fileUrl(htmlFile)
    ], { cwd: root, stdio: 'pipe' });

    writeFile(logFile, `# PDF Export Log

PDF exported successfully.

- Browser: \`${browser}\`
- HTML: \`${path.relative(root, htmlFile).replace(/\\/g, '/')}\`
- PDF: \`${path.relative(root, pdfFile).replace(/\\/g, '/')}\`
- Slide count: ${slideImages.length}
`);
    return true;
  } catch (error) {
    writeFile(logFile, `# PDF Export Log

PDF export failed.

- Browser: \`${browser}\`
- Error: ${error.message}
- HTML preview remains available: \`${path.relative(root, htmlFile).replace(/\\/g, '/')}\`
`);
    return false;
  }
}

function countExisting(files) {
  return files.filter((file) => fs.existsSync(file)).length;
}

function relativeOutput(file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function evidenceCountsForManifest(manifest) {
  const sourceCounts = Object.fromEntries(manifest.lanes.map((lane) => [lane.id, lane.files.length]));
  const evidenceCounts = Object.fromEntries(manifest.lanes.map((lane) => [lane.id, lane.files.filter((file) => !file.isTemplate).length]));
  const parsedEvidenceCounts = Object.fromEntries(manifest.lanes.map((lane) => [
    lane.id,
    lane.files.filter((file) => !file.isTemplate && file.parsed && file.textPreview).length
  ]));
  return { sourceCounts, evidenceCounts, parsedEvidenceCounts };
}

function readJsonIfExists(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(readText(file));
  } catch {
    return null;
  }
}

function buildReportJobStatus(manifest = buildInputManifest()) {
  ensureDir(path.join(outputsDir, 'status'));
  const { sourceCounts, evidenceCounts, parsedEvidenceCounts } = evidenceCountsForManifest(manifest);
  const slideImages = findSlideImages();
  const readinessFile = path.join(outputsDir, 'review', 'readiness_report.json');
  const handoffFile = path.join(outputsDir, 'handoff', 'product_handoff.json');
  const readiness = readJsonIfExists(readinessFile);
  const handoff = readJsonIfExists(handoffFile);
  const promptFiles = promptBatches.map((batch) => path.join(outputsDir, 'deck', `image2_prompts_batch_${batch.id}.md`));
  const requiredAnalysis = [
    'child_profile.md',
    'questionnaire_profile.md',
    'score_analysis.md',
    'cross_validation.md',
    'methodology_mapping.md',
    'evidence_digest.md',
    'source_manifest.json'
  ].map((file) => path.join(outputsDir, 'analysis', file));
  const packageFiles = {
    pptx: path.join(outputsDir, 'packages', 'final_report_images.pptx'),
    imageZip: path.join(outputsDir, 'packages', 'final_images_zip.zip'),
    contactSheet: path.join(outputsDir, 'packages', 'contact_sheet.svg'),
    htmlPreview: path.join(outputsDir, 'packages', 'final_report_preview.html'),
    pdfPreview: path.join(outputsDir, 'packages', 'final_report_preview.pdf')
  };
  const hasProfileEvidence = Boolean(parsedEvidenceCounts.reports || parsedEvidenceCounts.questionnaire);
  const hasScoreEvidence = Boolean(parsedEvidenceCounts.scores);
  const evidenceReady = Boolean(hasProfileEvidence && hasScoreEvidence);
  const analysisReady = countExisting(requiredAnalysis) === requiredAnalysis.length;
  const promptsReady = countExisting(promptFiles) === promptFiles.length;
  const imagesReady = slideImages.length >= 24;
  const packagesReady = ['pptx', 'imageZip', 'contactSheet', 'htmlPreview'].every((key) => fs.existsSync(packageFiles[key]));
  const pdfReady = fs.existsSync(packageFiles.pdfPreview);
  const qaApproval = readQaApproval();
  const providerConfigured = Boolean(process.env.OPENAI_API_KEY);
  const externalProviderRequired = promptsReady && !imagesReady;

  let status = 'needs_input_evidence';
  if (evidenceReady && analysisReady && promptsReady) status = 'waiting_for_image_generation';
  if (imagesReady && !packagesReady) status = 'needs_packaging';
  if (imagesReady && packagesReady && !pdfReady) status = 'needs_pdf_export';
  if (imagesReady && packagesReady && pdfReady && !qaApproval.approved) status = 'needs_human_qa';
  if (readiness && readiness.status === 'ready_for_parent_release') status = 'ready_for_parent_release';

  const nextBestAction = (() => {
    if (!hasProfileEvidence) return 'Collect a parsed assessment report or questionnaire answers before making parent-facing profile claims.';
    if (!hasScoreEvidence) return 'Collect parsed scores, score screenshot transcription, or wrong-question evidence for cross-validation.';
    if (!analysisReady) return 'Run build_analysis to refresh profile, score, cross-validation, methodology mapping, and evidence digest.';
    if (!promptsReady) return 'Run build_image2_prompts to create the 24-page Image 2 prompt batches.';
    if (!imagesReady && providerConfigured) return 'Run generate_images in controlled batches, then review image audit results.';
    if (!imagesReady) return 'Provide an Image 2/OpenAI image provider or manually generate the slides from manual_generation_queue.md.';
    if (!packagesReady) return 'Run package_outputs to create PPTX, image ZIP, contact sheet, and HTML preview.';
    if (!pdfReady) return 'Run export_pdf with a trusted local renderer and inspect pdf_export_log.md if it fails.';
    if (!qaApproval.approved) return 'Review all generated slides and create review/qa_approval.json only after every parent-release check passes.';
    return 'Connect the approved report package to upload, report, tutor, review/game, and parent routes.';
  })();

  const productRoutes = (handoff && Array.isArray(handoff.routes) ? handoff.routes : []).map((route) => ({
    id: route.id,
    entry: route.entry,
    state: route.currentState,
    routeHint: route.routeHint,
    outputForNextStep: route.outputForNextStep || []
  }));

  const jobStatus = {
    generatedAt: new Date().toISOString(),
    jobId: `report:${manifest.caseId}`,
    caseId: manifest.caseId,
    status,
    localWorkCompleteUntilProvider: Boolean(evidenceReady && analysisReady && promptsReady),
    externalProviderRequired,
    inputsDir: manifest.inputsDir,
    outputsDir: manifest.outputsDir,
    evidence: {
      sourceCounts,
      evidenceCounts,
      parsedEvidenceCounts,
      hasProfileEvidence,
      hasScoreEvidence,
      evidenceReady
    },
    pipeline: {
      analysisReady,
      promptsReady,
      images: {
        count: slideImages.length,
        ready: imagesReady,
        providerConfigured,
        providerEnvKey: 'OPENAI_API_KEY',
        modelEnvKey: 'IMAGE_MODEL',
        manualQueue: relativeOutput(path.join(outputsDir, 'deck', 'manual_generation_queue.md'))
      },
      packages: Object.fromEntries(Object.entries(packageFiles).map(([key, file]) => [key, {
        path: relativeOutput(file),
        exists: fs.existsSync(file)
      }])),
      pdfReady,
      humanQaApproval: qaApproval,
      readiness: readiness ? {
        path: relativeOutput(readinessFile),
        status: readiness.status,
        blockedGates: Array.isArray(readiness.gates) ? readiness.gates.filter((gate) => !gate.passed).map((gate) => gate.name) : []
      } : {
        path: relativeOutput(readinessFile),
        status: 'missing',
        blockedGates: ['Readiness report']
      }
    },
    productRoutes,
    nextBestAction,
    externalBlockers: externalProviderRequired && !providerConfigured ? [
      {
        id: 'image_provider_missing',
        provider: 'Image 2/OpenAI images',
        env: 'OPENAI_API_KEY',
        unblock: 'Set OPENAI_API_KEY or generate slide images manually from the prompt batches, then add complete manual approval markers.'
      }
    ] : [],
    safetyPolicy: {
      assessmentIsHypothesis: true,
      scoresAndWrongQuestionsOutrankLabels: true,
      noScoreGuarantee: true,
      noRawQuestionOrFullAnswerExport: true,
      noExternalAgentAsCoreShell: true
    }
  };

  writeJson(path.join(outputsDir, 'status', 'report_job_status.json'), jobStatus);
  writeFile(path.join(outputsDir, 'status', 'report_job_status.md'), `# Report Job Status

Generated: ${jobStatus.generatedAt}
Case: ${jobStatus.caseId}
Status: ${jobStatus.status}

## Local Pipeline

- Evidence ready: ${evidenceReady ? 'yes' : 'no'}
- Analysis ready: ${analysisReady ? 'yes' : 'no'}
- Image prompts ready: ${promptsReady ? 'yes' : 'no'}
- Slide images: ${slideImages.length}/24
- Image provider configured: ${providerConfigured ? 'yes' : 'no'}
- Packages ready: ${packagesReady ? 'yes' : 'no'}
- PDF ready: ${pdfReady ? 'yes' : 'no'}
- Human QA approved: ${qaApproval.approved ? 'yes' : 'no'}

## Product Routes

${productRoutes.length ? productRoutes.map((route) => `- ${route.id}: ${route.state} -> ${route.routeHint}`).join('\n') : '- Product handoff routes have not been generated yet.'}

## Next Best Action

${nextBestAction}

## External Provider Blockers

${jobStatus.externalBlockers.length ? jobStatus.externalBlockers.map((item) => `- ${item.id}: ${item.unblock}`).join('\n') : '- None at this stage.'}
`);
  return jobStatus;
}

function buildProductHandoff(manifest = buildInputManifest()) {
  ensureDir(path.join(outputsDir, 'handoff'));
  const slideImages = findSlideImages();
  const { sourceCounts, evidenceCounts, parsedEvidenceCounts } = evidenceCountsForManifest(manifest);
  const hasProfileEvidence = Boolean(parsedEvidenceCounts.reports || parsedEvidenceCounts.questionnaire);
  const hasScoreEvidence = Boolean(parsedEvidenceCounts.scores);
  const promptBatchesReady = promptBatches.every((batch) => fs.existsSync(path.join(outputsDir, 'deck', `image2_prompts_batch_${batch.id}.md`)));
  const packageFiles = {
    pptx: path.join(outputsDir, 'packages', 'final_report_images.pptx'),
    imageZip: path.join(outputsDir, 'packages', 'final_images_zip.zip'),
    contactSheet: path.join(outputsDir, 'packages', 'contact_sheet.svg'),
    htmlPreview: path.join(outputsDir, 'packages', 'final_report_preview.html'),
    pdfPreview: path.join(outputsDir, 'packages', 'final_report_preview.pdf')
  };
  const packageLinks = Object.fromEntries(Object.entries(packageFiles).map(([key, file]) => [key, {
    path: relativeOutput(file),
    exists: fs.existsSync(file)
  }]));
  const analysisFiles = {
    childProfile: path.join(outputsDir, 'analysis', 'child_profile.md'),
    questionnaireProfile: path.join(outputsDir, 'analysis', 'questionnaire_profile.md'),
    scoreAnalysis: path.join(outputsDir, 'analysis', 'score_analysis.md'),
    crossValidation: path.join(outputsDir, 'analysis', 'cross_validation.md'),
    methodologyMapping: path.join(outputsDir, 'analysis', 'methodology_mapping.md'),
    evidenceDigest: path.join(outputsDir, 'analysis', 'evidence_digest.md'),
    sourceManifest: path.join(outputsDir, 'analysis', 'source_manifest.json')
  };
  const analysisLinks = Object.fromEntries(Object.entries(analysisFiles).map(([key, file]) => [key, {
    path: relativeOutput(file),
    exists: fs.existsSync(file)
  }]));
  const missingMaterials = [];
  if (!hasProfileEvidence) missingMaterials.push('child assessment report or questionnaire answers');
  if (!hasScoreEvidence) missingMaterials.push('score sheet, score screenshot transcription, or wrong-question evidence');
  if (!evidenceCounts.extra_notes) missingMaterials.push('parent/teacher observation or homework-process notes');
  if (!slideImages.length) missingMaterials.push('approved Image 2 slide images');
  if (!packageLinks.pdfPreview.exists) missingMaterials.push('trusted PDF export');

  const routes = [
    {
      id: 'upload',
      surface: 'miniapp/app/web',
      entry: 'upload material classification',
      routeHint: '/pages/upload/upload',
      purpose: 'Collect assessment, questionnaire, score, wrong-question, style reference, and parent/teacher notes without mixing material types.',
      currentState: hasProfileEvidence || hasScoreEvidence ? 'has_parsed_real_evidence' : 'template_only_or_unparsed',
      requiredInput: ['reports or questionnaire', 'scores or wrong questions', 'extra notes when available'],
      outputForNextStep: ['source_manifest.json', 'evidence_digest.md', 'questionnaire_profile.md', 'parse_warnings.md']
    },
    {
      id: 'report',
      surface: 'miniapp/app/web',
      entry: 'parent report preview',
      routeHint: '/pages/profile/profile?from=report_ready',
      purpose: 'Show evidence-first explanation, cross-validation, method matching, and package status before sending a parent-facing PDF.',
      currentState: promptBatchesReady ? 'prompts_ready' : 'needs_prompt_batches',
      requiredInput: ['child_profile.md', 'questionnaire_profile.md', 'cross_validation.md', 'deck plan', 'Image 2 prompts', 'approved images'],
      outputForNextStep: ['final_report_preview.html', 'final_report_images.pptx', 'final_report_preview.pdf']
    },
    {
      id: 'tutor',
      surface: 'miniapp/app',
      entry: 'AI private tutor first-step questioning',
      routeHint: '/pages/tutor/tutor',
      purpose: 'Turn the report diagnosis into the first Socratic question, restatement check, condition decomposition, and wrong-cause follow-up.',
      currentState: hasProfileEvidence ? 'can_generate_method_hypotheses' : 'needs_profile_evidence',
      requiredInput: ['methodology_mapping.md', 'cross_validation.md', 'latest student question or wrong question'],
      outputForNextStep: ['first question', 'evidence-based hint ladder', 'validation result']
    },
    {
      id: 'review_game',
      surface: 'miniapp/app',
      entry: 'review and transfer game',
      routeHint: '/pages/review/review',
      purpose: 'Validate memory, day-7 retention, and transfer through variation practice instead of only presenting advice.',
      currentState: hasScoreEvidence ? 'can_seed_review_priorities' : 'needs_score_or_wrong_question_evidence',
      requiredInput: ['score weak points', 'wrong-cause tags', 'method module tags'],
      outputForNextStep: ['review card queue', 'variation challenge', 'retention/transfer evidence']
    },
    {
      id: 'parent',
      surface: 'miniapp/app/web',
      entry: 'parent evidence summary and next action',
      routeHint: '/pages/profile/profile',
      purpose: 'Give parents a non-anxious summary: what is evidenced, what is only a hypothesis, what to do tonight, and what material to add next.',
      currentState: missingMaterials.length ? 'needs_more_material_or_generation' : 'ready_for_human_review',
      requiredInput: ['readiness report', 'package manifest', 'product handoff'],
      outputForNextStep: ['one next action', 'missing material request', 'PDF/report package link']
    }
  ];

  const handoff = {
    generatedAt: new Date().toISOString(),
    caseId: manifest.caseId,
    status: missingMaterials.length ? 'product_loop_not_ready_for_parent_release' : 'product_loop_ready_for_human_review',
    inputsDir: manifest.inputsDir,
    outputsDir: manifest.outputsDir,
    sourceCounts,
    evidenceCounts,
    parsedEvidenceCounts,
    evidencePolicy: {
      assessmentIsHypothesis: true,
      scoresAndWrongQuestionsOutrankLabels: true,
      noGuaranteedScoreImprovement: true,
      noExternalAgentAsCoreShell: true
    },
    reportPipeline: {
      analysis: relativeOutput(path.join(outputsDir, 'analysis')),
      analysisFiles: analysisLinks,
      deck: relativeOutput(path.join(outputsDir, 'deck')),
      status: relativeOutput(path.join(outputsDir, 'status', 'report_job_status.json')),
      imageCount: slideImages.length,
      promptBatchesReady,
      packageLinks
    },
    routes,
    nextMaterialNeeded: missingMaterials,
    recommendedNextStep: missingMaterials[0] || 'Run human QA on the PDF and then connect the approved case to parent/tutor/review routes.'
  };

  writeJson(path.join(outputsDir, 'handoff', 'product_handoff.json'), handoff);
  writeFile(path.join(outputsDir, 'handoff', 'product_handoff.md'), `# Product Handoff

Generated: ${handoff.generatedAt}
Case: ${handoff.caseId}
Status: ${handoff.status}

## Evidence State

${Object.entries(evidenceCounts).map(([lane, count]) => `- ${lane}: ${count} real file(s)`).join('\n')}

## Parsed Evidence State

${Object.entries(parsedEvidenceCounts).map(([lane, count]) => `- ${lane}: ${count} parsed real file(s)`).join('\n')}

## Product Loop Routes

| Route | Entry | State | Output |
| --- | --- | --- | --- |
${routes.map((route) => `| ${route.id} | ${route.entry} | ${route.currentState} | ${route.outputForNextStep.join(', ')} |`).join('\n')}

## Package Links

${Object.entries(packageLinks).map(([key, item]) => `- ${key}: \`${item.path}\` (${item.exists ? 'exists' : 'missing'})`).join('\n')}

## Evidence Policy

- Assessment or dermatoglyphics material is a hypothesis source, not a destiny claim.
- Scores, wrong questions, behavior notes, and follow-up validation outrank labels.
- The AI tutor uses report evidence to ask better questions; it does not replace evidence grading.
- The review/game loop must create retention and transfer evidence before the next parent summary.

## Next Material Needed

${missingMaterials.length ? missingMaterials.map((item) => `- ${item}`).join('\n') : '- No missing material for handoff. Human QA is still required before parent delivery.'}

## Recommended Next Step

${handoff.recommendedNextStep}
`);
  return handoff;
}

function buildReadinessReport(manifest = buildInputManifest()) {
  ensureDir(path.join(outputsDir, 'review'));
  const requiredAnalysis = [
    'child_profile.md',
    'questionnaire_profile.md',
    'score_analysis.md',
    'cross_validation.md',
    'methodology_mapping.md',
    'evidence_digest.md',
    'source_manifest.json'
  ].map((file) => path.join(outputsDir, 'analysis', file));
  const promptFiles = promptBatches.map((batch) => path.join(outputsDir, 'deck', `image2_prompts_batch_${batch.id}.md`));
  const slideImages = findSlideImages();
  const imageAudit = auditSlideImages();
  const qaApproval = readQaApproval();
  const packages = {
    pptx: path.join(outputsDir, 'packages', 'final_report_images.pptx'),
    zip: path.join(outputsDir, 'packages', 'final_images_zip.zip'),
    contactSheet: path.join(outputsDir, 'packages', 'contact_sheet.svg'),
    previewHtml: path.join(outputsDir, 'packages', 'final_report_preview.html'),
    previewPdf: path.join(outputsDir, 'packages', 'final_report_preview.pdf')
  };
  const { sourceCounts, evidenceCounts, parsedEvidenceCounts } = evidenceCountsForManifest(manifest);
  const evidenceReady = (parsedEvidenceCounts.reports || parsedEvidenceCounts.questionnaire) && parsedEvidenceCounts.scores;
  const analysisReady = countExisting(requiredAnalysis) === requiredAnalysis.length;
  const promptsReady = countExisting(promptFiles) === promptFiles.length;
  const imagesReady = slideImages.length >= 24;
  const imageAuditReady = imageAudit.readyForPackaging;
  const packagingReady = ['pptx', 'zip', 'contactSheet', 'previewHtml'].every((key) => fs.existsSync(packages[key]));
  const pdfReady = fs.existsSync(packages.previewPdf);
  const qaReady = fs.existsSync(path.join(outputsDir, 'review', 'qa_checklist.md'));
  const qaApproved = qaApproval.approved;
  const handoffReady = fs.existsSync(path.join(outputsDir, 'handoff', 'product_handoff.json'))
    && fs.existsSync(path.join(outputsDir, 'handoff', 'product_handoff.md'));

  const gates = [
    ['Parsed input evidence', Boolean(evidenceReady), 'Need parsed assessment/questionnaire plus parsed score or wrong-question evidence for parent-facing claims. PDF/image uploads need sidecar text or REPORT_TEXT_EXTRACTOR.'],
    ['Analysis files', analysisReady, 'Need child profile, score analysis, cross validation, methodology mapping, and source manifest.'],
    ['Prompt batches', promptsReady, 'Need Image 2 prompt batches 01-03 covering slides 01-24.'],
    ['Generated images', imagesReady, `Need 24 slide images; currently found ${slideImages.length}.`],
    ['Image audit', imageAuditReady, `Need 24 slide images that pass automated file, size, ratio, prompt, and metadata/manual approval checks; currently ${imageAudit.passCount}/24 pass.`],
    ['Package files', packagingReady, 'Need PPTX, image ZIP, contact sheet, and HTML preview after images exist.'],
    ['PDF export', pdfReady, 'Need trusted renderer export to final_report_preview.pdf.'],
    ['QA checklist', qaReady, 'Need QA checklist before release.'],
    ['Human QA approval', qaApproved, `Need review/qa_approval.json with all ${humanQaChecks.length} parent-release checks marked true. ${qaApproval.missing.length ? `Missing: ${qaApproval.missing.slice(0, 3).join('; ')}` : ''}`],
    ['Product handoff', handoffReady, 'Need product_handoff.json/md so miniapp, app, and web routes can consume the report state.']
  ];

  const blocking = gates.filter((gate) => !gate[1]);
  const status = blocking.length ? 'not_ready_for_parent_release' : 'ready_for_parent_release';
  const nextStep = blocking.length
    ? blocking[0][2]
    : 'All release gates passed. Run final human review before sending to parents.';

  writeJson(path.join(outputsDir, 'review', 'readiness_report.json'), {
    generatedAt: new Date().toISOString(),
    caseId: manifest.caseId,
    status,
    sourceCounts,
    evidenceCounts,
    parsedEvidenceCounts,
    slideImageCount: slideImages.length,
    imageAudit: {
      readyForPackaging: imageAudit.readyForPackaging,
      passCount: imageAudit.passCount,
      issueCount: imageAudit.issues.length
    },
    humanQaApproval: qaApproval,
    packages: Object.fromEntries(Object.entries(packages).map(([key, file]) => [key, fs.existsSync(file)])),
    productHandoff: handoffReady,
    gates: gates.map(([name, passed, note]) => ({ name, passed, note })),
    nextStep
  });

  writeFile(path.join(outputsDir, 'review', 'readiness_report.md'), `# Report Pipeline Readiness

Generated: ${new Date().toISOString()}
Case: ${manifest.caseId}
Status: ${status}

## Gate Results

| Gate | Status | Note |
| --- | --- | --- |
${gates.map(([name, passed, note]) => `| ${name} | ${passed ? 'PASS' : 'BLOCKED'} | ${note} |`).join('\n')}

## Source Counts

${Object.entries(sourceCounts).map(([lane, count]) => `- ${lane}: ${count}`).join('\n')}

## Real Evidence Counts

${Object.entries(evidenceCounts).map(([lane, count]) => `- ${lane}: ${count}`).join('\n')}

## Parsed Real Evidence Counts

${Object.entries(parsedEvidenceCounts).map(([lane, count]) => `- ${lane}: ${count}`).join('\n')}

## Generated Assets

- Slide images: ${slideImages.length}/24
- Image audit pass: ${imageAudit.passCount}/24
- PPTX: ${fs.existsSync(packages.pptx) ? 'yes' : 'no'}
- Image ZIP: ${fs.existsSync(packages.zip) ? 'yes' : 'no'}
- Contact sheet: ${fs.existsSync(packages.contactSheet) ? 'yes' : 'no'}
- HTML preview: ${fs.existsSync(packages.previewHtml) ? 'yes' : 'no'}
- PDF preview: ${fs.existsSync(packages.previewPdf) ? 'yes' : 'no'}
- Human QA approval: ${qaApproved ? 'yes' : 'no'}
- Product handoff: ${handoffReady ? 'yes' : 'no'}

## Next Step

${nextStep}
`);
}

function packageOutputs() {
  ensureDir(path.join(outputsDir, 'packages'));
  const slideImages = findSlideImages();
  const pptxFile = path.join(outputsDir, 'packages', 'final_report_images.pptx');
  const zipFile = path.join(outputsDir, 'packages', 'final_images_zip.zip');
  const contactSheetFile = path.join(outputsDir, 'packages', 'contact_sheet.svg');
  const previewHtmlFile = path.join(outputsDir, 'packages', 'final_report_preview.html');
  const pptxCreated = buildPptxFromImages(slideImages, pptxFile);
  const zipCreated = packageSlideImagesZip(slideImages, zipFile);
  const contactSheetCreated = buildContactSheet(slideImages, contactSheetFile);
  const previewHtmlCreated = buildHtmlPreview(slideImages, previewHtmlFile);

  writeFile(path.join(outputsDir, 'packages', 'PACKAGE_MANIFEST.md'), `# Package Manifest

## Case

- Case ID: ${activeCaseId || 'default'}
- Input root: \`${path.relative(root, inputsDir).replace(/\\/g, '/')}\`
- Output root: \`${path.relative(root, outputsDir).replace(/\\/g, '/')}\`

## Current Status

${pptxCreated ? `A PPTX has been created from ${slideImages.length} generated slide image(s): \`outputs/packages/final_report_images.pptx\`.` : 'This package is not a final PPT/PDF yet. Image generation has not been executed by this local script, or no slide images were found.'}

## Ready for Manual Generation

- \`outputs/deck/image2_prompts_batch_01.md\`
- \`outputs/deck/image2_prompts_batch_02.md\`
- \`outputs/deck/image2_prompts_batch_03.md\`
- \`outputs/deck/manual_generation_queue.md\`
- \`outputs/review/qa_checklist.md\`

## Current Image Count

- ${slideImages.length} generated slide image(s) found in \`outputs/images/\`.

## Current Package Files

- PPTX: ${pptxCreated ? '`outputs/packages/final_report_images.pptx`' : 'not created because no slide images were found'}
- Image ZIP: ${zipCreated ? '`outputs/packages/final_images_zip.zip`' : 'not created because no slide images were found'}
- Contact sheet: ${contactSheetCreated ? '`outputs/packages/contact_sheet.svg`' : 'not created because no slide images were found'}
- HTML preview: ${previewHtmlCreated ? '`outputs/packages/final_report_preview.html`' : 'not created because no slide images were found'}

## Expected Final Files After Image Generation

- \`outputs/packages/final_report_images.pptx\`
- \`outputs/packages/final_images_zip.zip\`
- \`outputs/packages/final_report_preview.html\`
- \`outputs/packages/final_report_preview.pdf\`
- \`outputs/packages/contact_sheet.svg\`

## PDF Export Rule

PDF export is a separate step after PPTX review. Do not mark the final PDF complete until the generated PPTX is opened and exported by a trusted renderer.
`);
}

async function run(command) {
  ensureDir(inputsDir);
  ensureDir(outputsDir);
  inputLanes.forEach(([lane]) => ensureDir(path.join(inputsDir, lane)));
  ['analysis', 'deck', 'images', 'handoff', 'logs', 'packages', 'review'].forEach((lane) => ensureDir(path.join(outputsDir, lane)));

  const manifest = buildInputManifest();

  if (command === 'parse_inputs' || command === 'all') {
    buildInputTemplates();
    writeParseWarnings(manifest);
  }
  if (command === 'build_analysis' || command === 'all') buildAnalysis(manifest);
  if (command === 'build_deck_plan' || command === 'all') {
    buildDeckPlan();
    buildSlideCopy();
  }
  if (command === 'build_image2_prompts' || command === 'all') {
    buildImagePrompts(manifest);
    buildManualQueue();
  }
  if (command === 'generate_images') await generateImages();
  if (command === 'review_images' || command === 'all') {
    buildReviewFiles();
    reviewImages();
  }
  if (command === 'package_outputs' || command === 'all') packageOutputs();
  if (command === 'export_pdf') exportPreviewPdf();
  if (command === 'build_product_handoff' || command === 'all') buildProductHandoff(manifest);
  if (command === 'readiness' || command === 'all') buildReadinessReport(manifest);
  if (command === 'build_job_status' || command === 'all' || command === 'readiness' || command === 'build_product_handoff') buildReportJobStatus(manifest);

  console.log(`report pipeline command completed: ${command}`);
}

const command = process.argv[2] || 'all';
const allowed = new Set(['all', 'parse_inputs', 'build_analysis', 'build_deck_plan', 'build_image2_prompts', 'generate_images', 'review_images', 'package_outputs', 'export_pdf', 'build_product_handoff', 'readiness', 'build_job_status']);
if (!allowed.has(command)) {
  console.error(`Unknown command: ${command}`);
  console.error(`Allowed commands: ${Array.from(allowed).join(', ')}`);
  process.exit(1);
}

run(command).catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
