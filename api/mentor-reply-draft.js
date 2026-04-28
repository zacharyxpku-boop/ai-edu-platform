// 原点智学 · /api/mentor-reply-draft · 学长侧 AI 草稿生成
//
// POST { escalation_id }
// → { ok, draft, source: 'llm', model_version, token_count }
//
// 用途：学长在 mentor.html 看 escalation 详情时点「AI 给一份草稿」。
// 后端拉 escalation 详情（student_message + context.dossier 学情档案）→ 调 DeepSeek 生成草稿。
// **草稿不替代学长**——预填到 textarea，学长 review + 改 + 发出。
//
// 设计哲学（PROMPT-SYSTEM-V2-MASTER §4 转交工单格式 + §0 元规则）：
//   1. 学长口吻 = 清北学长姐感（专业、克制、偶尔幽默），不是 AI 客服腔
//   2. 必须基于 dossier（mastery / weak_kps / mistake_top / cognitive_style / 兴趣锚点）
//   3. 100-300 字 · 太短没价值、太长学长懒改
//   4. 3 段结构：点破本质 → 一步具体示范 → 让学生自己接手的动作
//   5. 承认无能：草稿末尾可说「老师我也只见过几次这种情况」——学长不需要假装全能
//   6. 不卖鸡汤、不暗示升级、不贩卖焦虑

export const config = { runtime: 'edge' };

const DEEPSEEK_KEY = (typeof process !== 'undefined' && process.env)
    ? (process.env.DEEPSEEK_KEY || process.env.DEEPSEEK_API_KEY) : '';
const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';

const SUPABASE_URL = (typeof process !== 'undefined' && process.env)
    ? (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) : '';
const SUPABASE_SERVICE_KEY = (typeof process !== 'undefined' && process.env)
    ? process.env.SUPABASE_SERVICE_ROLE_KEY : '';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResp(obj, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store',
            ...extraHeaders,
        },
    });
}
function jerr(status, code, msg, extraHeaders = {}) {
    return jsonResp({ ok: false, error: code, message: msg }, status, extraHeaders);
}

async function pgFetch(path, opts = {}) {
    return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
        ...opts,
        headers: {
            ...(opts.headers || {}),
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
    });
}

const KIND_LABEL = {
    concept: '概念追问',
    emotion: '情绪挫败',
    streak_3_wrong: '同类题连错 3 道',
    planning: '长程规划',
    manual: '学生主动求助',
};

