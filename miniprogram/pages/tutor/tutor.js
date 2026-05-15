const api = require('../../utils/api');
const storage = require('../../utils/storage');
const tutorLadder = require('../../utils/tutor-ladder');

const QUICK_ACTIONS = [
  { id: 'read_problem', label: '提示 1/5', desc: '先复述题意，找已知条件' },
  { id: 'write_first_step', label: '提示 2/5', desc: '追问第一步想做什么' },
  { id: 'find_direction', label: '提示 3/5', desc: '给方向，不给最终结果' },
  { id: 'similar_example', label: '提示 4/5', desc: '给相似例子，回到原题' },
  { id: 'method_summary', label: '提示 5/5', desc: '总结方法，进入复习卡' },
  { id: 'fast_mode', label: '加快一点', desc: '先看方向，再自己说第一步' },
  { id: 'find_conditions', label: '帮我检查思路', desc: '圈已知、未知和单位' },
  { id: 'explain_misconception', label: '说错因', desc: '说清卡在哪一步' },
  { id: 'transfer', label: '举一反三', desc: '换一个条件，看方法是否迁移' },
  { id: 'review', label: '复盘', desc: '总结下次先检查什么' }
];

const GUIDED_TUTOR_MODES = [
  {
    id: 'homework_coach',
    title: '作业教练',
    desc: '只带必须做，先问第一步，不替写答案。',
    prompt: '带我完成这项必须做，但每次只问一个问题或给一个最小提示。'
  },
  {
    id: 'wrong_cause',
    title: '错因镜头',
    desc: '把“粗心”拆成审题、建模、计算、表达。',
    prompt: '不要解题，先帮我判断我真正错在哪一步。'
  },
  {
    id: 'transfer',
    title: '举一反三',
    desc: '基于同一方法换条件，检查是否真的会了。',
    prompt: '请给我一道同方法的小变式，但先让我说思路，不要给答案。'
  },
  {
    id: 'self_rehearsal',
    title: '一句复述',
    desc: '用自己的话说清：我错因是什么，下次先检查什么。',
    prompt: '请让我用一句话复述本题错因和下次检查点。'
  }
];

const PEDAGOGY_LADDER = [
  { id: 'level_1', title: '提示 1/5', desc: '复述题意，让孩子找条件。' },
  { id: 'level_2', title: '提示 2/5', desc: '追问孩子第一步想做什么。' },
  { id: 'level_3', title: '提示 3/5', desc: '给方向，但不讲最终结果。' },
  { id: 'level_4', title: '提示 4/5', desc: '给相似例子，而不是原题结果。' },
  { id: 'level_5', title: '提示 5/5', desc: '总结方法，进入同类练习或复习卡。' }
];

const TUTOR_GUARDRAILS = [
  '不替孩子写完整答案',
  '只带今晚必须做',
  '留下自己能复述的一句话',
  '发现抄答案风险会收紧提示'
];

function pedagogyPanel(selected, misconceptionTags, masterySignal) {
  const misconception = (misconceptionTags || []).map((item) => item.label || item.axis).filter(Boolean).slice(0, 2);
  const status = storage.formatInternalLabel
    ? storage.formatInternalLabel(masterySignal && masterySignal.status ? masterySignal.status : 'needs_student_step', '等孩子先说第一步')
    : '等孩子先说第一步';
  return {
    title: '带学原则',
    status,
    focus: selected && selected.text ? selected.text : '先锁定第一项必须做',
    misconception: misconception.length ? misconception.join(' / ') : '先说清错因，再继续做题',
    ladder: PEDAGOGY_LADDER,
    guardrails: TUTOR_GUARDRAILS,
    teacherView: '只记录：现在卡在哪、错因是什么、下一步做什么。',
    label: status === 'ready_for_parent_review'
      ? '现在已经能把错因用自己的话说清楚。'
      : status === 'blocked_answer_request'
        ? '检测到直接要答案，我会先收紧到边界提示。'
        : '先问、再提示、再找错因、最后复盘。'
  };
}

