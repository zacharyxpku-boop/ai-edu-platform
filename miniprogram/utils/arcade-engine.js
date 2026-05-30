const KNOWLEDGE_TYPES = [
  {
    id: 'fact',
    name: '事实记忆',
    match: ['单词', '词语', '年代', '人物', '地名', '公式', '符号', '口诀', '定义', '元素']
  },
  {
    id: 'concept',
    name: '概念理解',
    match: ['概念', '原理', '定律', '原因', '影响', '关系', '结构', '辨析']
  },
  {
    id: 'skill',
    name: '技能操练',
    match: ['计算', '口算', '配平', '因式分解', '解方程', '填空', '转换', '书写']
  },
  {
    id: 'problem',
    name: '问题解决',
    match: ['应用题', '证明', '实验设计', '阅读理解', '材料分析', '推理', '步骤']
  },
  {
    id: 'expression',
    name: '创意表达',
    match: ['作文', '口语', '配音', '观点', '论述', '项目', '创作']
  }
];

const GAME_TYPES = [
  {
    id: 'whack',
    name: '打地鼠速记关',
    shortName: '打地鼠',
    verb: '抢答',
    fit: ['fact', 'skill'],
    status: 'ready',
    minutes: 5
  },
  {
    id: 'quiz',
    name: '轻回忆',
    shortName: '轻练',
    verb: '逐题推进',
    fit: ['concept', 'problem', 'fact', 'skill'],
    status: 'ready',
    minutes: 5
  },
  {
    id: 'match',
    name: '泡泡消消乐',
    shortName: '泡泡消',
    verb: '消对应',
    fit: ['fact'],
    status: 'ready',
    minutes: 4
  },
  {
    id: 'snake',
    name: '贪吃蛇顺序关',
    shortName: '贪吃蛇',
    verb: '按顺序吃',
    fit: ['problem', 'concept', 'skill'],
    status: 'ready',
    minutes: 5
  },
  {
    id: 'lab',
    name: '模拟实验室',
    shortName: '实验室',
    verb: '调参观察',
    fit: ['concept'],
    status: 'requires_setup',
    minutes: 8
  },
  {
    id: 'sandbox',
    name: '建造沙盘',
    shortName: '沙盘',
    verb: '搭步骤',
    fit: ['problem', 'concept'],
    status: 'requires_setup',
    minutes: 8
  },
  {
    id: 'debate',
    name: '论证台',
    shortName: '论证',
    verb: '拼论据',
    fit: ['problem', 'expression'],
    status: 'requires_setup',
    minutes: 10
  },
  {
    id: 'roleplay',
    name: '配音角色扮演',
    shortName: '配音',
    verb: '说出来',
    fit: ['expression', 'fact'],
    status: 'requires_setup',
    minutes: 6
  },
  {
    id: 'story',
    name: '故事漫画生成',
    shortName: '故事',
    verb: '创作',
    fit: ['expression', 'concept'],
    status: 'requires_setup',
    minutes: 10
  }
];

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function compactText(value) {
  return String(value || '').replace(/\s+/g, '');
}

function isQuickRecallCard(card = {}) {
  const answer = compactText(card.answer);
  const question = compactText(card.question);
  if (!card || !card.id || !question || !answer) return false;
  if (answer.length > 14) return false;
  if (question.length > 42) return false;
  if (/[\n。；;：:，,、]/.test(String(card.answer || '')) && answer.length > 8) return false;
  const type = detectKnowledgeType(card);
  return type && ['fact', 'skill'].includes(type.id);
}

function isQuestCard(card = {}) {
  const answer = compactText(card.answer);
  const question = compactText(card.question);
  if (!card || !card.id || !question || !answer) return false;
  if (question.length < 3 || answer.length < 2) return false;
  const type = detectKnowledgeType(card);
  if (type && ['concept', 'problem'].includes(type.id)) return true;
  return !isQuickRecallCard(card) && answer.length <= 120;
}

function isMatchCard(card = {}) {
  const answer = compactText(card.answer);
  const question = compactText(card.question);
  if (!card || !card.id || !question || !answer) return false;
  if (question.length > 24 || answer.length > 24) return false;
  const type = detectKnowledgeType(card);
  if (!type || type.id !== 'fact') return false;
  return question !== answer;
}

