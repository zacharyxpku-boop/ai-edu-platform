/* ===== 原点智学 Learning Store v1 ===== */
/* 本地数据管理 - 使用localStorage存储学习数据 */

(function () {
    'use strict';

    // 数据存储键名
    var KEYS = {
        DIAGNOSIS: 'ydzx_diagnosis_records', // 诊断记录
        STUDY_PLAN: 'ydzx_study_plans',      // 学习计划
        PROGRESS: 'ydzx_progress_data',      // 进步追踪
        PRACTICE: 'ydzx_practice_records',   // 练习记录
        ERRORS:   'ydzx_errors_pool',        // 错题池（跨工具共享）
        FLASHCARDS: 'ydzx_flashcards_pool',  // 闪卡池 · FSRS 简化版复习队列
        ESSAYS:   'ydzx_essay_history'       // 作文批改历史
    };

    // 安全localStorage操作
    function safeGet(key) {
        try {
            var data = window.localStorage.getItem(key);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('读取localStorage失败', key, e);
            return [];
        }
    }

    function safeSet(key, value) {
        try {
            window.localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('写入localStorage失败', key, e);
            // 可能是存储空间满了
            if (e.name === 'QuotaExceededError') {
                alert('本地存储空间已满，请清理历史记录');
            }
            return false;
        }
    }

    var LearningStore = {
        /**
         * 保存诊断记录
         * @param {Object} record - { grade, subject, score, totalScore, rank, examName, errors, result, timestamp }
         */
        saveDiagnosis: function (record) {
            var records = safeGet(KEYS.DIAGNOSIS);
            // 添加唯一ID
            record.id = 'diag_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            records.push(record);
            // 只保留最近50条
            if (records.length > 50) {
                records = records.slice(-50);
            }
            return safeSet(KEYS.DIAGNOSIS, records);
        },

        /**
         * 获取所有诊断记录
         * @param {Object} filter - { grade?, subject?, startDate?, endDate? }
         * @returns {Array}
         */
        getDiagnosisRecords: function (filter) {
            var records = safeGet(KEYS.DIAGNOSIS);
            if (!filter) return records;

            // 过滤
            return records.filter(function (r) {
                if (filter.grade && r.grade !== filter.grade) return false;
                if (filter.subject && r.subject !== filter.subject) return false;
                if (filter.startDate && r.timestamp < filter.startDate) return false;
                if (filter.endDate && r.timestamp > filter.endDate) return false;
                return true;
            });
        },

        /**
         * 获取单条诊断记录
         * @param {String} id
         * @returns {Object|null}
         */
        getDiagnosisById: function (id) {
            var records = safeGet(KEYS.DIAGNOSIS);
            return records.find(function (r) { return r.id === id; }) || null;
        },

        /**
         * 删除诊断记录
         * @param {String} id
         */
        deleteDiagnosis: function (id) {
            var records = safeGet(KEYS.DIAGNOSIS);
            var filtered = records.filter(function (r) { return r.id !== id; });
            return safeSet(KEYS.DIAGNOSIS, filtered);
        },

        /**
         * 清空所有诊断记录
         */
        clearAllDiagnosis: function () {
            if (confirm('确定要清空所有诊断记录吗？此操作不可恢复。')) {
                return safeSet(KEYS.DIAGNOSIS, []);
            }
            return false;
        },

        /**
         * 保存学习计划（预留）
         * @param {Object} plan
         */
        saveStudyPlan: function (plan) {
            var plans = safeGet(KEYS.STUDY_PLAN);
            plan.id = 'plan_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            plan.createdAt = Date.now();
            plans.push(plan);
            return safeSet(KEYS.STUDY_PLAN, plans);
        },

        /**
         * 获取学习计划（预留）
         */
        getStudyPlans: function () {
            return safeGet(KEYS.STUDY_PLAN);
        },

        /**
         * 删除学习计划（预留）
         */
        deleteStudyPlan: function (id) {
            var plans = safeGet(KEYS.STUDY_PLAN);
            var filtered = plans.filter(function (p) { return p.id !== id; });
            return safeSet(KEYS.STUDY_PLAN, filtered);
        },

        /**
         * 保存进步数据（预留）
         * @param {Object} progress
         */
        saveProgress: function (progress) {
            var data = safeGet(KEYS.PROGRESS);
            progress.timestamp = Date.now();
            data.push(progress);
            // 只保留最近100条
            if (data.length > 100) {
                data = data.slice(-100);
            }
            return safeSet(KEYS.PROGRESS, data);
        },

        /**
         * 获取进步数据（预留）
         * @param {Object} filter - { subject?, startDate?, endDate? }
         */
        getProgress: function (filter) {
            var data = safeGet(KEYS.PROGRESS);
            if (!filter) return data;

            return data.filter(function (d) {
                if (filter.subject && d.subject !== filter.subject) return false;
                if (filter.startDate && d.timestamp < filter.startDate) return false;
                if (filter.endDate && d.timestamp > filter.endDate) return false;
                return true;
            });
        },

        /**
         * 保存练习记录（预留）
         * @param {Object} practice
         */
        savePractice: function (practice) {
            var records = safeGet(KEYS.PRACTICE);
            practice.id = 'prac_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            practice.timestamp = Date.now();
            records.push(practice);
            // 只保留最近200条
            if (records.length > 200) {
                records = records.slice(-200);
            }
            return safeSet(KEYS.PRACTICE, records);
        },

        /**
         * 获取练习记录（预留）
         */
        getPracticeRecords: function () {
            return safeGet(KEYS.PRACTICE);
        },

        /**
         * 写入错题（error-practice / error-mastery / exam-diagnosis 共用）
         * @param {Object} err - { subject, grade, keyword, question, studentAnswer, correctAnswer, explanation, score, verdict, mistakeTags, source }
         */
        saveError: function (err) {
            var pool = safeGet(KEYS.ERRORS);
            err.id = 'err_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            err.timestamp = Date.now();
            err.reviewCount = 0;
            err.nextReviewAt = Date.now() + 24 * 3600 * 1000; // 24h 后首次复习
            pool.push(err);
            if (pool.length > 500) pool = pool.slice(-500);
            return safeSet(KEYS.ERRORS, pool);
        },

        /**
         * 读取错题（支持 subject / keyword / dueOnly 过滤）
         */
        getErrors: function (filter) {
            var pool = safeGet(KEYS.ERRORS);
            if (!filter) return pool;
            var now = Date.now();
            return pool.filter(function (e) {
                if (filter.subject && e.subject !== filter.subject) return false;
                if (filter.keyword && (e.keyword || '').indexOf(filter.keyword) === -1) return false;
                if (filter.dueOnly && (e.nextReviewAt || 0) > now) return false;
                return true;
            });
        },

        /**
         * 按 ID 删除错题
         */
        deleteError: function (id) {
            var pool = safeGet(KEYS.ERRORS);
            return safeSet(KEYS.ERRORS, pool.filter(function (e) { return e.id !== id; }));
        },

        /**
         * 标记错题已复习（下次复习按 FSRS 简化版递增）
         */
        markErrorReviewed: function (id, remembered) {
            var pool = safeGet(KEYS.ERRORS);
            var gaps = [1, 3, 7, 15, 30]; // 天
            for (var i = 0; i < pool.length; i++) {
                if (pool[i].id === id) {
                    pool[i].reviewCount = (pool[i].reviewCount || 0) + 1;
                    var idx = remembered ? Math.min(pool[i].reviewCount, gaps.length - 1) : 0;
                    pool[i].nextReviewAt = Date.now() + gaps[idx] * 24 * 3600 * 1000;
                    pool[i].lastReviewAt = Date.now();
                    break;
                }
            }
            return safeSet(KEYS.ERRORS, pool);
        },

        // ===== 闪卡 FSRS 简化版复习队列 =====
        // 新卡：next=now；评分 0=不会 / 1=模糊 / 2=会了
        // gaps: 不会重置到 stage 0，模糊 stage-1，会了 stage+1
        // stage -> days: [0.02(30分钟), 1, 3, 7, 15, 30, 60, 120]

        /**
         * 批量保存闪卡（从 note-enhancer 写入）
         * cards: [{ question, answer }]
         * meta:  { subject, stage, grade, textbookVersion, chapter }
         */
        saveFlashcards: function (cards, meta) {
            if (!Array.isArray(cards) || cards.length === 0) return false;
            var pool = safeGet(KEYS.FLASHCARDS);
            var now = Date.now();
            cards.forEach(function (c, i) {
                pool.push({
                    id: 'card_' + now + '_' + i + '_' + Math.random().toString(36).substr(2, 6),
                    question: c.question || '',
                    answer: c.answer || '',
                    subject: (meta && meta.subject) || '',
                    stage: (meta && meta.stage) || '',
                    grade: (meta && meta.grade) || '',
                    textbookVersion: (meta && meta.textbookVersion) || '',
                    chapter: (meta && meta.chapter) || '',
                    source: (meta && meta.source) || 'note-enhancer',
                    createdAt: now,
                    nextReviewAt: now,       // 新卡立刻到期
                    lastReviewAt: null,
                    reviewStage: 0,          // 0..7
                    reviewCount: 0,
                    lapses: 0                // 失败次数
                });
            });
            // 同一科目 + 相同 question 去重（保留新的）
            var seen = {};
            var dedup = [];
            for (var k = pool.length - 1; k >= 0; k--) {
                var key = (pool[k].subject || '') + '|' + (pool[k].question || '').trim();
                if (seen[key]) continue;
                seen[key] = true;
                dedup.unshift(pool[k]);
            }
            if (dedup.length > 800) dedup = dedup.slice(-800);
            return safeSet(KEYS.FLASHCARDS, dedup);
        },

        /**
         * 取所有到期闪卡（nextReviewAt <= now）
         * filter: { subject?, grade?, limit? }
         */
        getDueFlashcards: function (filter) {
            var pool = safeGet(KEYS.FLASHCARDS);
            var now = Date.now();
            var due = pool.filter(function (c) {
                if (c.nextReviewAt > now) return false;
                if (filter && filter.subject && c.subject !== filter.subject) return false;
                if (filter && filter.grade && c.grade !== filter.grade) return false;
                return true;
            });
            // 到期越久越先复习
            due.sort(function (a, b) { return a.nextReviewAt - b.nextReviewAt; });
            if (filter && filter.limit) due = due.slice(0, filter.limit);
            return due;
        },

        /** 所有闪卡 */
        getAllFlashcards: function (filter) {
            var pool = safeGet(KEYS.FLASHCARDS);
            if (!filter) return pool;
            return pool.filter(function (c) {
                if (filter.subject && c.subject !== filter.subject) return false;
                if (filter.grade && c.grade !== filter.grade) return false;
                return true;
            });
        },

        /**
         * 评分：id + rating (0/1/2)
         * 0 = 不会：stage=0, lapses+1, next = +30 分钟
         * 1 = 模糊：stage = max(0, stage-1), next = 按新 stage
         * 2 = 会了：stage+=1, next = 按新 stage
         */
        reviewFlashcard: function (id, rating) {
            var pool = safeGet(KEYS.FLASHCARDS);
            // 天数映射：[30分钟, 1天, 3天, 7天, 15天, 30天, 60天, 120天]
            var gapsMs = [
                30 * 60 * 1000,
                1 * 86400000,
                3 * 86400000,
                7 * 86400000,
                15 * 86400000,
                30 * 86400000,
                60 * 86400000,
                120 * 86400000
            ];
            var updated = null;
            for (var i = 0; i < pool.length; i++) {
                if (pool[i].id !== id) continue;
                var c = pool[i];
                c.reviewCount = (c.reviewCount || 0) + 1;
                c.lastReviewAt = Date.now();
                if (rating === 0) {
                    c.reviewStage = 0;
                    c.lapses = (c.lapses || 0) + 1;
                } else if (rating === 1) {
                    c.reviewStage = Math.max(0, (c.reviewStage || 0) - 1);
                } else {
                    c.reviewStage = Math.min(gapsMs.length - 1, (c.reviewStage || 0) + 1);
                }
                c.nextReviewAt = Date.now() + gapsMs[c.reviewStage];
                updated = c;
                break;
            }
            safeSet(KEYS.FLASHCARDS, pool);
            return updated;
        },

        /** 删除闪卡 */
        deleteFlashcard: function (id) {
            var pool = safeGet(KEYS.FLASHCARDS);
            var filtered = pool.filter(function (c) { return c.id !== id; });
            return safeSet(KEYS.FLASHCARDS, filtered);
        },

        /**
         * 保存作文批改记录
         * @param {Object} rec - { scores, total, stage, grade, genre, title, essay, annotations }
         */
        saveEssayGrading: function (rec) {
            var list = safeGet(KEYS.ESSAYS);
            rec.id = rec.id || ('essay_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
            rec.timestamp = rec.timestamp || Date.now();
            list.unshift(rec);
            if (list.length > 100) list = list.slice(0, 100);
            safeSet(KEYS.ESSAYS, list);
            return rec.id;
        },

        /** 获取作文批改历史 */
        getEssayHistory: function (filter) {
            var list = safeGet(KEYS.ESSAYS);
            if (filter && filter.stage) list = list.filter(function (r) { return r.stage === filter.stage; });
            if (filter && filter.grade) list = list.filter(function (r) { return r.grade === filter.grade; });
            if (filter && filter.genre) list = list.filter(function (r) { return r.genre === filter.genre; });
            return list;
        },

        /** 删除某条 */
        deleteEssay: function (id) {
            var list = safeGet(KEYS.ESSAYS);
            safeSet(KEYS.ESSAYS, list.filter(function (r) { return r.id !== id; }));
        },

        /** 作文进步曲线数据 — 返回按时间升序 {ts, total} */
        getEssayTrend: function (limit) {
            var list = safeGet(KEYS.ESSAYS);
            var lim = limit || 12;
            return list.slice(0, lim).reverse().map(function (r) {
                return { ts: r.timestamp, total: r.total || 0, genre: r.genre || '', grade: r.grade || '' };
            });
        },

        /** 闪卡统计 · progress.html 可用 */
        getFlashcardStats: function () {
            var pool = safeGet(KEYS.FLASHCARDS);
            var now = Date.now();
            var due = pool.filter(function (c) { return c.nextReviewAt <= now; }).length;
            var learning = pool.filter(function (c) { return (c.reviewStage || 0) < 3; }).length;
            var mature = pool.filter(function (c) { return (c.reviewStage || 0) >= 5; }).length;
            return { total: pool.length, due: due, learning: learning, mature: mature };
        },

        /**
         * 导出所有数据为JSON
         * @returns {String}
         */
        exportAllData: function () {
            var allData = {
                diagnosis: safeGet(KEYS.DIAGNOSIS),
                studyPlans: safeGet(KEYS.STUDY_PLAN),
                progress: safeGet(KEYS.PROGRESS),
                practice: safeGet(KEYS.PRACTICE),
                errors: safeGet(KEYS.ERRORS),
                flashcards: safeGet(KEYS.FLASHCARDS),
                essays: safeGet(KEYS.ESSAYS),
                exportTime: Date.now(),
                version: '1.3'
            };
            return JSON.stringify(allData, null, 2);
        },

        /**
         * 导入数据（覆盖现有数据，谨慎使用）
         * @param {String} jsonData
         */
        importData: function (jsonData) {
            try {
                var data = JSON.parse(jsonData);
                if (confirm('导入数据将覆盖现有所有记录，确定继续吗？')) {
                    safeSet(KEYS.DIAGNOSIS, data.diagnosis || []);
                    safeSet(KEYS.STUDY_PLAN, data.studyPlans || []);
                    safeSet(KEYS.PROGRESS, data.progress || []);
                    safeSet(KEYS.PRACTICE, data.practice || []);
                    safeSet(KEYS.ERRORS, data.errors || []);
                    safeSet(KEYS.FLASHCARDS, data.flashcards || []);
                    safeSet(KEYS.ESSAYS, data.essays || []);
                    alert('数据导入成功！');
                    return true;
                }
            } catch (e) {
                alert('数据格式错误，导入失败');
                console.error('导入失败', e);
            }
            return false;
        },

        /**
         * 获取存储使用情况
         * @returns {Object} - { used, total, percentage }
         */
        getStorageUsage: function () {
            var total = 0;
            var used = 0;
            try {
                // 估算localStorage使用量
                for (var key in window.localStorage) {
                    if (window.localStorage.hasOwnProperty(key)) {
                        used += window.localStorage[key].length + key.length;
                    }
                }
                // localStorage通常限制5MB
                total = 5 * 1024 * 1024;
                return {
                    used: used,
                    total: total,
                    percentage: Math.round((used / total) * 100),
                    usedMB: (used / 1024 / 1024).toFixed(2),
                    totalMB: (total / 1024 / 1024).toFixed(2)
                };
            } catch (e) {
                return { used: 0, total: 0, percentage: 0 };
            }
        },

        /**
         * 统计数据概览
         * @returns {Object}
         */
        getStatistics: function () {
            var diagnosis = safeGet(KEYS.DIAGNOSIS);
            var plans = safeGet(KEYS.STUDY_PLAN);
            var progress = safeGet(KEYS.PROGRESS);
            var practice = safeGet(KEYS.PRACTICE);
            var errors = safeGet(KEYS.ERRORS);
            var now = Date.now();
            var dueErrors = errors.filter(function (e) { return (e.nextReviewAt || 0) <= now; }).length;

            return {
                totalDiagnosis: diagnosis.length,
                totalPlans: plans.length,
                totalProgress: progress.length,
                totalPractice: practice.length,
                totalErrors: errors.length,
                dueErrors: dueErrors,
                lastDiagnosisDate: diagnosis.length > 0 ? diagnosis[diagnosis.length - 1].timestamp : null,
                storage: this.getStorageUsage()
            };
        }
    };

    // 导出到全局
    window.LearningStore = LearningStore;
})();
