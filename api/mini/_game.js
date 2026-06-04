import { clean } from './_shared.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const COMPATIBILITY_SAFE_COPY_INVENTORY = Object.freeze({
    inventory_status: 'compatibility_retained_safe_copy',
    inventory_decision: 'retain_reword_safe_copy'
});

const LEARNING_RECORD_DELTAS = {
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

const STAGE_RECORDS = [
    { id: 'first_review', title: '第一次回访记录', description: '完成第一次短回访', recordPoints: 20 },
    { id: 'hundred_correct', title: '稳定答题记录', description: '累计留下 100 次正确证据', recordPoints: 80 },
    { id: 'seven_day_streak', title: '七天学习记录', description: '连续 7 天完成学习记录', recordPoints: 70 },
    { id: 'quiz_master_3', title: '三次稳定记录', description: '连续 3 次小测正确率达到 90%', recordPoints: 90 },
    { id: 'whole_book', title: '单元完成记录', description: '完成一个学习单元的主要知识点记录', recordPoints: 120 }
];

const LOCAL_VISUAL_RECORD_ITEMS = [
    { id: 'avatar_origin_gold', type: 'avatar_frame', title: '原点头像记录框', recordCost: 60, description: '装饰性头像记录框，不影响学习结果。' },
    { id: 'theme_forest_focus', type: 'theme', title: '森林专注主题', recordCost: 90, description: '护眼学习界面主题。' },
    { id: 'card_warm_grid', type: 'card_back', title: '暖色网格卡背', recordCost: 50, description: '回访卡背面装饰。' },
    { id: 'record_repair_note', type: 'record_repair', title: '记录补全卡', recordCost: 180, description: '补全一次本机记录，只能用于本机学习点记录。' }
];

function todayKey(date = new Date()) {
    return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
    return new Date(date.getTime() + Math.max(0, Number(days || 0)) * DAY_MS).toISOString();
}

function safeArray(value, limit = 100) {
    return Array.isArray(value) ? value.slice(0, limit) : [];
}

function hashCode(value) {
    const text = String(value || '');
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash |= 0;
    }
    return hash;
}

function calculateLearningRecordDelta(actionType, multiplier = 1) {
    const base = LEARNING_RECORD_DELTAS[actionType] || 0;
    return Math.round(base * Math.max(1, Math.min(5, Number(multiplier || 1))));
}

function getLearningRecordStage(xp = 0) {
    const total = Math.max(0, Number(xp || 0));
    const level = Math.floor(Math.sqrt(total / 100));
    const currentFloor = Math.pow(level, 2) * 100;
    const nextLevelXp = Math.pow(level + 1, 2) * 100;
    const titles = ['开始记录', '稳定起步', '会复盘', '记录稳定', '持续复盘'];
    return {
        level,
        title: titles[Math.min(level, titles.length - 1)],
        currentXp: total,
        nextLevelXp,
        progress: nextLevelXp > currentFloor ? Math.round(((total - currentFloor) / (nextLevelXp - currentFloor)) * 100) : 100
    };
}

function getProgressBand(xp = 0) {
    const level = getLearningRecordStage(xp);
    return {
        record_total: level.currentXp,
        stage_index: level.level,
        stage_title: level.title,
        next_stage_record_total: level.nextLevelXp,
        stage_progress: level.progress
    };
}

function applySM2(card = {}, grade = 'remembered', now = new Date()) {
    let repetitions = Math.max(0, Number(card.repetitions ?? card.reps ?? 0));
    let interval = Math.max(0, Number(card.interval || 0));
    let easeFactor = Number(card.ease_factor || card.easeFactor || 2.5);
    if (grade === 'forgotten' || grade === 'again') {
        repetitions = 0;
        interval = 1;
        easeFactor = 2.5;
    } else if (grade === 'fuzzy' || grade === 'hard') {
        interval = Math.max(1, Math.round(interval * 0.5));
        easeFactor = Math.max(1.3, easeFactor - 0.15);
    } else {
        repetitions += 1;
        if (repetitions === 1) interval = 1;
        else if (repetitions === 2) interval = 3;
        else interval = Math.max(1, Math.round(Math.max(1, interval) * easeFactor));
        easeFactor = Math.min(3.2, easeFactor + (grade === 'easy' ? 0.2 : 0.1));
    }
    return {
        repetitions,
        interval,
        ease_factor: Number(easeFactor.toFixed(2)),
        last_review: now.toISOString(),
        next_review: addDays(now, interval)
    };
}

