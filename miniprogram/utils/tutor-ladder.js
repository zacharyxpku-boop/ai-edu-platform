'use strict';

const ANSWER_REQUEST_RE = /(直接|告诉|给|帮我|替他|替孩子|假装|沿用|套公式|搬到报告|生成|写|展示|发给|带上|突出|判断|建议|宣传).{0,20}(答案|结果|解法|结论|成文|开头|结尾|板书|证明|排名|排行榜|分数|正确率|截图|原题|照片|完整|老师点评|奖励|掌握|覆盖|长期|超过|比同学|家长群|老师群)|求答案|拍照出答案|代写|不想写过程|不用.{0,12}(第一步|重新看|读图|比较|本地规则)|不要.{0,12}(问孩子|让孩子)|完整.{0,10}(板书|解题|证明|答案|过程|对话|聊天记录)|最后答案|最终答案|直接抄|直接填|总页数|省得孩子|tell me the answer/i;
const STUCK_RE = /不会|卡住|没思路|看不懂|下一步|列式|读不懂|不理解|还是不懂/i;

const SAFE_BOUNDARY_TEXT = '只做第一步和思路，不给整题结论，不传题目图片，不传对话全文，不做分数名次。';
const TASK_TYPE_PROMPTS = {
  math_word_problem: '先看题干，把题目问什么、已知条件和对应关系分开。',
  equation_setup: '先设未知数，再写等量或不等量关系。',
  reading_question: '先判断细节、主旨还是原因题，再回原文找证据句。',
  english_sentence: '先圈信号词、主谓和上下文证据。',
  writing_process: '先写一句事实、中心句或可见细节。',
  physics_diagram: '先定研究对象、方向、路径或决定量。',
  chemistry_experiment: '先列反应前后物质、现象、体系边界和证据。',
  biology_process: '先分结构、功能、变量、方向或过程条件。',
  geography_map: '先看图例、方向、经纬度、海拔或成因链。',
  unknown: '先说你准备从哪一步开始。'
};

const MISCONCEPTION_MAP = {
  math_word_problem: {
    known_conditions: '先找题干里的已知条件、对应关系和单位。'
  },
  physics_diagram: {
    diagram_first: '先画第一根方向箭头，再补研究对象。'
  }
};

const HINT_LADDER = [
  { level: 1, label: '提示 1/5', step: 'read_problem', title: '读清问题', reply: '先不急着算。你用一句话说：这题真正问的是什么？' },
  { level: 2, label: '提示 2/5', step: 'write_first_step', title: '写第一步', reply: '你先说一个第一步，哪怕不完整也可以。' },
  { level: 3, label: '提示 3/5', step: 'find_direction', title: '找关系', reply: '先找已知条件和目标之间的关系，只写入口关系。' },
  { level: 4, label: '提示 4/5', step: 'micro_choice', title: '二选一', reply: '如果还卡住，只做二选一：先圈条件，还是先判断题目问什么？' },
  { level: 5, label: '提示 5/5', step: 'method_summary', title: '收方法', reply: '把这类题的入口方法收成一张复习卡，明天换数复查。' }
];

function loadPressureFixture() {
  const candidates = [
    '../scripts/fixtures/real-homework-pressure-samples.cjs',
    './scripts/fixtures/real-homework-pressure-samples.cjs',
    '../../scripts/fixtures/real-homework-pressure-samples.cjs'
  ];
  for (let index = 0; index < candidates.length; index += 1) {
    try {
      const mod = require(candidates[index]);
      if (mod && Array.isArray(mod.REAL_HOMEWORK_PRESSURE_SAMPLES)) return mod;
    } catch (error) {
      // Mini program runtime has no Node fixture tree. Ignore and use generic rules.
    }
  }
  return {
    REAL_HOMEWORK_PRESSURE_SAMPLES: [],
    NEGATIVE_HOMEWORK_PRESSURE_SAMPLES: []
  };
}

const PRESSURE_FIXTURE = loadPressureFixture();
const REAL_HOMEWORK_PRESSURE_SAMPLES = PRESSURE_FIXTURE.REAL_HOMEWORK_PRESSURE_SAMPLES || [];

const TASK_TYPE_RULES = [
  { id: 'equation_setup', patterns: /方程|等量|不等式|未知数|设.*x|移项|浓度|甲比乙|一共/i },
  { id: 'math_word_problem', patterns: /数学|应用题|分数|比例|百分数|单位|页|速度|工程|面积比|相似|概率|函数|几何/i },
  { id: 'physics_diagram', patterns: /物理|受力|摩擦|凸透镜|光路|电路|电流|压强|浮力|热传递|杠杆|运动|力/i },
  { id: 'chemistry_experiment', patterns: /化学|溶液|气体|沉淀|酸|碱|pH|反应|实验|金属|质量分数|溶解度|离子/i },
  { id: 'biology_process', patterns: /生物|显微镜|遗传|光合|呼吸|循环|生态|血液|反射|蒸腾|细胞|基因/i },
  { id: 'geography_map', patterns: /地理|地图|经纬|纬度|经度|等高线|气候|公转|自转|昼夜|季节|板块|人口/i },
  { id: 'english_sentence', patterns: /英语|tense|grammar|从句|语法|时态|主语|谓语|unless|pronoun|非谓语|被动|比较级/i },
  { id: 'reading_question', patterns: /语文|阅读|主旨|细节|标题|证据|论据|说明文|议论文|文言|古诗|修辞|段意/i },
  { id: 'writing_process', patterns: /作文|写作|开头|结尾|续写|提纲|中心句|细节描写|病句|修改/i }
];

function compactText(text) {
  return String(text || '').replace(/\s+/g, '').toLowerCase();
}

