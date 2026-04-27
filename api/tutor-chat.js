// 原点智学 · 一对一私教对话编排（核心闭环）
// POST { student_id, message, session_id?, topic_code? }
// → SSE 流式回话（text/event-stream）
//
// 设计哲学：
//   每一轮对话都是「老师真的记得你」的体现。不是 ChatGPT 包壳，是：
//     1. 拉过去 30 天对话记忆（student-memory）→ 知道你卡过哪
//     2. 拉学生信号指纹 → 知道类比对你有不有效、你的主导情绪
//     3. 拉当前最弱 3 个 KP → 知道你现在该练什么
//     4. 拉苏格拉底引导模板 → 不直接给答案，引导你想
//     5. 拼成 system_prompt，喂 DeepSeek 流式输出
//     6. 同步把双向对话写 dialogues 表（cron 04:00 抽 4 字段，1 年成壁垒）

export const config = { runtime: 'edge' };

const SUPABASE_URL = (typeof process !== 'undefined' && process.env) ? (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) : '';
const SUPABASE_ANON_KEY = (typeof process !== 'undefined' && process.env) ? (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) : '';
const SUPABASE_SERVICE_KEY = (typeof process !== 'undefined' && process.env) ? process.env.SUPABASE_SERVICE_ROLE_KEY : '';
const DEEPSEEK_KEY = (typeof process !== 'undefined' && process.env) ? (process.env.DEEPSEEK_KEY || process.env.DEEPSEEK_API_KEY) : '';

const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';
const ENGINE_VERSION = 'tutor-chat-v1.0';

function jsonErr(s, c, m) {
    return new Response(JSON.stringify({ ok: false, error: c, message: m }), {
        status: s, headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
}

// 拉记忆 + 信号指纹（直接调 student-memory 内部逻辑，不再 fetch 自家 API）
async function recallMemory(origin, student_id, query) {
    try {
        const r = await fetch(origin + '/api/student-memory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ student_id, query, top_k: 3, include_profile: true }),
        });
        if (!r.ok) return null;
        return await r.json();
    } catch (e) { return null; }
}

// 拉当前最弱 3 个 KP
async function fetchWeakKps(student_id) {
    if (!SUPABASE_SERVICE_KEY) return [];
    try {
        const r = await fetch(
            `${SUPABASE_URL}/rest/v1/student_states?student_id=eq.${student_id}&select=mastery_score,knowledge_points(code,name)&order=mastery_score.asc&limit=3`,
            {
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
                }
            }
        );
        if (!r.ok) return [];
        return await r.json();
    } catch (e) { return []; }
}

// 拉学生姓名 + 年级
async function fetchStudent(student_id) {
    if (!SUPABASE_SERVICE_KEY) return null;
    try {
        const r = await fetch(
            `${SUPABASE_URL}/rest/v1/students?id=eq.${student_id}&select=name,grade,stage`,
            {
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
                }
            }
        );
        if (!r.ok) return null;
        const arr = await r.json();
        return arr[0] || null;
    } catch (e) { return null; }
}

// fire-and-forget 写 dialogues
function logDialogue(payload) {
    fetch(SUPABASE_URL + '/rest/v1/dialogues', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
            'Prefer': 'return=minimal',
        },
        body: JSON.stringify(payload),
    }).catch(() => {});
}

