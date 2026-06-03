'use strict';

function asText(value) {
  if (value == null) return '';
  return String(value).trim();
}

function detectSubject(text) {
  if (/数学|应用题|方程|几何|分数|math/i.test(text)) return '数学';
  if (/英语|单词|语法|english/i.test(text)) return '英语';
  if (/语文|作文|阅读|古诗/i.test(text)) return '语文';
  if (/物理|电路|受力|physics/i.test(text)) return '物理';
  if (/化学|实验|反应|chemistry/i.test(text)) return '化学';
  return '学习任务';
}

function buildTutorReply(message, options = {}) {
  const text = asText(message);
  const level = Math.max(1, Math.min(5, Number(options.currentHintLevel || 1) + 1));
  const subject = detectSubject(text || options.selected && options.selected.weakPoint);
  return {
    task_type: subject === '数学' ? 'math_word_problem' : 'unknown',
    hint_level: level,
    reply: `第 ${level} 步：先说第一步。你不用直接算完，只要告诉我：这题先看条件、问题，还是先列关系？`,
    allowed_moves: ['ask_student_first_step', 'circle_condition', 'micro_choice'],
    mastery_signal: { status: 'learning_process_only' },
    real_homework_pressure_signal: {
      subject,
      wrongCause: text ? 'first_step_unknown' : 'needs_prompt'
    },
    answer_boundary_evidence: {
      status: 'no_final_answer',
      reviewSeed: {
        source: 'lobster_first_step',
        revisit: '明天换一个数字或条件，再说一遍第一步。'
      }
    },
    no_full_answer_boundary: '只追问第一步，不给整题答案。'
  };
}

function buildSocraticAiLocalBoundaryContract(taskType, pressureSignal = {}) {
  return {
    taskType: taskType || 'unknown',
    pressureSignal,
    noFinalAnswer: true,
    allowedMoves: ['ask_student_first_step', 'micro_choice', 'hint_without_solution'],
    blockedMoves: ['final_answer', 'full_solution', 'score_promise']
  };
}

function guardAiTutorReply(aiReply, contract, options = {}) {
  const fallback = options.localFallback || buildTutorReply('');
  const raw = asText(aiReply && aiReply.reply);
  const unsafe = /答案是|最终答案|完整解法|直接填|therefore the answer/i.test(raw);
  if (!raw || unsafe) {
    return Object.assign({}, fallback, {
      reply: fallback.reply,
      ai_guard: { status: unsafe ? 'blocked_answer_request' : 'fallback_used' }
    });
  }
  return Object.assign({}, fallback, {
    reply: raw,
    ai_guard: { status: 'safe' }
  });
}

function parseScoreSubjects(text) {
  const subjects = {};
  const source = asText(text);
  [
    ['math', '数学'],
    ['chinese', '语文'],
    ['english', '英语'],
    ['physics', '物理'],
    ['chemistry', '化学']
  ].forEach(([key, label]) => {
    const matched = source.match(new RegExp(`${label}[^0-9]{0,6}(\\d{1,3})`));
    if (matched) subjects[key] = { label, score: Number(matched[1]) };
  });
  return subjects;
}

function buildLearningReportDraft(input = {}) {
  const text = asText(input.sourceText || input.scoreText || input.parentObservation);
  const parsedScores = parseScoreSubjects(text);
  const subjectLabels = Object.values(parsedScores).map((item) => item.label);
  const priority = subjectLabels.length ? subjectLabels : [detectSubject(text)];
  const firstSubject = priority[0] || '学习任务';
  const parentScript = `${firstSubject}今晚先只问一个问题：这类题第一步先看哪里？`;
  const parentDecisionBook = {
    title: '家长龙虾学习分析报告',
    oneSentenceDecision: `${firstSubject} 今晚先收证据，不评价能力，不加题量。`,
    prioritySubjects: priority,
    tonightDo: [
      parentScript,
      '只处理第一步入口，不扩到整章。',
      '孩子说不出第一步时，用 A/B 微选择。'
    ],
    nextEvidenceQueue: [
      '孩子能否说出第一步',
      '是否需要提示才能开始',
      '明天换一个条件是否还能迁移'
    ]
  };
  return {
    reportDraft: {
      parsedScores,
      parentDecisionBook,
      tonightDecisionHeadline: parentDecisionBook.oneSentenceDecision,
      tonightDecisionBrief: { parentScript },
      personalizedParentReportPreview: {
        format: 'html',
        html: `<section><h1>${parentDecisionBook.title}</h1><p>${parentDecisionBook.oneSentenceDecision}</p></section>`,
        standard: { version: 'fallback-v1' }
      }
    },
    parentDecisionBook,
    parsedScores,
    personalizedParentReportPreview: {
      format: 'html',
      html: `<section><h1>${parentDecisionBook.title}</h1><p>${parentDecisionBook.oneSentenceDecision}</p></section>`,
      standard: { version: 'fallback-v1' }
    },
    familyLearningDecisionReport: {
      qualityCheck: {
        safeForParent: true,
        noScorePromise: true
      }
    }
  };
}

module.exports = {
  tutorLadder: {
    buildTutorReply,
    buildSocraticAiLocalBoundaryContract,
    guardAiTutorReply
  },
  learningReport: {
    buildLearningReportDraft
  }
};
