/* 原点智学 · 测评雷达 + 作业三分类轻量内核
 * 目标：Web 先跑通，后续小程序复用同一份输入/输出结构。
 */
(function () {
    'use strict';

    var STORAGE_PREFIX = 'ydzx_priority_state_v1:';

    var DEFAULT_AXES = [
        { key: 'concept', name: '概念理解', score: 62 },
        { key: 'calculation', name: '计算准确', score: 58 },
        { key: 'reading', name: '审题建模', score: 54 },
        { key: 'transfer', name: '迁移应用', score: 49 },
        { key: 'expression', name: '表达复盘', score: 66 },
        { key: 'load', name: '作业负荷', score: 42 }
    ];

    var KEYWORDS = {
        concept: ['概念', '定义', '性质', '公式', '原理', '为什么', '理解'],
        calculation: ['计算', '运算', '化简', '移项', '去括号', '去分母', '符号', '小数', '分数'],
        reading: ['审题', '题意', '条件', '问什么', '单位', '已知', '未知', '关键词'],
        transfer: ['应用', '综合', '压轴', '变式', '迁移', '模型', '行程', '工程', '函数'],
        expression: ['过程', '步骤', '说明', '证明', '表达', '讲清楚', '复盘'],
        load: ['作业', '很多', '来不及', '熬夜', '疲惫', '磨蹭', '效率', '时间']
    };

    function safeParse(raw, fallback) {
        try { return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; }
    }

    function getStudentId() {
        var params = new URLSearchParams(location.search);
        return params.get('student_id') || localStorage.getItem('yd:my_student_id') || 'demo';
    }

    function storageKey(studentId) {
        return STORAGE_PREFIX + (studentId || getStudentId());
    }

    function loadState(studentId) {
        return safeParse(localStorage.getItem(storageKey(studentId)), null) || makeDemoState(studentId);
    }

    function saveState(state, studentId) {
        var sid = studentId || state.student_id || getStudentId();
        var payload = Object.assign({}, state, {
            student_id: sid,
            updated_at: new Date().toISOString()
        });
        localStorage.setItem(storageKey(sid), JSON.stringify(payload));
        return payload;
    }

    function clamp(n, min, max) {
        return Math.max(min, Math.min(max, Number(n) || 0));
    }

    function scoreFromText(text, key) {
        var t = String(text || '');
        var hits = (KEYWORDS[key] || []).reduce(function (n, word) {
            return n + (t.indexOf(word) >= 0 ? 1 : 0);
        }, 0);
        return hits;
    }

    function buildAssessment(input) {
        input = input || {};
        var score = clamp(input.score, 0, Number(input.totalScore || 100));
        var total = Number(input.totalScore || 100) || 100;
        var base = total ? Math.round(score / total * 100) : 62;
        var text = [
            input.examText || '',
            input.homeworkText || '',
            (input.errors || []).map(function (e) {
                return [e.question, e.myAnswer, e.correctAnswer].join(' ');
            }).join(' ')
        ].join(' ');

        var axes = DEFAULT_AXES.map(function (axis) {
            var penalty = scoreFromText(text, axis.key) * 8;
            var adjusted = clamp(base - penalty + (axis.key === 'load' ? -10 : 0), 18, 92);
            return {
                key: axis.key,
                name: axis.name,
                score: adjusted,
                evidence: makeEvidence(axis.key, adjusted)
            };
        });

        var weakPoints = axes
            .filter(function (a) { return a.score < 65; })
            .sort(function (a, b) { return a.score - b.score; })
            .slice(0, 3)
            .map(function (a) {
                return {
                    key: a.key,
                    name: a.name,
                    score: a.score,
                    reason: a.evidence
                };
            });

        return saveState({
            source: input.source || 'diagnosis',
            stage: input.stage || '',
            grade: input.grade || '',
            subject: input.subject || '数学',
            textbook_version: input.version || '人教版',
            score: score,
            total_score: total,
            axes: axes,
            weak_points: weakPoints,
            homework_plan: classifyHomework(input.homeworkText || '', weakPoints, input.minutes || 35),
            positioning: getPositioning()
        }, input.student_id);
    }

    function makeEvidence(key, score) {
        var low = score < 55;
        var map = {
            concept: low ? '概念没有稳定落到题目条件里' : '概念能用，但遇到变式会犹豫',
            calculation: low ? '符号、移项、分数运算容易丢分' : '计算基本稳定，需减少低级失误',
            reading: low ? '容易漏条件或误读题目问法' : '能抓主要条件，但复杂题还要慢一点读',
            transfer: low ? '换一个题型就不知道从哪里下手' : '常规迁移可做，综合题还需拆步骤',
            expression: low ? '会做不等于能讲清楚，复盘证据不足' : '能说出步骤，继续训练为什么',
            load: low ? '作业量和精力不匹配，需要先做最有价值的部分' : '作业节奏基本可控'
        };
        return map[key] || '需要继续观察';
    }

    function splitHomework(text) {
        var lines = String(text || '')
            .split(/\n|；|;|。/)
            .map(function (s) { return s.trim(); })
            .filter(Boolean);
        if (!lines.length) {
            lines = [
                '数学：一元一次方程基础题 8 道',
                '数学：应用题 4 道，写完整过程',
                '语文：阅读理解 1 篇',
                '英语：单词抄写 3 遍',
                '整理今天错题并讲出错因'
            ];
        }
        return lines.slice(0, 18);
    }

    function classifyHomework(text, weakPoints, minutes) {
        weakPoints = weakPoints || [];
        minutes = clamp(minutes || 35, 10, 120);
        var weakNames = weakPoints.map(function (w) { return w.name; }).join(' ');
        var items = splitHomework(text).map(function (line, idx) {
            var score = 30;
            if (/错题|订正|复盘|过程|讲/.test(line)) score += 28;
            if (/基础|例题|必做|课堂/.test(line)) score += 18;
            if (/应用|综合|压轴|变式|方程|函数|几何/.test(line)) score += 16;
            if (/抄写|机械|摘抄|预习|拓展|选做/.test(line)) score -= 18;
            if (weakNames && weakNames.split(/\s+/).some(function (w) { return w && line.indexOf(w.slice(0, 2)) >= 0; })) score += 16;
            score -= idx * 1.5;
            return {
                text: line,
                score: Math.round(clamp(score, 0, 100)),
                minutes: Math.max(5, Math.round(minutes / Math.max(4, splitHomework(text).length)))
            };
        }).sort(function (a, b) { return b.score - a.score; });

        var n = items.length;
        var mustN = Math.max(1, Math.round(n * 0.48));
        var skipN = Math.max(1, Math.round(n * 0.24));
        var must = items.slice(0, mustN);
        var skip = items.slice(n - skipN);
        var flexible = items.slice(mustN, n - skipN);
        return {
            minutes_available: minutes,
            must_do: must,
            flexible: flexible,
            can_skip: skip,
            rule: '必须做约 40-50%，可跳过约 20-30%，剩余按精力灵活选',
            generated_at: new Date().toISOString()
        };
    }

    function getPositioning() {
        return {
            primary_segment: '小学 4-6 年级到初一衔接',
            validation_segment: '初一初二方法升级验证',
            not_for: '初三短期冲刺承诺',
            promise: '不替孩子写作业；帮助他少做无效题，把薄弱点讲清楚、练到位、复盘出来',
            stories: [
                { key: 'tools', name: '免费工具箱', job: '低门槛体验，证明原点能把学习问题拆清楚' },
                { key: 'tutor', name: '原小点私教', job: '只辅导必须做和关键错因，不把 AI 变成答案机' },
                { key: 'radar', name: '家长雷达', job: '测评/上传后给家长看弱点、取舍和进步证据' }
            ],
            miniapp_loop: '测评/试卷/作业上传 → 雷达弱点 → 作业三分类 → 原小点只辅导必须做和关键错因'
        };
    }

    function makeDemoState(studentId) {
        return {
            student_id: studentId || getStudentId(),
            source: 'demo',
            stage: '小学/初中衔接',
            grade: '五年级-初一',
            subject: '数学',
            textbook_version: '人教版 MVP',
            updated_at: new Date().toISOString(),
            axes: DEFAULT_AXES,
            weak_points: [
                { key: 'transfer', name: '迁移应用', score: 49, reason: '换题型后不知道先抓哪个条件' },
                { key: 'load', name: '作业负荷', score: 42, reason: '作业量和精力不匹配，需要取舍' },
                { key: 'reading', name: '审题建模', score: 54, reason: '容易漏条件或误读问法' }
            ],
            homework_plan: classifyHomework('', [
                { name: '迁移应用' },
                { name: '作业负荷' },
                { name: '审题建模' }
            ], 35),
            positioning: getPositioning()
        };
    }

    window.YDZX_PRIORITY = {
        loadState: loadState,
        saveState: saveState,
        buildAssessment: buildAssessment,
        classifyHomework: classifyHomework,
        getPositioning: getPositioning,
        makeDemoState: makeDemoState
    };
})();
