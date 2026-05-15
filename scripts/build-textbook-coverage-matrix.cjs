const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TEXTBOOK_INDEX = path.join(ROOT, 'src', 'curriculum', 'textbook-index.json');
const RAW_DIR = path.join(ROOT, 'data', 'textbooks-raw');
const EXTRACTED_MANIFEST = path.join(ROOT, 'data', 'extracted', 'manifest.json');
const OUT_JSON = path.join(ROOT, 'src', 'curriculum', 'textbook-coverage-matrix.json');
const OUT_MD = path.join(ROOT, 'docs', 'TEXTBOOK-COVERAGE-MATRIX.md');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function keyOf(item) {
  return [item.stage, item.subject, item.edition, item.grade, item.volume].map((v) => String(v || '')).join('||');
}

function inc(map, key, count = 1) {
  const k = key || '未标注';
  map[k] = (map[k] || 0) + count;
}

function sortCn(list) {
  return list.sort((a, b) => keyOf(a).localeCompare(keyOf(b), 'zh-Hans-CN'));
}

function normalizeHighBookName(bookName) {
  const name = String(bookName || '').replace(/^学/, '').trim();
  const match = name.match(/^(必修|选择性必修)\s*(.*)$/);
  if (match) {
    return {
      grade: match[1],
      volume: match[2] ? `${match[1]} ${match[2]}` : match[1]
    };
  }
  return { grade: name, volume: name };
}

function flattenCatalog() {
  if (!fs.existsSync(TEXTBOOK_INDEX)) return [];
  const index = readJson(TEXTBOOK_INDEX);
  const rows = [];

  for (const [stage, subjects] of Object.entries(index || {})) {
    for (const [subject, editions] of Object.entries(subjects || {})) {
      for (const [edition, node] of Object.entries(editions || {})) {
        if (node.grades) {
          for (const [grade, volumes] of Object.entries(node.grades || {})) {
            for (const [volume, book] of Object.entries(volumes || {})) {
              rows.push({
                stage,
                subject,
                edition,
                grade,
                volume,
                title: book.title || '',
                source: 'catalog',
                path: book.path || '',
                github_url: book.github_url || ''
              });
            }
          }
        }
        if (node.books) {
          for (const [bookName, book] of Object.entries(node.books || {})) {
            const normalized = normalizeHighBookName(bookName);
            rows.push({
              stage,
              subject,
              edition,
              grade: normalized.grade,
              volume: normalized.volume,
              title: book.title || '',
              source: 'catalog',
              path: book.path || '',
              github_url: book.github_url || ''
            });
          }
        }
      }
    }
  }

  return sortCn(rows);
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
      const stage = parts[0];
      const subject = parts[1];
      const edition = parts[2];
      const grade = parts[3];
      const volume = path.basename(parts.slice(4).join('/'), '.pdf');
      rows.push({
        stage,
        subject,
        edition,
        grade,
        volume,
        title: path.basename(full, '.pdf'),
        source: 'raw_pdf',
        path: rel(full),
        bytes: fs.statSync(full).size
      });
    }
  }
  return sortCn(rows);
}

function flattenExtracted() {
  if (!fs.existsSync(EXTRACTED_MANIFEST)) return [];
  const manifest = readJson(EXTRACTED_MANIFEST);
  return sortCn((manifest.books || []).map((book) => ({
    stage: book.stage || '',
    subject: book.subject || '',
    edition: book.edition || '',
    grade: book.grade || '',
    volume: book.volume || '',
    title: `${book.stage || ''}${book.subject || ''}${book.grade || ''}${book.volume || ''}`,
    source: 'extracted',
    path: book.path || '',
    page_count: Number(book.page_count || 0),
    chapter_count: (book.chapters || []).length
  })));
}

function groupStats(rows) {
  const byStage = {};
  const bySubject = {};
  const byEdition = {};
  const byStageSubject = {};
  for (const row of rows) {
    inc(byStage, row.stage);
    inc(bySubject, row.subject);
    inc(byEdition, row.edition);
    inc(byStageSubject, `${row.stage}/${row.subject}`);
  }
  return { total: rows.length, byStage, bySubject, byEdition, byStageSubject };
}

function buildMatrix() {
  const catalog = flattenCatalog();
  const raw = flattenRaw();
  const extracted = flattenExtracted();
  const rawMap = new Map(raw.map((item) => [keyOf(item), item]));
  const extractedMap = new Map(extracted.map((item) => [keyOf(item), item]));
  const catalogMap = new Map(catalog.map((item) => [keyOf(item), item]));
  const allKeys = new Set([...catalogMap.keys(), ...rawMap.keys(), ...extractedMap.keys()]);

  const rows = [...allKeys].map((key) => {
    const base = extractedMap.get(key) || rawMap.get(key) || catalogMap.get(key);
    return {
      stage: base.stage,
      subject: base.subject,
      edition: base.edition,
      grade: base.grade,
      volume: base.volume,
      in_catalog: catalogMap.has(key),
      has_raw_pdf: rawMap.has(key),
      has_extracted_text: extractedMap.has(key),
      chapter_count: extractedMap.get(key)?.chapter_count || 0,
      page_count: extractedMap.get(key)?.page_count || 0
    };
  });

  sortCn(rows);

  const gaps = {
    catalog_without_raw: rows.filter((row) => row.in_catalog && !row.has_raw_pdf),
    raw_without_extracted: rows.filter((row) => row.has_raw_pdf && !row.has_extracted_text),
    extracted_without_catalog: rows.filter((row) => row.has_extracted_text && !row.in_catalog)
  };

  return {
    generated_at: new Date().toISOString(),
    sources: {
      catalog: rel(TEXTBOOK_INDEX),
      raw_pdf_dir: rel(RAW_DIR),
      extracted_manifest: rel(EXTRACTED_MANIFEST)
    },
    summary: {
      catalog: groupStats(catalog),
      raw_pdf: groupStats(raw),
      extracted_text: groupStats(extracted),
      gaps: {
        catalog_without_raw: gaps.catalog_without_raw.length,
        raw_without_extracted: gaps.raw_without_extracted.length,
        extracted_without_catalog: gaps.extracted_without_catalog.length
      }
    },
    rows,
    gaps
  };
}