function sequenceParts(card = {}) {
  const source = String(card.answer || card.question || '')
    .replace(/\r/g, '\n')
    .replace(/首先/g, '先')
    .replace(/接着/g, '再')
    .replace(/然后/g, '再')
    .replace(/最后/g, '最后');
  let parts = source
    .split(/\n|->|→|=>|；|;|。/)
    .map((item) => item.replace(/^\s*(第[一二三四五六七八九十\d]+步|[一二三四五六七八九十\d]+[\.、)]|先|再|最后)[:：、\s]*/u, '').trim())
    .filter(Boolean);
  if (parts.length < 3 && /先.+再.+最后/.test(source)) {
    parts = source
      .split(/先|再|最后/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  const unique = [];
  parts.forEach((item) => {
    const text = item.slice(0, 28);
    if (text && !unique.includes(text)) unique.push(text);
  });
  return unique.slice(0, 5);
}

function isSequenceCard(card = {}) {
  const type = detectKnowledgeType(card);
  const parts = sequenceParts(card);
  const text = String([card.question, card.answer, card.type, card.cardType, card.template, card.weakPoint].join(' '));
  return parts.length >= 3 && (
    ['problem', 'concept', 'skill'].includes(type.id)
    || /步骤|顺序|流程|先|再|最后|第一|第二|step/.test(text)
  );
}

function detectKnowledgeType(card = {}) {
  const text = normalizeText([
    card.question,
    card.answer,
    card.hint,
    card.subject,
    card.type,
    card.template,
    card.weakPoint,
    card.knowledge_point
  ].join(' '));
  const scored = KNOWLEDGE_TYPES.map((type) => {
    const score = type.match.reduce((sum, word) => sum + (text.indexOf(word.toLowerCase()) >= 0 ? 1 : 0), 0);
    return Object.assign({}, type, { score });
  }).sort((a, b) => b.score - a.score);
  if (scored[0] && scored[0].score > 0) return scored[0];
  if (card.template === 'cloze_context' || card.type === 'cloze') return KNOWLEDGE_TYPES.find((type) => type.id === 'concept');
  if (card.subject === '数学' || card.subject === 'Math') return KNOWLEDGE_TYPES.find((type) => type.id === 'skill');
  return KNOWLEDGE_TYPES[0];
}

function classifyCards(cards = []) {
  const list = Array.isArray(cards) ? cards : [];
  const counts = {};
  list.forEach((card) => {
    const type = detectKnowledgeType(card);
    counts[type.id] = (counts[type.id] || 0) + 1;
  });
  return KNOWLEDGE_TYPES.map((type) => Object.assign({}, type, {
    count: counts[type.id] || 0
  })).filter((type) => type.count > 0);
}

function gamePitch(gameId, dominantName) {
  const pitches = {
    whack: '短卡片快速回忆',
    quiz: '概念先回忆再自评',
    snake: '步骤顺序吃出来',
    lab: '调参数看因果',
    sandbox: '搭结构补证明',
    debate: '拼论据讲清楚',
    roleplay: '开口复述表达',
    story: '用故事讲概念',
    match: '对应关系泡泡消'
  };
  return pitches[gameId] || dominantName || '轻练习';
}

function gameMascot(gameId) {
  const mascots = {
    whack: '芽锤',
    quiz: '星门',
    match: '泡泡',
    snake: '小藤',
    lab: '小实验'
  };
  return mascots[gameId] || '关卡';
}

function gamePrinciple(gameId) {
  const principles = {
    whack: {
      title: '练的是瞬间想起来',
      body: '短回忆一闪就要抓住，适合口算、单词、年代和符号。'
    },
    quiz: {
      title: '练的是先回忆再核对思路',
      body: '先在心里讲一遍，再按真实掌握程度自评，概念会更牢。'
    },
    match: {
      title: '练的是对应关系粘牢',
      body: '把术语和含义配成一对，适合单词释义、年代事件和符号含义。'
    },
    snake: {
      title: '练的是步骤不断线',
      body: '按顺序吃掉步骤块，适合流程、时间线和解题步骤。'
    },
    lab: {
      title: '练的是看见变量关系',
      body: '调参数、看变化，适合理解函数、实验和地理模型。'
    }
  };
  return principles[gameId] || {
    title: '练的是把知识用起来',
    body: '每次作答都会留下错因和回访记录。'
  };
}

function gameLockedReason(gameId) {
  const reasons = {
    whack: '需要短回忆卡，如口算、单词、年代、符号。',
    quiz: '需要概念解释或问题解决卡。',
    snake: '需要步骤、流程、顺序类卡片。',
    lab: '适合函数、科学变量、地理模型等可观察概念。',
    sandbox: '适合证明、结构搭建和解题步骤。',
    debate: '适合材料分析、观点论证和作文提纲。',
    roleplay: '适合英语口语、古诗背诵和情境表达。',
    story: '适合把抽象概念转成自己的表达。',
    match: '需要术语-含义、单词-释义、年代-事件这类短对应卡。'
  };
  return reasons[gameId] || '先生成真实学习卡后可开始。';
}

function distinctMatchCards(cards = []) {
  const seenQuestions = {};
  const seenAnswers = {};
  return (Array.isArray(cards) ? cards : []).filter((card) => {
    const questionKey = compactText(card.question);
    const answerKey = compactText(card.answer);
    if (!questionKey || !answerKey || seenQuestions[questionKey] || seenAnswers[answerKey]) return false;
    seenQuestions[questionKey] = true;
    seenAnswers[answerKey] = true;
    return true;
  });
}

function recommendGames(cards = []) {
  const list = Array.isArray(cards) ? cards : [];
  const classified = classifyCards(list);
  const dominant = classified[0] || Object.assign({}, KNOWLEDGE_TYPES[0], { count: list.length });
  return GAME_TYPES.map((game) => {
    const fitCount = classified
      .filter((type) => game.fit.includes(type.id))
      .reduce((sum, type) => sum + type.count, 0);
    const readyCards = game.id === 'whack'
      ? list.filter((card) => isQuickRecallCard(card))
      : game.id === 'quiz'
        ? list.filter((card) => isQuestCard(card))
        : game.id === 'match'
          ? distinctMatchCards(list.filter((card) => isMatchCard(card)))
          : game.id === 'snake'
            ? list.filter((card) => isSequenceCard(card))
            : list.filter((card) => game.fit.includes(detectKnowledgeType(card).id));
    const readyWeight = game.id === 'quiz' ? 2 : 5;
    const score = fitCount * 8
      + readyCards.length * readyWeight
      + (game.status === 'ready' ? 8 : 0)
      + (game.fit.includes(dominant.id) ? 6 : 0);
    return Object.assign({}, game, {
      score,
      fitCount,
      readyCount: readyCards.length,
      available: game.status === 'ready' && readyCards.length >= (game.id === 'match' ? 2 : 1),
      knowledgeType: dominant.name,
      mascot: gameMascot(game.id),
      pitch: gamePitch(game.id, dominant.name),
      principleTitle: gamePrinciple(game.id).title,
      principleBody: gamePrinciple(game.id).body,
      lockedReason: gameLockedReason(game.id)
    });
  }).sort((a, b) => b.score - a.score);
}

function selectCardsForGame(cards = [], gameId = 'whack', limit = 8) {
  const game = GAME_TYPES.find((item) => item.id === gameId) || GAME_TYPES[0];
  const list = Array.isArray(cards) ? cards : [];
  const filtered = game.id === 'whack'
    ? list.filter((card) => isQuickRecallCard(card))
    : game.id === 'quiz'
      ? list.filter((card) => isQuestCard(card))
      : game.id === 'match'
        ? list.filter((card) => isMatchCard(card))
        : game.id === 'snake'
          ? list.filter((card) => isSequenceCard(card))
          : list.filter((card) => game.fit.includes(detectKnowledgeType(card).id));
  return filtered
    .filter((card) => card && card.id && card.question && card.answer)
    .slice(0, Math.max(1, Math.min(12, Number(limit || 8))));
}

function buildDistractors(card = {}, pool = []) {
  const answer = String(card.answer || '').trim();
  const candidates = (Array.isArray(pool) ? pool : [])
    .map((item) => String(item.answer || '').trim())
    .filter((item) => item && item !== answer);
  const unique = [];
  candidates.forEach((item) => {
    if (!unique.includes(item)) unique.push(item);
  });
  const fallback = ['再看题目条件', '概念混淆', '步骤不完整', '单位不一致'].filter((item) => item !== answer);
  return unique.concat(fallback).slice(0, 3);
}

function buildWhackRound(cards = [], options = {}) {
  const selected = selectCardsForGame(cards, 'whack', options.limit || 8);
  const holes = Math.max(4, Math.min(9, Number(options.holes || 9)));
  const questions = selected.map((card, index) => {
    const choices = [String(card.answer || '').trim()].concat(buildDistractors(card, selected)).slice(0, Math.min(4, holes));
    return {
      id: `whack_${card.id}_${index}`,
      cardId: card.id,
      question: card.question,
      answer: card.answer,
      hint: card.hint || '',
      choices,
      holeTargets: buildHoleTargets(`${card.id}_${index}`, choices.length, holes),
      knowledgeType: detectKnowledgeType(card).name
    };
  });
  return {
    gameType: 'whack',
    title: '打地鼠速记关',
    subtitle: questions.length ? '只选自己回忆出的选项，错了会进入错因修复。' : '还没有适合打地鼠的真实学习卡。',
    holes,
    total: questions.length,
    timeLimit: Math.max(30, Math.min(180, Number(options.timeLimit || 90))),
    questions
  };
}

function buildQuestRound(cards = [], options = {}) {
  const selected = selectCardsForGame(cards, 'quiz', options.limit || 5);
  const questions = selected.map((card, index) => {
    const type = detectKnowledgeType(card);
    return {
      id: `quest_${card.id}_${index}`,
      cardId: card.id,
      question: card.question,
      answer: card.answer,
      hint: card.hint || '',
      source: card.source || '',
      knowledgeType: type.name,
      checkpoint: type.id === 'problem' ? '先说思路，再核对' : '先在心里回忆，再核对'
    };
  });
  return {
    gameType: 'quiz',
    title: '轻回忆',
    subtitle: questions.length ? '先主动回忆，再按真实掌握程度自评。' : '还没有适合轻回忆的概念卡。',
    total: questions.length,
    timeLimit: Math.max(90, Math.min(600, Number(options.timeLimit || 300))),
    questions
  };
}

function stableSortKey(value) {
  return String(value || '').split('').reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0);
}

