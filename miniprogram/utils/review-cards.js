const storage = require('./storage');
const gameLogic = require('./game-logic');

const DAY = 24 * 60 * 60 * 1000;
const RATING = { again: 1, hard: 2, good: 3, easy: 4 };
const FSRS_STATE_VERSION = 2;
const FSRS_W = [
  0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0234,
  1.616, 0.1544, 1.0824, 1.9813, 0.0953, 0.2975, 2.2042, 0.2407, 2.9466
];
const FSRS_DECAY = -0.5;
const FSRS_FACTOR = 19 / 81;
const CONTENT_ENGINE_PROVIDERS = {
  local: 'rule_content_engine_v2',
  remote: 'remote_ai_content_engine_v1'
};
const WRONG_QUESTION_RE = /错题|订正|错因|卡住|不会|总错|做错|漏|粗心|单位|条件|等量关系|建模|符号|公式|审题/;
const WRONG_CAUSE_BUCKETS = {
  reading_conditions: {
    label: '审题条件',
    match: /审题|读题|题目问|条件|已知|关键词|问号|单位|漏看|看错/,
    checkpoint: '先圈题目问什么、已知条件和单位。',
    parentPrompt: '你第一步圈了哪些条件？',
    practice: '做 1 道同类题，只圈条件和问题句，不急着算。'
  },
  modeling_relation: {
    label: '关系建模',
    match: /等量|关系|建模|列式|方程|未知数|数量关系|单位1|比例/,
    checkpoint: '先写出两个量之间的关系，再列式。',
    parentPrompt: '你找了哪两个量之间的关系？',
    practice: '把题目里的两个关键量写成一句关系话。'
  },
  calculation_check: {
    label: '计算检查',
    match: /计算|口算|粗心|符号|进位|退位|小数点|约分|通分|检查/,
    checkpoint: '先复算关键一步，再查符号和单位。',
    parentPrompt: '你准备先检查哪一步计算？',
    practice: '只复算上次错的那一步，再做 2 个同类小练。'
  },
  concept_gap: {
    label: '概念断点',
    match: /概念|定义|公式|原理|不会|不懂|混淆|知识点|规则/,
    checkpoint: '先用自己的话说定义，再举一个小例子。',
    parentPrompt: '这个概念你能用自己的话说一遍吗？',
    practice: '先复述概念，再用一个最小例子检查。'
  },
  expression_planning: {
    label: '表达组织',
    match: /作文|写作|开头|结尾|提纲|句子|表达|论述|阅读理解|概括/,
    checkpoint: '先写一句主干，再补理由或例子。',
    parentPrompt: '你写的第一句是什么？',
    practice: '只写开头一句和两个要点，不追求整篇。'
  },
  habit_focus: {
    label: '习惯专注',
    match: /专注|分心|拖拉|作业慢|坐不住|时间|疲劳|睡眠|情绪|焦虑/,
    checkpoint: '先把任务缩到 15 分钟内的一小步。',
    parentPrompt: '这 15 分钟你只做哪一小步？',
    practice: '开一段静默专注，只完成一个可见动作。'
  },
  first_step: {
    label: '第一步确认',
    match: /第一步|先做|开始|卡住|没思路/,
    checkpoint: '先说自己准备从哪里开始。',
    parentPrompt: '你第一步先做了什么？',
    practice: '把第一步写成一句话，再进入专注。'
  }
};
const DEFAULT_DECK = {
  id: 'ydzx-core',
  name: '原点错因复习',
  desiredRetention: 0.9,
  dailyLimit: 5,
  fsrsVersion: FSRS_STATE_VERSION,
  contentEngineProvider: CONTENT_ENGINE_PROVIDERS.local
};

function nowIso(date = new Date()) {
  return date.toISOString();
}

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function addDays(days, date = new Date()) {
  return new Date(date.getTime() + days * DAY).toISOString();
}

function normalizeText(text, max = 56) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function classifyWrongCause(input = {}) {
  const text = typeof input === 'string'
    ? input
    : [
        input.wrongCauseBucket,
        input.weakPoint,
        input.calibrationKey,
        input.question,
        input.answer,
        input.context,
        input.type,
        input.subject
      ].join(' ');
  const explicit = input && input.wrongCauseBucket && WRONG_CAUSE_BUCKETS[input.wrongCauseBucket]
    ? input.wrongCauseBucket
    : '';
  const key = explicit || Object.keys(WRONG_CAUSE_BUCKETS).find((id) => WRONG_CAUSE_BUCKETS[id].match.test(String(text || ''))) || 'first_step';
  return Object.assign({ id: key }, WRONG_CAUSE_BUCKETS[key]);
}

function buildNextPracticePlan(input = {}) {
  const cause = classifyWrongCause(input);
  const subject = input.subject ? `${input.subject} · ` : '';
  const source = normalizeText(input.question || input.weakPoint || input.context || '这类卡点', 36);
  return {
    wrongCauseBucket: cause.id,
    wrongCauseLabel: cause.label,
    checkpoint: cause.checkpoint,
    parentPrompt: cause.parentPrompt,
    nextPracticeText: `${subject}${source}：${cause.practice}`,
    appRoute: cause.id === 'habit_focus'
      ? '/pages/entry-detail/entry-detail?scene=today'
      : cause.id === 'expression_planning'
        ? '/pages/tutor/tutor'
        : '/pages/review/review'
  };
}

function stableId(prefix, parts) {
  return `${prefix}_${parts.filter(Boolean).join('_')}`.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5:-]/g, '_');
}

function scoreQuality(fields) {
  const text = [fields.question, fields.answer, fields.weakPoint, fields.calibrationKey].join(' ');
  let score = 42;
  if (fields.question && fields.question.length >= 12) score += 14;
  if (fields.answer && fields.answer.length >= 10) score += 14;
  if (fields.context) score += 6;
  if (fields.answer && fields.answer.length >= 4) score += 8;
  if (fields.weakPoint) score += 10;
  if (fields.calibrationKey) score += 8;
  if (/错|卡|弱|检查|第一步|复盘|条件|建模/.test(text)) score += 12;
  return Math.max(0, Math.min(100, score));
}

function normalizeSourceMaterialType(source = '') {
  const value = String(source || '').toLowerCase();
  if (/wechat|公众号/.test(value)) return 'wechat_article';
  if (/web|url|link|网页|链接/.test(value)) return 'web_article';
  if (/pdf|讲义|教材/.test(value)) return 'pdf_excerpt';
  if (/wrong|错题|wrongbook/.test(value)) return 'wrong_question';
  if (/photo|image|照片/.test(value)) return 'photo_note';
  if (/manual|note|摘录|笔记/.test(value)) return 'manual_notes';
  return value || 'manual_notes';
}

function buildImportMemoryMetadata(source, fields = {}, meta = {}) {
  const sourceMaterialType = meta.sourceMaterialType || normalizeSourceMaterialType(source || meta.source || '');
  const cause = meta.wrongCauseBucket || fields.wrongCauseBucket || buildNextPracticePlan(Object.assign({}, fields, meta)).wrongCauseBucket;
  const isTrapOrWrong = /wrong|trap|错|卡|弱|不会|易错/.test([
    sourceMaterialType,
    fields.question,
    fields.answer,
    fields.weakPoint,
    fields.calibrationKey,
    cause
  ].join(' '));
  const nextRevisitWindow = isTrapOrWrong
    ? '今晚 90 秒主动回忆，明天换条件回访，第 7 天只查同一错因。'
    : '今晚说出第一步，明天回访一张同源卡，第 7 天做一次迁移。';
  return {
    sourceMaterialType,
    wrongCauseBucket: cause,
    highFrequency: {
      mode: isTrapOrWrong ? 'wrong_cause_replay' : 'active_recall',
      dailyCap: isTrapOrWrong ? 3 : 2,
      releaseGate: '先说第一步，再看答案；不奖励速度、分数或排名。',
      reviewRoute: '/pages/review/review?from=material_memory',
      arcadeRoute: '/pages/arcade/arcade?from=material_memory'
    },
    nextRevisitWindow,
    memoryEvidenceLine: `${sourceMaterialType} -> 第一步 -> 错因 -> 主动回忆 -> 明天回访`
  };
}

function makeNote(id, type, source, fields, meta = {}) {
  const practicePlan = buildNextPracticePlan(Object.assign({}, fields || {}, meta || {}, { type, source }));
  const memoryMeta = buildImportMemoryMetadata(source, fields, Object.assign({}, meta, { wrongCauseBucket: meta.wrongCauseBucket || fields.wrongCauseBucket || practicePlan.wrongCauseBucket }));
  const note = {
    id,
    type,
    source,
    deckId: meta.deckId || DEFAULT_DECK.id,
    subject: meta.subject || '',
    weakPoint: meta.weakPoint || fields.weakPoint || '',
    calibrationKey: meta.calibrationKey || fields.calibrationKey || '',
    wrongCauseBucket: meta.wrongCauseBucket || fields.wrongCauseBucket || practicePlan.wrongCauseBucket,
    wrongCauseLabel: meta.wrongCauseLabel || fields.wrongCauseLabel || practicePlan.wrongCauseLabel,
    nextPracticePlan: meta.nextPracticePlan || fields.nextPracticePlan || practicePlan,
    checkpoint: meta.checkpoint || fields.checkpoint || practicePlan.checkpoint,
    parentPrompt: meta.parentPrompt || fields.parentPrompt || practicePlan.parentPrompt,
    reportId: meta.reportId || fields.reportId || '',
    sourceSchemaId: meta.sourceSchemaId || fields.sourceSchemaId || '',
    reportSourceId: meta.reportSourceId || fields.reportSourceId || '',
    uploadMaterialType: meta.uploadMaterialType || fields.uploadMaterialType || '',
    requiredNextEvidence: meta.requiredNextEvidence || fields.requiredNextEvidence || [],
    sourceMaterialType: meta.sourceMaterialType || memoryMeta.sourceMaterialType,
    highFrequency: meta.highFrequency || memoryMeta.highFrequency,
    nextRevisitWindow: meta.nextRevisitWindow || memoryMeta.nextRevisitWindow,
    memoryEvidenceLine: meta.memoryEvidenceLine || memoryMeta.memoryEvidenceLine,
    fields: {
      question: fields.question || '',
      answer: fields.answer || '',
      context: fields.context || '',
      evidence: fields.evidence || ''
    },
    quality: scoreQuality(fields),
    created_at: nowIso()
  };
  return note;
}

function makeCard(note, template = 'qa') {
  return {
    id: stableId('card', [note.id, template]),
    noteId: note.id,
    deckId: note.deckId,
    template,
    type: note.type,
    source: note.source,
    question: note.fields.question,
    answer: note.fields.answer,
    subject: note.subject,
    weakPoint: note.weakPoint,
    calibrationKey: note.calibrationKey,
    wrongCauseBucket: note.wrongCauseBucket,
    wrongCauseLabel: note.wrongCauseLabel,
    nextPracticePlan: note.nextPracticePlan,
    checkpoint: note.checkpoint,
    parentPrompt: note.parentPrompt,
    reportId: note.reportId,
    sourceSchemaId: note.sourceSchemaId,
    reportSourceId: note.reportSourceId,
    uploadMaterialType: note.uploadMaterialType,
    requiredNextEvidence: note.requiredNextEvidence,
    sourceMaterialType: note.sourceMaterialType,
    highFrequency: note.highFrequency,
    nextRevisitWindow: note.nextRevisitWindow,
    memoryEvidenceLine: note.memoryEvidenceLine,
    recallEvidence: {
      student_first_step: true,
      wrong_cause_named: true,
      next_day_revisit_locked: true,
      source: note.source || 'review_card'
    },
    quality: note.quality,
    stability: 0,
    difficulty: 5,
    retrievability: 0,
    elapsed_days: 0,
    fsrs_state_version: FSRS_STATE_VERSION,
    interval: 0,
    reps: 0,
    lapses: 0,
    state: 'new',
    suspended: false,
    leech: false,
    due: nowIso(),
    created_at: nowIso()
  };
}

function reversePrompt(text) {
  const value = String(text || '').trim();
  if (!value) return '';
  return `根据这条提示，说出原知识点或原题意：${normalizeText(value, 42)}`;
}

function noteCardTemplates(note) {
  const base = [makeCard(note, 'qa')];
  if (!note || !note.fields) return base;
  const answer = String(note.fields.answer || '').trim();
  const question = String(note.fields.question || '').trim();
  const context = String(note.fields.context || '').trim();
  if (note.type === 'cloze') {
    if (context) {
      base.push(Object.assign({}, makeCard(note, 'cloze_context'), {
        question: `填空上下文来自哪道内容：${normalizeText(context, 34)}`,
        answer,
        state: 'new',
        due: nowIso()
      }));
    }
    return base;
  }
  if (answer && answer.length >= 8) {
    base.push(Object.assign({}, makeCard(note, 'reverse'), {
      question: reversePrompt(answer),
      answer: question || answer,
      state: 'new',
      due: nowIso()
    }));
  }
  if (context && context !== answer && context.length >= 8) {
    base.push(Object.assign({}, makeCard(note, 'context'), {
      question: `这张卡对应的原场景是什么：${normalizeText(question || context, 30)}`,
      answer: normalizeText(context, 80),
      state: 'new',
      due: nowIso()
    }));
  }
  return base.slice(0, 3);
}

function cardsFromNotes(notes, limit = 220) {
  return (notes || [])
    .flatMap((note) => noteCardTemplates(note))
    .slice(0, limit);
}

function generatedFromState(state) {
  const notes = [];
  const subject = state.subject || '';
  const weakPoints = state.weak_points || [];
  const plan = state.homework_plan || {};

  weakPoints.slice(0, 4).forEach((weak) => {
    notes.push(makeNote(
      stableId('note_weak', [weak.key || weak.name]),
      'weak_point',
      'radar',
      {
        question: `这个卡点今天先检查什么：${weak.name}`,
        answer: weak.reason || '先说清卡点，再进入题目。',
        weakPoint: weak.name,
        evidence: `score:${weak.score || ''}`
      },
      { subject, weakPoint: weak.name }
    ));
  });

  (plan.must_do || []).slice(0, 6).forEach((item, index) => {
    const evidence = item.evidence || {};
    const weak = evidence.weak_point || {};
    const baseMeta = {
      subject,
      weakPoint: weak.name || '',
      calibrationKey: evidence.calibration_key || ''
    };
    notes.push(makeNote(
      stableId('note_step', [item.id || index]),
      'first_step',
      'homework_plan',
      {
        question: `遇到这类任务，第一步是什么：${normalizeText(item.text)}`,
        answer: evidence.decision || item.reason || '先读题、找条件，再写第一步。',
        context: item.text || '',
        weakPoint: weak.name || '',
        calibrationKey: evidence.calibration_key || ''
      },
      baseMeta
    ));

    (evidence.misconception_tags || []).slice(0, 3).forEach((tag, tagIndex) => {
      notes.push(makeNote(
        stableId('note_mis', [item.id || index, tag.id || tagIndex]),
        'misconception',
        'homework_plan',
        {
          question: `上次这类题容易错在哪里：${normalizeText(item.text)}`,
          answer: tag.name || tag.label || tag.axis || '审题、建模、计算或表达中的一个环节。',
          context: item.text || '',
          weakPoint: weak.name || tag.axis || '',
          calibrationKey: evidence.calibration_key || ''
        },
        baseMeta
      ));
    });
  });

  return notes;
}

function generatedFromTutorSignals() {
  return storage.loadTutorEvents().slice(0, 12).filter((event) => event.selected_text).map((event, index) => {
    const isBlocked = event.blocked || event.mastery_status === 'blocked_answer_request';
    return makeNote(
      stableId('note_tutor', [event.created_at || index, event.selected_id || index]),
      isBlocked ? 'answer_boundary' : 'mastery_signal',
      'tutor',
      {
        question: isBlocked
          ? `这类题为什么不能直接要答案：${normalizeText(event.selected_text)}`
          : `复盘一句话：${normalizeText(event.selected_text)}`,
        answer: isBlocked
          ? '先写自己的第一步或卡点，作业点拨只给最小提示。'
          : '说清本题错因和下次先检查哪一步。',
        context: event.selected_text,
        weakPoint: storage.formatInternalLabel ? storage.formatInternalLabel(event.mastery_status, '先说第一步') : '',
        calibrationKey: storage.formatSourceLabel ? storage.formatSourceLabel(event.source, '作业点拨') : ''
      },
      { calibrationKey: storage.formatSourceLabel ? storage.formatSourceLabel(event.source, '作业点拨') : '' }
    );
  });
}

function generatedFromThinkingReceipts() {
  const receipts = storage.loadThinkingReceipts ? storage.loadThinkingReceipts() : [];
  return receipts.slice(0, 24).filter((receipt) => receipt && (receipt.focus || receipt.shareLine)).map((receipt, index) => {
    const checks = Array.isArray(receipt.checks) ? receipt.checks : [];
    const missing = checks.filter((check) => !check.done).map((check) => check.label).filter(Boolean);
    const done = checks.filter((check) => check.done).map((check) => check.label).filter(Boolean);
    const answer = receipt.status === 'answer shortcut blocked'
      ? '先写自己的第一步或卡点；作业点拨只能给最小提示，不能代写答案。'
      : (receipt.shareLine || `复述本题错因，并说明下次先检查哪一步。`);
    return makeNote(
      stableId('note_thinking', [receipt.id || receipt.created_at || index]),
      'thinking_proof',
      'thinking_receipt',
      {
        question: `这次辅导留下的思考证明是什么：${normalizeText(receipt.focus || receipt.selected_text || '今晚必须做任务')}`,
        answer,
        context: missing.length
          ? `还要补：${missing.join('、')}`
          : `已完成：${done.join('、') || 'student first thought / wrong cause / safe help / proof sentence'}`,
        weakPoint: storage.formatInternalLabel ? storage.formatInternalLabel(receipt.mastery_status || receipt.status, '思路记录') : (receipt.status || ''),
        calibrationKey: storage.formatInternalLabel ? storage.formatInternalLabel(receipt.coach_step || receipt.source, '作业点拨') : ''
      },
      { calibrationKey: storage.formatInternalLabel ? storage.formatInternalLabel(receipt.coach_step || receipt.source, '作业点拨') : '' }
    );
  });
}

function generatedFromModules() {
  return storage.loadModuleEvents().slice(0, 12).filter((event) => event.module_title).map((event, index) => {
    return makeNote(
      stableId('note_module', [event.module_id || index]),
      'module_review',
      'module',
      {
        question: `这个学习模块要掌握什么：${event.module_title}`,
        answer: event.type ? `用 ${event.type} 方法复盘一次，并说出完成证据。` : '说出这次练习的卡点和完成证据。',
        context: event.module_title,
        calibrationKey: event.module_id ? `module:${event.module_id}` : ''
      },
      { subject: event.subject || '', calibrationKey: event.module_id ? `module:${event.module_id}` : '' }
    );
  });
}