function pasteRiskSignal(messages = []) {
  const recentUser = (Array.isArray(messages) ? messages : [])
    .filter((item) => item.role === 'user')
    .slice(-3)
    .map((item) => String(item.text || ''));
  const longPaste = recentUser.some((text) => text.length >= 40);
  const answerSeeking = recentUser.some((text) => /答案|直接|代写|帮我写|tell me the answer/i.test(text));
  return {
    title: '别急着要答案',
    level: longPaste && answerSeeking ? 'high' : longPaste ? 'watch' : 'low',
    label: longPaste && answerSeeking
      ? '检测到大段粘贴加直接要答案，作业点拨会只保留边界提示。'
      : longPaste
        ? '检测到大段粘贴，先让孩子交出第一步再继续。'
        : '最近几轮没有明显抄答案捷径。'
  };
}

function coachConsole(selected, misconceptionTags, masterySignal, pasteRisk, activeStep) {
  const currentAction = QUICK_ACTIONS.find((item) => item.id === activeStep) || QUICK_ACTIONS[0];
  const tags = (misconceptionTags || []).map((item) => item.label || item.axis || item.hint).filter(Boolean);
  const mastery = masterySignal || {
    status: 'needs_student_step',
    evidence_needed: '孩子先给出自己的第一步，咕点才会继续帮。'
  };
  return {
    title: '今晚先看',
    label: '先问思路，只给最小提示，把错因讲清，再留下一句自己的话。',
    focus: selected && selected.text ? selected.text : '先锁定第一项必须做',
    wrongCause: tags.length ? tags.slice(0, 2).join(' / ') : '还在等卡点',
    currentAction: currentAction.label,
    actionDesc: currentAction.desc,
    masteryStatus: storage.formatInternalLabel ? storage.formatInternalLabel(mastery.status, '等孩子先说第一步') : mastery.status,
    evidence: storage.formatInternalLabel ? storage.formatInternalLabel(mastery.evidence_needed, mastery.evidence_needed) : mastery.evidence_needed,
    risk: pasteRisk ? pasteRisk.level : 'low',
    cards: [
      { id: 'ask', title: '先说第一步', body: '孩子先说题目要干嘛，准备先怎么动。' },
      { id: 'hint', title: '只推下一步', body: '作业点拨只打开下一步，不会整题代做。' },
      { id: 'cause', title: '说出错因', body: tags[0] || '先确认错在审题、建模、计算还是表达。' },
      { id: 'proof', title: '说回去', body: mastery.evidence_needed }
    ]
  };
}