function dueCards(cards = [], now = new Date(), limit = 50) {
    const time = now.getTime();
    return safeArray(cards, 1000)
        .filter((card) => !card.suspended)
        .filter((card) => !card.next_review && !card.due ? true : new Date(card.next_review || card.due).getTime() <= time)
        .sort((a, b) => new Date(a.next_review || a.due || 0).getTime() - new Date(b.next_review || b.due || 0).getTime())
        .slice(0, Math.max(1, Math.min(100, Number(limit || 50))));
}

function normalizeLineToCard(line, index, meta = {}) {
    const text = clean(line, 360);
    if (!text) return null;
    const separators = ['->', '=>', '：', ':', '？', '?'];
    const splitAt = separators
        .map((token) => ({ token, index: text.indexOf(token) }))
        .filter((item) => item.index > 0)
        .sort((a, b) => a.index - b.index)[0];
    const question = splitAt ? text.slice(0, splitAt.index + (/[:：?？]$/.test(splitAt.token) ? 1 : 0)).trim() : `回忆：${text.slice(0, 42)}`;
    const answer = splitAt ? text.slice(splitAt.index + splitAt.token.length).trim() : text;
    const idBase = clean(`${meta.deck_id || 'deck'}_${index}_${question}`, 80).replace(/\s+/g, '_');
    return {
        id: `card_${Math.abs(hashCode(idBase)).toString(36)}`,
        deck_id: meta.deck_id || '',
        question: question || `第 ${index + 1} 个知识点是什么？`,
        answer: answer || text,
        hint: meta.hint || '先自己回忆，再翻卡核对答案。',
        source: meta.source || '',
        subject: meta.subject || '',
        edition: meta.edition || '',
        grade: meta.grade || '',
        chapter: meta.chapter || '',
        knowledge_point: meta.knowledge_point || '',
        repetitions: 0,
        interval: 0,
        ease_factor: 2.5,
        next_review: new Date().toISOString(),
        last_review: ''
    };
}

function buildDeckFromText(payload = {}) {
    const text = clean(payload.text || payload.content || '', 12000);
    const title = clean(payload.title || payload.chapter || payload.topic || '自定义学习包', 80);
    const deckId = clean(payload.deck_id || `deck_${Math.abs(hashCode(`${title}:${text}`)).toString(36)}`, 80);
    const lines = text
        .split(/\n|。|；|;/)
        .map((line) => line.trim())
        .filter((line) => line.length >= 2)
        .slice(0, 80);
    const meta = {
        deck_id: deckId,
        source: clean(payload.source || payload.textbook_source || '', 120),
        subject: clean(payload.subject || '', 20),
        edition: clean(payload.edition || payload.version || '', 30),
        grade: clean(payload.grade || '', 30),
        chapter: clean(payload.chapter || '', 80),
        knowledge_point: clean(payload.knowledge_point || '', 80)
    };
    const cards = lines
        .map((line, index) => normalizeLineToCard(line, index, meta))
        .filter(Boolean);
    return {
        deck: {
            id: deckId,
            title,
            subject: meta.subject,
            edition: meta.edition,
            grade: meta.grade,
            chapter: meta.chapter,
            source: meta.source,
            created_at: new Date().toISOString()
        },
        cards,
        count: cards.length
    };
}

function quizQuestionFromCard(card = {}) {
    const answer = clean(card.answer || '', 240);
    const distractors = ['先看题目条件再判断', '把概念和例题混在一起', '只记答案不说原因'].filter((item) => item !== answer);
    return {
        id: `quiz_${clean(card.id || '', 80) || Date.now()}`,
        card_id: clean(card.id || '', 80),
        type: answer.length <= 18 ? 'choice' : 'short_answer',
        question: clean(card.question || '', 240),
        answer,
        options: answer.length <= 18 ? [answer].concat(distractors).slice(0, 4) : [],
        explanation: clean(card.hint || card.weakPoint || '先回忆，再对照答案说出错因。', 200)
    };
}

