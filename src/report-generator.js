/* ===== 原点智学 Report Generator v1 ===== */
/* 分享卡生成模块 - 使用html2canvas生成可分享的诊断卡片 */

(function () {
    'use strict';

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, function (char) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
        });
    }

    function normalizeList(value, fallback) {
        return Array.isArray(value) && value.length ? value : fallback;
    }

    function readLocalEvidence() {
        try {
            if (!window.LearningStore) return {};
            return {
                loop: window.LearningStore.buildLearningLoopSnapshot ? window.LearningStore.buildLearningLoopSnapshot() : null,
                timeline: window.LearningStore.buildLearningEvidenceTimeline ? window.LearningStore.buildLearningEvidenceTimeline({ limit: 4 }) : null
            };
        } catch (e) {
            return {};
        }
    }

    function buildParentDecisionShareData(data) {
        var parentDecisionBook = data.parentDecisionBook || data.reportDraft && data.reportDraft.parentDecisionBook || {};
        var releaseGate = data.reportEvidenceReleaseGate || data.reportDraft && data.reportDraft.reportEvidenceReleaseGate || {};
        var gameReturnEvidence = data.gameReturnEvidence || data.reportDraft && data.reportDraft.gameReturnEvidence || {};
        var sharePolicy = parentDecisionBook.sharePolicy || {};
        var safeHandoff = releaseGate.homeSchoolSafeHandoff || {};
        var blockedFields = normalizeList(sharePolicy.blockedFields || safeHandoff.blockedFields || gameReturnEvidence.blockedFields, [
            'original_question',
            'original_stem_photo',
            'full_answer',
            'full_solution',
            'full_dialogue',
            'score',
            'ranking'
        ]);
        var allowedFields = normalizeList(sharePolicy.allowedFields || safeHandoff.allowedFields || gameReturnEvidence.allowedFields, [
            'tonight_action',
            'parent_question',
            'next_day_revisit_status',
            'return_window'
        ]);
        var routeActions = normalizeList(parentDecisionBook.routeActions, []);
        var nextEvidence = normalizeList(parentDecisionBook.nextEvidenceQueue || data.nextEvidenceQueue, []);
        var steps = routeActions.length
            ? routeActions.map(function (item) { return item.label || item.id || item.evidence; })
            : normalizeList(data.steps || data.plan, [
                parentDecisionBook.oneSentenceDecision || data.firstStep || '',
                parentDecisionBook.tomorrowCheck || gameReturnEvidence.releaseGate || '',
                nextEvidence[0] && (nextEvidence[0].label || nextEvidence[0].id) || ''
            ]).filter(Boolean);
        return {
            subtitle: data.subtitle || parentDecisionBook.oneSentenceDecision || releaseGate.summary || gameReturnEvidence.releaseGate || '',
            evidenceLine: data.evidenceLine || parentDecisionBook.whyNow || releaseGate.portraitNextEvidenceAction || '',
            steps: steps,
            boundary: data.boundary || '只分享行动、证据缺口和回访窗口；不分享原题、答案、照片、分数、排名或完整对话。',
            blockedFields: blockedFields,
            allowedFields: allowedFields,
            metrics: normalizeList(data.metrics, [
                { label: '可分享', value: allowedFields.length },
                { label: '已屏蔽', value: blockedFields.length },
                { label: '回访', value: gameReturnEvidence.nextDayCardIds && gameReturnEvidence.nextDayCardIds.length ? '已定' : '待定' }
            ])
        };
    }

    function enrichReportData(data) {
        var safeData = data || {};
        var evidence = readLocalEvidence();
        var loop = evidence.loop;
        var timeline = evidence.timeline;
        var counts = loop && loop.counts ? loop.counts : {};
        var parentDecisionShare = buildParentDecisionShareData(safeData);
        return Object.assign({}, safeData, {
            subtitle: parentDecisionShare.subtitle || (timeline && timeline.parentSummary) || (loop && loop.parentLine) || '',
            evidenceLine: parentDecisionShare.evidenceLine || (timeline && timeline.shareLine) || (loop && loop.shareLine) || '',
            metrics: normalizeList(parentDecisionShare.metrics, [
                { label: '计划', value: counts.plans || safeData.taskCount || 0 },
                { label: '练习', value: counts.practice || safeData.reviewed || 0 },
                { label: '错题', value: counts.dueErrors || 0 }
            ]),
            steps: normalizeList(parentDecisionShare.steps || safeData.steps || safeData.plan, timeline && timeline.ready
                ? timeline.items.map(function (item) { return item.title + '：' + item.detail; })
                : []),
            boundary: parentDecisionShare.boundary || safeData.boundary,
            blockedFields: parentDecisionShare.blockedFields,
            allowedFields: parentDecisionShare.allowedFields
        });
    }

    function renderSimpleShareCard(kind, data, callback) {
        if (!window.html2canvas) {
            console.error('html2canvas is not loaded');
            callback(null);
            return;
        }

        var safeData = enrichReportData(data);
        var container = document.createElement('div');
        container.style.cssText = 'position:fixed;left:-9999px;top:0;width:750px;';
        document.body.appendChild(container);

        var isProgress = kind === 'progress';
        var title = safeData.title || (isProgress ? '学习复盘卡' : '今晚行动卡');
        var subtitle = safeData.subtitle || (isProgress
            ? '把真实练习证据接到下一步行动。'
            : '把目标、练习、回访和家长追问连成一条线。');
        var metrics = normalizeList(safeData.metrics, isProgress
            ? [
                { label: '连续', value: safeData.streak || 0 },
                { label: '回访', value: safeData.reviewed || 0 },
                { label: '下一步', value: safeData.nextAction ? '已定' : '待定' }
            ]
            : [
                { label: '任务', value: safeData.taskCount || 0 },
                { label: '分钟', value: safeData.minutes || 15 },
                { label: '回看', value: safeData.checkpoints || 1 }
            ]);
        var steps = normalizeList(safeData.steps || safeData.plan, isProgress
            ? [
                safeData.recentWin || '记录孩子已经完成的一个具体动作。',
                safeData.nextAction || '明天回看一张卡，并说出第一步。',
                safeData.parentPrompt || '家长只问：下次你先看哪里？'
            ]
            : [
                safeData.firstStep || '说清今晚第一步。',
                safeData.practiceStep || '完成一轮短练习。',
                safeData.reviewStep || '收尾前留一句复盘。'
            ]);
        var accent = isProgress ? '#2D9F6F' : '#E94D35';

        container.innerHTML = `
            <div style="
                width:750px;
                min-height:980px;
                background:#FAFAF7;
                padding:56px 48px;
                font-family:'Noto Sans SC', system-ui, sans-serif;
                color:#18181B;
                box-sizing:border-box;
            ">
                <div style="display:flex;align-items:center;gap:14px;margin-bottom:34px;">
                    <div style="width:46px;height:46px;border-radius:50%;background:${accent};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;">Y</div>
                    <div>
                        <div style="font-size:30px;font-weight:900;">原点智学</div>
                        <div style="font-size:18px;color:#71717A;margin-top:4px;">家庭学习行动卡</div>
                    </div>
                </div>
                <div style="background:#fff;border:1px solid #E4E4E7;border-radius:22px;padding:38px;box-shadow:0 18px 50px rgba(24,24,27,.08);">
                    <div style="font-size:42px;font-weight:900;line-height:1.25;margin-bottom:16px;">${escapeHtml(title)}</div>
                    <div style="font-size:22px;color:#3F3F46;line-height:1.65;">${escapeHtml(subtitle)}</div>
                    ${safeData.evidenceLine ? '<div style="margin-top:18px;font-size:20px;color:' + accent + ';font-weight:900;line-height:1.55;">' + escapeHtml(safeData.evidenceLine) + '</div>' : ''}
                    <div style="display:flex;gap:14px;margin:34px 0;">
                        ${metrics.slice(0, 3).map(function (item) {
                            return '<div style="flex:1;background:#FFF7ED;border-radius:16px;padding:20px 12px;text-align:center;">'
                                + '<div style="font-size:34px;font-weight:900;color:' + accent + ';">' + escapeHtml(item.value) + '</div>'
                                + '<div style="font-size:16px;color:#71717A;margin-top:6px;">' + escapeHtml(item.label) + '</div>'
                                + '</div>';
                        }).join('')}
                    </div>
                    <div style="font-size:24px;font-weight:800;margin-bottom:18px;">下一步</div>
                    ${steps.slice(0, 4).map(function (step, index) {
                        return '<div style="display:flex;gap:14px;align-items:flex-start;margin:16px 0;">'
                            + '<div style="width:30px;height:30px;border-radius:50%;background:' + accent + ';color:#fff;font-size:16px;font-weight:900;display:flex;align-items:center;justify-content:center;flex:0 0 30px;">' + (index + 1) + '</div>'
                            + '<div style="font-size:22px;color:#27272A;line-height:1.55;">' + escapeHtml(step) + '</div>'
                            + '</div>';
                    }).join('')}
                </div>
                <div style="margin-top:28px;padding:24px 28px;border-left:5px solid ${accent};background:#fff;border-radius:14px;color:#3F3F46;font-size:20px;line-height:1.7;">
                    ${escapeHtml(safeData.boundary || '这张卡只记录学习建议和回访动作，不替代老师判断，也不代写作业。')}
                </div>
                ${safeData.blockedFields && safeData.blockedFields.length ? '<div style="margin-top:16px;color:#71717A;font-size:16px;line-height:1.6;">已屏蔽：' + escapeHtml(safeData.blockedFields.slice(0, 6).join(' / ')) + '</div>' : ''}
                <div style="margin-top:34px;text-align:center;font-size:20px;color:#71717A;">yuandianzhixue.com</div>
            </div>
        `;

        setTimeout(function () {
            html2canvas(container.firstElementChild, {
                scale: 2,
                backgroundColor: null,
                logging: false,
                useCORS: true
            }).then(function (canvas) {
                document.body.removeChild(container);
                callback(canvas);
            }).catch(function (err) {
                console.error('Failed to generate share card', err);
                document.body.removeChild(container);
                callback(null);
            });
        }, 100);
    }

    var ReportGenerator = {
        /**
         * 生成考试诊断分享卡
         * @param {Object} data - { grade, subject, score, totalScore, dimensions: [{name, score}] }
         * @param {Function} callback - (canvas) => {}
         */
        generateDiagnosisCard: function (data, callback) {
            if (!window.html2canvas) {
                console.error('html2canvas未加载');
                callback(null);
                return;
            }

            // 创建临时DOM
            var container = document.createElement('div');
            container.style.cssText = 'position:fixed;left:-9999px;top:0;width:750px;';
            document.body.appendChild(container);

            // 计算成绩百分比和等级
            var percentage = Math.round((data.score / data.totalScore) * 100);
            var gradeLevel = percentage >= 90 ? '优秀' : percentage >= 80 ? '良好' : percentage >= 60 ? '及格' : '待提升';
            var gradeLevelColor = percentage >= 90 ? '#2D9F6F' : percentage >= 80 ? '#D4A843' : percentage >= 60 ? '#E94D35' : '#C94040';

            // 选取前5个维度展示
            var topDimensions = data.dimensions.slice(0, 5);

            // 渲染分享卡HTML
            container.innerHTML = `
                <div style="
                    width: 750px;
                    background: linear-gradient(135deg, #1A1A2E 0%, #0F3460 100%);
                    padding: 60px 50px;
                    font-family: 'Noto Sans SC', sans-serif;
                    color: #F5F0EB;
                    box-sizing: border-box;
                ">
                    <!-- Header -->
                    <div style="text-align: center; margin-bottom: 50px;">
                        <div style="
                            font-size: 48px;
                            font-weight: 900;
                            font-family: 'Noto Serif SC', serif;
                            margin-bottom: 15px;
                            background: linear-gradient(135deg, #E94D35, #FF6B4A);
                            -webkit-background-clip: text;
                            -webkit-text-fill-color: transparent;
                            background-clip: text;
                        ">考试诊断报告</div>
                        <div style="color: #B8B0A8; font-size: 22px;">AI辅助分析 · 找到下一步复盘入口</div>
                    </div>

                    <!-- 成绩概览 -->
                    <div style="
                        background: rgba(22,33,62,0.8);
                        border: 2px solid rgba(233,77,53,0.3);
                        border-radius: 20px;
                        padding: 40px;
                        margin-bottom: 40px;
                        text-align: center;
                    ">
                        <div style="
                            font-size: 28px;
                            color: #B8B0A8;
                            margin-bottom: 20px;
                        ">${data.grade} · ${data.subject}</div>
                        <div style="
                            font-size: 96px;
                            font-weight: 900;
                            font-family: 'Noto Serif SC', serif;
                            line-height: 1;
                            margin-bottom: 15px;
                        ">
                            <span style="color: ${gradeLevelColor};">${data.score}</span>
                            <span style="font-size: 48px; color: #7A7067;">/${data.totalScore}</span>
                        </div>
                        <div style="
                            display: inline-block;
                            background: ${gradeLevelColor};
                            color: #fff;
                            padding: 8px 24px;
                            border-radius: 50px;
                            font-size: 24px;
                            font-weight: 700;
                        ">${gradeLevel} · ${percentage}%</div>
                    </div>

                    <!-- 维度分析 -->
                    <div style="
                        background: rgba(22,33,62,0.8);
                        border: 2px solid rgba(233,77,53,0.3);
                        border-radius: 20px;
                        padding: 40px;
                        margin-bottom: 40px;
                    ">
                        <div style="
                            font-size: 28px;
                            font-weight: 700;
                            margin-bottom: 30px;
                            text-align: center;
                            color: #E94D35;
                        ">核心能力诊断</div>
                        ${topDimensions.map(function (d) {
                            var barColor = d.score >= 80 ? '#2D9F6F' : d.score >= 60 ? '#D4A843' : '#C94040';
                            return `
                                <div style="margin-bottom: 25px;">
                                    <div style="
                                        display: flex;
                                        justify-content: space-between;
                                        align-items: center;
                                        margin-bottom: 10px;
                                    ">
                                        <span style="font-size: 22px; color: #F5F0EB;">${d.name}</span>
                                        <span style="
                                            font-size: 32px;
                                            font-weight: 900;
                                            font-family: 'Noto Serif SC', serif;
                                            color: ${barColor};
                                        ">${d.score}</span>
                                    </div>
                                    <div style="
                                        width: 100%;
                                        height: 12px;
                                        background: rgba(15,52,96,0.5);
                                        border-radius: 6px;
                                        overflow: hidden;
                                    ">
                                        <div style="
                                            width: ${d.score}%;
                                            height: 100%;
                                            background: ${barColor};
                                            border-radius: 6px;
                                        "></div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>

                    <!-- Footer -->
                    <div style="
                        text-align: center;
                        padding-top: 30px;
                        border-top: 1px solid rgba(15,52,96,0.5);
                    ">
                        <div style="
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 15px;
                            margin-bottom: 15px;
                        ">
                            <div style="
                                width: 48px;
                                height: 48px;
                                border-radius: 50%;
                                background: #E94D35;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                font-size: 28px;
                            ">◉</div>
                            <div style="
                                font-size: 32px;
                                font-weight: 900;
                                font-family: 'Noto Serif SC', serif;
                            ">原点智学</div>
                        </div>
                        <div style="
                            font-size: 20px;
                            color: #B8B0A8;
                        ">家庭学习复盘 · 先看证据，再定下一步</div>
                        <div style="
                            font-size: 18px;
                            color: #7A7067;
                            margin-top: 10px;
                        ">yuandianzhixue.com/tools/exam-diagnosis</div>
                    </div>
                </div>
            `;

            // 使用html2canvas生成Canvas
            setTimeout(function () {
                html2canvas(container.firstElementChild, {
                    scale: 2,
                    backgroundColor: null,
                    logging: false,
                    useCORS: true
                }).then(function (canvas) {
                    // 移除临时DOM
                    document.body.removeChild(container);
                    callback(canvas);
                }).catch(function (err) {
                    console.error('生成分享卡失败', err);
                    document.body.removeChild(container);
                    callback(null);
                });
            }, 100);
        },

        /**
         * Generate a real study-plan share card.
         * @param {Object} data
         * @param {Function} callback
         */
        generateStudyPlanCard: function (data, callback) {
            renderSimpleShareCard('study_plan', data, callback);
        },

        /**
         * Generate a real progress follow-up share card.
         * @param {Object} data
         * @param {Function} callback
         */
        generateProgressCard: function (data, callback) {
            renderSimpleShareCard('progress', data, callback);
        }
    };

    // 导出到全局
    window.ReportGenerator = ReportGenerator;
})();
