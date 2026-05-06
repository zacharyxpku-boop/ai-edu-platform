const api = require('../../utils/api');
const storage = require('../../utils/storage');

const QUICK_ACTIONS = [
  { id: 'read_problem', label: '读题', desc: '先说题目真正问什么' },
  { id: 'find_conditions', label: '找条件', desc: '圈已知、未知和单位' },
  { id: 'write_first_step', label: '写第一步', desc: '只写开头，不要答案' },
  { id: 'explain_misconception', label: '说错因', desc: '说清卡在哪一步' },
  { id: 'review', label: '复盘', desc: '总结下次先检查什么' }
];

const PEDAGOGY_LADDER = [
  { id: 'question', title: 'Question first', desc: 'Ask before telling.' },
  { id: 'hint', title: 'Smallest hint', desc: 'Only unblock the next step.' },
  { id: 'misconception', title: 'Wrong-cause lens', desc: 'Name the misconception, not just the mistake.' },
  { id: 'reflection', title: 'Reflection', desc: 'End with one sentence the child can say back.' }
];

const TUTOR_GUARDRAILS = [
  'No full answer substitution',
  'Must-do homework only',
  'Parent-visible reasoning',
  'Copy-paste risk stays blocked'
];

function pedagogyPanel(selected, misconceptionTags, masterySignal) {
  const misconception = (misconceptionTags || []).map((item) => item.label || item.axis).filter(Boolean).slice(0, 2);
  const status = masterySignal && masterySignal.status ? masterySignal.status : 'needs_student_step';
  return {
    title: 'TUTOR PEDAGOGY LAYER',
    status,
    focus: selected && selected.text ? selected.text : 'First must-do item',
    misconception: misconception.length ? misconception.join(' / ') : 'Clarify the wrong cause before solving',
    ladder: PEDAGOGY_LADDER,
    guardrails: TUTOR_GUARDRAILS,
    teacherView: 'Visible to parents/teachers as: current step, wrong-cause status, next action.',
    label: status === 'ready_for_parent_review'
      ? 'The learner is ready to explain the wrong cause back to a parent.'
      : status === 'blocked_answer_request'
        ? 'The learner asked for the answer, so the tutor stays in boundary mode.'
        : 'The tutor should ask, hint, diagnose, then reflect.'
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
    title: 'COPY-PASTE RISK GATE',
    level: longPaste && answerSeeking ? 'high' : longPaste ? 'watch' : 'low',
    label: longPaste && answerSeeking
      ? 'Long pasted text plus answer-seeking detected; keep tutor in boundary mode.'
      : longPaste
        ? 'Long pasted text detected; ask for the student first step before helping.'
        : 'No obvious copy-paste shortcut behavior in the latest turns.'
  };
}