function buildHoleTargets(seed, choiceCount, holeCount) {
  const total = Math.max(4, Math.min(9, Number(holeCount || 9)));
  const count = Math.max(0, Math.min(total, Number(choiceCount || 0)));
  const used = {};
  const targets = [];
  const start = Math.abs(stableSortKey(seed)) % total;
  for (let step = 0; targets.length < count && step < total * 2; step += 1) {
    const target = (start + step * 2 + Math.floor(step / total)) % total;
    if (!used[target]) {
      used[target] = true;
      targets.push(target);
    }
  }
  for (let index = 0; targets.length < count && index < total; index += 1) {
    if (!used[index]) {
      used[index] = true;
      targets.push(index);
    }
  }
  return targets;
}

function buildMatchRound(cards = [], options = {}) {
  const selected = selectCardsForGame(cards, 'match', options.limit || 5);
  const distinct = distinctMatchCards(selected);
  const pairs = distinct.map((card, index) => ({
    id: `pair_${card.id}_${index}`,
    cardId: card.id,
    question: card.question,
    answer: card.answer,
    knowledgeType: detectKnowledgeType(card).name
  }));
  const tiles = pairs.flatMap((pair) => ([
    {
      id: `${pair.id}_q`,
      pairId: pair.id,
      cardId: pair.cardId,
      side: 'question',
      sideLabel: '题',
      text: pair.question,
      matched: false,
      selected: false
    },
    {
      id: `${pair.id}_a`,
      pairId: pair.id,
      cardId: pair.cardId,
      side: 'answer',
      sideLabel: '答',
      text: pair.answer,
      matched: false,
      selected: false
    }
  ])).sort((a, b) => stableSortKey(a.id) - stableSortKey(b.id));
  return {
    gameType: 'match',
    title: '泡泡消消乐',
    subtitle: pairs.length ? '点一个题泡泡，再点对应泡泡，配对成功就消掉。' : '还没有适合泡泡消的短对应卡。',
    total: pairs.length,
    pairs,
    tiles
  };
}