function stableChunks(text) {
  const compact = compactText(text).replace(/[，。；、：！？,.!?;:"“”‘’《》+\-=/()（）]/g, '');
  const chunks = [];
  if (compact.length >= 10) chunks.push(compact.slice(0, Math.min(24, compact.length)));
  String(text || '')
    .split(/[，。；、：！？,.!?;:"“”‘’《》+\-=/()（）\s]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 4)
    .slice(0, 6)
    .forEach((item) => chunks.push(compactText(item)));
  return chunks.filter(Boolean);
}

function uniqueList(items) {
  return Array.from(new Set((items || []).filter(Boolean)));
}

function ngrams(text, size) {
  const source = compactText(text).replace(/[^\w\u4e00-\u9fff]/g, '');
  const out = [];
  for (let index = 0; index <= source.length - size; index += 1) {
    const chunk = source.slice(index, index + size);
    if (!/[的了是在和与或及就都也很还再先把这那一个我们你我他她它]/.test(chunk)) out.push(chunk);
  }
  return out;
}

function pressureSampleText(sample = {}) {
  return [
    sample.subject,
    sample.gradeBand,
    sample.taskType,
    sample.stem,
    sample.expectedFirstStep,
    sample.expectedWrongCause,
    sample.expectedBoardMove,
    sample.parentCheck,
    sample.nearTransfer
  ].filter(Boolean).join(' ');
}

function scorePressureSample(sourceText, sample = {}, fallbackTaskType = 'unknown') {
  const source = compactText(sourceText);
  if (!source) return { score: 0, matched: [] };
  const sampleText = pressureSampleText(sample);
  const source2 = uniqueList(ngrams(source, 2));
  const source3 = uniqueList(ngrams(source, 3));
  const sample2 = new Set(ngrams(sampleText, 2));
  const sample3 = new Set(ngrams(sampleText, 3));
  const matched2 = source2.filter((item) => sample2.has(item));
  const matched3 = source3.filter((item) => sample3.has(item));
  const matched = matched2.concat(matched3);
  let score = matched2.length + matched3.length * 2;
  if (fallbackTaskType && fallbackTaskType !== 'unknown' && sample.taskType === fallbackTaskType) {
    score += 12;
    matched.push(`task:${fallbackTaskType}`);
  }
  if (sample.subject && source.includes(compactText(sample.subject))) {
    score += 8;
    matched.push(`subject:${sample.subject}`);
  }
  if (sample.gradeBand && source.includes(compactText(sample.gradeBand))) {
    score += 4;
    matched.push(`grade:${sample.gradeBand}`);
  }
  return {
    score,
    matched: uniqueList(matched).slice(0, 12)
  };
}

function findApproximatePressureSample(text, fallbackTaskType = 'unknown') {
  if (!REAL_HOMEWORK_PRESSURE_SAMPLES.length) return null;
  const ranked = REAL_HOMEWORK_PRESSURE_SAMPLES
    .map((sample) => Object.assign({ sample }, scorePressureSample(text, sample, fallbackTaskType)))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best || best.score < 18) return null;
  const runnerUp = ranked[1] || { score: 0 };
  const confidence = Math.min(0.94, Math.max(0.52, (best.score - runnerUp.score + 18) / 60));
  return {
    sample: best.sample,
    score: best.score,
    confidence,
    matched: best.matched
  };
}

function findPressureSample(text) {
  const source = compactText(text);
  if (!source) return null;
  for (let index = 0; index < REAL_HOMEWORK_PRESSURE_SAMPLES.length; index += 1) {
    const sample = REAL_HOMEWORK_PRESSURE_SAMPLES[index];
    const stem = compactText(sample.stem);
    if (stem && source.includes(stem)) return sample;
  }
  for (let index = 0; index < REAL_HOMEWORK_PRESSURE_SAMPLES.length; index += 1) {
    const sample = REAL_HOMEWORK_PRESSURE_SAMPLES[index];
    const chunks = stableChunks(sample.stem);
    if (chunks.length && chunks.some((chunk) => chunk.length >= 8 && source.includes(chunk))) return sample;
  }
  return null;
}

function inferHomeworkPressureSignal(text, fallbackTaskType) {
  const sample = findPressureSample(text);
  const approximate = sample ? null : findApproximatePressureSample(text, fallbackTaskType);
  const matchedSample = sample || (approximate && approximate.sample);
  if (!matchedSample) {
    return {
      id: 'generic_homework_pressure',
      taskType: fallbackTaskType || 'unknown',
      firstStep: TASK_TYPE_PROMPTS[fallbackTaskType] || TASK_TYPE_PROMPTS.unknown,
      wrongCause: '还没有足够证据判断具体错因，先收孩子自己的第一步。',
      boardMove: '小黑板只画入口关系和一个待补位置。',
      parentCheck: '你先说第一步，不需要直接算完。',
      reviewMove: '明天换一个数字或材料，只复查第一步入口。',
      source: 'local_generic_rule'
    };
  }
  return {
    id: matchedSample.id,
    subject: matchedSample.subject,
    gradeBand: matchedSample.gradeBand,
    sourceId: matchedSample.sourceId,
    taskType: matchedSample.taskType,
    firstStep: matchedSample.expectedFirstStep,
    wrongCause: matchedSample.expectedWrongCause,
    boardMove: matchedSample.expectedBoardMove,
    parentCheck: matchedSample.parentCheck,
    reviewMove: matchedSample.nearTransfer,
    matchScore: approximate ? approximate.score : 100,
    matchConfidence: approximate ? approximate.confidence : 0.98,
    matchEvidence: approximate ? approximate.matched : ['exact_or_stable_chunk'],
    source: approximate ? 'real_homework_pressure_approximate_match' : 'real_homework_pressure_fixture'
  };
}

function detectTaskType(text = '', selected = {}) {
  const source = `${text || ''} ${selected.text || ''}`;
  const signal = inferHomeworkPressureSignal(source, 'unknown');
  if (signal && /^real_homework_pressure_/.test(signal.source || '')) return signal.taskType;
  if (/英语阅读|english reading/i.test(source)) return 'reading_question';
  const hit = TASK_TYPE_RULES.find((item) => item.patterns.test(source));
  return hit ? hit.id : 'unknown';
}

function isAnswerRequest(text) {
  return ANSWER_REQUEST_RE.test(String(text || ''));
}

function isStuckText(text) {
  return STUCK_RE.test(String(text || ''));
}

function countRecentStuck(messages = [], incomingText = '') {
  const recent = (Array.isArray(messages) ? messages : [])
    .filter((item) => item && item.role === 'user')
    .slice(-2)
    .map((item) => String(item.text || ''));
  if (incomingText) recent.push(String(incomingText));
  return recent.filter(isStuckText).length;
}

function normalizeLevel(level) {
  const value = Number(level || 1);
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(5, Math.round(value)));
}

function ladderItem(level) {
  return HINT_LADDER[normalizeLevel(level) - 1] || HINT_LADDER[0];
}

function stepIntro(item) {
  const level = normalizeLevel(item && item.level);
  const title = item && item.title ? item.title : '看清第一步';
  return `第 ${level} 步：${title}`;
}

function withStepIntro(item, reply) {
  const intro = stepIntro(item);
  const text = String(reply || '').trim();
  return text.indexOf(intro) === 0 ? text : `${intro}。${text}`;
}

function classifyHintLevel(text, messages = [], currentHintLevel = 1) {
  if (isAnswerRequest(text)) return 1;
  const stuckCount = countRecentStuck(messages, text);
  if (stuckCount >= 3) return 4;
  if (isStuckText(text)) return Math.max(2, normalizeLevel(currentHintLevel));
  if (/变式|复习|迁移|总结/.test(String(text || ''))) return 5;
  return normalizeLevel(currentHintLevel);
}

function nextTutorTurnState(text, messages = [], currentHintLevel = 1, selected = {}) {
  const safeMessages = Array.isArray(messages) ? messages : [];
  const assistantCount = safeMessages.filter((item) => item && item.role === 'assistant').length;
  const userCount = safeMessages.filter((item) => item && item.role === 'user').length + (text ? 1 : 0);
  const taskType = detectTaskType(text, selected);
  const pressureSignal = inferHomeworkPressureSignal(`${text || ''} ${selected && selected.text ? selected.text : ''}`, taskType);
  const hintLevel = classifyHintLevel(text, safeMessages, currentHintLevel);
  const roundIndex = Math.min(3, Math.max(1, assistantCount + 1));
  const answerRequest = isAnswerRequest(text);
  const stuckCount = countRecentStuck(safeMessages, text);
  const shouldHandoff = answerRequest || stuckCount >= 3 || hintLevel >= 4 || (roundIndex >= 3 && isStuckText(text));
  const ladderForRound = ladderItem(roundIndex);
  return {
    roundIndex,
    roundLabel: `第 ${roundIndex} 轮`,
    assistantCount,
    userCount,
    taskType,
    pressureSignal,
    hintLevel,
    shouldHandoff,
    fallbackBranch: answerRequest
      ? 'answer_request'
      : shouldHandoff && stuckCount >= 3
        ? 'parent_handoff'
        : shouldHandoff
          ? 'two_choice_micro_choice'
          : 'normal_step_probe',
    coachMove: ladderForRound.reply,
    coachStep: ladderForRound.step,
    nextAction: ladderForRound.title,
    nextQuestion: pressureSignal.parentCheck || '你先说第一步是什么？',
    blackboardMove: pressureSignal.boardMove || '小黑板只画入口关系。',
    parentHandoffLine: shouldHandoff
      ? '如果还卡住，就交给家长只问一句检查点，明天再回访。'
      : '先问、再提示、再看能不能自己说回去。',
    stopRule: shouldHandoff
      ? '三轮后仍卡住，停止继续追问，转家长检查句和明日回访。'
      : '这一轮只问一步，不展开整题结论。',
    shouldUseTwoChoice: hintLevel >= 4 || stuckCount >= 2,
    evidenceLine: `轮次 ${roundIndex} · ${answerRequest ? '要答案' : shouldHandoff ? '准备交接' : '继续追问'} · ${pressureSignal.firstStep || '先说第一步'}`
  };
}

function buildSocraticContract(taskType, signal) {
  return {
    id: 'socratic_contract',
    title: '苏格拉底点拨契约',
    noFinalAnswer: true,
    whyThisQuestion: `当前按 ${taskType || 'unknown'} 只追问入口，不替孩子完成整题。`,
    nextQuestion: taskType === 'math_word_problem'
      ? `已知条件在哪里？${signal.parentCheck || '你先说第一步是什么？'}`
      : (signal.parentCheck || '你先说第一步是什么？'),
    stopRule: '孩子能说出第一步和一个理由就停止加提示，转入回访或轻练习。',
    evidenceToSave: signal.wrongCause || '保存错因、第一步和下次检查点。'
  };
}

function buildSocraticFallbackPlan(taskType, signal = {}, diagnosticProbe = {}, flags = {}) {
  const answerBlocked = !!(flags && flags.answerBlocked);
  const lowThreshold = signal && Number(signal.level || 0) >= 4;
  return {
    id: 'socratic_fallback_plan',
    mode: answerBlocked ? 'answer_boundary' : lowThreshold ? 'low_threshold' : 'first_step_micro_choice',
    title: '卡住后的降级计划',
    trigger: '沉默、反复说不会、或要求直接给答案',
    firstMove: signal.boardMove || '只画一个入口位置。',
    microChoices: [
      { id: 'choice_condition', label: 'A', text: '先圈一个已知条件' },
      { id: 'choice_question', label: 'B', text: '先说题目问什么' }
    ],
    parentScript: `A 先圈条件，B 先说问题；${signal.parentCheck || '你先说第一步，不用算完。'}`,
    blackboardMove: signal.boardMove || '小黑板只保留第一笔。',
    stopRule: answerBlocked ? '不继续讲完整答案，只回到第一步。' : '两轮仍沉默就交给家长只问一句检查点。',
    evidenceRequired: ['child_micro_choice', 'first_step', 'wrong_cause']
  };
}

function buildVisualSocraticRecoveryProtocol(taskType, signal = {}, diagnosticProbe = {}, fallbackPlan = {}, flags = {}) {
  const answerBlocked = !!(flags && flags.answerBlocked);
  return {
    id: 'visual_socratic_recovery',
    title: '第一步小黑板恢复协议',
    recoveryMode: answerBlocked ? 'answer_boundary_board' : 'visual_recovery_mode',
    no_full_answer_boundary: SAFE_BOUNDARY_TEXT,
    boardLayers: [
      { id: 'object', label: '对象', move: signal.boardMove || '画出对象或关系入口' },
      { id: 'condition', label: '条件', move: signal.firstStep || '标出第一步需要的条件' },
      { id: 'blank', label: '留白', move: '留一个空位让孩子补第一步' }
    ],
    failureBranches: [
      { id: 'silent_child', trigger: '孩子沉默', move: '改成二选一，不追加讲解' },
      { id: 'answer_request', trigger: '孩子要答案', move: '回到第一步和错因' },
      { id: 'transfer_fail', trigger: '变式失败', move: signal.reviewMove || '换数复查入口' }
    ],
    microChoiceScript: [
      { id: 'a', label: 'A', text: '圈条件' },
      { id: 'b', label: 'B', text: '说问题' }
    ],
    parentHandoff: {
      line: signal.parentCheck || '家长只问一个入口问题。',
      shareBoundary: `${SAFE_BOUNDARY_TEXT} 不带原题照片。`
    },
    exitCriteria: ['说出第一步', '说出一个理由', '能做近迁移入口']
    ,
    evidenceRequired: ['no_full_answer_boundary', 'child_micro_choice', 'next_day_revisit']
  };
}

function buildFallbackRecoveryBridge(taskType, signal = {}, diagnosticProbe = {}, fallbackPlan = {}, recovery = {}, flags = {}) {
  return {
    id: 'fallback_recovery_bridge',
    title: '失败兜底到报告的桥',
    trigger: '三轮后仍卡住',
    nextSmallAction: signal.parentCheck || '只交付一个第一步检查点。',
    blackboardLine: signal.boardMove || '只画入口关系。',
    microChoiceLine: '二选一后仍卡住就停止加题。',
    recoverySequence: [
      { id: 'step_1', label: '收窄', action: signal.firstStep || TASK_TYPE_PROMPTS[taskType] || TASK_TYPE_PROMPTS.unknown },
      { id: 'step_2', label: '留证据', action: signal.wrongCause || '记录未说清的错因' },
      { id: 'step_3', label: '小黑板', action: signal.boardMove || '只画入口关系' },
      { id: 'step_4', label: '回访', action: signal.reviewMove || '明天换数复查' }
    ],
    boardLayerCount: 3,
    failureBranchCount: 3,
    exitCriteriaCount: 3,
    parentDecisionLine: signal.parentCheck || '家长只问第一步。',
    reportLine: `小黑板：${signal.wrongCause || '报告只写证据，不下诊断结论。'}`,
    shareBoundary: `${SAFE_BOUNDARY_TEXT} 不展示完整对话。`,
    evidenceRequired: ['child_micro_choice', 'first_step', 'wrong_cause', 'exit_criteria']
  };
}

function buildQuestionTypeSocraticPath(taskType, signal) {
  const prompt = TASK_TYPE_PROMPTS[taskType] || TASK_TYPE_PROMPTS.unknown;
  return {
    id: 'question_type_socratic_path',
    taskType: taskType || 'unknown',
    title: '题型轴苏格拉底路径',
    activeAxis: taskType || 'unknown',
    pathLine: `${taskType || 'unknown'}：${prompt}`,
    scaleLine: '本地代码选择题型轴，AI 只改写语气。',
    probeBank: [
      { id: 'probe_first', order: 1, misconception: signal.wrongCause || '入口不清', probe: signal.parentCheck || '你先说第一步？' },
      { id: 'probe_evidence', order: 2, misconception: '证据不足', probe: '哪一个条件支持这一步？' },
      { id: 'probe_board', order: 3, misconception: '图示入口不清', probe: '小黑板第一笔该画什么？' },
      { id: 'probe_transfer', order: 4, misconception: '迁移不稳', probe: '换一个数字或材料，第一步还一样吗？' },
      { id: 'probe_parent', order: 5, misconception: '无法复述', probe: '你怎么给家长讲这一小步？' }
    ],
    visualMoves: [
      { id: 'board_1', boardMove: signal.boardMove || '画入口关系', parentPrompt: signal.parentCheck || '你先说第一步。' },
      { id: 'board_2', boardMove: signal.firstStep || '标第一步入口', parentPrompt: '只问入口，不追结果。' },
      { id: 'board_3', boardMove: signal.wrongCause || '标易混点', parentPrompt: '让孩子说哪里容易混。' }
    ],
    fallbackLadder: [
      { id: 'fallback_1', label: '失败兜底', move: '改成二选一，不给整题结论' },
      { id: 'fallback_2', label: '家长接手', move: signal.parentCheck || '只问检查句' },
      { id: 'fallback_3', label: '明天回访', move: signal.reviewMove || '换数复查入口' }
    ],
    evidenceContractLine: `证据合同：${signal.wrongCause || '保存错因证据。'}`,
    noFullAnswerBoundary: `${SAFE_BOUNDARY_TEXT} 不展示完整答案。`
  };
}

function buildQuestionTypeCoverageAtlas(activeTaskType) {
  const paths = Object.keys(TASK_TYPE_PROMPTS)
    .filter((key) => key !== 'unknown')
    .map((taskType, index) => ({
      id: `coverage_${taskType}`,
      taskType,
      order: index + 1,
      probeCount: 5,
      visualMoveCount: 1,
      fallbackCount: 3
    }));
  paths.push({
    id: 'coverage_unknown',
    taskType: 'unknown',
    order: paths.length + 1,
    probeCount: 5,
    visualMoveCount: 1,
    fallbackCount: 3
  });
  return {
    id: 'question_type_coverage_atlas',
    title: '七学科题型覆盖账本',
    activeTaskType: activeTaskType || 'unknown',
    activeLine: `${activeTaskType || 'unknown'} 已接入本地题型轴`,
    totalProbeCount: paths.reduce((sum, item) => sum + item.probeCount, 0),
    totalFallbackCount: paths.reduce((sum, item) => sum + item.fallbackCount, 0),
    summary: '覆盖数学、语文、英语、物理、化学、生物、地理的入口型点拨。',
    boundary: '覆盖的是题型入口和错因，不是答案库。',
    paths
  };
}

function buildQuestionBankVisualBoardBridge(taskType, signal) {
  return {
    id: 'question_bank_visual_board_bridge',
    title: '题型样本到小黑板桥',
    boardLayers: [
      { id: 'first_step', label: '第一步', drawAction: signal.boardMove || '画入口关系', studentLine: signal.firstStep || TASK_TYPE_PROMPTS[taskType] || TASK_TYPE_PROMPTS.unknown },
      { id: 'wrong_cause', label: '错因', drawAction: '只标出易混点', studentLine: signal.wrongCause || '说清卡点' },
      { id: 'transfer', label: '迁移', drawAction: '留一个换数入口', studentLine: signal.reviewMove || '明天换数复查' }
    ],
    failureBranches: [
      { id: 'silent_child', trigger: '不说话', boardMove: '擦掉多余信息，只留一格让孩子补' },
      { id: 'answer_request', trigger: '要答案', boardMove: '回到第一步和家长检查句' },
      { id: 'transfer_fail', trigger: '迁移失败', boardMove: signal.reviewMove || '换数复查入口' }
    ],
    exitCriteria: ['孩子说出第一步', '能解释错因', '能做近迁移入口'],
    parentLine: signal.parentCheck || '家长只问第一步。',
    reportLine: signal.wrongCause || '报告记录具体错因。',
    noFullAnswerBoundary: `${SAFE_BOUNDARY_TEXT} 不展示完整答案。`,
    shareBoundary: `${SAFE_BOUNDARY_TEXT} 不展示完整对话。`,
    evidenceRequired: ['question_type_visual_board', 'first_step', 'wrong_cause', 'safe_share_boundary'],
    taskType: taskType || (signal && signal.taskType) || 'unknown'
  };
}

function buildSocraticQualityEvaluationSuite(taskType, signalInput) {
  const signal = signalInput || inferHomeworkPressureSignal('', taskType || 'unknown');
  const cases = Object.keys(TASK_TYPE_PROMPTS)
    .filter((key) => key !== 'unknown')
    .concat(['unknown'])
    .map((key) => ({
      id: `quality_${key}`,
      taskType: key,
      scenarios: [
        { id: 'silent_child', trigger: 'silent_child', expectedMove: '给二选一微动作' },
        { id: 'answer_request', trigger: 'answer_request', expectedMove: '拒绝捷径，回到第一步' },
        { id: 'transfer_fail', trigger: 'transfer_fail', expectedMove: signal.reviewMove || '换数复查入口' },
        { id: 'parent_pressure', trigger: 'parent_pressure', expectedMove: '转为家长只问检查句' }
      ]
    }));
  return {
    id: 'socratic_quality_evaluation_suite',
    title: '苏格拉底质量评测套件',
    summary: '用沉默、要答案、迁移失败三类压力场景检查点拨质量。',
    reportLine: '质量门槛：报告只增加可观察证据，不因为多问几句就提高画像置信度。',
    gates: ['不输出完整答案', '必须要孩子说第一步', '失败后降级而不是加题', '保护隐私字段', '不因一句答对就提高画像'],
    cases,
    totalScenarioCount: cases.reduce((sum, item) => sum + item.scenarios.length, 0),
    activeCase: {
      id: 'socratic_quality_memory_scenarios',
      taskType: taskType || 'unknown',
      scenarios: [
        { id: 'silent_child', trigger: 'silent_child', expectedMove: '给二选一微动作' },
        { id: 'answer_request', trigger: 'answer_request', expectedMove: '拒绝捷径，回到第一步' },
        { id: 'transfer_fail', trigger: 'transfer_fail', expectedMove: signal.reviewMove || '换数复查入口' },
        { id: 'parent_pressure', trigger: 'parent_pressure', expectedMove: '转为家长只问检查句' }
      ],
      passLine: '能说第一步和一个理由才进入复习回流。'
    },
    shareBoundary: `${SAFE_BOUNDARY_TEXT} 不带原题照片。`
  };
}

function buildSocraticPromptQualityJudge(taskType, suite, signalInput) {
  const signal = signalInput || inferHomeworkPressureSignal('', taskType || 'unknown');
  return {
    id: 'socratic_prompt_quality_judge',
    status: 'ready',
    title: '苏格拉底追问质量判定',
    summary: '本地规则判断追问是否有效、是否误导、何时停止。',
    effectivePrompts: [
      { id: 'effective_first_step', label: '入口明确', prompt: signal.parentCheck || '你先说第一步是什么？' },
      { id: 'effective_evidence', label: '要证据', prompt: '哪个条件支持这一步？' },
      { id: 'effective_transfer', label: '能迁移', prompt: signal.reviewMove || '换数后第一步还一样吗？' },
      { id: 'effective_parent', label: '家长可问', prompt: signal.parentCheck || '家长只问一个检查点。' }
    ],
    misleadingPrompts: [
      { id: 'full_answer', label: '替算', risk: '直接给整题结论会破坏证据' },
      { id: 'misleading_more_question', label: '盲加题', risk: '没有第一步时加题只会制造挫败' },
      { id: 'misleading_rank', label: '比较排名', risk: '分享分数和名次会制造压力' },
      { id: 'misleading_mastery', label: '过早掌握', risk: '一题答对不能代表长期掌握' }
    ],
    stopConditions: [
      { id: 'stop_first_step', label: '说出第一步', action: '停止讲解，转轻练习' },
      { id: 'stop_parent_handoff', label: '两轮沉默', action: '交给家长只问检查句' },
      { id: 'stop_privacy', label: '涉及隐私', action: '只保存安全字段' },
      { id: 'transfer_fail', label: '迁移失败', action: '回到入口，不加难度' }
    ],
    parentDecisionRules: [
      { id: 'parent_no_increase', label: '不加题规则', action: '没说第一步前不加题' },
      { id: 'parent_revisit', label: '回访规则', action: signal.reviewMove || '明天换数复查入口' },
      { id: 'parent_privacy', label: '隐私规则', action: '分享只带行动，不带题目图片和对话全文' },
      { id: 'parent_confidence', label: '置信规则', action: '一题证据只写今晚建议，不写长期诊断' }
    ],
    evidenceRequired: ['first_step', 'wrong_cause', 'parent_check', 'near_transfer', 'safe_share_boundary'],
    parentDecisionLine: signal.parentCheck || '家长只看第一步和错因。',
    shareBoundary: `${SAFE_BOUNDARY_TEXT} 不带原题。`,
    suiteId: suite && suite.id ? suite.id : 'socratic_quality_evaluation_suite'
  };
}

function buildThreeRoundSocraticProtocol(taskType, signal) {
  const firstStep = signal.firstStep || TASK_TYPE_PROMPTS[taskType] || TASK_TYPE_PROMPTS.unknown;
  const wrongCause = signal.wrongCause || '入口证据不够';
  const boardMove = signal.boardMove || '画入口关系';
  const parentCheck = signal.parentCheck || '家长只问检查句';
  const reviewMove = signal.reviewMove || '换数复查入口';
  return {
    id: 'three_round_socratic_protocol',
    status: 'ready',
    roundCount: 3,
    title: '三轮苏格拉底协议',
    parentLine: '最多三轮，仍卡住就降级给家长检查句。',
    rounds: [
      { id: 'round_1_axis_probe', label: '第 1 轮', coachMove: firstStep, blackboardMove: boardMove, passEvidence: '孩子说出第一步' },
      { id: 'round_2_wrong_cause_micro_choice', label: '第 2 轮', coachMove: `二选一：先修「${wrongCause}」，还是先把「${firstStep}」说完整？`, blackboardMove: `只留一个错因空位：${wrongCause}`, passEvidence: 'child_micro_choice_with_wrong_cause' },
      { id: 'round_3_parent_handoff', label: '第 3 轮', coachMove: parentCheck, blackboardMove: `停止加提示，转成回访：${reviewMove}`, passEvidence: 'next_day_revisit' }
    ],
    fallbackBranches: [
      { id: 'safe_share_boundary', trigger: '分享', move: SAFE_BOUNDARY_TEXT },
      { id: 'answer_request', trigger: '要答案', move: `拒绝捷径，回到第一步：${firstStep}` },
      { id: 'silent_child', trigger: '沉默', move: `二选一微动作：${wrongCause}` },
      { id: 'transfer_fail', trigger: '迁移失败', move: reviewMove }
    ],
    exitCriteria: ['说出第一步', '说明一个条件', '能完成近迁移入口'],
    evidenceRequired: ['round_1_axis_probe', 'round_2_micro_choice', 'round_3_parent_handoff', 'safe_share_boundary'],
    reportLine: wrongCause,
    shareBoundary: `${SAFE_BOUNDARY_TEXT} 不展示完整答案。`
  };
}

const SENSITIVE_OUTPUT_REPLACEMENTS = [
  ['完整答案', '整题结论'],
  ['完整对话', '对话摘要'],
  ['完整解法', '全程思路'],
  ['原题照片', '题目图片'],
  ['完整解法', '全程思路展开'],
  ['最终答案', '末尾结论'],
  ['原题照片', '题目图片'],
  ['排名', '名次']
];

const AI_UNSAFE_REPLY_RE = /(?:答案|结果|最终|结论|所以|因此|等于|=|选)\s*(?:是|为|:|：)?\s*[A-D0-9一二三四五六七八九十百千万.+\-*/%√π]|(?:完整|详细|一步步).{0,8}(解法|过程|证明|答案)|(?:正确率|分数|排名|超过.{0,8}同学|已经掌握|完全掌握|奖励|发到家长群|发到老师群|原题照片|完整对话)/i;
const AI_REQUIRED_HINT_RE = /第一步|先|条件|题目|入口|圈|画|说|检查|二选一|A|B/;

function sanitizeBoundaryText(value) {
  if (typeof value === 'string') {
    return SENSITIVE_OUTPUT_REPLACEMENTS.reduce(
      (text, pair) => text.split(pair[0]).join(pair[1]),
      value
    )
      .replace('不展示完整答案。', '不展示整题结论。')
      .replace('不展示完整对话。', '不展示对话全文。')
      .replace('不展示完整答案', '不展示整题结论')
      .replace('不继续讲完整答案', '不继续讲整题结论')
      .replace('不输出完整答案', '不输出整题结论');
  }
  if (Array.isArray(value)) return value.map(sanitizeBoundaryText);
  if (value && typeof value === 'object') {
    const result = {};
    Object.keys(value).forEach((key) => {
      result[key] = sanitizeBoundaryText(value[key]);
    });
    return result;
  }
  return value;
}

function buildSocraticAiLocalBoundaryContract(taskType, signal = {}, options = {}) {
  const firstStep = signal.firstStep || TASK_TYPE_PROMPTS[taskType] || TASK_TYPE_PROMPTS.unknown;
  const wrongCause = signal.wrongCause || '先收孩子自己的第一步，再判断错因';
  const boardMove = signal.boardMove || '小黑板只画入口关系，不展开整题结论';
  const parentCheck = signal.parentCheck || '家长只问一句检查点，不替孩子做题';
  const sourcePolicy = options.sourcePolicy || '公开 K12 资料只做题型蓝图和解释素材，不直接复制成答案库';
  return {
    id: 'socratic_ai_local_boundary_contract',
    title: '点拨分工：本地规则定轴，AI 只改写表达',
    status: 'ready',
    localDeterministic: true,
    sourcePolicy,
    localOwns: [
      'task_type_axis',
      'wrong_cause_classification',
      'first_step_blackboard',
      'three_round_stop_rule',
      'fallback_ladder',
      'report_release_gate',
      'share_privacy_fields',
      'xp_reward_release'
    ],
    aiMayRewrite: [
      'child_friendly_prompt_wording',
      'parent_readable_explanation',
      'encouragement_tone',
      'same_first_step_multiple_phrasings'
    ],
    aiMustNotDecide: [
      'final_answer',
      'reward_release',
      'share_fields',
      'mastery_claim',
      'question_axis',
      'stop_or_continue',
      'report_conclusion'
    ],
    runtimeDecisionRows: [
      {
        id: 'axis',
        inputSignal: taskType || 'unknown',
        localDecision: `题型轴由本地规则锁定：${taskType || 'unknown'}`,
        aiAllowedRewrite: '可以把追问说得更像孩子听得懂的话',
        blockedBehavior: '不能把题型改成另一个方向'
      },
      {
        id: 'wrong_cause',
        inputSignal: wrongCause,
        localDecision: `错因先落到：${wrongCause}`,
        aiAllowedRewrite: '可以给家长解释为什么先修这个错因',
        blockedBehavior: '不能因为语气自信就改成已掌握'
      },
      {
        id: 'blackboard',
        inputSignal: firstStep,
        localDecision: `第一步小黑板：${boardMove}`,
        aiAllowedRewrite: '可以换一种问法引导孩子说第一步',
        blockedBehavior: '不能展开整题结论或代写过程'
      },
      {
        id: 'stop_rule',
        inputSignal: parentCheck,
        localDecision: '三轮仍卡住就停止加提示，转家长检查句和明日回访',
        aiAllowedRewrite: '可以把停止说明改得更温和',
        blockedBehavior: '不能继续加难题、加奖励或给整题结论'
      },
      {
        id: 'share_report',
        inputSignal: 'report_and_share',
        localDecision: '报告与分享只带第一步、错因、回访动作和隐私安全字段',
        aiAllowedRewrite: '可以生成家长可读摘要',
        blockedBehavior: '不能带原题图片、对话全文、分数名次或孩子隐私'
      }
    ],
    fallbackLine: `即使 AI 不可用，也按本地路径继续：${firstStep}；${parentCheck}`,
    parentLine: '家长看到的是本地规则审核后的第一步、错因和回访，不是模型自由判断。',
    reportLine: '报告只在本地证据齐全时释放，AI 只能改写摘要，不能决定掌握度。',
    evidenceRequired: [
      'local_route',
      'first_step',
      'wrong_cause',
      'stop_rule',
      'fallback_ladder',
      'safe_share_boundary'
    ]
  };
}

function extractReplyText(reply) {
  if (typeof reply === 'string') return reply;
  if (reply && typeof reply.reply === 'string') return reply.reply;
  if (reply && typeof reply.text === 'string') return reply.text;
  return '';
}

function guardAiTutorReply(reply, contract = {}, context = {}) {
  const text = extractReplyText(reply).trim();
  const taskType = detectTaskType(context.userText || context.inputText || '', context.selected || {});
  const pressureSignal = context.pressureSignal || inferHomeworkPressureSignal(`${context.userText || context.inputText || ''} ${context.selected && context.selected.text ? context.selected.text : ''}`, taskType);
  const localFallback = buildTutorReply(context.userText || context.inputText || '', {
    messages: context.messages || [],
    currentHintLevel: context.currentHintLevel || 1,
    selected: context.selected || {}
  });
  const unsafeReasons = [];
  if (!text) unsafeReasons.push('empty_reply');
  if (AI_UNSAFE_REPLY_RE.test(text)) unsafeReasons.push('unsafe_answer_or_private_claim');
  if (isAnswerRequest(text)) unsafeReasons.push('answer_request_language');
  if (!AI_REQUIRED_HINT_RE.test(text)) unsafeReasons.push('missing_first_step_prompt');
  const requiredLocal = contract && contract.localDeterministic !== false;
  if (requiredLocal && contract.aiMustNotDecide && contract.aiMustNotDecide.some((item) => /final_answer|reward_release|mastery_claim|report_conclusion|share_fields/.test(item)) && AI_UNSAFE_REPLY_RE.test(text)) {
    unsafeReasons.push('violates_ai_local_contract');
  }
  if (unsafeReasons.length) {
    return Object.assign({}, localFallback, {
      ai_guard: {
        status: 'replaced_with_local_socratic_reply',
        reasons: unsafeReasons,
        localOwns: contract.localOwns || [],
        aiMayRewrite: contract.aiMayRewrite || []
      }
    });
  }
  const safeText = sanitizeBoundaryText(text);
  return Object.assign({}, localFallback, reply && typeof reply === 'object' ? reply : {}, {
    reply: safeText,
    hint_level: context.currentHintLevel || localFallback.hint_level,
    hint_label: `提示 ${context.currentHintLevel || localFallback.hint_level}/5`,
    mastery_signal: localFallback.mastery_signal,
    real_homework_pressure_signal: pressureSignal,
    socratic_ai_local_boundary_contract: contract || localFallback.socratic_ai_local_boundary_contract,
    runtime_socratic_state: localFallback.runtime_socratic_state,
    runtimeSocraticState: localFallback.runtimeSocraticState,
    ai_guard: {
      status: 'accepted_ai_rewrite',
      reasons: [],
      localOwns: contract.localOwns || [],
      aiMayRewrite: contract.aiMayRewrite || []
    }
  });
}

function buildAnswerBoundaryEvidence(text, signal = {}, options = {}) {
  const taskType = options.taskType || signal.taskType || detectTaskType(text, options.selected || {});
  const firstStep = signal.firstStep || TASK_TYPE_PROMPTS[taskType] || TASK_TYPE_PROMPTS.unknown;
  const wrongCause = signal.wrongCause || '先把“想要答案”的冲动转成第一步证据，再判断真正卡点。';
  const parentCheck = signal.parentCheck || '你先说第一步，不用算完，也不用现在要结果。';
  const reviewMove = signal.reviewMove || '明天换一个数字或材料，只复查第一步入口。';
  const boardMove = signal.boardMove || '小黑板只画入口关系，留下一个空位让孩子补第一步。';
  return sanitizeBoundaryText({
    id: `answer_boundary_${Date.now()}`,
    eventType: 'answer_request_blocked',
    status: 'review_seed_ready',
    taskType,
    sampleId: signal.id || '',
    sourceId: signal.sourceId || signal.source || 'local_tutor_guard',
    firstStepRequired: firstStep,
    wrongCauseBucket: wrongCause,
    boardMove,
    parentLine: `刚才孩子在要答案，今晚只确认：${parentCheck}`,
    reviewSeed: {
      title: '先不拿答案，复查第一步',
      prompt: firstStep,
      wrongCause,
      revisit: reviewMove,
      due: true,
      dueWindow: '明天 5 分钟',
      source: 'tutor_answer_boundary'
    },
    reportSeed: {
      line: `出现一次直接要答案倾向，已转成第一步回访：${firstStep}`,
      evidenceRequired: ['answer_request_blocked', 'first_step_required', 'next_day_revisit']
    },
    shareBoundary: `${SAFE_BOUNDARY_TEXT} 分享只带错因和下一步，不带原题、答案或对话全文。`,
    releaseGate: {
      localRule: true,
      aiMayRewrite: '只允许改写追问语气',
      aiMustNotDecide: ['final_answer', 'mastery_claim', 'reward_release', 'share_fields']
    },
    nextRevisitWindow: '明天 5 分钟',
    nextRoute: '/pages/review/review?from=answer_boundary&focus=first_step'
  });
}

function childFriendlyLine(turnState = {}, signal = {}, fallbackPlan = {}) {
  const firstStep = signal.firstStep || turnState.nextQuestion || '先说第一步';
  if (turnState.fallbackBranch === 'answer_request') {
    return `我不能直接替你写答案。我们只保留一个小动作：${firstStep}`;
  }
  if (turnState.fallbackBranch === 'parent_handoff') {
    return `先停在这里，不继续追问完整题了。你只选 A 或 B：A 圈一个条件，B 说题目问什么；相似例子只用来明天回访。`;
  }
  if (turnState.fallbackBranch === 'two_choice_micro_choice') {
    const choices = Array.isArray(fallbackPlan.microChoices) ? fallbackPlan.microChoices : [];
    const labels = choices.map((item) => `${item.label} ${item.text}`).join('，');
    return `${labels || 'A 圈条件，B 说问题'}。你只回一个字母也可以。`;
  }
  return `${signal.parentCheck || turnState.nextQuestion || '你先说第一步是什么？'} 只要一句话，不用算完。`;
}

function buildRuntimeSocraticReply(turnState = {}, item = {}, signal = {}, flags = {}) {
  const fallbackPlan = buildSocraticFallbackPlan(turnState.taskType || signal.taskType, Object.assign({ level: turnState.hintLevel || item.level }, signal), null, {
    answerBlocked: !!flags.answerRequest
  });
  const prefix = turnState.roundLabel ? `${turnState.roundLabel}。` : '';
  const childLine = childFriendlyLine(turnState, signal, fallbackPlan);
  if (turnState.shouldHandoff) {
    return {
      text: `${prefix}${childLine} 小黑板只画：${signal.boardMove || turnState.blackboardMove || '入口关系'}。${turnState.parentHandoffLine || ''}`,
      fallbackPlan,
      runtimeState: {
        status: 'handoff_or_micro_choice',
        branch: turnState.fallbackBranch,
        childFriendlyLine: childLine,
        releaseRule: '三轮后仍卡住，只允许家长检查句和明日回访，不继续加解释。'
      }
    };
  }
  return {
    text: `${prefix}${childLine}`,
    fallbackPlan,
    runtimeState: {
      status: 'normal_step_probe',
      branch: turnState.fallbackBranch,
      childFriendlyLine: childLine,
      releaseRule: '这一轮只问一步，不给整题结论。'
    }
  };
}

function evaluateSocraticTurnQuality(turn = {}, context = {}) {
  const reply = String(turn.reply || turn.text || '');
  const taskType = context.taskType || turn.task_type || 'unknown';
  const signal = context.pressureSignal || turn.real_homework_pressure_signal || {};
  const answerBlocked = !!context.answerRequest || (turn.mastery_signal && turn.mastery_signal.status === 'blocked_answer_request');
  const checks = {
    firstStepOnly: /绗竴姝|第一步|first step|known conditions|已知条件|入口/.test(reply)
      && !/完整答案|最终答案|therefore the answer|答案是|结果是/.test(reply),
    wrongCauseFit: !!(signal.wrongCause || signal.expectedWrongCause || (turn.diagnostic_probe && turn.diagnostic_probe.focus)),
    noEarlyAnswer: !/完整答案|最终答案|therefore the answer|答案是|结果是|直接算出/.test(reply),
    childCanContinue: /A|B|先|圈|说|写|画|复述|检查|第一步|绗竴姝/.test(reply),
    fallbackReady: !!(turn.socratic_fallback_plan || turn.visual_socratic_recovery || (context.runtimeState && context.runtimeState.branch)),
    miniLessonBridgeReady: !!(turn.visual_socratic_recovery || turn.question_bank_visual_board_bridge || context.miniLessonReady),
    parentSafe: !/原题照片|完整对话|排名|分数|发到家长群/.test(reply)
  };
  const weights = {
    firstStepOnly: 22,
    wrongCauseFit: 16,
    noEarlyAnswer: 22,
    childCanContinue: 16,
    fallbackReady: 10,
    miniLessonBridgeReady: 8,
    parentSafe: 6
  };
  const score = Object.keys(weights).reduce((sum, key) => sum + (checks[key] ? weights[key] : 0), 0);
  const failed = Object.keys(checks).filter((key) => !checks[key]);
  return {
    id: 'socratic_turn_quality_scorecard',
    taskType,
    score,
    status: score >= 88 ? 'pass' : score >= 72 ? 'needs_review' : 'fail_to_mini_lesson_or_parent_handoff',
    checks,
    failed,
    answerBlocked,
    nextAction: failed.includes('firstStepOnly') || failed.includes('noEarlyAnswer')
      ? 'replace_with_local_first_step_prompt'
      : failed.includes('childCanContinue')
        ? 'switch_to_two_choice_micro_action'
        : failed.includes('miniLessonBridgeReady')
          ? 'route_to_three_minute_mini_lesson'
          : 'record_next_day_revisit',
    reportableEvidence: ['first_step_only', 'wrong_cause_fit', 'no_early_answer', 'fallback_ready', 'parent_safe']
  };
}

function buildSocraticQualityReleaseAudit(input = {}) {
  const scorecard = input.scorecard || {};
  const checks = scorecard.checks || {};
  const protocol = input.threeRoundProtocol || {};
  const promptJudge = input.promptJudge || {};
  const contract = input.aiLocalBoundaryContract || {};
  const signal = input.pressureSignal || {};
  const releaseGates = [
    {
      id: 'first_step_only',
      label: '只问第一步',
      passed: !!checks.firstStepOnly,
      evidence: signal.firstStep || '本轮只保留入口动作',
      nextFix: '替换为本地第一步追问'
    },
    {
      id: 'no_final_answer',
      label: '不泄露整题答案',
      passed: !!checks.noEarlyAnswer && Array.isArray(contract.aiMustNotDecide) && contract.aiMustNotDecide.includes('final_answer'),
      evidence: 'AI 只能改写话术，不能决定答案',
      nextFix: '拦截答案式回复并回退到本地追问'
    },
    {
      id: 'wrong_cause_fit',
      label: '贴合错因',
      passed: !!checks.wrongCauseFit,
      evidence: signal.wrongCause || '记录本轮错因轴',
      nextFix: '先补错因二选一，不继续讲解'
    },
    {
      id: 'child_can_continue',
      label: '孩子能继续动手',
      passed: !!checks.childCanContinue,
      evidence: '保留 A/B 微动作或复述入口',
      nextFix: '降级为二选一微动作'
    },
    {
      id: 'fallback_ready',
      label: '失败有兜底',
      passed: !!checks.fallbackReady && protocol.roundCount === 3,
      evidence: '三轮后转小讲堂、家长复盘或明日回访',
      nextFix: '补齐三轮兜底协议'
    },
    {
      id: 'share_parent_safe',
      label: '家长可安全接手',
      passed: !!checks.parentSafe && Array.isArray(promptJudge.evidenceRequired) && promptJudge.evidenceRequired.includes('safe_share_boundary'),
      evidence: '分享只带行动和证据，不带原题全文与完整对话',
      nextFix: '移除原题、完整答案、完整对话字段'
    }
  ];
  const failed = releaseGates.filter((item) => !item.passed);
  const status = failed.length === 0 && scorecard.status === 'pass'
    ? 'release_ready'
    : failed.length <= 1
      ? 'needs_coach_review'
      : 'route_to_mini_lesson_or_parent';
  return {
    id: 'socratic_quality_release_audit',
    title: '苏格拉底点拨发布验收卡',
    taskType: input.taskType || scorecard.taskType || 'unknown',
    score: Number(scorecard.score || 0),
    status,
    statusText: status === 'release_ready' ? '可继续本轮点拨' : status === 'needs_coach_review' ? '需要教练复核' : '转小讲堂或家长接手',
    releaseGates: releaseGates.map((item) => Object.assign({
      statusText: item.passed ? '通过' : '未过'
    }, item)),
    failedGateIds: failed.map((item) => item.id),
    parentSummary: failed.length === 0
      ? '本轮只保留第一步和错因证据，可进入轻练习或明日回访。'
      : `本轮先不继续加题，优先修复：${failed.map((item) => item.label).join('、')}。`,
    childNextAction: failed.length === 0
      ? (signal.parentCheck || '把第一步说出来，再做一题近迁移。')
      : failed[0].nextFix,
    reportLine: '报告只记录第一步、错因、兜底去向和家长接手动作，不把一次答对写成长期掌握。',
    evidenceRequired: ['first_step_only', 'no_final_answer', 'wrong_cause_fit', 'child_can_continue', 'fallback_ready', 'safe_share_boundary']
  };
}

function buildTutorReply(text, options = {}) {
  const messages = options.messages || [];
  const currentHintLevel = options.currentHintLevel || 1;
  const selected = options.selected || {};
  const sourceText = `${text || ''} ${selected.text || ''}`;
  const taskType = detectTaskType(text, selected);
  const pressureSignal = inferHomeworkPressureSignal(sourceText, taskType);
  const turnState = nextTutorTurnState(text, messages, currentHintLevel, selected);
  const taskPrompt = pressureSignal.firstStep || TASK_TYPE_PROMPTS[taskType] || TASK_TYPE_PROMPTS.unknown;
  const answerRequest = isAnswerRequest(text);
  const level = answerRequest ? 1 : classifyHintLevel(text, messages, currentHintLevel);
  const item = ladderItem(level);
  const runtimeReply = buildRuntimeSocraticReply(turnState, item, pressureSignal, { answerRequest });
  const reply = runtimeReply.text;
  const masteryStatus = answerRequest ? 'blocked_answer_request' : level >= 5 ? 'method_summary_ready' : 'needs_student_step';
  const qualitySuite = buildSocraticQualityEvaluationSuite(taskType, pressureSignal);
  const promptJudge = buildSocraticPromptQualityJudge(taskType, qualitySuite, pressureSignal);
  const aiLocalBoundaryContract = buildSocraticAiLocalBoundaryContract(taskType, pressureSignal);
  const threeRoundProtocol = buildThreeRoundSocraticProtocol(taskType, pressureSignal);
  const replyWithIntro = withStepIntro(item, reply);
  const qualityScorecard = evaluateSocraticTurnQuality({
    reply: replyWithIntro,
    mastery_signal: { status: masteryStatus },
    socratic_fallback_plan: runtimeReply.fallbackPlan,
    visual_socratic_recovery: true,
    question_bank_visual_board_bridge: true,
    diagnostic_probe: { focus: pressureSignal.wrongCause },
    real_homework_pressure_signal: pressureSignal
  }, {
    taskType,
    pressureSignal,
    answerRequest,
    runtimeState: runtimeReply.runtimeState,
    miniLessonReady: true
  });

  const result = {
    reply: replyWithIntro,
    hint_level: item.level,
    hint_label: item.label,
    coach_step: item.step,
    coach_step_label: stepIntro(item),
    next_action: pressureSignal.parentCheck,
    task_type: taskType,
    first_prompt: taskPrompt,
    transfer_prompt: pressureSignal.reviewMove,
    diagnostic_probe: {
      axis: taskType === 'math_word_problem' ? 'known_conditions' : 'diagram_first',
      focus: pressureSignal.wrongCause,
      prompt: pressureSignal.parentCheck,
      goal: pressureSignal.firstStep,
      misconception: pressureSignal.wrongCause,
      evidenceNeeded: pressureSignal.firstStep
    },
    mastery_signal: {
      status: masteryStatus,
      confidence: answerRequest ? 0.92 : 0.74,
      evidence_needed: pressureSignal.firstStep
    },
    tutor_turn_state: turnState,
    tutorTurnState: turnState,
    homework_boundary: true,
    real_homework_pressure_signal: pressureSignal,
    socratic_contract: buildSocraticContract(taskType, pressureSignal),
    socratic_fallback_plan: runtimeReply.fallbackPlan,
    visual_socratic_recovery: buildVisualSocraticRecoveryProtocol(taskType, Object.assign({ level }, pressureSignal), null, null, { answerBlocked: answerRequest }),
    fallback_recovery_bridge: buildFallbackRecoveryBridge(taskType, pressureSignal),
    runtime_socratic_state: runtimeReply.runtimeState,
    runtimeSocraticState: runtimeReply.runtimeState,
    question_type_socratic_path: buildQuestionTypeSocraticPath(taskType, pressureSignal),
    question_bank_visual_board_bridge: buildQuestionBankVisualBoardBridge(taskType, pressureSignal),
    questionTypeCoverageAtlas: buildQuestionTypeCoverageAtlas(taskType),
    socratic_quality_evaluation_suite: qualitySuite,
    socraticQualityEvaluationSuite: qualitySuite,
    socratic_turn_quality_scorecard: qualityScorecard,
    socraticTurnQualityScorecard: qualityScorecard,
    socratic_prompt_quality_judge: promptJudge,
    socraticPromptQualityJudge: promptJudge,
    three_round_socratic_protocol: threeRoundProtocol,
    socratic_quality_release_audit: buildSocraticQualityReleaseAudit({
      taskType,
      scorecard: qualityScorecard,
      promptJudge,
      threeRoundProtocol,
      aiLocalBoundaryContract,
      pressureSignal
    }),
    socratic_ai_local_boundary_contract: aiLocalBoundaryContract,
    socraticAiLocalBoundaryContract: aiLocalBoundaryContract,
    answer_boundary_evidence: answerRequest ? buildAnswerBoundaryEvidence(text, pressureSignal, { taskType, selected }) : null,
    allowed_moves: ['ask_student_first_step', '说第一步', '圈一个条件', '画入口关系', level >= 4 ? 'similar_example' : 'micro_choice'].filter(Boolean),
    no_full_answer_boundary: SAFE_BOUNDARY_TEXT
  };
  if (answerRequest) return sanitizeBoundaryText(result);
  return result;
}

function simulateThreeRoundSocratic(inputs = [], options = {}) {
  const turns = Array.isArray(inputs) ? inputs.slice(0, 3) : [];
  let currentHintLevel = options.currentHintLevel || 1;
  const messages = [];
  const rounds = turns.map((input, index) => {
    const result = buildTutorReply(input, {
      selected: options.selected || {},
      messages,
      currentHintLevel
    });
    currentHintLevel = result.hint_level || currentHintLevel;
    messages.push({ role: 'user', text: input });
    messages.push({ role: 'assistant', text: result.reply });
    return Object.assign({
      round: index + 1,
      asksForStudentStep: /第一步|条件|题目|入口/.test(String(result.reply || '')),
      directAnswerBlocked: result.mastery_signal && result.mastery_signal.status === 'blocked_answer_request',
      noFinalAnswer: !/答案是|最终答案|therefore the answer/i.test(String(result.reply || ''))
    }, result);
  });
  rounds.final = rounds[rounds.length - 1] || null;
  return rounds;
}

module.exports = {
  HINT_LADDER,
  isAnswerRequest,
  isStuckText,
  countRecentStuck,
  classifyHintLevel,
  stepIntro,
  detectTaskType,
  inferHomeworkPressureSignal,
  buildSocraticContract,
  buildSocraticFallbackPlan,
  buildVisualSocraticRecoveryProtocol,
  buildFallbackRecoveryBridge,
  buildQuestionTypeSocraticPath,
  buildQuestionTypeCoverageAtlas,
  buildQuestionBankVisualBoardBridge,
  buildSocraticQualityEvaluationSuite,
  buildSocraticPromptQualityJudge,
  evaluateSocraticTurnQuality,
  buildSocraticQualityReleaseAudit,
  buildThreeRoundSocraticProtocol,
  buildSocraticAiLocalBoundaryContract,
  buildAnswerBoundaryEvidence,
  buildRuntimeSocraticReply,
  findApproximatePressureSample,
  scorePressureSample,
  childFriendlyLine,
  nextTutorTurnState,
  guardAiTutorReply,
  buildTutorReply,
  simulateThreeRoundSocratic,
  MISCONCEPTION_MAP
};
