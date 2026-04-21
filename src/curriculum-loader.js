/* ===== 原点智学 Curriculum Loader v1 ===== */
/* 把 ChinaTextbook 教材结构注入到各工具的 system prompt */
/* 用法:
 *   const ctx = await YdzxCurriculum.getContext({stage:'初中', grade:'七年级', subject:'数学', edition:'人教版'});
 *   const prompt = `你是${ctx.header}。本学期教材目录：\n${ctx.tocText}\n...`;
 */

(function () {
    'use strict';

    let indexCache = null;
    let loadingPromise = null;

    async function loadIndex() {
        if (indexCache) return indexCache;
        if (loadingPromise) return loadingPromise;
        loadingPromise = fetch('/src/curriculum/textbook-index.json')
            .then(r => r.ok ? r.json() : Promise.reject(new Error('教材索引加载失败 '+r.status)))
            .then(d => { indexCache = d; return d; })
            .catch(e => { loadingPromise = null; throw e; });
        return loadingPromise;
    }

    /**
     * 根据学段/年级/科目/版本查找教材条目
     * 返回 { header, tocText, book, found }
     */
    async function getContext({ stage, grade, subject, edition } = {}) {
        try {
            const index = await loadIndex();
            const header = [stage, grade, subject, edition].filter(Boolean).join(' ');

            if (!stage || !subject) {
                return { header: header || '老师', tocText: '', book: null, found: false };
            }

            const stageNode = index[stage];
            if (!stageNode) return { header, tocText: '', book: null, found: false };

            const subjNode = stageNode[subject];
            if (!subjNode) return { header, tocText: '', book: null, found: false };

            // 匹配版本（模糊）
            let editionKey = edition;
            if (editionKey && !subjNode[editionKey]) {
                editionKey = Object.keys(subjNode).find(k => k.includes(edition) || edition.includes(k));
            }
            if (!editionKey) editionKey = Object.keys(subjNode)[0];
            const editionNode = subjNode[editionKey];
            if (!editionNode) return { header, tocText: '', book: null, found: false };

            // 小学/初中: grades[年级] -> {上册,下册}
            // 高中: books[必修第一册]
            let bookRefs = [];
            if (editionNode.grades && grade) {
                const g = editionNode.grades[grade] || Object.values(editionNode.grades)[0];
                if (g) {
                    bookRefs = Object.entries(g).map(([vol, b]) => ({ vol, ...b }));
                }
            } else if (editionNode.books) {
                bookRefs = Object.entries(editionNode.books).map(([name, b]) => ({ vol: name, ...b }));
            }

            // TOC 目前只有书名+GitHub URL；深度目录需 PDF 解析，留给后端补
            const tocText = bookRefs.length
                ? bookRefs.map(b => `- ${b.title || b.vol}`).join('\n')
                : '';

            return {
                header: header + '老师',
                tocText,
                book: bookRefs[0] || null,
                allBooks: bookRefs,
                editionKey,
                found: bookRefs.length > 0
            };
        } catch (e) {
            console.warn('[curriculum] getContext failed', e);
            return { header: [stage, grade, subject, edition].filter(Boolean).join(' ') || '老师',
                     tocText: '', book: null, found: false, error: e.message };
        }
    }

    /**
     * 构造可注入的 system prompt 片段（通用版）
     */
    function buildSystemContext(ctx, taskDesc = '') {
        const parts = [];
        parts.push(`你是${ctx.header}。`);
        if (ctx.tocText) {
            parts.push(`本学期教材包含以下册:\n${ctx.tocText}`);
            parts.push(`请把回答严格限定在该教材大纲范围内。`);
        }
        if (taskDesc) parts.push(taskDesc);
        return parts.join('\n\n');
    }

    /** 获取所有已收录学段 */
    async function listStages() {
        const i = await loadIndex();
        return Object.keys(i);
    }

    async function listSubjects(stage) {
        const i = await loadIndex();
        return Object.keys(i[stage] || {});
    }

    async function listEditions(stage, subject) {
        const i = await loadIndex();
        return Object.keys((i[stage] || {})[subject] || {});
    }

    async function listGrades(stage, subject, edition) {
        const i = await loadIndex();
        const node = ((i[stage] || {})[subject] || {})[edition];
        if (!node) return [];
        if (node.grades) return Object.keys(node.grades);
        if (node.books) return Object.keys(node.books);
        return [];
    }

    window.YdzxCurriculum = {
        getContext,
        buildSystemContext,
        listStages,
        listSubjects,
        listEditions,
        listGrades,
        _loadIndex: loadIndex
    };
})();
