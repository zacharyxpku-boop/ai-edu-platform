const storage = require('./storage');

function mathSeed(day = new Date().toISOString().slice(0, 10)) {
  return day.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function seededNumber(seed, index, min, span) {
  return min + ((seed * 17 + index * 31 + index * index * 7) % span);
}

function gradeBand(gradeText = '') {
  const text = String(gradeText || '').trim();
  const match = text.match(/[1-6一二三四五六]/);
  const valueMap = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };
  const grade = match ? (valueMap[match[0]] || Number(match[0])) : 5;
  if (grade <= 2) return 'lower';
  if (grade <= 4) return 'middle';
  return 'upper';
}

function buildMathItem(seed, index, band) {
  if (band === 'lower') {
    const operator = (seed + index) % 2 === 0 ? '+' : '-';
    const left = seededNumber(seed, index, 6, 14);
    const right = seededNumber(seed + 3, index, 2, 9);
    const safeLeft = operator === '-' ? Math.max(left, right) : left;
    const safeRight = operator === '-' ? Math.min(left, right) : right;
    return {
      prompt: `${safeLeft} ${operator} ${safeRight}`,
      answer: operator === '-' ? safeLeft - safeRight : safeLeft + safeRight,
      firstStepCheck: operator === '-' ? '先看清减号，再想要不要退位。' : '先看清加号，再想要不要进位。',
      skill: operator === '-' ? 'borrow' : 'carry'
    };
  }
  if (band === 'middle') {
    const operator = index % 2 === 0 ? '×' : '÷';
    const left = seededNumber(seed, index, 3, 9);
    const right = seededNumber(seed + 5, index, 2, 8);
    const dividend = left * right;
    return {
      prompt: operator === '×' ? `${left} × ${right}` : `${dividend} ÷ ${right}`,
      answer: operator === '×' ? left * right : left,
      firstStepCheck: operator === '×' ? '先看清乘号，再想用哪句口诀。' : '先看清除号，再找对应乘法。',
      skill: 'operator'
    };
  }
  const decimal = index % 2 === 0;
  if (decimal) {
    const left = (seededNumber(seed, index, 12, 38) / 10).toFixed(1);
    const right = (seededNumber(seed + 7, index, 3, 18) / 10).toFixed(1);
    return {
      prompt: `${left} + ${right}`,
      answer: Number((Number(left) + Number(right)).toFixed(1)),
      firstStepCheck: '先看清小数点，再对齐从末位算起。',
      skill: 'decimal_align'
    };
  }
  const den = [2, 3, 4, 5, 6][(seed + index) % 5];
  const a = 1 + ((seed + index) % Math.max(1, den - 1));
  const b = 1 + ((seed + index * 2) % Math.max(1, den - 1));
  return {
    prompt: `${a}/${den} + ${b}/${den}`,
    answer: (a + b) / den,
    displayAnswer: `${a + b}/${den}`,
    firstStepCheck: '先看清分母是否一样，再只加分子。',
    skill: 'fraction_denominator'
  };
}

function buildDailyMath(seedText, profile = {}) {
  const seedBase = seedText || `${new Date().toISOString()}_${Math.random()}`;
  const seed = mathSeed(seedBase);
  const band = gradeBand(profile.grade || (storage.loadProfile && storage.loadProfile().grade));
  const seen = new Set();
  const items = [];
  let cursor = 0;
  while (items.length < 10 && cursor < 40) {
    const base = buildMathItem(seed, cursor, band);
    cursor += 1;
    if (seen.has(base.prompt)) continue;
    seen.add(base.prompt);
    items.push(Object.assign({
      id: `math_${items.length + 1}`,
      gradeBand: band
    }, base));
  }
  return {
    title: '每日轻口算',
    durationMinutes: 3,
    gradeBand: band,
    items,
    feedbackMode: 'first_step_only',
    shareText: '今日口算第一步：先看清符号和进位。'
  };
}

function normalizeAnswer(value) {
  const text = String(value == null ? '' : value).trim();
  if (!text) return NaN;
  if (/^\d+\s*\/\s*\d+$/.test(text)) {
    const parts = text.split('/').map((item) => Number(item.trim()));
    return parts[1] ? parts[0] / parts[1] : NaN;
  }
  return Number(text);
}

function classifyMathMistake(item, answerValue) {
  const answer = normalizeAnswer(answerValue);
  const prompt = String(item.prompt || '');
  if (/\+/.test(prompt)) {
    const nums = prompt.match(/[\d.]+/g).map(Number);
    if (nums.length >= 2 && answer === nums[0] - nums[1]) return 'operator';
    if (item.skill === 'carry' || item.skill === 'decimal_align') return 'carry';
  }
  if (/[-×÷]/.test(prompt)) return 'operator';
  if (item.skill === 'fraction_denominator') return 'calculation';
  return 'calculation';
}

function feedbackForMistake(type) {
  if (type === 'operator') return '第一眼看运算符号时，可以手指着读出来。';
  if (type === 'carry') return '加法进位时，先在草稿纸上标一个小点。';
  return '口算时，把大数拆成小数，比如 28+15 先算 28+10。';
}

