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
        { name: '美术思维引导', file: 'art-thinking.html', icon: '🎨' }
    ],
    '成长区': [
        { name: '学习档案', file: 'learning-profile.html', icon: '📊' },
        { name: '笔记增强器', file: 'note-enhancer.html', icon: '📔' },
        { name: '教材浏览器', file: 'textbook-browser.html', icon: '📚' },
        { name: '知识游乐场', file: 'knowledge-arcade.html', icon: '🎮' },
        { name: '全球工具精选', file: 'global-picks.html', icon: '🌐' }
    ]
};

// 初始化工具页面导航
function initToolsNav(currentToolFile) {
    // 记录使用日志到localStorage
    recordUsage(currentToolFile);

    // 生成底部快捷导航
    renderQuickNav(currentToolFile);
    renderLearningLoopDock(currentToolFile);
    bindLearningLoopDockRefresh(currentToolFile);
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

// 多个工具页已有 hamburger onclick，这里补齐统一的移动菜单函数。
// 这里集中注入一个轻量移动菜单，避免每个工具页各自复制。
function bindLearningLoopDockRefresh(currentToolFile) {
    if (window.__ydzxToolLoopDockBound) return;
    window.__ydzxToolLoopDockBound = true;
    window.addEventListener('ydzx:learning-store-updated', function () {
        renderLearningLoopDock(currentToolFile);
    });
}

function renderLearningLoopDock(currentToolFile) {
    if (!window.LearningStore || !window.LearningStore.buildLearningLoopSnapshot) return;
    let snap = null;
    try {
        snap = window.LearningStore.buildLearningLoopSnapshot();
    } catch (e) {
        snap = null;
    }
    if (!snap || !snap.ready) return;
    const counts = snap.counts || {};
    if (!document.getElementById('tool-learning-loop-style')) {
        const css = document.createElement('style');
        css.id = 'tool-learning-loop-style';
        css.textContent = `
            .tool-loop-dock{margin:18px auto 0;max-width:960px;border:1px solid rgba(26,26,26,.10);background:#fff;border-radius:10px;padding:14px 16px;display:flex;align-items:center;gap:14px;justify-content:space-between;box-shadow:0 8px 24px rgba(26,26,26,.05)}
            .tool-loop-copy{min-width:0}
            .tool-loop-k{font-size:11px;color:#0F4F3D;font-weight:800;letter-spacing:.4px;text-transform:uppercase}
            .tool-loop-title{font-size:14px;color:#1A1A1A;font-weight:800;margin-top:2px;line-height:1.45}
            .tool-loop-sub{font-size:12px;color:#4A4A47;margin-top:3px;line-height:1.6}
            .tool-loop-actions{display:flex;gap:8px;flex-shrink:0}
            .tool-loop-actions a{font-size:12px;font-weight:800;text-decoration:none;border-radius:7px;padding:9px 11px;border:1px solid rgba(26,26,26,.12);color:#1A1A1A;background:#FAF7F0}
            .tool-loop-actions a.primary{background:#0F4F3D;color:#fff;border-color:#0F4F3D}
            @media(max-width:720px){.tool-loop-dock{align-items:flex-start;flex-direction:column}.tool-loop-actions{width:100%}.tool-loop-actions a{flex:1;text-align:center}}
        `;
        document.head.appendChild(css);
    }
    let dock = document.getElementById('tool-learning-loop-dock');
    if (!dock) {
        dock = document.createElement('div');
        dock.id = 'tool-learning-loop-dock';
        dock.className = 'tool-loop-dock';
    }
    dock.innerHTML = `
        <div class="tool-loop-copy">
            <div class="tool-loop-k">Learning loop</div>
            <div class="tool-loop-title">${escapeToolNavHtml(snap.nextAction || '接着完成今晚下一步')}</div>
            <div class="tool-loop-sub">${escapeToolNavHtml(snap.parentLine || snap.shareLine || '这次工具记录已经进入本地学习闭环。')} · 计划 ${counts.plans || 0} / 练习 ${counts.practice || 0} / 到期错题 ${counts.dueErrors || 0}</div>
        </div>
        <div class="tool-loop-actions">
            <a href="../progress.html" class="primary">看闭环</a>
            <a href="../study-tools.html">换工具</a>
        </div>
    `;
    if (!dock.parentNode) {
        const quickNavEl = document.getElementById('quick-nav');
        if (quickNavEl && quickNavEl.parentNode) {
            quickNavEl.parentNode.insertBefore(dock, quickNavEl);
        } else {
            document.body.appendChild(dock);
        }
    }
    try {
        const logs = JSON.parse(localStorage.getItem('yuandian_tool_loop_dock_logs') || '[]');
        logs.push({ tool: currentToolFile, timestamp: new Date().toISOString(), nextAction: snap.nextAction || '' });
        if (logs.length > 100) logs.splice(0, logs.length - 100);
        localStorage.setItem('yuandian_tool_loop_dock_logs', JSON.stringify(logs));
    } catch (e) {}
}

function escapeToolNavHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function (c) {
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
}

function ensureMobileNav() {
    if (document.getElementById('tools-mobile-nav')) return;
    const css = document.createElement('style');
    css.textContent = `
        .tools-mobile-nav-mask{position:fixed;inset:0;background:rgba(26,26,26,.42);z-index:999;display:none}
        .tools-mobile-nav-mask.show{display:block}
        .tools-mobile-nav-panel{position:fixed;top:0;right:0;width:min(84vw,360px);height:100dvh;background:#FAF7F0;border-left:1px solid rgba(26,26,26,.10);box-shadow:0 24px 60px rgba(26,26,26,.20);padding:18px;overflow:auto;transform:translateX(100%);transition:transform .18s ease-out}
        .tools-mobile-nav-mask.show .tools-mobile-nav-panel{transform:translateX(0)}
        .tmn-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
        .tmn-title{font-weight:800;color:#1A1A1A}
        .tmn-close{border:1px solid rgba(26,26,26,.12);background:#fff;border-radius:8px;padding:6px 10px;color:#4A4A47}
        .tmn-cat{font-size:12px;font-weight:800;color:#0F4F3D;margin:14px 0 6px}
        .tmn-link{display:flex;align-items:center;gap:9px;padding:9px 10px;border-radius:8px;color:#1A1A1A;text-decoration:none;font-size:14px}
        .tmn-link:hover,.tmn-link.active{background:#E8EFE9;color:#0F4F3D}
    `;
    document.head.appendChild(css);

    const mask = document.createElement('div');
    mask.id = 'tools-mobile-nav';
    mask.className = 'tools-mobile-nav-mask';
    let html = '<div class="tools-mobile-nav-panel" role="dialog" aria-label="工具导航"><div class="tmn-head"><div class="tmn-title">原点工具箱</div><button class="tmn-close" type="button">关闭</button></div>';
    const current = location.pathname.split('/').pop() || '';
    Object.entries(TOOLS_CONFIG).forEach(([cat, tools]) => {
        html += `<div class="tmn-cat">${cat}</div>`;
        tools.forEach(tool => {
            const active = tool.file === current ? ' active' : '';
            html += `<a class="tmn-link${active}" href="${tool.file}"><span>${tool.icon}</span><span>${tool.name}</span></a>`;
        });
    });
    html += '</div>';
    mask.innerHTML = html;
    document.body.appendChild(mask);
    mask.addEventListener('click', e => {
        if (e.target === mask || e.target.classList.contains('tmn-close')) {
            mask.classList.remove('show');
        }
    });
}

function toggleMobileNav() {
    ensureMobileNav();
    document.getElementById('tools-mobile-nav').classList.toggle('show');
}

window.toggleMobileNav = toggleMobileNav;
document.addEventListener('DOMContentLoaded', ensureMobileNav);