function buildSystemPrompt() {
    return [
        '你是原点智学「学长答疑助手」——给真人学长（清北在校生/毕业生）一份回复学生的**草稿**。',
        '',
        '═══ 你的定位（必须搞清楚）═══',
        '· 这份草稿**给学长 review 用，不是直接发给学生**',
        '· 学长会基于你的草稿微调 / 全删重写 / 直接发出——你只是减轻他打字负担',
        '· 因此用**学长口吻**写：清北学长姐感、专业、克制、偶尔幽默',
        '· **绝对禁止 AI 客服腔**：禁「亲」「哦~」「加油加油」「棒棒哒」「么么哒」「小可爱」',
        '· **绝对禁止 PPT 腔**：禁「本次目标」「综上所述」「请同学注意」',
        '· **绝对禁止 emoji 撒娇**：✨💪🌟⭐🎉 一律不用（功能性 → ↑↓ 可以）',
        '',
        '═══ 元规则（不可违反）═══',
        '1. 不贩卖焦虑、不卖鸡汤：禁「加油」「你能行」「相信自己」「你真棒」',
        '2. 不暗示升级：禁「需要更多帮助可以…」这种销售语境',
        '3. 不假装记忆系统外的事：你只能用注入的 dossier 数据，不要瞎编',
        '4. 不复述累计错题次数让学生焦虑（讲掌握度变化或修复进度，不讲「你错了 6 次」）',
        '5. 诚实大于讨好：学生没掌握就是没掌握，不糊弄式鼓励',
        '6. 承认无能 OK：草稿末尾可以说「老师我也就见过几次这种情况，咱再过一遍」——学长不用假装全能',
        '',
        '═══ 必须基于的数据 ═══',
        '· escalation.kind（触发器分类）',
        '· student_message（学生原话）',
        '· context.dossier（学情档案）：mentor_brief / cognitive_style / weak_kps / mistake_top / 兴趣锚点 / 7 天活跃度',
        '· context.recent_dialogues（如有，了解学生最近对话上下文）',
        '· 必须**至少引用一条** dossier 里的具体数据（例：「方程概念你这周从 26% 拉到 41%，本次卡的是去分母」），让学长看到草稿就知道你认真读档案了',
        '',
        '═══ 输出结构（3 段，100-300 字）═══',
        '段 1（≤ 50 字）：一句话点破学生卡的**本质**',
        '  · 不是重复 AI 已说过的话',
        '  · 不是泛泛「这个是难点」，是具体「你不是不会 X，是把 Y 当成 Z 了」',
        '  · 引用 dossier 的归因画像或最弱 KP 数据更佳',
        '',
        '段 2（≤ 150 字）：一步**具体示范**',
        '  · 数字 / 动作 / 红笔圈关键词等具象操作',
        '  · 不要只给抽象方法论（「要审题」是废话），要给**可执行的下一步**（「拿红笔把题目里的"至少"圈出来，再算」）',
        '  · 如果 dossier 显示学生认知风格（视觉/听觉/动觉），可对应调整示范方式',
        '',
        '段 3（≤ 60 字）：让学生**自己接手**的动作',
        '  · 例：「你按这个改一遍发我」/「再做一道同类题，3 分钟内出结果」/「明早讲给妈妈听一遍」',
        '  · **不要**说「需要更多帮助找我」这种销售话术',
        '  · 末尾可承认无能 + 邀请学生一起过一遍',
        '',
        '═══ 触发器分类对应口吻 ═══',
        '· concept（概念追问）：先肯定「这个问题问得好」，再用类比/物理图像讲底层原理',
        '· emotion（情绪挫败）：先停题、共情一句、不强推下一步——「停一下。这种感觉我懂」',
        '· streak_3_wrong（连错）：诚实说「你这一类卡了几次了，咱单独练一下这一招」',
        '· planning（长程规划）：给原则不给完整规划——具体 100 天怎么排让学生先讲他的想法',
        '· manual（主动求助）：直接面对问题，不绕弯',
        '',
        '═══ 输出格式 ═══',
        '直接输出草稿正文，**不要**任何前缀（不要「学长草稿：」「以下是建议：」），不要 markdown 标记，不要分点编号。',
        '直接以学长口吻写一段连贯文字，3 段之间用换行分隔即可。',
    ].join('\n');
}