function buildThinkingReceipt(messages = [], masterySignal, pasteRisk, activeStep, selected) {
  const safeMessages = Array.isArray(messages) ? messages : [];
  const userMessages = safeMessages.filter((item) => item.role === 'user');
  const assistantMessages = safeMessages.filter((item) => item.role === 'assistant');
  const studentFirst = userMessages.some((item) => String(item.text || '').length >= 8 && !/答案|直接|代写|帮我写/.test(String(item.text || '')));
  const blockedAnswer = (masterySignal && masterySignal.status === 'blocked_answer_request')
    || (pasteRisk && pasteRisk.level === 'high');
  const namedWrongCause = safeMessages.some((item) => /错因|卡在|审题|建模|条件|单位|符号|第一步/.test(String(item.text || '')));
  const proofSentence = masterySignal && masterySignal.status === 'ready_for_parent_review';
  const score = Math.min(100,
    36
    + (studentFirst ? 18 : 0)
    + (namedWrongCause ? 18 : 0)
    + (!blockedAnswer ? 14 : 0)
    + (proofSentence ? 14 : 0)
  );
  return {
    title: '思路记录',
    label: '看的不是“做完没”，而是有没有先想、有没有说清卡点、有没有知道下次先查什么。',
    score,
    focus: selected && selected.text ? selected.text : '还没锁定必须做',
    status: proofSentence ? '已可自己复述' : blockedAnswer ? '已拦住答案捷径' : '还在等一句自己的话',
    checks: [
      { id: 'first', label: '先有自己的想法', done: studentFirst, detail: studentFirst ? '已经说出一步或一个问题' : '还需要先交出自己的第一步' },
      { id: 'cause', label: '已经说出错因', done: namedWrongCause, detail: namedWrongCause ? '对话里出现了明确错因' : '还要把错因说具体' },
      { id: 'safe', label: '避免答案捷径', done: !blockedAnswer, detail: blockedAnswer ? '咕点拦住了直接要答案' : '当前没有高风险捷径' },
      { id: 'proof', label: '能自己复述', done: proofSentence, detail: proofSentence ? '已经可以用一句话讲回去' : '还差一句自己的复盘' }
    ],
    shareLine: `思路记录 ${score}/100 · 当前步骤 ${activeStep || 'read_problem'} · 点拨 ${assistantMessages.length} 轮 · 孩子 ${userMessages.length} 轮`
  };
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.map((item) => {
    if (typeof item === 'string') return { label: item };
    return {
      axis: item && item.axis ? item.axis : '',
      label: item && (item.label || item.name || item.keyword) ? (item.label || item.name || item.keyword) : '',
      hint: item && (item.hint || item.reason) ? (item.hint || item.reason) : ''
    };
  }).filter((item) => item.label || item.axis || item.hint).slice(0, 4);
}

function answerFromText(text) {
  const patterns = [
    /(?:答案|结果|等于|=|是)[:：]?\s*([A-Za-z0-9+\-*/().分之%√π]+)$/i,
    /我(?:算|写|选|做)的(?:答案|结果)?(?:是|为)?[:：]?\s*([A-Za-z0-9+\-*/().分之%√π]+)/i,
    /(?:选|答案选)\s*([A-D])/i
  ];
  for (let index = 0; index < patterns.length; index += 1) {
    const hit = String(text || '').match(patterns[index]);
    if (hit && hit[1]) return hit[1];
  }
  return '';
}

