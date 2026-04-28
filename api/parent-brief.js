// 原点智学 · /api/parent-brief
// GET ?student_id=<uuid>&period=morning|weekly&enrich=deterministic|llm
//
// 妈妈每天 30 秒看懂的 AI 简报。
// 顶层设计：docs/CHINESE-FAMILY-AI-MANAGER-V1.md 三角形「家长省心放心」
// 五段结构 · docs/PROMPT-SYSTEM-V2-MASTER.md §2 家长视角周报
//
// 两种模式（向后兼容，默认走 deterministic）：
//
// ① enrich 不传 / =deterministic（保持原行为）：
// {
//   ok: true,
//   period: 'morning' | 'weekly',
//   headline:    "昨晚 25 分钟 · 3 对 1 错 · 错的『移项变号』自己想出来了",
//   today_focus: "今天 16:00 该练『分式去分母』（FSRS 推算）",
//   parent_note: "昨晚 21:30 说想睡，今天别催太狠",
//   detailed: { ... },
// }
//
// ② enrich=llm（按 §2 五段结构 LLM 生成，仅 weekly 推荐使用）：
// {
//   ok: true,
//   period: '...',
//   enrich: 'llm',
//   headline: "小米这周把方程概念从 26% 拉到 41%，但去分母的步骤还是会跳。",
//   sections: {
//     progress_dashboard: "...",
//     error_attribution: "...",
//     parent_advice_dos: ["..."],
//     parent_advice_donts: ["..."],
//     next_week_focus: "..."
//   },
//   detailed: { ... }
// }
//
// 响应头 X-Brief-Engine: 'deterministic' | 'llm' | 'deterministic-fallback'
// LLM 失败 / DEEPSEEK 未配 → 自动 fallback 到 deterministic（不抛 503）
//
// 设计哲学：
//   1. deterministic 路径保证 demo 不抖，LLM 路径走五段结构提升可读性
//   2. LLM prompt 严格内容隔离（不允许出现学生原文/情绪细节/升级套餐）
//   3. 不卖焦虑、不威胁、不讨好——这是中国家长付费产品的底线

export const config = { runtime: 'edge' };

const SUPABASE_URL = (typeof process !== 'undefined' && process.env) ? (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) : '';
const SUPABASE_SERVICE_KEY = (typeof process !== 'undefined' && process.env) ? process.env.SUPABASE_SERVICE_ROLE_KEY : '';
const DEEPSEEK_KEY = (typeof process !== 'undefined' && process.env)
    ? (process.env.DEEPSEEK_KEY || process.env.DEEPSEEK_API_KEY) : '';
const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResp(obj, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'private, max-age=60',  // 1 分钟 cache（多人同时看不打库）
            'Access-Control-Allow-Origin': '*',
            ...extraHeaders,
        },
    });
}
function jsonErr(status, code, msg) {
    return jsonResp({ ok: false, error: code, message: msg }, status);
}

async function pgFetch(path) {
    return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
            'Accept': 'application/json',
        },
    });
}

function fmtMin(min) {
    if (min < 1) return '不到 1 分钟';
    if (min < 60) return `${Math.round(min)} 分钟`;
    return `${Math.round(min / 60 * 10) / 10} 小时`;
}

// 把对话时间戳数组算总活跃时长（连续 ≤5min gap 算同一段，>5min 切段累加）
function calcActiveMinutes(timestamps) {
    if (timestamps.length === 0) return 0;
    const sorted = timestamps.map(t => new Date(t).getTime()).sort((a, b) => a - b);
    let total = 0;
    let segStart = sorted[0];
    let segLast = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i] - segLast;
        if (gap <= 5 * 60 * 1000) {
            segLast = sorted[i];
        } else {
            total += (segLast - segStart);
            segStart = sorted[i];
            segLast = sorted[i];
        }
    }
    total += (segLast - segStart);
    return total / 60000;
}

function detectEmotionSignals(dialogues) {
    // 在最近 dialogues 里找 emotion_state ≥ 2 次焦虑/无力/否定 = 触发 parent_note
    const negEmotions = ['焦虑', '无力', '否定自我', '挫败', '想放弃'];
    const hits = dialogues.filter(d => {
        const e = d.meta?.signals?.emotion_state;
        return e && negEmotions.includes(e);
    });
    return { count: hits.length, examples: hits.slice(0, 2).map(h => h.content?.slice(0, 30)) };
}

