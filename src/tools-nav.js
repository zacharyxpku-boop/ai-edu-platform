// 工具页面统一导航配置
const TOOLS_CONFIG = {
    '诊断区': [
        { name: '考试诊断', file: 'exam-diagnosis.html', icon: '📊' }
    ],
    '攻克区': [
        { name: '错题举一反三', file: 'error-mastery.html', icon: '🔍' },
        { name: '错题练习生成', file: 'error-practice.html', icon: '📝' },
        { name: '考卷生成器', file: 'exam-generator.html', icon: '📄' },
        { name: '学习计划', file: 'study-plan.html', icon: '📅' }
    ],
    '思维区': [
        { name: '费曼验证', file: 'feynman-verify.html', icon: '🎓' },
        { name: '知识讲解', file: 'knowledge-explain.html', icon: '💡' },
        { name: '知识可视化', file: 'knowledge-visual.html', icon: '🗺️' }
    ],
    '素养区': [
        { name: '作文打分', file: 'essay-grading.html', icon: '✍️' },
        { name: '阅读理解改写', file: 'reading-rewriter.html', icon: '📖' },
        { name: '音乐欣赏', file: 'music-appreciation.html', icon: '🎵' },
        { name: '美术思维引导', file: 'art-thinking.html', icon: '🎨' },
        { name: '大题得分点拆解', file: 'scoring-breakdown.html', icon: '🎯' }
    ],
    '成长区': [
        { name: '学习档案', file: 'learning-profile.html', icon: '📊' },
        { name: '笔记增强器', file: 'note-enhancer.html', icon: '📔' }
    ]
};

// 初始化工具页面导航
function initToolsNav(currentToolFile) {
    // 记录使用日志到localStorage
    recordUsage(currentToolFile);

    // 生成底部快捷导航
    renderQuickNav(currentToolFile);
}

// 记录工具使用日志
function recordUsage(toolFile) {
    try {
        const logs = JSON.parse(localStorage.getItem('yuandian_usage_logs') || '[]');

        logs.push({
            tool: toolFile,
            timestamp: new Date().toISOString()
        });

        // 只保留最近1000条记录
        if (logs.length > 1000) {
            logs.splice(0, logs.length - 1000);
        }

        localStorage.setItem('yuandian_usage_logs', JSON.stringify(logs));
    } catch (e) {
        console.error('记录使用日志失败:', e);
    }
}

// 渲染底部快捷导航
function renderQuickNav(currentToolFile) {
    // 找到当前工具所属的分区
    let currentCategory = null;
    let currentToolIndex = -1;

    for (const [category, tools] of Object.entries(TOOLS_CONFIG)) {
        const index = tools.findIndex(t => t.file === currentToolFile);
        if (index !== -1) {
            currentCategory = category;
            currentToolIndex = index;
            break;
        }
    }

    if (!currentCategory) return;

    const tools = TOOLS_CONFIG[currentCategory];
    const quickNavEl = document.getElementById('quick-nav');

    if (!quickNavEl) return;

    let html = `<h3 class="quick-nav-title">${currentCategory}的其他工具</h3><div class="quick-nav-list">`;

    tools.forEach((tool, idx) => {
        if (tool.file !== currentToolFile) {
            html += `
                <a href="${tool.file}" class="quick-nav-item">
                    <span class="quick-nav-icon">${tool.icon}</span>
                    <span class="quick-nav-name">${tool.name}</span>
                </a>
            `;
        }
    });

    html += '</div>';
    quickNavEl.innerHTML = html;
}