function fallbackReply(text, selected, step, misconceptionText) {
  const ladderResult = tutorLadder.buildTutorReply(text, {
    selected,
    currentHintLevel: 1
  });
  if (tutorLadder.isAnswerRequest(text) || tutorLadder.isStuckText(text)) {
    return ladderResult;
  }
  const target = selected && selected.text ? selected.text : '第一项必须做';
  const answerSeeking = tutorLadder.isAnswerRequest(text);
  const claimedAnswer = answerFromText(text);

  if (step === 'check_answer') {
    return {
      reply: claimedAnswer
        ? `收到你写的是「${claimedAnswer}」。先不判结果，我们核对思路：这一步用了哪个条件？`
        : '可以，我们核对思路。把“题目 + 你写的第一步”发来，我只看第一步是否站得住。',
      coach_step: 'write_first_step',
      coach_step_label: '提示 2/5',
      next_action: '发题目和你写的第一步。',
      mastery_signal: {
        status: 'needs_student_step',
        confidence: 0.76,
        evidence_needed: '学生需要提供自己的第一步，咕点只核对思路。'
      }
    };
  }

  if (step === 'fast_mode') {
    return {
      reply: `加快一点也可以：先看「${misconceptionText || '审题/条件/单位'}」。你只回第一步，我用一句话帮你看方向。`,
      coach_step: 'find_direction',
      coach_step_label: '提示 3/5',
      next_action: '先回第一步，不需要完整过程。',
      mastery_signal: {
        status: 'fast_check',
        confidence: 0.74,
        evidence_needed: '学生需要给出第一步或卡点。'
      }
    };
  }

  if (answerSeeking) {
    return ladderResult;
  }

  if (step === 'find_conditions') {
    return {
      reply: `先锁定「${target}」。请列两列：已知条件、要解决的问题。先不算答案。`,
      coach_step: 'find_conditions',
      coach_step_label: '找条件',
      next_action: '把已知条件和未知量分开列出来。',
      mastery_signal: {
        status: 'needs_student_step',
        confidence: 0.67,
        evidence_needed: '学生需要先列条件，再继续。'
      }
    };
  }

  if (step === 'write_first_step') {
    return {
      reply: '现在只写第一步：应该先设什么量、列什么关系，或先画哪条辅助信息。不要写最后结果。',
      coach_step: 'write_first_step',
      coach_step_label: '写第一步',
      next_action: '只写第一步式子或第一句判断，不写完整答案。',
      mastery_signal: {
        status: 'needs_student_step',
        confidence: 0.75,
        evidence_needed: '学生需要提交自己的第一步。'
      }
    };
  }

  if (step === 'explain_full') {
    return {
      reply: `我可以讲透方法，但不替你写最终结果。我们分三步：第一，看题目问什么；第二，找关键条件；第三，再连到方法。先把「${target}」里的题目原文发来。`,
      coach_step: 'read_problem',
      coach_step_label: '提示 1/5',
      next_action: '发题目原文，先一起找条件。',
      mastery_signal: {
        status: 'explain_requested',
        confidence: 0.75,
        evidence_needed: '学生需要在每一步后确认是否理解。'
      }
    };
  }

  if (step === 'explain_misconception') {
    return {
      reply: `先说错因。它大概率卡在「${misconceptionText || '审题建模'}」。你用一句话说：刚才哪一步想错了？`,
      coach_step: 'explain_misconception',
      coach_step_label: '说错因',
      next_action: '说清卡住的是审题、建模、计算还是表达。',
      mastery_signal: {
        status: 'needs_student_step',
        confidence: 0.7,
        evidence_needed: '学生需要说出自己的错因。'
      }
    };
  }

  if (step === 'transfer') {
    return {
      reply: `现在做举一反三。我先给相似例子，不给原题最终结果：如果把「${target}」里的一个条件换掉，第一步还应该检查什么？先说方法，不要算到底。`,
      coach_step: 'similar_example',
      coach_step_label: '提示 4/5',
      next_action: '说出同类题的第一步检查点，再尝试一个小变式。',
      mastery_signal: {
        status: 'transfer_check',
        confidence: 0.72,
        evidence_needed: '学生需要说明同类题第一步为什么不变。'
      }
    };
  }

  if (step === 'review') {
    return {
      reply: `复盘一句话：这类题下次先检查「${misconceptionText || '审题建模'}」，再动笔。把你的复盘句发来。`,
      coach_step: 'method_summary',
      coach_step_label: '提示 5/5',
      next_action: '用一句话总结下次先检查哪一步。',
      mastery_signal: {
        status: 'ready_for_parent_review',
        confidence: 0.78,
        evidence_needed: '学生需要说出本题错因和下次检查点。'
      }
    };
  }

  return {
    reply: `先抓「${target}」。它大概率和「${misconceptionText || '审题建模'}」有关。先用一句话说题目真正问什么。`,
    coach_step: 'read_problem',
    coach_step_label: '读题',
    next_action: '先用一句话说清题目真正问什么。',
    mastery_signal: {
      status: 'needs_student_step',
      confidence: 0.66,
      evidence_needed: '学生需要先说出题目在问什么。'
    }
  };
}

function safetyReply(result, input, selected, step, misconceptionText) {
  if (result && result.risk_type === 'self_harm') {
    return {
      reply: '这个内容我不能继续展开。请先告诉家长或老师；如果你现在很难受，优先联系身边可信的大人或当地紧急支持渠道。',
      coach_step: step || 'read_problem',
      coach_step_label: '读题',
      next_action: '优先联系可信的大人。',
      mastery_signal: {
        status: 'safety_redirect',
        confidence: 0.95,
        evidence_needed: '需要成年人接手。'
      }
    };
  }
  return fallbackReply(input, selected, step, misconceptionText);
}