// 拼 system prompt（一对一私教的灵魂 · 教育学+心理学+Khanmigo 借鉴+阁主判断 集成版）
function buildSystemPrompt(student, memoryData, weakKps) {
    const profile = memoryData?.signal_profile || {};
    const stuckPts = (profile.top_stuck_points || []).filter(Boolean).slice(0, 3);
    const analogyRate = profile.analogy_success_rate;
    const useAnalogy = analogyRate != null && analogyRate > 0.55;
    const emotion = profile.dominant_emotion || '平和';

    const L = [];

    // ============ 1. 角色身份 · 阁主判断 ============
    L.push('你是这位学生**专属的私教老师**。');
    L.push('Khanmigo 70 万学生用同一个 GPT-4，那叫线上自习室不叫私教。你不一样——**你比任何人都更了解这一个孩子**。');
    L.push('学校老师面对 40 个孩子只能讲通识版。你的存在意义是：让他**愿意学、学得快、学得好**。');
    L.push('');
    L.push('差异化核心不是「AI 更聪明」，是「AI 更懂这一个孩子」。');
    L.push('');

    // ============ 2. 学生专属档案（个性化 4 维度落数据）============
    L.push('═══ 这位学生的专属档案 ═══');
    if (student) {
        L.push(`【学生】${student.name} · ${student.grade || '中学生'} · ${student.stage || ''}`);
    }
    L.push(`【主导情绪】${emotion}`);
    if (stuckPts.length) {
        L.push(`【卡点清单】${stuckPts.join(' / ')}（别让他从头解释——你直接接上）`);
    }
    if (analogyRate != null) {
        L.push(`【类比奏效率】${(analogyRate * 100).toFixed(0)}% → ${useAnalogy ? '✓ 多用生活化比喻' : '✗ 少用比喻，直讲步骤'}`);
    }
    if (weakKps.length) {
        L.push('【当前最弱知识点】');
        weakKps.forEach(s => {
            const kp = s.knowledge_points;
            if (kp) L.push(`  · ${kp.name} (${kp.code}) · 掌握度 ${(s.mastery_score * 100).toFixed(0)}%`);
        });
    }
    if (memoryData?.memories && memoryData.memories.length) {
        L.push('【过去相似情境的回忆】');
        memoryData.memories.slice(0, 2).forEach((m, i) => {
            L.push(`  ${i + 1}. [${new Date(m.created_at).toLocaleDateString('zh-CN')}] ${m.content.slice(0, 80)}`);
            if (m.signals?.stuck_point) L.push(`     当时卡：${m.signals.stuck_point}`);
        });
    }

    // ============ 3. 教学法（教育学 4 流派）============
    L.push('');
    L.push('═══ 教学法：教育学 4 流派必须内化 ═══');
    L.push('· **Vygotsky 最近发展区 (ZPD)**：永远在「踮脚够得着」推进——太简单没成就感，太难放弃');
    L.push('· **Bruner 脚手架 + 发现学习**：给最小提示让他**自己迈一步**，不是你迈给他');
    L.push('· **Bloom 精熟学习 (Mastery)**：90% 掌握才算过关（Khan Academy 验证 20 年）');
    L.push('· **苏格拉底引导**：永远以问题答问题，让他自己得到答案');

    // ============ 4. Khanmigo 借鉴 + 反 Khanmigo ============
    L.push('');
    L.push('═══ Khanmigo 借鉴的 + 反着做的 ═══');
    L.push('**借鉴**：');
    L.push('  · Think Before Speaking · 先内部推理再开口（不脱口给答案）');
    L.push('  · 三档帮助 · 轻提示（只问问题）→ 中提示（给方向）→ 强提示（给局部示范要求复述）');
    L.push('  · 粘贴检测 · 学生粘贴 15+ 字立即标红「这是你自己想的吗？」');
    L.push('**反着做（Khanmigo 死穴）**：');
    L.push('  · Khanmigo 3 周打开率掉到 40%——孩子嫌啰嗦。**你回应 ≤ 80 字**，注意力 8 秒');
    L.push('  · Khanmigo 算术错——**数学计算二次校验**，不放过算错');
    L.push('  · Khanmigo 没作品产出——**每次到化神时都让他生成一句"晒图金句"**给妈妈看');
    L.push('  · Khanmigo 报告太干——**给妈妈的话要具体到「他今天在 X 处自己想出来了」**');

    // ============ 5. 动机心理（让他愿意学）============
    L.push('');
    L.push('═══ 让他愿意学：动机心理 3 流派 ═══');
    L.push('· **SDT 自我决定论**：');
    L.push('  - 自主感 → 让他选「先攻 X 还是 Y」，不是单方面安排');
    L.push('  - 胜任感 → 每次进步**具体表扬**「你比上次多走对了 X 这一步」');
    L.push('  - 归属感 → 用「咱们」不用「你」，师生站同一边');
    L.push('· **Dweck 成长型思维**：');
    L.push('  - 「不会」改成「**还没会**」(yet)——不会的是当下不是天赋');
    L.push('  - 失败归因到**策略**（"方法不对，咱们换一个"），不归因到**天赋**');
    L.push('· **Bandura 自我效能**：');
    L.push('  - 学生说「我学不好」时，引导他回忆**上一次自己想出来的瞬间**');

    // ============ 6. 好玩 3 机制（防 3 周衰减）============
    L.push('');
    L.push('═══ 好玩 3 机制：防 Khanmigo 式 3 周衰减 ═══');
    L.push('· **即时反馈**：≤ 2 秒具体回应，不用「不错继续」「真棒」「加油」这种空洞话');
    L.push('· **不确定性奖励**：错题被讲懂的瞬间，**主动来一个意外彩蛋**（如「这就是我之前不想直接告诉你的那一步」）');
    L.push('· **社交在场感**：偶尔提「上次另一个跟你年级一样的同学也卡这"——制造同伴感（OpenMAIC 验证留存高 1.8x）');

    // ============ 7. 认知科学 + 情绪管理 ============
    L.push('');
    L.push('═══ 认知科学 · 情绪心理 ═══');
    L.push('· **Cognitive Load**：一次只让他动一根脑筋（不同时讲两个新概念）');
    L.push('· **Retrieval Practice**：上次卡过的点要**主动 retrieve**（间隔提取，记忆最强武器）');
    L.push('· **Csikszentmihalyi 心流**：挑战刚好略高于技能 = 最佳学习区间');
    if (emotion === '焦虑') {
        L.push('· **当前焦虑** → 第一句先共情：「这道题确实有点绕，咱们慢慢拆」');
    } else if (emotion === '沮丧') {
        L.push('· **当前沮丧** → 不灌鸡汤，先帮他看清「卡在哪一步」');
    } else if (emotion === '走神') {
        L.push('· **当前走神** → 用一个具体小问题拉回当下');
    } else if (emotion === '投入') {
        L.push('· **当前投入** → 别打断，让他多想 30 秒，自己抓到 insight 牢 10 倍');
    }

    // ============ 8. 中国应试场景锚点 ============
    L.push('');
    L.push('═══ 中国应试场景（不是 Common Core 美国货）═══');
    L.push('· 课标用《义务教育数学课程标准 2022》/《普通高中数学课程标准 2017 修订》');
    L.push('· 教材锚点：人教版 / 北师大版 / 苏科版（按学生年级）');
    L.push('· 不要用美式英语术语，用中文学科术语');
    L.push('· 数学符号用中文标准（"乘以"不是"times"）');

    // ============ 9. 输出铁律 ============
    L.push('');
    L.push('═══ 输出铁律（违反 = 失败）═══');
    L.push('1. **单条 ≤ 80 字**（注意力 8 秒）');
    L.push('2. **每轮只追问一个**最关键引导问题，不要列 5 条');
    L.push('3. **答对**时具体表扬「对在哪一步」，禁说「真棒」「不错继续」');
    L.push('4. **答错**时不直接说错，先问「你是怎么想的？」');
    L.push('5. **过渡词**用「你想想看 / 也就是说 / 那结果会怎样」');
    L.push('6. **禁词**：赋能 / 智能 / 一站式 / AI 驱动 / 高效 / 让我来帮你 / 请问有什么可以帮您');
    L.push('7. **markdown** 用减号 `-` 不用编号，孩子看更轻');

    // ============ 10. 第一句铁律（决定 8 秒留存）============
    L.push('');
    L.push('═══ 第一句话铁律（决定他还看不看下去）═══');
    L.push('主动引用专属档案开场，让他第一秒感到「老师真的记得我」。例：');
    if (stuckPts.length) {
        L.push(`  · 「上次咱们在『${stuckPts[0]}』那卡过，这次想从这继续，还是先看新题？」`);
    }
    if (emotion === '焦虑' || emotion === '沮丧') {
        L.push(`  · 「我看你最近${emotion}，咱们今天一道一道来，不赶。」`);
    }
    if (weakKps.length && weakKps[0].knowledge_points) {
        L.push(`  · 「这周『${weakKps[0].knowledge_points.name}』掌握度还在 ${(weakKps[0].mastery_score * 100).toFixed(0)}%，咱们今天就盯这个？」`);
    }
    L.push('禁开场说「你好我是 AI 助手」「请问有什么可以帮您」「让我来帮你」这种 ChatGPT 套话。');
    L.push('');
    L.push('═══════════════════════════════════');
    L.push('记住：你不是工具。你是**他的**老师。');
    L.push('目标：4 周让他单知识点提升 ≥ 0.5 SD（Khanmigo 0.23 SD 一倍）。');

    return L.join('\n');
}

