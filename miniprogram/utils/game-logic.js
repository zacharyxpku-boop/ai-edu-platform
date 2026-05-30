'use strict';

const DAY_MS = 24 * 60 * 60 * 1000;

const XP_REWARDS = {
  new_card: 10,
  quiz_correct: 20,
  daily_review_complete: 30,
  review_again: 4,
  review_fuzzy: 8,
  review_remembered: 12,
  review_easy: 16,
  wrong_cause_repaired: 15,
  study_pack_created: 20
};

const LEVEL_TITLES = ['新手', '起步', '会学', '稳步掌握', '能讲清楚'];

const ACHIEVEMENTS = [
  { id: 'first_review', title: '初出茅庐', description: '完成第一次复习', recordPoints: 20, test: (stats) => Number(stats.review_count || 0) >= 1 },
  { id: 'hundred_correct', title: '百题斩', description: '累计答对 100 题', recordPoints: 80, test: (stats) => Number(stats.correct_count || 0) >= 100 },
  { id: 'seven_day_streak', title: '七日之约', description: '连续 7 天完成复习', recordPoints: 70, test: (stats) => Number(stats.streak || 0) >= 7 },
  {
    id: 'quiz_master_3',
    title: '稳定回忆',
    description: '连续 3 次小测正确率达到 90%',
    recordPoints: 90,
    test: (stats) => {
      const recent = Array.isArray(stats.recent_quiz_accuracy) ? stats.recent_quiz_accuracy.slice(-3) : [];
      return recent.length >= 3 && recent.every((item) => Number(item || 0) >= 90);
    }
  },
  { id: 'whole_book', title: '全书贯通', description: '学完一本教材的全部知识点', recordPoints: 120, test: (stats) => Number(stats.completed_books || 0) >= 1 }
];

const SHOP_ITEMS = [
  { id: 'avatar_origin_gold', type: 'avatar_frame', title: '原点金色头像框', recordCost: 60, description: '装饰性头像框，不影响学习收益。' },
  { id: 'theme_forest_focus', type: 'theme', title: '森林专注主题', recordCost: 90, description: '深绿护眼轻练主题。' },
  { id: 'card_warm_grid', type: 'card_back', title: '暖色网格卡背', recordCost: 50, description: '闪卡背面装饰。' },
  { id: 'streak_freeze', type: 'streak_freeze', title: '补签卡', recordCost: 180, description: '保护一次断签，只能用本机学习点换取。' }
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isoDate(date) {
  return (date || new Date()).toISOString().slice(0, 10);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS).toISOString();
}

