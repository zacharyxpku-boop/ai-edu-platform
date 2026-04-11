/* ===== 原点智学 Learning Store v1 ===== */
/* 本地数据管理 - 使用localStorage存储学习数据 */

(function () {
    'use strict';

    // 数据存储键名
    var KEYS = {
        DIAGNOSIS: 'ydzx_diagnosis_records', // 诊断记录
        STUDY_PLAN: 'ydzx_study_plans',      // 学习计划
        PROGRESS: 'ydzx_progress_data',      // 进步追踪
        PRACTICE: 'ydzx_practice_records'    // 练习记录
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
         * 导出所有数据为JSON
         * @returns {String}
         */
        exportAllData: function () {
            var allData = {
                diagnosis: safeGet(KEYS.DIAGNOSIS),
                studyPlans: safeGet(KEYS.STUDY_PLAN),
                progress: safeGet(KEYS.PROGRESS),
                practice: safeGet(KEYS.PRACTICE),
                exportTime: Date.now(),
                version: '1.0'
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

            return {
                totalDiagnosis: diagnosis.length,
                totalPlans: plans.length,
                totalProgress: progress.length,
                totalPractice: practice.length,
                lastDiagnosisDate: diagnosis.length > 0 ? diagnosis[diagnosis.length - 1].timestamp : null,
                storage: this.getStorageUsage()
            };
        }
    };

    // 导出到全局
    window.LearningStore = LearningStore;
})();