function mergeById(existing, generated) {
  const map = {};
  generated.concat(existing).forEach((item) => {
    if (!item || !item.id) return;
    map[item.id] = Object.assign({}, map[item.id] || {}, item);
  });
  return Object.keys(map).map((key) => map[key]);
}

function persistReviewState(deck, notes, cards) {
  storage.saveReviewDeck(deck);
  storage.saveReviewNotes(notes);
  storage.saveReviewCards(cards);
  return { deck, notes, cards };
}

function ensureReviewDeck() {
  const deck = storage.loadReviewDeck() || DEFAULT_DECK;
  const mergedDeck = Object.assign({}, DEFAULT_DECK, deck);
  const existingNotes = storage.loadReviewNotes();
  const generatedNotes = generatedFromState(storage.loadState()).concat(generatedFromTutorSignals(), generatedFromThinkingReceipts(), generatedFromModules());
  const notes = mergeById(existingNotes, generatedNotes).slice(0, 160);
  const existingCards = storage.loadReviewCards();
  const generatedCards = cardsFromNotes(notes, 260);
  const cards = mergeById(existingCards, generatedCards).slice(0, 260);
  return persistReviewState(mergedDeck, notes, cards);
}

function retrievability(card, date = new Date()) {
  if (!card.last_reviewed_at || !card.stability) return 0;
  const elapsed = Math.max(0, (date.getTime() - new Date(card.last_reviewed_at).getTime()) / DAY);
  return Number(Math.pow(1 + FSRS_FACTOR * elapsed / Math.max(0.1, Number(card.stability || 1)), FSRS_DECAY).toFixed(3));
}

function elapsedDays(card, date = new Date()) {
  if (!card.last_reviewed_at) return 0;
  return Math.max(0, Math.round((date.getTime() - new Date(card.last_reviewed_at).getTime()) / DAY));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function fsrsInitStability(value) {
  return clamp(FSRS_W[value - 1] || FSRS_W[2], 0.1, 365);
}

function fsrsInitDifficulty(value) {
  return clamp(FSRS_W[4] - Math.exp(FSRS_W[5] * (value - 1)) + 1, 1, 10);
}

function fsrsNextDifficulty(difficulty, value) {
  const target = difficulty - FSRS_W[6] * (value - 3);
  return clamp(FSRS_W[7] * fsrsInitDifficulty(RATING.easy) + (1 - FSRS_W[7]) * target, 1, 10);
}

function fsrsNextRecallStability(difficulty, stability, retention, value) {
  const hardPenalty = value === RATING.hard ? FSRS_W[15] : 1;
  const easyBonus = value === RATING.easy ? FSRS_W[16] : 1;
  const alpha = Math.exp(FSRS_W[8])
    * (11 - difficulty)
    * Math.pow(stability, -FSRS_W[9])
    * (Math.exp((1 - retention) * FSRS_W[10]) - 1);
  return clamp(stability * (1 + alpha * hardPenalty * easyBonus), 0.1, 36500);
}

function fsrsNextForgetStability(difficulty, stability, retention) {
  const lapse = FSRS_W[11]
    * Math.pow(difficulty, -FSRS_W[12])
    * (Math.pow(stability + 1, FSRS_W[13]) - 1)
    * Math.exp(FSRS_W[14] * (1 - retention));
  return clamp(lapse, 0.1, 36500);
}

function intervalFromStability(stability, desiredRetention) {
  const target = clamp(Number(desiredRetention || DEFAULT_DECK.desiredRetention), 0.75, 0.97);
  const interval = (stability / FSRS_FACTOR) * (Math.pow(target, 1 / FSRS_DECAY) - 1);
  return Math.round(clamp(interval, 0.5, 36500));
}

function schedule(card, rating, date = new Date(), deck = DEFAULT_DECK) {
  const value = RATING[rating] || RATING.good;
  const oldStability = Number(card.stability || 0);
  const oldDifficulty = clamp(Number(card.difficulty || 0), 1, 10);
  const elapsed = elapsedDays(card, date);
  const beforeReviewRetrievability = card.last_reviewed_at ? retrievability(card, date) : 1;
  const reps = Number(card.reps || 0) + 1;
  const lapses = Number(card.lapses || 0) + (value === RATING.again ? 1 : 0);
  const qualityFactor = clamp(Number(card.quality || 70) / 80, 0.85, 1.15);
  const previousStability = oldStability > 0 ? oldStability : fsrsInitStability(value);
  const previousDifficulty = oldDifficulty || fsrsInitDifficulty(value);
  const difficulty = Number(fsrsNextDifficulty(previousDifficulty, value).toFixed(3));
  const fsrsStability = value === RATING.again
    ? fsrsNextForgetStability(previousDifficulty, previousStability, beforeReviewRetrievability)
    : fsrsNextRecallStability(previousDifficulty, previousStability, beforeReviewRetrievability, value);
  const stability = Number(clamp(fsrsStability * qualityFactor, 0.1, 36500).toFixed(3));
  const adjustedInterval = value === RATING.again ? 1 : Math.max(1, intervalFromStability(stability, deck.desiredRetention));
  return Object.assign({}, card, {
    stability,
    difficulty,
    interval: adjustedInterval,
    reps,
    lapses,
    state: value === RATING.again ? 'relearning' : 'review',
    leech: lapses >= 2,
    elapsed_days: elapsed,
    fsrs_state_version: FSRS_STATE_VERSION,
    retrievability_before_review: beforeReviewRetrievability,
    last_rating: rating,
    last_reviewed_at: nowIso(date),
    due: addDays(adjustedInterval, date),
    retrievability: retrievability(Object.assign({}, card, { stability, last_reviewed_at: nowIso(date) }), date)
  });
}

function dueCards(limit) {
  const { deck, cards } = ensureReviewDeck();
  const now = Date.now();
  return cards
    .filter((item) => !item.suspended)
    .filter((item) => !item.buried_until || new Date(item.buried_until).getTime() <= now)
    .filter((item) => !item.due || new Date(item.due).getTime() <= now)
    .sort((a, b) => {
      if (!!b.leech !== !!a.leech) return b.leech ? 1 : -1;
      return new Date(a.due || 0).getTime() - new Date(b.due || 0).getTime();
    })
    .slice(0, limit || deck.dailyLimit || DEFAULT_DECK.dailyLimit);
}

function sessionCards(mode = 'smart', limit) {
  const { deck, cards } = ensureReviewDeck();
  const size = Math.max(1, Math.min(30, Number(limit || deck.dailyLimit || DEFAULT_DECK.dailyLimit)));
  const now = Date.now();
  const active = cards.filter((card) => !card.suspended && (!card.buried_until || new Date(card.buried_until).getTime() <= now));
  const due = active.filter((card) => !card.due || new Date(card.due).getTime() <= now);
  const leeches = active.filter((card) => card.leech || Number(card.lapses || 0) >= 2);
  const weak = active.filter((card) => card.weakPoint || card.calibrationKey);
  const fresh = active.filter((card) => card.state === 'new');
  const reverse = active.filter((card) => card.template === 'reverse');
  const cloze = active.filter((card) => card.type === 'cloze' || card.template === 'cloze_context');
  const source = mode === 'leech'
    ? leeches
    : mode === 'weak'
      ? weak
      : mode === 'reverse'
        ? reverse
        : mode === 'cloze'
          ? cloze
          : mode === 'new'
            ? fresh
            : due.concat(leeches, weak, fresh);
  return mergeById([], source)
    .sort((a, b) => {
      if (!!b.leech !== !!a.leech) return b.leech ? 1 : -1;
      if ((a.state === 'new') !== (b.state === 'new')) return a.state === 'new' ? 1 : -1;
      return new Date(a.due || a.created_at || 0).getTime() - new Date(b.due || b.created_at || 0).getTime();
    })
    .slice(0, size);
}

function suspendedCards(limit = 12) {
  return ensureReviewDeck().cards
    .filter((item) => !!item.suspended)
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, limit);
}

function buriedCards(limit = 12) {
  const now = Date.now();
  return ensureReviewDeck().cards
    .filter((item) => item.buried_until && new Date(item.buried_until).getTime() > now)
    .sort((a, b) => new Date(a.buried_until || 0).getTime() - new Date(b.buried_until || 0).getTime())
    .slice(0, limit);
}

function cardBrowser(options = {}) {
  const { cards } = ensureReviewDeck();
  const query = String(options.query || '').trim().toLowerCase();
  const status = options.status || 'all';
  const source = options.source || 'all';
  const type = options.type || 'all';
  const template = options.template || 'all';
  const limit = Math.max(1, Math.min(80, Number(options.limit || 20)));
  return cards
    .filter((card) => {
      if (status === 'due') return !card.suspended && (!card.due || new Date(card.due).getTime() <= Date.now());
      if (status === 'new') return card.state === 'new' && !card.suspended;
      if (status === 'leech') return !!card.leech || Number(card.lapses || 0) >= 2;
      if (status === 'suspended') return !!card.suspended;
      if (status === 'buried') return !!card.buried_until && new Date(card.buried_until).getTime() > Date.now();
      if (status === 'mastered') return Number(card.interval || 0) >= 7 && Number(card.lapses || 0) === 0;
      return true;
    })
    .filter((card) => source === 'all' || card.source === source)
    .filter((card) => type === 'all' || card.type === type)
    .filter((card) => template === 'all' || (card.template || 'qa') === template)
    .filter((card) => {
      if (!query) return true;
      return [
        card.question,
        card.answer,
        card.subject,
        card.weakPoint,
        card.source,
        card.type
      ].join(' ').toLowerCase().indexOf(query) >= 0;
    })
    .sort((a, b) => {
      if (!!b.leech !== !!a.leech) return b.leech ? 1 : -1;
      if (!!a.suspended !== !!b.suspended) return a.suspended ? 1 : -1;
      return new Date(a.due || a.created_at || 0).getTime() - new Date(b.due || b.created_at || 0).getTime();
    })
    .slice(0, limit);
}

function cardByNote(noteId) {
  if (!noteId) return null;
  return ensureReviewDeck().cards.find((card) => card.noteId === noteId) || null;
}

function parseImportedText(rawText, subject = '') {
  return String(rawText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 24)
    .map((line, index) => {
      const pair = line.split(/[:：]/);
      if (pair.length >= 2) {
        const question = normalizeText(pair.shift());
        const answer = pair.join('：').trim();
        return {
          id: stableId('import', [subject || '通用', index]),
          question: `${question} 是什么？`,
          answer,
          context: line
        };
      }
      const arrow = line.split(/\s*(?:->|=>|→)\s*/);
      if (arrow.length >= 2) {
        return {
          id: stableId('import', [subject || '通用', index]),
          question: normalizeText(arrow[0]),
          answer: arrow.slice(1).join(' -> ').trim(),
          context: line
        };
      }
      return {
        id: stableId('import', [subject || '通用', index]),
        question: `用自己的话复述：${normalizeText(line, 40)}`,
        answer: line,
        context: line
      };
    });
}