function findLateNightSignals(dialogues) {
    // 检测是否有 21:30 之后的对话 + 「累 / 困 / 想睡」关键词
    const tired = ['累', '困', '想睡', '没精神', '不行了', '撑不住'];
    return dialogues.find(d => {
        const hour = new Date(d.created_at).getHours();
        if (hour < 21 && hour > 6) return false;
        const c = d.content || '';
        return tired.some(t => c.includes(t));
    });
}

function pickTodayFocus(weakKps) {
    if (!weakKps.length) return '今天还没有特别推荐的 KP，让孩子先做点错题复习';
    const due = weakKps.filter(k => k.next_review_at && new Date(k.next_review_at) <= new Date());
    const target = due[0] || weakKps[0];
    if (!target) return '让孩子先选一个想攻的方向';
    const name = target.knowledge_points?.name || target.code || '某知识点';
    const score = (target.mastery_score * 100).toFixed(0);
    return `今天 16:00 该练「${name}」（当前掌握 ${score}%）`;
}

function buildHeadline(period, attempts, dialogues, escalations) {
    const minutes = Math.round(calcActiveMinutes(dialogues.map(d => d.created_at)));
    const total = attempts.length;
    const correct = attempts.filter(a => a.is_correct).length;
    const wrong = total - correct;

    if (period === 'weekly') {
        if (total === 0) return `本周聊了 ${minutes} 分钟 · 还没真做题，建议下周开始练`;
        return `本周 ${minutes} 分钟 · ${correct} 对 ${wrong} 错 · ${escalations.length} 次找学长`;
    }

    // morning
    if (total === 0 && minutes < 1) return '昨晚没用 · 今天可以让他先做 5 分钟暖暖手';
    if (total === 0) return `昨晚聊了 ${minutes} 分钟 · 没做题但聊了思路`;

    // 找昨晚 attempts 里最有 narrative 价值的：从错到对
    const flips = attempts.filter(a => a.is_correct && a.scored_meta?.flipped_from_wrong);
    if (flips.length > 0) {
        const kpHint = flips[0].scored_meta?.kp_name || '某一步';
        return `昨晚 ${minutes} 分钟 · ${correct} 对 ${wrong} 错 · 错的「${kpHint}」自己想出来了`;
    }

    return `昨晚 ${minutes} 分钟 · ${correct} 对 ${wrong} 错`;
}

// ─────────────────────────────────────────────────────────
// 以下是 enrich=llm 模式专用：聚合 + LLM 生成 + 渲染
// ─────────────────────────────────────────────────────────

// 6 类家长可读归因 · l3_tag → 家长视角大类
// 与 mistake-graph.js L3_LABEL 兼容，但归并到家长可读的 6 类
const ATTRIBUTION_BUCKETS = {
    '概念性': ['knowledge'],
    '方法性': ['ability.equation_solving', 'ability.method'],
    '审题性': ['reading'],
    '计算性': ['ability.calculation'],
    '步骤跳跃': ['ability.skipped_step'],
    '粗心': ['careless'],
};

function bucketOfTag(tag) {
    if (!tag || typeof tag !== 'string') return null;
    for (const [bucket, prefixes] of Object.entries(ATTRIBUTION_BUCKETS)) {
        for (const p of prefixes) {
            if (tag === p || tag.startsWith(p + '.')) return bucket;
        }
    }
    // 兜底：l1 大类映射
    const l1 = tag.split('.')[0];
    if (l1 === 'knowledge') return '概念性';
    if (l1 === 'reading') return '审题性';
    if (l1 === 'careless') return '粗心';
    if (l1 === 'ability') return '方法性';
    if (l1 === 'metacog') return '方法性';
    return null;
}

function aggregateAttribution(attempts) {
    // 从 attempts.scored_meta.diagnose_l3 数组聚合到 6 类
    const counts = {};
    let totalTagged = 0;
    for (const a of attempts) {
        if (a.is_correct) continue;
        const tags = Array.isArray(a.scored_meta?.diagnose_l3) ? a.scored_meta.diagnose_l3 : [];
        for (const t of tags) {
            const b = bucketOfTag(t);
            if (!b) continue;
            counts[b] = (counts[b] || 0) + 1;
            totalTagged++;
        }
    }
    // 转占比 + 排序
    const distribution = Object.entries(counts)
        .map(([bucket, count]) => ({
            bucket,
            count,
            percent: totalTagged > 0 ? Math.round(count / totalTagged * 100) : 0,
        }))
        .sort((a, b) => b.count - a.count);
    return { total_tagged: totalTagged, distribution };
}

