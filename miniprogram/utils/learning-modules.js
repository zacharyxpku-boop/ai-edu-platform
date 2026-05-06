const MODULES = [
  {
    id: 'math_route_problem',
    subject: 'Math',
    type: 'Route',
    title: 'Math Word Problem Route Map',
    scene: 'The learner gets stuck before knowing the first step.',
    grade: 'Upper primary to middle school',
    minutes: 20,
    userInput: 'Grade, problem type, and the step where the learner gets stuck.',
    aiTask: 'Break the problem into reading, known facts, unknown target, relation, first step, and review.',
    output: ['first step', 'must-practice item', 'skip or defer item'],
    tutorPrompt: 'Guide me through a math word-problem route map. Ask my grade and stuck point first, then give a 20-minute practice order.',
    mastery: 'The learner can say what the problem asks and list known facts, unknown target, and relation.',
    parentScript: 'Ask: what is the problem really asking, and what facts are already known?'
  },
  {
    id: 'math_7day_equation',
    subject: 'Math',
    type: '7-day Plan',
    title: '7-Day Equation Transposition Sprint',
    scene: 'Sign changes, brackets, and both-side operations keep going wrong.',
    grade: 'Grade 5 to Grade 7',
    minutes: 15,
    userInput: 'Current equation examples, recent mistakes, and available time.',
    aiTask: 'Create a seven-day micro plan with one sign or equality checkpoint each day.',
    output: ['daily target', 'one example', 'one checkpoint'],
    tutorPrompt: 'Give me a seven-day equation transposition plan under 15 minutes per day, focused on signs and equality.',
    mastery: 'The learner can explain why each transposition changes the sign and why equality still holds.',
    parentScript: 'Ask: why can this term move, and why did the sign change?'
  },
  {
    id: 'math_error_finder',
    subject: 'Math',
    type: 'Error Finder',
    title: 'Math Error Cause Finder',
    scene: 'The learner only says careless, but cannot name the real error cause.',
    grade: 'Primary to middle school',
    minutes: 12,
    userInput: 'Problem, learner answer, correct answer, and the learner thought process.',
    aiTask: 'Classify the error as reading, modeling, calculation, expression, or review.',
    output: ['error type', 'why it happened', 'next checkpoint'],
    tutorPrompt: 'Help me find the math error cause. Do not give the answer first; ask where I think the error happened.',
    mastery: 'The learner can say the exact step that failed and the checkpoint for next time.',
    parentScript: 'Tonight only ask for the error cause; naming the cause counts as progress.'
  },
  {
    id: 'math_mastery_test',
    subject: 'Math',
    type: 'Mastery Test',
    title: '5-Minute Math Mastery Test',
    scene: 'The parent cannot tell whether the learner truly understands or just got one answer right.',
    grade: 'Primary to middle school',
    minutes: 5,
    userInput: 'The concept just learned or the corrected mistake.',
    aiTask: 'Ask five short questions covering understanding, steps, transfer, and review.',
    output: ['mastered', 'half-clear', 'needs review'],
    tutorPrompt: 'Use five questions to test whether I really mastered this math point. Keep feedback short.',
    mastery: 'The learner can answer a transfer question and name the next checkpoint.',
    parentScript: 'Use five small questions before adding more practice.'
  },
  {
    id: 'english_vocab_recall',
    subject: 'English',
    type: 'Vocabulary',
    title: 'English Active Recall Vocabulary',
    scene: 'The learner copies words many times but forgets the next day.',
    grade: 'Primary to middle school',
    minutes: 15,
    userInput: 'Word list and words the learner can or cannot read.',
    aiTask: 'Group words by scene and generate pronunciation cues, examples, and recall checks.',
    output: ['must-know words', 'defer words', 'recall quiz'],
    tutorPrompt: 'Train English vocabulary with active recall by scene. Make me use each word in a sentence.',
    mastery: 'The learner can read, recognize, and use a word in a simple sentence.',
    parentScript: 'Ask: can you put this word into one sentence?'
  },
  {
    id: 'english_dialogue_roleplay',
    subject: 'English',
    type: 'Dialogue',
    title: 'English Daily Dialogue Coach',
    scene: 'The learner memorizes sentences but cannot continue a real conversation.',
    grade: 'Upper primary to middle school',
    minutes: 15,
    userInput: 'Dialogue scene such as ordering food, directions, or meeting someone.',
    aiTask: 'Run a short dialogue, correct errors immediately, and suggest a more natural phrase.',
    output: ['English reply', 'correction', 'natural expression'],
    tutorPrompt: 'Role-play a daily English dialogue with me. I reply in English; correct me and give a natural version.',
    mastery: 'The learner can complete five turns and reuse two new expressions.',
    parentScript: 'Check whether the learner can continue the next sentence, not only recite grammar.'
  },
  {
    id: 'english_writing_upgrade',
    subject: 'English',
    type: 'Writing',
    title: 'English Sentence Upgrade',
    scene: 'English writing is short, repetitive, and lacks connectors.',
    grade: 'Upper primary to middle school',
    minutes: 20,
    userInput: 'Three to five learner-written English sentences.',
    aiTask: 'Find common errors, give more natural sentence patterns, and ask for imitation.',
    output: ['error point', 'upgraded sentence', 'imitation task'],
    tutorPrompt: 'Upgrade my English sentences. Point out errors, give a natural expression, then ask me to imitate one sentence.',
    mastery: 'The learner can upgrade one simple sentence and explain why it sounds better.',
    parentScript: 'Upgrade only three sentences tonight; do not chase a perfect full essay.'
  },
  {
    id: 'chinese_reading_evidence',
    subject: 'Chinese',
    type: 'Reading',
    title: 'Chinese Reading Evidence Finder',
    scene: 'The learner answers from feeling and cannot point to evidence in the text.',
    grade: 'Upper primary to middle school',
    minutes: 15,
    userInput: 'Question stem, passage excerpt, and learner answer.',
    aiTask: 'Locate text evidence, unpack keywords, and organize the answer.',
    output: ['question keywords', 'text evidence', 'answer frame'],
    tutorPrompt: 'Help me find evidence in Chinese reading. First ask me to circle question keywords, then find the source sentence.',
    mastery: 'The learner can point to the source sentence and restate it in their own words.',
    parentScript: 'Ask: where is the evidence for this answer in the passage?'
  },
  {
    id: 'general_prerequisite_mapper',
    subject: 'General',
    type: 'Prerequisite',
    title: 'Prerequisite Knowledge Checker',
    scene: 'Before learning new content, nobody knows which old knowledge is missing.',
    grade: 'Primary to middle school',
    minutes: 12,
    userInput: 'New content, recent wrong problems, and the perceived difficult point.',
    aiTask: 'List required prior knowledge and check gaps with five small questions.',
    output: ['prerequisite list', 'gap questions', 'tonight repair item'],
    tutorPrompt: 'Check what prerequisite knowledge I need before learning this topic. Use five small questions.',
    mastery: 'The learner answers key prerequisite questions before entering new content.',
    parentScript: 'Ask: what old knowledge does this problem use?'
  },
  {
    id: 'general_retrieval_quiz',
    subject: 'General',
    type: 'Retrieval',
    title: 'Closed-Book Retrieval Quiz',
    scene: 'The learner keeps rereading notes and mistakes familiarity for mastery.',
    grade: 'Primary to middle school',
    minutes: 8,
    userInput: 'Today learned concept or notes.',
    aiTask: 'Generate five closed-book questions, ask first, then give short feedback.',
    output: ['recall question', 'correct point', 'review target'],
    tutorPrompt: 'Use five questions to help me recall today content without looking at notes.',
    mastery: 'The learner can recall core content without looking.',
    parentScript: 'Close the book and ask five small questions before rereading.'
  },
  {
    id: 'general_spaced_review',
    subject: 'General',
    type: 'Spaced Review',
    title: 'Three-Touch Spaced Review Planner',
    scene: 'The learner understands today but forgets two days later.',
    grade: 'Primary to middle school',
    minutes: 6,
    userInput: 'Content just mastered or half-understood.',
    aiTask: 'Schedule review questions for tonight, tomorrow, and three days later.',
    output: ['tonight check', 'tomorrow check', 'three-day check'],
    tutorPrompt: 'Plan three spaced review checks for this content: tonight, tomorrow, and three days later.',
    mastery: 'The learner can still recall the key point after spacing.',
    parentScript: 'Ask less today, but ask again tomorrow.'
  },
  {
    id: 'general_feynman_explain',
    subject: 'General',
    type: 'Explain',
    title: 'One-Sentence Feynman Explanation',
    scene: 'The learner says they understand but cannot explain clearly.',
    grade: 'Primary to middle school',
    minutes: 10,
    userInput: 'One concept, problem, or passage.',
    aiTask: 'Ask the learner to explain in one sentence, probe vague parts, and clarify.',
    output: ['learner wording', 'vague point', 'clearer wording'],
    tutorPrompt: 'Ask me to explain this concept in one sentence. Only probe unclear parts until I can say it clearly.',
    mastery: 'The learner can explain the concept without stacking jargon.',
    parentScript: 'Ask: how would you explain this to a younger student?'
  }
];