function uniqueByQuestion(items) {
  const seen = {};
  return (items || []).filter((item) => {
    const key = String(item.question || '').trim().toLowerCase();
    if (!key) return false;
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function canonicalQuestion(text) {
  return String(text || '')
    .replace(/\s+/g, '')
    .replace(/[：:？?！!，,。.\-]/g, '')
    .toLowerCase();
}

function hasDuplicateNote(notes, item) {
  const target = canonicalQuestion(item.question);
  return (notes || []).some((note) => canonicalQuestion(note.fields && note.fields.question) === target);
}

function buildConceptCard(base, subject, index) {
  return {
    id: stableId('import_concept', [subject || 'general', index, base.question.slice(0, 12)]),
    question: base.question,
    answer: base.answer,
    context: base.context,
    cardType: 'concept'
  };
}

function buildStepCardCurrent(base, subject, index) {
  if (!/先|再|然后|步骤|第一|第二|最后/.test(base.answer + ' ' + base.context)) return null;
  return {
    id: stableId('import_step', [subject || 'general', index, base.question.slice(0, 12)]),
    question: `这类题第一步先做什么：${normalizeText(base.question, 30)}`,
    answer: base.answer,
    context: base.context,
    cardType: 'step'
  };
}

function buildTrapCardCurrent(base, subject, index) {
  if (!/错|不要|易|混|单位|符号|审题/.test(base.answer + ' ' + base.context)) return null;
  return {
    id: stableId('import_trap', [subject || 'general', index, base.question.slice(0, 12)]),
    question: `这类内容最容易错在哪里：${normalizeText(base.question, 28)}`,
    answer: base.answer,
    context: base.context,
    cardType: 'trap'
  };
}

function buildClozeCardCurrent(base, subject, index) {
  const text = String(base.answer || base.context || '').trim();
  const candidates = text.match(/[\u4e00-\u9fa5A-Za-z0-9]{2,12}/g) || [];
  const keyword = candidates[0];
  if (!keyword || text.length < 4) return null;
  return {
    id: stableId('import_cloze', [subject || 'general', index, keyword]),
    question: `${normalizeText(text.replace(keyword, '____'), 42)}`,
    answer: keyword,
    context: base.context,
    cardType: 'cloze'
  };
}

function splitSteps(text) {
  return String(text || '')
    .split(/(?:[；;。.\n]|(?:\d+[).、])|先|然后|再|最后|第一|第二|第三)/)
    .map((item) => item.replace(/^[：:，,、\s]+/, '').trim())
    .filter((item) => item.length >= 2)
    .slice(0, 4);
}

function detectTrap(text) {
  const value = String(text || '');
  const patterns = [
    { re: /单位|量纲|米|厘米|千克|克|分钟|小时/, trap: '单位没有统一就开始计算' },
    { re: /符号|正负|方向|大于|小于|不等号/, trap: '符号或方向看反' },
    { re: /审题|条件|已知|未知|关系/, trap: '条件没有圈全就开始建模' },
    { re: /约分|通分|分母|分子|小数|百分数/, trap: '运算前没有先化简或统一形式' },
    { re: /定义|概念|性质|公式/, trap: '把定义、性质和公式混用' }
  ];
  const hit = patterns.find((item) => item.re.test(value));
  return hit ? hit.trap : '';
}

function keywordScore(token, text) {
  const value = String(token || '');
  if (!value || value.length < 2) return -1;
  if (/^(先|再|然后|最后|不要|应该|进行|这个|那个|因为|所以)$/.test(value)) return -1;
  let score = value.length;
  if (/关系|单位|公式|条件|定义|错因|步骤|模型|约分|通分|未知|已知/.test(value)) score += 12;
  if ((String(text || '').match(new RegExp(value, 'g')) || []).length > 1) score += 3;
  if (/^[A-Za-z0-9]+$/.test(value)) score += 2;
  return score;
}

function selectClozeKeyword(text) {
  const value = String(text || '').trim();
  const candidates = value.match(/[\u4e00-\u9fa5A-Za-z0-9]{2,12}/g) || [];
  return candidates
    .map((token) => ({ token, score: keywordScore(token, value) }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score || b.token.length - a.token.length)[0];
}

function buildStepCard(base, subject, index) {
  const text = `${base.answer} ${base.context}`;
  const steps = splitSteps(text);
  if (!steps.length && !/先|步骤|第一|第二|然后|最后/.test(text)) return null;
  const firstStep = steps[0] || base.answer;
  return {
    id: stableId('import_step', [subject || 'general', index, base.question.slice(0, 12)]),
    question: `这类内容第一步先做什么：${normalizeText(base.question, 30)}`,
    answer: firstStep,
    context: base.context,
    cardType: 'step'
  };
}

function buildTrapCard(base, subject, index) {
  const text = `${base.answer} ${base.context}`;
  const trap = detectTrap(text);
  if (!trap && !/错|不要|容易|混|审题|单位|符号/.test(text)) return null;
  return {
    id: stableId('import_trap', [subject || 'general', index, base.question.slice(0, 12)]),
    question: `这类内容最容易错在哪里：${normalizeText(base.question, 28)}`,
    answer: trap || base.answer,
    context: base.context,
    cardType: 'trap'
  };
}

function buildClozeCard(base, subject, index) {
  const text = String(base.answer || base.context || '').trim();
  const selected = selectClozeKeyword(text);
  const keyword = selected && selected.token;
  if (!keyword || text.length < 4) return null;
  return {
    id: stableId('import_cloze', [subject || 'general', index, keyword]),
    question: normalizeText(text.replace(keyword, '____'), 42),
    answer: keyword,
    context: base.context,
    cardType: 'cloze'
  };
}

function transferPrompt(base) {
  const text = `${base.question || ''} ${base.answer || ''} ${base.context || ''}`;
  if (/单位|厘米|米|分钟|小时/.test(text)) return '换一个数字或单位，先统一单位再计算。';
  if (/等量关系|方程|应用题|建模/.test(text)) return '换一个情境，先只写等量关系，不急着算。';
  if (/符号|正负|移项|括号/.test(text)) return '换一组符号或括号，逐步说出为什么变号。';
  if (/定义|概念|公式|性质/.test(text)) return '换一个例子，先判断能不能用这个定义或公式。';
  return '换一个相似题，先说第一步和最容易错的检查点。';
}

function buildTransferCard(base, subject, index) {
  const text = `${base.question || ''} ${base.answer || ''} ${base.context || ''}`;
  if (!WRONG_QUESTION_RE.test(text) && !/应用|变式|迁移|例题|题/.test(text)) return null;
  return {
    id: stableId('import_transfer', [subject || 'general', index, base.question.slice(0, 12)]),
    question: `举一反三：这类题换个条件时先做什么？${normalizeText(base.question, 24)}`,
    answer: transferPrompt(base),
    context: base.context,
    cardType: 'transfer'
  };
}

function contentEngine(rawText, options = {}) {
  const subject = options.subject || '';
  const weakPoint = options.weakPoint || '';
  const calibrationKey = options.calibrationKey || '';
  const provider = options.provider || CONTENT_ENGINE_PROVIDERS.local;
  const cards = [];
  parseImportedText(rawText, subject).forEach((base, index) => {
    [buildConceptCard(base, subject, index), buildStepCard(base, subject, index), buildTrapCard(base, subject, index), buildClozeCard(base, subject, index), buildTransferCard(base, subject, index)]
      .filter(Boolean)
      .forEach((item) => {
        const quality = scoreQuality({
          question: item.question,
          answer: item.answer,
          context: item.context,
          weakPoint,
          calibrationKey
        });
        if (quality < 55) return;
        cards.push(Object.assign({}, item, {
          subject,
          quality,
          weakPoint,
          calibrationKey,
          engine: provider,
          engineMode: provider === CONTENT_ENGINE_PROVIDERS.remote ? 'remote_ai' : 'local_rules',
          reason: item.cardType === 'trap'
            ? '易错提醒'
            : item.cardType === 'step'
              ? '步骤巩固'
              : item.cardType === 'cloze'
                ? '关键词填空'
                : item.cardType === 'transfer'
                  ? '举一反三'
                  : '概念理解'
        }));
      });
  });
  return uniqueByQuestion(cards).slice(0, 36);
}

function contentEngineAdapter(rawText, options = {}) {
  return {
    provider: options.provider || CONTENT_ENGINE_PROVIDERS.local,
    mode: 'local_ready_remote_pending',
    cards: contentEngine(rawText, options),
    remoteReady: !!options.remoteReady,
    requiredEndpoint: '/api/mini/content-engine'
  };
}

function contentEnginePlan(rawText, options = {}) {
  const adapter = contentEngineAdapter(rawText, options);
  const cards = adapter.cards || [];
  const coreTypes = ['concept', 'step', 'trap', 'cloze'];
  const extensionTypes = ['transfer'];
  const counts = {};
  const qualityByType = {};
  cards.forEach((card) => {
    const type = card.cardType || card.type || 'concept';
    counts[type] = Number(counts[type] || 0) + 1;
    if (!qualityByType[type]) qualityByType[type] = [];
    qualityByType[type].push(Number(card.quality || 0));
  });
  const avgQuality = cards.length
    ? Math.round(cards.reduce((sum, card) => sum + Number(card.quality || 0), 0) / cards.length)
    : 0;
  const missingTypes = coreTypes.filter((type) => !counts[type]);
  const extensionCoverage = extensionTypes.map((type) => {
    const qualities = qualityByType[type] || [];
    const typeQuality = qualities.length
      ? Math.round(qualities.reduce((sum, value) => sum + value, 0) / qualities.length)
      : 0;
    return {
      type,
      label: type === 'transfer' ? '举一反三' : type.toUpperCase(),
      count: Number(counts[type] || 0),
      quality: typeQuality,
      ready: Number(counts[type] || 0) > 0,
      percent: Number(counts[type] || 0) > 0 ? Math.max(28, Math.min(100, typeQuality || 56)) : 12
    };
  });
  const coreCoverage = coreTypes.map((type) => {
    const qualities = qualityByType[type] || [];
    const typeQuality = qualities.length
      ? Math.round(qualities.reduce((sum, value) => sum + value, 0) / qualities.length)
      : 0;
    return {
      type,
      label: type.toUpperCase(),
      count: Number(counts[type] || 0),
      quality: typeQuality,
      ready: Number(counts[type] || 0) > 0,
      percent: Number(counts[type] || 0) > 0 ? Math.max(28, Math.min(100, typeQuality || 56)) : 12
    };
  });
  const qualityBands = [
    { id: 'ready', label: 'Ready', count: cards.filter((card) => Number(card.quality || 0) >= 76).length },
    { id: 'usable', label: 'Usable', count: cards.filter((card) => Number(card.quality || 0) >= 60 && Number(card.quality || 0) < 76).length },
    { id: 'repair', label: 'Repair', count: cards.filter((card) => Number(card.quality || 0) < 60).length }
  ];
  const raw = String(rawText || '').trim();
  const lineCount = raw ? raw.split(/\n+/).filter((line) => line.trim()).length : 0;
  const score = Math.max(0, Math.min(100,
    Math.round((coreTypes.length - missingTypes.length) * 16 + Math.min(cards.length, 12) * 2 + avgQuality * 0.35)
  ));
  const ready = cards.length >= 3 && avgQuality >= 68 && missingTypes.length <= 1;
  const recommendation = !cards.length
    ? 'Paste notes, wrong causes, or a worked example to generate review cards.'
    : ready
      ? 'Ready to import: the deck has enough card types for a closed review loop.'
      : missingTypes.length > 1
        ? `Add ${missingTypes.join(', ')} evidence before importing for a stronger loop.`
        : 'Usable now, but run repair after import to strengthen weak cards.';
  return Object.assign({}, adapter, {
    rawLength: raw.length,
    lineCount,
    score,
    avgQuality,
    ready,
    coreCoverage,
    extensionCoverage,
    transferCount: Number(counts.transfer || 0),
    missingTypes,
    qualityBands,
    recommendation,
    importLabel: ready ? '可导入复习' : cards.length ? '先修补再导入' : '等待学习材料',
    nextActions: [
      missingTypes.length ? `补齐 ${missingTypes.join(' / ')} 卡型` : '覆盖 concept / step / trap / cloze',
      counts.transfer ? '已生成举一反三卡，可用于错题回访' : '如是错题，补一句错因会生成举一反三卡',
      avgQuality < 76 ? '导入后先做一次错因修补' : '直接进入每日轻回访',
      adapter.remoteReady ? '可切换稳定服务增强' : '本地规则已可用，后续接入稳定服务后增强'
    ]
  });
}

function previewImport(rawText, options = {}) {
  return contentEngineAdapter(rawText, options).cards;
}

function importTextToDeck(rawText, options = {}) {
  const subject = options.subject || '';
  const source = options.source || 'manual_import';
  const imported = previewImport(rawText, options);
  if (!imported.length) return ensureReviewDeck();
  const current = ensureReviewDeck();
  const freshItems = imported.filter((item) => !hasDuplicateNote(current.notes, item));
  const extraNotes = freshItems.map((item, index) => makeNote(
    stableId('note_import', [item.subject || subject || '通用', item.cardType || 'card', canonicalQuestion(item.question).slice(0, 24), index]),
    item.cardType || 'imported_note',
    source,
    {
      question: item.question,
      answer: item.answer,
      context: item.context,
      weakPoint: item.weakPoint || options.weakPoint || '',
      calibrationKey: item.calibrationKey || options.calibrationKey || '',
      wrongCauseBucket: item.wrongCauseBucket || options.wrongCauseBucket || '',
      nextPracticePlan: item.nextPracticePlan || null,
      checkpoint: item.checkpoint || '',
      parentPrompt: item.parentPrompt || ''
    },
    {
      subject: item.subject || subject,
      weakPoint: item.weakPoint || options.weakPoint || '',
      calibrationKey: item.calibrationKey || options.calibrationKey || '',
      wrongCauseBucket: item.wrongCauseBucket || options.wrongCauseBucket || '',
      reportId: options.reportId || '',
      sourceSchemaId: options.sourceSchemaId || '',
      reportSourceId: options.reportSourceId || '',
      uploadMaterialType: options.uploadMaterialType || options.materialType || '',
      requiredNextEvidence: options.requiredNextEvidence || []
    }
  ));
  const notes = mergeById(current.notes, extraNotes).slice(0, 200);
  const extraCards = cardsFromNotes(extraNotes, 260);
  const cards = mergeById(current.cards, extraCards).slice(0, 260);
  persistReviewState(current.deck, notes, cards);
  storage.appendReviewEvent({
    kind: 'review_import',
    count: extraNotes.length,
    source
  });
  if (storage.appendSyncMutation) {
    storage.appendSyncMutation('review_import', {
      source,
      note_ids: extraNotes.map((note) => note.id),
      count: extraNotes.length
    });
  }
  return {
    deck: current.deck,
    notes,
    cards,
    imported: extraNotes.length,
    skipped: imported.length - extraNotes.length,
    importedCardIds: extraCards.map((card) => card.id),
    firstCardId: extraCards[0] ? extraCards[0].id : ''
  };
}

function importGeneratedCards(imported, options = {}) {
  const subject = options.subject || '';
  const source = options.source || 'manual_import';
  const list = Array.isArray(imported) ? imported : [];
  if (!list.length) return ensureReviewDeck();
  const current = ensureReviewDeck();
  const freshItems = list.filter((item) => !hasDuplicateNote(current.notes, item));
  const extraNotes = freshItems.map((item, index) => makeNote(
    stableId('note_import', [item.subject || subject || 'general', item.cardType || 'card', canonicalQuestion(item.question).slice(0, 24), index]),
    item.cardType || 'imported_note',
    source,
    {
      question: item.question,
      answer: item.answer,
      context: item.context,
      weakPoint: item.weakPoint || options.weakPoint || '',
      calibrationKey: item.calibrationKey || options.calibrationKey || '',
      wrongCauseBucket: item.wrongCauseBucket || options.wrongCauseBucket || '',
      nextPracticePlan: item.nextPracticePlan || null,
      checkpoint: item.checkpoint || '',
      parentPrompt: item.parentPrompt || ''
    },
    {
      subject: item.subject || subject,
      weakPoint: item.weakPoint || options.weakPoint || '',
      calibrationKey: item.calibrationKey || options.calibrationKey || '',
      wrongCauseBucket: item.wrongCauseBucket || options.wrongCauseBucket || '',
      reportId: options.reportId || '',
      sourceSchemaId: options.sourceSchemaId || '',
      reportSourceId: options.reportSourceId || '',
      uploadMaterialType: options.uploadMaterialType || options.materialType || '',
      requiredNextEvidence: options.requiredNextEvidence || []
    }
  ));
  const notes = mergeById(current.notes, extraNotes).slice(0, 200);
  const cards = mergeById(current.cards, cardsFromNotes(extraNotes, 260)).slice(0, 260);
  persistReviewState(current.deck, notes, cards);
  storage.appendReviewEvent({
    kind: 'review_import',
    count: extraNotes.length,
    source
  });
  if (storage.appendSyncMutation) {
    storage.appendSyncMutation('review_import', {
      source,
      note_ids: extraNotes.map((note) => note.id),
      count: extraNotes.length
    });
  }
  return {
    deck: current.deck,
    notes,
    cards,
    imported: extraNotes.length,
    skipped: list.length - extraNotes.length
  };
}

function exportDeckSnapshot() {
  const { deck, notes, cards } = ensureReviewDeck();
  return {
    version: 2,
    exported_at: nowIso(),
    identity: storage.loadClientIdentity ? storage.loadClientIdentity() : null,
    sync: storage.loadSyncState ? storage.loadSyncState() : null,
    deck,
    notes,
    cards
  };
}

function importDeckSnapshot(snapshot) {
  const payload = snapshot || {};
  if (!payload.deck || !Array.isArray(payload.notes) || !Array.isArray(payload.cards)) {
    return { imported: 0, notes: ensureReviewDeck().notes.length, cards: ensureReviewDeck().cards.length };
  }
  const current = ensureReviewDeck();
  const deck = Object.assign({}, current.deck, payload.deck, {
    id: current.deck.id || DEFAULT_DECK.id
  });
  const safeNotes = payload.notes
    .filter((note) => note && note.id && note.fields)
    .map((note) => Object.assign({}, note, {
      deckId: current.deck.id || DEFAULT_DECK.id,
      quality: Number(note.quality || scoreQuality(note.fields || {})),
      created_at: note.created_at || nowIso()
    }));
  const safeCards = payload.cards
    .filter((card) => card && card.id && card.noteId)
    .map((card) => Object.assign({}, card, {
      deckId: current.deck.id || DEFAULT_DECK.id,
      created_at: card.created_at || nowIso(),
      due: card.due || nowIso(),
      state: card.state || 'new',
      suspended: !!card.suspended,
      leech: !!card.leech
    }));
  const notes = mergeById(current.notes, safeNotes).slice(0, 240);
  const cards = mergeById(current.cards, safeCards).slice(0, 260);
  persistReviewState(deck, notes, cards);
  storage.appendReviewEvent({
    kind: 'review_snapshot_import',
    imported_notes: safeNotes.length,
    imported_cards: safeCards.length
  });
  if (storage.appendSyncMutation) {
    storage.appendSyncMutation('review_snapshot_import', {
      imported_notes: safeNotes.length,
      imported_cards: safeCards.length
    });
  }
  return {
    imported: safeCards.length,
    notes: notes.length,
    cards: cards.length
  };
}

function updateDeckSettings(patch = {}) {
  const current = ensureReviewDeck();
  const dailyLimit = Number(patch.dailyLimit || current.deck.dailyLimit || DEFAULT_DECK.dailyLimit);
  const desiredRetention = Number(patch.desiredRetention || current.deck.desiredRetention || DEFAULT_DECK.desiredRetention);
  const deck = Object.assign({}, current.deck, {
    name: patch.name || current.deck.name,
    dailyLimit: Math.max(1, Math.min(30, Math.round(dailyLimit))),
    desiredRetention: Math.max(0.75, Math.min(0.97, Number(desiredRetention.toFixed(2))))
  });
  persistReviewState(deck, current.notes, current.cards);
  storage.appendReviewEvent({
    kind: 'review_deck_settings',
    dailyLimit: deck.dailyLimit,
    desiredRetention: deck.desiredRetention
  });
  if (storage.appendSyncMutation) {
    storage.appendSyncMutation('review_deck_settings', {
      deck_id: deck.id,
      dailyLimit: deck.dailyLimit,
      desiredRetention: deck.desiredRetention
    });
  }
  return deck;
}

function updateNote(noteId, patch = {}) {
  const current = ensureReviewDeck();
  let updated = null;
  const notes = current.notes.map((note) => {
    if (note.id !== noteId) return note;
    updated = Object.assign({}, note, {
      subject: patch.subject || note.subject,
      weakPoint: patch.weakPoint || note.weakPoint,
      calibrationKey: patch.calibrationKey || note.calibrationKey,
      wrongCauseBucket: patch.wrongCauseBucket || note.wrongCauseBucket,
      wrongCauseLabel: patch.wrongCauseLabel || note.wrongCauseLabel,
      nextPracticePlan: patch.nextPracticePlan || note.nextPracticePlan,
      checkpoint: patch.checkpoint || note.checkpoint,
      parentPrompt: patch.parentPrompt || note.parentPrompt,
      fields: Object.assign({}, note.fields, {
        question: patch.question || note.fields.question,
        answer: patch.answer || note.fields.answer,
        context: patch.context || note.fields.context,
        evidence: patch.evidence || note.fields.evidence
      })
    });
    updated.quality = scoreQuality({
      question: updated.fields.question,
      answer: updated.fields.answer,
      weakPoint: updated.weakPoint,
      calibrationKey: updated.calibrationKey
    });
    return updated;
  });
  if (!updated) return null;
  const replacementCards = noteCardTemplates(updated);
  const replacementByTemplate = {};
  replacementCards.forEach((card) => {
    replacementByTemplate[card.template || 'qa'] = card;
  });
  const cardIdsForNote = {};
  replacementCards.forEach((card) => {
    cardIdsForNote[card.id] = true;
  });
  const cards = mergeById(
    current.cards
      .filter((card) => card.noteId !== noteId || cardIdsForNote[card.id])
      .map((card) => {
        if (card.noteId !== noteId) return card;
        const fresh = replacementByTemplate[card.template || 'qa'] || replacementByTemplate.qa;
        return Object.assign({}, card, {
          question: fresh.question,
          answer: fresh.answer,
          subject: updated.subject,
          weakPoint: updated.weakPoint,
          calibrationKey: updated.calibrationKey,
          wrongCauseBucket: updated.wrongCauseBucket,
          wrongCauseLabel: updated.wrongCauseLabel,
          nextPracticePlan: updated.nextPracticePlan,
          checkpoint: updated.checkpoint,
          parentPrompt: updated.parentPrompt,
          quality: updated.quality,
          type: updated.type,
          source: updated.source
        });
      }),
    replacementCards
  ).slice(0, 260);
  persistReviewState(current.deck, notes, cards);
  storage.appendReviewEvent({ kind: 'review_edit', note_id: noteId });
  if (storage.appendSyncMutation) {
    storage.appendSyncMutation('review_note_update', {
      note_id: noteId,
      question: updated.fields.question,
      answer: updated.fields.answer,
      quality: updated.quality
    });
  }
  return updated;
}

function setCardSuspended(cardId, suspended) {
  const current = ensureReviewDeck();
  let updated = null;
  const cards = current.cards.map((card) => {
    if (card.id !== cardId) return card;
    updated = Object.assign({}, card, {
      suspended: !!suspended,
      state: suspended ? 'suspended' : card.state === 'suspended' ? 'review' : card.state,
      suspended_at: suspended ? nowIso() : '',
      due: suspended ? card.due : (card.due || nowIso())
    });
    return updated;
  });
  if (!updated) return null;
  persistReviewState(current.deck, current.notes, cards);
  storage.appendReviewEvent({ kind: suspended ? 'review_suspend' : 'review_resume', card_id: cardId });
  if (storage.appendSyncMutation) {
    storage.appendSyncMutation('review_card_visibility', {
      card_id: cardId,
      suspended: !!suspended
    });
  }
  return updated;
}

function burySiblingCards(cardId, date = new Date()) {
  const current = ensureReviewDeck();
  const target = current.cards.find((card) => card.id === cardId);
  if (!target || !target.noteId) return { buried: 0, cards: current.cards };
  const until = addDays(1, date);
  let buried = 0;
  const cards = current.cards.map((card) => {
    if (card.id === cardId || card.noteId !== target.noteId || card.suspended) return card;
    buried += 1;
    return Object.assign({}, card, {
      buried_until: until,
      buried_reason: 'sibling_reviewed'
    });
  });
  persistReviewState(current.deck, current.notes, cards);
  if (buried) {
    storage.appendReviewEvent({
      kind: 'review_bury_siblings',
      card_id: cardId,
      note_id: target.noteId,
      buried
    });
    if (storage.appendSyncMutation) {
      storage.appendSyncMutation('review_bury_siblings', {
        card_id: cardId,
        note_id: target.noteId,
        buried
      });
    }
  }
  return { buried, cards };
}

function unburyCard(cardId) {
  const current = ensureReviewDeck();
  let updated = null;
  const cards = current.cards.map((card) => {
    if (card.id !== cardId) return card;
    updated = Object.assign({}, card, {
      buried_until: '',
      buried_reason: ''
    });
    return updated;
  });
  if (!updated) return null;
  persistReviewState(current.deck, current.notes, cards);
  storage.appendReviewEvent({ kind: 'review_unbury', card_id: cardId });
  if (storage.appendSyncMutation) {
    storage.appendSyncMutation('review_unbury', { card_id: cardId });
  }
  return updated;
}

function reviewCard(cardId, rating, context = {}) {
  const { deck, cards } = ensureReviewDeck();
  let reviewed = null;
  const gameBefore = storage.loadGameProfile ? storage.loadGameProfile() : {};
  const next = cards.map((item) => {
    if (item.id !== cardId) return item;
    reviewed = schedule(item, rating, new Date(), deck);
    return reviewed;
  });
  storage.saveReviewCards(next);
  if (reviewed) burySiblingCards(cardId);
  if (reviewed) {
    const streak = reviewStreak();
    const loop = storage.updateReviewLoopForRating ? storage.updateReviewLoopForRating(rating, streak) : null;
    const xpAction = rating === 'again'
      ? 'review_again'
      : rating === 'hard'
        ? 'review_fuzzy'
        : rating === 'easy'
          ? 'review_easy'
          : 'review_remembered';
    const xpDelta = gameLogic.calculateXP(xpAction, gameLogic.streakMultiplier(gameBefore.streak || streak || 0));
    const xpEvidence = Object.assign({}, reviewed.recallEvidence || {}, context.xpEvidence || {}, {
      student_first_step: !!((context.xpEvidence && context.xpEvidence.student_first_step) || reviewed.childArticulatedStep),
      wrong_cause_named: !!((context.xpEvidence && context.xpEvidence.wrong_cause_named) || reviewed.childWrongCause),
      next_day_revisit_locked: !!((context.xpEvidence && context.xpEvidence.next_day_revisit_locked) || reviewed.nextDayRevisitConfirmed)
    });
    const xpResult = storage.addGameXP ? storage.addGameXP(xpDelta, xpAction, xpEvidence) : { profile: gameBefore, accepted: xpDelta, gate: { pass: true } };
    const gameAfterXp = xpResult.profile || gameBefore;
    const todayEvents = storage.loadReviewEvents ? storage.loadReviewEvents().filter((item) => String(item.created_at || '').slice(0, 10) === todayKey()) : [];
    const ratedTodayEvents = todayEvents.filter((item) => ['again', 'hard', 'good', 'easy'].includes(item.rating));
    const dailyReviewGoal = Math.min(3, Math.max(1, Number((deck && deck.dailyLimit) || 3)));
    const nextGame = gameLogic.updateStreak(gameAfterXp, {
      reviewedToday: ratedTodayEvents.length + 1,
      now: new Date(),
      threshold: dailyReviewGoal
    });
    const gameSaved = storage.saveGameProfile ? storage.saveGameProfile(nextGame) : nextGame;
    storage.appendReviewEvent({
      card_id: cardId,
      note_id: reviewed.noteId,
      rating: reviewed.last_rating,
      xp: xpResult.accepted === undefined ? xpDelta : xpResult.accepted,
      xp_capped: !!xpResult.capped,
      xp_gate_pass: xpResult.gate ? !!xpResult.gate.pass : true,
      stability: reviewed.stability,
      difficulty: reviewed.difficulty,
      retrievability: reviewed.retrievability,
      retrievability_before_review: reviewed.retrievability_before_review,
      fsrs_state_version: reviewed.fsrs_state_version,
      interval: reviewed.interval,
      leech: reviewed.leech,
      lives: loop && loop.lives,
      quality: reviewed.quality,
      source: reviewed.source,
      type: reviewed.type,
      subject: reviewed.subject,
      weakPoint: reviewed.weakPoint,
      game_streak: gameSaved.streak || 0,
      coins: gameSaved.coins || 0
    });
    if (storage.appendSyncMutation) {
      storage.appendSyncMutation('review_card', {
        card_id: cardId,
        note_id: reviewed.noteId,
        rating: reviewed.last_rating,
        xp: xpResult.accepted === undefined ? xpDelta : xpResult.accepted,
        due: reviewed.due,
        stability: reviewed.stability,
        difficulty: reviewed.difficulty,
        interval: reviewed.interval
      });
    }
  }
  return reviewed;
}

function reviewStreak() {
  const loop = storage.loadReviewLoop ? storage.loadReviewLoop() : null;
  if (loop && Number(loop.current_streak || 0) > 0) {
    return Number(loop.current_streak || 0);
  }
  const days = {};
  storage.loadReviewEvents().forEach((item) => {
    if (!item.rating) return;
    const key = String(item.created_at || '').slice(0, 10);
    if (key) days[key] = true;
  });
  let streak = 0;
  let cursor = new Date();
  while (days[todayKey(cursor)]) {
    streak += 1;
    cursor = new Date(cursor.getTime() - DAY);
  }
  return streak;
}

function missedReviewDays(referenceDate = new Date()) {
  const loop = storage.loadReviewLoop ? storage.loadReviewLoop() : {};
  const lastDay = loop.last_review_day || '';
  if (!lastDay) return 0;
  const last = new Date(`${lastDay}T00:00:00Z`).getTime();
  const now = new Date(`${todayKey(referenceDate)}T00:00:00Z`).getTime();
  if (!Number.isFinite(last) || !Number.isFinite(now) || now <= last) return 0;
  return Math.max(0, Math.floor((now - last) / DAY) - 1);
}

function comebackPlan(summary) {
  const loop = storage.loadReviewLoop ? storage.loadReviewLoop() : {};
  const missed = missedReviewDays();
  const freeze = Number(loop.streak_freeze || 0);
  const queue = summary && summary.queue ? summary.queue : queueStats(ensureReviewDeck().cards);
  const canProtect = missed > 0 && freeze >= missed;
  const needsRecovery = missed > 0 || (summary && summary.health && summary.health.status === 'overloaded');
  const sprintCards = Math.min(3, Math.max(1, Number(queue.due || 0)));
  return {
    missedDays: missed,
    freezeAvailable: freeze,
    protectedGap: canProtect,
    needsRecovery,
    sprintCards,
    plan: missed > 1
      ? ['Complete due/leech cards first.', 'Avoid importing new cards today.', 'Use module remediation before long tutor sessions.']
      : missed === 1
        ? ['Do a short comeback session first.', 'Clear at least one weak-point card.', 'Then resume the normal daily goal.']
        : ['Keep the streak warm with a short due-card session.', 'Expand coverage only after must-do items are stable.'],
    label: !needsRecovery
      ? 'Review loop is in rhythm.'
      : canProtect
        ? `Missed ${missed} day(s); streak freeze can protect the streak.`
        : `Missed ${missed} day(s); use a short comeback session to recover momentum.`
  };
}

function dailyGoalStatus(events, deck) {
  const today = todayKey();
  const todayEvents = events.filter((item) => item.rating && String(item.created_at || '').slice(0, 10) === today);
  const target = Math.max(1, Number((deck && deck.dailyLimit) || DEFAULT_DECK.dailyLimit));
  const completed = todayEvents.length;
  const progress = Math.min(100, Math.round((completed / target) * 100));
  return {
    target,
    completed,
    remaining: Math.max(0, target - completed),
    progress,
    achieved: completed >= target,
    label: completed >= target ? '今日目标已完成' : `还差 ${Math.max(0, target - completed)} 张完成今日目标`
  };
}

function achievements(events, cards, deck) {
  const gameProfile = storage.loadGameProfile ? storage.loadGameProfile() : {};
  const streak = Number(gameProfile.streak || reviewStreak() || 0);
  const goal = dailyGoalStatus(events, deck);
  const mastered = cards.filter((item) => Number(item.interval || 0) >= 7 && Number(item.lapses || 0) === 0).length;
  const leeches = cards.filter((item) => item.leech || Number(item.lapses || 0) >= 2).length;
  const builtIn = [
    {
      id: 'daily_goal',
      title: '今日闭环',
      unlocked: goal.achieved,
      progress: goal.progress,
      hint: goal.label
    },
    {
      id: 'streak_3',
      title: '连续 3 天',
      unlocked: streak >= 3,
      progress: Math.min(100, Math.round((streak / 3) * 100)),
      hint: streak >= 3 ? '复习节奏已经建立' : `连续复习 ${streak}/3 天`
    },
    {
      id: 'master_20',
      title: '稳定掌握 20 张',
      unlocked: mastered >= 20,
      progress: Math.min(100, Math.round((mastered / 20) * 100)),
      hint: `稳定掌握 ${mastered}/20 张`
    },
    {
      id: 'leech_watch',
      title: '反复错因提醒',
      unlocked: leeches > 0,
      progress: leeches > 0 ? 100 : 0,
      hint: leeches > 0 ? `已标记 ${leeches} 个反复错因` : '暂无反复错因'
    }
  ];
  const gameAchievements = gameLogic.listAchievements(gameProfile.achievements || []).map((item) => ({
    id: item.id,
    title: item.title,
    unlocked: item.unlocked,
    progress: item.unlocked ? 100 : 0,
    hint: item.description
  }));
  return builtIn.concat(gameAchievements);
}

function queueStats(cards) {
  const now = Date.now();
  return {
    newCount: cards.filter((item) => item.state === 'new' && !item.suspended).length,
    learning: cards.filter((item) => item.state === 'relearning' && !item.suspended).length,
    review: cards.filter((item) => item.state === 'review' && !item.suspended).length,
    suspended: cards.filter((item) => item.suspended).length,
    buried: cards.filter((item) => item.buried_until && new Date(item.buried_until).getTime() > now).length,
    due: cards.filter((item) => !item.suspended && (!item.due || new Date(item.due).getTime() <= now)).length
  };
}

function dueForecast(cards, days = 7, date = new Date()) {
  const size = Math.max(1, Math.min(120, Number(days || 7)));
  const buckets = [];
  for (let index = 0; index < size; index += 1) {
    const key = todayKey(new Date(date.getTime() + index * DAY));
    buckets.push({ day: key, due: 0, leech: 0, newCount: 0 });
  }
  (cards || []).filter((card) => !card.suspended).forEach((card) => {
    const dueTime = card.due ? new Date(card.due).getTime() : date.getTime();
    const offset = Math.max(0, Math.floor((dueTime - date.getTime()) / DAY));
    if (offset >= size) return;
    buckets[offset].due += 1;
    if (card.leech || Number(card.lapses || 0) >= 2) buckets[offset].leech += 1;
    if (card.state === 'new') buckets[offset].newCount += 1;
  });
  return buckets;
}

function workloadForecast(cards, deck = DEFAULT_DECK, days = 30, date = new Date()) {
  const forecast = dueForecast(cards, days, date);
  const limit = Math.max(1, Number((deck && deck.dailyLimit) || DEFAULT_DECK.dailyLimit));
  const totalDue = forecast.reduce((sum, item) => sum + Number(item.due || 0), 0);
  const peak = forecast.reduce((max, item) => (item.due > max.due ? item : max), { due: 0, day: '' });
  const overloadedDays = forecast.filter((item) => Number(item.due || 0) > limit).length;
  const averageDue = Math.round(totalDue / Math.max(1, forecast.length));
  const todayDue = forecast[0] ? Number(forecast[0].due || 0) : 0;
  const backlog = Math.max(0, todayDue - limit);
  const safeNewCards = Math.max(0, Math.min(12, limit - Math.ceil(averageDue * 0.65) - Math.ceil(backlog / 2)));
  const risk = overloadedDays >= 8 || peak.due > limit * 2
    ? 'high'
    : overloadedDays >= 3 || peak.due > limit
      ? 'medium'
      : 'low';
  return {
    horizonDays: forecast.length,
    totalDue,
    averageDue,
    peakDay: peak.day,
    peakDue: peak.due,
    overloadedDays,
    backlog,
    dailyLimit: limit,
    safeNewCards,
    risk,
    label: risk === 'high'
      ? 'High future load: pause new cards and clear leeches first.'
      : risk === 'medium'
        ? 'Medium future load: keep new cards conservative.'
        : 'Future review load is under control.'
  };
}

function cramPlanner(cards, deck = DEFAULT_DECK, daysToExam = 14, date = new Date()) {
  const days = Math.max(3, Math.min(120, Number(daysToExam || 14)));
  const active = (cards || []).filter((card) => !card.suspended);
  const forecast = workloadForecast(active, deck, days, date);
  const leeches = active.filter((card) => card.leech || Number(card.lapses || 0) >= 2).length;
  const weakDue = active.filter((card) => (card.weakPoint || card.calibrationKey) && (!card.due || new Date(card.due).getTime() <= date.getTime())).length;
  const newCards = active.filter((card) => card.state === 'new').length;
  const dailyTarget = Math.max(1, Math.ceil((forecast.totalDue + leeches * 2 + weakDue) / days));
  const safeDailyLimit = Math.max(Number((deck && deck.dailyLimit) || DEFAULT_DECK.dailyLimit), Math.min(30, dailyTarget + forecast.safeNewCards));
  const phases = [
    {
      id: 'stabilize',
      days: Math.max(1, Math.ceil(days * 0.25)),
      focus: 'Clear overdue cards, leeches, and must-do weak-point cards first.'
    },
    {
      id: 'expand',
      days: Math.max(1, Math.ceil(days * 0.45)),
      focus: 'Add safe new cards only when forecast risk stays low or medium.'
    },
    {
      id: 'simulate',
      days: Math.max(1, days - Math.ceil(days * 0.25) - Math.ceil(days * 0.45)),
      focus: 'Run quiz packs and repair every miss before the next day.'
    }
  ];
  return {
    daysToExam: days,
    dailyTarget,
    safeDailyLimit,
    newCards,
    leeches,
    weakDue,
    risk: forecast.risk,
    phases,
    label: leeches
      ? `Exam mode: fix ${leeches} sticky mistake(s) before adding volume.`
      : `Exam mode: ${dailyTarget} reviews/day keeps the plan controlled.`
  };
}

function loadForecastAdvice(forecast, deck) {
  const limit = Math.max(1, Number((deck && deck.dailyLimit) || DEFAULT_DECK.dailyLimit));
  const peak = (forecast || []).reduce((max, item) => (item.due > max.due ? item : max), { due: 0, day: '' });
  const overloadedDays = (forecast || []).filter((item) => item.due > limit).length;
  return {
    peakDay: peak.day,
    peakDue: peak.due,
    overloadedDays,
    limit,
    message: overloadedDays
      ? `未来 7 天有 ${overloadedDays} 天超过每日上限，先少导入新卡`
      : peak.due
        ? `未来 7 天峰值 ${peak.due} 张，负荷可控`
        : '未来 7 天暂无明显复习压力'
  };
}

function quizBuilder(cards, options = {}) {
  const limit = Math.max(3, Math.min(12, Number(options.limit || 6)));
  const pool = (cards || [])
    .filter((card) => !card.suspended)
    .sort((a, b) => {
      if (!!b.leech !== !!a.leech) return b.leech ? 1 : -1;
      if ((a.state === 'new') !== (b.state === 'new')) return a.state === 'new' ? 1 : -1;
      return new Date(a.due || a.created_at || 0).getTime() - new Date(b.due || b.created_at || 0).getTime();
    })
    .slice(0, limit);
  const questions = pool.map((card, index) => {
    const kind = card.type === 'cloze' || card.template === 'cloze_context'
      ? 'fill_blank'
      : card.template === 'reverse'
        ? 'reverse_recall'
        : card.leech
          ? 'wrong-cause'
          : 'active_recall';
    return {
      id: `quiz_${card.id}`,
      cardId: card.id,
      index: index + 1,
      kind,
      prompt: card.question,
      answer: card.answer,
      source: card.source,
      weakPoint: card.weakPoint || '',
      leech: !!card.leech
    };
  });
  const leechCount = questions.filter((item) => item.leech).length;
  return {
    mode: leechCount ? 'repair_quiz' : 'daily_quiz',
    count: questions.length,
    leechCount,
    estimatedMinutes: Math.max(3, Math.ceil(questions.length * 1.5)),
    questions,
    label: leechCount
      ? `Repair quiz: ${leechCount} sticky mistake(s) included.`
      : `Daily quiz: ${questions.length} active recall question(s).`
  };
}

function quizStats(events) {
  const attempts = (events || []).filter((item) => item.kind === 'quiz_attempt');
  const totals = attempts.reduce((acc, item) => {
    acc.questions += Number(item.count || 0);
    acc.correct += Number(item.correct || 0);
    acc.missed += Number(item.missed || 0);
    acc.repairDrills += Number(item.repair_drills || 0);
    return acc;
  }, { questions: 0, correct: 0, missed: 0, repairDrills: 0 });
  return {
    attempts: attempts.length,
    questions: totals.questions,
    correct: totals.correct,
    missed: totals.missed,
    repairDrills: totals.repairDrills,
    accuracy: totals.questions ? Math.round((totals.correct / totals.questions) * 100) : 0,
    label: attempts.length
      ? `Quiz loop has ${attempts.length} attempt(s), ${totals.missed} miss(es) sent into repair.`
      : 'Quiz loop is ready; finish a quiz to create repair evidence.'
  };
}

function deckLibrary(notes, cards, options = {}) {
  const groups = {};
  (notes || []).forEach((note) => {
    const key = note.calibrationKey || note.weakPoint || note.subject || note.source || 'general';
    if (!groups[key]) {
      groups[key] = {
        id: stableId('library', [key]),
        title: key,
        source: note.source || '',
        subject: note.subject || '',
        notes: 0,
        cards: 0,
        leeches: 0,
        avgQuality: 0,
        qualitySum: 0,
        shareReady: false
      };
    }
    groups[key].notes += 1;
    groups[key].qualitySum += Number(note.quality || 0);
  });
  (cards || []).forEach((card) => {
    const key = card.calibrationKey || card.weakPoint || card.subject || card.source || 'general';
    if (!groups[key]) return;
    groups[key].cards += 1;
    if (card.leech || Number(card.lapses || 0) >= 2) groups[key].leeches += 1;
  });
  return Object.keys(groups)
    .map((key) => {
      const item = groups[key];
      const avgQuality = item.notes ? Math.round(item.qualitySum / item.notes) : 0;
      return Object.assign({}, item, {
        avgQuality,
        qualitySum: undefined,
        shareReady: item.cards >= 3 && avgQuality >= 60 && item.leeches <= Math.max(1, Math.floor(item.cards * 0.25)),
        label: `${item.cards} cards, quality ${avgQuality}, ${item.leeches} sticky`
      });
    })
    .sort((a, b) => Number(b.shareReady) - Number(a.shareReady) || b.cards - a.cards)
    .slice(0, Math.max(3, Math.min(12, Number(options.limit || 6))));
}

function finishQuizAttempt(results, options = {}) {
  const list = Array.isArray(results) ? results : [];
  const attemptId = options.attemptId || stableId('quiz_attempt', [todayKey(), Date.now()]);
  const startedAt = options.startedAt || nowIso();
  const finishedAt = options.finishedAt || nowIso();
  const reviewed = [];
  const misses = [];
  let repairDrills = 0;

  list.forEach((item) => {
    const cardId = item && (item.cardId || item.card_id);
    if (!cardId) return;
    const rating = item.rating || (item.correct ? 'good' : 'again');
    const reviewedCard = reviewCard(cardId, rating);
    if (!reviewedCard) return;
    reviewed.push(reviewedCard);
    if (rating === 'again' || rating === 'hard' || item.correct === false) {
      misses.push(reviewedCard);
      const repair = repairNote(reviewedCard.noteId);
      if (repair && repair.ok) repairDrills += Number(repair.drillImported || 0);
    }
  });

  const correct = reviewed.filter((card) => ['good', 'easy'].includes(card.last_rating)).length;
  const missed = reviewed.length - correct;
  const summary = {
    attemptId,
    kind: 'quiz_attempt',
    started_at: startedAt,
    finished_at: finishedAt,
    mode: options.mode || 'daily_quiz',
    count: reviewed.length,
    correct,
    missed,
    repair_drills: repairDrills,
    accuracy: reviewed.length ? Math.round((correct / reviewed.length) * 100) : 0,
    missed_card_ids: misses.map((card) => card.id),
    missed_note_ids: misses.map((card) => card.noteId)
  };
  const gameProfile = storage.loadGameProfile ? storage.loadGameProfile() : {};
  const recentQuiz = (gameProfile.recent_quiz_accuracy || []).concat([summary.accuracy]).slice(-6);
  const achievementStats = {
    achievements: gameProfile.achievements || [],
    review_count: (storage.loadReviewEvents ? storage.loadReviewEvents() : []).filter((item) => item.rating).length,
    correct_count: (storage.loadReviewEvents ? storage.loadReviewEvents() : []).filter((item) => ['good', 'easy'].includes(item.rating)).length + correct,
    streak: gameProfile.streak || reviewStreak(),
    recent_quiz_accuracy: recentQuiz,
    completed_books: deckLibrary(storage.loadReviewNotes ? storage.loadReviewNotes() : [], storage.loadReviewCards ? storage.loadReviewCards() : []).filter((item) => item.shareReady && item.cards >= 20).length
  };
  const achievementResult = gameLogic.checkAndUnlockAchievements(achievementStats);
  if (storage.saveGameProfile) {
    storage.saveGameProfile(Object.assign({}, gameProfile, {
      recent_quiz_accuracy: recentQuiz,
      achievements: achievementResult.achievements,
      coins: Number(gameProfile.coins || 0) + Number(achievementResult.coinsAwarded || 0)
    }));
  }
  storage.appendReviewEvent(summary);
  if (storage.appendSyncMutation) {
    storage.appendSyncMutation('review_quiz_attempt', {
      attempt_id: attemptId,
      mode: summary.mode,
      count: summary.count,
      correct: summary.correct,
      missed: summary.missed,
      repair_drills: repairDrills,
      missed_card_ids: summary.missed_card_ids
    });
  }
  return summary;
}

function deckHealth(cards, events) {
  const due = cards.filter((item) => !item.suspended && (!item.due || new Date(item.due).getTime() <= Date.now())).length;
  const total = cards.filter((item) => !item.suspended).length;
  const newCount = cards.filter((item) => item.state === 'new' && !item.suspended).length;
  const leechCount = cards.filter((item) => item.leech || Number(item.lapses || 0) >= 2).length;
  const recent = (events || []).filter((item) => item.rating).slice(0, 20);
  const retention = recent.length
    ? Math.round((recent.filter((item) => ['good', 'easy'].includes(item.rating)).length / recent.length) * 100)
    : 0;
  const dueRatio = total ? Math.round((due / total) * 100) : 0;
  let status = 'steady';
  if (leechCount >= 5 || dueRatio >= 55) status = 'overloaded';
  else if (retention > 0 && retention < 60) status = 'fragile';
  else if (retention >= 80 && dueRatio <= 35) status = 'healthy';
  return {
    total,
    due,
    newCount,
    leechCount,
    retention,
    dueRatio,
    status,
    label: status === 'overloaded'
      ? '牌组负荷偏高，先收敛到错因和到期卡'
      : status === 'fragile'
        ? '记忆保持偏弱，先降低新卡并提高回看频率'
        : status === 'healthy'
          ? '牌组健康，可以逐步扩大学习面'
          : '牌组稳定，保持当前节奏'
  };
}

function sourceBreakdown(cards, events) {
  const bySource = {};
  (cards || []).forEach((card) => {
    const key = card.source || 'unknown';
    if (!bySource[key]) bySource[key] = { source: key, total: 0, leech: 0, due: 0 };
    bySource[key].total += 1;
    if (card.leech || Number(card.lapses || 0) >= 2) bySource[key].leech += 1;
    if (!card.suspended && (!card.due || new Date(card.due).getTime() <= Date.now())) bySource[key].due += 1;
  });
  const reviewsBySource = {};
  (events || []).filter((item) => item.rating).forEach((event) => {
    const key = event.source || 'unknown';
    if (!reviewsBySource[key]) reviewsBySource[key] = { reviewed: 0, good: 0 };
    reviewsBySource[key].reviewed += 1;
    if (['good', 'easy'].includes(event.rating)) reviewsBySource[key].good += 1;
  });
  return Object.keys(bySource)
    .map((key) => {
      const review = reviewsBySource[key] || { reviewed: 0, good: 0 };
      return Object.assign(bySource[key], {
        reviewed: review.reviewed,
        accuracy: review.reviewed ? Math.round((review.good / review.reviewed) * 100) : 0
      });
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);
}

function typeBreakdown(cards, notes) {
  const labels = {
    concept: 'Concept',
    step: 'Step',
    trap: 'Trap',
    cloze: 'Cloze',
    transfer: '举一反三',
    weak_point: 'Weak',
    first_step: 'First step',
    misconception: 'Mistake',
    answer_boundary: 'Boundary',
    mastery_signal: 'Signal',
    module_review: 'Module'
  };
  const byType = {};
  (cards || []).forEach((card) => {
    const key = card.type || 'unknown';
    if (!byType[key]) {
      byType[key] = {
        type: key,
        label: labels[key] || key,
        total: 0,
        due: 0,
        leech: 0,
        avgQuality: 0,
        qualitySum: 0
      };
    }
    byType[key].total += 1;
    byType[key].qualitySum += Number(card.quality || 0);
    if (card.leech || Number(card.lapses || 0) >= 2) byType[key].leech += 1;
    if (!card.suspended && (!card.due || new Date(card.due).getTime() <= Date.now())) byType[key].due += 1;
  });
  (notes || []).forEach((note) => {
    const key = note.type || 'unknown';
    if (!byType[key]) {
      byType[key] = {
        type: key,
        label: labels[key] || key,
        total: 0,
        due: 0,
        leech: 0,
        avgQuality: 0,
        qualitySum: 0
      };
    }
  });
  return Object.keys(byType)
    .map((key) => {
      const item = byType[key];
      return Object.assign({}, item, {
        avgQuality: item.total ? Math.round(item.qualitySum / item.total) : 0,
        qualitySum: undefined
      });
    })
    .sort((a, b) => b.total - a.total || a.type.localeCompare(b.type))
    .slice(0, 12);
}

function templateBreakdown(cards) {
  const labels = {
    qa: 'Q/A',
    reverse: 'Reverse',
    context: 'Context',
    cloze_context: 'Cloze context'
  };
  const byTemplate = {};
  (cards || []).forEach((card) => {
    const key = card.template || 'qa';
    if (!byTemplate[key]) {
      byTemplate[key] = {
        template: key,
        label: labels[key] || key,
        total: 0,
        due: 0,
        leech: 0
      };
    }
    byTemplate[key].total += 1;
    if (card.leech || Number(card.lapses || 0) >= 2) byTemplate[key].leech += 1;
    if (!card.suspended && (!card.due || new Date(card.due).getTime() <= Date.now())) byTemplate[key].due += 1;
  });
  return Object.keys(byTemplate)
    .map((key) => byTemplate[key])
    .sort((a, b) => b.total - a.total || a.template.localeCompare(b.template));
}

function contentEngineStatus(types) {
  const list = Array.isArray(types) ? types : [];
  const coreTypes = ['concept', 'step', 'trap', 'cloze'];
  const coverage = coreTypes.filter((type) => list.some((item) => item.type === type && item.total > 0));
  const generated = list.filter((item) => coreTypes.includes(item.type)).reduce((sum, item) => sum + item.total, 0);
  return {
    coverage: coverage.length,
    required: coreTypes.length,
    generated,
    complete: coverage.length === coreTypes.length,
    missing: coreTypes.filter((type) => !coverage.includes(type)),
    label: coverage.length === coreTypes.length
      ? 'Content engine covers concept, step, trap and cloze cards.'
      : `Content engine missing ${coreTypes.length - coverage.length} core card types.`,
    endpointReady: true,
    endpoint: '/api/mini/content-engine'
  };
}

function qualityQueue(notes, limit = 8) {
  return (notes || [])
    .filter((note) => Number(note.quality || 0) < 68 || !(note.fields && note.fields.answer))
    .sort((a, b) => Number(a.quality || 0) - Number(b.quality || 0))
    .slice(0, Math.max(1, Math.min(20, Number(limit || 8))))
    .map((note) => ({
      id: note.id,
      type: note.type,
      source: note.source,
      noteId: note.id,
      question: note.fields && note.fields.question,
      quality: Number(note.quality || 0),
      reason: !(note.fields && note.fields.answer)
        ? '缺少答案'
        : Number(note.quality || 0) < 55
          ? '质量过低'
          : '建议补充上下文'
    }));
}

function nextStep(summary) {
  if (!summary) return { mode: 'smart', message: '先开始第一轮复习' };
  if (summary.health && summary.health.status === 'overloaded') {
    return { mode: 'leech', message: '先清顽固错因，暂停扩张新卡' };
  }
  if (summary.health && summary.health.status === 'fragile') {
    return { mode: 'weak', message: '先回到卡点卡，稳住保持率' };
  }
  if (summary.goal && !summary.goal.achieved) {
    return { mode: 'smart', message: `还差 ${summary.goal.remaining} 张，先完成今日目标` };
  }
  if (summary.queue && summary.queue.newCount >= 6) {
    return { mode: 'new', message: '可以开一轮新卡，扩大知识覆盖' };
  }
  return { mode: 'smart', message: '保持当前节奏，继续滚动复习' };
}

function sessionFeedback(mode, reviewedCards) {
  const list = Array.isArray(reviewedCards) ? reviewedCards : [];
  const leechCount = list.filter((item) => item.leech || Number(item.lapses || 0) >= 2).length;
  const againCount = list.filter((item) => item.last_rating === 'again').length;
  const easyCount = list.filter((item) => item.last_rating === 'easy').length;
  return {
    mode,
    reviewed: list.length,
    leechCount,
    againCount,
    easyCount,
    message: list.length === 0
      ? '本轮还没有复习记录'
      : mode === 'leech'
        ? `本轮处理 ${leechCount} 张顽固错因，先把最难的压住`
        : againCount >= Math.max(2, Math.ceil(list.length / 2))
          ? '本轮遗忘偏多，建议回到作业点拨或降低新卡'
          : easyCount >= Math.max(2, Math.ceil(list.length / 2))
            ? '本轮状态较稳，可以逐步扩大覆盖面'
            : '本轮节奏正常，继续按目标推进'
  };
}

function progressProfile(events, cards) {
  const reviewed = (events || []).filter((item) => item.rating);
  const loop = storage.loadReviewLoop ? storage.loadReviewLoop() : {};
  const gameProfile = storage.loadGameProfile ? storage.loadGameProfile() : {};
  const computedXp = reviewed.reduce((sum, item) => {
    const base = item.rating === 'easy' ? 16 : item.rating === 'good' ? 12 : item.rating === 'hard' ? 8 : 5;
    return sum + Number(item.xp || base + (item.leech ? 4 : 0));
  }, 0) + Number(loop.bonus_xp || 0);
  const xp = Math.max(Number(gameProfile.xp || 0), computedXp);
  const levelInfo = gameLogic.getLevel(xp);
  const wins = reviewed.filter((item) => ['good', 'easy'].includes(item.rating)).length;
  const mastered = (cards || []).filter((item) => Number(item.interval || 0) >= 7 && Number(item.lapses || 0) === 0).length;
  return {
    xp,
    coins: Number(gameProfile.coins || 0),
    level: Math.max(1, levelInfo.level),
    levelTitle: levelInfo.title,
    nextLevelXp: levelInfo.nextLevelXp,
    progress: Math.max(0, Math.min(100, levelInfo.progress)),
    wins,
    mastered,
    streak: Number(gameProfile.streak || reviewStreak() || 0),
    bestStreak: Number(gameProfile.best_streak || 0),
    inventoryCount: (gameProfile.inventory || []).length
  };
}

function syncStatus() {
  const state = storage.loadSyncState ? storage.loadSyncState() : {};
  const queue = storage.loadSyncQueue ? storage.loadSyncQueue() : [];
  const diagnostics = storage.syncDiagnostics ? storage.syncDiagnostics() : null;
  const pending = queue.filter((item) => item.status === 'pending').length;
  const hasCloudSession = !!state.enabled && state.mode !== 'local_queue' && !!state.last_success_at && !state.last_error;
  return {
    mode: state.mode || 'local_queue',
    enabled: !!state.enabled,
    pending,
    lastSuccessAt: state.last_success_at || '',
    lastError: state.last_error || '',
    readyForCloud: hasCloudSession,
    diagnostics,
    label: diagnostics && diagnostics.pending
      ? diagnostics.label
      : (state.last_error ? `同步失败：${state.last_error}` : (hasCloudSession ? '多端连续记录已连接。' : '本机记录已就绪，多端连续记录开通后会自动承接。'))
  };
}

function loopStatus(progress) {
  const loop = storage.loadReviewLoop ? storage.loadReviewLoop() : {};
  const profile = storage.loadProfile ? storage.loadProfile() : {};
  const gameProfile = storage.loadGameProfile ? storage.loadGameProfile() : {};
  const lives = Number(gameProfile.lives || loop.lives || loop.max_lives || 5);
  const maxLives = Number(loop.max_lives || 5);
  return {
    lives,
    maxLives,
    health: Math.round((lives / Math.max(1, maxLives)) * 100),
    streakFreeze: Number(gameProfile.streak_freezes || loop.streak_freeze || 0),
    currentStreak: Number(gameProfile.streak || loop.current_streak || (progress && progress.streak) || 0),
    longestStreak: Number(gameProfile.best_streak || loop.longest_streak || 0),
    coins: Number(gameProfile.coins || 0),
    leaderboard: storage.localLeaderboardSnapshot ? storage.localLeaderboardSnapshot(profile, progress || {}) : [],
    label: lives <= 1 ? 'Life low: focus on must-do and leech cards.' : 'Life loop healthy.'
  };
}

function userForecastAdvice(forecast, deck) {
  const limit = Math.max(1, Number((deck && deck.dailyLimit) || DEFAULT_DECK.dailyLimit));
  const peak = (forecast || []).reduce((max, item) => (item.due > max.due ? item : max), { due: 0, day: '' });
  const overloadedDays = (forecast || []).filter((item) => item.due > limit).length;
  return {
    peakDay: peak.day,
    peakDue: peak.due,
    overloadedDays,
    limit,
    message: overloadedDays
      ? `未来 7 天有 ${overloadedDays} 天超过每日上限，先少导入新卡`
      : peak.due
        ? `未来 7 天峰值 ${peak.due} 张，负荷可控`
        : '未来 7 天暂无明显复习压力'
  };
}

function userDeckHealth(cards, events) {
  const due = cards.filter((item) => !item.suspended && (!item.due || new Date(item.due).getTime() <= Date.now())).length;
  const total = cards.filter((item) => !item.suspended).length;
  const newCount = cards.filter((item) => item.state === 'new' && !item.suspended).length;
  const leechCount = cards.filter((item) => item.leech || Number(item.lapses || 0) >= 2).length;
  const recent = (events || []).filter((item) => item.rating).slice(0, 20);
  const retention = recent.length
    ? Math.round((recent.filter((item) => ['good', 'easy'].includes(item.rating)).length / recent.length) * 100)
    : 0;
  const dueRatio = total ? Math.round((due / total) * 100) : 0;
  let status = 'steady';
  if (leechCount >= 5 || dueRatio >= 55) status = 'overloaded';
  else if (retention > 0 && retention < 60) status = 'fragile';
  else if (retention >= 80 && dueRatio <= 35) status = 'healthy';
  return {
    total,
    due,
    newCount,
    leechCount,
    retention,
    dueRatio,
    status,
    label: status === 'overloaded'
      ? '牌组负荷偏高，先收敛到错因和到期卡'
      : status === 'fragile'
        ? '记忆保持偏弱，先降低新卡并提高回看频率'
        : status === 'healthy'
          ? '牌组健康，可以逐步扩大覆盖面'
          : '牌组稳定，保持当前节奏'
  };
}

function repairSuggestion(note, cards) {
  const relatedCards = (cards || []).filter((card) => card.noteId === note.id);
  const leech = relatedCards.some((card) => card.leech || Number(card.lapses || 0) >= 2);
  const question = String((note.fields && note.fields.question) || '');
  const answer = String((note.fields && note.fields.answer) || '');
  const plan = buildNextPracticePlan(Object.assign({}, note || {}, note.fields || {}));
  const actions = [];
  if (!answer.trim()) actions.push('Add a concrete answer or first-step explanation.');
  if (question.trim().length < 12) actions.push('Rewrite the prompt so the learner knows what to recall.');
  if (answer.trim().length < 8) actions.push('Expand the answer with a rule, example, or trap reminder.');
  if (!(note.fields && note.fields.context)) actions.push('Add source context so the card stays grounded in real homework.');
  if (!note.weakPoint && !note.calibrationKey) actions.push('Attach a weak point or calibration key for path routing.');
  actions.push(plan.nextPracticeText);
  if (leech) actions.push('Split this into a smaller step card before keeping the reverse card.');
  return {
    noteId: note.id,
    wrongCauseBucket: plan.wrongCauseBucket,
    wrongCauseLabel: plan.wrongCauseLabel,
    checkpoint: plan.checkpoint,
    parentPrompt: plan.parentPrompt,
    nextPracticePlan: plan,
    suggestion: actions[0] || 'Refresh this card with a more specific prompt and answer.',
    actions: actions.slice(0, 3),
    leech
  };
}

function repairDraft(note, cards) {
  const repair = repairSuggestion(note, cards);
  const questionBase = String((note.fields && note.fields.question) || '').trim();
  const answerBase = String((note.fields && note.fields.answer) || '').trim();
  const contextBase = String((note.fields && note.fields.context) || '').trim();
  const question = questionBase.length >= 12
    ? questionBase
    : `Explain the first useful step for: ${normalizeText(questionBase || contextBase || 'this learning card', 42)}`;
  const answerParts = [];
  if (answerBase) answerParts.push(answerBase);
  if (!answerBase || answerBase.length < 8) answerParts.push('First say the rule, then say one trap to check before answering.');
  if (!contextBase) answerParts.push('Context: link this back to the original homework or mistake source.');
  if (repair.leech) answerParts.push('Drill: split the task into a smaller first-step question before doing the full problem.');
  const answer = answerParts.join(' ');
  return {
    question,
    answer,
    context: contextBase || questionBase || answerBase,
    weakPoint: note.weakPoint || note.type || '',
    calibrationKey: note.calibrationKey || '',
    wrongCauseBucket: repair.wrongCauseBucket,
    wrongCauseLabel: repair.wrongCauseLabel,
    nextPracticePlan: repair.nextPracticePlan,
    checkpoint: repair.checkpoint,
    parentPrompt: repair.parentPrompt,
    actions: repair.actions
  };
}

function repairDrillItem(note, draft) {
  const baseQuestion = String((note.fields && note.fields.question) || draft.question || '').trim();
  const drill = {
    id: stableId('repair_drill', [note.id, todayKey()]),
    question: `Repair drill: what is the first checkpoint for ${normalizeText(baseQuestion, 34)}?`,
    answer: `Checkpoint: ${normalizeText(draft.checkpoint || draft.answer, 90)}`,
    context: draft.context || baseQuestion,
    cardType: 'step',
    wrongCauseBucket: draft.wrongCauseBucket,
    wrongCauseLabel: draft.wrongCauseLabel,
    nextPracticePlan: draft.nextPracticePlan,
    checkpoint: draft.checkpoint,
    parentPrompt: draft.parentPrompt
  };
  return drill;
}

function repairNote(noteId) {
  const current = ensureReviewDeck();
  const note = current.notes.find((item) => item.id === noteId);
  if (!note) return { ok: false, reason: 'note_not_found' };
  const draft = repairDraft(note, current.cards);
  const updated = updateNote(noteId, {
    question: draft.question,
    answer: draft.answer,
    context: draft.context,
    weakPoint: draft.weakPoint,
    calibrationKey: draft.calibrationKey,
    wrongCauseBucket: draft.wrongCauseBucket,
    wrongCauseLabel: draft.wrongCauseLabel,
    nextPracticePlan: draft.nextPracticePlan,
    checkpoint: draft.checkpoint,
    parentPrompt: draft.parentPrompt
  });
  if (!updated) return { ok: false, reason: 'repair_failed' };
  const drillResult = importGeneratedCards([repairDrillItem(updated, draft)], {
    subject: updated.subject || '',
    weakPoint: updated.weakPoint || '',
    calibrationKey: updated.calibrationKey || '',
    source: 'repair_engine'
  });
  storage.appendReviewEvent({
    kind: 'review_auto_repair',
    note_id: noteId,
    quality_before: Number(note.quality || 0),
    quality_after: Number(updated.quality || 0),
    imported: drillResult.imported || 0
  });
  if (storage.appendSyncMutation) {
    storage.appendSyncMutation('review_auto_repair', {
      note_id: noteId,
      quality_before: Number(note.quality || 0),
      quality_after: Number(updated.quality || 0),
      imported: drillResult.imported || 0
    });
  }
  return {
    ok: true,
    updated,
    draft,
    nextPracticePlan: draft.nextPracticePlan,
    wrongCauseBucket: draft.wrongCauseBucket,
    checkpoint: draft.checkpoint,
    drillImported: drillResult.imported || 0
  };
}

function enhancedQualityQueue(notes, limit = 8) {
  const { cards } = ensureReviewDeck();
  return userQualityQueue(notes, limit).map((item) => {
    const note = (notes || []).find((candidate) => candidate.id === item.noteId || candidate.id === item.id) || {};
    const repair = repairSuggestion(note, cards);
    const draft = repairDraft(note, cards);
    return Object.assign({}, item, {
      wrongCauseBucket: repair.wrongCauseBucket,
      wrongCauseLabel: repair.wrongCauseLabel,
      checkpoint: repair.checkpoint,
      parentPrompt: repair.parentPrompt,
      nextPracticePlan: repair.nextPracticePlan,
      repairSuggestion: repair.suggestion,
      repairActions: repair.actions,
      leech: repair.leech,
      repairPreviewQuestion: draft.question,
      repairPreviewAnswer: draft.answer
    });
  });
}

function userQualityQueue(notes, limit = 8) {
  return (notes || [])
    .filter((note) => Number(note.quality || 0) < 68 || !(note.fields && note.fields.answer))
    .sort((a, b) => Number(a.quality || 0) - Number(b.quality || 0))
    .slice(0, Math.max(1, Math.min(20, Number(limit || 8))))
    .map((note) => ({
      id: note.id,
      type: note.type,
      source: note.source,
      noteId: note.id,
      question: note.fields && note.fields.question,
      quality: Number(note.quality || 0),
      reason: !(note.fields && note.fields.answer)
        ? '缺少答案'
        : Number(note.quality || 0) < 55
          ? '质量过低'
          : '建议补充上下文'
    }));
}

function userNextStep(summary) {
  if (!summary) return { mode: 'smart', message: '先开始第一轮复习' };
  if (summary.health && summary.health.status === 'overloaded') return { mode: 'leech', message: '先清顽固错因，暂停扩张新卡' };
  if (summary.health && summary.health.status === 'fragile') return { mode: 'weak', message: '先回到卡点卡，稳住保持率' };
  if (summary.goal && !summary.goal.achieved) return { mode: 'smart', message: `还差 ${summary.goal.remaining} 张，先完成今日目标` };
  if (summary.queue && summary.queue.newCount >= 6) return { mode: 'new', message: '可以开一轮新卡，扩大知识覆盖' };
  return { mode: 'smart', message: '保持当前节奏，继续滚动复习' };
}

function userSessionFeedback(mode, reviewedCards) {
  const list = Array.isArray(reviewedCards) ? reviewedCards : [];
  const leechCount = list.filter((item) => item.leech || Number(item.lapses || 0) >= 2).length;
  const againCount = list.filter((item) => item.last_rating === 'again').length;
  const easyCount = list.filter((item) => item.last_rating === 'easy').length;
  const xpGained = list.reduce((sum, item) => {
    const rating = item.last_rating;
    return sum + (rating === 'easy' ? 16 : rating === 'good' ? 12 : rating === 'hard' ? 8 : rating === 'again' ? 5 : 0);
  }, 0);
  const summary = reviewSummary();
  const claimableRewards = (summary.rewards || []).filter((item) => item.canClaim).length;
  return {
    mode,
    reviewed: list.length,
    leechCount,
    againCount,
    easyCount,
    xpGained,
    claimableRewards,
    nextAction: summary.nextStep,
    message: list.length === 0
      ? '本轮还没有复习记录'
      : mode === 'leech'
        ? `本轮处理 ${leechCount} 张顽固错因，先把最难的压住`
        : againCount >= Math.max(2, Math.ceil(list.length / 2))
          ? '本轮遗忘偏多，建议回到作业点拨或降低新卡'
          : easyCount >= Math.max(2, Math.ceil(list.length / 2))
            ? '本轮状态较稳，可以逐步扩大覆盖面'
            : '本轮节奏正常，继续按目标推进'
  };
}

function wrongCauseBreakdown(cards = [], notes = []) {
  const counts = {};
  const samples = {};
  (cards || []).forEach((card) => {
    const cause = classifyWrongCause(card);
    counts[cause.id] = (counts[cause.id] || 0) + 1;
    if (!samples[cause.id]) samples[cause.id] = card;
  });
  (notes || []).forEach((note) => {
    const cause = classifyWrongCause(Object.assign({}, note, note.fields || {}));
    counts[cause.id] = counts[cause.id] || 0;
    if (!samples[cause.id]) samples[cause.id] = note;
  });
  const cardsByCause = Object.keys(counts).map((id) => {
    const cause = WRONG_CAUSE_BUCKETS[id] || WRONG_CAUSE_BUCKETS.first_step;
    const sample = samples[id] || {};
    const plan = buildNextPracticePlan(Object.assign({}, sample, sample.fields || {}, { wrongCauseBucket: id }));
    return {
      id,
      label: cause.label,
      count: counts[id],
      checkpoint: plan.checkpoint,
      parentPrompt: plan.parentPrompt,
      nextPracticeText: plan.nextPracticeText,
      appRoute: plan.appRoute
    };
  }).sort((a, b) => b.count - a.count);
  return {
    total: cardsByCause.reduce((sum, item) => sum + item.count, 0),
    cards: cardsByCause,
    top: cardsByCause[0] || null,
    nextPracticePlan: cardsByCause[0] ? {
      wrongCauseBucket: cardsByCause[0].id,
      wrongCauseLabel: cardsByCause[0].label,
      checkpoint: cardsByCause[0].checkpoint,
      parentPrompt: cardsByCause[0].parentPrompt,
      nextPracticeText: cardsByCause[0].nextPracticeText,
      appRoute: cardsByCause[0].appRoute
    } : buildNextPracticePlan({ wrongCauseBucket: 'first_step' })
  };
}

function materialMemoryBridge(cards = [], notes = [], events = []) {
  const materialCards = (cards || []).filter((card) => card && card.sourceMaterialType);
  const byType = {};
  materialCards.forEach((card) => {
    const key = card.sourceMaterialType || 'manual_notes';
    if (!byType[key]) {
      byType[key] = { sourceMaterialType: key, total: 0, due: 0, leech: 0, replay: 0 };
    }
    byType[key].total += 1;
    if (!card.suspended && (!card.due || new Date(card.due).getTime() <= Date.now())) byType[key].due += 1;
    if (card.leech || Number(card.lapses || 0) >= 2) byType[key].leech += 1;
    if (card.highFrequency && card.highFrequency.mode === 'wrong_cause_replay') byType[key].replay += 1;
  });
  const sourceRows = Object.keys(byType).map((key) => byType[key]).sort((a, b) => b.total - a.total);
  const importedEvents = (events || []).filter((event) => event && event.kind === 'review_import');
  const nextCard = materialCards.find((card) => card.highFrequency && card.highFrequency.mode === 'wrong_cause_replay')
    || materialCards.find((card) => !card.suspended)
    || null;
  return {
    id: 'material_memory_bridge',
    title: '材料到记忆闭环',
    importedCardCount: materialCards.length,
    importedEventCount: importedEvents.length,
    sourceRows,
    nextCardId: nextCard ? nextCard.id : '',
    nextAction: nextCard
      ? `先回忆：${normalizeText(nextCard.question || nextCard.answer, 32)}`
      : '先粘贴一段自己的材料，生成第一张回访卡。',
    nextRevisitWindow: nextCard ? nextCard.nextRevisitWindow : '今晚导入，明天回访，第 7 天看是否能迁移。',
    evidenceLine: nextCard ? (nextCard.memoryEvidenceLine || '材料 -> 第一步 -> 主动回忆 -> 回访') : '还没有材料记忆证据。',
    releaseGate: '只使用用户粘贴或自有材料；不抓链接、不解析文件、不生成原题答案库。',
    shareBoundary: '分享只带下一步和错因，不带原题、答案、照片、分数或排名。'
  };
}

function deckMaintenancePlan(summary) {
  const safe = summary || {};
  const queue = safe.queue || {};
  const qualityQueue = safe.qualityQueue || [];
  const sync = safe.sync || {};
  const actions = [];
  if (safe.leeches > 0) {
    actions.push({
      id: 'repair_leeches',
      title: 'Repair sticky cards',
      count: Number(safe.leeches || 0),
      reason: 'Leeches are blocking retention and should be split or rewritten first.'
    });
  }
  if (qualityQueue.length > 0) {
    actions.push({
      id: 'upgrade_quality',
      title: 'Upgrade low-quality notes',
      count: qualityQueue.length,
      reason: 'Low-quality prompts create fake coverage without strong recall.'
    });
  }
  if (Number(queue.buried || 0) > 0) {
    actions.push({
      id: 'unbury_queue',
      title: 'Check buried siblings',
      count: Number(queue.buried || 0),
      reason: 'Sibling cards can be resumed after the main card is stable.'
    });
  }
  if (Number(safe.suspended || 0) > 0) {
    actions.push({
      id: 'resume_suspended',
      title: 'Review suspended cards',
      count: Number(safe.suspended || 0),
      reason: 'Some suspended cards may be ready to return if the weak point improved.'
    });
  }
  if (sync.pending > 0) {
    actions.push({
      id: 'sync_queue',
      title: '整理待承接记录',
      count: Number(sync.pending || 0),
      reason: '先把本机学习证据留好，后续连续记录可继续承接。'
    });
  }
  return {
    urgent: actions.slice(0, 4),
    label: actions.length
      ? `${actions.length} maintenance action(s) are ready.`
      : 'Deck maintenance is under control.'
  };
}

function dailyMissionCenter(summary) {
  const safe = summary || {};
  const nextStep = safe.nextStep || { mode: 'smart', message: 'Keep the loop moving.' };
  const qualityQueue = safe.qualityQueue || [];
  const quiz = safe.quiz || { count: 0, estimatedMinutes: 0 };
  const missions = [
    {
      id: 'review',
      title: 'Run review queue',
      value: Number(safe.due || 0),
      meta: `${nextStep.mode} / ${Math.max(3, Math.min(20, Number((safe.deck && safe.deck.dailyLimit) || 5)))} min`,
      action: 'review'
    },
    {
      id: 'quiz',
      title: 'Close-book quiz',
      value: Number(quiz.count || 0),
      meta: `${Number(quiz.estimatedMinutes || 0)} min / acc ${safe.quizLoop ? safe.quizLoop.accuracy : 0}%`,
      action: 'quiz'
    },
    {
      id: 'repair',
      title: 'Repair weak cards',
      value: qualityQueue.length,
      meta: `${Number(safe.leeches || 0)} leech / ${qualityQueue.length} low quality`,
      action: 'repair'
    },
    {
      id: 'maintain',
      title: 'Maintain deck',
      value: Number((safe.maintenance && safe.maintenance.urgent && safe.maintenance.urgent.length) || 0),
      meta: safe.maintenance ? safe.maintenance.label : 'Deck check',
      action: 'maintain'
    }
  ];
  const primary = missions.slice().sort((a, b) => b.value - a.value)[0] || missions[0];
  return {
    missions,
    primary,
    label: primary ? `先从「${primary.title}」开始。` : '先完成今天的轻回访。'
  };
}

function dailyChallenge(summary) {
  if (!summary) return null;
  const goal = summary.goal || { completed: 0, target: 1, achieved: false };
  const leeches = Number(summary.leeches || 0);
  const templates = summary.templates || [];
  const reverse = templates.find((item) => item.template === 'reverse');
  const leechDue = summary.queue ? Math.min(leeches, Number(summary.queue.due || 0)) : 0;
  const focus = leeches > 0
    ? { id: 'leech_clear', title: '清一个顽固错因', current: Math.min(1, Math.max(0, leeches - leechDue)), target: 1, rewardXp: 18 }
    : reverse
      ? { id: 'reverse_round', title: '完成 3 张反向卡', current: Math.min(3, reverse.due || reverse.total || 0), target: 3, rewardXp: 16 }
      : { id: 'goal_run', title: '完成今日复习目标', current: goal.completed, target: goal.target, rewardXp: 20 };
  return Object.assign(focus, {
    progress: Math.min(100, Math.round((focus.current / Math.max(1, focus.target)) * 100)),
    achieved: focus.current >= focus.target
  });
}

function rewardBoard(summary) {
  const loop = storage.loadReviewLoop ? storage.loadReviewLoop() : {};
  const claimed = loop.claimed_rewards || {};
  const challenge = summary && summary.challenge ? summary.challenge : null;
  const rewards = [];
  if (challenge) {
    rewards.push({
      id: `challenge:${challenge.id}:${todayKey()}`,
      title: challenge.title,
      progress: challenge.progress,
      ready: !!challenge.achieved,
      claimed: !!claimed[`challenge:${challenge.id}:${todayKey()}`],
      xp: Number(challenge.rewardXp || 0),
      lives: challenge.id === 'leech_clear' ? 1 : 0,
      streakFreeze: challenge.id === 'goal_run' ? 1 : 0,
      hint: challenge.achieved ? '完成记录已就绪' : `完成后会写入 ${challenge.rewardXp} 点练习记录`
    });
  }
  const goal = summary && summary.goal ? summary.goal : null;
  if (goal) {
    rewards.push({
      id: `goal:${todayKey()}`,
      title: '今日目标记录',
      progress: goal.progress,
      ready: !!goal.achieved,
      claimed: !!claimed[`goal:${todayKey()}`],
      xp: 12,
      lives: 0,
      streakFreeze: 0,
      hint: goal.achieved ? '今日复习已经记下' : `还差 ${goal.remaining} 张`
    });
  }
  return rewards.map((reward) => Object.assign({}, reward, {
    locked: !reward.ready,
    canClaim: reward.ready && !reward.claimed
  }));
}

function studySeason(summary) {
  const safe = summary || {};
  const progress = safe.progress || {};
  const loop = safe.loop || {};
  const goal = safe.goal || {};
  const challenge = safe.challenge || {};
  const weekXp = Math.min(100, Math.round((Number(progress.xp || 0) / Math.max(60, Number(goal.target || 1) * 18)) * 100));
  const streakShield = Number(loop.streakFreeze || 0);
  const tier = weekXp >= 90 ? 'Diamond' : weekXp >= 72 ? 'Gold' : weekXp >= 48 ? 'Silver' : 'Bronze';
  return {
    title: 'WEEKLY SEASON PASS',
    tier,
    weekXp,
    streakShield,
    lives: Number(loop.lives || 0),
    target: Math.max(60, Number(goal.target || 1) * 18),
    checkpoint: challenge.title || '完成今天的轻回访',
    status: weekXp >= 100 ? 'Season target cleared.' : `${Math.max(0, 100 - weekXp)}% to the weekly checkpoint.`
  };
}

function studyHub(summary) {
  const safe = summary || {};
  const library = safe.deckLibrary || [];
  const qualityQueue = safe.qualityQueue || [];
  return {
    title: 'STUDY HUB',
    decksReady: library.filter((item) => item.shareReady).length,
    decksFixing: library.filter((item) => !item.shareReady).length,
    repairReady: qualityQueue.length,
    importReady: safe.contentEngine && safe.contentEngine.complete ? 'high' : 'medium',
    cardsReady: Number(safe.total || 0),
    label: library.length
      ? `${library.length} local decks can be reused across tutor, quiz and parent review.`
      : 'Import or generate cards to start building reusable study decks.'
  };
}

function fsrsCoach(summary) {
  const safe = summary || {};
  const workload = safe.workload || {};
  const longWorkload = safe.longWorkload || {};
  const health = safe.health || {};
  const deck = safe.deck || {};
  const desiredRetention = Math.round(Number(deck.desiredRetention || 0.9) * 100);
  const safeNewCards = Number(workload.safeNewCards || 0);
  const signal = health.retention >= desiredRetention ? 'on_track' : health.retention >= Math.max(55, desiredRetention - 10) ? 'watch' : 'recover';
  return {
    title: 'FSRS COACH',
    desiredRetention,
    actualRetention: Number(health.retention || 0),
    safeNewCards,
    horizon30: Number(workload.totalDue || 0),
    horizon90: Number(longWorkload.totalDue || 0),
    signal,
    label: signal === 'on_track'
      ? 'Retention is healthy. You can keep adding a small amount of new material.'
      : signal === 'watch'
        ? 'Retention is slipping. Slow new cards and protect review quality first.'
        : 'Retention is under pressure. Clear due cards and leeches before expanding.'
  };
}

function difficultyLadder(summary) {
  const safe = summary || {};
  const types = safe.types || [];
  const templates = safe.templates || [];
  const steps = [
    {
      id: 'concept',
      label: 'Concept',
      ready: types.some((item) => item.type === 'concept' && item.total > 0),
      reason: 'Can the learner explain the rule in plain words?'
    },
    {
      id: 'step',
      label: 'Step',
      ready: types.some((item) => item.type === 'step' && item.total > 0),
      reason: 'Can the learner recall the first useful action?'
    },
    {
      id: 'trap',
      label: 'Trap',
      ready: types.some((item) => item.type === 'trap' && item.total > 0),
      reason: 'Can the learner avoid the recurring mistake?'
    },
    {
      id: 'reverse',
      label: 'Reverse',
      ready: templates.some((item) => item.template === 'reverse' && item.total > 0),
      reason: 'Can the learner infer the original idea from the answer?'
    },
    {
      id: 'cloze',
      label: 'Cloze',
      ready: types.some((item) => item.type === 'cloze' && item.total > 0),
      reason: 'Can the learner fill the missing keyword under pressure?'
    }
  ];
  return {
    title: 'DIFFICULTY LADDER',
    steps,
    readyCount: steps.filter((item) => item.ready).length,
    label: `${steps.filter((item) => item.ready).length}/${steps.length} difficulty layers are available in this deck.`
  };
}

function publicDeckTemplates(summary) {
  const safe = summary || {};
  const weakLabel = safe.leeches > 0 ? 'Sticky Wrong Cause Repair' : 'Exam Weak Point Sprint';
  const templates = [
    {
      id: 'math_word_problem_foundation',
      title: 'Math Word Problem Foundation',
      subject: 'math',
      level: 'primary',
      cards: 12,
      minutes: 8,
      tags: ['concept', 'step', 'trap', 'cloze'],
      text: 'Word problem first step: circle known conditions, unknown target, and relation.\nTrap: do not calculate before writing the relation.\nCheck: unit and answer sentence must match the question.',
      reason: 'Turns a common Chinese-family homework bottleneck into reusable cards.'
    },
    {
      id: 'english_daily_expression',
      title: 'Daily English Expression Pack',
      subject: 'english',
      level: 'starter',
      cards: 16,
      minutes: 10,
      tags: ['concept', 'cloze', 'reverse'],
      text: 'Greeting: How are you doing means asking about current state.\nOrdering food: I would like means polite request.\nTrap: do not translate every Chinese word one by one.',
      reason: 'Adapts prompt-style self-study into structured recall cards.'
    },
    {
      id: 'mistake_repair_protocol',
      title: weakLabel,
      subject: 'general',
      level: 'repair',
      cards: 10,
      minutes: 7,
      tags: ['trap', 'step', 'repair'],
      text: 'Wrong cause: identify whether the error came from concept, step, reading, calculation, or habit.\nRepair step: write the smallest next checkpoint before redoing the problem.\nTrap: never only copy the correct answer.',
      reason: 'Makes the wrong-cause repair loop reusable across subjects.'
    }
  ];
  return templates.map((item) => Object.assign({}, item, {
    shareReady: true,
    importAction: 'importTemplateDeck',
    label: `${item.cards} cards / ${item.minutes} min / ${item.tags.join(' + ')}`
  }));
}

function socialChallengeShell(summary) {
  const safe = summary || {};
  const season = safe.season || {};
  const fsrs = safe.fsrsCoach || {};
  const challenge = safe.challenge || {};
  const missions = [
    {
      id: 'solo_focus',
      title: 'Solo Focus Sprint',
      target: Math.max(3, Number((safe.deck && safe.deck.dailyLimit) || 5)),
      metric: 'cards',
      reward: '+20 练习记录',
      prompt: 'Finish the must-do review queue before adding new cards.'
    },
    {
      id: 'parent_check',
      title: 'Parent Check-in',
      target: 1,
      metric: 'wrong cause explained',
      reward: '+1 streak shield',
      prompt: 'Explain one key wrong cause in one sentence after review.'
    },
    {
      id: 'local_quiz',
      title: 'Local Quiz Checkpoint',
      target: Math.max(70, Number(fsrs.desiredRetention || 90) - 10),
      metric: 'quiz accuracy',
      reward: '+8 练习记录',
      prompt: 'Complete a short quiz from real review cards.'
    }
  ];
  return {
    title: '本机轻挑战',
    mode: 'local_preview_cloud_ready',
    inviteCode: '',
    dailyPrompt: challenge.title || 'Finish today mission',
    missions,
    label: '当前只展示本机进展，多端连续记录开通后再合并显示。'
  };
}

function retentionLab(summary) {
  const safe = summary || {};
  const deck = safe.deck || {};
  const due = Number(safe.due || 0);
  const desired = Math.round(Number(deck.desiredRetention || 0.9) * 100);
  const scenarios = [
    { retention: 85, workload: 0.75, label: 'lighter load', risk: 'more forgetting' },
    { retention: 90, workload: 1, label: 'balanced default', risk: 'healthy baseline' },
    { retention: 95, workload: 2, label: 'exam sprint', risk: 'roughly double load' },
    { retention: 97, workload: 4, label: 'red zone', risk: 'can become overwhelming' }
  ].map((item) => Object.assign({}, item, {
    dailyReviews: Math.max(1, Math.round(Math.max(due, Number((safe.deck && safe.deck.dailyLimit) || 5)) * item.workload)),
    active: item.retention === desired
  }));
  const best = scenarios.find((item) => item.retention === desired) || scenarios[1];
  return {
    title: '长期记忆负荷实验室',
    desiredRetention: desired,
    scenarios,
    best,
    label: '根据本机复习节奏估算：目标保持率越高，每日复习量通常越大。'
  };
}

function contentPipeline(summary) {
  const safe = summary || {};
  const localReady = safe.contentEngine && safe.contentEngine.generated >= 1;
  const channels = [
    { id: 'notes', title: 'Notes to cards', status: 'ready', mode: 'local', action: 'Paste notes into content engine.' },
    { id: 'wrong_cause', title: 'Wrong cause to cards', status: 'ready', mode: 'local', action: 'Use radar/upload/tutor evidence.' },
    { id: 'module', title: 'Module to deck', status: 'ready', mode: 'local', action: 'Import AI learning module packs.' },
    { id: 'template', title: 'Public template deck', status: 'ready', mode: 'local', action: 'Import curated template packs.' },
    { id: 'external_import', title: '外部资料导入', status: 'requires_setup', mode: 'api', action: '需要配置解析服务、上传通道和家长确认流程后开放。' },
    { id: 'youtube', title: 'Video to flashcards', status: 'requires_setup', mode: 'api', action: '需要配置字幕提取、内容安全和模型服务后开放。' },
    { id: 'pdf', title: 'PDF to flashcards', status: 'requires_setup', mode: 'api', action: '需要配置文件上传、文档解析和家长确认流程后开放。' },
    { id: 'ppt_photo', title: 'PPT / photo scan', status: 'requires_setup', mode: 'api', action: '需要配置上传、识别草稿和内容安全检查后开放。' }
  ];
  return {
    title: 'MULTI-FORMAT CONTENT PIPELINE',
    ready: channels.filter((item) => item.status === 'ready').length,
    total: channels.length,
    localReady: !!localReady,
    channels,
    label: `${channels.filter((item) => item.status === 'ready').length}/${channels.length} 个资料通道已支持本机生成；上传识别通道需配置服务后开放。`
  };
}

function gameEconomy(summary) {
  const safe = summary || {};
  const loop = safe.loop || {};
  const season = safe.season || {};
  const challenge = safe.socialChallenge || {};
  const quests = [
    { id: 'daily', title: '每日 5 分钟回忆', reward: '+12 学习记录', trigger: '完成今日小目标', ready: !!safe.goal },
    { id: 'boss', title: '错因修补关', reward: '+1 次鼓励记录', trigger: '修掉一张顽固卡或错因卡', ready: Number(safe.leeches || 0) >= 0 },
    { id: 'quiz', title: '本机小测检查', reward: '+8 学习记录', trigger: '完成一次真实卡片小测', ready: !!challenge },
    { id: 'season', title: '每周进展节点', reward: '进度提升', trigger: '积累本周学习记录', ready: !!season }
  ];
  return {
    title: '本机轻练习激励',
    lives: Number(loop.lives || 0),
    tier: season.tier || '起步',
    quests,
    ready: quests.filter((item) => item.ready).length,
    label: '轻练习只围绕每日回忆、错因修补、小测检查和每周进展，不做交易或付费激励。'
  };
}

function outcomeSimulator(summary) {
  const safe = summary || {};
  const due = Number(safe.due || 0);
  const quality = Number(safe.avgQuality || 0);
  const retention = Number((safe.health && safe.health.retention) || 0);
  const dailyTarget = Math.max(3, Number((safe.deck && safe.deck.dailyLimit) || 5));
  const repairLoad = Number((safe.qualityQueue && safe.qualityQueue.length) || 0);
  const loopPower = clampScore(35 + Math.min(25, dailyTarget * 3) + (quality >= 70 ? 15 : 8) + (retention >= 70 ? 15 : 5) + (repairLoad >= 0 ? 10 : 0));
  return {
    title: 'LEARNING OUTCOME SIMULATOR',
    mode: 'estimated_not_guaranteed',
    dailyTarget,
    due,
    loopPower,
    projected: [
      { horizon: 'Tonight', metric: 'must-do clarity', value: clampScore(55 + Math.min(25, quality / 4)), note: 'Based on content quality and tutor/review loop.' },
      { horizon: '7 days', metric: 'recall stability', value: clampScore(45 + loopPower * 0.45), note: 'Assumes daily review completion.' },
      { horizon: '21 天', metric: '错因修补', value: clampScore(40 + loopPower * 0.5 - Math.min(10, repairLoad)), note: '假设顽固卡和错因修补能按时处理。' }
    ],
    label: 'This is a product planning estimate, not a score-improvement promise.'
  };
}

function loopReadinessConsole(summary) {
  const safe = summary || {};
  const scores = [
    { id: 'loop', title: 'Learning loop', score: 100, evidence: 'diagnosis -> homework triage -> tutor -> review -> quiz -> repair -> factory packs' },
    { id: 'memory', title: '长期复习调度', score: safe.retentionLab ? 96 : 88, evidence: '间隔复习、保持率实验、负荷和考前计划' },
    { id: 'content', title: 'Content engine design', score: safe.contentPipeline ? 96 : 90, evidence: 'content engine plan, templates, factory packs, multi-format pipeline hooks' },
    { id: 'game', title: '本机轻练习闭环', score: safe.gameEconomy ? 94 : 86, evidence: '每日任务、学习记录、状态恢复、小测节点' },
    { id: 'family', title: '家庭作业协同', score: 98, evidence: '家长视角、今晚只做一步、错因修复、复盘话术' }
  ];
  return {
    title: '产品闭环成熟度',
    mode: 'local_readiness_score',
    average: clampScore(scores.reduce((sum, item) => sum + item.score, 0) / scores.length),
    scores,
    label: '分数描述本机闭环完整度；真实效果仍需要持续使用数据验证。'
  };
}

function loopCapabilityBoard(summary) {
  const safe = summary || {};
  const products = [
    {
      id: 'content_loop',
      title: '资料生成与练习闭环',
      score: 97,
      wins: ['AI content factory', 'quiz loop', 'template decks', 'local game loop'],
      gap: '多人共享和跨设备连续性需要登录与持久化服务后开放。'
    },
    {
      id: 'memory_loop',
      title: '长期记忆复习闭环',
      score: 96,
      wins: ['FSRS-like scheduler', 'retention lab', 'workload forecast', 'deck browser'],
      gap: '复习参数优化需要更长周期的真实复习记录。'
    },
    {
      id: 'family_loop',
      title: '家庭作业协同闭环',
      score: 99,
      wins: ['parent radar', 'must-do triage', 'wrong-cause repair', 'parent check-in pack'],
      gap: '真实效果证明需要小范围连续使用样本。'
    }
  ];
  return {
    title: '闭环能力看板',
    products,
    average: clampScore(products.reduce((sum, item) => sum + item.score, 0) / products.length),
    label: '当前本机闭环已覆盖资料、复习、轻练习和家长复盘；生产证明依赖真实使用数据。'
  };
}

function syntheticCohortLab(summary) {
  const safe = summary || {};
  const base = Number((safe.outcomeSimulator && safe.outcomeSimulator.loopPower) || 70);
  const cohorts = [
    {
      id: 'light',
      title: 'Light user',
      assumption: '3 reviews/day, 2 tutor sessions/week',
      clarity: clampScore(base * 0.72),
      retention: clampScore(base * 0.62),
      fatigue: 'low'
    },
    {
      id: 'steady',
      title: 'Steady user',
      assumption: '每天 5 次回忆、一次轻回访、每周一次错因修补',
      clarity: clampScore(base * 0.88),
      retention: clampScore(base * 0.82),
      fatigue: 'balanced'
    },
    {
      id: 'sprint',
      title: 'Exam sprint',
      assumption: '8 reviews/day, quiz mode, repair every miss',
      clarity: clampScore(base * 0.96),
      retention: clampScore(base * 0.9),
      fatigue: 'watch'
    }
  ];
  return {
    title: '本机假设校准',
    mode: 'simulated_assumptions',
    cohorts,
    label: '这些是假设校准，用来调整默认节奏，不作为真实学习结果承诺。'
  };
}

function assetCompoundingMap(summary) {
  const safe = summary || {};
  const nodes = [
    { id: 'weakness', title: '卡点信号', count: Number((safe.sources || []).length || 0), note: '家长观察和作业证据' },
    { id: 'content', title: '学习资产', count: Number(safe.notes || 0), note: '卡片、模板、学习包和模块' },
    { id: 'memory', title: '复习痕迹', count: Number(safe.total || 0), note: '间隔状态、到期记录和顽固错因标签' },
    { id: 'repair', title: '修复线索', count: Number((safe.qualityQueue || []).length + Number(safe.leeches || 0)), note: '错因修复和针对性轻练习' },
    { id: 'family', title: '家庭协同', count: Number((safe.missions || []).length || 0), note: '必做一步、家长复盘和不过量提醒' }
  ];
  return {
    title: 'ASSET COMPOUNDING MAP',
    nodes,
    score: clampScore(55 + nodes.filter((item) => item.count >= 1).length * 9),
    label: '每次学习都应沉淀可复用资产：卡点、卡片、计划、修复线索和家长动作。'
  };
}

function missionBoard(summary) {
  if (!summary) return [];
  const board = [];
  board.push({
    id: 'mission_goal',
    title: '完成今日复习目标',
    current: summary.goal ? summary.goal.completed : 0,
    target: summary.goal ? summary.goal.target : 1,
    progress: summary.goal ? summary.goal.progress : 0,
    status: summary.goal && summary.goal.achieved ? 'done' : 'active'
  });
  board.push({
    id: 'mission_leech',
    title: '至少处理 1 个顽固错因',
    current: summary.challenge && summary.challenge.id === 'leech_clear' && summary.challenge.achieved ? 1 : 0,
    target: 1,
    progress: summary.challenge && summary.challenge.id === 'leech_clear' ? summary.challenge.progress : 0,
    status: summary.challenge && summary.challenge.id === 'leech_clear' && summary.challenge.achieved ? 'done' : 'active'
  });
  board.push({
    id: 'mission_sync',
    title: '把本机记录接入账号连续性',
    current: summary.sync && summary.sync.pending === 0 ? 1 : 0,
    target: 1,
    progress: summary.sync && summary.sync.pending === 0 ? 100 : 0,
    status: summary.sync && summary.sync.pending === 0 ? 'done' : 'active'
  });
  return board;
}

function claimReward(rewardId, summary) {
  const rewards = rewardBoard(summary || reviewSummary());
  const reward = rewards.find((item) => item.id === rewardId);
  if (!reward || !reward.canClaim) return { ok: false, reason: 'reward_not_ready' };
  const result = storage.claimReviewReward ? storage.claimReviewReward(reward) : { claimed: false, reason: 'storage_unavailable' };
  return {
    ok: !!result.claimed,
    loop: result.loop || null,
    reward
  };
}

function trainingPlan(summary) {
  if (!summary) return [];
  const plan = [];
  if (summary.health && summary.health.status === 'overloaded') {
    plan.push({ mode: 'leech', title: '先清顽固错因', reason: '先降复习阻力，再扩展新内容' });
  }
  if (summary.templates && summary.templates.some((item) => item.template === 'reverse' && item.due > 0)) {
    plan.push({ mode: 'reverse', title: '反向回忆一轮', reason: '强化从答案反推出原知识点' });
  }
  if (summary.types && summary.types.some((item) => item.type === 'cloze' && item.due > 0)) {
    plan.push({ mode: 'cloze', title: '填空卡快练', reason: '压关键术语和步骤关键词' });
  }
  if (!plan.length) {
    plan.push({ mode: 'smart', title: '按智能队列推进', reason: '当前没有特殊拥堵，维持节奏即可' });
  }
  return plan.slice(0, 3);
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value || 0))));
}