function countFatigueSignals(dialogues) {
    const negEmotions = ['焦虑', '无力', '否定自我', '挫败', '想放弃'];
    let count = 0;
    for (const d of dialogues) {
        const e = d.meta?.signals?.emotion_state;
        if (e && negEmotions.includes(e)) count++;
    }
    return count;
}

function tutorTopicsFromEscalations(escalations) {
    // 仅返回 kind 列表（脱敏，不暴露 student_message 原文 → 内容隔离 B 类）
    return Array.from(new Set(
        (escalations || []).map(e => e.kind).filter(Boolean)
    ));
}

function buildMasteryChanges(weakKps, attempts) {
    // 当没有历史 mastery 快照时（项目当前没有快照表），用启发式：
    // - 当前 mastery_score < 0.3 + 本周做过题 → 标注「本周新接触」
    // - 当前 mastery_score >= 0.3 → 标注当前值，无 delta
    // 未来如果加 mastery_snapshots 表，这里替换为真实 delta
    const kpHits = new Map();
    for (const a of attempts) {
        const kps = Array.isArray(a.knowledge_point_ids) ? a.knowledge_point_ids : [];
        for (const k of kps) kpHits.set(k, (kpHits.get(k) || 0) + 1);
    }
    return weakKps.slice(0, 6).map(s => {
        const code = s.knowledge_points?.code;
        const name = s.knowledge_points?.name || code || '某知识点';
        const cur = Math.round((s.mastery_score || 0) * 100);
        const isNew = cur < 30 && kpHits.has(code);
        return {
            name,
            code,
            current_percent: cur,
            is_new_this_week: isNew,
            attempts_this_week: kpHits.get(code) || 0,
        };
    });
}

// ─────────────────── LLM 五段结构 ───────────────────

function buildLLMSystemPrompt() {
    return `你是原点智学的家长周报撰写者。你不是销售文案，不是客服。

【元规则 · 必须遵守】
- 这条周报给中国家长看，他们已经付费。我们卖方法、卖进度、卖确定性，不卖焦虑、不卖恐慌、不威胁、不讨好。
- 不允许任何形式的"再不补就跟不上""您家孩子真棒""数学还是不行""差不多就行"等空话。
- 用百分比变化讲进步，不用累计错误数施压。
- 进步在前，进行中在后，不挂"退步清单"。

【内容隔离 · 严格禁止出现】
- 学生与 AI 的对话原文（一字不漏地保护）
- "孩子情绪低落""孩子说不想学了""孩子哭了"等情绪细节
- "建议升级套餐""开通 ___ 服务""更深度支持需要付费"等销售话术
- 威胁话术：再不补就跟不上 / 期末很难 / 落后同龄人
- 讨好话术：您家孩子真棒 / 天赋不错 / 一定能上重点
- "孩子粗心"这种无信息标签——必须翻译成具体行为（"漏看条件""看错关键词""抄错符号"）

【输出格式 · 严格 JSON】
返回的 JSON 必须满足以下 schema，不允许多余字段：
{
  "headline": "本周一句话总结，≤ 30 字。格式：[孩子名]这周[具体进展]，[具体问题]。必须有数字进展 + 一个具体问题。",
  "progress_dashboard": "多行字符串。第一行：本周练习 · N 次会话 · 共 N 分钟。然后两个小节：攻克的知识点（百分比变化 ↑）、还在啃的（当前百分比，本周新接触标注）。",
  "error_attribution": "多行字符串。先列错题归因占比（最高在前 + ← 主要问题），再写一段翻译（'翻译一下：[孩子名]不是不会，是______' 句式）。占比加起来要等于或近似 100%。",
  "parent_advice_dos": ["可以说的具体句子1（带括号说明用法）", "可以说的具体句子2", "可选第三句"],
  "parent_advice_donts": ["别说的具体句子1（带括号说明为什么）", "别说的具体句子2", "可选第三句"],
  "next_week_focus": "下周重点，≤ 25 字。格式：下周：[一个具体动作]。可加考试/节奏锚点。"
}

【五段每段写作要求】
1. headline：必须含数字（X% → Y% 或 X 次会话 N 分钟），必须有具体问题（不是"还需努力"）。
2. progress_dashboard：用 · 项目符号，百分比变化用 → 和 ↑，本周新接触的 KP 标注（本周新接触）。
3. error_attribution：归因数据来自传入的 attribution_distribution 字段，按占比降序，最高的标 ← 主要问题。翻译句必须给出具体行为，禁止"粗心""不仔细"无信息词。如果总错题数为 0，归因段写"本周没出现需要重点关注的错题模式"。
4. parent_advice_dos / donts：每条 2-3 句，dos 用引号包真句子 + 括号说明（让孩子自述方法 / 锚定具体动作）；donts 写错误句子 + 括号说明（为什么这样说会反效果）。
5. next_week_focus：动作具体（盯去分母漏乘 / 切换考前突击模式），不写"继续努力""加油"。`;
}