function buildMatchAnswerRecord(selected = {}, tile = {}, pairs = []) {
  const sameSide = selected.side && tile.side && selected.side === tile.side;
  const correct = selected.pairId === tile.pairId && selected.side !== tile.side;
  const selectedPair = (Array.isArray(pairs) ? pairs : []).find((item) => item.id === selected.pairId) || {};
  const targetPair = (Array.isArray(pairs) ? pairs : []).find((item) => item.id === tile.pairId) || selectedPair;
  const repairPair = selectedPair.cardId ? selectedPair : targetPair;
  return {
    cardId: repairPair.cardId || selected.cardId || tile.cardId || '',
    correct,
    recordable: !sameSide,
    selected: `${selected.text || ''} + ${tile.text || ''}`,
    answer: `${repairPair.question || ''} -> ${repairPair.answer || ''}`,
    gameType: 'match',
    knowledgeType: repairPair.knowledgeType || targetPair.knowledgeType || ''
  };
}

function buildSnakeRound(cards = [], options = {}) {
  const selected = selectCardsForGame(cards, 'snake', options.limit || 4);
  const tracks = selected.map((card, index) => {
    const parts = sequenceParts(card);
    const tiles = parts.map((text, order) => ({
      id: `snake_${card.id}_${index}_${order}`,
      cardId: card.id,
      text,
      order
    })).sort((a, b) => stableSortKey(`${b.id}_${b.text}`) - stableSortKey(`${a.id}_${a.text}`));
    return {
      id: `snake_track_${card.id}_${index}`,
      cardId: card.id,
      question: card.question,
      answer: card.answer,
      knowledgeType: detectKnowledgeType(card).name,
      tiles,
      correctOrder: parts
    };
  });
  return {
    gameType: 'snake',
    title: '贪吃蛇顺序关',
    subtitle: tracks.length ? '按正确顺序吃掉步骤块，吃错会回到复习队列。' : '还没有适合顺序关的步骤卡。',
    total: tracks.length,
    tracks
  };
}