function learningStageRecordState(stats = {}) {
    const existing = new Set(safeArray(stats.achievements, 200));
    const recent = safeArray(stats.recent_quiz_accuracy, 10).slice(-3);
    const tests = {
        first_review: Number(stats.review_count || 0) >= 1,
        hundred_correct: Number(stats.correct_count || 0) >= 100,
        seven_day_streak: Number(stats.streak || 0) >= 7,
        quiz_master_3: recent.length >= 3 && recent.every((item) => Number(item || 0) >= 90),
        whole_book: Number(stats.completed_books || 0) >= 1
    };
    const list = STAGE_RECORDS.map((item) => Object.assign({}, item, {
        unlocked: existing.has(item.id) || !!tests[item.id],
        newly_unlocked: !existing.has(item.id) && !!tests[item.id]
    }));
    return {
        achievements: list,
        records: list,
        newly_unlocked: list.filter((item) => item.newly_unlocked),
        newly_recorded: list.filter((item) => item.newly_unlocked),
        record_points_awarded: list.filter((item) => item.newly_unlocked).reduce((sum, item) => sum + Number(item.recordPoints || 0), 0),
        display_notice: '这些只是本机阶段学习记录，不是外显荣誉或同学竞争体系。'
    };
}

function localVisualRecordItems(inventory = []) {
    const owned = new Set(safeArray(inventory, 200).map((item) => item.item_id || item.id));
    return LOCAL_VISUAL_RECORD_ITEMS.map((item) => Object.assign({}, item, {
        owned: owned.has(item.id),
        catalog_kind: 'local_visual_record',
        benefit_notice: '仅用于本机界面装饰，不代表权益或学习结果。'
    }));
}

function reserveLocalVisualRecord(user = {}, itemId = '') {
    const item = LOCAL_VISUAL_RECORD_ITEMS.find((entry) => entry.id === itemId);
    if (!item) return { ok: false, error: 'item_not_found', message: '没有找到这个界面记录。' };
    return {
        ok: false,
        error: 'catalog_only',
        message: '当前只展示本机界面记录，不提供外部权益或结果承诺。',
        item,
        user_patch: user
    };
}

function localSelfSnapshotRows(profile = {}, events = []) {
    const week = todayKey().slice(0, 8);
    const xp = safeArray(events, 500)
        .filter((event) => String(event.created_at || '').slice(0, 8) === week)
        .reduce((sum, event) => sum + Number(event.xp || 0), 0);
    return [{
        rank: 1,
        self_snapshot_order: 1,
        name: clean(profile.name || '本机学习者', 24),
        xp,
        record_total: xp,
        streak: Number(profile.streak || 0),
        is_self: true,
        scope: 'local',
        display_notice: '仅展示孩子自己的本机学习记录，不展示同学排序。'
    }];
}

function knowledgeGap(events = []) {
    const map = {};
    safeArray(events, 1000).forEach((event) => {
        if (!['again', 'forgotten', 'wrong'].includes(event.rating || event.result)) return;
        const key = clean(event.weakPoint || event.knowledge_point || event.subject || '未标注错因', 60);
        if (!map[key]) map[key] = { key, count: 0, subject: clean(event.subject || '', 20) };
        map[key].count += 1;
    });
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 8);
}

export {
    STAGE_RECORDS,
    LOCAL_VISUAL_RECORD_ITEMS,
    LEARNING_RECORD_DELTAS,
    COMPATIBILITY_SAFE_COPY_INVENTORY,
    learningStageRecordState,
    localVisualRecordItems,
    reserveLocalVisualRecord,
    localSelfSnapshotRows,
    applySM2,
    buildDeckFromText,
    calculateLearningRecordDelta,
    dueCards,
    getLearningRecordStage,
    getProgressBand,
    knowledgeGap,
    STAGE_RECORDS as ACHIEVEMENTS,
    LOCAL_VISUAL_RECORD_ITEMS as SHOP_ITEMS,
    LEARNING_RECORD_DELTAS as XP_REWARDS,
    learningStageRecordState as achievementState,
    calculateLearningRecordDelta as calculateXP,
    getLearningRecordStage as getLevel,
    localSelfSnapshotRows as localLeaderboard,
    reserveLocalVisualRecord as purchaseItem,
    quizQuestionFromCard,
    localVisualRecordItems as shopItems,
    todayKey
};
