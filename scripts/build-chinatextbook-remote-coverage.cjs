const fs = require('fs');
const https = require('https');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TEXTBOOK_INDEX = path.join(ROOT, 'src', 'curriculum', 'textbook-index.json');
const RAW_DIR = path.join(ROOT, 'data', 'textbooks-raw');
const EXTRACTED_MANIFEST = path.join(ROOT, 'data', 'extracted', 'manifest.json');
const OUT_JSON = path.join(ROOT, 'src', 'curriculum', 'chinatextbook-remote-coverage.json');
const OUT_MD = path.join(ROOT, 'docs', 'CHINATEXTBOOK-REMOTE-COVERAGE.md');

const REPO = 'TapXWorld/ChinaTextbook';
const REPO_API = `https://api.github.com/repos/${REPO}`;
const TREE_API = `https://api.github.com/repos/${REPO}/git/trees/master?recursive=1`;
const BLOB_BASE = `https://github.com/${REPO}/blob/master/`;

function requestJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            accept: 'application/vnd.github+json',
            'user-agent': 'yuandian-textbook-coverage-audit'
          }
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            if (res.statusCode < 200 || res.statusCode >= 300) {
              reject(new Error(`GitHub API ${res.statusCode}: ${data.slice(0, 500)}`));
              return;
            }
            try {
              resolve(JSON.parse(data));
            } catch (error) {
              reject(error);
            }
          });
        }
      )
      .on('error', reject);
  });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function inc(map, key, count = 1) {
  const normalized = key || '未标注';
  map[normalized] = (map[normalized] || 0) + count;
}

function normalizedStage(value) {
  const text = String(value || '').trim();
  if (text.includes('小学')) return text.includes('五') ? '小学（五四学制）' : '小学';
  if (text.includes('初中')) return text.includes('五') ? '初中（五四学制）' : '初中';
  if (text.includes('高中')) return '高中';
  if (text.includes('大学')) return '大学';
  return text || '未标注';
}

function normalizedSubject(value) {
  const text = String(value || '').trim();
  if (text.includes('数学')) return '数学';
  if (text.includes('语文')) return text.includes('书法') ? '语文·书法练习指导' : '语文';
  if (text.includes('英语')) return '英语';
  if (text.includes('物理')) return '物理';
  if (text.includes('化学')) return '化学';
  if (text.includes('生物')) return '生物学';
  if (text.includes('历史')) return '历史';
  if (text.includes('地理')) return text.includes('图册') ? '地理图册' : '地理';
  if (text.includes('道德')) return '道德与法治';
  if (text.includes('政治')) return '思想政治';
  if (text.includes('科学')) return '科学';
  if (text.includes('美术')) return '美术';
  if (text.includes('音乐')) return '音乐';
  if (text.includes('体育')) return '体育与健康';
  if (text.includes('信息技术')) return '信息技术';
  if (text.includes('通用技术')) return '通用技术';
  if (text.includes('艺术')) return '艺术';
  return text || '未标注';
}

function normalizedEdition(value) {
  let text = String(value || '').trim();
  text = text.split('-')[0].trim();
  text = text.replace(/（?A版）?/g, 'A版').replace(/（?B版）?/g, 'B版');
  if (/人教版?A版|人教A版/.test(text)) return '人教A版';
  if (/人教版?B版|人教B版/.test(text)) return '人教B版';
  if (text.includes('统编')) return '统编版';
  if (text.includes('人教')) return '人教版';
  if (text.includes('北师大')) return '北师大版';
  if (text.includes('苏教')) return '苏教版';
  if (text.includes('外研')) return '外研社版';
  if (text.includes('译林')) return '译林版';
  if (text.includes('沪教')) return '沪教版';
  if (text.includes('沪科教')) return '沪科教版';
  if (text.includes('沪科技')) return '沪科技版';
  if (text.includes('鲁科')) return '鲁科版';
  if (text.includes('鲁教')) return '鲁教版';
  if (text.includes('湘教')) return '湘教版';
  if (text.includes('教科')) return '教科版';
  if (text.includes('青岛')) return '青岛版';
  if (text.includes('冀教')) return '冀教版';
  if (text.includes('粤教')) return '粤教版';
  if (text.includes('北京')) return '北京版';
  return text || '未标注';
}