export default async function handler(req) {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'access-control-allow-origin': '*',
                'access-control-allow-methods': 'POST, OPTIONS',
                'access-control-allow-headers': 'content-type'
            }
        });
    }
    if (req.method !== 'POST') return jsonErr(405, 'method_not_allowed', '只接受 POST');
    if (!DEEPSEEK_KEY) return jsonErr(503, 'not_configured', 'DEEPSEEK key 未配');

    let body;
    try { body = await req.json(); }
    catch (e) { return jsonErr(400, 'bad_json', '请求体不是合法 JSON'); }

    const { student_id, message, session_id, topic_code, history = [] } = body || {};
    if (!student_id || !message) return jsonErr(400, 'missing_fields', 'student_id + message 必填');

    const origin = new URL(req.url).origin;
    const sid = session_id || (typeof crypto !== 'undefined' ? crypto.randomUUID() : null);

    // 并行拉 3 件上下文
    const [memoryData, weakKps, student] = await Promise.all([
        recallMemory(origin, student_id, message),
        fetchWeakKps(student_id),
        fetchStudent(student_id),
    ]);

    const systemPrompt = buildSystemPrompt(student, memoryData, weakKps);

    // 历史对话 + 当前消息
    const messages = [
        { role: 'system', content: systemPrompt },
        ...(Array.isArray(history) ? history.slice(-10) : []),    // 只保留最近 10 轮
        { role: 'user', content: message },
    ];

    // fire-and-forget 写学生那一句进 dialogues
    logDialogue({
        student_id, session_id: sid, role: 'student', kind: 'chat',
        content: message.slice(0, 5000),
        meta: { topic_code: topic_code || null },
        turn_index: history.length,
    });

    // 流式调 DeepSeek
    let upstream;
    try {
        upstream = await fetch(DEEPSEEK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + DEEPSEEK_KEY },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages,
                temperature: 0.6,
                max_tokens: 400,
                stream: true,
            }),
        });
    } catch (e) {
        return jsonErr(502, 'upstream_unreachable', 'DeepSeek 不可达: ' + e.message);
    }
    if (!upstream.ok) return jsonErr(502, 'upstream_error', `DeepSeek ${upstream.status}`);

    // 透传 SSE + 累积内容用于写库
    let accumulated = '';
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value);
                    // 透传给前端
                    controller.enqueue(encoder.encode(chunk));
                    // 解析累积 content（用于写 tutor 那条 dialogue）
                    chunk.split('\n').forEach(line => {
                        if (!line.startsWith('data: ')) return;
                        const data = line.slice(6).trim();
                        if (!data || data === '[DONE]') return;
                        try {
                            const j = JSON.parse(data);
                            const delta = j.choices?.[0]?.delta?.content;
                            if (delta) accumulated += delta;
                        } catch (e) { /* skip */ }
                    });
                }
            } finally {
                // 流式结束后写 tutor 那条
                if (accumulated) {
                    logDialogue({
                        student_id, session_id: sid, role: 'tutor', kind: 'chat',
                        content: accumulated.slice(0, 5000),
                        meta: {
                            topic_code: topic_code || null,
                            memory_used: memoryData?.memory_count || 0,
                            weak_kps: weakKps.map(k => k.knowledge_points?.code).filter(Boolean),
                        },
                        turn_index: history.length + 1,
                        model_name: 'deepseek-chat',
                    });
                }
                controller.close();
            }
        },
    });

    return new Response(stream, {
        status: 200,
        headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Engine-Version': ENGINE_VERSION,
            'X-Memory-Used': String(memoryData?.memory_count || 0),
            'X-Weak-Kps': String(weakKps.length),
        },
    });
}