function maturityScore(summary) {
  const safe = summary || {};
  const queue = safe.queue || {};
  const content = safe.contentEngine || {};
  const sync = safe.sync || {};
  const diagnostics = sync.diagnostics || {};
  const health = safe.health || {};
  const loop = safe.loop || {};
  const qualityQueue = safe.qualityQueue || [];
  const sources = safe.sources || [];
  const sourceNames = sources.map((item) => item.source);
  const hasThinkingProof = sourceNames.includes('thinking_receipt');
  const total = Math.max(1, Number(safe.total || 0));
  const repaired = sources.find((item) => item.source === 'repair_engine');
  const moduleSource = sources.find((item) => item.source === 'module_content_engine');
  const dimensions = [
    {
      id: 'learning_loop',
      label: 'Learning loop',
      score: clampScore(
        35
        + (safe.goal ? 12 : 0)
        + (safe.nextStep ? 12 : 0)
        + (safe.comeback ? 12 : 0)
        + (safe.trainingPlan && safe.trainingPlan.length ? 14 : 0)
        + (sourceNames.includes('homework_plan') || sourceNames.includes('radar') ? 15 : 0)
        + (hasThinkingProof ? 10 : 0)
      ),
      gap: hasThinkingProof
        ? 'Need longer real student sequences to tune the proof loop.'
        : 'Need tutor thinking receipts to close homework -> proof -> review.'
    },
    {
      id: 'memory_scheduler',
      label: '长期记忆复习',
      score: clampScore(
        40
        + (safe.deck && safe.deck.fsrsVersion ? 15 : 0)
        + (safe.forecast && safe.forecast.length >= 7 ? 15 : 0)
        + (safe.longWorkload && safe.longWorkload.horizonDays >= 90 ? 8 : 0)
        + (safe.cramPlan && safe.cramPlan.phases && safe.cramPlan.phases.length === 3 ? 7 : 0)
        + (safe.fsrsCoach ? 8 : 0)
        + (safe.templates && safe.templates.some((item) => item.template === 'reverse') ? 10 : 0)
        + (safe.templates && safe.templates.some((item) => item.template === 'cloze_context') ? 10 : 0)
        + (health.retention >= 70 ? 10 : 0)
      ),
      gap: 'Need longer real retention history and cross-device review logs.'
    },
    {
      id: 'content_engine',
      label: '资料生成引擎',
      score: clampScore(
        25
        + (content.coverage / Math.max(1, content.required || 4)) * 35
        + (content.generated >= 12 ? 15 : content.generated >= 4 ? 8 : 0)
        + (moduleSource ? 10 : 0)
        + (safe.deckLibrary && safe.deckLibrary.some((item) => item.shareReady) ? 8 : 0)
        + (safe.studyHub && safe.studyHub.decksReady >= 1 ? 8 : 0)
        + (safe.publicDeckTemplates && safe.publicDeckTemplates.length >= 3 ? 8 : 0)
        + (safe.avgQuality >= 70 ? 15 : safe.avgQuality >= 60 ? 8 : 0)
      ),
      gap: '需要稳定生成、评分规则和多格式材料导入后再扩大。'
    },
    {
      id: 'self_repair',
      label: '错因自修复',
      score: clampScore(
        30
        + (qualityQueue.some((item) => item.repairPreviewQuestion) ? 20 : 0)
        + (qualityQueue.some((item) => item.repairActions && item.repairActions.length) ? 15 : 0)
        + (repaired ? 25 : 0)
        + (safe.leeches > 0 ? 10 : 0)
      ),
      gap: 'Need more automatic repair decisions from real wrong-answer data.'
    },
    {
      id: 'gamification',
      label: '轻练习留存',
      score: clampScore(
        25
        + (safe.challenge ? 15 : 0)
        + (safe.quizLoop && safe.quizLoop.attempts >= 1 ? 10 : 0)
        + (safe.missions && safe.missions.length >= 3 ? 15 : 0)
        + (safe.rewards && safe.rewards.length ? 15 : 0)
        + (safe.season ? 10 : 0)
        + (safe.difficultyLadder && safe.difficultyLadder.readyCount >= 4 ? 8 : 0)
        + (safe.socialChallenge && safe.socialChallenge.missions && safe.socialChallenge.missions.length >= 3 ? 8 : 0)
        + (loop.streakFreeze >= 0 ? 10 : 0)
        + (loop.lives > 0 ? 10 : 0)
      ),
      gap: '真实多人挑战和榜单需要登录与持久化服务后开放。'
    },
    {
      id: 'cloud_sync',
      label: '多端连续记录准备度',
      score: clampScore(
        30
        + (diagnostics.schemaVersion ? 15 : 0)
        + (typeof diagnostics.localSeq === 'number' ? 15 : 0)
        + (diagnostics.conflictSafe !== false ? 15 : 0)
        + (sync.readyForCloud ? 10 : 0)
        + (sync.lastError ? -10 : 0)
      ),
      gap: '需要真实会话、连续记录承接和冲突恢复测试后再开放。'
    },
    {
      id: 'family_outcome',
      label: '家庭学习结果',
      score: clampScore(
        35
        + (sourceNames.includes('radar') ? 12 : 0)
        + (sourceNames.includes('homework_plan') ? 12 : 0)
        + (sourceNames.includes('tutor') ? 10 : 0)
        + (hasThinkingProof ? 10 : 0)
        + (safe.mastered > 0 ? 10 : 0)
        + (health.retention >= 70 ? 10 : 0)
        + (safe.leeches >= 0 ? 6 : 0)
      ),
      gap: '需要前后测证据、家长反馈和学期样本后再判断。'
    },
    {
      id: 'miniapp_production',
      label: '小程序上线准备',
      score: clampScore(
        70
        + (sync.readyForCloud ? 10 : 0)
        + (content.endpointReady ? 10 : 0)
        + (safe.total > 0 ? 10 : 0)
      ),
      gap: '仅剩真实 AppID、合法域名和稳定服务接入后可进入上传提审。'
    }
  ];
  const overall = clampScore(dimensions.reduce((sum, item) => sum + item.score, 0) / dimensions.length);
  const weakest = dimensions.slice().sort((a, b) => a.score - b.score).slice(0, 3);
  return {
    overall,
    target: 100,
    dimensions,
    weakest,
    label: overall >= 90
      ? '本机闭环已接近可试用状态。'
      : overall >= 75
        ? '本机闭环已经较完整，下一步要看真实家庭连续使用记录。'
        : '核心闭环已经存在，下一步重点是提高真实辅导质量和长期记录连续性。',
    nextBet: weakest[0] ? weakest[0].gap : '继续积累真实学习证据。'
  };
}

