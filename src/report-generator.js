/* ===== 原点智学 Report Generator v1 ===== */
/* 分享卡生成模块 - 使用html2canvas生成可分享的诊断卡片 */

(function () {
    'use strict';

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
                        <div style="color: #B8B0A8; font-size: 22px;">AI精准分析 · 找到提分突破口</div>
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
                        ">AI提分教练 · 让每个孩子站在更高的出发点</div>
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
         * 生成学习计划分享卡（预留）
         * @param {Object} data
         * @param {Function} callback
         */
        generateStudyPlanCard: function (data, callback) {
            // TODO: 实现学习计划分享卡
            console.log('学习计划分享卡功能待实现');
            callback(null);
        },

        /**
         * 生成进步追踪分享卡（预留）
         * @param {Object} data
         * @param {Function} callback
         */
        generateProgressCard: function (data, callback) {
            // TODO: 实现进步追踪分享卡
            console.log('进步追踪分享卡功能待实现');
            callback(null);
        }
    };

    // 导出到全局
    window.ReportGenerator = ReportGenerator;
})();