function submitDailyMath(answers = [], session = buildDailyMath()) {
  const mistakes = session.items.filter((item, index) => normalizeAnswer(answers[index]) !== Number(item.answer));
  const firstMistake = mistakes[0] || session.items[0];
  const mistakeType = mistakes.length ? classifyMathMistake(firstMistake, answers[session.items.indexOf(firstMistake)]) : 'clear_first_step';
  const feedback = mistakes.length
    ? `先回看这一步：${feedbackForMistake(mistakeType)}`
    : '今天先做对的一步是：每题先看清符号。';
  const event = storage.recordLightFeatureFirstStep('daily_math', {
    stuckPointText: firstMistake.prompt,
    systemSuggestedStep: feedback,
    childArticulatedStep: '我先看清符号和进位',
    childStepQuality: 'actionable',
    secondStepStatus: mistakes.length ? 'needs_scaffold' : 'independent'
  });
  return {
    total: session.items.length,
    mistakeCount: mistakes.length,
    mistakeType,
    feedback,
    shareCard: {
      title: '今晚我确认了自己的第一步',
      body: event.childArticulatedStep,
      showScore: false,
      showRank: false
    },
    event
  };
}

function buildDictation(wordsText = '') {
  const words = String(wordsText || '').split(/[\s,，、;；]+/).map((item) => item.trim()).filter(Boolean).slice(0, 20);
  return {
    title: '听写小助手',
    durationMinutes: 5,
    words,
    currentWord: words[0] || '',
    prompt: '你写第一个词时，先看了拼音还是字形？我们先确认这一步。'
  };
}

function submitDictation(wordsText = '', firstStepText = '') {
  const session = buildDictation(wordsText);
  const childStep = firstStepText || '我先看字形';
  const event = storage.recordLightFeatureFirstStep('dictation', {
    stuckPointText: session.currentWord || '听写第一个词',
    systemSuggestedStep: session.prompt,
    childArticulatedStep: childStep,
    childStepQuality: storage.childStepQuality(childStep)
  });
  return {
    session,
    firstStepPrompt: session.prompt,
    event
  };
}

const SUBJECT_LABELS = {
  math: '数学',
  chinese: '语文',
  english: '英语'
};

const STUCK_LABELS = {
  read: '看不懂题',
  formula: '列不出式子',
  writing: '不知道写什么',
  other: '其他'
};

function normalizeLightDiagnosisOptions(options = {}) {
  const subject = ['math', 'chinese', 'english'].includes(options.subject) ? options.subject : 'math';
  const stuckStep = ['read', 'formula', 'writing', 'other'].includes(options.stuckStep) ? options.stuckStep : 'read';
  return { subject, stuckStep };
}

function suggestLightDiagnosisStep(subject, stuckStep) {
  if (stuckStep === 'read') return '先把题目读出声，圈出你认识的数字和词。';
  if (stuckStep === 'formula') return '先写出题目问什么，把它变成一个问题句。';
  if (subject === 'english') return '先找主语和谓语，再看这一句在问什么。';
  if (subject === 'chinese') return '先看题目问的是细节、主旨还是原因。';
  if (stuckStep === 'writing') return '先写一句最简单的开头，不急着写完整。';
  return '先圈出题干里已经给你的条件。';
}

function taskTypeFromLightDiagnosis(subject, stuckStep, inputText) {
  if (subject === 'english') return 'english_sentence';
  if (subject === 'chinese') return 'reading_question';
  if (stuckStep === 'formula') return 'equation_setup';
  return storage.detectTaskType(inputText, 'light_diagnosis');
}

function buildLightDiagnosis(inputText = '', options = {}) {
  const normalized = normalizeLightDiagnosisOptions(options);
  const taskType = taskTypeFromLightDiagnosis(normalized.subject, normalized.stuckStep, inputText);
  const suggestion = suggestLightDiagnosisStep(normalized.subject, normalized.stuckStep);
  return {
    title: '手动选题型',
    requiresManualConfirmation: true,
    statusSteps: ['请先确认科目和卡点…', '咕点根据你确认的信息找第一步…', '不会输出答案。'],
    subject: normalized.subject,
    subjectLabel: SUBJECT_LABELS[normalized.subject],
    stuckStep: normalized.stuckStep,
    stuckStepLabel: STUCK_LABELS[normalized.stuckStep],
    taskType,
    typeLabel: storage.taskTypeLabel ? storage.taskTypeLabel(taskType) : '当前题型',
    suggestedFirstStep: suggestion,
    boundary: '这不是解题答案，只是准备开始的第一步。'
  };
}

function confirmLightDiagnosis(inputText = '', childStepText = '', options = {}) {
  const diagnosis = buildLightDiagnosis(inputText, options);
  const childStep = childStepText || diagnosis.suggestedFirstStep;
  const event = storage.recordLightFeatureFirstStep('light_diagnosis', {
    taskType: diagnosis.taskType,
    stuckPointText: inputText,
    systemSuggestedStep: diagnosis.suggestedFirstStep,
    childArticulatedStep: childStep,
    childStepQuality: storage.childStepQuality(childStep)
  });
  return Object.assign({}, diagnosis, { childStep, event });
}

module.exports = {
  buildDailyMath,
  submitDailyMath,
  buildDictation,
  submitDictation,
  buildLightDiagnosis,
  confirmLightDiagnosis,
  gradeBand,
  suggestLightDiagnosisStep
};