function buildUserPrompt(esc) {
    const L = [];
    const dossier = esc.context?.dossier || {};
    const profile = dossier.profile || {};
    const stats = dossier.stats || {};
    const weak = dossier.weak_kps || [];
    const mistakes = dossier.mistake_top || [];
    const recent = dossier.recent_dialogues || [];

    L.push('═══ 本次转交工单 ═══');
    L.push(`触发器：${esc.kind}（${KIND_LABEL[esc.kind] || esc.kind}）`);
    L.push(`学生：${esc.students?.name || '同学'}（${esc.students?.grade || '年级未知'}）`);
    if (esc.topic_code) L.push(`涉及知识点：${esc.topic_code}`);
    L.push('');
    L.push('═══ 学生原话 ═══');
    L.push(esc.student_message || '（学生没写文字，可能是按钮触发）');
    L.push('');

    if (esc.ai_summary) {
        L.push('═══ AI 已尝试 / 总结 ═══');
        L.push(esc.ai_summary);
        L.push('');
    }

    L.push('═══ 学情档案（dossier · 必须用）═══');
    if (dossier.mentor_brief) {
        L.push(`【30 秒入戏】${dossier.mentor_brief}`);
    }
    if (profile.cognitive_style) {
        L.push(`【认知风格】${profile.cognitive_style}（置信 ${Math.round((profile.cognitive_style_confidence || 0) * 100)}%）`);
    }
    if (profile.dominant_emotion) {
        L.push(`【主导情绪】${profile.dominant_emotion}`);
    }
    if (profile.analogy_success_rate != null) {
        L.push(`【类比奏效率】${Math.round(profile.analogy_success_rate * 100)}%`);
    }
    if (profile.top_interests?.length) {
        L.push(`【兴趣锚点】${profile.top_interests.join(' / ')}`);
    }
    if (stats.total_attempts != null) {
        L.push(`【学习数据】总答题 ${stats.total_attempts} · 正确率 ${Math.round((stats.accuracy || 0) * 100)}% · 7 天活跃 ${stats.active_days_last_7 || 0}/7 天`);
    }
    if (weak.length) {
        L.push('【最弱 KP（按 mastery 升序）】');
        weak.slice(0, 3).forEach(k => {
            L.push(`  · ${k.name || k.code} · mastery ${Math.round((k.mastery || 0) * 100)}%`);
        });
    }
    if (mistakes.length) {
        L.push('【错题 Top】');
        mistakes.slice(0, 3).forEach(m => {
            const cause = m.sample_root_cause ? ` · ${String(m.sample_root_cause).slice(0, 60)}` : '';
            L.push(`  · ${m.label} · 错 ${m.count} 次${cause}`);
        });
    }
    if (recent.length) {
        L.push('【最近对话摘要】');
        recent.slice(0, 2).forEach((d, i) => {
            const summary = d.summary || d.last_message || JSON.stringify(d).slice(0, 80);
            L.push(`  ${i + 1}. ${String(summary).slice(0, 100)}`);
        });
    }
    L.push('');
    L.push('═══ 现在请生成草稿 ═══');
    L.push('按 system 里的 3 段结构（点破本质 / 一步示范 / 让学生接手的动作），100-300 字，学长口吻。');
    L.push('直接输出正文，不要任何前缀。');

    return L.join('\n');
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'content-type',
            },
        });
    }

    if (req.method !== 'POST') {
        return jerr(405, 'method_not_allowed', '只接 POST');
    }

    if (!DEEPSEEK_KEY) {
        return jerr(503, 'not_configured', 'LLM 暂未配置，请手写回复');
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return jerr(503, 'not_configured', 'SUPABASE env 未配');
    }

    let body;
    try {
        body = await req.json();
    } catch (e) {
        return jerr(400, 'bad_json', '请求体不是合法 JSON');
    }

    const escalation_id = (body?.escalation_id || '').trim();
    if (!escalation_id || !UUID_RE.test(escalation_id)) {
        return jerr(400, 'bad_id', 'escalation_id 必须是 UUID');
    }

    // 拉 escalation 详情（含 dossier）
    let esc;
    try {
        const r = await pgFetch(`/escalations?id=eq.${escalation_id}&select=*,students(name,grade,id)&limit=1`);
        if (!r.ok) {
            return jerr(502, 'pg_fetch_failed', `Supabase ${r.status}`);
        }
        const arr = await r.json();
        if (!Array.isArray(arr) || !arr.length) {
            return jerr(404, 'not_found', '该 escalation 不存在');
        }
        esc = arr[0];
    } catch (e) {
        return jerr(502, 'pg_network', e.message);
    }

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(esc);

    let r;
    try {
        r = await fetch(DEEPSEEK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + DEEPSEEK_KEY,
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.4,  // 略有变化但不离谱
                max_tokens: 600,
            }),
        });
    } catch (e) {
        return jerr(502, 'upstream_unreachable', `DeepSeek 不可达：${e.message}`, {
            'X-Draft-Engine': 'deepseek-chat',
        });
    }

    if (!r.ok) {
        const detail = await r.text().catch(() => '');
        return jerr(502, 'upstream_error', `DeepSeek ${r.status}: ${detail.slice(0, 200)}`, {
            'X-Draft-Engine': 'deepseek-chat',
        });
    }

    const data = await r.json();
    const draft = (data?.choices?.[0]?.message?.content || '').trim();
    const tokenCount = data?.usage?.total_tokens || 0;

    if (!draft) {
        return jerr(502, 'empty_draft', '生成的草稿为空，请手写或重试', {
            'X-Draft-Engine': 'deepseek-chat',
        });
    }

    return jsonResp({
        ok: true,
        draft,
        source: 'llm',
        model_version: 'deepseek-chat',
        token_count: tokenCount,
        meta: {
            escalation_id,
            kind: esc.kind,
            has_dossier: !!esc.context?.dossier,
        },
    }, 200, {
        'X-Draft-Engine': 'deepseek-chat',
        'X-Draft-Tokens': String(tokenCount),
    });
}