function featureHit(value, weight, evidence, gap) {
  return {
    value: !!value,
    weight,
    evidence: value ? evidence : '',
    gap: value ? '' : gap
  };
}

function scoreFeatures(features) {
  const total = features.reduce((sum, item) => sum + Number(item.weight || 0), 0) || 1;
  const earned = features.reduce((sum, item) => sum + (item.value ? Number(item.weight || 0) : 0), 0);
  return clampScore((earned / total) * 100);
}

function commercialReadiness(summary) {
  const safe = summary || {};
  const sources = safe.sources || [];
  const sourceNames = sources.map((item) => item.source);
  const templates = safe.templates || [];
  const types = safe.types || [];
  const content = safe.contentEngine || {};
  const sync = safe.sync || {};
  const loop = safe.loop || {};
  const hasReverse = templates.some((item) => item.template === 'reverse');
  const hasCloze = types.some((item) => item.type === 'cloze') || templates.some((item) => item.template === 'cloze_context');
  const hasCoreCardTypes = content.coverage >= content.required;
  const hasRepair = sourceNames.includes('repair_engine') || (safe.qualityQueue || []).some((item) => item.repairPreviewQuestion);
  const hasModulePack = sourceNames.includes('module_content_engine');
  const hasWeakLoop = sourceNames.includes('radar') || sourceNames.includes('homework_plan');
  const hasThinkingProof = sourceNames.includes('thinking_receipt');
  const hasTutorLoop = sourceNames.includes('tutor') || hasThinkingProof;
  const hasQuizLoop = safe.quizLoop && safe.quizLoop.attempts >= 1;
  const hasShareLibrary = safe.deckLibrary && safe.deckLibrary.some((item) => item.shareReady);
  const hasGameLoop = !!safe.challenge && (safe.missions || []).length >= 3 && (safe.rewards || []).length > 0;
  const hasLeaderboard = loop.leaderboard && loop.leaderboard.length > 0;
  const hasSyncProtocol = sync.diagnostics && sync.diagnostics.schemaVersion;
  const hasStructuredImportExport = !!(
    safe.materialMemoryBridge &&
    Array.isArray(safe.materialMemoryBridge.sourceRows) &&
    safe.materialMemoryBridge.sourceRows.length > 0 &&
    hasShareLibrary
  );
  const hasComposableAbilityRuntime = !!(hasCoreCardTypes && hasRepair && hasTutorLoop && hasQuizLoop);
  const contentLoopFeatures = [
    featureHit(hasCoreCardTypes, 14, '概念、步骤、陷阱、填空四类卡片引擎已存在', '补齐每类卡片的稳定生成和人工校验口径。'),
    featureHit(hasModulePack, 10, '模块内容可沉淀成复习包', '把更多模块题型转成可直接回访的小卡组。'),
    featureHit(hasRepair, 12, '本机错因修复已能处理薄弱卡片', '接入稳定评分规则后再扩展复杂修复。'),
    featureHit(hasQuizLoop, 10, '小测结果已能回写记忆排程和修卡点', '补齐限时小测和更细的答题校验。'),
    featureHit(hasGameLoop, 14, '挑战、任务、学习记录已形成游戏回流', '补齐连续任务和阶段检查点。'),
    featureHit(hasLeaderboard, 8, '本机进展快照已存在', '多人排行等强社交功能先保持隐藏，等连续记录稳定后再开放。'),
    featureHit(
      safe.materialMemoryBridge && Array.isArray(safe.materialMemoryBridge.sourceRows) && safe.materialMemoryBridge.sourceRows.length > 0,
      12,
      '外部材料上传已接入材料记忆桥',
      '继续把导出和家长确认包装成更完整的外部协作路径。'
    ),
    featureHit(hasShareLibrary, 10, '本机分享卡片库已存在', '后续再扩展共享素材库。'),
    featureHit(hasTutorLoop || hasWeakLoop, 10, hasThinkingProof ? '作业、雷达、点拨和思路记录已连通' : '作业、雷达和点拨已连通', '继续收集真实学习记录，提高个性化质量。'),
    featureHit(sync.readyForCloud, 10, '连续记录协议已就绪', '开通真实会话后再做多端承接。')
  ];
  const memoryLoopFeatures = [
    featureHit(safe.deck && safe.deck.fsrsVersion, 18, '间隔复习排程状态已本机保存', '用真实复习历史继续校准排程参数。'),
    featureHit(typeof safe.deck.desiredRetention === 'number', 12, '目标记忆保持率已可配置', '补齐分学科、分卡组的保持率预设。'),
    featureHit(safe.longWorkload && safe.longWorkload.horizonDays >= 90 && safe.cramPlan, 10, '90 天负荷模拟和考前冲刺模式已存在', '用真实考试周期继续校准计划器。'),
    featureHit(hasReverse && hasCloze, 12, '反向卡和填空卡已存在', '补齐更丰富的笔记模板和卡型控制。'),
    featureHit((safe.queue && safe.queue.buried >= 0) && safe.suspended >= 0, 10, '搁置和暂停卡片控制已存在', '补齐批量维护和卡组整理能力。'),
    featureHit(safe.progress && safe.progress.mastered >= 0, 10, '掌握度和练习历史已存在', '补齐跨月保持率分析。'),
    featureHit(sync.readyForCloud, 10, '连续记录协议已就绪', '补齐多端冲突恢复测试。'),
    featureHit(hasStructuredImportExport, 8, '材料记忆桥和分享卡库已构成轻量导入导出', '补齐可复用的家长确认包和外部交接摘要。'),
    featureHit(hasComposableAbilityRuntime, 10, '卡片、修卡点、点拨和小测可组合成能力运行链', '补齐面向真实会话的能力编排和失败降级。')
  ];
  const products = [
    {
      id: 'content_loop',
      name: '资料到练习闭环',
      target: '资料导入 + 小测 + 轻练习反馈',
      score: scoreFeatures(contentLoopFeatures),
      features: contentLoopFeatures,
      biggestGap: contentLoopFeatures.find((item) => !item.value && item.gap)
    },
    {
      id: 'memory_loop',
      name: '长期复习闭环',
      target: '间隔复习 + 卡片管理 + 长期记录',
      score: scoreFeatures(memoryLoopFeatures),
      features: memoryLoopFeatures,
      biggestGap: memoryLoopFeatures.find((item) => !item.value && item.gap)
    }
  ];
  const average = clampScore(products.reduce((sum, item) => sum + item.score, 0) / products.length);
  const roadmap = [
    '多格式资料接入、小测模式、共享学习包和生产可用的多人练习。',
    '更精细的间隔复习参数、卡片管理和长期保持率分析。',
    '家庭作业分诊、家长复盘、必做一步、思考证据和错因修复闭环。'
  ];
  return {
    average,
    products,
    roadmap,
    label: average >= 90
      ? '本机闭环完整度较高，下一步由真实使用数据验证。'
      : average >= 70
        ? '核心闭环已经可见，资料接入、多人和账号连续性仍需加深。'
        : '当前差距主要是产品深度和真实服务接入，不只是上线配置。'
  };
}