Page({
  data: {
    input: '',
    loading: false,
    selected: null,
    selectedEvidence: null,
    weakPoints: [],
    misconceptionTags: [],
    activeStep: 'read_problem',
    coachStepLabel: '提示 1/5',
    currentHintLevel: 1,
    nextAction: '先用一句话说清题目真正问什么。',
    masterySignal: null,
    quickActions: QUICK_ACTIONS,
    guidedTutorModes: GUIDED_TUTOR_MODES,
    messages: [],
    pedagogy: null,
    pasteRisk: null,
    coachConsole: null,
    thinkingReceipt: null,
    showTutorDetails: false
  },

  trackedMasteryStatus: '',

  onShow() {
    const state = storage.loadState();
    let selected = storage.get(storage.KEYS.selectedHomework, null);
    if (!selected) {
      selected = ((state.homework_plan || {}).must_do || [])[0] || null;
      if (selected) {
        storage.set(storage.KEYS.selectedHomework, selected);
        storage.set(storage.KEYS.selectedHomeworkSource, 'auto_first_must');
      }
    }

    const selectedEvidence = selected && selected.evidence ? selected.evidence : null;
    const misconceptionTags = normalizeTags((selectedEvidence && selectedEvidence.misconception_tags) || []);
    const weakPoints = state.weak_points || [];
    const intro = selected
      ? `我已锁定今晚第一项必须做：「${selected.text}」。先说你的第一步，我只处理关键错因。`
      : '我只处理必须做任务和关键错因，不替你写作业。先从首页锁定一项今晚必须做。';
    const messages = storage.get(storage.KEYS.tutorMessages, null) || [
      { role: 'assistant', text: intro }
    ];

    const pasteRisk = pasteRiskSignal(messages);
    const receipt = buildThinkingReceipt(messages, null, pasteRisk, this.data.activeStep, selected);
    this.setData({
      selected,
      selectedEvidence,
      weakPoints,
      misconceptionTags,
      messages,
      pedagogy: pedagogyPanel(selected, misconceptionTags, null),
      pasteRisk,
      coachConsole: coachConsole(selected, misconceptionTags, null, pasteRisk, this.data.activeStep),
      thinkingReceipt: receipt
    });
    this.trackedMasteryStatus = '';
  },

  toggleTutorDetails() {
    this.setData({ showTutorDetails: !this.data.showTutorDetails });
  },

  onInput(event) {
    this.setData({ input: event.detail.value });
  },

  quickStart() {
    const selected = this.data.selected;
    if (!selected) {
      const state = storage.loadState();
      const first = ((state.homework_plan || {}).must_do || [])[0] || null;
      if (first) {
        storage.set(storage.KEYS.selectedHomework, first);
        storage.set(storage.KEYS.selectedHomeworkSource, 'quick_start_auto');
        this.setData({
          selected: first,
          selectedEvidence: first.evidence || null,
          misconceptionTags: normalizeTags((first.evidence && first.evidence.misconception_tags) || []),
          input: `带我做这项必须做：${first.text}`
        });
        return;
      }
      wx.navigateTo({ url: '/pages/radar/radar' });
      return;
    }
    this.setData({ input: `带我做这项必须做：${selected.text}` });
  },

  pickStep(event) {
    const step = event.currentTarget.dataset.step || 'read_problem';
    const action = QUICK_ACTIONS.find((item) => item.id === step);
    this.setData({
      activeStep: step,
      coachStepLabel: action ? action.label : '读题'
    });
  },

  sendQuick(event) {
    const step = event.currentTarget.dataset.step || this.data.activeStep || 'read_problem';
    const selected = this.data.selected;
    const stepTextMap = {
      read_problem: selected ? `先帮我读题：${selected.text}` : '先帮我读题',
      write_first_step: '我不知道下一步怎么写',
      find_direction: '给我一个方向，但不要直接讲最终结果',
      similar_example: '给我一个相似例子',
      method_summary: '帮我总结方法，做成复习卡',
      fast_mode: selected ? `我想加快一点，只提示方向和第一步。\n${selected.text}` : '我想加快一点，只提示方向和第一步。',
      find_conditions: '带我找条件',
      explain_misconception: '帮我判断错因',
      transfer: '带我做一道举一反三小变式',
      review: '带我做一句话复盘'
    };
    this.setData({
      activeStep: step,
      input: stepTextMap[step] || '带我做下一步'
    });
  },

  startGuidedTutorMode(event) {
    const id = event.currentTarget.dataset.id;
    const mode = GUIDED_TUTOR_MODES.find((item) => item.id === id) || GUIDED_TUTOR_MODES[0];
    const stepMap = {
      homework_coach: 'read_problem',
      wrong_cause: 'explain_misconception',
      transfer: 'transfer',
      parent_rehearsal: 'review'
    };
    const selected = this.data.selected;
    const step = stepMap[mode.id] || 'read_problem';
    const action = QUICK_ACTIONS.find((item) => item.id === step) || QUICK_ACTIONS[0];
    const target = selected && selected.text ? `：${selected.text}` : '';
    this.setData({
      activeStep: step,
      coachStepLabel: action.label,
      input: `${mode.prompt}${target}`
    });
  },

  send() {
    const input = String(this.data.input || '').trim();
    if (!input || this.data.loading) return;

    const state = storage.loadState();
    const selected = this.data.selected;
    const misconceptionText = this.data.misconceptionTags.map((item) => item.label || item.axis).filter(Boolean).join('、');
    const step = this.data.activeStep || 'read_problem';
    const messages = this.data.messages.concat([{ role: 'user', text: input }]);
    this.setData({ messages, input: '', loading: true });
    if (storage.saveTodayFocusFromThought && (selected || input.length >= 4)) {
      storage.saveTodayFocusFromThought(selected && selected.text ? selected.text : input, {
        source: 'tutor',
        stuckPointText: selected && selected.text ? selected.text : input
      });
    }
    const quality = storage.childStepQuality ? storage.childStepQuality(input) : 'empty';
    if (quality !== 'empty' && quality !== 'vague' && !/答案|直接|代写|帮我写|带我|提示|讲一下/.test(input)) {
      storage.saveChildArticulatedStep && storage.saveChildArticulatedStep(input, {
        tutorCompleted: true,
        firstStepQuality: quality,
        firstStepSource: 'child_articulated'
      });
    }

    const localHintLevel = tutorLadder.classifyHintLevel(input, this.data.messages, this.data.currentHintLevel);
    if (tutorLadder.isAnswerRequest(input) || tutorLadder.isStuckText(input)) {
      this.appendAssistant(tutorLadder.buildTutorReply(input, {
        messages: this.data.messages,
        currentHintLevel: this.data.currentHintLevel,
        selected
      }));
      return;
    }

    api.checkContent(input).then((check) => {
      if (check && check.safe === false) {
        this.appendAssistant(safetyReply(check, input, selected, step, misconceptionText));
        return null;
      }
      return api.sendTutorMessage({
        mode: 'homework',
        message: input,
        context: {
          coach_step: step,
          help_mode: step,
          hint_level: localHintLevel,
          hint_ladder: tutorLadder.HINT_LADDER,
          parent_goal: storage.loadParentGoal ? storage.loadParentGoal() : null,
          selected_homework: selected,
          weak_points: state.weak_points || [],
          misconception_tags: this.data.misconceptionTags,
          homework_plan: state.homework_plan || null
        }
      }).then((res) => {
        const guarded = res && res.reply && !tutorLadder.isAnswerRequest(input)
          ? Object.assign({
            hint_level: localHintLevel,
            hint_label: `提示 ${localHintLevel}/5`
          }, res)
          : fallbackReply(input, selected, step, misconceptionText);
        this.appendAssistant(guarded);
        return null;
      });
    }).catch(() => {
      this.appendAssistant(fallbackReply(input, selected, step, misconceptionText));
    });
  },

  appendAssistant(result) {
    const reply = result && result.reply ? result.reply : '先把你的第一步发来。';
    const next = this.data.messages.concat([{
      role: 'assistant',
      text: reply,
      hint_label: result && result.hint_label ? result.hint_label : ''
    }]);
    const masterySignal = result && result.mastery_signal ? result.mastery_signal : null;
    const coachStep = result && result.coach_step ? result.coach_step : this.data.activeStep;
    const currentHintLevel = result && result.hint_level ? Number(result.hint_level) : this.data.currentHintLevel;
    storage.set(storage.KEYS.tutorMessages, next.slice(-20));
    const pasteRisk = pasteRiskSignal(next);
    const receipt = buildThinkingReceipt(next, masterySignal, pasteRisk, coachStep, this.data.selected);
    if (storage.appendThinkingReceipt) {
      storage.appendThinkingReceipt(Object.assign({}, receipt, {
        selected_id: this.data.selected && this.data.selected.id,
        selected_text: this.data.selected && this.data.selected.text,
        coach_step: coachStep,
        mastery_status: masterySignal && masterySignal.status,
        risk: pasteRisk.level
      }));
    }
    this.setData({
      messages: next,
      loading: false,
      activeStep: coachStep,
      currentHintLevel,
      coachStepLabel: result && (result.hint_label || result.coach_step_label) ? (result.hint_label || result.coach_step_label) : this.data.coachStepLabel,
      nextAction: result && result.next_action ? result.next_action : this.data.nextAction,
      masterySignal,
      pedagogy: pedagogyPanel(this.data.selected, this.data.misconceptionTags, masterySignal),
      pasteRisk,
      coachConsole: coachConsole(this.data.selected, this.data.misconceptionTags, masterySignal, pasteRisk, coachStep),
      thinkingReceipt: receipt
    });
    this.syncTutorSignal(masterySignal, coachStep);
  },

  clearChat() {
    const messages = [
      {
        role: 'assistant',
        text: '已清空。继续按规则来：只处理必须做任务和关键错因。'
      }
    ];
    storage.set(storage.KEYS.tutorMessages, messages);
    this.setData({
      messages,
      masterySignal: null,
      nextAction: '先用一句话说清题目真正问什么。',
      thinkingReceipt: buildThinkingReceipt(messages, null, pasteRiskSignal(messages), this.data.activeStep, this.data.selected)
    });
  },

  goRadar() {
    wx.navigateTo({ url: '/pages/radar/radar' });
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' });
  },

  goFocus() {
    const session = storage.getTodaySession ? storage.getTodaySession() : null;
    const canStart = storage.canStartFocusFromTodaySession
      ? storage.canStartFocusFromTodaySession(session)
      : !!(session && session.childArticulatedStep);
    if (!canStart) {
      wx.showToast({ title: '先回咕点确认今晚第一步，才能进专注舱。', icon: 'none' });
      return;
    }
    wx.switchTab({ url: '/pages/focus/focus' });
  },

  goReview() {
    wx.switchTab({ url: '/pages/review/review' });
  },

  syncTutorSignal(masterySignal, coachStep) {
    if (!masterySignal || !masterySignal.status) return;
    if (this.trackedMasteryStatus === masterySignal.status) return;
    this.trackedMasteryStatus = masterySignal.status;
    const blocked = masterySignal.status === 'blocked_answer_request' || masterySignal.status === 'safety_redirect';
    const eventName = masterySignal.status === 'ready_for_parent_review'
      ? 'tutor_mastery_ready'
      : blocked
        ? 'tutor_blocked'
        : 'tutor_progress';
    const next = storage.trackTutorEvent(eventName, {
      coach_step: coachStep,
      mastery_status: masterySignal.status,
      blocked
    });
    api.submitEvent(next[0]).catch(() => {});
  }
});