function listModules() {
  return MODULES.slice();
}

function getModule(id) {
  return MODULES.find((module) => module.id === id) || null;
}

function moduleEventStats(events = []) {
  const stats = {};
  (Array.isArray(events) ? events : []).forEach((event) => {
    const id = event.module_id || event.moduleId;
    if (!id) return;
    if (!stats[id]) {
      stats[id] = { viewed: 0, started: 0, completed: 0, reviewImported: 0, lastAt: '' };
    }
    if (event.event === 'module_viewed') stats[id].viewed += 1;
    if (event.event === 'module_started') stats[id].started += 1;
    if (event.event === 'module_completed') stats[id].completed += 1;
    if (event.event === 'module_review_pack_imported') stats[id].reviewImported += 1;
    stats[id].lastAt = event.created_at || stats[id].lastAt;
  });
  return stats;
}

function moduleNextAction(module, stat = {}, feedback = {}) {
  if (stat.started && !stat.completed) {
    return { action: 'complete', label: 'Complete evidence', reason: 'The module has started but has no mastery evidence yet.' };
  }
  if (stat.completed && !stat.reviewImported) {
    return { action: 'review_pack', label: 'Create review pack', reason: 'Completed module should be converted into spaced review cards.' };
  }
  if (feedback.notUseful > feedback.useful) {
    return { action: 'adjust', label: 'Adjust path', reason: 'Family feedback says this module is not fitting well.' };
  }
  return { action: 'start', label: 'Start module', reason: `${module.minutes || 15} minutes is enough for a focused session.` };
}