function normalizedGrade(stage, rawGrade, title) {
  const text = `${rawGrade || ''} ${title || ''}`;
  if (stage === '高中') {
    const selective = text.match(/选择性必修\s*([一二三四五六七八九123456789]?)/);
    if (selective) return selective[1] ? `选择性必修${cnNumber(selective[1])}` : '选择性必修';
    const required = text.match(/(?<!选择性)必修\s*([一二三四五六七八九123456789]?)/);
    if (required) return required[1] ? `必修${cnNumber(required[1])}` : '必修';
  }
  const gradeMatch = text.match(/[一二三四五六七八九]年级/);
  if (gradeMatch) return gradeMatch[0];
  const highMatch = text.match(/高[一二三]/);
  if (highMatch) return highMatch[0];
  return String(rawGrade || '').trim() || '未标注';
}

function cnNumber(value) {
  const map = {
    一: '1',
    二: '2',
    三: '3',
    四: '4',
    五: '5',
    六: '6',
    七: '7',
    八: '8',
    九: '9'
  };
  return map[value] || value;
}

function normalizedVolume(stage, title) {
  const text = String(title || '').replace(/\.pdf$/i, '');
  if (stage === '高中') {
    if (text.includes('中外历史纲要（上）')) return '中外历史纲要（上）';
    if (text.includes('中外历史纲要（下）')) return '中外历史纲要（下）';
    const numberedNamed = text.match(/(?:选择性必修|(?<!选择性)必修)\s*[一二三四五六七八九123456789][·：:\s-]+(.+)$/);
    if (numberedNamed && numberedNamed[1] && !/第[一二三]册/.test(numberedNamed[1])) return numberedNamed[1].trim();
    const named = text.match(/选择性必修[一二三四五六七八九123456789]?[·：:\s-]*(.+)$/);
    if (named && named[1] && !/第[一二三]册/.test(named[1])) return named[1].trim();
    const volumeMatch = text.match(/第[一二三四五六七八九123456789]+册/);
    if (volumeMatch) return volumeMatch[0].replace('第1册', '第一册').replace('第2册', '第二册').replace('第3册', '第三册');
  }
  if (text.includes('全一册')) return '全一册';
  if (text.includes('上册')) return '上册';
  if (text.includes('下册')) return '下册';
  const volumeMatch = text.match(/第[一二三四五六七八九123456789]+册/);
  if (volumeMatch) return volumeMatch[0];
  return text;
}

function keyOf(item) {
  return [item.stage, item.subject, item.edition, item.grade, item.volume].map((value) => String(value || '')).join('||');
}

function sortByKey(rows) {
  return rows.sort((a, b) => keyOf(a).localeCompare(keyOf(b), 'zh-Hans-CN'));
}

function parseRemotePdf(item) {
  const parts = item.path.split('/');
  const title = path.basename(item.path, '.pdf');
  const rawStage = parts[0] || '';
  const rawSubject = parts[1] || '';
  const rawEdition = parts[2] || '';
  const rawGrade = parts.length >= 5 ? parts[3] : '';
  const stage = normalizedStage(rawStage);
  const subject = normalizedSubject(rawSubject);
  const edition = normalizedEdition(rawEdition);
  const grade = normalizedGrade(stage, rawGrade, title);
  const volume = normalizedVolume(stage, title);

  return {
    stage,
    subject,
    edition,
    grade,
    volume,
    title,
    raw_path: item.path,
    raw_stage: rawStage,
    raw_subject: rawSubject,
    raw_edition_provider: rawEdition,
    raw_grade: rawGrade,
    github_url: `${BLOB_BASE}${encodeURI(item.path)}`,
    size: item.size || 0
  };
}

function flattenCatalog() {
  if (!fs.existsSync(TEXTBOOK_INDEX)) return [];
  const index = readJson(TEXTBOOK_INDEX);
  const rows = [];
  for (const [stage, subjects] of Object.entries(index || {})) {
    for (const [subject, editions] of Object.entries(subjects || {})) {
      for (const [edition, node] of Object.entries(editions || {})) {
        for (const [grade, volumes] of Object.entries(node.grades || {})) {
          for (const [volume, book] of Object.entries(volumes || {})) {
            rows.push({
              stage: normalizedStage(stage),
              subject: normalizedSubject(subject),
              edition: normalizedEdition(edition),
              grade,
              volume,
              title: book.title || '',
              path: book.path || ''
            });
          }
        }
        for (const [bookName, book] of Object.entries(node.books || {})) {
          const stageName = normalizedStage(stage);
          rows.push({
            stage: stageName,
            subject: normalizedSubject(subject),
            edition: normalizedEdition(edition),
            grade: normalizedGrade(stageName, bookName, book.title || bookName),
            volume: normalizedVolume(stageName, book.title || bookName),
            title: book.title || bookName,
            path: book.path || ''
          });
        }
      }
    }
  }
  return sortByKey(rows);
}

