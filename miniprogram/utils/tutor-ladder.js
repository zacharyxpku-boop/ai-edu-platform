const ANSWER_REQUEST_RE = /直接告诉我答案|求答案|不想写过程|拍照出答案|直接给结果|告诉我答案|给答案|答案是什么|直接说结果|帮我写答案|代写|tell me the answer/i;
const STUCK_RE = /不会下一步|不知道下一步|不会列式|还是不会|又不会|我不会|卡住|卡住了|不会写|没思路|读不懂|看不懂|不知道怎么写|不会做|不懂/;

const HINT_LADDER = [
  {
    level: 1,
    label: '提示 1/5',
    step: 'read_problem',
    title: '先读题',
    reply: '先不急着做。你用一句话说说：这题真正问的是什么？再圈出两个已知条件。'
  },
  {
    level: 2,
    label: '提示 2/5',
    step: 'write_first_step',
    title: '问第一步',
    reply: '你觉得第一步应该做什么？先说一个想法就行，可以不完整。'
  },
  {
    level: 3,
    label: '提示 3/5',
    step: 'find_direction',
    title: '给方向',
    reply: '方向可以先从“已知条件”和“要求的问题”之间找关系。先别算到最后，只写第一步关系。'
  },
  {
    level: 4,
    label: '提示 4/5',
    step: 'similar_example',
    title: '相似例子',
    reply: '换个相似例子：如果题目问“总量”，通常先找每份量和份数。回到原题，你觉得对应的两个量是什么？'
  },
  {
    level: 5,
    label: '提示 5/5',
    step: 'method_summary',
    title: '总结方法',
    reply: '这类题的方法是：先说题目问什么，再圈已知条件，最后只写第一步关系。要不要把这个方法做成一张复习卡？'
  }
];

const TASK_TYPE_RULES = [
  { id: 'math_word_problem', patterns: /应用题|题目问什么|数量关系|单位1|已知条件|列式|方程|行程|工程|分数应用题/i },
  { id: 'equation_setup', patterns: /方程|等量关系|设x|未知数|列方程|解方程/i },
  { id: 'reading_question', patterns: /阅读|主旨|细节|原因|段意|中心句|概括/i },
  { id: 'english_sentence', patterns: /英语|单词|语法|句型|主语|谓语|时态|词性/i },
  { id: 'writing_process', patterns: /作文|写作|开头|结尾|提纲|续写|作文题/i }
];

const TASK_TYPE_PROMPTS = {
  math_word_problem: '先把题干里的已知条件圈出来，再说题目问什么。',
  equation_setup: '先把未知数写出来，再找等量关系。',
  reading_question: '先看题目问的是细节、主旨还是原因。',
  english_sentence: '先找主语和谓语，再看时态。',
  writing_process: '先写一句最简单的开头，再慢慢补。',
  unknown: '先说你准备从哪一步开始。'
};

function detectTaskType(text = '', selected = {}) {
  const source = `${text || ''} ${selected.text || ''}`;
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
  if (incomingText) recent.push(String(incomingText || ''));
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
  if (/不会下一步|不知道下一步|不会列式|条件不会用|不知道怎么写/.test(String(text || ''))) {
    return Math.max(2, normalizeLevel(currentHintLevel));
  }
  if (isStuckText(text)) return Math.max(2, normalizeLevel(currentHintLevel));
  if (/举一反三|同类|变式|复习卡|总结方法/.test(String(text || ''))) return 5;
  return normalizeLevel(currentHintLevel);
}

function buildTutorReply(text, options = {}) {
  const messages = options.messages || [];
  const currentHintLevel = options.currentHintLevel || 1;
  const selected = options.selected || {};
  const taskType = detectTaskType(text, selected);
  const target = selected && selected.text ? `「${selected.text}」` : '这道题';
  const taskPrompt = TASK_TYPE_PROMPTS[taskType] || TASK_TYPE_PROMPTS.unknown;

  if (isAnswerRequest(text)) {
    const item = ladderItem(1);
    return {
      reply: withStepIntro(item, '我不能直接替你写答案，但可以陪你先找第一步。先说题目问什么，或者圈出一个已知条件。'),
      hint_level: 1,
      hint_label: item.label,
      coach_step: item.step,
      coach_step_label: stepIntro(item),
      next_action: '先说题目问什么，或者圈出一个已知条件。',
      task_type: taskType,
      first_prompt: taskPrompt,
      mastery_signal: {
        status: 'blocked_answer_request',
        confidence: 0.9,
        evidence_needed: '学生需要先给出自己的第一步。'
      },
      homework_boundary: true
    };
  }

  const level = classifyHintLevel(text, messages, currentHintLevel);
  const item = ladderItem(level);
  const stuckCount = countRecentStuck(messages, text);
  const reply = stuckCount >= 3
    ? `我们把门槛再降一点。先看${target}：下面两个选项选一个就行，A 先找已知条件，B 先看题目问什么。选完我给一个相似例子。`
    : item.reply;

  return {
    reply: withStepIntro(item, reply),
    hint_level: item.level,
    hint_label: item.label,
    coach_step: item.step,
    coach_step_label: stepIntro(item),
    next_action: item.level >= 5 ? '把方法做成复习卡或生成一道小变式。' : '先回一句你的第一步。',
    task_type: taskType,
    first_prompt: taskPrompt,
    mastery_signal: {
      status: item.level >= 5 ? 'method_summary_ready' : 'needs_student_step',
      confidence: item.level >= 4 ? 0.78 : 0.68,
      evidence_needed: item.level >= 4 ? '学生需要在相似例子后说回原题第一步。' : '学生需要先说出自己的第一步。'
    }
  };
}

function simulateThreeRoundSocratic(inputs = [], options = {}) {
  const turns = Array.isArray(inputs) ? inputs.slice(0, 3) : [];
  let currentHintLevel = options.currentHintLevel || 1;
  const messages = [];
  return turns.map((input, index) => {
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
      asksForStudentStep: /绗竴姝|棰樼洰|鏉′欢|鍏堣|鍏堟壘|先|第一步|条件|题目/.test(String(result.reply || '')),
      directAnswerBlocked: result.mastery_signal && result.mastery_signal.status === 'blocked_answer_request',
      noFinalAnswer: !/鏈€缁堢瓟妗堟槸|答案是|结果是|final answer is|=\\s*\\d+\\s*$/.test(String(result.reply || ''))
    }, result);
  });
}

module.exports = {
  HINT_LADDER,
  isAnswerRequest,
  isStuckText,
  countRecentStuck,
  classifyHintLevel,
  stepIntro,
  detectTaskType,
  buildTutorReply,
  simulateThreeRoundSocratic
};