function summarizeAttempt(attempt = {}) {
  const answers = Array.isArray(attempt.answers) ? attempt.answers : [];
  const correct = answers.filter((item) => item.correct).length;
  const wrong = answers.filter((item) => item.correct === false).length;
  const total = answers.length;
  const accuracy = total ? Math.round((correct / total) * 100) : 0;
  return {
    gameType: attempt.gameType || 'whack',
    total,
    correct,
    wrong,
    skipped: Math.max(0, Number(attempt.expectedTotal || total) - total),
    accuracy,
    bestCombo: Number(attempt.bestCombo || 0),
    xp: correct * 10 + Math.max(0, Number(attempt.bestCombo || 0) - 2) * 2,
    passed: total > 0 && accuracy >= 70
  };
}

function uniqueReviewAnswers(answers = []) {
  const seen = {};
  return (Array.isArray(answers) ? answers : []).filter((answer) => {
    const cardId = answer && answer.cardId;
    if (answer && answer.recordable === false) return false;
    if (!cardId) return false;
    if (seen[cardId]) return false;
    seen[cardId] = true;
    return true;
  });
}

function uniqueWrongAnswers(answers = []) {
  return uniqueReviewAnswers((Array.isArray(answers) ? answers : []).filter((answer) => answer && answer.correct === false));
}