function textHit(text, words) {
  const value = String(text || '').toLowerCase();
  return words.some((word) => value.indexOf(String(word).toLowerCase()) >= 0);
}

function recommendModules(state = {}, limit = 5, feedbackMap = {}, moduleEvents = []) {
  const weakText = (state.weak_points || []).map((item) => `${item.name || ''} ${item.reason || ''}`).join(' ');
  const subject = state.subject || '';
  const eventStats = moduleEventStats(moduleEvents);
  return MODULES.map((module) => {
    const stat = eventStats[module.id] || {};
    const fb = feedbackMap[module.id] || { useful: 0, notUseful: 0 };
    let score = 20;
    const reasons = [];
    if (subject && (module.subject === subject || module.subject === 'General')) {
      score += module.subject === subject ? 28 : 12;
      reasons.push('subject fit');
    }
    if (textHit(`${module.title} ${module.scene} ${module.aiTask}`, weakText.split(/\s+/).filter(Boolean))) {
      score += 22;
      reasons.push('weak-point match');
    }
    if (fb.useful) score += fb.useful * 8;
    if (fb.notUseful) score -= fb.notUseful * 10;
    if (stat.started && !stat.completed) {
      score += 30;
      reasons.push('unfinished loop');
    }
    if (stat.completed && !stat.reviewImported) {
      score += 18;
      reasons.push('ready for review pack');
    }
    if (stat.reviewImported) score -= 8;
    const nextAction = moduleNextAction(module, stat, fb);
    return Object.assign({}, module, {
      score,
      nextAction,
      recommendReason: reasons.slice(0, 2).join(', ') || nextAction.reason
    });
  })
    .filter((module) => module.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function reviewStatsByModule(reviewCards = []) {
  const stats = {};
  (Array.isArray(reviewCards) ? reviewCards : []).forEach((card) => {
    const key = String(card.calibrationKey || '');
    if (key.indexOf('module:') !== 0) return;
    const id = key.replace('module:', '');
    if (!stats[id]) stats[id] = { cards: 0, leech: 0, mastered: 0, due: 0, weak: 0 };
    stats[id].cards += 1;
    if (card.leech || Number(card.lapses || 0) >= 2) stats[id].leech += 1;
    if (Number(card.interval || 0) >= 7 && Number(card.lapses || 0) === 0) stats[id].mastered += 1;
    if (!card.suspended && (!card.due || new Date(card.due).getTime() <= Date.now())) stats[id].due += 1;
    if (card.weakPoint) stats[id].weak += 1;
  });
  return stats;
}

function buildAdaptivePath(state, feedbackMap = {}, moduleEvents = [], limit = 5, reviewCards = []) {
  const eventStats = moduleEventStats(moduleEvents);
  const reviewStats = reviewStatsByModule(reviewCards);
  const candidates = recommendModules(state, Math.max(8, limit * 2), feedbackMap, moduleEvents);
  const enriched = candidates.map((item) => {
    const review = reviewStats[item.id] || { cards: 0, leech: 0, mastered: 0, due: 0, weak: 0 };
    const pressure = review.leech * 18 + review.due * 4 + review.weak * 3 - review.mastered * 5;
    const reviewSignal = review.leech
      ? { action: 'remediate', label: 'Review remediation', reason: `Review deck has ${review.leech} leech card(s) from this module.` }
      : review.cards && review.mastered >= Math.max(2, Math.ceil(review.cards * 0.6))
        ? { action: 'extend', label: 'Extend next', reason: 'Review cards show stable mastery evidence.' }
        : null;
    return Object.assign({}, item, {
      score: item.score + pressure,
      reviewStats: review,
      nextAction: reviewSignal || item.nextAction,
      recommendReason: reviewSignal ? reviewSignal.reason : item.recommendReason
    });
  }).sort((a, b) => b.score - a.score);
  const current = enriched.find((item) => item.reviewStats && item.reviewStats.leech > 0) || enriched.find((item) => {
    const stat = eventStats[item.id] || {};
    return stat.started && !stat.completed;
  }) || enriched.find((item) => {
    const stat = eventStats[item.id] || {};
    return stat.completed && !stat.reviewImported;
  }) || enriched[0] || null;
  const next = enriched.filter((item) => !current || item.id !== current.id).slice(0, Math.max(0, limit - 1));
  const completed = Object.keys(eventStats).filter((id) => eventStats[id].completed).length;
  const reviewReady = Object.keys(eventStats).filter((id) => eventStats[id].completed && !eventStats[id].reviewImported).length;
  const started = Object.keys(eventStats).filter((id) => eventStats[id].started).length;
  const reviewRemediation = Object.keys(reviewStats).filter((id) => reviewStats[id].leech > 0).length;
  return {
    current,
    next,
    stats: {
      started,
      completed,
      reviewReady,
      reviewRemediation,
      totalEvents: Array.isArray(moduleEvents) ? moduleEvents.length : 0
    },
    headline: current ? `Next: ${current.nextAction.label} - ${current.title}` : 'Next: pick one 10-20 minute module',
    reason: current ? current.nextAction.reason : 'Start collecting module signals first.'
  };
}

function toHomework(module) {
  if (!module) return null;
  return {
    id: `module_${module.id}`,
    text: module.title,
    reason: `${module.subject} / ${module.type} / ${module.scene}`,
    minutes: module.minutes || 15,
    evidence: {
      tags: [module.subject, module.type],
      decision: 'From the learning module library; suitable for a short tutor session.',
      calibration_key: `module:${module.id}`,
      misconception_tags: [
        {
          id: `module.${module.id}`,
          name: module.type,
          axis: module.subject,
          suggested_drill: module.aiTask
        }
      ]
    },
    priority_vector: {
      module_fit: 24,
      practice: 18,
      review: 12
    },
    module
  };
}

function toReviewPack(module) {
  if (!module) return null;
  const outputs = Array.isArray(module.output) ? module.output : [];
  const text = [
    `${module.title}: ${module.scene}`,
    `Method steps: first read the task, then find conditions, then watch the common trap.`,
    `step: first circle known facts and conditions, then write the relation.`,
    `trap: common mistakes include unit mix, sign errors, and missing conditions.`,
    `不要直接写答案，先审题，再看单位和符号。`,
    `cloze: active recall turns notes into ____ practice.`,
    `Use method: ${module.aiTask}`,
    `Mastery standard: ${module.mastery}`,
    `Common trap: do not start with the final answer; find the first checkpoint first.`,
    `Parent question: ${module.parentScript}`,
    outputs.length ? `Outputs: ${outputs.join(', ')}` : '',
    `Tutor launch: ${module.tutorPrompt}`
  ].filter(Boolean).join('\n');

  return {
    text,
    options: {
      subject: module.subject || '',
      weakPoint: module.type || '',
      calibrationKey: `module:${module.id}`,
      source: 'module_content_engine'
    },
    expectedTypes: ['concept', 'step', 'trap', 'cloze']
  };
}

function contentFactoryPacks(state = {}, reviewSummary = {}) {
  const subject = state.subject || 'General';
  const weakPoints = Array.isArray(state.weak_points) ? state.weak_points : [];
  const weakest = weakPoints.slice().sort((a, b) => Number(a.score || 100) - Number(b.score || 100))[0] || {};
  const due = Number(reviewSummary.due || 0);
  const packs = [
    {
      id: 'factory_weak_point_sprint',
      title: 'Weak Point Sprint Pack',
      subject,
      intent: 'diagnose_to_review',
      minutes: 12,
      prompt: `Build a 12-minute active recall sprint for ${subject}. Focus on ${weakest.name || 'the weakest point'}, ask before explaining, and end with one trap check.`,
      text: [
        `${weakest.name || subject}: explain the weak point in one sentence before doing more questions.`,
        `step: name the first checkpoint, then do the smallest useful action.`,
        `trap: do not repeat the old wrong cause; say the check before answering.`,
        `cloze: the first checkpoint is ____ before calculation or writing.`
      ].join('\n'),
      reason: 'Turns radar weakness into a ready review pack.'
    },
    {
      id: 'factory_exam_cram',
      title: 'Exam Cram Recall Pack',
      subject,
      intent: 'exam_mode',
      minutes: 15,
      prompt: `Create a short closed-book exam cram for ${subject}. Use active recall, mixed difficulty, and immediate wrong-cause repair.`,
      text: [
        `${subject} exam recall: close the book and answer the core rule first.`,
        `step: solve one representative problem by writing the method before the answer.`,
        `trap: if the answer is wrong, classify it as reading, concept, step, calculation, or habit.`,
        `cloze: exam repair starts from ____ not from copying the correct answer.`
      ].join('\n'),
      reason: due > 0 ? `There are ${due} due cards, so cram mode should start from review.` : 'Prepares a reusable exam-mode pack.'
    },
    {
      id: 'factory_parent_checkin',
      title: 'Parent Check-in Pack',
      subject: 'General',
      intent: 'family_loop',
      minutes: 6,
      prompt: 'Create three parent-friendly check-in questions: what was hard, what was the first checkpoint, and what will be checked tomorrow.',
      text: [
        `Parent check: what was the hardest point tonight?`,
        `step: say the first checkpoint in one sentence.`,
        `trap: do not say careless; name the exact wrong cause.`,
        `cloze: tomorrow I need to check ____ again.`
      ].join('\n'),
      reason: 'Makes the family loop visible without adding more homework.'
    }
  ];
  return packs.map((pack) => Object.assign({}, pack, {
    cards: 4,
    label: `${pack.minutes} min / ${pack.intent} / importable`,
    options: {
      subject: pack.subject,
      weakPoint: weakest.name || '',
      calibrationKey: `factory:${pack.id}`,
      source: 'ai_content_factory'
    }
  }));
}

module.exports = {
  listModules,
  getModule,
  moduleEventStats,
  moduleNextAction,
  recommendModules,
  reviewStatsByModule,
  buildAdaptivePath,
  toHomework,
  toReviewPack,
  contentFactoryPacks
};