function daysBetween(a, b) {
  const start = new Date(`${a}T00:00:00.000Z`).getTime();
  const end = new Date(`${b}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.round((end - start) / DAY_MS);
}

function calculateXP(actionType, streakMultiplierValue) {
  const base = XP_REWARDS[actionType] || 0;
  const multiplier = clamp(Number(streakMultiplierValue || 1), 1, 5);
  return Math.round(base * multiplier);
}

function streakMultiplier(streak) {
  const value = Number(streak || 0);
  if (value >= 100) return 3;
  if (value >= 30) return 2;
  if (value >= 7) return 1.5;
  return 1;
}

function getLevel(xp) {
  const total = Math.max(0, Number(xp || 0));
  const level = Math.floor(Math.sqrt(total / 100));
  const currentFloor = Math.pow(level, 2) * 100;
  const nextLevelXp = Math.pow(level + 1, 2) * 100;
  return {
    level,
    title: LEVEL_TITLES[Math.min(level, LEVEL_TITLES.length - 1)],
    currentXp: total,
    nextLevelXp,
    progress: nextLevelXp > currentFloor
      ? Math.round(((total - currentFloor) / (nextLevelXp - currentFloor)) * 100)
      : 100
  };
}

function applySM2(card, grade, now) {
  const currentCard = card || {};
  const reviewAt = now || new Date();
  const current = {
    repetitions: Math.max(0, Number(currentCard.repetitions ?? currentCard.reps ?? 0)),
    interval: Math.max(0, Number(currentCard.interval || 0)),
    ease_factor: Number(currentCard.ease_factor || currentCard.easeFactor || 2.5)
  };
  let repetitions = current.repetitions;
  let interval = current.interval;
  let easeFactor = current.ease_factor;

  if (grade === 'forgotten' || grade === 'again') {
    repetitions = 0;
    interval = 1;
    easeFactor = 2.5;
  } else if (grade === 'fuzzy' || grade === 'hard') {
    interval = Math.max(1, Math.round(interval * 0.5));
    easeFactor = clamp(easeFactor - 0.15, 1.3, 3.2);
  } else {
    repetitions += 1;
    if (repetitions === 1) interval = 1;
    else if (repetitions === 2) interval = 3;
    else interval = Math.max(1, Math.round(Math.max(1, interval) * easeFactor));
    easeFactor = clamp(easeFactor + (grade === 'easy' ? 0.2 : 0.1), 1.3, 3.2);
  }

  return Object.assign({}, currentCard, {
    repetitions,
    interval,
    ease_factor: Number(easeFactor.toFixed(2)),
    last_review: reviewAt.toISOString(),
    next_review: addDays(reviewAt, interval)
  });
}

function updateStreak(user, options) {
  const profile = user || {};
  const opts = options || {};
  const reviewedToday = Number(opts.reviewedToday || 0);
  const threshold = Number(opts.threshold || 10);
  const today = isoDate(opts.now || new Date());
  const last = profile.last_study_date || '';
  const current = Number(profile.streak || 0);
  const freezes = Math.max(0, Number(profile.streak_freezes || profile.streak_freeze || 0));

  if (reviewedToday < threshold) {
    return Object.assign({}, profile, {
      streak: last && daysBetween(last, today) > 1 ? 0 : current,
      best_streak: Math.max(Number(profile.best_streak || 0), current)
    });
  }

  if (last === today) {
    return Object.assign({}, profile, {
      best_streak: Math.max(Number(profile.best_streak || 0), current),
      last_study_date: today
    });
  }

  const gap = last ? daysBetween(last, today) : 0;
  const missed = Math.max(0, gap - 1);
  const canProtect = missed > 0 && freezes >= missed;
  const nextStreak = !last ? 1 : (gap <= 1 || canProtect ? current + 1 : 1);
  const usedFreezes = canProtect ? missed : 0;

  return Object.assign({}, profile, {
    streak: nextStreak,
    best_streak: Math.max(Number(profile.best_streak || 0), nextStreak),
    streak_freezes: Math.max(0, freezes - usedFreezes),
    last_study_date: today
  });
}

function checkAndUnlockAchievements(stats) {
  const currentStats = stats || {};
  const currentAchievements = Array.isArray(currentStats.achievements) ? currentStats.achievements : [];
  const existing = new Set(currentAchievements);
  const newlyUnlocked = ACHIEVEMENTS.filter((achievement) => !existing.has(achievement.id) && achievement.test(currentStats));
  return {
    achievements: Array.from(new Set(currentAchievements.concat(newlyUnlocked.map((item) => item.id)))),
    newlyUnlocked,
    recordPointsAwarded: newlyUnlocked.reduce((sum, item) => sum + Number(item.recordPoints || 0), 0)
  };
}

function listAchievements(unlocked) {
  const owned = new Set(Array.isArray(unlocked) ? unlocked : []);
  return ACHIEVEMENTS.map((item) => Object.assign({}, item, { unlocked: owned.has(item.id) }));
}

function listShopItems(inventory) {
  const owned = new Set((Array.isArray(inventory) ? inventory : []).map((item) => item.item_id || item.id));
  return SHOP_ITEMS.map((item) => Object.assign({}, item, { owned: owned.has(item.id) }));
}

function purchaseShopItem(user, item) {
  const profile = user || {};
  const shopItem = item && item.id ? item : SHOP_ITEMS.find((entry) => entry.id === item);
  if (!shopItem || !shopItem.id) return { ok: false, error: 'item_not_found', user: profile };
  return {
    ok: false,
    error: 'catalog_only',
    message: '当前只展示本机装饰记录，不提供交易功能。',
    user: profile,
    item: shopItem
  };
}

function capDailyXP(currentDailyXp, delta, cap) {
  const current = Math.max(0, Number(currentDailyXp || 0));
  const requested = Math.max(0, Number(delta || 0));
  const allowed = Math.max(0, Math.min(requested, Number(cap || 500) - current));
  return { allowed, capped: allowed < requested, total: current + allowed };
}

function quizQuestionFromCard(card) {
  const currentCard = card || {};
  const answer = String(currentCard.answer || '').trim();
  const distractors = ['先看题目条件再判断', '把概念和例题混在一起', '只记答案不说原因']
    .filter((item) => item !== answer)
    .slice(0, 3);
  return {
    id: `quiz_${currentCard.id || Date.now()}`,
    card_id: currentCard.id || '',
    type: answer.length <= 16 ? 'choice' : 'short_answer',
    question: currentCard.question || '',
    answer,
    options: answer.length <= 16 ? [answer].concat(distractors).slice(0, 4) : [],
    explanation: currentCard.hint || currentCard.weakPoint || '先回忆，再对照答案说出错因。'
  };
}

function buildKnowledgeGap(events, cards) {
  const gaps = {};
  const list = Array.isArray(cards) ? cards : [];
  const cardById = list.reduce((acc, card) => {
    if (card && card.id) acc[card.id] = card;
    if (card && card.card_id) acc[card.card_id] = card;
    return acc;
  }, {});
  (Array.isArray(events) ? events : []).forEach((event) => {
    if (!event || !['again', 'forgotten', 'wrong'].includes(event.rating || event.result)) return;
    const sourceCard = cardById[event.card_id] || cardById[event.cardId] || null;
    const key = event.weakPoint
      || event.knowledge_point
      || (sourceCard && (sourceCard.weakPoint || sourceCard.wrongCauseLabel || sourceCard.knowledge_point || sourceCard.subject))
      || event.subject
      || '未标注';
    if (!gaps[key]) gaps[key] = { key, count: 0, subjects: {} };
    gaps[key].count += 1;
    const subject = event.subject || (sourceCard && sourceCard.subject);
    if (subject) gaps[key].subjects[subject] = (gaps[key].subjects[subject] || 0) + 1;
  });
  return Object.values(gaps).sort((a, b) => b.count - a.count).slice(0, 8).map((item) => Object.assign({}, item, {
    next_action: list.some((card) => [card.weakPoint, card.wrongCauseLabel, card.knowledge_point, card.subject].includes(item.key)) ? '复习相关卡片' : '补充一张错因卡'
  }));
}

function dueCardCount(cards = [], now = new Date()) {
  const nowTime = now.getTime();
  return (Array.isArray(cards) ? cards : []).filter((card) => {
    const due = new Date(card.next_review || card.due || card.dueDate || 0).getTime();
    return !Number.isFinite(due) || due <= nowTime;
  }).length;
}

function isDueCard(card = {}, now = new Date()) {
  const dueValue = card.next_review || card.due || card.dueDate || '';
  if (!dueValue) return true;
  const due = new Date(dueValue).getTime();
  return !Number.isFinite(due) || due <= now.getTime();
}

function getEventCardId(event = {}) {
  return event.card_id || event.cardId || event.reviewCardId || event.card_id_str || (event.card && event.card.id) || '';
}

function buildReviewEventPressure(events = []) {
  return (Array.isArray(events) ? events : []).reduce((acc, event, index) => {
    const cardId = getEventCardId(event);
    if (!cardId) return acc;
    const text = [
      event.type,
      event.event,
      event.name,
      event.result,
      event.rating,
      event.status
    ].filter(Boolean).join(' ').toLowerCase();
    const wrong = /wrong|again|hard|lapse|leech|repair|fail|stuck/.test(text);
    const right = /correct|good|easy|pass|master/.test(text);
    const current = acc[cardId] || { cardId, wrong: 0, right: 0, lastIndex: -1, pressure: 0 };
    current.wrong += wrong ? 1 : 0;
    current.right += right ? 1 : 0;
    current.lastIndex = Math.max(current.lastIndex, index);
    current.pressure = current.wrong * 3 - current.right;
    acc[cardId] = current;
    return acc;
  }, {});
}

function rankCardsByReviewPressure(cards = [], eventPressure = {}, now = new Date()) {
  const nowTime = now.getTime();
  return (Array.isArray(cards) ? cards : []).slice().sort((a, b) => {
    const aPressure = eventPressure[a.id] || {};
    const bPressure = eventPressure[b.id] || {};
    const aDue = new Date(a.next_review || a.due || a.dueDate || 0).getTime();
    const bDue = new Date(b.next_review || b.due || b.dueDate || 0).getTime();
    const aOverdue = Number.isFinite(aDue) ? Math.max(0, nowTime - aDue) : 0;
    const bOverdue = Number.isFinite(bDue) ? Math.max(0, nowTime - bDue) : 0;
    const aScore = Number(aPressure.pressure || 0) * 1000 + Math.min(999, Math.floor(aOverdue / 86400000));
    const bScore = Number(bPressure.pressure || 0) * 1000 + Math.min(999, Math.floor(bOverdue / 86400000));
    if (bScore !== aScore) return bScore - aScore;
    return Number(bPressure.lastIndex || 0) - Number(aPressure.lastIndex || 0);
  });
}

function normalizeEvidenceBias(input = {}) {
  const allowedRoutes = [
    '/pages/tutor/tutor',
    '/pages/review/review',
    '/pages/arcade/arcade',
    '/pages/profile/profile',
    '/pages/focus/focus',
    '/pages/home/home'
  ];
  const route = allowedRoutes.includes(input.nextRoute) ? input.nextRoute : '/pages/tutor/tutor';
  const mode = ['repair', 'stretch', 'balanced'].includes(input.gameModeBias) ? input.gameModeBias : 'balanced';
  return Object.assign({}, input, {
    nextRoute: route,
    gameModeBias: mode,
    weakKey: input.weakKey || 'first_step',
    questBias: input.questBias || 'socratic'
  });
}

function buildDailyQuestSet(profile = {}, cards = [], events = [], options = {}) {
  const now = options.now || new Date();
  const evidenceBias = options.evidenceBias ? normalizeEvidenceBias(options.evidenceBias) : null;
  const due = dueCardCount(cards, now);
  const gaps = buildKnowledgeGap(events, cards);
  const reviewedToday = Number(profile.reviewed_today || profile.reviewedToday || 0);
  const correctToday = Number(profile.correct_today || profile.correctToday || 0);
  const accuracy = reviewedToday ? Math.round((correctToday / reviewedToday) * 100) : 0;
  const weakKey = gaps[0] && gaps[0].key ? gaps[0].key : 'first_step';
  const repairTarget = Math.max(1, Math.min(3, due || (Array.isArray(cards) ? cards.length : 0) || 1));
  const base = [
    {
      id: 'quest_first_step',
      kind: 'socratic',
      target: 1,
      progress: Number(profile.first_step_count || 0) > 0 ? 1 : 0,
      rewardXp: calculateXP('new_card', streakMultiplier(profile.streak)),
      route: '/pages/tutor/tutor',
      evidenceRequired: ['student_first_step']
    },
    {
      id: 'quest_repair_due_cards',
      kind: 'review',
      target: repairTarget,
      progress: Math.min(Math.max(0, reviewedToday), repairTarget),
      rewardXp: calculateXP('wrong_cause_repaired', streakMultiplier(profile.streak)),
      route: '/pages/review/review',
      evidenceRequired: ['wrong_cause', 'next_practice_plan']
    },
    {
      id: 'quest_focus_round',
      kind: 'focus',
      target: 1,
      progress: Number(profile.focus_rounds_today || profile.focusRoundsToday || 0) > 0 ? 1 : 0,
      rewardXp: calculateXP('daily_review_complete', streakMultiplier(profile.streak)),
      route: '/pages/focus/focus',
      evidenceRequired: ['focus_seconds', 'parent_recap']
    },
    {
      id: 'quest_arcade_precision',
      kind: 'arcade',
      target: 80,
      progress: accuracy,
      rewardXp: calculateXP('quiz_correct', streakMultiplier(profile.streak)),
      route: '/pages/arcade/arcade',
      evidenceRequired: ['accuracy', 'wrong_answers_returned']
    }
  ];
  const bossQuest = {
    id: 'quest_boss_gap',
    kind: 'boss_gap',
    target: 1,
    progress: gaps.length ? 0 : 1,
    rewardXp: calculateXP('wrong_cause_repaired', streakMultiplier(profile.streak)),
    route: '/pages/review/review',
    evidenceRequired: ['top_gap', 'repair_card']
  };
  const evidenceQuest = evidenceBias ? {
    id: 'quest_evidence_return',
    kind: evidenceBias.questBias || 'evidence',
    target: 1,
    progress: Number(profile.evidence_return_count || profile.evidenceReturnCount || 0) > 0 ? 1 : 0,
    rewardXp: calculateXP('daily_review_complete', streakMultiplier(profile.streak)),
    route: evidenceBias.nextRoute,
    evidenceRequired: ['global_evidence', evidenceBias.weakKey || 'next_step'],
    source: evidenceBias.source || 'global_evidence',
    reasonLine: evidenceBias.reasonLine || ''
  } : null;
  const prioritized = evidenceQuest
    ? [evidenceQuest].concat(gaps.length ? [bossQuest] : [], base)
    : (gaps.length ? [bossQuest].concat(base) : base);
  const visibleQuests = prioritized.slice(0, 4);
  return {
    date: isoDate(now),
    dueCards: due,
    weakKey: evidenceBias && evidenceBias.weakKey ? evidenceBias.weakKey : weakKey,
    quests: visibleQuests,
    evidenceBias,
    completionRate: visibleQuests.length ? Math.round((visibleQuests.filter((item) => item.progress >= item.target).length / visibleQuests.length) * 100) : 0
  };
}

function buildAdaptiveChallenge(cards = [], events = [], profile = {}, options = {}) {
  const evidenceBias = options.evidenceBias ? normalizeEvidenceBias(options.evidenceBias) : null;
  const reviewed = Number(profile.reviewed_today || profile.reviewedToday || 0);
  const correct = Number(profile.correct_today || profile.correctToday || 0);
  const accuracy = reviewed ? Math.round((correct / reviewed) * 100) : Number(options.defaultAccuracy || 70);
  const gaps = buildKnowledgeGap(events, cards);
  const due = dueCardCount(cards, options.now || new Date());
  const baseMode = accuracy < 60 || gaps.length >= 2
    ? 'repair'
    : accuracy >= 85 && due <= 3
      ? 'stretch'
      : 'balanced';
  const mode = evidenceBias && evidenceBias.gameModeBias === 'repair'
    ? 'repair'
    : evidenceBias && evidenceBias.gameModeBias === 'stretch' && accuracy >= 75 && due <= 4
      ? 'stretch'
      : baseMode;
  const roundSize = mode === 'repair' ? 4 : mode === 'stretch' ? 8 : 6;
  return {
    mode,
    roundSize,
    lives: mode === 'repair' ? 4 : 3,
    targetAccuracy: mode === 'stretch' ? 90 : mode === 'repair' ? 70 : 80,
    bossCard: gaps[0] ? {
      key: gaps[0].key,
      count: gaps[0].count,
      nextAction: gaps[0].next_action
    } : evidenceBias && evidenceBias.weakKey ? {
      key: evidenceBias.weakKey,
      count: 1,
      nextAction: evidenceBias.reasonLine || evidenceBias.weakKey
    } : null,
    mix: {
      due: Math.min(due, roundSize),
      newCards: Math.max(0, roundSize - Math.min(due, roundSize)),
      repairBias: mode === 'repair' ? 'high' : 'normal',
      evidenceBias: evidenceBias ? evidenceBias.questBias : ''
    },
    evidenceBias,
    rationale: mode === 'repair'
      ? 'recent misses need a smaller repair round'
      : mode === 'stretch'
        ? 'recent accuracy supports a harder transfer round'
        : 'balanced review keeps recall stable'
  };
}

function buildGameRetentionLoop(profile = {}, result = {}, challenge = {}, questSet = {}, options = {}) {
  const total = Math.max(1, Number(result.total || result.expectedTotal || 1));
  const correct = Math.max(0, Number(result.correct || 0));
  const wrong = Math.max(0, Number(result.wrong || Math.max(0, total - correct)));
  const accuracy = Number.isFinite(Number(result.accuracy))
    ? Number(result.accuracy)
    : Math.round((correct / total) * 100);
  const targetAccuracy = Number(challenge.targetAccuracy || 80);
  const mode = challenge.mode || 'balanced';
  const weakKey = (challenge.bossCard && (challenge.bossCard.nextAction || challenge.bossCard.key))
    || questSet.weakKey
    || options.weakKey
    || '第一步';
  const streak = Number((profile && profile.streak) || 0);
  const reviewedToday = Number((profile && (profile.reviewed_today || profile.reviewedToday)) || 0);
  const xp = Math.max(0, Number(result.xp || 0));
  const needsRepair = wrong > 0 || accuracy < targetAccuracy;
  const nextRoute = needsRepair ? '/pages/review/review' : (mode === 'stretch' ? '/pages/tutor/tutor' : '/pages/focus/focus');
  const nextMode = needsRepair ? 'repair' : (mode === 'stretch' ? 'transfer' : 'steady');
  const nextRoundSize = needsRepair
    ? Math.max(3, Math.min(4, Number(challenge.roundSize || 4)))
    : Math.max(4, Math.min(8, Number(challenge.roundSize || 6)));
  const questNames = Array.isArray(questSet.quests)
    ? questSet.quests.slice(0, 2).map((item) => item.id).filter(Boolean)
    : [];

  return {
    title: needsRepair ? '下一局先修断点' : '下一步继续迁移',
    mode: nextMode,
    riskLevel: needsRepair ? 'attention' : 'stable',
    loopLine: `本局 ${correct}/${total}，不是单次得分，会写回错因、复习队列和家长报告。`,
    nextRoundLine: needsRepair
      ? `下一局缩小到 ${nextRoundSize} 题，只练 ${weakKey}。`
      : `下一步用 ${nextRoundSize} 题做迁移，确认孩子能换题也说出第一步。`,
    wrongCauseReturnLine: needsRepair
      ? `错的 ${wrong} 张会回到修卡点和间隔复习，不靠重刷蒙过。`
      : '本局没有明显断点，保留为可分享的掌握证据。',
    tomorrowLine: reviewedToday >= 6
      ? '明天只回访最不稳的一张卡，避免把轻练习变成刷题。'
      : '明天从同一张卡的第一步开始回访，家长只问一句。',
    xpLine: xp > 0 ? `本局写入 ${xp} 点学习记录。` : '本局先写入行为证据，不做虚拟奖励交易。',
    habitCue: streak > 0
      ? `连续 ${streak} 天记录已保留，下一次只接着补一小步。`
      : '先建立第一次回访记录，再谈连续习惯。',
    nextRoute,
    evidenceRequired: ['accuracy', 'wrong_answers_returned', 'next_round_plan', 'parent_report_signal'],
    questAnchors: questNames,
    weakKey
  };
}

function buildHealthyReturnHabitEngine(profile = {}, result = {}, retention = {}, highFrequency = {}, options = {}) {
  const streak = Number(profile.streak || profile.currentStreak || 0);
  const reviewedToday = Number(profile.reviewed_today || profile.reviewedToday || 0);
  const wrong = Number(result.wrong || 0);
  const accuracy = Number.isFinite(Number(result.accuracy)) ? Number(result.accuracy) : 0;
  const weakKey = retention.weakKey || options.weakKey || 'first_step';
  const rescue = retention.mode === 'repair' || wrong > 0 || accuracy < Number(options.targetAccuracy || 80);
  const hasRealRecallSource = highFrequency.hasRealRecallSource !== false;
  const returnLoops = [
    {
      id: 'morning_30s_recall',
      window: 'next_morning',
      trigger: 'open_app_or_parent_share_revisit',
      action: `recall one ${weakKey} first step before new practice`,
      route: '/pages/review/review?from=healthy_return_morning',
      rewardGate: 'first_step_named_only'
    },
    {
      id: 'after_school_rescue',
      window: 'after_school',
      trigger: rescue ? 'same_wrong_cause_or_low_accuracy' : 'due_card_exists',
      action: rescue ? `repair one ${weakKey} card, no new volume` : `review one due ${weakKey} card`,
      route: rescue ? '/pages/review/review?from=healthy_return_rescue' : '/pages/arcade/arcade?from=healthy_return_due',
      rewardGate: rescue ? 'wrong_cause_named_before_xp' : 'real_recall_card_before_xp'
    },
    {
      id: 'parent_20s_receipt',
      window: 'evening_parent',
      trigger: 'parent_opens_report_or_share_card',
      action: 'parent asks one first-step question, not score or ranking',
      route: '/pages/profile/profile?from=healthy_return_parent',
      rewardGate: 'parent_receipt_no_ranking'
    },
    {
      id: 'day7_transfer_check',
      window: 'day7',
      trigger: 'portrait_confidence_before_release',
      action: 'try one near-transfer item before updating long-term portrait',
      route: '/pages/tutor/tutor?from=healthy_return_day7',
      rewardGate: 'near_transfer_evidence_before_portrait'
    }
  ];
  return {
    id: 'healthy_return_habit_engine',
    title: 'Healthy daily return engine',
    mode: rescue ? 'rescue_first' : 'steady_return',
    habitStrength: streak >= 7 ? 'formed' : streak >= 3 ? 'warming' : 'new',
    returnLoops,
    primaryReturn: returnLoops[rescue ? 1 : 0],
    comebackCopy: reviewedToday > 0
      ? `Come back for one ${weakKey} first step, not another worksheet.`
      : `Start with one ${weakKey} first step and stop before fatigue.`,
    antiAddictionPolicy: {
      maxDailyVisibleLoops: 4,
      noInfiniteScroll: true,
      noRankingPressure: true,
      stopAfterProof: 'stop after first_step, wrong_cause, or next_day_revisit proof',
      parentBoundary: 'parent sees proof and next action, not a leaderboard'
    },
    localCodeOwns: ['return_window', 'xp_release_gate', 'reward_cap', 'share_fields', 'portrait_release_gate'],
    aiMayRewrite: ['comeback_copy', 'parent_prompt', 'child_friendly_hint'],
    aiMustNotOwn: ['reward_release', 'ranking', 'score_pressure', 'infinite_loop_trigger'],
    releaseGate: hasRealRecallSource
      ? 'real_recall_source_ready'
      : 'blocked_until_real_recall_source',
    blockedFields: ['original_question', 'full_answer', 'score', 'ranking', 'private_comment', 'full_dialogue']
  };
}

function buildFamilyCoCreationReturnLoop(healthyReturnHabitEngine = {}, dailyPrimaryRecallAction = {}, result = {}, options = {}) {
  const weakKey = options.weakKey || dailyPrimaryRecallAction.weakKey || 'first_step';
  const rescue = healthyReturnHabitEngine.mode === 'rescue_first' || Number(result.wrong || 0) > 0 || Number(result.accuracy || 100) < 80;
  const returnStory = [
    {
      id: 'episode_1_name_the_stuck_point',
      day: 'today',
      childAction: dailyPrimaryRecallAction.oneActionLine || `Say the first step for ${weakKey}.`,
      parentAction: dailyPrimaryRecallAction.parentLine || `Ask one first-step question about ${weakKey}.`,
      unlockGate: 'child_first_step_recorded'
    },
    {
      id: 'episode_2_wrong_cause_echo',
      day: 'tomorrow',
      childAction: `Retell why ${weakKey} was stuck without opening the answer.`,
      parentAction: 'Confirm the wrong-cause wording, not the score.',
      unlockGate: 'next_day_revisit_recorded'
    },
    {
      id: 'episode_3_near_transfer',
      day: 'day7',
      childAction: `Try one tiny transfer for ${weakKey}.`,
      parentAction: 'Only ask whether the first step stayed the same.',
      unlockGate: 'day7_transfer_evidence'
    }
  ];
  return {
    id: 'family_co_creation_return_loop',
    mode: rescue ? 'rescue_story' : 'steady_story',
    title: 'Family co-created comeback story',
    dailyComebackCard: {
      id: 'daily_most_worth_return_card',
      weakKey,
      route: dailyPrimaryRecallAction.route || '/pages/review/review?from=family_return_loop',
      action: dailyPrimaryRecallAction.oneActionLine || `One ${weakKey} first-step recall.`,
      rewardGate: dailyPrimaryRecallAction.xpGate || 'XP only after first-step and revisit evidence',
      blockedRewards: ['speed', 'ranking', 'raw_volume', 'score_pressure']
    },
    returnStory,
    weeklyChallenge: {
      id: 'family_weekly_no_ranking_challenge',
      target: 'finish 3 evidence-backed returns in 7 days',
      allowedProof: ['child_first_step', 'wrong_cause_echo', 'next_day_revisit', 'day7_transfer'],
      notAllowed: ['leaderboard', 'class_rank', 'screen_time_binge', 'raw_problem_count'],
      route: '/pages/profile/profile?from=family_weekly_return'
    },
    shareCard: {
      id: 'family_co_creation_safe_share',
      allowedFields: ['weak_key', 'first_step_action', 'return_window', 'parent_question', 'next_route'],
      blockedFields: ['original_question', 'full_answer', 'score', 'ranking', 'full_dialogue', 'private_comment'],
      receiverAction: 'Open the same first-step return card; do not compare scores or rankings.'
    },
    localCodeOwns: ['daily_card_selection', 'unlock_gate', 'xp_gate', 'share_fields', 'anti_addiction_cap'],
    aiMayRewrite: ['child_card_copy', 'parent_question_copy', 'weekly_story_title'],
    aiMustNotOwn: ['reward_release', 'leaderboard', 'ranking', 'score_pressure', 'infinite_return_trigger'],
    antiAddictionPolicy: {
      maxDailyComebackCards: 1,
      maxWeeklyChallenges: 1,
      stopAfterEvidence: true,
      noRankingPressure: true,
      noInfiniteScroll: true
    },
    evidenceRequired: ['daily_most_worth_return_card', 'wrong_cause_episode', 'weekly_no_ranking_challenge', 'family_safe_share_payload']
  };
}

function buildDailyComebackDecisionEngine(healthyReturnHabitEngine = {}, familyCoCreationReturnLoop = {}, dailyPrimaryRecallAction = {}, result = {}, options = {}) {
  const weakKey = options.weakKey || dailyPrimaryRecallAction.weakKey || 'first_step';
  const hasRealRecallSource = dailyPrimaryRecallAction.status !== 'waiting_real_recall_source';
  const wrong = Number(result.wrong || 0);
  const accuracy = Number.isFinite(Number(result.accuracy)) ? Number(result.accuracy) : 0;
  const rescue = healthyReturnHabitEngine.mode === 'rescue_first' || wrong > 0 || accuracy < Number(options.targetAccuracy || 80);
  const loops = Array.isArray(healthyReturnHabitEngine.returnLoops) ? healthyReturnHabitEngine.returnLoops : [];
  const story = Array.isArray(familyCoCreationReturnLoop.returnStory) ? familyCoCreationReturnLoop.returnStory : [];
  const candidateCards = [
    {
      id: 'real_recall_source_gate',
      label: 'Add one real recall source',
      priority: hasRealRecallSource ? 4 : 1,
      locked: hasRealRecallSource,
      action: 'Add one real wrong-question or homework stuck point before XP, 90-second recall, or peer relay.',
      route: '/pages/upload/upload?from=daily_comeback&type=wrong_question_paper',
      proof: 'real_recall_source'
    },
    {
      id: 'rescue_wrong_cause',
      label: 'Rescue one wrong-cause card',
      priority: rescue ? 1 : 3,
      locked: !hasRealRecallSource,
      action: `Repair one ${weakKey} card: first step, wrong cause, tomorrow revisit.`,
      route: dailyPrimaryRecallAction.route || '/pages/review/review?from=daily_comeback',
      proof: 'wrong_cause_named'
    },
    {
      id: 'steady_first_step',
      label: 'One steady first-step recall',
      priority: rescue ? 3 : 1,
      locked: !hasRealRecallSource,
      action: `Recall one ${weakKey} first step and stop before fatigue.`,
      route: (loops[0] && loops[0].route) || '/pages/review/review?from=daily_comeback',
      proof: 'student_first_step'
    },
    {
      id: 'family_receipt',
      label: 'Parent 20-second receipt',
      priority: 2,
      locked: false,
      action: (story[0] && story[0].parentAction) || 'Parent asks one first-step question, not a score question.',
      route: '/pages/profile/profile?from=daily_comeback',
      proof: 'parent_receipt'
    }
  ].sort((a, b) => a.priority - b.priority);
  const primary = candidateCards.find((item) => !item.locked) || candidateCards[0];
  return {
    id: 'daily_comeback_decision_engine',
    title: 'Daily comeback decision',
    status: hasRealRecallSource ? 'ready' : 'waiting_real_recall_source',
    mode: rescue ? 'rescue_first' : 'steady_return',
    primaryCard: primary,
    candidateCards,
    decisionLine: primary
      ? `Today return for: ${primary.label}.`
      : 'Add real evidence before returning.',
    stopRule: 'One comeback action per visit: stop after first-step, wrong-cause, next-day revisit, or parent receipt evidence.',
    rewardGate: hasRealRecallSource
      ? 'XP can release only after child-authored first step, wrong-cause naming, and revisit lock.'
      : 'No XP, share, 90-second recall, or peer relay before a real recall source exists.',
    parentLine: 'Parent sees the comeback reason and next proof, not ranking, speed, or raw volume.',
    antiAddictionPolicy: {
      onePrimaryCardOnly: true,
      noInfiniteScroll: true,
      noLeaderboard: true,
      maxMinutes: rescue ? 8 : 6
    },
    localCodeOwns: ['primary_card_selection', 'daily_cap', 'reward_gate', 'blocked_fields', 'route'],
    aiMayRewrite: ['child_copy', 'parent_copy'],
    aiMustNotOwn: ['reward_release', 'ranking', 'service_upgrade', 'mastery_claim'],
    blockedFields: ['original_question', 'full_answer', 'score', 'ranking', 'full_dialogue', 'raw_volume'],
    evidenceRequired: ['daily_primary_card', 'real_recall_source_gate', 'reward_gate', 'anti_addiction_policy', 'parent_receipt']
  };
}

function buildMemoryFeedbackController(cards = [], events = [], result = {}, retention = {}, options = {}) {
  const safeCards = Array.isArray(cards) ? cards : [];
  const safeEvents = Array.isArray(events) ? events : [];
  const wrong = Math.max(0, Number(result.wrong || 0));
  const accuracy = Number.isFinite(Number(result.accuracy)) ? Number(result.accuracy) : 0;
  const stickyCards = safeCards.filter((card) => card.leech || Number(card.lapses || 0) >= 2);
  const recentWrongCauseEvents = safeEvents
    .filter((event) => /wrong|错|repair|leech|again/.test(String(event.type || event.event || event.name || '')))
    .slice(-6);
  const weakKey = retention.weakKey || options.weakKey || (stickyCards[0] && (stickyCards[0].wrongCauseLabel || stickyCards[0].weakPoint)) || '第一步';
  const triggered = wrong > 0 || stickyCards.length > 0 || accuracy < Number(options.targetAccuracy || 80);
  const severity = stickyCards.length >= 2 || wrong >= 3 || accuracy < 50
    ? 'high'
    : triggered
      ? 'watch'
      : 'stable';
  const triggerSignals = [
    wrong > 0 ? `本局错 ${wrong} 张` : '',
    stickyCards.length ? `${stickyCards.length} 张顽固错因卡` : '',
    recentWrongCauseEvents.length >= 2 ? `最近 ${recentWrongCauseEvents.length} 次错因事件` : ''
  ].filter(Boolean);
  return {
    id: 'memory_feedback_controller',
    title: triggered ? '记忆负反馈已启动' : '记忆反馈稳定',
    severity,
    triggered,
    weakKey,
    triggerSignals: triggerSignals.length ? triggerSignals : ['本局暂未触发降级'],
    interventionSteps: triggered
      ? [
        `暂停加题量，只练「${weakKey}」的第一步`,
        '错因卡回到今天和明天的回访队列',
        '连续两次说清第一步后，再开放变式练习'
      ]
      : [
        '保持 3 张主动回忆',
        '明天回访 1 张最不稳的卡',
        '第 7 天做一题小变式'
      ],
    xpThrottle: triggered
      ? '本轮 XP 只给主动回忆和错因修复，不奖励盲刷题量。'
      : '本轮 XP 可进入巩固，但仍以次日回访为准。',
    nextReview: triggered
      ? `下一次先回到「${weakKey}」小黑板。`
      : '下一次可做小变式，但仍要先说第一步。',
    parentLine: triggered
      ? `家长复盘只问：${weakKey} 这一步，你明天还能自己说出来吗？`
      : '家长只确认孩子是否能复述第一步，不追问分数。',
    evidenceRequired: ['wrong_cause_return', 'xp_throttle', 'next_day_revisit', 'parent_feedback_line']
  };
}

function buildRecallIntensityPlan(weakKey = '第一步', needsRepair = false, result = {}) {
  const accuracy = Number.isFinite(Number(result.accuracy)) ? Number(result.accuracy) : 0;
  const wrong = Math.max(0, Number(result.wrong || 0));
  const tier = needsRepair || wrong > 0 || accuracy < 80 ? 'repair' : 'stretch';
  return {
    id: 'recall_intensity_plan',
    tier,
    title: tier === 'repair' ? '三轮修复节奏' : '三轮迁移节奏',
    rounds: [
      { id: 'now', label: '现在', size: tier === 'repair' ? 3 : 4, rule: `只回忆「${weakKey}」第一步，答不出就降到二选一。`, route: '/pages/review/review' },
      { id: 'tomorrow', label: '明天', size: 1, rule: `只抽最不稳 1 张，确认不是当场会、转身忘。`, route: '/pages/review/review' },
      { id: 'day7', label: '第 7 天', size: 1, rule: tier === 'repair' ? '仍不稳就继续降阶，不加题量。' : '换一题小变式，确认能迁移。', route: '/pages/tutor/tutor' }
    ],
    stopRule: '同一错因连续两次卡住，停止刷题，回到第一步小黑板。',
    releaseRule: '连续两次能自己说清第一步，才释放变式练习。'
  };
}

function buildWrongCauseReplayDeck(cards = [], weakKey = '第一步') {
  const safeCards = Array.isArray(cards) ? cards : [];
  const picked = safeCards
    .filter((card) => {
      const text = [card.wrongCauseLabel, card.weakPoint, card.question, card.front].filter(Boolean).join(' ');
      return !weakKey || text.indexOf(weakKey) >= 0 || card.leech || Number(card.lapses || 0) > 0;
    })
    .slice(0, 4);
  const source = picked.length ? picked : safeCards.slice(0, 4);
  const deck = source.map((card, index) => ({
    id: card.id || `replay_${index + 1}`,
    order: index + 1,
    label: card.wrongCauseLabel || card.weakPoint || weakKey,
    prompt: card.question || card.front || `复述「${weakKey}」第一步`,
    repairMove: card.nextAction || card.checkpoint || `先说出「${weakKey}」的一步小动作。`,
    route: '/pages/review/review'
  }));
  while (deck.length < 3) {
    const order = deck.length + 1;
    deck.push({
      id: `synthetic_replay_${order}`,
      order,
      label: weakKey,
      prompt: `第 ${order} 张错因返场：${weakKey}`,
      repairMove: `先复述「${weakKey}」第一步，再看答案。`,
      route: '/pages/review/review'
    });
  }
  return {
    id: 'wrong_cause_replay_deck',
    title: '错因返场牌组',
    cards: deck.slice(0, 4),
    rule: '返场牌只修同一错因，不混入新难题。',
    evidenceRequired: ['wrong_cause_label', 'repair_move', 'next_day_revisit']
  };
}

function buildXpFeedbackPolicy(memoryFeedbackController = {}, result = {}) {
  const triggered = !!memoryFeedbackController.triggered;
  const xp = Math.max(0, Number(result.xp || 0));
  return {
    id: 'xp_feedback_policy',
    title: triggered ? 'XP 降噪规则' : 'XP 巩固规则',
    rewardLine: triggered
      ? '本轮只奖励主动回忆和错因修复，不奖励题量。'
      : '本轮 XP 可以记录掌握，但仍要等次日回访确认。',
    throttleLine: triggered
      ? `已写入 ${xp} XP；若同错因继续错，下一轮 XP 上限降低。`
      : `已写入 ${xp} XP；下一轮看迁移，不看刷题数量。`,
    parentLine: '家长看 XP 只看行为证据，不把 XP 当成绩排名。',
    evidenceRequired: ['active_recall_xp', 'wrong_cause_repair_xp', 'next_day_confirmed']
  };
}

function buildQuestArcRunway(questCadence = [], retention = {}, weakKey = '第一步') {
  const quests = Array.isArray(questCadence) ? questCadence : [];
  return {
    id: 'quest_arc_runway',
    title: '任务弧跑道',
    stages: quests.map((quest, index) => ({
      id: quest.id || `quest_${index + 1}`,
      order: index + 1,
      label: quest.label || '任务',
      status: Number(quest.done || 0) >= Number(quest.target || 1) ? 'done' : 'next',
      nextAction: quest.reward || `完成「${weakKey}」的一步回忆`,
      route: index === 0 ? '/pages/review/review' : index === 1 ? '/pages/tutor/tutor' : '/pages/profile/profile'
    })),
    bossLine: `本轮 boss 不是难题，是「${retention.weakKey || weakKey}」能否跨天复述。`,
    completionRule: '主动回忆、错因修复、家长复盘三段都出现，才算一轮闭环。'
  };
}

function uniqueCompact(list, max = 6) {
  const seen = {};
  return (Array.isArray(list) ? list : []).reduce((acc, item) => {
    const text = String(item || '').replace(/\s+/g, ' ').trim();
    if (!text || seen[text]) return acc;
    seen[text] = true;
    if (acc.length < max) acc.push(text);
    return acc;
  }, []);
}

function pickMemoryKeywordsFromCard(card = {}, weakKey = '第一步') {
  const raw = [
    card.testKeyword,
    card.answer,
    card.weakPoint,
    card.wrongCause,
    card.wrongCauseLabel,
    card.firstStep,
    card.firstStepHint,
    card.visualMove,
    card.blackboardMove,
    card.label,
    weakKey
  ].filter(Boolean).join(' ');
  const tokens = String(raw)
    .replace(/[，。！？、；：｜|/()[\]{}"'“”‘’]/g, ' ')
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item && item.length >= 2 && item.length <= 12);
  const preferred = tokens.filter((item) => /第一步|错因|变量|单位|条件|图像|关系|证据|关键词|结构|方向|对照|回访|迁移/.test(item));
  return uniqueCompact(preferred.length ? preferred : tokens, 4);
}

function buildGreenWordClozeProtocol(cards = [], weakKey = '第一步', result = {}) {
  const sourceCards = (Array.isArray(cards) ? cards : []).slice(0, 6);
  const wrong = Math.max(0, Number(result.wrong || 0));
  const accuracy = Number.isFinite(Number(result.accuracy)) ? Number(result.accuracy) : 0;
  const rescue = wrong >= 2 || accuracy < 60;
  const clozeCards = sourceCards.slice(0, rescue ? 3 : 4).map((card, index) => {
    const keywords = pickMemoryKeywordsFromCard(card, weakKey);
    const keyword = keywords[0] || weakKey;
    const basePrompt = card.question || card.prompt || card.sampleStem || card.label || `用自己的题复述 ${weakKey}`;
    const clozePrompt = String(basePrompt).indexOf(keyword) >= 0
      ? String(basePrompt).replace(keyword, '____')
      : `${basePrompt}｜先补出关键动作：____`;
    return {
      id: card.id ? `${card.id}_green_word_${index + 1}` : `green_word_${index + 1}`,
      sourceCardId: card.id || '',
      label: card.label || card.question || `考点卡 ${index + 1}`,
      targetKeyword: keyword,
      keywordCandidates: keywords,
      clozePrompt,
      revealRule: '先遮住答案，补关键词；说不出就降到二选一，不直接给完整答案。',
      nextMode: index === 0 ? 'cloze' : index === 1 ? 'typed_recall' : index === 2 ? 'wrong_cause_choice' : 'near_transfer',
      parentCheck: card.parentCheck || `家长只问：${keyword} 这一处你明天还能自己说出来吗？`,
      blockedFields: ['original_question', 'full_answer', 'score', 'ranking', 'full_dialogue']
    };
  });
  const targetKeywords = uniqueCompact(clozeCards.reduce((list, card) => list.concat(card.keywordCandidates || []), []), 8);
  return {
    id: 'green_word_cloze_protocol',
    title: rescue ? '错因关键词急救' : '绿色考点挖空',
    mode: rescue ? 'rescue_cloze' : 'progressive_cloze',
    status: clozeCards.length ? 'ready' : 'waiting_cards',
    targetKeywords,
    clozeCards,
    progressiveQuizModes: [
      { id: 'cloze', label: '挖空', rule: '先补一个关键词或第一步动作。' },
      { id: 'typed_recall', label: '输入回忆', rule: '不看答案，用自己的话写第一步。' },
      { id: 'wrong_cause_choice', label: '错因选择', rule: '从两个错因里选更像自己的那个。' },
      { id: 'near_transfer', label: '近迁移', rule: '换材料后只说哪里没变。' }
    ],
    localCodeOwns: ['keyword_selection', 'cloze_order', 'reward_gate', 'spaced_revisit', 'share_blocked_fields'],
    aiMayRewrite: ['prompt_copy', 'parent_friendly_wording'],
    aiMustNotOwn: ['target_keyword_source', 'final_answer', 'mastery_claim', 'xp_release', 'share_fields'],
    releaseGate: '只有补出关键词、说出第一步并锁定明天回访，才放行 XP 或分享。',
    shareBoundary: '分享只带关键词类别、第一步动作和回访窗口，不带原题、答案、分数、排名或完整对话。',
    evidenceRequired: ['green_word_cloze', 'active_recall_keyword', 'progressive_quiz_mode', 'spaced_revisit', 'local_reward_gate']
  };
}

function buildGizmoLikeMemoryProtocol(profile = {}, cards = [], events = [], result = {}, retention = {}, options = {}) {
  const safeCards = Array.isArray(cards) ? cards : [];
  const safeEvents = Array.isArray(events) ? events : [];
  const weakKey = retention.weakKey || options.weakKey || '第一步';
  const wrong = Math.max(0, Number(result.wrong || 0));
  const accuracy = Number.isFinite(Number(result.accuracy)) ? Number(result.accuracy) : 0;
  const reviewedToday = Math.max(0, Number(profile.reviewed_today || profile.reviewedToday || 0));
  const stickyCount = safeCards.filter((card) => card.leech || Number(card.lapses || 0) >= 2).length;
  const recentMisses = safeEvents.filter((event) => /again|forgotten|wrong|repair/.test(String(event.rating || event.result || event.type || event.event || ''))).slice(-8).length;
  const needsRepair = retention.mode === 'repair' || wrong > 0 || accuracy < Number(options.targetAccuracy || 80) || stickyCount > 0;
  const intensityTier = stickyCount >= 2 || wrong >= 3 || accuracy < 50
    ? 'leech_rescue'
    : needsRepair
      ? 'repair'
      : 'mastery';
  const dailyMinimumRounds = [
    { id: 'first_step_recall', label: '第一步回忆', target: 3, rule: '先遮住答案，说出第一步；说不出就降到二选一。' },
    { id: 'wrong_cause_fix', label: '错因修复', target: needsRepair ? 2 : 1, rule: '只修同一个错因，不混入新难题。' },
    { id: 'near_transfer', label: '近迁移', target: needsRepair ? 1 : 2, rule: '换一道小变式，确认不是当场记住。' }
  ];
  const returnWindows = [
    { id: 'today', label: '今晚', action: `回忆 3 张和「${weakKey}」有关的卡，只说第一步。`, route: '/pages/arcade/arcade' },
    { id: 'tomorrow', label: '明天', action: `抽 1 张最不稳的卡，确认能跨天复述「${weakKey}」。`, route: '/pages/review/review' },
    { id: 'day3', label: '第 3 天', action: '做 1 道近迁移题，看能不能换题也开口。', route: '/pages/tutor/tutor' },
    { id: 'day7', label: '第 7 天', action: '用家长复盘确认是否进入长期掌握账本。', route: '/pages/profile/profile' }
  ];
  const antiCramThrottle = {
    id: 'anti_cram_throttle',
    active: needsRepair || reviewedToday >= 10,
    maxNewCards: needsRepair ? 0 : 3,
    xpRule: 'XP 只奖励主动回忆、错因修复和跨天回访，不奖励盲目刷题数量。',
    stopLine: needsRepair ? '同一错因未修复前，暂停加新题。' : '今天已够量时，优先保留明天回访。'
  };
  const leechEscalation = {
    id: 'leech_card_escalation',
    threshold: 2,
    stickyCount,
    rule: '同一错因连续 2 次失败，升级为顽固卡，回到第一步小黑板和家长一句话复盘。',
    route: stickyCount || needsRepair ? '/pages/review/review' : '/pages/tutor/tutor'
  };
  const habitHookLoop = {
    id: 'daily_90s_memory_hook',
    title: needsRepair ? '90 秒救援回忆' : '90 秒掌握保温',
    entryLine: `今天只抢回「${weakKey}」这一类第一步，不开新题海。`,
    quickStartActions: [
      { id: 'cover_answer', label: '遮住答案', seconds: 15, action: '只说第一步，不说最终结果。' },
      { id: 'wrong_cause_snap', label: '点错因', seconds: 20, action: `说出「${weakKey}」为什么会卡。` },
      { id: 'micro_variant', label: '小变式', seconds: 35, action: '换数字或换材料，仍只开第一步。' },
      { id: 'tomorrow_lock', label: '锁明天', seconds: 20, action: '选 1 张明天回访卡，防止当场会、明天忘。' }
    ],
    variableRewardSignals: [
      { id: 'first_step_clear', label: '第一步说清', reward: '+XP', guardrail: '不奖励抄答案。' },
      { id: 'wrong_cause_named', label: '错因说准', reward: '点亮错因徽章', guardrail: '不奖励刷题量。' },
      { id: 'next_day_kept', label: '明天还记得', reward: '连续回忆火苗', guardrail: '不展示排名。' }
    ],
    relapseRecovery: [
      { id: 'miss_once', trigger: '错 1 次', action: '降到二选一提示。' },
      { id: 'miss_twice', trigger: '同错因错 2 次', action: '冻结新题，回第一步小黑板。' },
      { id: 'miss_after_sleep', trigger: '隔天忘记', action: '只做原错因复现，不加题。' }
    ],
    shareNudge: '可以分享“90 秒回忆挑战”，只带动作和回访时间，不带原题、答案、分数或排名。'
  };
  const greenWordClozeProtocol = buildGreenWordClozeProtocol(safeCards, weakKey, result);
  return {
    id: 'gizmo_like_memory_protocol',
    title: needsRepair ? '高频记忆训练协议' : '掌握巩固训练协议',
    intensityTier,
    weakKey,
    dailyMinimumRounds,
    returnWindows,
    antiCramThrottle,
    leechEscalation,
    streakProtection: {
      id: 'evidence_streak_protection',
      rule: '连续记录只看今天是否完成主动回忆证据，不看分数和排名。',
      reviewedToday,
      protected: reviewedToday >= 3 || Number(result.correct || 0) >= 3
    },
    parentContract: {
      id: 'parent_memory_contract',
      line: `家长只问一句：「${weakKey} 的第一步，明天你还能自己说出来吗？」`,
      evidenceLine: '报告只展示回忆证据、错因和下一次回访，不展示完整对话或排名。'
    },
    greenWordClozeProtocol,
    shareSafeChallenge: {
      id: 'share_safe_memory_challenge',
      title: '分享一个安全回忆挑战',
      payloadFields: ['weak_key', 'return_window', 'parent_contract', 'no_score', 'no_original_photo'],
      line: '分享只带挑战动作和回访时间，不带原题照片、完整对话、分数、排名或私密评价。'
    },
    habitHookLoop,
    recentMisses,
    evidenceRequired: ['daily_minimum_recall', 'anti_cram_throttle', 'leech_card_escalation', 'return_windows', 'parent_memory_contract', 'green_word_cloze_protocol', 'share_safe_memory_challenge', 'daily_90s_memory_hook']
  };
}

function buildSocraticQualityMemoryBridge(qualitySuite = {}, result = {}, retention = {}, options = {}) {
  const cases = Array.isArray(qualitySuite.cases) ? qualitySuite.cases : [];
  const activeCase = qualitySuite.activeCase || cases.find((item) => item && item.active) || cases[0] || {};
  const activeScenarios = Array.isArray(activeCase.scenarios) ? activeCase.scenarios : [];
  const scenarioCount = Number(qualitySuite.totalScenarioCount || 0) || cases.reduce((sum, item) => {
    return sum + (Array.isArray(item.scenarios) ? item.scenarios.length : 0);
  }, 0);
  const weakKey = retention.weakKey || options.weakKey || activeCase.probeGate || '第一步';
  const wrong = Math.max(0, Number(result.wrong || 0));
  const accuracy = Number.isFinite(Number(result.accuracy)) ? Number(result.accuracy) : 0;
  const needsRescue = wrong > 0 || accuracy < Number(options.targetAccuracy || 80) || retention.mode === 'repair';
  const actionMap = {
    silent_child: {
      title: '沉默时先做 A/B 回忆',
      memoryAction: '只问一个二选一问题，让孩子先选方向，再进入 1 张回忆卡。',
      gameRule: '本轮不加新题，只记录 child_micro_choice。',
      evidence: 'child_micro_choice'
    },
    answer_request: {
      title: '要答案时拦完整答案',
      memoryAction: '停止给结果，把回忆卡降到“题目问什么”和“第一步是什么”。',
      gameRule: '没有说出第一步，不发放通关 XP。',
      evidence: 'blocked_full_answer'
    },
    wrong_axis: {
      title: '答偏时回到误区轴',
      memoryAction: '把错因卡放到本局第一张，只追问一个定位问题。',
      gameRule: '同一误区连续两次答偏，转入错因回放。',
      evidence: 'socratic_axis_evidence'
    },
    transfer_fail: {
      title: '迁移失败时做次日回访',
      memoryAction: '保留 1 张相似变式到明天，不在今晚继续堆题。',
      gameRule: '明日回访能说出第一步，才开放变式练习。',
      evidence: 'next_day_transfer_check'
    }
  };
  const fallbackScenarios = ['silent_child', 'answer_request', 'wrong_axis', 'transfer_fail'].map((id) => ({
    id,
    expectedMove: actionMap[id].memoryAction,
    passEvidence: actionMap[id].evidence
  }));
  const sourceScenarios = activeScenarios.length >= 4
    ? activeScenarios
    : fallbackScenarios;
  const memoryActions = sourceScenarios.map((scenario, index) => {
    const mapped = actionMap[scenario.id] || {
      title: `质量场景 ${index + 1}`,
      memoryAction: scenario.expectedMove || '回到第一步主动回忆。',
      gameRule: '只记录可复盘动作，不记录完整答案。',
      evidence: scenario.passEvidence || 'socratic_memory_evidence'
    };
    return {
      id: scenario.id || `quality_memory_${index + 1}`,
      title: mapped.title,
      trigger: scenario.trigger || '',
      memoryAction: mapped.memoryAction,
      expectedMove: scenario.expectedMove || mapped.memoryAction,
      gameRule: mapped.gameRule,
      evidence: scenario.passEvidence || mapped.evidence,
      route: scenario.id === 'transfer_fail' ? '/pages/review/review' : '/pages/tutor/tutor'
    };
  });
  return {
    id: 'socratic_quality_memory_bridge',
    title: needsRescue ? '点拨质量接入错因回忆' : '点拨质量接入巩固回忆',
    scenarioCount,
    activeTaskType: activeCase.taskType || options.taskType || 'unknown',
    activeScenario: memoryActions[0] || null,
    memoryActions,
    xpGate: '只有说出第一步、完成错因回放或次日回访，才发放 XP；盲刷题量不加分。',
    reviewDeckRule: `本轮优先回收「${weakKey}」相关卡，再进入新题。`,
    parentLine: '家长只看孩子是否说出第一步、是否完成回访，不看完整答案、分数或排名。',
    privacyBoundary: '不带原题照片、完整对话、分数、排名、私密评价或原始答案。',
    evidenceRequired: ['socratic_quality_scenario', 'first_step_recall', 'blocked_answer_boundary', 'wrong_axis_replay', 'next_day_transfer_check']
  };
}

function buildCourseUnitQuestionBankPlayableCards(courseUnitQuestionBank = {}, options = {}) {
  const activeCards = Array.isArray(courseUnitQuestionBank.activeCards) ? courseUnitQuestionBank.activeCards : [];
  const allCards = Array.isArray(courseUnitQuestionBank.cards) ? courseUnitQuestionBank.cards : [];
  const taskType = options.taskType || '';
  const weakKey = options.weakKey || '第一步';
  const focusText = [options.firstStep, options.wrongCauseLabel, options.subject].filter(Boolean).join(' ');
  const maxCards = options.rescueMode ? 4 : Number(options.maxCards || 42);
  const focusCards = (activeCards.length ? activeCards : allCards)
    .filter((card) => {
      if (!card) return false;
      if (!taskType || taskType === 'unknown') return true;
      const haystack = [card.id, card.type, card.label, card.prompt, card.sampleStem, card.subjectLabel, card.wrongCause].join(' ');
      return haystack.indexOf(taskType) >= 0 || haystack.indexOf(options.subject || '') >= 0 || haystack.indexOf(options.wrongCauseLabel || '') >= 0 || !focusText;
    });
  let sourceCards = focusCards.slice(0, maxCards);
  if (!options.rescueMode && allCards.length) {
    const seen = {};
    sourceCards.forEach((card) => {
      if (card && card.id && !seen[card.id]) {
        seen[card.id] = true;
      }
    });
    const bySubject = allCards.reduce((acc, card) => {
      const key = card.subjectId || card.subjectLabel || 'unknown';
      if (!acc[key]) acc[key] = [];
      acc[key].push(card);
      return acc;
    }, {});
    const balanced = sourceCards.slice();
    Object.keys(bySubject).forEach((subjectKey) => {
      bySubject[subjectKey].slice(0, 3).forEach((card) => {
        if (balanced.length < maxCards && !seen[card.id]) {
          balanced.push(card);
          seen[card.id] = true;
        }
      });
    });
    const subjectOf = (card) => card && (card.subjectId || card.subjectLabel || card.subject || 'unknown');
    const activeIdSet = activeCards.reduce((acc, card) => {
      if (card && card.id) acc[card.id] = true;
      return acc;
    }, {});
    const represented = {};
    balanced.forEach((card) => {
      represented[subjectOf(card)] = true;
    });
    Object.keys(bySubject).forEach((subjectKey) => {
      if (represented[subjectKey]) return;
      const candidate = bySubject[subjectKey].find((card) => card && card.id && !seen[card.id]);
      if (!candidate) return;
      if (balanced.length < maxCards) {
        balanced.push(candidate);
      } else {
        let replaceIndex = -1;
        for (let index = balanced.length - 1; index > 0; index -= 1) {
          const card = balanced[index];
          const cardSubject = subjectOf(card);
          const duplicateSubject = balanced.filter((item) => subjectOf(item) === cardSubject).length > 1;
          if (duplicateSubject && !activeIdSet[card && card.id]) {
            replaceIndex = index;
            break;
          }
        }
        if (replaceIndex > 0) balanced[replaceIndex] = candidate;
      }
      seen[candidate.id] = true;
      represented[subjectKey] = true;
    });
    allCards.forEach((card) => {
      if (balanced.length >= maxCards) return;
      if (!card || !card.id || seen[card.id]) return;
      balanced.push(card);
      seen[card.id] = true;
    });
    sourceCards = balanced;
  }
  sourceCards = sourceCards.slice(0, maxCards);
  return sourceCards.map((card, index) => {
    const progression = card.progression || {};
    const firstStep = card.firstStepHint || progression.entryTask || options.firstStep || `先说出「${weakKey}」的第一步`;
    const wrongCause = card.wrongCause || card.wrongCauseLabel || options.wrongCauseLabel || weakKey;
    const checkpoint = card.visualMove || card.blackboardMove || progression.parentEvidence || firstStep;
    return {
      id: `playable_${card.id || index + 1}`,
      unitId: card.unitId || '',
      sourceUnitId: card.unitId || '',
      sourceCardId: card.id || '',
      sourceSampleId: card.sourceSampleId || '',
      question: card.sampleStem || card.prompt || `用自己的题复述「${weakKey}」的第一步`,
      answer: firstStep,
      hint: `${firstStep}。不写完整答案，只留下第一步证据。`,
      subjectId: card.subjectId || '',
      subject: card.subjectLabel || options.subject || '',
      source: 'course_unit_question_bank',
      taskType: taskType || card.taskType || card.type || 'course_unit',
      weakPoint: wrongCause,
      wrongCauseBucket: card.type || options.wrongCauseBucket || 'course_unit_question_bank',
      wrongCauseLabel: wrongCause,
      checkpoint,
      parentPrompt: card.parentCheck || progression.parentEvidence || '家长只问第一步和错因，不看完整答案。',
      next_practice: card.nearTransferStem || progression.nextDayRevisit || '明天换一题，只确认第一步能不能迁移。',
      nextPracticePlan: {
        wrongCauseBucket: card.type || options.wrongCauseBucket || 'course_unit_question_bank',
        wrongCauseLabel: wrongCause,
        checkpoint,
        parentPrompt: card.parentCheck || progression.parentEvidence || '家长只问第一步和错因，不看完整答案。',
        nextPracticeText: card.nearTransferStem || progression.nextDayRevisit || '明天换一题，只确认第一步能不能迁移。'
      },
      due: true,
      dueReason: 'course_unit_question_bank_recall',
      revisitWindow: index === 0 ? 'tonight' : index === 1 ? 'tomorrow' : 'day_7',
      answerBoundary: card.answerBoundary || '不提供完整答案，只练第一步、错因和回访。',
      evidenceRequired: ['course_unit_question_bank', 'first_step_recall', 'wrong_cause_replay', 'next_day_revisit']
    };
  });
}

function buildPublicK12IntakeExecutableCards(challengeDeck = [], options = {}) {
  const maxCards = Math.max(1, Number(options.maxCards || 21));
  const deck = Array.isArray(challengeDeck) ? challengeDeck : [];
  return deck.slice(0, maxCards).map((card, index) => {
    const blockedFields = Array.from(new Set([]
      .concat(Array.isArray(card.blockedFields) ? card.blockedFields : [])
      .concat(['original_question', 'original_answer', 'full_solution', 'full_dialogue', 'score', 'ranking'])));
    const shareSafeFields = Array.isArray(card.shareSafeFields) ? card.shareSafeFields.slice() : [];
    const observableFirstMove = card.observableFirstMove || card.firstStepPrompt || card.localTransform || card.prompt || 'Name the first move before any answer.';
    const fallbackIfNoChildInput = card.fallbackIfNoChildInput || 'Offer one A/B first-step hint and keep the full answer hidden.';
    const route = card.route || `/pages/tutor/tutor?from=public_k12_intake&challenge_id=${encodeURIComponent(card.id || index + 1)}`;
    const arcadeRoute = card.arcadeRoute || `/pages/arcade/arcade?from=public_k12_intake&challenge_id=${encodeURIComponent(card.id || index + 1)}`;
    const reviewRoute = card.reviewRoute || (card.nextPracticePlan && card.nextPracticePlan.appRoute) || `/pages/review/review?from=public_k12_intake&challenge_id=${encodeURIComponent(card.id || index + 1)}`;
    return {
      id: `playable_${card.id || index + 1}`,
      type: 'public_k12_homework_intake',
      source: 'public_k12_homework_intake_queue',
      sourceChallengeId: card.id || '',
      sourceId: card.sourceId || '',
      subject: card.subject || '',
      taskType: card.taskType || 'unknown',
      question: card.prompt || card.gameUse || 'Use your own homework material and say the first move.',
      answer: observableFirstMove,
      hint: fallbackIfNoChildInput,
      weakPoint: card.localTransform || card.taskType || 'first_move',
      wrongCauseBucket: card.taskType || 'public_k12_homework_intake',
      wrongCauseLabel: card.localTransform || card.gameUse || 'public_k12_homework_intake',
      checkpoint: observableFirstMove,
      parentPrompt: card.shareHook || fallbackIfNoChildInput,
      next_practice: card.gameUse || 'Repeat tomorrow with a nearby problem from the receiver own material.',
      route,
      reviewRoute,
      due: true,
      dueReason: 'public_k12_homework_intake',
      receiverMustUseOwnMaterial: card.receiverMustUseOwnMaterial !== false,
      observableFirstMove,
      fallbackIfNoChildInput,
      shareSafeFields,
      blockedFields,
      localCodeOwns: Array.isArray(card.localCodeOwns) ? card.localCodeOwns.slice() : ['queue_order', 'release_gate', 'share_fields'],
      aiBetterFor: Array.isArray(card.aiBetterFor) ? card.aiBetterFor.slice() : ['socratic_wording'],
      aiMustNotOwn: Array.isArray(card.aiMustNotOwn) ? card.aiMustNotOwn.slice() : ['final_answer', 'share_release_decision'],
      answerBoundary: card.answerBoundary || 'first_step_only_no_full_answer',
      nextPracticePlan: Object.assign({}, card.nextPracticePlan || {}, {
        appRoute: reviewRoute,
        arcadeRoute,
        wrongCauseBucket: card.taskType || 'public_k12_homework_intake',
        wrongCauseLabel: card.localTransform || card.gameUse || 'public_k12_homework_intake',
        checkpoint: observableFirstMove,
        parentPrompt: card.shareHook || fallbackIfNoChildInput,
        nextPracticeText: card.gameUse || 'Repeat tomorrow with the receiver own material.',
        receiverMustUseOwnMaterial: card.receiverMustUseOwnMaterial !== false,
        blockedFields
      }),
      executableSurfaces: {
        tutor: route,
        arcade: arcadeRoute,
        review: reviewRoute
      },
      evidenceRequired: Array.from(new Set([]
        .concat(Array.isArray(card.evidenceRequired) ? card.evidenceRequired : [])
        .concat(['receiver_own_material', 'observable_first_move', 'fallback_without_full_solution', 'safe_share_fields'])))
    };
  });
}

function buildQuestionBankMemoryBridge(courseUnitQuestionBank = {}, result = {}, retention = {}, options = {}) {
  const activeCards = Array.isArray(courseUnitQuestionBank.activeCards) ? courseUnitQuestionBank.activeCards : [];
  const allCards = Array.isArray(courseUnitQuestionBank.cards) ? courseUnitQuestionBank.cards : [];
  const sourceCards = (activeCards.length ? activeCards : allCards).slice(0, 6);
  const weakKey = options.weakKey || retention.weakKey || '第一步';
  const accuracy = Number(result.accuracy || 0);
  const needsRepair = retention.mode === 'repair' || accuracy < Number(options.targetAccuracy || 80) || Number(result.wrong || 0) > 0;
  const masteryActions = sourceCards.slice(0, 4).map((card, index) => ({
    id: card.id || `question_bank_memory_${index + 1}`,
    label: card.label || card.prompt || `题型卡 ${index + 1}`,
    prompt: card.sampleStem || card.prompt || `用自己的题复述 ${weakKey} 的第一步`,
    firstStep: card.firstStepHint || card.progression && card.progression.entryTask || `先说出 ${weakKey} 的第一步`,
    wrongCause: card.wrongCause || card.wrongCauseLabel || weakKey,
    visualMove: card.blackboardMove || card.visualMove || '画出已知条件和第一步关系',
    masteryGate: card.progression && card.progression.masteryGate ? card.progression.masteryGate : '能说出第一步、错因和一个小变式',
    nextDayRevisit: card.progression && card.progression.nextDayRevisit ? card.progression.nextDayRevisit : '明天换一题确认能不能迁移',
    parentCheck: card.parentCheck || card.progression && card.progression.parentEvidence || '家长只问第一步和错因，不看完整答案',
    route: '/pages/tutor/tutor'
  }));
  return {
    id: 'question_bank_memory_bridge',
    title: needsRepair ? '题型卡进入错因回忆' : '题型卡进入掌握巩固',
    status: sourceCards.length ? 'ready' : 'waiting_question_bank',
    questionCardCount: Number(courseUnitQuestionBank.questionCount || allCards.length || activeCards.length || 0),
    activeCardCount: activeCards.length,
    masteryGateCount: Number(courseUnitQuestionBank.masteryGateCount || 0),
    progressionStageCount: Number(courseUnitQuestionBank.progressionStageCount || 0),
    activeDeck: masteryActions,
    reviewWindows: [
      { id: 'tonight', label: '今晚', action: '只做 3 张题型卡的主动回忆，不加新题量。' },
      { id: 'tomorrow', label: '明天', action: '回访最不稳的一张卡，先说第一步再看提示。' },
      { id: 'day_7', label: '第 7 天', action: '换一个小变式，确认不是记住答案。' }
    ],
    entryRule: sourceCards.length
      ? `本轮从 ${sourceCards.length} 张题型卡里选最相关的主动回忆。`
      : '还没有可用题型卡，先回到第一步点拨生成题型证据。',
    xpGate: '题型卡只有通过第一步、错因复述和次日回访，才进入 XP；只刷数量不加分。',
    parentDecisionLine: sourceCards.length
      ? '家长报告只看题型掌握门槛、错因是否复现和明天回访，不看分数排行。'
      : '题型证据不足时，报告只能给观察建议，不能升级长期画像。',
    reportLine: sourceCards.length
      ? `题库已把 ${sourceCards.length} 张题型卡接入高频记忆训练。`
      : '题库还没有进入高频记忆训练。',
    privacyBoundary: '不分享原题照片、完整答案、分数、排名和孩子私密评价。',
    evidenceRequired: ['course_unit_question_bank', 'mastery_gate', 'active_recall', 'wrong_cause_replay', 'next_day_revisit', 'parent_decision_line']
  };
}

function buildQuestionBankRecallWorkout(questionBankMemoryBridge = {}, recallIntensityPlan = {}, gizmoLikeMemoryProtocol = {}, result = {}) {
  const activeDeck = Array.isArray(questionBankMemoryBridge.activeDeck) ? questionBankMemoryBridge.activeDeck : [];
  const reviewWindows = Array.isArray(questionBankMemoryBridge.reviewWindows) ? questionBankMemoryBridge.reviewWindows : [];
  const intensityRounds = Array.isArray(recallIntensityPlan.rounds) ? recallIntensityPlan.rounds : [];
  const returnWindows = Array.isArray(gizmoLikeMemoryProtocol.returnWindows) ? gizmoLikeMemoryProtocol.returnWindows : [];
  const greenWordClozeProtocol = gizmoLikeMemoryProtocol.greenWordClozeProtocol || {};
  const greenWordCards = Array.isArray(greenWordClozeProtocol.clozeCards) ? greenWordClozeProtocol.clozeCards : [];
  const accuracy = Number(result.accuracy || 0);
  const wrong = Math.max(0, Number(result.wrong || 0));
  const rescueMode = wrong >= 2 || accuracy < 60 || gizmoLikeMemoryProtocol.intensityTier === 'leech_rescue';
  const workoutCards = activeDeck.slice(0, rescueMode ? 3 : 4).map((card, index) => ({
    id: card.id || `question_bank_workout_${index + 1}`,
    order: index + 1,
    label: card.label || `题型训练卡 ${index + 1}`,
    phase: index === 0 ? '先复述第一步' : index === 1 ? '定位错因' : index === 2 ? '明天回访' : '近迁移',
    action: index === 0
      ? card.firstStep
      : index === 1
        ? `说出错因：${card.wrongCause || '第一步不稳'}`
        : index === 2
          ? card.nextDayRevisit
          : card.masteryGate,
    xpGate: index < 3 ? '只要证据，不看速度；说不出就回到小黑板。' : '前三步稳定后才开放近迁移。',
    clozePrompt: greenWordCards[index] ? greenWordCards[index].clozePrompt : '',
    targetKeyword: greenWordCards[index] ? greenWordCards[index].targetKeyword : '',
    quizMode: greenWordCards[index] ? greenWordCards[index].nextMode : '',
    proof: greenWordCards[index] ? `补出关键词：${greenWordCards[index].targetKeyword}` : '留下第一步、错因或回访证据。',
    parentCheck: card.parentCheck || '家长只问第一步和错因，不看完整答案。',
    route: card.route || '/pages/tutor/tutor'
  }));
  const phases = [
    { id: 'recall', label: '主动回忆', quota: rescueMode ? 2 : 3, release: '孩子能自己说第一步。' },
    { id: 'repair', label: '错因回放', quota: rescueMode ? 2 : 1, release: '能说出这次为什么卡住。' },
    { id: 'revisit', label: '间隔回访', quota: 1, release: '明天仍能说出第一步。' },
    { id: 'transfer', label: '近迁移', quota: rescueMode ? 0 : 1, release: '换材料仍能套同一第一步。' }
  ];
  return {
    id: 'question_bank_recall_workout',
    title: rescueMode ? '题型卡急救训练处方' : '题型卡高频记忆处方',
    mode: rescueMode ? 'rescue' : 'mastery',
    status: workoutCards.length >= 3 ? 'ready' : 'waiting_question_bank',
    workoutCards,
    phases,
    intensityLine: intensityRounds.length
      ? intensityRounds.map((item) => `${item.label}:${item.size || item.target || 1}`).join(' / ')
      : '默认 3 张主动回忆卡，不加新题量。',
    returnWindowLine: (returnWindows.length ? returnWindows : reviewWindows).map((item) => item.label || item.id).join(' / '),
    parentDecisionLine: rescueMode
      ? '家长今晚不加题，只看孩子是否能把第一步和错因说出来。'
      : '家长可在明天回访通过后，再决定是否进入近迁移。',
    reportLine: workoutCards.length
      ? `本轮 ${workoutCards.length} 张题型卡进入分层训练：主动回忆、错因回放、间隔回访、近迁移。`
      : '题型训练证据不足，先回到点拨生成第一步证据。',
    noCramRule: '单次正确不升级长期画像；必须有明天回访和第 7 天小变式。',
    shareBoundary: '分享只带题型动作、第一步和回访窗口，不带原题照片、完整答案、分数、排名或私密评价。',
    greenWordClozeProtocol,
    greenWordLine: greenWordClozeProtocol.status === 'ready'
      ? `本轮把 ${greenWordCards.length} 张题型卡转成挖空关键词，先补关键词再回忆第一步。`
      : '还缺可挖空的题型卡，先回到第一步点拨。',
    evidenceRequired: ['question_bank_recall_workout', 'green_word_cloze_protocol', 'active_recall_phase', 'wrong_cause_phase', 'spaced_revisit_phase', 'parent_decision_line', 'safe_share_boundary']
  };
}

function buildDailyMemorySprintDeck(questionBankRecallWorkout = {}, memoryFeedbackController = {}, gizmoLikeMemoryProtocol = {}, xpFeedbackPolicy = {}, result = {}) {
  const workoutCards = Array.isArray(questionBankRecallWorkout.workoutCards) ? questionBankRecallWorkout.workoutCards : [];
  const phases = Array.isArray(questionBankRecallWorkout.phases) ? questionBankRecallWorkout.phases : [];
  const returnWindows = Array.isArray(gizmoLikeMemoryProtocol.returnWindows) ? gizmoLikeMemoryProtocol.returnWindows : [];
  const wrong = Math.max(0, Number(result.wrong || 0));
  const accuracy = Number.isFinite(Number(result.accuracy)) ? Number(result.accuracy) : 0;
  const rescue = memoryFeedbackController.severity === 'high' || questionBankRecallWorkout.mode === 'rescue' || wrong >= 2 || accuracy < 60;
  const sprintCards = [
    {
      id: 'open_recall',
      label: '开局回忆',
      minutes: 2,
      action: workoutCards[0] ? workoutCards[0].action : '遮住答案，说出第一步。',
      proof: 'child_first_step',
      route: '/pages/review/review'
    },
    {
      id: 'wrong_cause_replay',
      label: '错因返场',
      minutes: rescue ? 4 : 3,
      action: workoutCards[1] ? workoutCards[1].action : '只复述一个错因，不加新题。',
      proof: 'wrong_cause_named',
      route: '/pages/review/review'
    },
    {
      id: 'spaced_revisit',
      label: '间隔回访',
      minutes: 2,
      action: returnWindows[1] ? returnWindows[1].action : '明天只抽最不稳的一张卡。',
      proof: 'next_day_revisit',
      route: '/pages/review/review'
    },
    {
      id: 'near_transfer_unlock',
      label: '近迁移解锁',
      minutes: rescue ? 0 : 3,
      action: rescue ? '本轮未解锁；先把错因修稳。' : (workoutCards[3] ? workoutCards[3].action : '换一个小条件，确认方法能迁移。'),
      proof: rescue ? 'locked_by_wrong_cause' : 'near_transfer_attempt',
      route: rescue ? '/pages/review/review' : '/pages/tutor/tutor'
    }
  ];
  const lockRules = [
    '没说出第一步，不开放近迁移。',
    '同一错因连续 2 次失败，下一轮只做错因返场。',
    '没有明天回访证据，XP 不进入长期画像。'
  ];
  return {
    id: 'daily_memory_sprint_deck',
    title: rescue ? '今日记忆急救冲刺' : '今日记忆冲刺',
    mode: rescue ? 'rescue_sprint' : 'growth_sprint',
    summary: rescue
      ? '今天先抢救同一错因，不开放新题量。'
      : '今天用 4 个短冲刺把主动回忆、错因、回访和迁移连起来。',
    sprintCards,
    lockRules,
    streakMeters: [
      { id: 'first_step', label: '第一步连续性', target: 2, current: Number(result.correct || 0) >= 2 ? 1 : 0, rule: '连续两天能说第一步才算稳定。' },
      { id: 'wrong_cause', label: '错因稳定性', target: 2, current: wrong ? 0 : 1, rule: '同错因不再重复才进入近迁移。' },
      { id: 'revisit', label: '回访兑现', target: 1, current: 0, rule: '明天回来复述一次，才写入画像。' }
    ],
    xpLine: xpFeedbackPolicy.rewardLine || 'XP 只奖励主动回忆、错因修复和回访兑现。',
    parentLine: '家长只看 4 件事：第一步、错因、明天回访、是否解锁近迁移。',
    shareBoundary: '冲刺分享只带动作和回访窗口，不带原题、答案、分数、排名或完整对话。',
    evidenceRequired: ['daily_memory_sprint', 'sprint_cards', 'lock_rules', 'streak_meters', 'xp_gate', 'parent_line', 'safe_share_boundary']
  };
}

function buildAdaptiveRecallScheduler(questionBankRecallWorkout = {}, dailyMemorySprintDeck = {}, gizmoLikeMemoryProtocol = {}, result = {}, options = {}) {
  const workoutCards = Array.isArray(questionBankRecallWorkout.workoutCards) ? questionBankRecallWorkout.workoutCards : [];
  const sprintCards = Array.isArray(dailyMemorySprintDeck.sprintCards) ? dailyMemorySprintDeck.sprintCards : [];
  const returnWindows = Array.isArray(gizmoLikeMemoryProtocol.returnWindows) ? gizmoLikeMemoryProtocol.returnWindows : [];
  const wrong = Math.max(0, Number(result.wrong || 0));
  const accuracy = Number.isFinite(Number(result.accuracy)) ? Number(result.accuracy) : 0;
  const rescue = questionBankRecallWorkout.mode === 'rescue' || gizmoLikeMemoryProtocol.intensityTier === 'leech_rescue' || wrong >= 2 || accuracy < 60;
  const sourceCards = workoutCards.length ? workoutCards : sprintCards.map((card) => ({
    id: card.id,
    label: card.label,
    action: card.action,
    parentCheck: card.proof
  }));
  const schedulerBoxes = [
    {
      id: 'box_0_now',
      label: '现在急救',
      window: returnWindows[0] ? returnWindows[0].label : '今晚',
      quota: rescue ? 3 : 2,
      unlockRule: '只要孩子能说第一步，不要求完整解法。',
      route: '/pages/review/review'
    },
    {
      id: 'box_1_tomorrow',
      label: '明天回访',
      window: returnWindows[1] ? returnWindows[1].label : '明天',
      quota: 1,
      unlockRule: '隔天仍能说出第一步，才算记住。',
      route: '/pages/review/review'
    },
    {
      id: 'box_2_day3',
      label: '第3天变式',
      window: returnWindows[2] ? returnWindows[2].label : '第 3 天',
      quota: rescue ? 0 : 1,
      unlockRule: '错因稳定后才开放小变式。',
      route: '/pages/tutor/tutor'
    },
    {
      id: 'box_3_day7',
      label: '第7天画像',
      window: returnWindows[3] ? returnWindows[3].label : '第 7 天',
      quota: rescue ? 0 : 1,
      unlockRule: '第 7 天仍能迁移，才写入长期画像。',
      route: '/pages/profile/profile'
    }
  ];
  const reviewQueue = sourceCards.slice(0, 4).map((card, index) => {
    const box = schedulerBoxes[Math.min(index, schedulerBoxes.length - 1)];
    return {
      id: card.id || `scheduled_recall_${index + 1}`,
      order: index + 1,
      label: card.label || `回忆卡 ${index + 1}`,
      action: card.action || card.firstStep || '遮住答案，说出第一步。',
      dueWindow: box.window,
      schedulerBox: box.id,
      releaseEvidence: index === 0 ? 'child_first_step' : index === 1 ? 'next_day_revisit' : index === 2 ? 'near_transfer_attempt' : 'long_term_portrait_gate',
      route: box.route
    };
  });
  while (reviewQueue.length < 4) {
    const index = reviewQueue.length;
    const box = schedulerBoxes[index];
    reviewQueue.push({
      id: `synthetic_scheduled_recall_${index + 1}`,
      order: index + 1,
      label: box.label,
      action: index === 0 ? '遮住答案，说出第一步。' : index === 1 ? '明天只回访最不稳的一张卡。' : index === 2 ? '做一道小变式。' : '第 7 天再判断是否写入画像。',
      dueWindow: box.window,
      schedulerBox: box.id,
      releaseEvidence: index === 0 ? 'child_first_step' : index === 1 ? 'next_day_revisit' : index === 2 ? 'near_transfer_attempt' : 'long_term_portrait_gate',
      route: box.route
    });
  }
  return {
    id: 'adaptive_recall_scheduler',
    title: rescue ? '错因急救调度器' : '间隔回忆调度器',
    mode: rescue ? 'leech_rescue_schedule' : 'spaced_recall_schedule',
    schedulerBoxes,
    reviewQueue,
    unlockRules: [
      '没有第一步证据，不进入明天回访。',
      '没有明天回访，不进入第 3 天变式。',
      '没有第 7 天迁移，不写入长期画像。'
    ],
    leechRules: [
      '同一错因连续 2 次失败，回到现在急救盒。',
      '急救盒只做旧卡，不加新题量。',
      '急救通过后仍要等明天回访确认。'
    ],
    xpGate: 'XP 跟随调度盒释放：现在只给行为证据，明天回访后才进入掌握记录。',
    parentLine: '家长只看卡片在哪个盒子：现在急救、明天回访、第3天变式、第7天画像。',
    shareBoundary: '调度分享只带盒子、动作和回访窗口，不带原题照片、完整答案、完整对话、分数或排名。',
    evidenceRequired: ['adaptive_recall_scheduler', 'scheduler_boxes', 'review_queue', 'unlock_rules', 'leech_rules', 'xp_gate', 'parent_line', 'safe_share_boundary'],
    source: options.source || 'arcade_high_frequency_loop'
  };
}

function buildMemoryRiskReleaseModel(adaptiveRecallScheduler = {}, wrongCauseReplayDeck = {}, questionBankRecallWorkout = {}, result = {}, options = {}) {
  const wrong = Math.max(0, Number(result.wrong || 0));
  const accuracy = Number.isFinite(Number(result.accuracy)) ? Number(result.accuracy) : 0;
  const reviewQueue = Array.isArray(adaptiveRecallScheduler.reviewQueue) ? adaptiveRecallScheduler.reviewQueue : [];
  const replayCards = Array.isArray(wrongCauseReplayDeck.cards) ? wrongCauseReplayDeck.cards : [];
  const workoutCards = Array.isArray(questionBankRecallWorkout.workoutCards) ? questionBankRecallWorkout.workoutCards : [];
  const weakKey = options.weakKey || (replayCards[0] && (replayCards[0].wrongCause || replayCards[0].label)) || '第一步';
  const rescue = adaptiveRecallScheduler.mode === 'leech_rescue_schedule' || wrong >= 2 || accuracy < 60;
  const riskSignals = [
    {
      id: 'wrong_cause_resurface',
      label: '错因复燃',
      level: wrong >= 2 || replayCards.length >= 2 ? 'high' : wrong ? 'watch' : 'low',
      evidence: wrong ? `本轮错 ${wrong} 次，先回到「${weakKey}」错因。` : '本轮暂未出现明显复燃。'
    },
    {
      id: 'forgetting_warning',
      label: '遗忘预警',
      level: accuracy < 60 ? 'high' : accuracy < 80 ? 'watch' : 'low',
      evidence: accuracy ? `正确率 ${accuracy}%，需要明天遮答案回访。` : '还没有足够正确率证据。'
    },
    {
      id: 'continuous_revisit',
      label: '连续回访',
      level: reviewQueue.length >= 4 ? 'ready' : 'watch',
      evidence: reviewQueue.length >= 4 ? '已排到今晚、明天、第3天、第7天。' : '回访队列还不完整。'
    },
    {
      id: 'variant_release',
      label: '变式放行',
      level: rescue ? 'blocked' : 'watch',
      evidence: rescue ? '错因未稳定，暂不放行新变式。' : '可准备 1 道近迁移小变式，但仍需明天回访确认。'
    }
  ];
  const forgettingWarnings = [
    {
      id: 'same_night',
      label: '今晚',
      warning: rescue ? '先抢救同一错因，不增加新题量。' : '今晚只保留 2 张主动回忆卡。',
      action: reviewQueue[0] ? reviewQueue[0].action : `遮住答案，说出「${weakKey}」第一步。`
    },
    {
      id: 'tomorrow',
      label: '明天',
      warning: '如果明天说不出第一步，说明只是当场会，不写入掌握。',
      action: reviewQueue[1] ? reviewQueue[1].action : '明天只回访最不稳的一张卡。'
    },
    {
      id: 'day3',
      label: '第3天',
      warning: rescue ? '错因没稳前，第3天不开放变式。' : '第3天只换一个条件，不做整套新题。',
      action: reviewQueue[2] ? reviewQueue[2].action : '做一道小变式，先说哪里没变。'
    },
    {
      id: 'day7',
      label: '第7天',
      warning: '第7天仍能迁移，才允许进入长期画像。',
      action: reviewQueue[3] ? reviewQueue[3].action : '第7天再判断是否写入画像。'
    }
  ];
  const variantReleaseGates = [
    {
      id: 'first_step_stable',
      label: '第一步稳定',
      status: wrong === 0 ? 'ready' : 'blocked',
      rule: '孩子能遮住答案说出第一步，才进入下一盒。'
    },
    {
      id: 'wrong_cause_quiet',
      label: '错因不复燃',
      status: replayCards.length <= 1 && wrong <= 1 ? 'ready' : 'blocked',
      rule: '同错因不连续出现，才放行近迁移。'
    },
    {
      id: 'revisit_kept',
      label: '回访兑现',
      status: reviewQueue.length >= 4 ? 'scheduled' : 'blocked',
      rule: '明天回访完成后，才进入第3天变式。'
    }
  ];
  const leechRecoveryPlan = [
    { id: 'name', label: '命名错因', action: `先说清「${weakKey}」到底卡在哪。` },
    { id: 'board', label: '退回小黑板', action: '只画第一步和证据点，不讲完整答案。' },
    { id: 'revisit', label: '明天回访', action: '明天遮答案复述同一错因。' },
    { id: 'release', label: '变式放行', action: '错因安静后，只放 1 道近迁移小题。' }
  ];
  const blocked = variantReleaseGates.filter((gate) => gate.status === 'blocked').length;
  return {
    id: 'memory_risk_release_model',
    title: rescue ? '记忆急救放行模型' : '记忆风险放行模型',
    level: blocked >= 2 || rescue ? 'rescue' : blocked ? 'watch' : 'release_ready',
    summary: rescue
      ? `「${weakKey}」有复燃风险，今晚只修旧错因，不开放新变式。`
      : `「${weakKey}」可进入连续回访，但要等明天证据再写入画像。`,
    riskSignals,
    forgettingWarnings,
    variantReleaseGates,
    leechRecoveryPlan,
    parentDecisionLine: rescue
      ? '家长今晚只问错因和第一步，不加题、不追速度。'
      : '家长只看明天是否还能说第一步，再决定要不要给小变式。',
    xpReleaseLine: 'XP 只作为行为反馈；没有明天回访和变式证据，不进入长期画像。',
    shareBoundary: '记忆风险分享只带行动建议、能力缺口和回访窗口，不带原题、答案、孩子隐私、原始表现、分数或排名。',
    evidenceRequired: ['wrong_cause_resurface', 'forgetting_warning', 'continuous_revisit', 'variant_release_gate', 'parent_decision_line', 'safe_share_boundary']
  };
}

function buildMemoryComebackLoop(dailyMemorySprintDeck = {}, adaptiveRecallScheduler = {}, memoryRiskReleaseModel = {}, result = {}, options = {}) {
  const weakKey = options.weakKey || '第一步';
  const sprintCards = Array.isArray(dailyMemorySprintDeck.sprintCards) ? dailyMemorySprintDeck.sprintCards : [];
  const reviewQueue = Array.isArray(adaptiveRecallScheduler.reviewQueue) ? adaptiveRecallScheduler.reviewQueue : [];
  const riskLevel = memoryRiskReleaseModel.level || 'watch';
  const wrong = Math.max(0, Number(result.wrong || 0));
  const rescue = riskLevel === 'rescue' || wrong >= 2;
  const comebackSteps = [
    {
      id: 'open_90s',
      label: '90 秒开局',
      action: `只打开 1 张「${weakKey}」回忆卡，遮住答案说第一步。`,
      evidence: 'daily_90s_memory_hook'
    },
    {
      id: 'wrong_cause_echo',
      label: '错因回声',
      action: '说出这次错因和上次是否一样；一样就不加新题。',
      evidence: 'wrong_cause_echo'
    },
    {
      id: 'tomorrow_lock',
      label: '明天锁定',
      action: '预约明天同一张卡回访，没回访不放行变式。',
      evidence: 'next_day_locked'
    },
    {
      id: 'day7_release',
      label: '第 7 天放行',
      action: '第 7 天能做近迁移，才写入长期画像。',
      evidence: 'day7_transfer_release'
    }
  ];
  const frictionReducers = [
    { id: 'one_tap_resume', label: '一键继续', rule: '从上次失败卡继续，不重新找入口。' },
    { id: 'micro_quota', label: '小配额', rule: rescue ? '急救模式只做 2 张，不用刷满。' : '稳定模式最多 4 张，防止疲劳。' },
    { id: 'parent_one_line', label: '家长一句话', rule: `家长只问：${weakKey} 的第一步还能说出来吗？` }
  ];
  const socialProofHooks = [
    {
      id: 'i_did_first_step',
      visibleLine: '我没有晒答案，只留下了一个第一步。',
      receiverAction: '你也用自己的题说一个第一步。',
      blocked: ['score', 'ranking', 'original_question']
    },
    {
      id: 'tomorrow_revisit_invite',
      visibleLine: '明天回来验证一次，才算真的会。',
      receiverAction: '接收者自动进入明天回访。',
      blocked: ['full_dialogue', 'final_answer', 'private_comment']
    },
    {
      id: 'wrong_cause_buddy',
      visibleLine: '同一个错因，找一个同类第一步。',
      receiverAction: '接力者只标自己的错因，不比较速度。',
      blocked: ['speed_compare', 'class_rank', 'photo']
    }
  ];
  return {
    id: 'memory_comeback_loop',
    title: rescue ? '记忆回流急救环' : '记忆回流巩固环',
    mode: rescue ? 'rescue_comeback' : 'steady_comeback',
    comebackSteps,
    frictionReducers,
    socialProofHooks,
    sourceSprintCount: sprintCards.length,
    sourceReviewWindows: reviewQueue.length,
    resumeRoute: rescue ? '/pages/review/review?from=memory_comeback' : '/pages/arcade/arcade?from=memory_comeback',
    parentLine: `今晚只确认「${weakKey}」能不能遮答案说第一步，不能就回到小黑板。`,
    shareLine: '分享只展示回流动作和回访窗口，不展示原题、最终答案、分数、排名、完整对话或孩子隐私。',
    releaseGate: '必须同时有 90 秒回忆、明天回访和第 7 天近迁移，才允许写入长期画像。',
    evidenceRequired: ['daily_90s_memory_hook', 'wrong_cause_echo', 'next_day_locked', 'day7_transfer_release', 'safe_social_proof']
  };
}

function buildDailyMemoryPrescription(memoryFeedbackController = {}, gizmoLikeMemoryProtocol = {}, dailyMemorySprintDeck = {}, adaptiveRecallScheduler = {}, memoryRiskReleaseModel = {}, memoryComebackLoop = {}, result = {}, options = {}) {
  const weakKey = options.weakKey || '第一步';
  const wrong = Math.max(0, Number(result.wrong || 0));
  const accuracy = Number(result.accuracy || 0);
  const riskLevel = memoryRiskReleaseModel.level || 'watch';
  const severity = memoryFeedbackController.severity || 'stable';
  const antiCramActive = !!(
    gizmoLikeMemoryProtocol &&
    gizmoLikeMemoryProtocol.antiCramThrottle &&
    gizmoLikeMemoryProtocol.antiCramThrottle.active
  );
  const rescue = riskLevel === 'rescue' || severity === 'high' || wrong >= 2 || (accuracy > 0 && accuracy < 60);
  const sprint = !rescue && accuracy >= 90 && severity === 'stable';
  const mode = rescue ? 'rescue' : sprint ? 'sprint' : 'steady';
  const dailyCap = rescue
    ? { newCards: 0, totalCards: 2, maxMinutes: 6, reason: '先救同一错因，不加新负担。' }
    : sprint
      ? { newCards: 2, totalCards: 6, maxMinutes: 14, reason: '已有稳定证据，可以少量放行变式。' }
      : { newCards: 1, totalCards: 4, maxMinutes: 10, reason: '先稳住今天和明天的回访，再加一张近迁移。' };
  const mustDo = [
    {
      id: 'first_step_recall',
      label: '遮答案说第一步',
      action: `用自己的话说出「${weakKey}」的第一步。`,
      evidence: 'first_step_spoken'
    },
    {
      id: 'wrong_cause_replay',
      label: '错因回放',
      action: rescue ? '只回放同一错因，不进入新题。' : '说清这次错因和上次是否相同。',
      evidence: 'wrong_cause_replayed'
    },
    {
      id: 'tomorrow_revisit',
      label: '明天回访',
      action: '锁定明天同一卡回访；没有回访证据，不进入长期画像。',
      evidence: 'next_day_revisit_locked'
    }
  ];
  const unlockGates = [
    { id: 'first_step_clear', label: '第一步清楚', locked: rescue, rule: '能遮答案说第一步，才允许拿 XP。' },
    { id: 'wrong_cause_quiet', label: '错因降噪', locked: rescue || severity === 'medium', rule: '同一错因不再连续出现，才允许加新卡。' },
    { id: 'next_day_revisit', label: '次日回访', locked: true, rule: '明天还能说出第一步，才允许写入周报告。' },
    { id: 'day7_transfer', label: '第 7 天迁移', locked: true, rule: '第 7 天小变式通过，才允许放入长期画像。' }
  ];
  const releaseQueue = [
    {
      id: 'xp_release',
      label: 'XP 释放',
      status: rescue ? 'hold' : 'release_partial',
      rule: 'XP 只奖励主动回忆、错因修复和次日回访，不奖励盲刷题量。'
    },
    {
      id: 'variant_release',
      label: '变式放行',
      status: sprint ? 'allow_small' : 'hold',
      rule: sprint ? '只放行 1-2 张近迁移。' : '先完成第一步和错因证据。'
    },
    {
      id: 'share_release',
      label: '分享放行',
      status: 'safe_only',
      rule: '只分享行动、能力缺口和回访窗口。'
    }
  ];
  return {
    id: 'daily_memory_prescription',
    title: mode === 'rescue' ? '今日记忆处方：先救卡点' : mode === 'sprint' ? '今日记忆处方：小步冲刺' : '今日记忆处方：稳态巩固',
    mode,
    reasonLine: rescue
      ? `今天不拼数量，先把「${weakKey}」的第一步和错因救回来。`
      : sprint
        ? '今天可以少量冲刺，但仍然以明天能回忆为准。'
        : '今天只做小剂量巩固，避免看似会了、明天忘了。',
    dailyCap,
    mustDo,
    unlockGates,
    releaseQueue,
    antiCramRule: antiCramActive || rescue
      ? '触发防刷题：同一错因未修复前，不加新题、不按数量发 XP。'
      : '保持防刷题：新增题量必须绑定次日回访。',
    parentLine: rescue
      ? `家长今晚只问一句：「${weakKey}」第一步还能自己说出来吗？`
      : '家长看明天是否还能说第一步，再决定是否加小变式。',
    shareLine: '分享只带今日动作、能力缺口和回访窗口；不带原题、答案、照片、完整对话、分数、排名或孩子隐私。',
    comebackRoute: memoryComebackLoop.resumeRoute || '/pages/review/review?from=daily_memory_prescription',
    schedulerMode: adaptiveRecallScheduler.mode || 'manual',
    sourceSprintCount: Array.isArray(dailyMemorySprintDeck.sprintCards) ? dailyMemorySprintDeck.sprintCards.length : 0,
    localDeterministic: true,
    aiBoundary: 'AI 可以生成点拨话术；每日题量、XP、解锁、分享和报告放行必须由本地规则决定。',
    evidenceRequired: [
      'daily_cap',
      'first_step_spoken',
      'wrong_cause_replayed',
      'next_day_revisit_locked',
      'xp_release_gate',
      'variant_release_gate',
      'safe_share_boundary',
      'local_rule_decision'
    ]
  };
}

function buildPeerMemoryRelayLeague(dailyMemoryPrescription = {}, questionTypeClusterMemoryProtocol = {}, memoryComebackLoop = {}, result = {}, options = {}) {
  const weakKey = options.weakKey || '第一步';
  const rescue = dailyMemoryPrescription.mode === 'rescue' || Number(result.wrong || 0) >= 2 || Number(result.accuracy || 0) < 60;
  const activeRow = questionTypeClusterMemoryProtocol.activeRow || {};
  const firstStep = activeRow.recallCard || (dailyMemoryPrescription.mustDo && dailyMemoryPrescription.mustDo[0] && dailyMemoryPrescription.mustDo[0].action) || `说出「${weakKey}」第一步。`;
  const lanes = [
    {
      id: 'self_recall',
      label: '自己先回忆',
      action: firstStep,
      proof: '留下孩子自己的第一步录入或文字回执。',
      locked: false
    },
    {
      id: 'parent_witness',
      label: '家长只见证',
      action: dailyMemoryPrescription.parentLine || `家长只问「${weakKey}」第一步是什么。`,
      proof: '家长只确认是否能开口，不补答案。',
      locked: false
    },
    {
      id: 'peer_relay',
      label: '同伴安全接力',
      action: '对方用自己的材料做同类第一步，不看我的原题。',
      proof: '接力者留下自己的第一步、错因回退和明天回访预约。',
      locked: rescue
    }
  ];
  const scoreboardReplacement = [
    { id: 'first_step_spoken', label: '说出第一步', value: '完成/未完成' },
    { id: 'wrong_cause_echo', label: '错因回放', value: '同一错因是否复现' },
    { id: 'next_day_return', label: '明天回访', value: '是否已预约' }
  ];
  const relayWindows = [
    { id: 'tonight', label: '今晚', action: '90 秒只做主动回忆，不加新题。' },
    { id: 'tomorrow', label: '明天', action: '同一张错因卡回访。' },
    { id: 'day7', label: '第 7 天', action: '用自己的小变式确认迁移。' }
  ];
  const blockedFields = ['original_question', 'original_answer', 'photo', 'score', 'ranking', 'full_dialogue', 'private_comment'];
  return {
    id: 'peer_memory_relay_league',
    title: rescue ? '记忆接力：先保守开放' : '记忆接力：可安全开放',
    mode: rescue ? 'parent_only_until_stable' : 'peer_relay_ready',
    activeCluster: activeRow.id || '',
    firstStep,
    lanes,
    relayWindows,
    scoreboardReplacement,
    shareLine: '接力只晒学习动作，不晒分数、排名、原题、答案、照片或完整对话。',
    parentLine: rescue
      ? '当前错因还不稳，只开放家长见证，不开放同伴接力。'
      : '可以开放同伴接力，但对方必须用自己的材料复刻第一步。',
    comebackRoute: memoryComebackLoop.resumeRoute || '/pages/review/review?from=peer_memory_relay',
    blockedFields,
    localDeterministic: true,
    aiBoundary: 'AI 可以生成接力卡文案；是否开放同伴接力、展示字段和回访窗口由本地规则决定。',
    evidenceRequired: ['self_first_step', 'parent_witness', 'own_material_peer_relay', 'next_day_return', 'day7_transfer', 'privacy_safe_fields']
  };
}

function buildDailyMemorySeasonPlan(peerMemoryRelayLeague = {}, dailyMemoryPrescription = {}, adaptiveRecallScheduler = {}, result = {}, options = {}) {
  const weakKey = options.weakKey || dailyMemoryPrescription.weakKey || peerMemoryRelayLeague.firstStep || 'first_step';
  const wrong = Math.max(0, Number(result.wrong || 0));
  const accuracy = Number.isFinite(Number(result.accuracy)) ? Number(result.accuracy) : 0;
  const rescue = peerMemoryRelayLeague.mode === 'parent_only_until_stable'
    || dailyMemoryPrescription.mode === 'rescue'
    || wrong >= 2
    || (accuracy > 0 && accuracy < 60);
  const schedulerBoxes = Array.isArray(adaptiveRecallScheduler.schedulerBoxes)
    ? adaptiveRecallScheduler.schedulerBoxes
    : [];
  const relayOpen = peerMemoryRelayLeague.mode === 'peer_relay_ready' && !rescue;
  const seasonDays = [
    { id: 'day_1', label: '第 1 天', mission: '遮住答案说第一步', proof: 'child_first_step', route: '/pages/review/review' },
    { id: 'day_2', label: '第 2 天', mission: '同一错因隔天回访', proof: 'next_day_revisit', route: '/pages/review/review' },
    { id: 'day_3', label: '第 3 天', mission: '换一个条件做小变式', proof: 'near_transfer_attempt', route: '/pages/tutor/tutor' },
    { id: 'day_7', label: '第 7 天', mission: '确认是否写入长期画像', proof: 'day7_transfer_gate', route: '/pages/profile/profile' }
  ];
  const missions = seasonDays.map((day, index) => ({
    id: `season_${day.id}`,
    label: day.label,
    action: index === 0
      ? `围绕「${weakKey}」完成 90 秒主动回忆。`
      : index === 1
        ? `明天只回访「${weakKey}」最不稳的一张卡。`
        : index === 2
          ? rescue ? '错因未稳，先锁住变式。' : `用自己的材料做「${weakKey}」小变式。`
          : '第 7 天仍能迁移，才进入长期画像。',
    proof: day.proof,
    route: day.route,
    locked: rescue && index >= 2
  }));
  const nonRankingBoard = [
    { id: 'self_streak', label: '自己连续回访', value: `${Number(result.streak || 0)} 天`, rule: '只和自己昨天比，不做同学排名。' },
    { id: 'first_step_rate', label: '第一步证据', value: Number(result.correct || 0) >= 2 ? '已出现' : '待补', rule: '先看能否开口，不看速度。' },
    { id: 'wrong_cause_quiet', label: '错因安静', value: wrong ? '待修复' : '暂稳定', rule: '同错因不复燃才解锁变式。' },
    { id: 'relay_open', label: '安全接力', value: relayOpen ? '可开放' : '家长见证', rule: '接力者必须用自己的材料。' }
  ];
  const sharePayload = {
    allowedFields: ['season_day', 'first_step_action', 'wrong_cause_label', 'return_window', 'parent_question', 'relay_mode'],
    blockedFields: ['original_question', 'full_answer', 'photo', 'score', 'ranking', 'full_dialogue', 'private_comment'],
    receiverRule: '接收者只能用自己的作业/错题复刻第一步，不能复制发送者原题或答案。',
    relayMode: relayOpen ? 'safe_peer_relay' : 'parent_witness_only'
  };
  return {
    id: 'daily_memory_season_plan',
    title: rescue ? '7 天记忆赛季：先保守修复' : '7 天记忆赛季：可连续回流',
    mode: rescue ? 'rescue_season' : 'growth_season',
    currentDay: schedulerBoxes.length ? schedulerBoxes[0].label : '今晚',
    weakKey,
    seasonDays,
    missions,
    nonRankingBoard,
    sharePayload,
    parentLine: rescue
      ? '家长今晚只见证第一步和错因修复；变式和同伴接力先锁住。'
      : '家长看连续回访是否兑现；孩子能隔天说出第一步，再开放小变式。',
    retentionLine: '目标不是刷题数量，而是 7 天内把第一步、错因、隔天回访和小变式连起来。',
    aiBoundary: 'AI 可改写挑战文案；本地代码决定赛季天数、解锁、XP、分享字段和画像放行。',
    evidenceRequired: ['daily_memory_season_plan', 'non_ranking_board', 'next_day_revisit', 'day7_transfer_gate', 'safe_share_payload', 'local_unlock_rule']
  };
}

function buildMicroRecallPrescriptionEngine(dailyMemoryPrescription = {}, peerMemoryRelayLeague = {}, gizmoLikeMemoryProtocol = {}, result = {}, options = {}) {
  const weakKey = options.weakKey || dailyMemoryPrescription.weakKey || gizmoLikeMemoryProtocol.weakKey || 'first_step';
  const mode = dailyMemoryPrescription.mode || 'steady';
  const wrong = Math.max(0, Number(result.wrong || 0));
  const accuracy = Number.isFinite(Number(result.accuracy)) ? Number(result.accuracy) : 0;
  const rescue = mode === 'rescue' || wrong >= 2 || (accuracy > 0 && accuracy < 60);
  const daily90SecondPlan = [
    { id: 'cover', seconds: 15, action: 'cover_answer_and_name_first_step', evidence: 'answer_hidden' },
    { id: 'speak', seconds: 25, action: `student_speaks_${weakKey}`, evidence: 'student_first_step' },
    { id: 'repair', seconds: 30, action: 'name_wrong_cause_once', evidence: 'wrong_cause_named' },
    { id: 'lock', seconds: 20, action: 'lock_tomorrow_revisit_card', evidence: 'next_day_revisit_locked' }
  ];
  const recallDoseByRisk = {
    rescue: { newCards: 0, recallCards: 2, transferCards: 0, maxMinutes: 6 },
    steady: { newCards: 1, recallCards: 3, transferCards: 1, maxMinutes: 10 },
    sprint: { newCards: 2, recallCards: 4, transferCards: 2, maxMinutes: 14 }
  };
  const peerRelayOpen = peerMemoryRelayLeague.mode === 'peer_relay_ready' && !rescue;
  return {
    id: 'micro_recall_prescription_engine',
    localDeterministic: true,
    mode: rescue ? 'rescue' : mode,
    weakKey,
    daily90SecondPlan,
    recallDoseByRisk,
    todayDose: recallDoseByRisk[rescue ? 'rescue' : mode] || recallDoseByRisk.steady,
    xpHoldRules: [
      { id: 'no_first_step_no_xp', hold: true, rule: 'No XP release without student_first_step evidence.' },
      { id: 'wrong_cause_repeat_hold', hold: rescue, rule: 'Repeated wrong cause keeps XP and new cards on hold.' },
      { id: 'next_day_required', hold: true, rule: 'Long-term mastery waits for next-day revisit evidence.' }
    ],
    unlockEvidenceGates: [
      { id: 'variant_unlock', open: !rescue && accuracy >= 80, evidence: ['student_first_step', 'wrong_cause_quiet'] },
      { id: 'day7_portrait_unlock', open: false, evidence: ['next_day_revisit', 'day7_transfer'] },
      { id: 'peer_relay_unlock', open: peerRelayOpen, evidence: ['own_material_relay', 'privacy_safe_fields'] }
    ],
    peerRelayGate: {
      open: peerRelayOpen,
      mode: peerRelayOpen ? 'safe_peer_relay' : 'parent_only',
      rule: 'Peer relay opens only when local recall evidence is stable and blocked fields stay clean.'
    },
    blockedFields: ['original_question', 'original_answer', 'photo', 'score', 'ranking', 'full_dialogue', 'private_comment'],
    proofOfLifeEvents: ['answer_hidden', 'student_first_step', 'wrong_cause_named', 'next_day_revisit_locked', 'own_material_relay'],
    aiBoundary: 'AI may rewrite prompts and encouragement; local code decides dose, XP hold, unlocks, peer relay, report release, and blocked fields.'
  };
}

function buildNinetySecondRecallComboEngine(microRecallPrescriptionEngine = {}, adaptiveRecallScheduler = {}, memoryRiskReleaseModel = {}, result = {}, options = {}) {
  const weakKey = options.weakKey || microRecallPrescriptionEngine.weakKey || 'first_step';
  const wrong = Math.max(0, Number(result.wrong || 0));
  const correct = Math.max(0, Number(result.correct || 0));
  const accuracy = Number.isFinite(Number(result.accuracy)) ? Number(result.accuracy) : 0;
  const riskLevel = memoryRiskReleaseModel.level || (wrong >= 2 || accuracy < 60 ? 'rescue' : 'watch');
  const rescue = riskLevel === 'rescue' || microRecallPrescriptionEngine.mode === 'rescue';
  const basePlan = Array.isArray(microRecallPrescriptionEngine.daily90SecondPlan)
    ? microRecallPrescriptionEngine.daily90SecondPlan
    : [];
  const comboSteps = [
    {
      id: 'cover_answer',
      seconds: 15,
      action: '遮住答案和解析，只读题干任务。',
      proof: 'answer_hidden',
      fallback: '如果想看答案，立刻退回第一步提示。'
    },
    {
      id: 'say_first_step',
      seconds: 25,
      action: `说出「${weakKey}」第一步，不解释完整过程。`,
      proof: 'student_first_step',
      fallback: '说不出就改成二选一，不给完整解法。'
    },
    {
      id: 'name_wrong_cause',
      seconds: 25,
      action: '只说一个错因：条件、单位、图像、关键词或关系式。',
      proof: 'wrong_cause_named',
      fallback: '错因说不清，明天只回访这一张。'
    },
    {
      id: 'lock_return',
      seconds: 25,
      action: '锁定明天回访和第 7 天小变式。',
      proof: 'next_day_revisit_locked',
      fallback: '没有回访证据，不释放掌握奖励。'
    }
  ];
  const streakState = {
    currentCombo: correct,
    bestCombo: Math.max(correct, Number(result.bestCombo || 0)),
    decayOnMiss: true,
    resetRule: '一次想看答案或跳过错因，连击不清零，但降级为家长见证模式。'
  };
  const rewardLadder = [
    { id: 'combo_1', threshold: 1, reward: '点亮第一步', release: correct >= 1 && !rescue },
    { id: 'combo_3', threshold: 3, reward: '开放一张同类回忆卡', release: correct >= 3 && !rescue },
    { id: 'combo_day7', threshold: 3, reward: '第 7 天迁移检查资格', release: false }
  ];
  const fallbackLadder = [
    { id: 'miss_once', trigger: wrong >= 1, action: '降到二选一第一步。' },
    { id: 'miss_twice', trigger: wrong >= 2, action: '停止新卡，只修同一错因。' },
    { id: 'low_accuracy', trigger: accuracy > 0 && accuracy < 60, action: '今天不开放同伴接力，只生成家长检查句。' }
  ];
  const schedulerBridge = {
    mode: adaptiveRecallScheduler.mode || 'manual',
    queueSize: Array.isArray(adaptiveRecallScheduler.reviewQueue) ? adaptiveRecallScheduler.reviewQueue.length : 0,
    nextWindow: adaptiveRecallScheduler.reviewQueue && adaptiveRecallScheduler.reviewQueue[0]
      ? adaptiveRecallScheduler.reviewQueue[0].dueWindow || adaptiveRecallScheduler.reviewQueue[0].box || 'tomorrow'
      : 'tomorrow',
    releaseRule: '90 秒连击只决定今日入口；长期掌握必须等待明天和第 7 天证据。'
  };
  return {
    id: 'ninety_second_recall_combo_engine',
    title: rescue ? '90 秒回忆连击：急救模式' : '90 秒回忆连击',
    localDeterministic: true,
    mode: rescue ? 'rescue_combo' : 'steady_combo',
    weakKey,
    basePlan,
    comboSteps,
    totalSeconds: comboSteps.reduce((sum, item) => sum + item.seconds, 0),
    streakState,
    rewardLadder,
    fallbackLadder,
    schedulerBridge,
    xpGate: rescue
      ? '急救模式只记录完成证据，不释放新卡和掌握奖励。'
      : '必须有第一步、错因、明日回访三项证据，才释放小额 XP。',
    parentEvidenceLine: '家长只看四个证据：遮住答案、孩子说第一步、说出错因、锁定明天回访。',
    shareBoundary: '可分享 90 秒挑战名和第一步动作；不分享原题、答案、分数、排名、照片或完整对话。',
    blockedFields: ['original_question', 'original_answer', 'photo', 'score', 'ranking', 'full_dialogue', 'private_comment'],
    aiBoundary: 'AI 只能改写提示语；连击、奖励、降级、回访和分享字段由本地代码决定。',
    evidenceRequired: ['answer_hidden', 'student_first_step', 'wrong_cause_named', 'next_day_revisit_locked', 'local_reward_gate', 'safe_share_boundary']
  };
}

function buildNinetySecondPlayableDeck(ninetySecondRecallComboEngine = {}, questionBankRecallWorkout = {}, dailyMemorySprintDeck = {}, gizmoLikeMemoryProtocol = {}, result = {}, options = {}) {
  const weakKey = options.weakKey || ninetySecondRecallComboEngine.weakKey || '第一步';
  const workoutCards = Array.isArray(questionBankRecallWorkout.workoutCards) ? questionBankRecallWorkout.workoutCards : [];
  const sprintCards = Array.isArray(dailyMemorySprintDeck.sprintCards) ? dailyMemorySprintDeck.sprintCards : [];
  const clozeCards = gizmoLikeMemoryProtocol.greenWordClozeProtocol && Array.isArray(gizmoLikeMemoryProtocol.greenWordClozeProtocol.clozeCards)
    ? gizmoLikeMemoryProtocol.greenWordClozeProtocol.clozeCards
    : [];
  const source = workoutCards.length ? workoutCards : sprintCards;
  const first = source[0] || {};
  const second = source[1] || first || {};
  const cloze = clozeCards[0] || {};
  const wrong = Math.max(0, Number(result.wrong || 0));
  const accuracy = Number.isFinite(Number(result.accuracy)) ? Number(result.accuracy) : 0;
  const rescue = ninetySecondRecallComboEngine.mode === 'rescue_combo' || wrong >= 2 || accuracy < 60;
  const playableReady = source.length > 0 && clozeCards.length > 0;
  const wrongCause = first.wrongCause || second.wrongCause || weakKey;
  const alternativeWrongCause = second.wrongCause && second.wrongCause !== wrongCause ? second.wrongCause : '看答案太早';
  const interactions = [
    {
      id: 'cloze_keyword',
      order: 1,
      seconds: 20,
      inputType: 'tap_or_type_keyword',
      prompt: cloze.clozePrompt || `遮住答案，先补出「${weakKey}」这一处关键词：____`,
      target: cloze.targetKeyword || weakKey,
      passEvidence: 'green_word_cloze',
      localCheck: 'target_keyword_present_or_parent_confirmed',
      failTo: 'typed_first_step_with_two_choices'
    },
    {
      id: 'typed_first_step',
      order: 2,
      seconds: 30,
      inputType: 'short_text',
      prompt: first.action || first.firstStep || `用自己的话写下「${weakKey}」的第一步，不写完整答案。`,
      target: first.firstStep || first.action || weakKey,
      passEvidence: 'student_first_step',
      localCheck: 'non_empty_child_text',
      failTo: 'first_step_blackboard'
    },
    {
      id: 'wrong_cause_choice',
      order: 3,
      seconds: 25,
      inputType: 'two_choice',
      prompt: '这次更像哪一种卡住？',
      choices: [
        { id: 'primary_wrong_cause', label: wrongCause, next: 'lock_next_day_revisit' },
        { id: 'answer_peeking', label: alternativeWrongCause, next: 'first_step_blackboard' }
      ],
      passEvidence: 'wrong_cause_named',
      localCheck: 'one_choice_selected',
      failTo: 'review_rescue'
    },
    {
      id: 'lock_next_day_revisit',
      order: 4,
      seconds: 15,
      inputType: 'commit_button',
      prompt: '锁定明天只回访这一张：第一步还说得出来吗？',
      target: 'tomorrow_revisit_locked',
      passEvidence: 'next_day_revisit_locked',
      localCheck: 'return_window_created',
      failTo: 'no_mastery_reward'
    }
  ];
  return {
    id: 'ninety_second_playable_deck',
    title: rescue ? '90 秒回忆急救牌组' : '90 秒回忆连击牌组',
    mode: rescue ? 'rescue_playable' : 'steady_playable',
    localDeterministic: true,
    weakKey,
    status: playableReady && interactions.length >= 4 ? 'ready' : 'waiting_cards',
    totalSeconds: interactions.reduce((sum, item) => sum + item.seconds, 0),
    playableExperience: {
      headline: '90 秒不是刷题，是遮答案后的主动回忆连击。',
      whyThisWorks: '借鉴 Gizmo 的主动回忆和间隔复习，但只奖励孩子说出的第一步、错因和明天回访证据。',
      loop: [
        { id: 'green_word', label: '补绿词', playerAction: '先补关键词，不看答案。', proof: 'green_word_cloze' },
        { id: 'first_step', label: '说第一步', playerAction: '用自己的话写下第一步。', proof: 'student_first_step' },
        { id: 'wrong_cause', label: '选错因', playerAction: '从两个卡点里选一个。', proof: 'wrong_cause_named' },
        { id: 'tomorrow_lock', label: '锁回访', playerAction: '明天只复查这一张。', proof: 'next_day_revisit_locked' }
      ],
      releaseChecklist: ['答案未提前展示', '第一步有孩子输入', '错因已选择', '明天回访已锁定'],
      stopRule: '任一环节没有证据，就不发 XP、不写掌握、不开放分享成绩。',
      moatLine: '本地代码管节奏、门槛和奖励；AI 只把提示话术说得更像老师。'
    },
    interactions,
    sourceCardIds: source.map((card) => card && card.id).filter(Boolean).slice(0, 4),
    rewardGate: rescue
      ? '急救模式只记录完成证据，不释放新卡、XP、掌握奖励或排行榜。'
      : '四步都有证据后，只释放小额 XP；长期掌握仍等明天和第 7 天。',
    failurePolicy: [
      { id: 'empty_first_step', action: '降到二选一第一步，不给完整答案。' },
      { id: 'wrong_cause_unclear', action: '转入复习页，只修同一错因。' },
      { id: 'next_day_missing', action: '不写入长期画像，不开放分享成绩。' }
    ],
    parentEvidenceLine: '家长只看四个动作：补关键词、写第一步、选错因、锁定明天。',
    sharePayload: {
      allowedFields: ['deck_title', 'weak_key', 'first_step_action', 'wrong_cause_label', 'return_window'],
      blockedFields: ['original_question', 'original_answer', 'photo', 'score', 'ranking', 'full_dialogue', 'private_comment']
    },
    localAiSplit: {
      localCodeOwns: ['interaction_order', 'local_check', 'reward_gate', 'failure_policy', 'share_payload', 'return_window'],
      aiBetterFor: ['prompt_rewrite', 'encouragement_copy', 'parent_summary_copy'],
      aiMustNotOwn: ['final_answer', 'score', 'ranking', 'xp_release', 'mastery_claim', 'share_fields']
    },
    evidenceRequired: ['green_word_cloze', 'student_first_step', 'wrong_cause_named', 'next_day_revisit_locked', 'local_reward_gate', 'safe_share_payload']
  };
}

function buildQuestionTypeClusterMemoryProtocol(questionTypeClusters = [], result = {}, options = {}) {
  const clusters = Array.isArray(questionTypeClusters) ? questionTypeClusters : [];
  const accuracy = Number.isFinite(Number(result.accuracy)) ? Number(result.accuracy) : 0;
  const wrong = Math.max(0, Number(result.wrong || 0));
  const rescue = wrong >= 2 || accuracy < 60;
  const activeTaskType = String(options.taskType || '').trim();
  const rows = clusters.map((cluster, index) => {
    const wrongCause = Array.isArray(cluster.wrongCauseSignals) && cluster.wrongCauseSignals.length
      ? cluster.wrongCauseSignals[0]
      : '第一步不稳';
    return {
      id: cluster.id || `question_type_cluster_${index + 1}`,
      taskType: cluster.taskType || '',
      subject: cluster.subject || '',
      pressureFamily: cluster.pressureFamily || '',
      mode: rescue ? 'rescue_recall' : 'spaced_mastery',
      recallCard: cluster.firstStepRule || '先说第一步。',
      wrongCauseReplay: wrongCause,
      boardAction: cluster.boardMove || '只画第一步，不写答案。',
      socraticProbe: cluster.socraticProbe || '你先说第一步是什么？',
      reportSignal: cluster.reportSignal || '报告只记录证据，不记录答案。',
      revisitWindows: [
        { id: 'now', label: '现在', action: '遮住答案，说第一步。' },
        { id: 'tomorrow', label: '明天', action: cluster.memoryCadence || '换一个材料回访第一步。' },
        { id: 'day3', label: '第3天', action: '做一张近迁移卡。' },
        { id: 'day7', label: '第7天', action: '判断是否写入长期画像。' }
      ],
      xpGate: '只奖励主动回忆、错因复述和次日回访，不奖励直接看答案。',
      unlockRule: rescue ? '同一错因稳定前不开放新题型。' : '连续两次说清第一步后开放小变式。',
      shareHook: cluster.shareHook || '分享只带题型动作和回访窗口。',
      localGates: Array.isArray(cluster.localGates) ? cluster.localGates : [],
      localDeterministic: true
    };
  });
  const activeRow = rows.find((row) => activeTaskType && row.taskType === activeTaskType) || rows[0] || null;
  return {
    id: 'question_type_cluster_memory_protocol',
    title: rescue ? '题型簇记忆急救协议' : '题型簇间隔记忆协议',
    mode: rescue ? 'rescue' : 'mastery',
    rows,
    activeRow,
    dailyCap: rescue
      ? { newClusters: 0, recallCards: 3, transferCards: 0 }
      : { newClusters: 1, recallCards: 4, transferCards: 1 },
    parentLine: activeRow
      ? `今晚只看「${activeRow.subject}」题型簇：第一步、错因、明天回访。`
      : '先补题型簇，再开放记忆协议。',
    shareBoundary: '题型簇分享只带第一步、错因和回访窗口，不带原题、答案、分数、排名或完整对话。',
    evidenceRequired: ['question_type_cluster', 'active_recall', 'wrong_cause_replay', 'spaced_revisit', 'xp_gate', 'safe_share_boundary']
  };
}

function buildRealHomeworkPressureMemoryPrescription(samples = [], result = {}, options = {}) {
  const safeSamples = Array.isArray(samples) ? samples.filter((sample) => sample && sample.id && sample.taskType) : [];
  const taskType = options.taskType || '';
  const subject = options.subject || '';
  const wrongCause = options.wrongCause || options.weakKey || '';
  const activeSampleId = options.activeSampleId || '';
  const directActiveSample = options.activeSample && options.activeSample.id ? options.activeSample : null;
  const wrong = Math.max(0, Number(result.wrong || 0));
  const accuracy = Number.isFinite(Number(result.accuracy)) ? Number(result.accuracy) : 0;
  const rescue = wrong >= 2 || accuracy < Number(options.targetAccuracy || 70);
  const matched = safeSamples.filter((sample) => {
    const text = [sample.subject, sample.taskType, sample.expectedWrongCause, sample.expectedFirstStep, sample.stem].filter(Boolean).join(' ');
    return (!taskType || sample.taskType === taskType)
      || (!subject || sample.subject === subject)
      || (wrongCause && text.includes(wrongCause));
  });
  const activeSample = directActiveSample || (activeSampleId ? safeSamples.find((sample) => sample.id === activeSampleId) : null);
  const exactWrongCause = wrongCause
    ? safeSamples.filter((sample) => sample.expectedWrongCause && sample.expectedWrongCause.includes(wrongCause))
    : [];
  const pool = []
    .concat(activeSample ? [activeSample] : [])
    .concat(exactWrongCause)
    .concat(matched.length ? matched : safeSamples);
  const seen = new Set();
  const source = pool.filter((sample) => {
    const key = `${sample.id || ''}::${sample.stem || ''}`;
    if (!sample || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, rescue ? 5 : 4);
  const subjectCounts = safeSamples.reduce((acc, sample) => {
    acc[sample.subject || 'unknown'] = (acc[sample.subject || 'unknown'] || 0) + 1;
    return acc;
  }, {});
  const taskTypeCounts = safeSamples.reduce((acc, sample) => {
    acc[sample.taskType || 'unknown'] = (acc[sample.taskType || 'unknown'] || 0) + 1;
    return acc;
  }, {});
  const reviewQueue = source.map((sample, index) => ({
    id: `${sample.id}_memory_${index + 1}`,
    sampleId: sample.id,
    subject: sample.subject,
    taskType: sample.taskType,
    order: index + 1,
    stemSignal: sample.stem,
    firstStep: sample.expectedFirstStep,
    wrongCause: sample.expectedWrongCause,
    boardMove: sample.expectedBoardMove,
    parentCheck: sample.parentCheck,
    nearTransfer: sample.nearTransfer,
    dueWindow: index === 0 ? 'tonight' : index === 1 ? 'tomorrow' : index === 2 ? 'day3' : 'day7',
    route: index <= 1 ? '/pages/review/review' : index === 2 ? '/pages/tutor/tutor' : '/pages/profile/profile'
  }));
  const sampleSpecificReady = reviewQueue.length > 0
    && reviewQueue.every((item) => item.firstStep && item.wrongCause && item.boardMove && item.parentCheck && item.nearTransfer);
  return {
    id: 'real_homework_pressure_memory_prescription',
    title: rescue ? '真实作业错因急救处方' : '真实作业错因巩固处方',
    mode: rescue ? 'rescue' : 'growth',
    localDeterministic: true,
    totalSamples: safeSamples.length,
    matchedSamples: matched.length,
    selectedSamples: source.length,
    subjectCounts,
    taskTypeCounts,
    reviewQueue,
    dailyDose: {
      firstStepRecall: rescue ? 3 : 2,
      wrongCauseReplay: rescue ? 2 : 1,
      nearTransfer: rescue ? 0 : 1,
      newSamples: rescue ? 0 : 1
    },
    scheduleWindows: [
      { id: 'tonight', label: '今晚', releaseGate: '能说出第一步和错因，才记行为证据。' },
      { id: 'tomorrow', label: '明天', releaseGate: '隔天仍能复述第一步，才进入回访通过。' },
      { id: 'day3', label: '第3天', releaseGate: '同错因不复发，才开放近迁移。' },
      { id: 'day7', label: '第7天', releaseGate: '第7天变式通过，才写入长期画像。' }
    ],
    xpReleaseGate: rescue
      ? '同一错因未稳定前，XP 只记录主动回忆，不释放掌握奖励。'
      : '第一步、错因、明天回访都出现后，才释放小额 XP。' ,
    unlockGates: [
      { id: 'new_sample_unlock', open: !rescue, rule: '急救模式不加新样本。' },
      { id: 'near_transfer_unlock', open: !rescue && accuracy >= 80, rule: '近迁移必须等明天回访通过。' },
      { id: 'peer_share_unlock', open: !rescue && accuracy >= 90, rule: '分享只开放安全动作，不开放原题答案。' }
    ],
    sharePayload: {
      allowedFields: ['subject', 'task_type', 'first_step_action', 'wrong_cause_label', 'return_window'],
      blockedFields: ['original_stem_photo', 'full_answer', 'full_dialogue', 'score', 'ranking', 'private_teacher_comment']
    },
    aiBoundary: 'AI can rewrite prompts and parent wording; local code decides queue, XP, unlocks, report release, and share fields.',
    parentLine: '家长只看第一步、错因、明天回访和第7天是否迁移，不看完整答案、分数或排名。',
    evidenceRequired: ['real_homework_pressure_samples', 'sample_specific_queue', 'local_rule_decision', 'xp_release_gate', 'safe_share_payload', 'day7_portrait_gate'],
    sampleSpecificReady
  };
}

function buildHighFrequencyPracticeLoop(profile = {}, cards = [], events = [], result = {}, challenge = {}, questSet = {}, options = {}) {
  const safeCards = Array.isArray(cards) ? cards : [];
  const safeEvents = Array.isArray(events) ? events : [];
  const now = options.now || new Date();
  const retention = options.retentionLoop || buildGameRetentionLoop(profile, result, challenge, questSet, options);
  const gaps = buildKnowledgeGap(safeEvents, safeCards);
  const reviewEventPressure = buildReviewEventPressure(safeEvents);
  const dueCards = rankCardsByReviewPressure(
    safeCards.filter((card) => isDueCard(card, now)),
    reviewEventPressure,
    now
  ).slice(0, 6);
  const weakKey = retention.weakKey || (gaps[0] && gaps[0].key) || questSet.weakKey || '第一步';
  const sourceCards = dueCards.length ? dueCards : rankCardsByReviewPressure(safeCards, reviewEventPressure, now).slice(0, 6);
  const recallCards = sourceCards.slice(0, 3).map((card, index) => ({
    id: card.id || `recall_${index + 1}`,
    order: index + 1,
    executable: true,
    sourceKind: 'real_review_card',
    prompt: card.question || card.front || card.weakPoint || `回忆 ${weakKey} 的第一步`,
    firstStep: card.checkpoint || card.nextAction || card.next_practice || `先说清 ${weakKey} 的第一步。`,
    wrongCause: card.wrongCauseLabel || card.weakPoint || weakKey,
    route: '/pages/review/review'
  }));
  while (recallCards.length < 3) {
    const order = recallCards.length + 1;
    recallCards.push({
      id: `synthetic_recall_${order}`,
      order,
      executable: false,
      sourceKind: 'synthetic_guidance',
      prompt: `第 ${order} 次回忆：${weakKey}`,
      firstStep: `只说 ${weakKey} 的第一步，不直接看答案。`,
      wrongCause: weakKey,
      route: '/pages/review/review'
    });
  }
  const realRecallCards = recallCards.filter((card) => card && card.executable !== false && !String(card.id || '').startsWith('synthetic_recall_'));
  const hasRealRecallSource = realRecallCards.length > 0;
  const needsRepair = retention.mode === 'repair' || Number(result.wrong || 0) > 0 || Number(result.accuracy || 0) < Number(challenge.targetAccuracy || 80);
  const spacedReviewPlan = [
    { id: 'same_day', label: '今晚', action: `再回忆 3 张 ${weakKey} 卡，只说第一步。`, route: '/pages/arcade/arcade' },
    { id: 'next_day', label: '明天', action: `只回访最不稳的 1 张卡：${weakKey}。`, route: '/pages/review/review' },
    { id: 'day_7', label: '第 7 天', action: '用一题小变式确认能不能迁移。', route: '/pages/tutor/tutor' }
  ];
  const reviewReturnSeed = buildReviewReturnSeed({
    weakKey,
    dueCards,
    recallCards,
    hasRealRecallSource,
    spacedReviewPlan,
    reviewEventPressure,
    result,
    needsRepair,
    activeSampleId: options.activeSampleId || '',
    courseUnitId: options.courseUnitId || challenge.courseUnitId || '',
    questionTypeClusterId: options.questionTypeClusterId || challenge.questionTypeClusterId || options.taskType || challenge.taskType || ''
  });
  const spacedRecallPolicy = reviewReturnSeed.spacedRecallPolicy;
  const questCadence = [
    { id: 'recall', label: '主动回忆', target: 3, done: Math.min(3, Number(result.correct || 0)), reward: '说出第一步才给 XP' },
    { id: 'repair', label: '错因修复', target: needsRepair ? 1 : 0, done: needsRepair ? 0 : 1, reward: '错因回到复习队列' },
    { id: 'share', label: '家长复盘', target: 1, done: 0, reward: '生成可分享的行动证据' }
  ];
  const memoryFeedbackController = buildMemoryFeedbackController(safeCards, safeEvents, result, retention, {
    weakKey,
      targetAccuracy: challenge.targetAccuracy || 80
  });
  const recallIntensityPlan = buildRecallIntensityPlan(weakKey, needsRepair, result);
  const wrongCauseReplayDeck = buildWrongCauseReplayDeck(safeCards, weakKey);
  const xpFeedbackPolicy = buildXpFeedbackPolicy(memoryFeedbackController, result);
  const questArcRunway = buildQuestArcRunway(questCadence, retention, weakKey);
  const gizmoLikeMemoryProtocol = buildGizmoLikeMemoryProtocol(profile, safeCards, safeEvents, result, retention, {
    weakKey,
    targetAccuracy: challenge.targetAccuracy || 80
  });
  const socraticQualityMemoryBridge = buildSocraticQualityMemoryBridge(
    options.socraticQualityEvaluationSuite || {},
    result,
    retention,
    {
      weakKey,
      taskType: options.taskType || challenge.taskType || '',
      targetAccuracy: challenge.targetAccuracy || 80
    }
  );
  const questionBankMemoryBridge = buildQuestionBankMemoryBridge(
    options.courseUnitQuestionBank || {},
    result,
    retention,
    {
      weakKey,
      targetAccuracy: challenge.targetAccuracy || 80
    }
  );
  const questionBankRecallWorkout = buildQuestionBankRecallWorkout(
    questionBankMemoryBridge,
    recallIntensityPlan,
    gizmoLikeMemoryProtocol,
    result
  );
  const dailyMemorySprintDeck = buildDailyMemorySprintDeck(
    questionBankRecallWorkout,
    memoryFeedbackController,
    gizmoLikeMemoryProtocol,
    xpFeedbackPolicy,
    result
  );
  const adaptiveRecallScheduler = buildAdaptiveRecallScheduler(
    questionBankRecallWorkout,
    dailyMemorySprintDeck,
    gizmoLikeMemoryProtocol,
    result,
    { source: 'high_frequency_practice_loop' }
  );
  const memoryRiskReleaseModel = buildMemoryRiskReleaseModel(
    adaptiveRecallScheduler,
    wrongCauseReplayDeck,
    questionBankRecallWorkout,
    result,
    { weakKey }
  );
  const memoryComebackLoop = buildMemoryComebackLoop(
    dailyMemorySprintDeck,
    adaptiveRecallScheduler,
    memoryRiskReleaseModel,
    result,
    { weakKey }
  );
  const dailyMemoryPrescription = buildDailyMemoryPrescription(
    memoryFeedbackController,
    gizmoLikeMemoryProtocol,
    dailyMemorySprintDeck,
    adaptiveRecallScheduler,
    memoryRiskReleaseModel,
    memoryComebackLoop,
    result,
    { weakKey }
  );
  const questionTypeClusterMemoryProtocol = buildQuestionTypeClusterMemoryProtocol(
    options.questionTypeClusterRunway || options.questionTypeClusters || [],
    result,
    { taskType: options.taskType }
  );
  let peerMemoryRelayLeague = buildPeerMemoryRelayLeague(
    dailyMemoryPrescription,
    questionTypeClusterMemoryProtocol,
    memoryComebackLoop,
    result,
    { weakKey }
  );
  if (!hasRealRecallSource) {
    peerMemoryRelayLeague = Object.assign({}, peerMemoryRelayLeague, {
      mode: 'blocked_until_real_recall_source',
      relayOpen: false,
      lanes: [],
      gateLine: '没有真实回忆卡时，不开放同伴接力、分享或排名式传播。',
      sharePayload: {
        allowedFields: [],
        blockedFields: ['original_question', 'full_answer', 'score', 'ranking', 'full_dialogue', 'peer_relay']
      }
    });
  }
  const dailyMemorySeasonPlan = buildDailyMemorySeasonPlan(
    peerMemoryRelayLeague,
    dailyMemoryPrescription,
    adaptiveRecallScheduler,
    result,
    { weakKey }
  );
  const microRecallPrescriptionEngine = buildMicroRecallPrescriptionEngine(
    dailyMemoryPrescription,
    peerMemoryRelayLeague,
    gizmoLikeMemoryProtocol,
    result,
    { weakKey }
  );
  const ninetySecondRecallComboEngine = buildNinetySecondRecallComboEngine(
    microRecallPrescriptionEngine,
    adaptiveRecallScheduler,
    memoryRiskReleaseModel,
    result,
    { weakKey }
  );
  const rawNinetySecondPlayableDeck = buildNinetySecondPlayableDeck(
    ninetySecondRecallComboEngine,
    questionBankRecallWorkout,
    dailyMemorySprintDeck,
    gizmoLikeMemoryProtocol,
    result,
    { weakKey }
  );
  const ninetySecondPlayableDeck = hasRealRecallSource
    ? rawNinetySecondPlayableDeck
    : Object.assign({}, rawNinetySecondPlayableDeck, {
      status: 'waiting_real_recall_source',
      interactions: [],
      sourceCardIds: [],
      rewardGate: '没有真实回忆卡时，不释放 XP、不开放 90 秒开始、不生成同伴分享。',
      sharePayload: {
        allowedFields: [],
        blockedFields: ['original_question', 'full_answer', 'score', 'ranking', 'full_dialogue', 'peer_relay']
      },
      evidenceRequired: ['real_recall_source_required', 'local_reward_gate', 'safe_share_payload']
    });
  const realHomeworkPressureMemoryPrescription = buildRealHomeworkPressureMemoryPrescription(
    options.realHomeworkPressureSamples || [],
    result,
    {
      taskType: options.taskType || challenge.taskType || '',
      subject: options.subject || '',
      wrongCause: weakKey,
      activeSampleId: options.activeSampleId || '',
      activeSample: options.activeSample || null,
      targetAccuracy: challenge.targetAccuracy || 80
    }
  );
  const dailyReturnMission = buildDailyReturnMission({
    dailyMemoryPrescription,
    memoryComebackLoop,
    microRecallPrescriptionEngine,
    ninetySecondRecallComboEngine,
    realHomeworkPressureMemoryPrescription,
    peerMemoryRelayLeague
  }, result, { weakKey, now });
  const dailyReturnContract = buildDailyReturnContract({
    dailyReturnMission,
    dailyMemoryPrescription,
    memoryComebackLoop,
    dailyMemorySprintDeck,
    adaptiveRecallScheduler,
    reviewReturnSeed
  }, result, { weakKey, now });
  const healthyReturnHabitEngine = buildHealthyReturnHabitEngine(profile, result, retention, {
    hasRealRecallSource,
    reviewReturnSeed,
    dailyMemoryPrescription,
    memoryComebackLoop,
    dailyReturnContract
  }, {
    weakKey,
    targetAccuracy: challenge.targetAccuracy || 80
  });
  const dailyPrimaryRecallAction = {
    id: 'daily_primary_recall_action',
    status: hasRealRecallSource ? 'ready' : 'waiting_real_recall_source',
    sourceGate: hasRealRecallSource ? 'real_recall_source_ready' : 'waiting_real_recall_source_no_xp_no_share_no_90s',
    xpReleaseAllowed: hasRealRecallSource,
    playableReleaseAllowed: hasRealRecallSource,
    peerShareReleaseAllowed: hasRealRecallSource,
    blockedUntil: hasRealRecallSource ? '' : 'real_recall_source',
    title: needsRepair ? '今天只救一张错卡' : '今天只做一个主回忆动作',
    mode: needsRepair ? 'rescue_first_action' : 'steady_first_action',
    weakKey,
    route: (dailyReturnContract.nextDayReturnEvidence && dailyReturnContract.nextDayReturnEvidence.route)
      || reviewReturnSeed.nextRoute
      || '/pages/review/review?mode=recall_return',
    oneActionLine: needsRepair
      ? `今天只围着「${weakKey}」救一张错卡：先说第一步，再命名错因，最后约明天回访。`
      : `今天只做「${weakKey}」的主回忆动作：先说第一步，再回看错因，最后锁定明天回访。`,
    xpGate: dailyReturnMission.xpGate || dailyReturnContract.xpGate || 'XP 只奖励主动回忆、错因修复和次日回访，不奖励刷题量。',
    rewardEvidence: ['student_first_step', 'wrong_cause_named', 'next_day_revisit'],
    blockedRewards: ['speed', 'score', 'ranking', 'raw_volume'],
    nextReturnWindow: dailyReturnContract.nextDayReturnEvidence
      ? (dailyReturnContract.nextDayReturnEvidence.dueWindow || 'tomorrow')
      : 'tomorrow',
    wrongCardReturnRoute: reviewReturnSeed.nextRoute || '/pages/review/review?mode=recall_return',
    shareBoundary: (dailyReturnContract.shareCard && dailyReturnContract.shareCard.receiverAction)
      ? dailyReturnContract.shareCard.receiverAction
      : '分享只带动作和回访窗口，不带原题、答案、分数、排名。',
    parentLine: (dailyReturnContract.parentReceipt && dailyReturnContract.parentReceipt.question)
      ? dailyReturnContract.parentReceipt.question
      : '家长只问第一步，不问完整答案。',
    blockedFields: Array.from(new Set([].concat(
      Array.isArray(dailyReturnContract.shareCard && dailyReturnContract.shareCard.blockedFields)
        ? dailyReturnContract.shareCard.blockedFields
        : [],
      ['full_solution', 'full_dialogue', 'score', 'ranking', 'raw_volume']
    ))),
    evidenceRequired: ['student_first_step', 'wrong_cause_named', 'next_day_revisit', 'share_boundary', 'xp_gate', 'review_return_seed']
  };
  const familyCoCreationReturnLoop = buildFamilyCoCreationReturnLoop(
    healthyReturnHabitEngine,
    dailyPrimaryRecallAction,
    result,
    { weakKey }
  );
  const dailyComebackDecisionEngine = buildDailyComebackDecisionEngine(
    healthyReturnHabitEngine,
    familyCoCreationReturnLoop,
    dailyPrimaryRecallAction,
    result,
    { weakKey, targetAccuracy: challenge.targetAccuracy || 80 }
  );
  const healthyCommercialReturnGuard = {
    id: 'healthy_commercial_return_guard',
    title: '健康回访与服务边界',
    parentDecisionLine: hasRealRecallSource
      ? `今天只回「${weakKey}」这一条证据：孩子能说第一步、能命名错因、能约定明天回访，就收口。`
      : '没有真实回忆卡时，只补作业或错题证据，不开放 XP、分享或 90 秒回忆。',
    stopRules: [
      '同一错因连续卡住 2 次，停止加题，转第一步小黑板或苏格拉底点拨。',
      '单次回忆不超过 10 分钟；超过后只记录家长观察，不继续刷题。',
      '不使用排名、速度、分数刺激回访；只看第一步、错因、次日回访和第 7 天迁移。'
    ],
    serviceHandoffLine: '连续 7 天证据齐全后，才允许整理顾问复盘或服务包建议；复盘只判断保留、降级或更换方法，不承诺结果。',
    actionCards: [
      {
        id: 'return_today',
        label: hasRealRecallSource ? '做今日回访' : '先补真实卡',
        route: hasRealRecallSource ? dailyPrimaryRecallAction.route : '/pages/upload/upload?from=healthy_return_guard&type=wrong_question_paper',
        releaseGate: hasRealRecallSource ? 'student_first_step_and_wrong_cause_named' : 'real_recall_source_required'
      },
      {
        id: 'day7_service_review',
        label: '第 7 天再复盘',
        route: '/pages/profile/profile?from=healthy_return_guard',
        releaseGate: 'day7_variant_and_parent_confirmation'
      }
    ],
    blockedRewards: ['leaderboard', 'speed_ranking', 'raw_volume', 'score_pressure', 'infinite_return_trigger'],
    localAiBoundary: {
      localCodeOwns: ['daily_cap', 'xp_gate', 'share_denylist', 'service_review_release_gate'],
      aiMayHelp: ['parent_copy', 'child_friendly_prompt', 'wrong_cause_rewording'],
      aiMustNotOwn: ['reward_release', 'ranking', 'service_upgrade_decision', 'guaranteed_result']
    }
  };
  return {
    title: needsRepair ? '高频修复循环' : '高频巩固循环',
    mode: needsRepair ? 'repair_recall' : 'mastery_recall',
    summaryLine: needsRepair
      ? `下一轮不加题量，围绕「${weakKey}」做 3 张主动回忆。`
      : `本轮先沉淀掌握证据，再用间隔回访防止遗忘。`,
    recallCards,
    spacedReviewPlan,
    reviewReturnSeed,
    spacedRecallPolicy,
    reviewEventPressure,
    questCadence,
    memoryFeedbackController,
    recallIntensityPlan,
    wrongCauseReplayDeck,
    xpFeedbackPolicy,
    questArcRunway,
    gizmoLikeMemoryProtocol,
    socraticQualityMemoryBridge,
    questionBankMemoryBridge,
    questionBankRecallWorkout,
    dailyMemorySprintDeck,
    adaptiveRecallScheduler,
    memoryRiskReleaseModel,
    memoryComebackLoop,
    dailyMemoryPrescription,
    questionTypeClusterMemoryProtocol,
    peerMemoryRelayLeague,
    dailyMemorySeasonPlan,
    microRecallPrescriptionEngine,
    ninetySecondRecallComboEngine,
    ninetySecondPlayableDeck,
    realHomeworkPressureMemoryPrescription,
    dailyReturnMission,
    dailyReturnContract,
    healthyReturnHabitEngine,
    dailyPrimaryRecallAction,
    familyCoCreationReturnLoop,
    dailyComebackDecisionEngine,
    healthyCommercialReturnGuard,
    hasRealRecallSource,
    greenWordClozeProtocol: gizmoLikeMemoryProtocol.greenWordClozeProtocol || null,
    nextDayReturnEvidence: dailyReturnContract.nextDayReturnEvidence || null,
    xpRule: 'XP 只奖励主动回忆、错因修复和次日回访，不奖励盲刷题量。',
    leechRule: needsRepair
      ? `同一错因连续 2 次错，会降到第一步小黑板。`
      : '连续 2 次说清第一步，才进入变式练习。',
    parentShareLine: `家长复盘只看：孩子能否自己说出「${weakKey}」的第一步。`,
    nextRoute: needsRepair ? '/pages/review/review' : '/pages/tutor/tutor',
    evidenceRequired: ['active_recall_cards', 'spaced_review_plan', 'review_return_seed', 'spaced_recall_policy', 'wrong_cause_return', 'quest_cadence', 'memory_feedback_controller', 'recall_intensity_plan', 'wrong_cause_replay_deck', 'xp_feedback_policy', 'quest_arc_runway', 'gizmo_like_memory_protocol', 'green_word_cloze_protocol', 'socratic_quality_memory_bridge', 'question_bank_memory_bridge', 'question_bank_recall_workout', 'daily_memory_sprint_deck', 'adaptive_recall_scheduler', 'memory_risk_release_model', 'memory_comeback_loop', 'daily_memory_prescription', 'question_type_cluster_memory_protocol', 'peer_memory_relay_league', 'daily_memory_season_plan', 'micro_recall_prescription_engine', 'ninety_second_recall_combo_engine', 'ninety_second_playable_deck', 'real_homework_pressure_memory_prescription', 'daily_return_mission', 'daily_return_contract', 'healthy_return_habit_engine', 'daily_primary_recall_action', 'family_co_creation_return_loop', 'daily_comeback_decision_engine', 'healthy_commercial_return_guard', 'next_day_return_evidence', 'parent_share_line'],
    weakKey
  };
}

function buildReviewReturnSeed(input = {}) {
  const weakKey = input.weakKey || 'first_step';
  const dueCards = Array.isArray(input.dueCards) ? input.dueCards : [];
  const recallCards = Array.isArray(input.recallCards) ? input.recallCards : [];
  const spacedReviewPlan = Array.isArray(input.spacedReviewPlan) ? input.spacedReviewPlan : [];
  const pressure = input.reviewEventPressure || {};
  const result = input.result || {};
  const wrongCardIds = Object.keys(pressure).filter((id) => pressure[id] && Number(pressure[id].wrong || 0) > 0);
  const dueCardIds = dueCards.map((card) => card && card.id).filter(Boolean).slice(0, 6);
  const executableRecallCards = recallCards.filter((card) => card && card.executable !== false && !String(card.id || '').startsWith('synthetic_recall_'));
  const hasRealRecallSource = input.hasRealRecallSource !== false && executableRecallCards.length > 0;
  const recallCardIds = hasRealRecallSource
    ? executableRecallCards.map((card) => card && card.id).filter(Boolean).slice(0, 3)
    : [];
  const repairMode = Boolean(input.needsRepair || Number(result.wrong || 0) > 0 || Number(result.accuracy || 0) < 80);
  const windows = spacedReviewPlan.map((item, index) => ({
    id: item.id || `window_${index + 1}`,
    route: item.route || '/pages/review/review',
    gate: index === 0 ? 'first_step_recall' : index === 1 ? 'next_day_recall' : 'transfer_check'
  }));
  const nextRoute = repairMode ? '/pages/review/review?mode=recall_return' : '/pages/arcade/arcade?mode=recall_return';
  return {
    id: 'review_return_seed',
    mode: repairMode ? 'repair_return' : 'steady_return',
    weakKey,
    questionTypeClusterId: input.questionTypeClusterId || '',
    courseUnitId: input.courseUnitId || '',
    activeSampleId: input.activeSampleId || '',
    executable: hasRealRecallSource,
    status: hasRealRecallSource ? 'ready' : 'waiting_real_recall_card',
    wrongCardIds,
    dueCardIds,
    recallCardIds,
    nextRoute,
    source: 'local_code_scheduler',
    aiMayRewrite: ['prompt_copy', 'parent_line', 'encouragement'],
    localCodeOwns: ['queue_order', 'xp_gate', 'share_fields', 'report_release', 'review_windows'],
    blockedFields: ['full_solution', 'original_stem_photo', 'score', 'ranking', 'full_dialogue'],
    spacedRecallPolicy: {
      id: 'spaced_recall_policy',
      cadence: windows,
      sameDayCardIds: recallCardIds.slice(0, 3),
      nextDayCardIds: hasRealRecallSource ? (wrongCardIds.length ? wrongCardIds.slice(0, 2) : dueCardIds.slice(0, 2)) : [],
      day7Check: {
        route: '/pages/tutor/tutor',
        requirement: 'near_transfer_without_full_solution'
      },
      releaseGate: 'first_step_and_wrong_cause_before_xp_or_share'
    }
  };
}

function buildDailyReturnMission(highFrequency = {}, result = {}, options = {}) {
  const prescription = highFrequency.dailyMemoryPrescription || {};
  const comeback = highFrequency.memoryComebackLoop || {};
  const micro = highFrequency.microRecallPrescriptionEngine || {};
  const combo = highFrequency.ninetySecondRecallComboEngine || {};
  const pressure = highFrequency.realHomeworkPressureMemoryPrescription || {};
  const peer = highFrequency.peerMemoryRelayLeague || {};
  const weakKey = options.weakKey || combo.weakKey || micro.weakKey || prescription.weakKey || '第一步';
  const comboSteps = Array.isArray(combo.comboSteps) ? combo.comboSteps : [];
  const mustDo = Array.isArray(prescription.mustDo) ? prescription.mustDo : [];
  const blockedFields = Array.from(new Set([]
    .concat(Array.isArray(combo.blockedFields) ? combo.blockedFields : [])
    .concat(Array.isArray(peer.blockedFields) ? peer.blockedFields : [])
    .concat(pressure.sharePayload && Array.isArray(pressure.sharePayload.blockedFields) ? pressure.sharePayload.blockedFields : [])));
  const totalSeconds = Number(combo.totalSeconds || comboSteps.reduce((sum, item) => sum + Number(item.seconds || 0), 0) || 90);
  const rescue = combo.mode === 'rescue_combo' || prescription.mode === 'rescue' || Number(result.wrong || 0) >= 2;
  return {
    id: 'daily_return_mission',
    title: rescue ? '今日 90 秒回流：先救一个错因' : '今日 90 秒回流',
    mode: rescue ? 'rescue_return' : 'steady_return',
    weakKey,
    totalSeconds,
    promiseLine: `今天只抢回「${weakKey}」这一类第一步，不开新题海。`,
    visibleSteps: comboSteps.slice(0, 4).map((step, index) => ({
      id: step.id || `return_step_${index + 1}`,
      order: index + 1,
      seconds: Number(step.seconds || 0),
      action: step.action || (mustDo[index] && mustDo[index].action) || '遮住答案，说出第一步。',
      proof: step.proof || (mustDo[index] && mustDo[index].evidence) || 'student_first_step',
      fallback: step.fallback || '说不出就降到二选一提示，不给完整答案。'
    })),
    mustDo: mustDo.slice(0, 3),
    comebackRoute: prescription.comebackRoute || comeback.resumeRoute || '/pages/review/review?from=daily_return_mission',
    xpGate: combo.xpGate || prescription.antiCramRule || 'XP 只奖励主动回忆、错因修复和次日回访，不奖励刷题数量。',
    parentLine: combo.parentEvidenceLine || prescription.parentLine || '家长只看第一步、错因和明天回访，不看分数排名。',
    shareLine: combo.shareBoundary || prescription.shareLine || '分享只带动作和回访窗口，不带原题、答案、分数、排名或完整对话。',
    blockedFields,
    localAiSplit: {
      local: ['daily_dose', 'xp_gate', 'share_fields', 'return_window', 'release_rule'],
      ai: ['child_friendly_wording', 'parent_copy_rewrite', 'blackboard_prompt_variants'],
      blocked: ['final_answer', 'score_ranking', 'mastery_claim_without_revisit']
    },
    pressureReady: !!pressure.sampleSpecificReady,
    evidenceRequired: ['daily_90s_return', 'student_first_step', 'wrong_cause_named', 'next_day_revisit_locked', 'local_xp_gate', 'safe_share_boundary']
  };
}

function buildDailyReturnContract(highFrequency = {}, report = {}, options = {}) {
  const mission = highFrequency.dailyReturnMission || {};
  const prescription = highFrequency.dailyMemoryPrescription || {};
  const comeback = highFrequency.memoryComebackLoop || {};
  const sprint = highFrequency.dailyMemorySprintDeck || {};
  const scheduler = highFrequency.adaptiveRecallScheduler || {};
  const reviewReturnSeed = highFrequency.reviewReturnSeed || {};
  const weakKey = options.weakKey || mission.weakKey || prescription.weakKey || '第一步';
  const now = options.now || new Date();
  const rescue = mission.mode === 'rescue_return' || prescription.mode === 'rescue' || Number(report.wrong || 0) >= 2;
  const loop = [
    {
      id: 'tonight_active_recall',
      label: '今晚',
      trigger: '孩子完成点拨或轻练习后',
      action: `90 秒主动回忆「${weakKey}」的第一步`,
      proof: 'student_first_step_voice_or_text',
      route: mission.comebackRoute || '/pages/review/review?from=daily_return_contract'
    },
    {
      id: 'tomorrow_revisit',
      label: '明天',
      trigger: '同一错因再次出现前',
      action: `只回访 1 张最不稳的「${weakKey}」卡`,
      proof: 'next_day_revisit_result',
      route: comeback.resumeRoute || '/pages/review/review?from=tomorrow_revisit'
    },
    {
      id: 'day3_wrong_cause_replay',
      label: '第 3 天',
      trigger: '错因仍重复或家长反馈卡住',
      action: '重放错因，不新增题海',
      proof: 'wrong_cause_replayed_without_full_answer',
      route: '/pages/tutor/tutor?from=wrong_cause_replay'
    },
    {
      id: 'day7_transfer_gate',
      label: '第 7 天',
      trigger: '准备写入长期画像前',
      action: '换一个小变式，只验证入口能否迁移',
      proof: 'near_transfer_gate_passed',
      route: '/pages/profile/profile?from=day7_transfer_gate'
    }
  ];
  const blockedFields = Array.from(new Set([]
    .concat(Array.isArray(mission.blockedFields) ? mission.blockedFields : [])
    .concat(['original_question', 'source_answer', 'full_solution', 'full_dialogue', 'score', 'ranking', 'private_comment'])));
  const tomorrowStep = loop.find((item) => item.id === 'tomorrow_revisit') || loop[1] || {};
  const seedPolicy = reviewReturnSeed.spacedRecallPolicy || {};
  const nextDayReturnEvidence = {
    id: 'arcade_next_day_return_evidence',
    status: 'agreed_local_contract',
    agreed: true,
    dueAt: addDays(now, 1),
    dueWindow: 'tomorrow',
    route: reviewReturnSeed.nextRoute || tomorrowStep.route || '/pages/review/review?mode=recall_return',
    action: tomorrowStep.action || '',
    proof: tomorrowStep.proof || 'next_day_revisit_result',
    weakKey,
    source: 'daily_return_contract',
    localOnly: true,
    blockedFields,
    reviewReturnSeed: {
      id: reviewReturnSeed.id || 'review_return_seed',
      mode: reviewReturnSeed.mode || '',
      nextRoute: reviewReturnSeed.nextRoute || '',
      wrongCardIds: Array.isArray(reviewReturnSeed.wrongCardIds) ? reviewReturnSeed.wrongCardIds : [],
      dueCardIds: Array.isArray(reviewReturnSeed.dueCardIds) ? reviewReturnSeed.dueCardIds : [],
      recallCardIds: Array.isArray(reviewReturnSeed.recallCardIds) ? reviewReturnSeed.recallCardIds : [],
      nextDayCardIds: Array.isArray(seedPolicy.nextDayCardIds) ? seedPolicy.nextDayCardIds : [],
      releaseGate: seedPolicy.releaseGate || '',
      blockedFields: Array.isArray(reviewReturnSeed.blockedFields) ? reviewReturnSeed.blockedFields : blockedFields
    }
  };
  return {
    id: 'daily_return_contract',
    title: rescue ? '每日回流合约：先救一个错因' : '每日回流合约',
    mode: rescue ? 'rescue_first' : 'steady_growth',
    weakKey,
    loop,
    comebackCopy: `今天只让孩子带着「${weakKey}」回来一次，不靠题量刷存在感。`,
    unlockRules: [
      { id: 'xp_unlock', localRule: '说出第一步、复述错因或完成次日回访才给 XP。', aiRole: '把规则改写得更像孩子能听懂的话。' },
      { id: 'portrait_unlock', localRule: '第 7 天小变式通过前，不提高长期画像置信度。', aiRole: '只能生成家长可读解释，不做能力定性。' },
      { id: 'share_unlock', localRule: '分享只带行动卡、回访窗口和证据缺口。', aiRole: '只润色分享文案。' }
    ],
    parentReceipt: {
      title: '家长 20 秒检查',
      question: `你刚才第一步先看哪里？为什么先看这里？`,
      evidence: ['first_step_named', 'wrong_cause_named', 'next_revisit_locked'],
      doNotAsk: ['不要追完整答案', '不要比较分数排名', '不要让孩子复述整段解法']
    },
    shareCard: {
      allowedFields: ['weak_key', 'first_step_action', 'wrong_cause_label', 'return_window', 'parent_check_question'],
      blockedFields,
      receiverAction: '对方只能接力第一步和回访动作，不能看到原题、答案、照片或完整对话。'
    },
    nextDayReturnEvidence,
    localAiBoundary: {
      localCodeOwns: ['recall_schedule', 'xp_gate', 'portrait_release_gate', 'share_field_allowlist', 'privacy_blocklist'],
      aiOwns: ['child_friendly_rewrite', 'parent_copy_rewrite', 'blackboard_prompt_variant'],
      aiMustNotOwn: ['final_answer', 'mastery_claim', 'ranking_or_score_claim', 'privacy_decision']
    },
    evidenceRequired: ['daily_return_loop', 'xp_unlock_rule', 'portrait_unlock_rule', 'safe_share_card', 'parent_receipt', 'local_ai_boundary', 'next_day_return_evidence'],
    sourceSignals: {
      sprintReady: !!(sprint && sprint.status),
      schedulerReady: !!(scheduler && scheduler.status),
      missionReady: mission.id === 'daily_return_mission'
    }
  };
}

module.exports = {
  ACHIEVEMENTS,
  DAY_MS,
  SHOP_ITEMS,
  XP_REWARDS,
  applySM2,
  buildAdaptiveChallenge,
  buildDailyQuestSet,
  buildGameRetentionLoop,
  buildGizmoLikeMemoryProtocol,
  buildHighFrequencyPracticeLoop,
  buildPublicK12IntakeExecutableCards,
  buildReviewReturnSeed,
  buildDailyMemoryPrescription,
  buildPeerMemoryRelayLeague,
  buildMicroRecallPrescriptionEngine,
  buildNinetySecondRecallComboEngine,
  buildNinetySecondPlayableDeck,
  buildDailyReturnMission,
  buildDailyReturnContract,
  buildHealthyReturnHabitEngine,
  buildFamilyCoCreationReturnLoop,
  buildDailyComebackDecisionEngine,
  buildQuestionTypeClusterMemoryProtocol,
  buildRealHomeworkPressureMemoryPrescription,
  buildMemoryFeedbackController,
  buildMemoryComebackLoop,
  buildAdaptiveRecallScheduler,
  buildMemoryRiskReleaseModel,
  buildDailyMemorySprintDeck,
  buildCourseUnitQuestionBankPlayableCards,
  buildQuestionBankMemoryBridge,
  buildQuestionBankRecallWorkout,
  buildQuestArcRunway,
  buildRecallIntensityPlan,
  buildSocraticQualityMemoryBridge,
  buildWrongCauseReplayDeck,
  buildXpFeedbackPolicy,
  buildKnowledgeGap,
  calculateXP,
  capDailyXP,
  checkAndUnlockAchievements,
  getLevel,
  listAchievements,
  listShopItems,
  purchaseShopItem,
  quizQuestionFromCard,
  streakMultiplier,
  updateStreak
};
