const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXTRACTED_DIR = path.join(ROOT, 'data', 'extracted');
const MANIFEST_PATH = path.join(EXTRACTED_DIR, 'manifest.json');
const ONTOLOGY_PATH = path.join(ROOT, 'src', 'curriculum', 'cn-k12-knowledge-ontology.json');
const OUT_JSON = path.join(ROOT, 'src', 'curriculum', 'learning-asset-index.json');
const OUT_MD = path.join(ROOT, 'docs', 'TEXTBOOK-KNOWLEDGE-ASSET-INVENTORY.md');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function inc(map, key, count = 1) {
  const k = key || '未标注';
  map[k] = (map[k] || 0) + count;
}

function safeId(parts) {
  return parts.filter(Boolean).join('__').replace(/[\\/:*?"<>|\s]+/g, '_');
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function chapterFile(book, ch) {
  return path.join(EXTRACTED_DIR, book.stage, book.subject, book.edition, book.grade, book.volume, `ch${ch.ch}.json`);
}

function summarizeChapter(book, ch) {
  const file = chapterFile(book, ch);
  const base = {
    ch: ch.ch,
    title: ch.title || '',
    start_page: ch.start_page || null,
    end_page: ch.end_page || null,
    source_file: rel(file),
    found: false,
    section_count: 0,
    page_count: 0,
    text_chars: 0,
    sections: []
  };

  if (!fs.existsSync(file)) return base;

  const data = readJson(file);
  const pages = Array.isArray(data.pages) ? data.pages : [];
  const sections = Array.isArray(data.sections) ? data.sections : [];
  return Object.assign(base, {
    title: data.title || base.title,
    start_page: data.start_page || base.start_page,
    end_page: data.end_page || base.end_page,
    found: true,
    section_count: sections.length,
    page_count: pages.length,
    text_chars: pages.reduce((sum, item) => sum + String(item.text || '').length, 0),
    sections: sections.map((item) => ({
      code: item.code || '',
      title: item.title || '',
      page: item.page || null
    }))
  });
}

function summarizeOntology() {
  if (!fs.existsSync(ONTOLOGY_PATH)) {
    return {
      source_file: rel(ONTOLOGY_PATH),
      found: false,
      subjects: {},
      stats: {
        subjects: 0,
        stages: 0,
        chapters: 0,
        knowledge_points: 0,
        sub_points: 0,
        prerequisites: 0,
        misconceptions: 0
      }
    };
  }

  const ontology = readJson(ONTOLOGY_PATH);
  const subjects = {};
  const stats = {
    subjects: 0,
    stages: 0,
    chapters: 0,
    knowledge_points: 0,
    sub_points: 0,
    prerequisites: 0,
    misconceptions: 0
  };

  for (const [subjectKey, subject] of Object.entries(ontology.subjects || {})) {
    stats.subjects += 1;
    subjects[subjectKey] = {
      name: subject.name || subjectKey,
      primary_publisher: subject.primary_publisher || '',
      stages: {}
    };

    for (const [stageKey, stage] of Object.entries(subject.stages || {})) {
      stats.stages += 1;
      const chapters = (stage.chapters || []).map((chapter) => {
        stats.chapters += 1;
        const knowledgePoints = (chapter.knowledge_points || []).map((kp) => {
          stats.knowledge_points += 1;
          stats.sub_points += (kp.sub || []).length;
          stats.prerequisites += (kp.prerequisites || []).length;
          stats.misconceptions += (kp.frequent_misconceptions || []).length;
          return {
            kp_id: kp.kp_id || '',
            name: kp.name || '',
            sub: kp.sub || [],
            prerequisites: kp.prerequisites || [],
            frequent_misconceptions: kp.frequent_misconceptions || [],
            standard_ref: kp.standard_ref || ''
          };
        });

        return {
          chapter_id: chapter.chapter_id || '',
          name: chapter.name || '',
          textbook_chapter: chapter.textbook_chapter || '',
          standard_ref: chapter.standard_ref || '',
          knowledge_points: knowledgePoints
        };
      });

      subjects[subjectKey].stages[stageKey] = {
        stage_label: stage.stage_label || stageKey,
        chapter_count: chapters.length,
        knowledge_point_count: chapters.reduce((sum, item) => sum + item.knowledge_points.length, 0),
        chapters
      };
    }
  }

  return {
    source_file: rel(ONTOLOGY_PATH),
    found: true,
    version: ontology.version || '',
    generated: ontology.generated || '',
    purpose: ontology.purpose || '',
    stats,
    subjects
  };
}

function buildIndex() {
  const manifest = readJson(MANIFEST_PATH);
  const stats = {
    books: 0,
    chapters: 0,
    extracted_chapters: 0,
    sections: 0,
    pages: 0,
    text_chars: 0,
    missing_chapters: 0,
    by_stage: {},
    by_subject: {},
    by_edition: {},
    by_grade: {}
  };

  const books = (manifest.books || []).map((book) => {
    stats.books += 1;
    inc(stats.by_stage, book.stage);
    inc(stats.by_subject, book.subject);
    inc(stats.by_edition, book.edition);
    inc(stats.by_grade, book.grade);

    const chapters = (book.chapters || []).map((ch) => {
      stats.chapters += 1;
      const summary = summarizeChapter(book, ch);
      if (summary.found) stats.extracted_chapters += 1;
      else stats.missing_chapters += 1;
      stats.sections += summary.section_count;
      stats.pages += summary.page_count;
      stats.text_chars += summary.text_chars;
      return summary;
    });

    return {
      id: safeId([book.stage, book.subject, book.edition, book.grade, book.volume]),
      stage: book.stage || '',
      subject: book.subject || '',
      edition: book.edition || '',
      grade: book.grade || '',
      volume: book.volume || '',
      page_count: book.page_count || 0,
      source_path: book.path || '',
      chapter_count: chapters.length,
      section_count: chapters.reduce((sum, item) => sum + item.section_count, 0),
      text_chars: chapters.reduce((sum, item) => sum + item.text_chars, 0),
      chapters
    };
  });

  return {
    generated_at: new Date().toISOString(),
    source_manifest: rel(MANIFEST_PATH),
    source: manifest.source || '',
    purpose: 'Lightweight index of extracted textbook chapters plus K12 knowledge ontology for study-pack generation, chapter recall, and misconception repair.',
    stats,
    books,
    ontology: summarizeOntology()
  };
}

function sortedEntries(obj) {
  return Object.entries(obj || {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hans-CN'));
}

function table(entries, headers) {
  const lines = [];
  lines.push(`| ${headers.join(' |')} |`);
  lines.push(`| ${headers.map(() => '---').join(' |')} |`);
  for (const row of entries) lines.push(`| ${row.join(' |')} |`);
  return lines.join('\n');
}

function writeMarkdown(index) {
  const s = index.stats;
  const o = index.ontology.stats || {};
  const math = index.ontology.subjects && index.ontology.subjects.math;
  const sampleStages = math ? Object.entries(math.stages).slice(0, 3).map(([key, stage]) => {
    const first = stage.chapters[0];
    return `- ${stage.stage_label}：${stage.chapter_count} 章，${stage.knowledge_point_count} 个知识点；首章「${first ? first.name : '无'}」`;
  }) : ['- 暂无可用知识点本体'];

  const strongestSubjects = sortedEntries(s.by_subject).map(([name, count]) => [name, String(count)]);
  const strongestGrades = sortedEntries(s.by_grade).map(([name, count]) => [name, String(count)]);
  const sampleBooks = index.books.slice(0, 12).map((book) => [
    book.stage,
    book.subject,
    book.edition,
    book.grade,
    book.volume,
    String(book.chapter_count),
    String(book.section_count)
  ]);

  const content = `# 教材与知识点资产盘点

生成时间：${index.generated_at}

## 结论

仓库里已经沉淀了一套可以支撑「真实学习材料 -> AI 生成回忆卡/小测 -> 5 分钟闯关 -> 错因修复」的教材底座。

核心资产分两层：

- 教材章节层：来自 \`${index.source_manifest}\`，覆盖 ${s.books} 本书、${s.chapters} 个章节、${s.sections} 个小节、${s.pages} 页抽取文本。
- 知识点本体层：来自 \`${index.ontology.source_file}\`，目前主要覆盖数学，包含 ${o.chapters || 0} 章、${o.knowledge_points || 0} 个知识点、${o.sub_points || 0} 个子知识点、${o.misconceptions || 0} 个高频误区、${o.prerequisites || 0} 条先修依赖。

## 教材覆盖

### 按学科

${table(strongestSubjects, ['学科', '书本数'])}

### 按年级

${table(strongestGrades, ['年级', '书本数'])}

### 抽样书目

${table(sampleBooks, ['学段', '学科', '版本', '年级', '册', '章节数', '小节数'])}

## 数学知识点本体

${sampleStages.join('\n')}

## 小程序可用方式

1. 用户录入“八上三角形不会”时，先用章节索引召回「初中/数学/人教版/八年级/上册/第十一章 三角形」。
2. 再用知识点本体定位到具体知识点，比如三角形的边、高/中线/角平分线、内角、外角、多边形内角和。
3. 生成回忆卡时优先用“概念定义、判断条件、易错点、一步小题”四类卡。
4. 答错后不要只给答案，要落到错因：概念不清、条件漏看、图形关系混淆、计算/符号错误。
5. 家长页只展示“孩子在哪个知识点卡住、下一步练什么、是否能说清错因”。

## 接入建议

- 首页任务规划：用章节索引把用户输入映射到教材章节，避免泛泛而谈。
- 学习包生成：从章节文本生成候选卡片，再用知识点本体过滤成可测的知识点。
- 复习闯关：用先修依赖控制难度，先修没过不要直接上综合题。
- 错因修复：优先使用 \`frequent_misconceptions\`，没有本体覆盖的学科再从答题记录归纳。
- 100 人体验：第一批建议聚焦初中数学，因为它的知识点、依赖和误区最完整。

## 缺口

- 教材章节层覆盖多学科，但知识点本体目前主要是数学。
- 部分章节抽取文本很短，需要后续做质量过滤。
- 英语、语文等学科需要不同卡片模板，不能照搬数学的“定义/公式/步骤”结构。
- 如果要做 Gizmo 式多格式导入，仍需要 OCR/PDF/图片链路；当前资产更适合“教材章节召回 + 手动材料生成”。

## 输出文件

- 机器可读索引：\`${rel(OUT_JSON)}\`
- 人可读盘点：\`${rel(OUT_MD)}\`
`;

  fs.writeFileSync(OUT_MD, content, 'utf8');
}

const index = buildIndex();
fs.writeFileSync(OUT_JSON, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
writeMarkdown(index);

console.log(JSON.stringify({
  ok: true,
  json: rel(OUT_JSON),
  markdown: rel(OUT_MD),
  stats: index.stats,
  ontology: index.ontology.stats
}, null, 2));