function flattenRaw() {
  if (!fs.existsSync(RAW_DIR)) return [];
  const rows = [];
  const stack = [RAW_DIR];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.pdf') continue;
      const parts = path.relative(RAW_DIR, full).split(path.sep);
      if (parts.length < 5) continue;
      const stage = normalizedStage(parts[0]);
      const subject = normalizedSubject(parts[1]);
      const edition = normalizedEdition(parts[2]);
      const grade = normalizedGrade(stage, parts[3], entry.name);
      const volume = normalizedVolume(stage, path.basename(entry.name, '.pdf'));
      rows.push({
        stage,
        subject,
        edition,
        grade,
        volume,
        title: path.basename(entry.name, '.pdf'),
        path: rel(full),
        bytes: fs.statSync(full).size
      });
    }
  }
  return sortByKey(rows);
}

function flattenExtracted() {
  if (!fs.existsSync(EXTRACTED_MANIFEST)) return [];
  const manifest = readJson(EXTRACTED_MANIFEST);
  return sortByKey((manifest.books || []).map((book) => ({
    stage: normalizedStage(book.stage),
    subject: normalizedSubject(book.subject),
    edition: normalizedEdition(book.edition),
    grade: normalizedGrade(normalizedStage(book.stage), book.grade, book.volume),
    volume: book.volume || '',
    title: `${book.stage || ''}${book.subject || ''}${book.grade || ''}${book.volume || ''}`,
    path: book.path || '',
    page_count: Number(book.page_count || 0),
    chapter_count: (book.chapters || []).length
  })));
}

function groupStats(rows) {
  const byStage = {};
  const bySubject = {};
  const byStageSubject = {};
  const byEdition = {};
  for (const row of rows) {
    inc(byStage, row.stage);
    inc(bySubject, row.subject);
    inc(byStageSubject, `${row.stage}/${row.subject}`);
    inc(byEdition, row.edition);
  }
  return { total: rows.length, byStage, bySubject, byStageSubject, byEdition };
}

function sortedEntries(obj, limit = 30) {
  return Object.entries(obj || {})
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hans-CN'))
    .slice(0, limit);
}

function table(rows, headers) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`)
  ].join('\n');
}

function coverageRatio(hasCount, total) {
  if (!total) return '0.0%';
  return `${((hasCount / total) * 100).toFixed(1)}%`;
}

function coreRows(rows) {
  return rows.filter((row) =>
    ['小学', '初中', '高中'].includes(row.stage) &&
    ['语文', '数学', '英语', '物理', '化学', '生物学', '历史', '地理', '道德与法治', '思想政治', '科学'].includes(row.subject)
  );
}

function buildRows(remote, catalog, raw, extracted) {
  const catalogMap = new Map(catalog.map((item) => [keyOf(item), item]));
  const rawMap = new Map(raw.map((item) => [keyOf(item), item]));
  const extractedMap = new Map(extracted.map((item) => [keyOf(item), item]));
  return sortByKey(remote.map((item) => ({
    stage: item.stage,
    subject: item.subject,
    edition: item.edition,
    grade: item.grade,
    volume: item.volume,
    title: item.title,
    in_remote: true,
    in_local_catalog: catalogMap.has(keyOf(item)),
    has_local_pdf: rawMap.has(keyOf(item)),
    has_extracted_text: extractedMap.has(keyOf(item)),
    github_url: item.github_url,
    raw_path: item.raw_path
  })));
}

function topMissingForExtraction(rows) {
  const wanted = ['初中/英语', '初中/道德与法治', '高中/英语', '高中/生物学', '初中/历史', '初中/地理'];
  return rows
    .filter((row) => row.has_local_pdf && !row.has_extracted_text)
    .filter((row) => wanted.includes(`${row.stage}/${row.subject}`))
    .slice(0, 30);
}

function writeMarkdown(report) {
  const remote = report.summary.remote_pdf;
  const local = report.summary.local_layers;
  const core = report.summary.core_k12_remote;
  const topSubjects = table(sortedEntries(remote.bySubject, 18).map(([name, count]) => [name, String(count)]), ['学科', '远端 PDF 数']);
  const topStageSubject = table(sortedEntries(remote.byStageSubject, 22).map(([name, count]) => [name, String(count)]), ['学段/学科', '远端 PDF 数']);
  const topEditions = table(sortedEntries(remote.byEdition, 22).map(([name, count]) => [name, String(count)]), ['版本', '远端 PDF 数']);

  const k12Rows = Object.entries(core.byStage || {}).map(([stage, count]) => {
    const rows = report.rows.filter((row) => row.stage === stage && core.subjects.includes(row.subject));
    const localPdf = rows.filter((row) => row.has_local_pdf).length;
    const extracted = rows.filter((row) => row.has_extracted_text).length;
    return [stage, String(count), String(localPdf), coverageRatio(localPdf, count), String(extracted), coverageRatio(extracted, count)];
  });

  const missingRows = topMissingForExtraction(report.rows).map((row) => [
    row.stage,
    row.subject,
    row.edition,
    row.grade,
    row.volume,
    row.title
  ]);

  const strongestExtracted = report.rows
    .filter((row) => row.has_extracted_text)
    .slice(0, 24)
    .map((row) => [row.stage, row.subject, row.edition, row.grade, row.volume]);

  const content = `# ChinaTextbook 远端教材覆盖盘点