function coachConsole(selected, misconceptionTags, masterySignal, pasteRisk, activeStep) {
  const currentAction = QUICK_ACTIONS.find((item) => item.id === activeStep) || QUICK_ACTIONS[0];
  const tags = (misconceptionTags || []).map((item) => item.label || item.axis || item.hint).filter(Boolean);
  const mastery = masterySignal || {
    status: 'needs_student_step',
    evidence_needed: 'The child must give one first step before the tutor unlocks more help.'
  };
  return {
    title: 'SOCRATIC COACH CONSOLE',
    label: 'Ask first, hint small, name the wrong cause, then capture one proof sentence.',
    focus: selected && selected.text ? selected.text : 'Lock the first must-do task first',
    wrongCause: tags.length ? tags.slice(0, 2).join(' / ') : 'Waiting for wrong-cause evidence',
    currentAction: currentAction.label,
    actionDesc: currentAction.desc,
    masteryStatus: mastery.status,
    evidence: mastery.evidence_needed,
    risk: pasteRisk ? pasteRisk.level : 'low',
    cards: [
      { id: 'ask', title: 'Ask first', body: 'The student states the task and the first move.' },
      { id: 'hint', title: 'Hint small', body: 'The tutor only unlocks the next useful step.' },
      { id: 'cause', title: 'Name cause', body: tags[0] || 'Clarify the misconception before solving.' },
      { id: 'proof', title: 'Proof sentence', body: mastery.evidence_needed }
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
    title: 'THINKING RECEIPT',
    label: 'A parent-visible proof that the child thought before help, named the wrong cause, and avoided answer-copy shortcuts.',
    score,
    focus: selected && selected.text ? selected.text : 'No must-do item locked yet',
    status: proofSentence ? 'ready for parent review' : blockedAnswer ? 'answer shortcut blocked' : 'collecting thinking proof',
    checks: [
      { id: 'first', label: 'Student first thought', done: studentFirst, detail: studentFirst ? 'student produced a step or question' : 'still needs a first thought' },
      { id: 'cause', label: 'Wrong cause named', done: namedWrongCause, detail: namedWrongCause ? 'wrong-cause language appeared' : 'ask for exact cause' },
      { id: 'safe', label: 'Answer-copy avoided', done: !blockedAnswer, detail: blockedAnswer ? 'direct answer request was blocked' : 'no high-risk shortcut now' },
      { id: 'proof', label: 'Proof sentence', done: proofSentence, detail: proofSentence ? 'ready to explain to parent' : 'needs one-sentence reflection' }
    ],
    shareLine: `Thinking proof ${score}/100: ${activeStep || 'read_problem'} / ${assistantMessages.length} tutor turns / ${userMessages.length} student turns.`
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

function fallbackReply(text, selected, step, misconceptionText) {
  const target = selected && selected.text ? selected.text : '第一项必须做';
  if (/答案|直接|代写|帮我写/.test(text)) {
    return {
      reply: '我不能替你写答案。先把你想到的第一步发来，我只给最小提示。',
      coach_step: 'write_first_step',
      coach_step_label: '写第一步',
      next_action: '先发自己的第一步或卡住的条件，我只给最小提示。',
      mastery_signal: {
        status: 'blocked_answer_request',
        confidence: 0.88,
        evidence_needed: '学生需要先给出自己的第一步或卡点。'
      },
      homework_boundary: true
    };
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

  if (step === 'review') {
    return {
      reply: `复盘一句话：这类题下次先检查「${misconceptionText || '审题建模'}」，再动笔。把你的复盘句发来。`,
      coach_step: 'review',
      coach_step_label: '复盘',
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
    coachStepLabel: '读题',
    nextAction: '先用一句话说清题目真正问什么。',
    masterySignal: null,
    quickActions: QUICK_ACTIONS,
    messages: [],
    pedagogy: null,
    pasteRisk: null,
    coachConsole: null,
    thinkingReceipt: null
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
      : '我只处理必须做任务和关键错因，不替你写作业。先从雷达页锁定一项必须做。';
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
      wx.switchTab({ url: '/pages/radar/radar' });
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
      find_conditions: '带我找条件',
      write_first_step: '带我写第一步',
      explain_misconception: '帮我判断错因',
      review: '带我做一句话复盘'
    };
    this.setData({
      activeStep: step,
      input: stepTextMap[step] || '带我做下一步'
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
          selected_homework: selected,
          weak_points: state.weak_points || [],
          misconception_tags: this.data.misconceptionTags,
          homework_plan: state.homework_plan || null
        }
      }).then((res) => {
        this.appendAssistant(res || fallbackReply(input, selected, step, misconceptionText));
        return null;
      });
    }).catch(() => {
      this.appendAssistant(fallbackReply(input, selected, step, misconceptionText));
    });
  },

  appendAssistant(result) {
    const reply = result && result.reply ? result.reply : '先把你的第一步发来。';
    const next = this.data.messages.concat([{ role: 'assistant', text: reply }]);
    const masterySignal = result && result.mastery_signal ? result.mastery_signal : null;
    const coachStep = result && result.coach_step ? result.coach_step : this.data.activeStep;
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
      coachStepLabel: result && result.coach_step_label ? result.coach_step_label : this.data.coachStepLabel,
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