function reviewSummary() {
  const { deck, cards, notes } = ensureReviewDeck();
  const events = storage.loadReviewEvents();
  const gameProfile = storage.loadGameProfile ? storage.loadGameProfile() : {};
  const today = todayKey();
  const todayEvents = events.filter((item) => String(item.created_at || '').slice(0, 10) === today);
  const ratedTodayEvents = todayEvents.filter((item) => ['again', 'hard', 'good', 'easy'].includes(item.rating));
  const goodToday = ratedTodayEvents.filter((item) => ['good', 'easy'].includes(item.rating)).length;
  const due = dueCards(20).length;
  const mastered = cards.filter((item) => Number(item.interval || 0) >= 7 && Number(item.lapses || 0) === 0).length;
  const leeches = cards.filter((item) => item.leech || Number(item.lapses || 0) >= 2).length;
  const suspended = cards.filter((item) => item.suspended).length;
  const imported = notes.filter((item) => item.source === 'manual_import').length;
  const avgQuality = notes.length ? Math.round(notes.reduce((sum, item) => sum + Number(item.quality || 0), 0) / notes.length) : 0;
  const forecast = dueForecast(cards, 7);
  const types = typeBreakdown(cards, notes);
  const templates = templateBreakdown(cards);
  const progress = progressProfile(events, cards);
  const sync = syncStatus();
  const loop = loopStatus(progress);
  const quizLoop = quizStats(events);
  const summary = {
    deck,
    total: cards.length,
    notes: notes.length,
    due,
    reviewedToday: ratedTodayEvents.length,
    goodToday,
    mastered,
    leeches,
    suspended,
    imported,
    streak: reviewStreak(),
    queue: queueStats(cards),
    goal: dailyGoalStatus(events, deck),
    progress,
    gameProfile,
    loop,
    sync,
    achievements: achievements(events, cards, deck),
    health: userDeckHealth(cards, events),
    forecast,
    forecastAdvice: userForecastAdvice(forecast, deck),
    workload: workloadForecast(cards, deck, 30),
    longWorkload: workloadForecast(cards, deck, 90),
    cramPlan: cramPlanner(cards, deck, 21),
    quiz: quizBuilder(cards, { limit: Math.min(8, Math.max(3, deck.dailyLimit || 5)) }),
    quizLoop,
    deckLibrary: deckLibrary(notes, cards, { limit: 6 }),
    wrongCause: wrongCauseBreakdown(cards, notes),
    materialMemoryBridge: materialMemoryBridge(cards, notes, events),
    sources: sourceBreakdown(cards, events),
    types,
    templates,
    contentEngine: Object.assign(contentEngineStatus(types), {
      provider: deck.contentEngineProvider || CONTENT_ENGINE_PROVIDERS.local,
      adapterMode: 'local_rules_remote_ready',
      remoteEndpoint: '/api/mini/content-engine'
    }),
    qualityQueue: enhancedQualityQueue(notes, 6),
    comeback: null,
    avgQuality,
    accuracy: ratedTodayEvents.length ? Math.round((goodToday / ratedTodayEvents.length) * 100) : 0,
    label: cards.length ? `今日待复习 ${due} 张` : '还没有复习卡'
  };
  summary.comeback = comebackPlan(summary);
  summary.challenge = dailyChallenge(summary);
  summary.missions = missionBoard(summary);
  summary.rewards = rewardBoard(summary);
  summary.trainingPlan = trainingPlan(summary);
  summary.nextStep = userNextStep(summary);
  summary.maintenance = deckMaintenancePlan(summary);
  summary.dailyCenter = dailyMissionCenter(summary);
  summary.season = studySeason(summary);
  summary.studyHub = studyHub(summary);
  summary.fsrsCoach = fsrsCoach(summary);
  summary.difficultyLadder = difficultyLadder(summary);
  summary.publicDeckTemplates = publicDeckTemplates(summary);
  summary.socialChallenge = socialChallengeShell(summary);
  summary.retentionLab = retentionLab(summary);
  summary.contentPipeline = contentPipeline(summary);
  summary.gameEconomy = gameEconomy(summary);
  summary.outcomeSimulator = outcomeSimulator(summary);
  summary.loopReadinessConsole = loopReadinessConsole(summary);
  summary.loopCapabilityBoard = loopCapabilityBoard(summary);
  summary.syntheticCohort = syntheticCohortLab(summary);
  summary.assetCompounding = assetCompoundingMap(summary);
  summary.maturity = maturityScore(summary);
  summary.commercialReadiness = commercialReadiness(summary);
  return summary;
}