function buildLLMUserMessage(ctx) {
    // ctx 是结构化的本周数据，让 LLM 按结构填，不让 LLM 自由发挥
    const lines = [];
    lines.push(`# 本周数据（${ctx.period === 'weekly' ? '过去 7 天' : '昨晚至今'}）`);
    lines.push(`孩子名字：${ctx.student_name}`);
    lines.push(`本周会话次数：${ctx.session_count}`);
    lines.push(`本周累计学习分钟：${ctx.active_minutes}`);
    lines.push(`本周做题数：${ctx.attempts_total}（其中对 ${ctx.attempts_correct}，错 ${ctx.attempts_wrong}）`);
    lines.push(`正确率：${ctx.correct_rate}%`);
    lines.push('');
    lines.push('## 知识点进展（mastery）');
    if (ctx.mastery_changes.length === 0) {
        lines.push('（本周无重点知识点变化）');
    } else {
        for (const m of ctx.mastery_changes) {
            const tag = m.is_new_this_week ? '（本周新接触）' : '';
            lines.push(`- ${m.name}：当前 ${m.current_percent}%${tag}，本周练习 ${m.attempts_this_week} 次`);
        }
    }
    lines.push('');
    lines.push('## 错题归因分布（按 6 类聚合占比）');
    lines.push(`本周错题总数：${ctx.attempts_wrong}`);
    if (ctx.attribution.distribution.length === 0) {
        lines.push('（本周没有归因数据 / 没有错题）');
    } else {
        for (const d of ctx.attribution.distribution) {
            lines.push(`- ${d.bucket}错误：占 ${d.percent}%（${d.count} 次）`);
        }
    }
    lines.push('');
    lines.push('## 转交学长情况');
    if (ctx.tutor_topics.length === 0) {
        lines.push('本周无转交');
    } else {
        lines.push(`本周转交 ${ctx.escalations_count} 次，主题类型：${ctx.tutor_topics.join('、')}`);
    }
    lines.push('');
    lines.push('## 疲态信号统计（不暴露原文，只给计数）');
    lines.push(`本周累计 ${ctx.fatigue_count} 次（焦虑/无力/否定/挫败/想放弃）`);
    lines.push('');
    lines.push('## 任务');
    lines.push(`按 system 中的五段结构 + JSON schema 生成${ctx.period === 'weekly' ? '本周' : '今日'}周报。`);
    lines.push('归因翻译要给出具体行为（如"漏看条件""看错关键词""去分母漏乘"），禁止"粗心""不仔细"。');
    lines.push('如果 mastery_changes 全部 < 30%，headline 不要写"进步明显"，要写"开始接触" + 一个具体问题。');
    return lines.join('\n');
}

async function callLLMForBrief(ctx, timeoutMs = 25000) {
    if (!DEEPSEEK_KEY) {
        return { ok: false, reason: 'no_key' };
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const r = await fetch(DEEPSEEK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + DEEPSEEK_KEY,
            },
            signal: ctrl.signal,
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: buildLLMSystemPrompt() },
                    { role: 'user', content: buildLLMUserMessage(ctx) },
                ],
                temperature: 0.3,
                max_tokens: 1400,
                response_format: { type: 'json_object' },
                stream: false,
            }),
        });
        clearTimeout(timer);
        if (!r.ok) {
            const detail = await r.text().catch(() => '');
            return { ok: false, reason: `upstream_${r.status}`, detail: detail.slice(0, 200) };
        }
        const data = await r.json();
        const raw = data?.choices?.[0]?.message?.content || '';
        let parsed;
        try { parsed = JSON.parse(raw); }
        catch (e) { return { ok: false, reason: 'parse_error', detail: raw.slice(0, 200) }; }

        // schema 校验：5 段必须全有
        const required = ['headline', 'progress_dashboard', 'error_attribution',
            'parent_advice_dos', 'parent_advice_donts', 'next_week_focus'];
        for (const k of required) {
            if (parsed[k] === undefined || parsed[k] === null || parsed[k] === '') {
                return { ok: false, reason: `missing_${k}`, detail: raw.slice(0, 200) };
            }
        }
        if (!Array.isArray(parsed.parent_advice_dos) || !Array.isArray(parsed.parent_advice_donts)) {
            return { ok: false, reason: 'advice_not_array' };
        }
        return { ok: true, data: parsed };
    } catch (e) {
        clearTimeout(timer);
        return { ok: false, reason: 'network_error', detail: e?.message || String(e) };
    }
}