生成时间：${report.generated_at}

## 结论

ChinaTextbook 可以成为原点智学的一个强卖点，但卖点应该是“教材版本对齐 + 知识点定位 + 个性化闯关底座”，不是“我们内置全套教材原文”。

- 远端仓库规模很大：GitHub tree 共 ${report.github.tree_count} 条，PDF ${remote.total} 个，且 tree 未截断。
- 小初高核心教材很广：按远端路径统计，小学 ${remote.byStage['小学'] || 0} 个 PDF，初中 ${remote.byStage['初中'] || 0} 个 PDF，高中 ${remote.byStage['高中'] || 0} 个 PDF。
- 我们本地已经有三层资产，但不算全：本地目录索引 ${local.catalog_total} 条，本地 PDF ${local.raw_pdf_total} 本，已抽取可用于学习包生成的文本 ${local.extracted_text_total} 本。
- 可以先卖“覆盖主流教材版本，能按教材版本定位知识点”，暂时不要卖“全国全版本全量教材已可生成”。
- 远端仓库 GitHub API 返回 license 为 ${report.github.license || 'null'}，商业化与公开分发必须走版权审查；产品上应让用户上传/录入自己的学习材料，我们只做章节、知识点、错因与复习路径对齐。

## 可作为卖点的真实部分

1. 覆盖面：远端 PDF 横跨小学、初中、高中，版本包括人教版、统编版、北师大版、苏教版、青岛版、沪教版、教科版、鲁教版、外研社版等。
2. 对齐能力：路径天然包含“学段 / 学科 / 版本 / 年级 / 册别”，适合做用户选择教材版本后的知识点定位。
3. 产品闭环：用户输入真实材料后，可以映射到章节知识点，再生成回忆卡、小测、5 分钟闯关、FSRS 复习和错因修复。
4. 差异化：比单纯聊天式 AI 更像 Gizmo 的“材料进来，游戏化掌握出去”，但更贴中国教材版本与家长证据闭环。

## 不能这样宣传

- 不要说“内置全国全套教材原文”。
- 不要说“所有教材版本都已可直接生成学习包”。
- 不要把未抽取、未授权、仅远端路径存在的教材展示成我们自己的内容库。
- 不要在用户端提供教材 PDF 下载或原文分发能力。

## 四层覆盖