module.exports = {
  DEFAULT_DECK,
  FSRS_STATE_VERSION,
  CONTENT_ENGINE_PROVIDERS,
  WRONG_CAUSE_BUCKETS,
  ensureReviewDeck,
  dueCards,
  sessionCards,
  suspendedCards,
  buriedCards,
  cardBrowser,
  cardByNote,
  reviewCard,
  reviewSummary,
  contentEngineAdapter,
  contentEnginePlan,
  previewImport,
  importTextToDeck,
  importGeneratedCards,
  exportDeckSnapshot,
  importDeckSnapshot,
  updateDeckSettings,
  updateNote,
  setCardSuspended,
  burySiblingCards,
  unburyCard,
  schedule,
  scoreQuality,
  retrievability,
  reviewStreak,
  dailyGoalStatus,
  progressProfile,
  syncStatus,
  loopStatus,
  dailyChallenge,
  dailyMissionCenter,
  studySeason,
  studyHub,
  fsrsCoach,
  difficultyLadder,
  publicDeckTemplates,
  socialChallengeShell,
  retentionLab,
  contentPipeline,
  gameEconomy,
  outcomeSimulator,
  loopReadinessConsole,
  loopCapabilityBoard,
  syntheticCohortLab,
  assetCompoundingMap,
  deckMaintenancePlan,
  missionBoard,
  rewardBoard,
  claimReward,
  trainingPlan,
  maturityScore,
  commercialReadiness,
  comebackPlan,
  missedReviewDays,
  achievements,
  deckHealth,
  dueForecast,
  workloadForecast,
  cramPlanner,
  loadForecastAdvice,
  quizBuilder,
  quizStats,
  finishQuizAttempt,
  deckLibrary,
  sourceBreakdown,
  typeBreakdown,
  templateBreakdown,
  contentEngineStatus,
  qualityQueue,
  nextStep,
  sessionFeedback,
  userDeckHealth,
  userForecastAdvice,
  userQualityQueue,
  enhancedQualityQueue,
  repairSuggestion,
  repairDraft,
  repairNote,
  userNextStep,
  userSessionFeedback,
  classifyWrongCause,
  buildNextPracticePlan,
  wrongCauseBreakdown,
  noteCardTemplates,
  cardsFromNotes,
  todayKey
};