function sortedEntries(obj) {
  return Object.entries(obj || {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hans-CN'));
}

function table(rows, headers) {
  const lines = [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`];
  for (const row of rows) lines.push(`| ${row.join(' | ')} |`);
  return lines.join('\n');
}

function coverageTable(items) {
  return table(items.map((row) => [
    row.stage,
    row.subject,
    row.edition,
    row.grade,
    row.volume,
    row.in_catalog ? '是' : '否',
    row.has_raw_pdf ? '是' : '否',
    row.has_extracted_text ? '是' : '否',
    String(row.chapter_count || '')
  ]), ['学段', '学科', '版本', '年级/模块', '册/书名', '索引', 'PDF', '可生成', '章节']);
}

function writeMarkdown(matrix) {
  const raw = matrix.summary.raw_pdf;
  const extracted = matrix.summary.extracted_text;
  const catalog = matrix.summary.catalog;
  const extractedRows = matrix.rows.filter((row) => row.has_extracted_text);
  const rawOnly = matrix.gaps.raw_without_extracted;
  const keyExtracted = extractedRows.filter((row) => ['初中', '高中'].includes(row.stage));
  const byExtractedSubject = sortedEntries(extracted.bySubject).map(([k, v]) => [k, String(v)]);
  const byRawSubject = sortedEntries(raw.bySubject).map(([k, v]) => [k, String(v)]);

  const coreExtracted = keyExtracted.filter((row) => [
    '语文', '数学', '英语', '物理', '化学', '生物学', '历史', '地理', '道德与法治', '思想政治'
  ].includes(row.subject));

  const content = `# 教材覆盖矩阵

生成时间：${matrix.generated_at}

## 先说结论

不算“全”。仓库里有三层资产，完整度不一样：

- 教材总索引：${catalog.total} 本/册，覆盖小学、初中、高中，多版本很多。
- 本地 PDF：${raw.total} 本/册，是已经下载到本地的原始教材。
- 可直接用于学习包生成的章节文本：${extracted.total} 本/册，${extracted.byStage['初中'] || 0} 本初中、${extracted.byStage['高中'] || 0} 本高中。

也就是说：**当前可直接生成知识卡/小测的，是 \`data/extracted\` 里的 ${extracted.total} 本，不是 \`textbook-index\` 里登记过的全部教材。**

## 可生成学习包的覆盖

### 按学科

${table(byExtractedSubject, ['学科', '可生成书本数'])}

### 明细

${coverageTable(coreExtracted)}

## 本地 PDF 覆盖

这些 PDF 已在 \`${matrix.sources.raw_pdf_dir}\`，但其中有 ${rawOnly.length} 本还没有进入章节文本抽取层。

${table(byRawSubject, ['学科', 'PDF 书本数'])}

## PDF 有但还不能直接生成的缺口

${rawOnly.length ? coverageTable(rawOnly) : '暂无。'}

## 主要缺口

- 小学教材：索引里有不少，当前没有进入 \`data/extracted\`。
- 初中英语：PDF 有人教版七上/七下/八上/八下/九全，但未抽取成章节文本。
- 初中道德与法治：PDF 有统编版七到九年级上下册，但未抽取成章节文本；当前 extracted 里没有这个学科。
- 初中历史：当前只抽取了七下、八下、九下，七上、八上、九上还在 PDF 层或索引层。
- 初中地理：当前缺八年级下册抽取文本。
- 高中英语：PDF 有人教版必修/选择性必修 7 册，但未抽取成章节文本。
- 高中生物：PDF 有人教版 5 册，但未抽取成章节文本。
- 高中语文：索引里有统编版必修/选择性必修，但当前没有本地 PDF/抽取文本。
- 多版本覆盖：索引里有北师大版、苏科版、青岛版、外研社版、湘教版、教科版、鲁科版等，但当前可生成层主要是人教版/统编版/人教A版。

## 现在最适合先做的范围

100 人体验或首批产品验证，建议优先：

1. 初中数学人教版七上到九下：抽取完整，且知识点本体也最完整。
2. 初中物理人教版八上/八下/九全：抽取完整，适合做概念卡和小测。
3. 初中化学人教版九上/九下：抽取完整，适合做错因卡和实验/方程式卡。
4. 初中语文统编版七到九上下：抽取完整，但卡片模板要改成文本理解、字词、文言、作文结构，不能照搬数学。
5. 高中数学人教A版：抽取完整，适合高年级样本，但难度和题型要更克制。

## 输出文件

- 机器可读矩阵：\`${rel(OUT_JSON)}\`
- 人可读矩阵：\`${rel(OUT_MD)}\`
`;

  fs.writeFileSync(OUT_MD, content, 'utf8');
}

const matrix = buildMatrix();
fs.writeFileSync(OUT_JSON, `${JSON.stringify(matrix, null, 2)}\n`, 'utf8');
writeMarkdown(matrix);

console.log(JSON.stringify({
  ok: true,
  json: rel(OUT_JSON),
  markdown: rel(OUT_MD),
  summary: matrix.summary
}, null, 2));