| 层级 | 数量 | 含义 | 当前用途 |
| --- | ---: | --- | --- |
| ChinaTextbook 远端 PDF | ${remote.total} | GitHub 远端存在 PDF 文件 | 版本覆盖判断、补齐路线图 |
| 本地教材目录索引 | ${local.catalog_total} | 已在 \`src/curriculum/textbook-index.json\` 建索引 | 教材选择、章节/版本映射 |
| 本地原始 PDF | ${local.raw_pdf_total} | 已下载到 \`data/textbooks-raw\` | 可进入抽取管线 |
| 已抽取章节文本 | ${local.extracted_text_total} | 已在 \`data/extracted\` 中结构化 | 可直接生成学习包/回忆卡 |

## 小初高核心覆盖率

${table(k12Rows, ['学段', '远端核心 PDF', '本地 PDF', '本地 PDF 覆盖率', '已抽取文本', '已抽取覆盖率'])}

> 核心学科口径：${core.subjects.join('、')}。

## 远端学科分布

${topSubjects}

## 远端高频学段/学科

${topStageSubject}

## 远端高频版本

${topEditions}

## 已经能立刻支撑学习包的样本

${table(strongestExtracted, ['学段', '学科', '版本', '年级/模块', '册别'])}

## 优先补齐抽取

这些本地已有 PDF，但还没进入结构化抽取层，优先抽它们最划算：

${table(missingRows, ['学段', '学科', '版本', '年级/模块', '册别', '标题'])}

## 推荐产品话术

对外可以说：

> 原点智学支持按中国主流教材版本定位知识点。孩子上传作业、错题、笔记或教材片段后，AI 会把材料对齐到对应章节和知识点，生成回忆卡、小测和 5 分钟闯关，并用间隔复习持续修复薄弱点。

对内路线图可以说：

> ChinaTextbook 远端索引覆盖足够广，可以作为教材版本覆盖地图；我们的真正护城河应放在“抽取清洗 + 知识点本体 + 错因标签 + 游戏化复习引擎”，而不是搬运 PDF。

## 下一步

1. 先把 100 人体验目标聚焦到初中数学人教版，因为本地抽取和知识点本体最强。
2. 补抽初中英语人教版、初中道德与法治统编版、高中英语人教版、高中生物人教版。
3. 在产品里增加“选择教材版本/章节”的轻量入口，但所有生成数量必须来自用户材料或已抽取文本。
4. 做版权合规审查：远端仓库无明确 license，不能直接公开分发原文。
`;

  fs.mkdirSync(path.dirname(OUT_MD), { recursive: true });
  fs.writeFileSync(OUT_MD, content, 'utf8');
}

async function main() {
  const [repo, tree] = await Promise.all([requestJson(REPO_API), requestJson(TREE_API)]);
  const pdfEntries = (tree.tree || []).filter((item) => item.type === 'blob' && /\.pdf$/i.test(item.path));
  const remote = sortByKey(pdfEntries.map(parseRemotePdf));
  const catalog = flattenCatalog();
  const raw = flattenRaw();
  const extracted = flattenExtracted();
  const rows = buildRows(remote, catalog, raw, extracted);
  const coreSubjects = ['语文', '数学', '英语', '物理', '化学', '生物学', '历史', '地理', '道德与法治', '思想政治', '科学'];
  const coreRemoteRows = rows.filter((row) => ['小学', '初中', '高中'].includes(row.stage) && coreSubjects.includes(row.subject));
  const coreByStage = {};
  for (const row of coreRemoteRows) inc(coreByStage, row.stage);

  const report = {
    generated_at: new Date().toISOString(),
    source: {
      github_repo: `https://github.com/${REPO}`,
      github_api: REPO_API,
      github_tree_api: TREE_API,
      local_catalog: rel(TEXTBOOK_INDEX),
      local_raw_pdf_dir: rel(RAW_DIR),
      local_extracted_manifest: rel(EXTRACTED_MANIFEST)
    },
    github: {
      full_name: repo.full_name,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      size_kb: repo.size,
      default_branch: repo.default_branch,
      pushed_at: repo.pushed_at,
      updated_at: repo.updated_at,
      license: repo.license && repo.license.spdx_id,
      tree_count: (tree.tree || []).length,
      tree_truncated: Boolean(tree.truncated)
    },
    summary: {
      remote_pdf: groupStats(remote),
      local_layers: {
        catalog_total: catalog.length,
        raw_pdf_total: raw.length,
        extracted_text_total: extracted.length
      },
      core_k12_remote: {
        total: coreRemoteRows.length,
        subjects: coreSubjects,
        byStage: coreByStage
      },
      match: {
        remote_with_local_catalog: rows.filter((row) => row.in_local_catalog).length,
        remote_with_local_pdf: rows.filter((row) => row.has_local_pdf).length,
        remote_with_extracted_text: rows.filter((row) => row.has_extracted_text).length
      }
    },
    remote_rows: remote,
    rows,
    gaps: {
      local_pdf_without_extracted: rows.filter((row) => row.has_local_pdf && !row.has_extracted_text),
      remote_without_local_pdf: rows.filter((row) => !row.has_local_pdf),
      remote_without_extracted_text: rows.filter((row) => !row.has_extracted_text)
    }
  };

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeMarkdown(report);

  console.log(`Wrote ${rel(OUT_JSON)}`);
  console.log(`Wrote ${rel(OUT_MD)}`);
  console.log(`Remote PDF: ${remote.length}`);
  console.log(`Local PDF: ${raw.length}`);
  console.log(`Extracted text: ${extracted.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