async function fetchStudentName(studentId) {
    // 只为 LLM 个性化称呼用 · 失败用「孩子」兜底
    try {
        const r = await pgFetch(`/students?id=eq.${studentId}&select=name,nickname&limit=1`);
        if (!r.ok) return '孩子';
        const rows = await r.json();
        if (!Array.isArray(rows) || !rows.length) return '孩子';
        return rows[0].nickname || rows[0].name || '孩子';
    } catch (e) {
        return '孩子';
    }
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'content-type',
            },
        });
    }
    if (req.method !== 'GET') return jsonErr(405, 'method_not_allowed', 'GET only');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return jsonErr(503, 'not_configured', 'SUPABASE env not set');

    const url = new URL(req.url);
    const studentId = (url.searchParams.get('student_id') || '').trim().toLowerCase();
    const period = url.searchParams.get('period') === 'weekly' ? 'weekly' : 'morning';
    const enrichRaw = (url.searchParams.get('enrich') || '').trim().toLowerCase();
    const enrich = enrichRaw === 'llm' ? 'llm' : 'deterministic';
    if (!UUID_RE.test(studentId)) return jsonErr(400, 'bad_student_id', 'student_id 必须是 UUID');

    const days = period === 'weekly' ? 7 : 1;
    const sinceIso = new Date(Date.now() - days * 86400 * 1000).toISOString();

    // 并行拉 dialogues / attempts / escalations / weak KPs
    const [dialoguesRes, attemptsRes, escalationsRes, statesRes] = await Promise.all([
        pgFetch(`/dialogues?student_id=eq.${studentId}&created_at=gte.${encodeURIComponent(sinceIso)}&select=role,content,kind,created_at,meta&order=created_at.desc&limit=200`),
        pgFetch(`/attempts?student_id=eq.${studentId}&submitted_at=gte.${encodeURIComponent(sinceIso)}&select=is_correct,response,time_spent_ms,scored_meta,knowledge_point_ids&order=submitted_at.desc&limit=200`),
        pgFetch(`/escalations?student_id=eq.${studentId}&created_at=gte.${encodeURIComponent(sinceIso)}&select=kind,status,student_message,created_at&order=created_at.desc&limit=20`),
        pgFetch(`/student_states?student_id=eq.${studentId}&select=mastery_score,next_review_at,knowledge_points!inner(code,name)&order=mastery_score.asc&limit=10`),
    ]);

    const dialogues = dialoguesRes.ok ? await dialoguesRes.json() : [];
    const attempts = attemptsRes.ok ? await attemptsRes.json() : [];
    const escalations = escalationsRes.ok ? await escalationsRes.json() : [];
    const states = statesRes.ok ? await statesRes.json() : [];

    const weakKps = states.filter(s => s.mastery_score < 0.85);

    // 三件输出：headline / today_focus / parent_note
    const headline = buildHeadline(period, attempts, dialogues, escalations);
    const todayFocus = pickTodayFocus(weakKps);

    // parent_note · 只在有真信号时才输出（不强行写）
    let parentNote = null;
    const lateTired = findLateNightSignals(dialogues);
    if (lateTired) {
        parentNote = `昨晚 ${new Date(lateTired.created_at).getHours()}:${String(new Date(lateTired.created_at).getMinutes()).padStart(2, '0')} 提到「${lateTired.content?.slice(0, 18)}」，今天别催太狠`;
    } else {
        const emo = detectEmotionSignals(dialogues);
        if (emo.count >= 2) {
            parentNote = `${period === 'weekly' ? '本周' : '昨晚'}焦虑信号 ${emo.count} 次，可能压力偏大`;
        } else {
            const pendingEsc = escalations.filter(e => e.status === 'pending').length;
            if (pendingEsc > 0) {
                parentNote = `还有 ${pendingEsc} 条没回的学长求助 · 等回复中`;
            }
        }
    }

    // ─── 共享 detailed 块 ───
    const attemptsCorrect = attempts.filter(a => a.is_correct).length;
    const attemptsWrong = attempts.length - attemptsCorrect;
    const activeMinutes = Math.round(calcActiveMinutes(dialogues.map(d => d.created_at)));
    const detailed = {
        dialogues_count: dialogues.length,
        student_messages: dialogues.filter(d => d.role === 'student').length,
        tutor_messages: dialogues.filter(d => d.role === 'tutor').length,
        attempts_total: attempts.length,
        attempts_correct: attemptsCorrect,
        attempts_wrong: attemptsWrong,
        active_minutes: activeMinutes,
        escalations: escalations.map(e => ({ kind: e.kind, status: e.status, created_at: e.created_at })),
        weak_top3: weakKps.slice(0, 3).map(s => ({
            code: s.knowledge_points?.code,
            name: s.knowledge_points?.name,
            mastery: s.mastery_score,
        })),
    };

    const deterministicBody = {
        ok: true,
        period,
        enrich: 'deterministic',
        headline,
        today_focus: todayFocus,
        parent_note: parentNote,  // 可能 null
        detailed,
        engine_version: 'parent-brief-v1.1',
    };

    // ─── enrich=llm 分支 ───
    if (enrich === 'llm') {
        // DEEPSEEK 未配 → 直接走 deterministic + warning
        if (!DEEPSEEK_KEY) {
            return jsonResp(
                { ...deterministicBody, warning: 'DEEPSEEK_KEY 未配，已 fallback 到 deterministic 模式' },
                200,
                { 'X-Brief-Engine': 'deterministic-fallback' },
            );
        }

        // 聚合 LLM 输入数据
        const studentName = await fetchStudentName(studentId);
        const sessionCount = Math.max(1, Math.ceil(dialogues.length / 20)); // 启发式：每 20 条消息算一次会话
        const correctRate = attempts.length > 0
            ? Math.round(attemptsCorrect / attempts.length * 100)
            : 0;
        const attribution = aggregateAttribution(attempts);
        const masteryChanges = buildMasteryChanges(weakKps, attempts);
        const fatigueCount = countFatigueSignals(dialogues);
        const tutorTopics = tutorTopicsFromEscalations(escalations);

        const llmCtx = {
            period,
            student_name: studentName,
            session_count: sessionCount,
            active_minutes: activeMinutes,
            attempts_total: attempts.length,
            attempts_correct: attemptsCorrect,
            attempts_wrong: attemptsWrong,
            correct_rate: correctRate,
            mastery_changes: masteryChanges,
            attribution,
            tutor_topics: tutorTopics,
            escalations_count: escalations.length,
            fatigue_count: fatigueCount,
        };

        const llmResult = await callLLMForBrief(llmCtx);
        if (!llmResult.ok) {
            // LLM 失败 → fallback deterministic + warning，不返回 503
            return jsonResp(
                {
                    ...deterministicBody,
                    warning: `LLM 生成失败（${llmResult.reason}），已 fallback 到 deterministic 模式`,
                    _llm_error: llmResult.reason,
                },
                200,
                { 'X-Brief-Engine': 'deterministic-fallback' },
            );
        }

        const llm = llmResult.data;
        return jsonResp(
            {
                ok: true,
                period,
                enrich: 'llm',
                headline: String(llm.headline || '').slice(0, 80),
                sections: {
                    progress_dashboard: String(llm.progress_dashboard || ''),
                    error_attribution: String(llm.error_attribution || ''),
                    parent_advice_dos: (llm.parent_advice_dos || []).map(String),
                    parent_advice_donts: (llm.parent_advice_donts || []).map(String),
                    next_week_focus: String(llm.next_week_focus || '').slice(0, 60),
                },
                detailed,
                engine_version: 'parent-brief-v1.1-llm',
            },
            200,
            { 'X-Brief-Engine': 'llm' },
        );
    }

    // ─── deterministic 默认分支（向后兼容）───
    return jsonResp(deterministicBody, 200, { 'X-Brief-Engine': 'deterministic' });
}