function buildRoundAdvice(result = {}, gameType = 'whack') {
  const passed = !!result.passed;
  const wrong = Number(result.wrong || 0);
  const advice = {
    whack: passed
      ? {
          title: '短卡片已经热起来了',
          body: '趁手感还在，再来一小局可以把检索速度稳住。',
          primary: '再来一小局',
          secondary: wrong ? '修错卡' : '去轻练'
        }
      : {
          title: '先别硬冲速度',
          body: '容易混的短卡片会进入复习队列，先把最容易混的那几张修掉。',
          primary: '重打一局',
          secondary: '去复习错卡'
        },
    quiz: passed
      ? {
          title: '概念能说出来了',
          body: '下一步可以继续轻回忆，或把模糊卡沉淀成更短的回忆卡。',
          primary: '继续轻练',
          secondary: wrong ? '修一个错因' : '回到复习'
        }
      : {
          title: '概念还需要补一刀',
          body: '先看错题提示和自己的思路，再用作业点拨把卡住处说清楚。',
          primary: '再练一次',
          secondary: '去复习错卡'
        },
    snake: passed
      ? {
          title: '顺序链路吃通了',
          body: '步骤型知识最怕跳步，已经通关的卡会按间隔回来抽查。',
          primary: '换一组顺序',
          secondary: wrong ? '重吃错序' : '去复习'
        }
      : {
          title: '顺序断点已经抓到',
          body: '吃错的位置就是当前断点，先重来一次，把步骤链走顺。',
          primary: '重吃顺序',
          secondary: '去复习错卡'
        },
    match: passed
      ? {
          title: '对应关系消干净了',
          body: '术语和含义已经配上，后面会按间隔复习继续抽查。',
          primary: '再消一组',
          secondary: wrong ? '修错卡' : '回到复习'
        }
      : {
          title: '有几对还没粘牢',
          body: '错配说明对应关系还不稳，先把第一组错配拿去说清楚。',
          primary: '重开泡泡局',
          secondary: '去复习错卡'
        }
  };
  return advice[gameType] || advice.whack;
}

function buildRepairFocus(answer = {}, cards = []) {
  const list = Array.isArray(cards) ? cards : [];
  const card = list.find((item) => item && item.id === answer.cardId) || {};
  const question = answer.question || card.question || '';
  const correctAnswer = answer.answer || card.answer || '';
  const selected = answer.selected || '';
  const gameType = answer.gameType || '';
  const type = detectKnowledgeType(card.id ? card : {
    question,
    answer: correctAnswer,
    weakPoint: answer.knowledgeType || ''
  });
  const gameName = (GAME_TYPES.find((item) => item.id === gameType) || {}).shortName || '轻练';
  return {
    id: `arcade_repair_${answer.cardId || Date.now()}`,
    title: question ? `修这一题：${question}` : '修本局第一张错卡',
    text: question,
    reason: correctAnswer,
    minutes: gameType === 'snake' ? 6 : 5,
    selected,
    correctAnswer,
    gameType,
    gameName,
    knowledgeType: answer.knowledgeType || type.name,
    decision: selected
      ? `来自${gameName}，刚才选了「${selected}」，先说清为什么应为「${correctAnswer}」。`
      : `来自${gameName}，先把这张错卡的关键原因说清楚。`,
    tags: ['轻回访', gameName, answer.knowledgeType || type.name].filter(Boolean),
    cardId: answer.cardId || '',
    calibrationKey: card.calibrationKey || `arcade:${gameType}:${answer.cardId || 'unknown'}`
  };
}

function buildHomeArcadeEntry(summary = {}, cards = []) {
  const recommendations = recommendGames(cards);
  const primary = recommendations.find((item) => item.available) || recommendations[0] || GAME_TYPES[0];
  const due = Number(summary.due || cards.length || 0);
  return {
    title: '轻练习',
    label: primary && primary.available ? `${primary.shortName} · ${primary.minutes} 分钟` : '生成学习卡后可开始',
    body: due
      ? `今天有 ${due} 张卡可以做轻回访。`
      : '把作业、错题或知识点生成学习卡，再进入轻回访。',
    cta: primary && primary.available ? '进入今日轻练' : '先生成学习卡',
    action: primary && primary.available ? 'goArcade' : 'goLearningMap',
    gameId: primary ? primary.id : 'whack'
  };
}

module.exports = {
  KNOWLEDGE_TYPES,
  GAME_TYPES,
  gameMascot,
  gamePrinciple,
  buildHomeArcadeEntry,
  buildRoundAdvice,
  buildRepairFocus,
  buildWhackRound,
  classifyCards,
  detectKnowledgeType,
  recommendGames,
  selectCardsForGame,
  isQuickRecallCard,
  isQuestCard,
  isMatchCard,
  distinctMatchCards,
  isSequenceCard,
  sequenceParts,
  buildHoleTargets,
  buildQuestRound,
  buildMatchRound,
  buildMatchAnswerRecord,
  buildSnakeRound,
  summarizeAttempt,
  uniqueReviewAnswers,
  uniqueWrongAnswers
};
