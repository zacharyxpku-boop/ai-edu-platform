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

const LEVEL_TITLES = ['新手', '起步', '会学', '学霸', '学神'];

const ACHIEVEMENTS = [
  { id: 'first_review', title: '初出茅庐', description: '完成第一次复习', recordPoints: 20, test: (stats) => Number(stats.review_count || 0) >= 1 },
  { id: 'hundred_correct', title: '百题斩', description: '累计答对 100 题', recordPoints: 80, test: (stats) => Number(stats.correct_count || 0) >= 100 },
  { id: 'seven_day_streak', title: '七日之约', description: '连续 7 天完成复习', recordPoints: 70, test: (stats) => Number(stats.streak || 0) >= 7 },
  {
    id: 'quiz_master_3',
    title: '考神附体',
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
  (Array.isArray(events) ? events : []).forEach((event) => {
    if (!event || !['again', 'forgotten', 'wrong'].includes(event.rating || event.result)) return;
    const key = event.weakPoint || event.knowledge_point || event.subject || '未标注';
    if (!gaps[key]) gaps[key] = { key, count: 0, subjects: {} };
    gaps[key].count += 1;
    if (event.subject) gaps[key].subjects[event.subject] = (gaps[key].subjects[event.subject] || 0) + 1;
  });
  const list = Array.isArray(cards) ? cards : [];
  return Object.values(gaps).sort((a, b) => b.count - a.count).slice(0, 8).map((item) => Object.assign({}, item, {
    next_action: list.some((card) => card.weakPoint === item.key) ? '复习相关卡片' : '补充一张错因卡'
  }));
}

module.exports = {
  ACHIEVEMENTS,
  DAY_MS,
  SHOP_ITEMS,
  XP_REWARDS,
  applySM2,
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
